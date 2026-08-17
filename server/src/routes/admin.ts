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
import {
  POST_CATEGORY_ERROR,
  type PostCategory,
  type PostInput,
  isPostCategory,
  validatePostInput,
} from "../lib/postValidate.js";
import type { SlidingWindowLimiter } from "../lib/rateLimit.js";
import { acquireThumbnail, extractYouTubeVideoId } from "../lib/youtubeThumbnail.js";
import type { AttachmentsRepository } from "../repos/attachments.js";
import type { AdminCredentials, AdminCredentialsRepository } from "../repos/credentials.js";
import type { PostsRepository } from "../repos/posts.js";
import type { SessionsRepository } from "../repos/sessions.js";
import { parseListQuery, postDetailSchema } from "./posts.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB (§15-5)
const MAX_FILES_PER_POST = 5;
/** 비밀번호 길이 규칙 (§12.4) — 하한은 scripts/hash-password.mjs 와 동일 기준 */
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 200;

/** GET /admin/me 응답 스키마 — 명세 외 필드 직렬화 차단 (§12.1) */
const adminMeSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    method: { type: "string" },
    expiresAt: { type: ["string", "null"] },
    passwordIsInitial: { type: "boolean" },
  },
  required: ["ok", "method", "expiresAt", "passwordIsInitial"],
  additionalProperties: false,
};

/** POST /admin/password 성공 응답 스키마 (§12.4) */
const passwordChangeSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    changedAt: { type: "string" },
    sessionsRevoked: { type: "integer" },
  },
  required: ["ok", "changedAt", "sessionsRevoked"],
  additionalProperties: false,
};

const adminPostSchema = {
  ...(postDetailSchema as { type: string; properties: Record<string, unknown>; required: string[] }),
  properties: {
    ...(postDetailSchema as { properties: Record<string, unknown> }).properties,
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    deletedAt: { type: ["string", "null"] },
    /**
     * 계약 §6 — **admin 응답 전용**. 공개 응답(postSummary/postDetail)에는 없다.
     * `additionalProperties: false` 이므로 이 줄이 없으면 직렬화 단계에서 조용히 사라진다.
     * (`thumbnailUrl` 은 postDetailSchema 에서 상속된다)
     */
    sortOrder: { type: ["integer", "null"] },
  },
  required: [
    ...(postDetailSchema as { required: string[] }).required,
    "createdAt",
    "updatedAt",
    "deletedAt",
    "sortOrder",
  ],
};

/** POST /admin/posts/reorder 성공 응답 스키마 (계약 §3) */
const reorderSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    category: { type: "string" },
    updated: { type: "integer" },
  },
  required: ["ok", "category", "updated"],
  additionalProperties: false,
};

const REORDER_IDS_ERROR = "ids 는 UUID 배열이어야 합니다.";
const REORDER_DUPLICATE_ERROR = "ids 에 중복된 항목이 있습니다.";
const REORDER_CONFLICT_MESSAGE = "목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.";

export interface AdminRouteDeps {
  config: AppConfig;
  posts: PostsRepository;
  attachments: AttachmentsRepository;
  sessions: SessionsRepository;
  credentials: AdminCredentialsRepository;
  adminLimiter: SlidingWindowLimiter;
  loginLimiter: SlidingWindowLimiter;
  errorSchema: object;
  tooManyRequests: (reply: FastifyReply, retryAfterSeconds: number) => FastifyReply;
}

