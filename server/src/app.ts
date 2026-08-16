/**
 * Fastify 앱 조립. 계약의 단일 출처는 프론트 src/lib/api/guestbook.ts 이며,
 * 명세는 _workspace/06_backend_api_spec.md 다.
 *
 * 핵심 원칙:
 * - 응답 스키마(serializer)로 명세 외 필드 직렬화를 차단한다 (shape 불일치 방지)
 * - 에러 응답은 { error: { code, message } } 로 통일한다
 * - 로그에 개인정보(본문·닉네임·원문 IP)를 남기지 않는다
 */
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { timingSafeEqual } from "node:crypto";
import type { AppConfig } from "./config.js";
import { GuestbookRepository, createPool } from "./db.js";
import { errorBody } from "./lib/errors.js";
import { hashIp } from "./lib/ipHash.js";
import { SlidingWindowLimiter } from "./lib/rateLimit.js";
import { validateGuestbookInput } from "./lib/validate.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** 명세 4.3절 수치 */
const POST_RULES = [
  { windowMs: MINUTE, max: 3 },
  { windowMs: HOUR, max: 10 },
  { windowMs: DAY, max: 30 },
];
const POST_MIN_INTERVAL_MS = 30_000;
const GET_RULES = [{ windowMs: MINUTE, max: 60 }];
const ADMIN_RULES = [{ windowMs: MINUTE, max: 10 }];

const BODY_LIMIT_BYTES = 16 * 1024;
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

function constantTimeEquals(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(actual, "utf-8");
  if (expectedBuf.length !== actualBuf.length) {
    // 길이가 다르면 동일 길이 더미 비교로 시간 균일화 후 false
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}

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
  const repo = new GuestbookRepository(pool);

  const postLimiter = new SlidingWindowLimiter(POST_RULES);
  const getLimiter = new SlidingWindowLimiter(GET_RULES);
  const adminLimiter = new SlidingWindowLimiter(ADMIN_RULES);
  const sweepTimer = setInterval(() => {
    postLimiter.sweep();
    getLimiter.sweep();
    adminLimiter.sweep();
  }, 10 * MINUTE);
  sweepTimer.unref();

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Accept"],
    exposedHeaders: ["X-Total-Count"],
  });

  /* ---------- 공통 에러 형식 ---------- */

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send(errorBody("NOT_FOUND", "요청한 리소스를 찾을 수 없습니다."));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode === 413) {
      void reply
        .status(413)
        .send(errorBody("PAYLOAD_TOO_LARGE", "요청 크기가 허용 범위(16KB)를 초과했습니다."));
      return;
    }
    // JSON 파싱 실패 등 클라이언트 오류
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      void reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", "요청 형식이 올바르지 않습니다."));
      return;
    }
    // 내부 오류: 상세는 로그에만 (개인정보 없는 에러 객체)
    request.log.error({ err: { message: error.message, name: error.name } }, "internal error");
    void reply
      .status(500)
      .send(errorBody("INTERNAL_ERROR", "서버 내부 오류가 발생했습니다."));
  });

  /* ---------- GET /health ---------- */

  app.get("/health", async () => ({ status: "ok" }));

  /* ---------- GET /guestbook — 목록 (최상위 배열, 명세 2.1절) ---------- */

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

      const { entries, total } = await repo.list(limit, offset);
      return reply.status(200).header("X-Total-Count", String(total)).send(entries);
    },
  );

  /* ---------- POST /guestbook — 등록 (단일 객체, 201, 명세 2.2절) ---------- */

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
      // 연속 등록 제한 (30초) → 다중 윈도 한도 순으로 검사
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
      if (await repo.hasRecentDuplicate(ipHash, body)) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "이미 등록된 내용입니다."));
      }

      const entry = await repo.create(author, body, ipHash);
      // 성공한 등록만 rate limit 카운트에 기록 (검증 실패로 조합원이 잠기지 않게)
      postLimiter.record(request.ip);
      return reply.status(201).send(entry);
    },
  );

  /* ---------- DELETE /admin/guestbook/:id — 관리자 soft delete (명세 2.3절) ---------- */

  app.delete("/admin/guestbook/:id", async (request, reply) => {
    const decision = adminLimiter.consume(request.ip);
    if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

    const authHeader = request.headers.authorization;
    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;
    if (token === null || !constantTimeEquals(config.adminApiToken, token)) {
      request.log.warn({ route: "admin-delete", result: "unauthorized" }, "admin auth failed");
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

    const deleted = await repo.softDelete(id);
    // 감사 로그: 대상 id·결과만 (본문·닉네임 미기록)
    request.log.info({ route: "admin-delete", targetId: id, deleted }, "admin delete");
    if (!deleted) {
      return reply
        .status(404)
        .send(errorBody("NOT_FOUND", "해당 글이 없거나 이미 삭제되었습니다."));
    }
    return reply.status(200).send({ deleted: true, id });
  });

  app.addHook("onClose", async () => {
    clearInterval(sweepTimer);
    await pool.end();
  });

  return app;
}
