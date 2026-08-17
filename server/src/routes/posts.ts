/**
 * 공개 게시물 라우트 (명세 06 §11) — 인증 없음.
 * GET /posts, GET /posts/:id, GET /files/:attachmentId/:filename, GET /thumbnails/:key
 */
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { errorBody } from "../lib/errors.js";
import { dispositionFor } from "../lib/fileTypes.js";
import { POST_CATEGORY_REQUIRED_ERROR, isPostCategory } from "../lib/postValidate.js";
import type { SlidingWindowLimiter } from "../lib/rateLimit.js";
import { THUMBNAIL_KEY_PATTERN, THUMBNAIL_SUBDIR, thumbnailFilePath } from "../lib/youtubeThumbnail.js";
import type { AttachmentsRepository } from "../repos/attachments.js";
import type { PostsRepository } from "../repos/posts.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 100;

const attachmentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    filename: { type: "string" },
    mimeType: { type: "string" },
    sizeBytes: { type: "number" },
    url: { type: "string" },
  },
  required: ["id", "filename", "mimeType", "sizeBytes", "url"],
  additionalProperties: false,
};

const postSummaryProperties = {
  id: { type: "string" },
  category: { type: "string" },
  type: { type: "string" },
  title: { type: "string" },
  url: { type: ["string", "null"] },
  source: { type: ["string", "null"] },
  urgent: { type: "boolean" },
  deadline: { type: ["string", "null"] },
  publishedAt: { type: "string" },
  attachments: { type: "array", items: attachmentSchema },
  /**
   * 계약 §6. `additionalProperties: false` 이므로 여기에 없는 필드는 **직렬화 단계에서
   * 조용히 사라진다** — 응답 필드를 추가할 때 이 스키마 갱신을 빼먹으면 원인 찾기 어려운
   * "서버는 넣었는데 클라이언트에 안 오는" 고장이 된다.
   * `sortOrder` 는 여기에 넣지 않는다 (admin 전용 — admin.ts 의 adminPostSchema).
   */
  thumbnailUrl: { type: ["string", "null"] },
};
const summaryRequired = ["id", "category", "type", "title", "url", "source", "urgent", "deadline", "publishedAt", "attachments", "thumbnailUrl"];

export const postSummarySchema = {
  type: "object",
  properties: postSummaryProperties,
  required: summaryRequired,
  additionalProperties: false,
};

export const postDetailSchema = {
  type: "object",
  properties: { ...postSummaryProperties, body: { type: ["string", "null"] } },
  required: [...summaryRequired, "body"],
  additionalProperties: false,
};

export interface PublicPostDeps {
  posts: PostsRepository;
  attachments: AttachmentsRepository;
  getLimiter: SlidingWindowLimiter;
  filesLimiter: SlidingWindowLimiter;
  uploadDir: string;
  errorSchema: object;
  tooManyRequests: (reply: FastifyReply, retryAfterSeconds: number) => FastifyReply;
}

export function parseListQuery(
  query: Record<string, unknown>,
): { ok: true; limit: number; offset: number } | { ok: false; message: string } {
  let limit = LIST_DEFAULT_LIMIT;
  const rawLimit = query["limit"];
  if (rawLimit !== undefined) {
    const parsed = Number.parseInt(String(rawLimit), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > LIST_MAX_LIMIT) {
      return { ok: false, message: `limit 은 1 이상 ${LIST_MAX_LIMIT} 이하의 정수여야 합니다.` };
    }
    limit = parsed;
  }
  let offset = 0;
  const rawOffset = query["offset"];
  if (rawOffset !== undefined) {
    const parsed = Number.parseInt(String(rawOffset), 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, message: "offset 은 0 이상의 정수여야 합니다." };
    }
    offset = parsed;
  }
  return { ok: true, limit, offset };
}