export function registerAdminRoutes(app: FastifyInstance, deps: AdminRouteDeps): void {
  const {
    config,
    posts,
    attachments,
    sessions,
    credentials,
    adminLimiter,
    loginLimiter,
    errorSchema,
    tooManyRequests,
  } = deps;

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

  /**
   * 활성 비밀번호 해시 조회. **DB 행이 권위 값**이고, 행이 없는 예외 상황(마이그레이션 직후
   * 시드 전 등)에서만 env 시드 해시로 폴백한다 — 행 부재로 관리자가 잠기지 않게 하는 방어선.
   * 폴백 사실은 경고 로그로 남기되 해시 값은 절대 로깅하지 않는다.
   */
  async function resolveCredentials(request: FastifyRequest): Promise<AdminCredentials> {
    const active = await credentials.getActive();
    if (active !== null) return active;
    request.log.warn(
      { route: "admin-credentials", result: "row-missing-fallback-to-env" },
      "admin_credentials row missing; using env seed hash",
    );
    return { passwordHash: config.adminPasswordHash, updatedAt: null };
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

    // 활성 해시는 DB 에서 매 요청 조회한다 (런타임 변경 즉시 반영 — §12.3)
    const active = await resolveCredentials(request);
    let valid = false;
    try {
      valid = await argon2.verify(active.passwordHash, password);
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

  app.get(
    "/admin/me",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: adminMeSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request, reply) => {
      // passwordIsInitial: 시드 비밀번호를 아직 한 번도 바꾸지 않았는가 (admin UI 경고 배너용)
      const active = await resolveCredentials(request);
      const passwordIsInitial = active.updatedAt === null;

      const token = request.cookies[SESSION_COOKIE];
      if (typeof token === "string" && token.length > 0) {
        const session = await sessions.validate(token);
        if (session !== null) {
          return reply.status(200).send({
            ok: true,
            method: "session",
            expiresAt: session.expiresAt.toISOString(),
            passwordIsInitial,
          });
        }
      }
      return reply
        .status(200)
        .send({ ok: true, method: "bearer", expiresAt: null, passwordIsInitial });
    },
  );

  /**
   * POST /admin/password — 비밀번호 변경 (§12.4).
   * 인증(requireAdmin)만으로는 부족하고 **현재 비밀번호를 본문으로 재확인**한다
   * (자리를 비운 브라우저·탈취된 세션으로 비밀번호가 바뀌는 것을 막는다).
   * 검증 순서는 명세 §12.4 표 그대로 — QA 가 이 순서로 교차 검증한다.
   */
  app.post(
    "/admin/password",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: passwordChangeSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request, reply) => {
      // #0 rate limit — 로그인과 동일 버킷(분당 5회/시간당 10회)을 공유한다.
      //    여기서는 검사만 하고, 기록은 #4(현재 비밀번호 불일치)에서만 한다.
      const decision = loginLimiter.check(request.ip);
      if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

      const body = request.body as Record<string, unknown> | null;
      const currentPassword = body?.["currentPassword"];
      const newPassword = body?.["newPassword"];

      // #1 형식·길이 상한
      const isValidString = (value: unknown): value is string =>
        typeof value === "string" && value.length > 0 && value.length <= PASSWORD_MAX_LENGTH;
      if (!isValidString(currentPassword) || !isValidString(newPassword)) {
        return reply
          .status(400)
          .send(
            errorBody(
              "VALIDATION_ERROR",
              `currentPassword 와 newPassword 는 1자 이상 ${PASSWORD_MAX_LENGTH}자 이하의 문자열이어야 합니다.`,
            ),
          );
      }

      // #2 길이 하한
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`));
      }

      // #3 현재 비밀번호와 동일
      if (newPassword === currentPassword) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "새 비밀번호가 현재 비밀번호와 같습니다."));
      }

      // #4 현재 비밀번호 재확인
      const active = await resolveCredentials(request);
      let currentValid = false;
      try {
        currentValid = await argon2.verify(active.passwordHash, currentPassword);
      } catch {
        currentValid = false;
      }
      if (!currentValid) {
        loginLimiter.record(request.ip); // 실패만 대입 카운트에 반영
        request.log.warn(
          { route: "admin-password-change", result: "current-password-mismatch" },
          "admin password change rejected",
        );
        // UNAUTHORIZED 가 아니라 INVALID_CREDENTIALS — requireAdmin 의 401(인증 수단 무효)과
        // 구분해야 프론트가 "로그인 화면 전환" vs "필드 인라인 에러"를 분기할 수 있다 (계약 개정 1)
        return reply
          .status(401)
          .send(errorBody("INVALID_CREDENTIALS", "현재 비밀번호가 일치하지 않습니다."));
      }

      const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      const changedAt = await credentials.update(newHash);

      // 만료 세션을 먼저 정리해 sessionsRevoked 가 "실제로 살아 있던 다른 세션 수"가 되게 한다
      await sessions.pruneExpired();
      const sessionToken = request.cookies[SESSION_COOKIE];
      let method: "session" | "bearer";
      let sessionsRevoked: number;
      if (
        typeof sessionToken === "string" &&
        sessionToken.length > 0 &&
        (await sessions.validate(sessionToken)) !== null
      ) {
        // 현재 브라우저 세션은 유지하고 나머지 기기만 로그아웃
        method = "session";
        sessionsRevoked = await sessions.destroyOthers(sessionToken);
      } else {
        // Bearer(복구 경로) 호출 — 유지할 현재 세션이 없으므로 전 세션 무효화
        method = "bearer";
        sessionsRevoked = await sessions.destroyAll();
      }

      // 평문·해시는 로그에 남기지 않는다
      request.log.info(
        { route: "admin-password-change", method, sessionsRevoked },
        "admin password changed",
      );
      return reply
        .status(200)
        .send({ ok: true, changedAt: changedAt.toISOString(), sessionsRevoked });
    },
  );

  /**
   * 썸네일 키 결정 (계약 §4). 생성·수정 **양쪽에서 동기 호출**한다.
   *
   * 규칙:
   * - 링크형이 아니거나 url 이 없으면 `null` (링크형→작성형 전환 시 썸네일 해제)
   * - YouTube 영상 URL 이 아니면 `null` (로그 없음 — 대부분의 링크가 여기 해당하는 정상 경로)
   * - URL 이 그대로이고 이미 키가 있으면 **재취득하지 않고 그 키를 유지**
   * - 그 외(신규 / URL 변경 / 이전 시도 실패로 키가 NULL)는 취득 시도
   *
   * **실패는 게시를 막지 않는다** (06 §13.2 링크 프리뷰와 동일 원칙) — `null` 을 반환하고
   * warn 로그만 남긴다. 비동기 백그라운드 처리는 하지 않는다 (계약 §4: 일관성·에러 추적 우선).
   * 타임아웃이 짧게(연결 3초/전체 6초) 잡혀 있어 최악의 경우에도 응답 지연이 한정된다.
   */
  async function resolveThumbnailKey(
    request: FastifyRequest,
    route: string,
    input: PostInput,
    existing: { url: string | null; thumbnailKey: string | null } | null,
  ): Promise<string | null> {
    if (input.type !== "link" || input.url === null) return null;
    if (extractYouTubeVideoId(input.url) === null) return null;
    if (existing !== null && existing.thumbnailKey !== null && existing.url === input.url) {
      return existing.thumbnailKey;
    }
    const result = await acquireThumbnail(input.url, config.uploadDir);
    if (result.key === null) {
      // 실패 사유만 남긴다 (URL 원문은 싣지 않는다 — 로그 최소주의)
      request.log.warn({ route, reason: result.reason }, "thumbnail acquisition failed");
      return null;
    }
    return result.key;
  }

  /* ---------- 게시물 CRUD (§13.1) ---------- */

  app.get("/admin/posts", { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const rawCategory = query["category"];
    let category: PostCategory | null = null; // 미지정 = 전 분류
    if (rawCategory !== undefined) {
      if (!isPostCategory(rawCategory)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", POST_CATEGORY_ERROR));
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
      const thumbnailKey = await resolveThumbnailKey(request, "admin-post-create", validation.value, null);
      const created = await posts.create(validation.value, thumbnailKey);
      request.log.info(
        { route: "admin-post-create", postId: created.id, thumbnail: thumbnailKey !== null },
        "post created",
      );
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
      // URL 이 바뀌면 재취득, 그대로면 기존 키 유지 (계약 §4). sort_order 는 update() 가 건드리지 않는다
      const thumbnailKey = await resolveThumbnailKey(request, "admin-post-update", validation.value, {
        url: existing.url,
        thumbnailKey: existing.thumbnail_key,
      });
      const updated = await posts.update(id, validation.value, thumbnailKey);
      if (updated === null) return reply.status(404).send(errorBody("NOT_FOUND", "해당 게시물이 없습니다."));
      request.log.info(
        { route: "admin-post-update", postId: id, thumbnail: thumbnailKey !== null },
        "post updated",
      );
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

  /* ---------- 수동 정렬 (계약 §3, 명세 06 §20.3) ---------- */

  /**
   * POST /admin/posts/reorder — `ids` 순서대로 `sort_order` 를 1..n 으로 지정한다.
   *
   * 검증 순서는 계약 §3 표 그대로다 (#1 category → #2 ids 형식 → #3 중복 → #4 순열).
   * QA 가 이 순서로 교차 검증하므로 순서를 바꾸지 말 것.
   *
   * **#4(409 CONFLICT)가 핵심 안전장치다.** 낙관적 동시성 제어 — 저장소의 트랜잭션 안에서
   * 활성 게시물 집합과 완전 일치를 확인한다. 상세 근거는 `repos/posts.ts` 의 reorder().
   */
  app.post(
    "/admin/posts/reorder",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: reorderSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;

      // #1 category
      const category = body?.["category"];
      if (!isPostCategory(category)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", POST_CATEGORY_ERROR));
      }

      // #2 ids 형식 — 배열이고 모든 원소가 UUID
      const rawIds = body?.["ids"];
      if (!Array.isArray(rawIds)) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", REORDER_IDS_ERROR));
      }
      const ids: string[] = [];
      for (const item of rawIds) {
        if (typeof item !== "string" || !UUID_PATTERN.test(item)) {
          return reply.status(400).send(errorBody("VALIDATION_ERROR", REORDER_IDS_ERROR));
        }
        // PostgreSQL 의 uuid 출력은 항상 소문자다. 대문자로 온 같은 uuid 를 #3·#4 에서 다른
        // 값으로 오판하지 않도록 정규화한다 (DB 비교는 uuid 타입이라 대소문자 무관)
        ids.push(item.toLowerCase());
      }

      // #3 중복
      if (new Set(ids).size !== ids.length) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", REORDER_DUPLICATE_ERROR));
      }

      // #4 순열 검증 + 원자적 갱신 (하나의 트랜잭션)
      const result = await posts.reorder(category, ids);
      if (!result.ok) {
        request.log.warn(
          { route: "admin-posts-reorder", category, requested: ids.length, result: "conflict" },
          "reorder rejected",
        );
        return reply.status(409).send(errorBody("CONFLICT", REORDER_CONFLICT_MESSAGE));
      }

      request.log.info(
        { route: "admin-posts-reorder", category, updated: result.updated },
        "posts reordered",
      );
      return reply.status(200).send({ ok: true, category, updated: result.updated });
    },
  );

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
