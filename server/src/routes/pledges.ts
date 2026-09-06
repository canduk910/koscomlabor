/**
 * 공약 라우트 — 공개 조회 1개 + 관리자 CRUD 4개.
 *
 * 공개와 관리자를 **한 파일에** 둔다: 응답 스키마 두 벌(공개/관리자)이 서로의 차이로만
 * 존재하고, 한쪽만 고치면 "서버는 넣었는데 화면에 안 오는" 고장이 되기 때문이다
 * (posts.ts ↔ admin.ts 가 실제로 그 형태로 갈라져 있다 — 그 분리를 따라하지 않는다).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import { createRequireAdmin } from "../lib/adminGuard.js";
import { errorBody } from "../lib/errors.js";
import { validatePledgeInput } from "../lib/pledgeValidate.js";
import type { SlidingWindowLimiter } from "../lib/rateLimit.js";
import type { PledgesRepository } from "../repos/pledges.js";
import type { SessionsRepository } from "../repos/sessions.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 공개 응답 필드. `additionalProperties: false` 이므로 **여기 없는 필드는 직렬화 단계에서
 * 조용히 사라진다** — 응답에 필드를 더할 때 이 스키마 갱신을 빼먹으면 원인을 찾기 어렵다.
 *
 * `sortOrder` 는 **일부러 뺐다**. 정렬은 서버 책임이고, 내보내면 프론트가 재정렬하려는
 * 유혹이 생긴다 (posts 의 sortOrder 와 같은 판단).
 */
const publicPledgeProperties = {
  id: { type: "string" },
  category: { type: "string" },
  title: { type: "string" },
  detail: { type: ["string", "null"] },
  status: { type: "string" },
  note: { type: ["string", "null"] },
  highlight: { type: "boolean" },
};
const publicRequired = ["id", "category", "title", "detail", "status", "note", "highlight"];

const publicPledgeSchema = {
  type: "object",
  properties: publicPledgeProperties,
  required: publicRequired,
  additionalProperties: false,
};

const adminPledgeSchema = {
  type: "object",
  properties: {
    ...publicPledgeProperties,
    sortOrder: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    deletedAt: { type: ["string", "null"] },
  },
  required: [...publicRequired, "sortOrder", "createdAt", "updatedAt", "deletedAt"],
  additionalProperties: false,
};

export interface PledgeRouteDeps {
  config: AppConfig;
  pledges: PledgesRepository;
  sessions: SessionsRepository;
  getLimiter: SlidingWindowLimiter;
  adminLimiter: SlidingWindowLimiter;
  errorSchema: object;
  tooManyRequests: (reply: FastifyReply, retryAfterSeconds: number) => FastifyReply;
}

export function registerPledgeRoutes(app: FastifyInstance, deps: PledgeRouteDeps): void {
  const { config, pledges, sessions, getLimiter, adminLimiter, errorSchema, tooManyRequests } = deps;

  const requireAdmin = createRequireAdmin({
    adminApiToken: config.adminApiToken,
    sessions,
    adminLimiter,
    tooManyRequests,
  });

  function badId(reply: FastifyReply): FastifyReply {
    return reply.status(400).send(errorBody("VALIDATION_ERROR", "id 는 UUID 형식이어야 합니다."));
  }

  /* ---------- 공개 ---------- */

  /**
   * GET /pledges — 활성 공약 «전건». 쿼리 파라미터가 없다.
   * ⛔ **페이징을 붙이지 마라.** 화면이 진행률(달성 n / 전체 n)을 내는데, 일부만 오면
   *    그 숫자가 **틀린 채로 조용히 표시된다**. 43건 규모이고 드물게 는다.
   */
  app.get(
    "/pledges",
    {
      schema: {
        response: {
          200: { type: "array", items: publicPledgeSchema },
          "4xx": errorSchema,
          "5xx": errorSchema,
        },
      },
    },
    async (request, reply) => {
      const decision = getLimiter.consume(request.ip);
      if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

      const rows = await pledges.listPublic();
      return reply.status(200).header("X-Total-Count", String(rows.length)).send(rows);
    },
  );

  /* ---------- 관리자 ---------- */

  app.get(
    "/admin/pledges",
    {
      preHandler: requireAdmin,
      schema: {
        response: {
          200: { type: "array", items: adminPledgeSchema },
          "4xx": errorSchema,
          "5xx": errorSchema,
        },
      },
    },
    async (_request, reply) => {
      const rows = await pledges.listAdmin();
      return reply.status(200).header("X-Total-Count", String(rows.length)).send(rows);
    },
  );

  app.post(
    "/admin/pledges",
    {
      preHandler: requireAdmin,
      schema: { response: { 201: adminPledgeSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request: FastifyRequest, reply) => {
      const validation = validatePledgeInput(request.body);
      if (!validation.ok) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", validation.message));
      }
      const created = await pledges.create(validation.value);
      request.log.info({ route: "admin-pledge-create", pledgeId: created.id }, "pledge created");
      return reply.status(201).send(created);
    },
  );

  app.patch(
    "/admin/pledges/:id",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: adminPledgeSchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request: FastifyRequest, reply) => {
      const { id } = request.params as { id: string };
      if (!UUID_PATTERN.test(id)) return badId(reply);

      const existing = await pledges.getRaw(id);
      if (existing === null || existing.deleted_at !== null) {
        return reply.status(404).send(errorBody("NOT_FOUND", "해당 공약이 없습니다."));
      }
      const patch = request.body as Record<string, unknown> | null;
      if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "요청 본문이 올바른 JSON 객체가 아닙니다."));
      }

      // 부분 수정: 기존 값 위에 병합한 뒤 **전체 재검증** (posts 와 동일 규약).
      // ★ 이 화면의 주된 조작은 «상태 한 칸 바꾸기»라 body 가 `{status}` 하나뿐인 경우가
      //   대부분이다 — 병합 없이 검증하면 그때마다 title 필수 오류가 난다.
      const merged: Record<string, unknown> = {
        category: existing.category,
        title: existing.title,
        detail: existing.detail,
        status: existing.status,
        note: existing.note,
        highlight: existing.highlight,
      };
      for (const key of ["category", "title", "detail", "status", "note", "highlight"]) {
        if (key in patch) merged[key] = patch[key];
      }
      const validation = validatePledgeInput(merged);
      if (!validation.ok) {
        return reply.status(400).send(errorBody("VALIDATION_ERROR", validation.message));
      }

      const updated = await pledges.update(id, validation.value);
      if (updated === null) {
        return reply.status(404).send(errorBody("NOT_FOUND", "해당 공약이 없습니다."));
      }
      request.log.info({ route: "admin-pledge-update", pledgeId: id }, "pledge updated");
      return reply.status(200).send(updated);
    },
  );

  app.delete("/admin/pledges/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_PATTERN.test(id)) return badId(reply);

    const deleted = await pledges.softDelete(id);
    request.log.info({ route: "admin-pledge-delete", pledgeId: id, deleted }, "pledge delete");
    if (!deleted) {
      return reply
        .status(404)
        .send(errorBody("NOT_FOUND", "해당 공약이 없거나 이미 삭제되었습니다."));
    }
    return reply.status(200).send({ deleted: true, id });
  });
}
