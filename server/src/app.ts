/**
 * Fastify 앱 조립. 계약: _workspace/06_backend_api_spec.md
 *  - Part 1 (방명록): 프론트 guestbook.ts 가 계약의 출처
 *  - Part 2 (게시물·admin): 명세가 계약의 출처, 프론트가 따라옴
 *
 * 핵심 원칙:
 * - 응답 스키마(serializer)로 명세 외 필드 직렬화를 차단한다
 * - 에러 응답은 { error: { code, message } } 로 통일한다
 * - 로그에 개인정보(본문·닉네임·원문 IP)를 남기지 않는다
 */
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { AppConfig } from "./config.js";
import { GuestbookRepository, createPool } from "./db.js";
import { authenticateAdmin } from "./lib/adminGuard.js";
import { errorBody } from "./lib/errors.js";
import { hashIp } from "./lib/ipHash.js";
import { SlidingWindowLimiter } from "./lib/rateLimit.js";
import { validateGuestbookInput } from "./lib/validate.js";
import { AttachmentsRepository } from "./repos/attachments.js";
import { PostsRepository } from "./repos/posts.js";
import { SessionsRepository } from "./repos/sessions.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerPublicPostRoutes } from "./routes/posts.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** 명세 4.3절 + §12.1 수치 */
const POST_RULES = [
  { windowMs: MINUTE, max: 3 },
  { windowMs: HOUR, max: 10 },
  { windowMs: DAY, max: 30 },
];
const POST_MIN_INTERVAL_MS = 30_000;
const GET_RULES = [{ windowMs: MINUTE, max: 60 }];
const FILES_RULES = [{ windowMs: MINUTE, max: 120 }];
const ADMIN_RULES = [{ windowMs: MINUTE, max: 10 }];
const LOGIN_RULES = [
  { windowMs: MINUTE, max: 5 },
  { windowMs: HOUR, max: 10 },
];

const BODY_LIMIT_BYTES = 16 * 1024;
const MULTIPART_LIMIT_BYTES = 11 * 1024 * 1024; // 파일 10MB + 오버헤드
const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GuestbookEntry 직렬화 스키마 — 4개 필드 외에는 응답에 나가지 않는다 */
const entrySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    author: { type: "string" },
    body: { type: "string" },
    createdAt: { type: "string" },
  },
  required: ["id", "author", "body", "createdAt"],
  additionalProperties: false,
};

/** 에러 응답 직렬화 스키마 — { error: { code, message } } 형식 고정 (명세 2.4절) */
const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
      required: ["code", "message"],
      additionalProperties: false,
    },
  },
  required: ["error"],
  additionalProperties: false,
};

function tooManyRequests(reply: FastifyReply, retryAfterSeconds: number): FastifyReply {
  return reply
    .status(429)
    .header("Retry-After", String(retryAfterSeconds))
    .send(errorBody("RATE_LIMITED", "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."));
}

export interface AppDeps {
  config: AppConfig;
}

