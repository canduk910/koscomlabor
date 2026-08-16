/**
 * 공개 게시물 라우트 (명세 06 §11) — 인증 없음.
 * GET /posts, GET /posts/:id, GET /files/:attachmentId/:filename
 */
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { errorBody } from "../lib/errors.js";
import { dispositionFor } from "../lib/fileTypes.js";
import type { SlidingWindowLimiter } from "../lib/rateLimit.js";
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
};
const summaryRequired = ["id", "category", "type", "title", "url", "source", "urgent", "deadline", "publishedAt", "attachments"];

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
      if (category !== "notice" && category !== "news") {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "category 는 notice 또는 news 여야 합니다 (필수)."));
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
}
