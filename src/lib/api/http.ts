/**
 * posts/admin API 공용 HTTP 유틸 (06 명세 Part 2).
 * - 에러 형식 { error: { code, message } } (§2.4 코드 체계 공유)
 * - 방명록(guestbook.ts)은 기존 커밋 안정성을 위해 자체 구현을 유지한다 —
 *   통합 리팩토링은 별도 과업 (impl 문서 §15 기록)
 */

export type ApiFailureReason =
  | "unconfigured"
  | "network"
  | "invalid-response"
  | "rate-limited"
  | "validation"
  | "unauthorized"
  /** 인증 수단은 유효하나 본문의 currentPassword 불일치 (계약 개정 1 — INVALID_CREDENTIALS) */
  | "invalid-credentials"
  | "not-found"
  | "link-fetch-failed"
  | "payload-too-large";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ApiFailureReason; message: string };

export type ApiConnection =
  | { status: "unconfigured" }
  | { status: "configured"; baseUrl: string };

export const API_UNCONFIGURED_MESSAGE =
  "백엔드 API가 아직 연결되지 않았습니다 (NEXT_PUBLIC_API_BASE_URL 미설정).";

export function getApiConnection(): ApiConnection {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return { status: "unconfigured" };
  }
  return { status: "configured", baseUrl: baseUrl.replace(/\/+$/, "") };
}

/** API 상대 경로(예: 첨부 /files/...)를 절대 URL로 변환. 미설정 시 null */
export function resolveApiUrl(path: string): string | null {
  const connection = getApiConnection();
  if (connection.status === "unconfigured") return null;
  return `${connection.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unconfiguredResult(): { ok: false; reason: "unconfigured"; message: string } {
  return { ok: false, reason: "unconfigured", message: API_UNCONFIGURED_MESSAGE };
}

export function networkFailure(message: string): { ok: false; reason: "network"; message: string } {
  return { ok: false, reason: "network", message };
}

export function invalidResponse(message: string): {
  ok: false;
  reason: "invalid-response";
  message: string;
} {
  return { ok: false, reason: "invalid-response", message };
}

function parseErrorBody(value: unknown): { code: string; message: string } | null {
  if (!isRecord(value)) return null;
  const { error } = value;
  if (!isRecord(error)) return null;
  const { code, message } = error;
  if (typeof code !== "string" || typeof message !== "string") return null;
  return { code, message };
}

const CODE_TO_REASON: Record<string, ApiFailureReason> = {
  RATE_LIMITED: "rate-limited",
  VALIDATION_ERROR: "validation",
  UNAUTHORIZED: "unauthorized",
  // 계약 개정 1: 세션 만료(UNAUTHORIZED)와 현재 비밀번호 불일치를 프론트에서 구분해야 한다.
  // 미등록 code 는 아래 `?? "network"` 로 잘못 분류되므로 등록 필수.
  INVALID_CREDENTIALS: "invalid-credentials",
  NOT_FOUND: "not-found",
  LINK_FETCH_FAILED: "link-fetch-failed",
  PAYLOAD_TOO_LARGE: "payload-too-large",
};

const STATUS_TO_REASON: Record<number, ApiFailureReason> = {
  400: "validation",
  401: "unauthorized",
  404: "not-found",
  413: "payload-too-large",
  429: "rate-limited",
};

/**
 * HTTP 에러 응답 → ApiResult 에러 변환 (code 우선, body 비정형 시 상태 코드 폴백).
 * 서버의 한국어 message를 우선 사용한다.
 */
export async function readErrorResult(
  response: Response,
  fallback: string,
): Promise<{ ok: false; reason: ApiFailureReason; message: string }> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // body 없음/비JSON — 상태 코드 폴백
  }

  const parsed = parseErrorBody(payload);
  if (parsed !== null) {
    return {
      ok: false,
      reason: CODE_TO_REASON[parsed.code] ?? "network",
      message: parsed.message.length > 0 ? parsed.message : fallback,
    };
  }
  const reason = STATUS_TO_REASON[response.status];
  if (reason !== undefined) {
    return { ok: false, reason, message: fallback };
  }
  return { ok: false, reason: "network", message: `${fallback} (HTTP ${response.status})` };
}