export function registerPublicPostRoutes(app: FastifyInstance, deps: PublicPostDeps): void {
  const { posts, attachments, getLimiter, filesLimiter, uploadDir, errorSchema, tooManyRequests } = deps;

  app.get(
    "/posts",
    {
      schema: {
        response: {
          200: { type: "array", items: postSummarySchema },
          "4xx": errorSchema,
          "5xx": errorSchema,
        },
      },
    },
    async (request, reply) => {
      const decision = getLimiter.consume(request.ip);
      if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

      const query = request.query as Record<string, unknown>;
      const category = query["category"];
      if (!isPostCategory(category)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", POST_CATEGORY_REQUIRED_ERROR));
      }
      const rawUrgent = query["urgent"];
      if (rawUrgent !== undefined && rawUrgent !== "true" && rawUrgent !== "false") {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", "urgent 는 true 또는 false 여야 합니다."));
      }
      const paging = parseListQuery(query);
      if (!paging.ok) return reply.status(400).send(errorBody("VALIDATION_ERROR", paging.message));

      const { posts: rows, total } = await posts.listPublic(category, rawUrgent === "true", paging.limit, paging.offset);
      return reply.status(200).header("X-Total-Count", String(total)).send(rows);
    },
  );

  app.get(
    "/posts/:id",
    {
      schema: {
        response: { 200: postDetailSchema, "4xx": errorSchema, "5xx": errorSchema },
      },
    },
    async (request, reply) => {
      const decision = getLimiter.consume(request.ip);
      if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

      const { id } = request.params as { id: string };
      if (!UUID_PATTERN.test(id)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
      }
      const post = await posts.getPublic(id);
      if (post === null) {
        return reply.status(404).send(errorBody("NOT_FOUND", "해당 게시물이 없습니다."));
      }
      return reply.status(200).send(post);
    },
  );

  app.get("/files/:attachmentId/:filename", async (request, reply) => {
    const decision = filesLimiter.consume(request.ip);
    if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

    const { attachmentId, filename } = request.params as { attachmentId: string; filename: string };
    if (!UUID_PATTERN.test(attachmentId)) {
      return reply.status(404).send(errorBody("NOT_FOUND", "파일을 찾을 수 없습니다."));
    }
    const record = await attachments.getForServe(attachmentId);
    // 파일명은 표시명 검증 용도 — DB 값과 불일치 시 404 (경로 해석에는 미사용)
    if (record === null || decodeURIComponent(filename) !== record.filename) {
      return reply.status(404).send(errorBody("NOT_FOUND", "파일을 찾을 수 없습니다."));
    }
    const filePath = path.join(uploadDir, record.storageKey); // storage_key 는 서버 생성 uuid.ext
    if (!fs.existsSync(filePath)) {
      request.log.error({ attachmentId }, "attachment file missing on disk");
      return reply.status(404).send(errorBody("NOT_FOUND", "파일을 찾을 수 없습니다."));
    }
    const disposition = dispositionFor(record.mimeType);
    const encodedName = encodeURIComponent(record.filename);
    return reply
      .status(200)
      .header("Content-Type", record.mimeType)
      .header("Content-Length", String(record.sizeBytes))
      .header("Content-Disposition", `${disposition}; filename*=UTF-8''${encodedName}`)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(fs.createReadStream(filePath));
  });

  /**
   * GET /thumbnails/:key — 서버가 캐싱한 YouTube 썸네일 제공 (계약 §5).
   *
   * 경로 조작이 **구조적으로 불가능**하다: `key` 는 `^[A-Za-z0-9_-]{11}-(maxres|mq)default\.jpg$`
   * 를 통과해야만 파일시스템 경로 조립에 쓰인다. 이 문자 집합에는 `/`·`\`·`.` 연속이 없어
   * `..`·절대경로·중첩 디렉토리를 **표현할 수 없다**. `/files/:id/:name` 이 DB 조회로만
   * storage_key 를 해석해 사용자 입력을 경로에서 배제한 것과 같은 원칙이다.
   *
   * rate limit: `filesLimiter`(IP 당 분당 120회)를 재사용한다. 근거 — 썸네일은 첨부와 같은
   * "불변 정적 자산" 부류이고 정책을 나눌 이유가 없다. 한 페이지의 썸네일은 최대 5장이며
   * `immutable` 1년 캐시라 재방문 시 요청이 발생하지 않으므로 120회/분은 충분히 여유롭다.
   * 별도 버킷을 두면 정책이 둘로 갈려 운영 시 어느 쪽이 막혔는지 판별이 어려워진다.
   */
  app.get("/thumbnails/:key", async (request, reply) => {
    const decision = filesLimiter.consume(request.ip);
    if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

    const { key } = request.params as { key: string };
    if (!THUMBNAIL_KEY_PATTERN.test(key)) {
      // 400 — 형식 자체가 틀렸다 (계약 §5). "없음"(404)과 구분한다
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "썸네일 key 형식이 올바르지 않습니다."));
    }

    const filePath = thumbnailFilePath(uploadDir, key);
    // 검증된 key 로는 발생할 수 없는 상황이지만, 경로가 썸네일 디렉토리를 벗어나지 않는지
    // 한 번 더 확인한다 (다중 방어 — 위 정규식이 완화되는 미래 변경에 대한 안전망)
    const thumbnailRoot = path.resolve(uploadDir, THUMBNAIL_SUBDIR);
    if (path.dirname(path.resolve(filePath)) !== thumbnailRoot) {
      request.log.error({ route: "thumbnail-serve" }, "thumbnail path escaped root");
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "썸네일 key 형식이 올바르지 않습니다."));
    }

    let sizeBytes: number;
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) throw new Error("not a file");
      sizeBytes = stat.size;
    } catch {
      return reply.status(404).send(errorBody("NOT_FOUND", "썸네일을 찾을 수 없습니다."));
    }

    return reply
      .status(200)
      .header("Content-Type", "image/jpeg")
      .header("Content-Length", String(sizeBytes))
      // 키가 videoId+변형에 고정 = 내용 불변이므로 immutable 이 안전하다 (첨부와 동일 근거)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(fs.createReadStream(filePath));
  });
}
