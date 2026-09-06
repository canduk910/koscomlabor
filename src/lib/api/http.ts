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
  /**
   * 낙관적 동시성 충돌 (정렬 계약 §3 #4 — CONFLICT / HTTP 409).
   * 순서 저장 시 `ids` 가 서버의 활성 게시물 집합과 일치하지 않을 때 발생한다.
   * 이 reason 이 없으면 409 가 `?? "network"` 로 떨어져 "서버에 연결하지 못했습니다"라는
   * 엉뚱한 안내가 뜬다 — CODE_TO_REASON·STATUS_TO_REASON 등록이 함께 필수다.
   */
  | "conflict"
  | "not-found"
  | "link-fetch-failed"
  | "payload-too-large";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ApiFailureReason; message: string };

export type ApiConnection =
  | { status: "unconfigured" }
  | { status: "configured"; baseUrl: string };

/**
 * **서버 렌더(SSR/ISR)에서 API 를 부를 때의 상한.** ⛔ 지우지 마라 — 없으면 조합원이 기다린다.
 *
 * `next.config.ts` 의 `expireTime: 60` 이 만료된 캐시 항목의 재생성을 **조합원 요청 위로** 올렸다.
 * 그 렌더에는 상한이 없다(`staticPageGenerationTimeout` 은 빌드 전용이다). 업스트림이 먹통이면
 * `fetch` 는 수십 초가 지나도 reject 하지 않고, 그동안 방문자는 안내 카드가 아니라 **빈 화면**을 본다.
 * → 상한을 걸면 `fetch` 가 `AbortError` 로 reject 하고 **이미 있는 `catch` 가** 그것을 받아
 *   `networkFailure(...)` 로 떨어뜨린다. **새 문구·새 분기가 필요 없다** — 기존 안내 카드에 착지한다.
 *
 * 값 근거: 프로덕션 API 왕복 실측이 수십 ms 수준이라 3초는 정상 구간을 건드리지 않는다.
 * ⚠ 타임아웃으로 만들어진 «안내 카드»도 60초 캐시된다 — 그동안 정상으로 돌아와도 화면은 안내가
 *   남는다. 그것이 낡은 값을 내보내는 것보다 낫다는 판정이다(정직한 빈 상태 > 가짜 동작).
 */
export const SSR_FETCH_TIMEOUT_MS = 3000;

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
  // 정렬 계약 §3 #4: 순서 저장의 순열 불일치(409). 미등록 시 연결 실패로 오분류된다.
  CONFLICT: "conflict",
  NOT_FOUND: "not-found",
  LINK_FETCH_FAILED: "link-fetch-failed",
  PAYLOAD_TOO_LARGE: "payload-too-large",
};

const STATUS_TO_REASON: Record<number, ApiFailureReason> = {
  400: "validation",
  401: "unauthorized",
  404: "not-found",
  // body 가 비정형(프록시 에러 페이지 등)이어도 409 는 충돌로 다룬다 — CODE_TO_REASON 과 이중 방어
  409: "conflict",
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
