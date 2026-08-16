/**
 * Admin 인증 가드 — 병행 운영 (리더 승인 §15-4):
 *  ① 정적 Bearer 토큰 (복구·운영 curl 용도 — UI 장애 시에도 관리 가능)
 *  ② 세션 쿠키 (admin UI 용도)
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { SessionsRepository } from "../repos/sessions.js";

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
