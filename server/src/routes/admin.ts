/**
 * Admin 라우트 (명세 06 §12–13) — 로그인/세션, 게시물 CRUD, 링크 프리뷰(SSRF 방어), 업로드.
 * 인증: 세션 쿠키 또는 정적 Bearer (병행 — §12.2, 정적 토큰은 복구용).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import argon2 from "argon2";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import { SESSION_COOKIE, authenticateAdmin } from "../lib/adminGuard.js";
import { errorBody } from "../lib/errors.js";
import { resolveAllowedType, sanitizeFilename } from "../lib/fileTypes.js";
import { LinkFetchError, fetchLinkPreview } from "../lib/linkPreview.js";
import { validatePostInput } from "../lib/postValidate.js";
import type { SlidingWindowLimiter } from "../lib/rateLimit.js";
import type { AttachmentsRepository } from "../repos/attachments.js";
import type { PostsRepository } from "../repos/posts.js";
import type { SessionsRepository } from "../repos/sessions.js";
import { parseListQuery, postDetailSchema } from "./posts.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB (§15-5)
const MAX_FILES_PER_POST = 5;

const adminPostSchema = {
  ...(postDetailSchema as { type: string; properties: Record<string, unknown>; required: string[] }),
  properties: {
    ...(postDetailSchema as { properties: Record<string, unknown> }).properties,
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    deletedAt: { type: ["string", "null"] },
  },
  required: [
    ...(postDetailSchema as { required: string[] }).required,
    "createdAt",
    "updatedAt",
    "deletedAt",
  ],
};

export interface AdminRouteDeps {
  config: AppConfig;
  posts: PostsRepository;
  attachments: AttachmentsRepository;
  sessions: SessionsRepository;
  adminLimiter: SlidingWindowLimiter;
  loginLimiter: SlidingWindowLimiter;
  errorSchema: object;
  tooManyRequests: (reply: FastifyReply, retryAfterSeconds: number) => FastifyReply;
}

export function registerAdminRoutes(app: FastifyInstance, deps: AdminRouteDeps): void {
  const { config, posts, attachments, sessions, adminLimiter, loginLimiter, errorSchema, tooManyRequests } = deps;

  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax" as const,
    path: "/admin",
  };

  /**
   * 공통 인증 preHandler — 로그인 라우트 제외 전 /admin/* 에 적용.
   * rate limit 은 "실패한 인증 시도"만 카운트한다 (분당 10회) — 토큰 무차별 대입 방어가
   * 목적이므로 인증된 정상 관리 작업은 제한하지 않는다 (명세 §4.3 정교화, 06 문서 기록).
   */
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const decision = adminLimiter.check(request.ip);
    if (!decision.allowed) {
      await tooManyRequests(reply, decision.retryAfterSeconds);
      return;
    }
    const method = await authenticateAdmin(request, { adminApiToken: config.adminApiToken, sessions });
    if (method === null) {
      adminLimiter.record(request.ip); // 실패 시도만 기록
      request.log.warn({ route: request.url, result: "unauthorized" }, "admin auth failed");
      await reply.status(401).send(errorBody("UNAUTHORIZED", "관리자 인증에 실패했습니다."));
    }
  }

  /* ---------- 인증 (§12) ---------- */

  app.post("/admin/login", async (request, reply) => {
    // 실패 포함 전 시도 카운트 (대입 방어) — 1분 5회 / 1시간 10회
    const decision = loginLimiter.consume(request.ip);
    if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

    const body = request.body as Record<string, unknown> | null;
    const password = body?.["password"];
    if (typeof password !== "string" || password.length === 0 || password.length > 200) {
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "password 는 필수 문자열입니다."));
    }

    let valid = false;
    try {
      valid = await argon2.verify(config.adminPasswordHash, password);
    } catch {
      valid = false;
    }
    if (!valid) {
      request.log.warn({ route: "admin-login", result: "failed" }, "admin login failed");
      return reply.status(401).send(errorBody("UNAUTHORIZED", "인증에 실패했습니다."));
    }

    await sessions.pruneExpired();
    const { token, expiresAt } = await sessions.create();
    request.log.info({ route: "admin-login", result: "ok" }, "admin login");
    return reply
      .setCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000) })
      .status(200)
      .send({ ok: true, expiresAt: expiresAt.toISOString() });
  });

  app.post("/admin/logout", async (request, reply) => {
    const decision = adminLimiter.check(request.ip);
    if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);
    const token = request.cookies[SESSION_COOKIE];
    if (typeof token === "string" && token.length > 0) {
      await sessions.destroy(token);
    }
    return reply.clearCookie(SESSION_COOKIE, cookieOptions).status(200).send({ ok: true });
  });

  app.get("/admin/me", { preHandler: requireAdmin }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (typeof token === "string" && token.length > 0) {
      const session = await sessions.validate(token);
      if (session !== null) {
        return reply.status(200).send({ ok: true, method: "session", expiresAt: session.expiresAt.toISOString() });
      }
    }
    return reply.status(200).send({ ok: true, method: "bearer", expiresAt: null });
  });

  /* ---------- 게시물 CRUD (§13.1) ---------- */

  app.get("/admin/posts", { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const rawCategory = query["category"];
    let category: "notice" | "news" | null = null;
    if (rawCategory !== undefined) {
      if (rawCategory !== "notice" && rawCategory !== "news") {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", "category 는 notice 또는 news 여야 합니다."));
      }
      category = rawCategory;
    }
    const paging = parseListQuery(query);
    if (!paging.ok) return reply.status(400).send(errorBody("VALIDATION_ERROR", paging.message));
    const { posts: rows, total } = await posts.listAdmin(category, paging.limit, paging.offset);
    return reply.status(200).header("X-Total-Count", String(total)).send(rows);
  });

  app.post(
    "/admin/posts",
    {
      preHandler: requireAdmin,
      schema: { response: { 201: adminPostSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request, reply) => {
      const validation = validatePostInput(request.body);
      if (!validation.ok) return reply.status(400).send(errorBody("VALIDATION_ERROR", validation.message));
      const created = await posts.create(validation.value);
      request.log.info({ route: "admin-post-create", postId: created.id }, "post created");
      return reply.status(201).send(created);
    },
  );

  app.patch(
    "/admin/posts/:id",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: adminPostSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!UUID_PATTERN.test(id)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
      }
      const existing = await posts.getRaw(id);
      if (existing === null || existing.deleted_at !== null) {
        return reply.status(404).send(errorBody("NOT_FOUND", "해당 게시물이 없습니다."));
      }
      const patch = request.body as Record<string, unknown> | null;
      if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", "요청 본문이 올바른 JSON 객체가 아닙니다."));
      }
      // 부분 수정: 기존 값 위에 병합 후 전체 재검증 (제약 조합 보장)
      const merged: Record<string, unknown> = {
        category: existing.category,
        type: existing.type,
        title: existing.title,
        body: existing.body,
        url: existing.url,
        source: existing.source,
        urgent: existing.urgent,
        deadline: existing.deadline,
      };
      for (const key of ["category", "type", "title", "body", "url", "source", "urgent", "deadline"]) {
        if (key in patch) merged[key] = patch[key];
      }
      if ("publishedAt" in patch || "published_at" in patch) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "게시 시각(publishedAt)은 서버가 자동 기록하며 수정할 수 없습니다."));
      }
      const validation = validatePostInput(merged);
      if (!validation.ok) return reply.status(400).send(errorBody("VALIDATION_ERROR", validation.message));
      const updated = await posts.update(id, validation.value);
      if (updated === null) return reply.status(404).send(errorBody("NOT_FOUND", "해당 게시물이 없습니다."));
      request.log.info({ route: "admin-post-update", postId: id }, "post updated");
      return reply.status(200).send(updated);
    },
  );

  app.delete("/admin/posts/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
    }
    const deleted = await posts.softDelete(id);
    request.log.info({ route: "admin-post-delete", postId: id, deleted }, "post delete");
    if (!deleted) return reply.status(404).send(errorBody("NOT_FOUND", "해당 게시물이 없거나 이미 삭제되었습니다."));
    return reply.status(200).send({ deleted: true, id });
  });

  /* ---------- 링크 메타데이터 (§13.2, SSRF 방어) ---------- */

  app.post("/admin/posts/preview-link", { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const url = body?.["url"];
    if (typeof url !== "string" || url.trim().length === 0 || url.length > 2000) {
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "url 은 필수 문자열입니다 (2000자 이하)."));
    }
    try {
      const preview = await fetchLinkPreview(url.trim());
      return reply.status(200).send(preview);
    } catch (error) {
      const message = error instanceof LinkFetchError ? error.message : "링크 정보를 가져오지 못했습니다.";
      // 실패는 게시를 막지 않는다 — admin 이 제목 수동 입력 (명세 §13.2)
      return reply.status(422).send(errorBody("LINK_FETCH_FAILED", message));
    }
  });

  /* ---------- 파일 업로드 (§13.3) ---------- */

  app.post("/admin/posts/:id/attachments", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
    }
    const post = await posts.getRaw(id);
    if (post === null || post.deleted_at !== null) {
      return reply.status(404).send(errorBody("NOT_FOUND", "해당 게시물이 없습니다."));
    }
    if ((await attachments.countActive(id)) >= MAX_FILES_PER_POST) {
      return reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", `첨부는 게시물당 ${MAX_FILES_PER_POST}개까지입니다.`));
    }

    const file = await request.file({ limits: { fileSize: MAX_FILE_BYTES, files: 1 } });
    if (file === undefined) {
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "file 필드(multipart)가 필요합니다."));
    }
    const buffer = await file.toBuffer().catch(() => null);
    if (buffer === null || file.file.truncated) {
      return reply
        .status(413)
        .send(errorBody("PAYLOAD_TOO_LARGE", `파일은 ${MAX_FILE_BYTES / 1024 / 1024}MB 이하여야 합니다.`));
    }

    const displayName = sanitizeFilename(file.filename ?? "file");
    const allowed = resolveAllowedType(displayName, file.mimetype, buffer);
    if (allowed === null) {
      return reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", "pdf/png/jpg/webp 만 업로드할 수 있습니다 (내용 검사 포함)."));
    }

    const storageKey = `${randomUUID()}${allowed.ext}`; // 파일시스템 경로는 서버 생성 값만 사용
    await fs.mkdir(config.uploadDir, { recursive: true });
    await fs.writeFile(path.join(config.uploadDir, storageKey), buffer, { mode: 0o600 });

    const record = await attachments.insert(id, displayName, storageKey, allowed.mime, buffer.length);
    request.log.info(
      { route: "admin-attachment-create", postId: id, attachmentId: record.id, sizeBytes: buffer.length },
      "attachment uploaded",
    );
    return reply.status(201).send({
      id: record.id,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      url: `/files/${record.id}/${encodeURIComponent(record.filename)}`,
    });
  });

  app.delete("/admin/attachments/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) {
      return reply.status(400).send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
    }
    const deleted = await attachments.softDelete(id);
    request.log.info({ route: "admin-attachment-delete", attachmentId: id, deleted }, "attachment delete");
    if (!deleted) return reply.status(404).send(errorBody("NOT_FOUND", "해당 첨부가 없거나 이미 삭제되었습니다."));
    return reply.status(200).send({ deleted: true, id });
  });
}
