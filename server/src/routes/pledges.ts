/**
 * 공약 라우트 — 공개 조회 1개 + 관리자 CRUD 4개 + 공개 여부 조회·전환 2개.
 *
 * ⚠ **`/admin/pledges/visibility` 는 `/admin/pledges/:id` 보다 «정적»이라 먼저 잡힌다**
 *   (Fastify 라우터는 정적 경로를 파라미터 경로보다 우선한다). 순서를 바꾸거나
 *   `:id` 를 와일드카드로 넓히면 전환 요청이 «id=visibility» 로 새어 400 이 된다.
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
import type { SettingsRepository } from "../repos/settings.js";
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

/**
 * 공개 목록 응답 — **배열이 아니라 봉투(envelope)다.**
 * `published: false` 면 `pledges` 는 **빈 배열**이고 데이터가 아예 나가지 않는다 —
 * 비공개인데 curl 로 이행 상태를 들여다볼 수 있으면 «비공개»가 아니다.
 * ⛔ 편의를 이유로 최상위 배열로 되돌리지 마라 — 그러면 «비공개»를 «0건»과 구별할 수 없고,
 *   화면이 404 를 내야 할 때와 「불러오지 못했습니다」를 내야 할 때를 못 가른다.
 */
const publicListSchema = {
  type: "object",
  properties: {
    published: { type: "boolean" },
    pledges: { type: "array", items: publicPledgeSchema },
  },
  required: ["published", "pledges"],
  additionalProperties: false,
};

/** 공개 여부 조회·전환 응답 (관리자 전용) */
const visibilitySchema = {
  type: "object",
  properties: {
    pledgesPublished: { type: "boolean" },
    updatedAt: { type: ["string", "null"] },
  },
  required: ["pledgesPublished", "updatedAt"],
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
  settings: SettingsRepository;
  sessions: SessionsRepository;
  getLimiter: SlidingWindowLimiter;
  adminLimiter: SlidingWindowLimiter;
  errorSchema: object;
  tooManyRequests: (reply: FastifyReply, retryAfterSeconds: number) => FastifyReply;
}

export function registerPledgeRoutes(app: FastifyInstance, deps: PledgeRouteDeps): void {
  const { config, pledges, settings, sessions, getLimiter, adminLimiter, errorSchema, tooManyRequests } =
    deps;

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
        response: { 200: publicListSchema, "4xx": errorSchema, "5xx": errorSchema },
      },
    },
    async (request, reply) => {
      const decision = getLimiter.consume(request.ip);
      if (!decision.allowed) return tooManyRequests(reply, decision.retryAfterSeconds);

      // ★ 비공개면 **조회 자체를 하지 않는다.** 「가져와서 안 보여준다」가 아니라
      //   「가져오지 않는다」다 — 응답 본문에 흔적이 남지 않는다.
      // ⛔ 200 대신 404 를 내지 마라: 화면이 «비공개»와 «서버 장애»를 구별해야 하는데
      //   404 로 합치면 통신 실패 때도 「없는 페이지」를 보여주게 된다.
      const { pledgesPublished } = await settings.get();
      if (!pledgesPublished) {
        return reply.status(200).header("X-Total-Count", "0").send({ published: false, pledges: [] });
      }

      const rows = await pledges.listPublic();
      return reply
        .status(200)
        .header("X-Total-Count", String(rows.length))
        .send({ published: true, pledges: rows });
    },
  );

  /* ---------- 관리자 ---------- */

  /**
   * 공개 여부 조회·전환. 관리자 화면의 「공개 / 비공개」 버튼이 쓴다.
   *
   * ⚠ 공개 화면 반영에는 **최대 60초**가 걸린다(프론트 라우트의 `revalidate = 60`).
   *   즉시 반영이 필요해지면 그 값을 바꿀 것이 아니라 온디맨드 재검증을 붙여라 —
   *   `revalidate` 를 0 으로 내리면 메인·상세가 매 요청마다 API 를 때린다.
   */
  app.get(
    "/admin/pledges/visibility",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: visibilitySchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (_request, reply) => {
      return reply.status(200).send(await settings.get());
    },
  );

  app.patch(
    "/admin/pledges/visibility",
    {
      preHandler: requireAdmin,
      schema: { response: { 200: visibilitySchema, "4xx": errorSchema, "5xx": errorSchema } },
    },
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "요청 본문이 올바른 JSON 객체가 아닙니다."));
      }
      const value = body["pledgesPublished"];
      if (typeof value !== "boolean") {
        return reply
          .status(400)
          .send(errorBody("VALIDATION_ERROR", "pledgesPublished 는 boolean 이어야 합니다."));
      }
      const updated = await settings.setPledgesPublished(value);
      request.log.info(
        { route: "admin-pledges-visibility", pledgesPublished: updated.pledgesPublished },
        "pledge visibility changed",
      );
      return reply.status(200).send(updated);
    },
  );

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
