/**
 * Admin 인증 가드 — 병행 운영 (리더 승인 §15-4):
 *  ① 정적 Bearer 토큰 (복구·운영 curl 용도 — UI 장애 시에도 관리 가능)
 *  ② 세션 쿠키 (admin UI 용도)
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionsRepository } from "../repos/sessions.js";
import { errorBody } from "./errors.js";
import type { SlidingWindowLimiter } from "./rateLimit.js";

export const SESSION_COOKIE = "admin_session";

export function constantTimeEquals(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(actual, "utf-8");
  if (expectedBuf.length !== actualBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf); // 길이 차이의 시간 신호 완화
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}

export interface AdminGuardDeps {
  adminApiToken: string;
  sessions: SessionsRepository;
}

/** 인증 성공 시 인증 수단을 반환, 실패 시 null */
export async function authenticateAdmin(
  request: FastifyRequest,
  deps: AdminGuardDeps,
): Promise<"bearer" | "session" | null> {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (constantTimeEquals(deps.adminApiToken, token)) return "bearer";
  }
  const cookieToken = request.cookies[SESSION_COOKIE];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    if ((await deps.sessions.validate(cookieToken)) !== null) return "session";
  }
  return null;
}

export interface RequireAdminDeps extends AdminGuardDeps {
  adminLimiter: SlidingWindowLimiter;
  tooManyRequests: (reply: FastifyReply, retryAfterSeconds: number) => FastifyReply;
}

/**
 * 공통 인증 preHandler 생성 — 로그인 라우트를 제외한 전 `/admin/*` 에 적용한다.
 *
 * rate limit 은 **"실패한 인증 시도"만** 카운트한다 (분당 10회) — 토큰 무차별 대입 방어가
 * 목적이므로 인증된 정상 관리 작업은 제한하지 않는다 (명세 §4.3 정교화, 06 문서 기록).
 *
 * ⛔ **이 함수를 복사해 라우트 파일마다 두지 마라.** 관리자 라우트가 여럿(`admin.ts`·
 *   `pledges.ts`)이 되면서 팩토리로 뽑았다 — 정책이 두 벌이면 «실패만 카운트» 같은 규칙이
 *   한쪽에서만 고쳐지고, 그 차이는 로그를 봐야 드러난다.
 */
export function createRequireAdmin(
  deps: RequireAdminDeps,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function requireAdmin(request, reply): Promise<void> {
    const decision = deps.adminLimiter.check(request.ip);
    if (!decision.allowed) {
      await deps.tooManyRequests(reply, decision.retryAfterSeconds);
      return;
    }
    const method = await authenticateAdmin(request, deps);
    if (method === null) {
      deps.adminLimiter.record(request.ip); // 실패 시도만 기록
      request.log.warn({ route: request.url, result: "unauthorized" }, "admin auth failed");
      await reply.status(401).send(errorBody("UNAUTHORIZED", "관리자 인증에 실패했습니다."));
    }
  };
}