export async function buildApp({ config }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: config.trustProxy,
    bodyLimit: BODY_LIMIT_BYTES,
    logger: {
      level: config.logLevel,
      // 개인정보 미로깅: 요청 ID·메서드·경로·상태코드·소요시간만. remoteAddress(원문 IP) 제외.
      serializers: {
        req(request) {
          return { method: request.method, url: request.url };
        },
        res(reply) {
          return { statusCode: reply.statusCode };
        },
      },
    },
    disableRequestLogging: false,
  });

  const pool = createPool(config.databaseUrl);
  const guestbook = new GuestbookRepository(pool);
  const posts = new PostsRepository(pool);
  const attachments = new AttachmentsRepository(pool);
  const sessions = new SessionsRepository(pool);

  const postLimiter = new SlidingWindowLimiter(POST_RULES);
  const getLimiter = new SlidingWindowLimiter(GET_RULES);
  const filesLimiter = new SlidingWindowLimiter(FILES_RULES);
  const adminLimiter = new SlidingWindowLimiter(ADMIN_RULES);
  const loginLimiter = new SlidingWindowLimiter(LOGIN_RULES);
  const sweepTimer = setInterval(() => {
    postLimiter.sweep();
    getLimiter.sweep();
    filesLimiter.sweep();
    adminLimiter.sweep();
    loginLimiter.sweep();
  }, 10 * MINUTE);
  sweepTimer.unref();

  await app.register(cors, {
    // 정확 매칭 allowlist (와일드카드 금지 — 리더 조건). credentials 는 이 목록에만 허용.
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Accept"],
    exposedHeaders: ["X-Total-Count"],
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: MULTIPART_LIMIT_BYTES, files: 1 } });

  /* ---------- 공통 에러 형식 ---------- */

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send(errorBody("NOT_FOUND", "요청한 리소스를 찾을 수 없습니다."));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode === 413) {
      void reply
        .status(413)
        .send(errorBody("PAYLOAD_TOO_LARGE", "요청 크기가 허용 범위를 초과했습니다."));
      return;
    }
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      void reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", "요청 형식이 올바르지 않습니다."));
      return;
    }
    request.log.error({ err: { message: error.message, name: error.name } }, "internal error");
    void reply
      .status(500)
      .send(errorBody("INTERNAL_ERROR", "서버 내부 오류가 발생했습니다."));
  });

  /* ---------- GET /health ---------- */

  app.get("/health", async () => ({ status: "ok" }));

  /* ---------- 방명록 (Part 1 — guestbook.ts 계약 유지) ---------- */

  app.get(
    "/guestbook",
    {
      schema: {
        response: {
          200: { type: "array", items: entrySchema },
          "4xx": errorSchema,
          "5xx": errorSchema,
        },
      },
    },
    async (request, reply) => {
      const decision = getLimiter.consume(request.ip);
      if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

      const query = request.query as Record<string, unknown>;
      const rawLimit = query["limit"];
      const rawOffset = query["offset"];

      let limit = LIST_DEFAULT_LIMIT;
      if (rawLimit !== undefined) {
        const parsed = Number.parseInt(String(rawLimit), 10);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > LIST_MAX_LIMIT) {
          return reply
            .status(400)
            .send(errorBody("VALIDATION_ERROR", `limit 은 1 이상 ${LIST_MAX_LIMIT} 이하의 정수여야 합니다.`));
        }
        limit = parsed;
      }

      let offset = 0;
      if (rawOffset !== undefined) {
        const parsed = Number.parseInt(String(rawOffset), 10);
        if (!Number.isInteger(parsed) || parsed < 0) {
          return reply
            .status(400)
            .send(errorBody("VALIDATION_ERROR", "offset 은 0 이상의 정수여야 합니다."));
        }
        offset = parsed;
      }

      const { entries, total } = await guestbook.list(limit, offset);
      return reply.status(200).header("X-Total-Count", String(total)).send(entries);
    },
  );

  app.post(
    "/guestbook",
    {
      schema: {
        response: {
          201: entrySchema,
          "4xx": errorSchema,
          "5xx": errorSchema,
        },
      },
    },
    async (request, reply) => {
      const intervalDecision = postLimiter.checkMinInterval(request.ip, POST_MIN_INTERVAL_MS);
      if (!intervalDecision.allowed) {
        return tooManyRequests(reply, intervalDecision.retryAfterSeconds);
      }
      const windowDecision = postLimiter.check(request.ip);
      if (!windowDecision.allowed) {
        return tooManyRequests(reply, windowDecision.retryAfterSeconds);
      }

      const validation = validateGuestbookInput(request.body);
      if (!validation.ok) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", validation.message));
      }
      const { author, body } = validation.value;

      const ipHash = hashIp(request.ip, config.ipHashSecret);
      if (await guestbook.hasRecentDuplicate(ipHash, body)) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "이미 등록된 내용입니다."));
      }

      const entry = await guestbook.create(author, body, ipHash);
      postLimiter.record(request.ip);
      return reply.status(201).send(entry);
    },
  );

  /** 방명록 관리자 삭제 — 정적 Bearer(복구용) 또는 세션 쿠키 (§12.2 병행) */
  app.delete("/admin/guestbook/:id", async (request, reply) => {
    // 실패한 인증 시도만 카운트 (분당 10회 — 무차별 대입 방어, admin.ts 와 동일 정책)
    const decision = adminLimiter.check(request.ip);
    if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

    const method = await authenticateAdmin(request, { adminApiToken: config.adminApiToken, sessions });
    if (method === null) {
      adminLimiter.record(request.ip);
      request.log.warn({ route: "admin-guestbook-delete", result: "unauthorized" }, "admin auth failed");
      return reply
        .status(401)
        .send(errorBody("UNAUTHORIZED", "관리자 인증에 실패했습니다."));
    }

    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
    }

    const deleted = await guestbook.softDelete(id);
    request.log.info({ route: "admin-guestbook-delete", targetId: id, deleted, method }, "admin delete");
    if (!deleted) {
      return reply
        .status(404)
        .send(errorBody("NOT_FOUND", "해당 글이 없거나 이미 삭제되었습니다."));
    }
    return reply.status(200).send({ deleted: true, id });
  });

  /* ---------- 게시물 공개 + Admin (Part 2) ---------- */

  registerPublicPostRoutes(app, {
    posts,
    attachments,
    getLimiter,
    filesLimiter,
    uploadDir: config.uploadDir,
    errorSchema,
    tooManyRequests,
  });

  registerAdminRoutes(app, {
    config,
    posts,
    attachments,
    sessions,
    adminLimiter,
    loginLimiter,
    errorSchema,
    tooManyRequests,
  });

  app.addHook("onClose", async () => {
    clearInterval(sweepTimer);
    await pool.end();
  });

  return app;
}
