/**
 * 방명록 API 추상화 계층.
 *
 * 백엔드는 NCP(Naver Cloud Platform)에 구축 예정이며 아직 미구축 상태다.
 * - 환경변수 NEXT_PUBLIC_API_BASE_URL 미설정 시 모든 호출은 명확한
 *   "unconfigured" 상태를 반환한다 (가짜 동작 금지 — 요구사항).
 * - UI는 이 상태를 보고 "준비 중" 카드만 렌더한다 (disabled 폼 노출 금지).
 * - 백엔드 연결 시 아래 시그니처 그대로 fetch 구현이 활성화된다.
 */

export interface GuestbookEntry {
  id: string;
  author: string;
  body: string;
  /** ISO 8601 작성 시각 */
  createdAt: string;
}

export interface GuestbookEntryInput {
  author: string;
  body: string;
}

export type GuestbookConnection =
  | { status: "unconfigured" }
  | { status: "configured"; baseUrl: string };

/**
 * 에러 사유 (06 명세 §2.4 code 목록과의 매핑 — 승인된 계약 변경 C):
 * - "rate-limited": HTTP 429 RATE_LIMITED — "잠시 후 다시 시도" 안내
 * - "validation":   HTTP 400 VALIDATION_ERROR — 입력 검증 안내
 * - "network":      그 외 HTTP 에러(500 등)·연결 실패
 * - "invalid-response": 응답 shape이 계약과 불일치
 * - "unconfigured": NEXT_PUBLIC_API_BASE_URL 미설정
 */
export type GuestbookErrorReason =
  | "unconfigured"
  | "network"
  | "invalid-response"
  | "rate-limited"
  | "validation";

export type GuestbookResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: GuestbookErrorReason; message: string };

/** 목록 조회 옵션 (승인된 계약 변경 A — 06 명세 §5: limit 1–100 기본 50, offset ≥ 0 기본 0) */
export interface GuestbookListOptions {
  limit?: number;
  offset?: number;
}

const UNCONFIGURED_MESSAGE =
  "방명록 백엔드(NCP)가 아직 연결되지 않았습니다 (NEXT_PUBLIC_API_BASE_URL 미설정).";
const RATE_LIMITED_FALLBACK =
  "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
const VALIDATION_FALLBACK = "입력 내용을 확인해 주세요.";

/** 백엔드 연결 여부. NEXT_PUBLIC_ 접두사이므로 서버·클라이언트 양쪽에서 동일하게 판별된다. */
export function getGuestbookConnection(): GuestbookConnection {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return { status: "unconfigured" };
  }
  return { status: "configured", baseUrl: baseUrl.replace(/\/+$/, "") };
}

/* ---------- 응답 검증 (외부 데이터는 경계에서 명시적으로 검증한다) ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseGuestbookEntry(value: unknown): GuestbookEntry | null {
  if (!isRecord(value)) return null;
  const { id, author, body, createdAt } = value;
  if (
    typeof id !== "string" ||
    typeof author !== "string" ||
    typeof body !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return { id, author, body, createdAt };
}

/** 에러 응답 body `{ error: { code, message } }` 파싱 (06 명세 §2.4) */
function parseErrorBody(value: unknown): { code: string; message: string } | null {
  if (!isRecord(value)) return null;
  const { error } = value;
  if (!isRecord(error)) return null;
  const { code, message } = error;
  if (typeof code !== "string" || typeof message !== "string") return null;
  return { code, message };
}

/**
 * HTTP 에러 응답 → GuestbookResult 에러 변환 (승인된 계약 변경 C).
 * 서버의 한국어 message를 우선 사용하고, body가 명세 형식이 아니면 HTTP 상태 기반 폴백.
 */
async function readErrorResult(
  response: Response,
  fallback: string,
): Promise<{ ok: false; reason: GuestbookErrorReason; message: string }> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // body 없음 또는 JSON 아님 — 아래 폴백으로 처리
  }

  const parsed = parseErrorBody(payload);
  if (parsed !== null) {
    switch (parsed.code) {
      case "RATE_LIMITED":
        return {
          ok: false,
          reason: "rate-limited",
          message: parsed.message.length > 0 ? parsed.message : RATE_LIMITED_FALLBACK,
        };
      case "VALIDATION_ERROR":
        return {
          ok: false,
          reason: "validation",
          message: parsed.message.length > 0 ? parsed.message : VALIDATION_FALLBACK,
        };
      default:
        // PAYLOAD_TOO_LARGE / INTERNAL_ERROR / NOT_FOUND 등 — 서버 안내 문구 우선
        return {
          ok: false,
          reason: "network",
          message: parsed.message.length > 0 ? parsed.message : fallback,
        };
    }
  }

  // 상태 코드만으로 최소 분기 (body가 명세 형식이 아닌 경우의 방어선)
  if (response.status === 429) {
    return { ok: false, reason: "rate-limited", message: RATE_LIMITED_FALLBACK };
  }
  if (response.status === 400) {
    return { ok: false, reason: "validation", message: VALIDATION_FALLBACK };
  }
  return {
    ok: false,
    reason: "network",
    message: `${fallback} (HTTP ${response.status})`,
  };
}

/* ---------- API 함수 (백엔드 연결 시 사용할 시그니처) ---------- */

/**
 * 방명록 글 목록 조회 (06 명세 §2.1 — 응답은 최상위 배열, 최신순).
 * options 미지정 시 서버 기본값(최신 50건) 사용.
 */
export async function listGuestbookEntries(
  options?: GuestbookListOptions,
): Promise<GuestbookResult<GuestbookEntry[]>> {
  const connection = getGuestbookConnection();
  if (connection.status === "unconfigured") {
    return { ok: false, reason: "unconfigured", message: UNCONFIGURED_MESSAGE };
  }

  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.offset !== undefined) query.set("offset", String(options.offset));
  const queryString = query.size > 0 ? `?${query.toString()}` : "";

  try {
    const response = await fetch(`${connection.baseUrl}/guestbook${queryString}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return readErrorResult(response, "방명록 목록을 불러오지 못했습니다.");
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return {
        ok: false,
        reason: "invalid-response",
        message: "방명록 응답 형식이 올바르지 않습니다.",
      };
    }
    const entries: GuestbookEntry[] = [];
    for (const item of payload) {
      const entry = parseGuestbookEntry(item);
      if (entry === null) {
        return {
          ok: false,
          reason: "invalid-response",
          message: "방명록 응답에 유효하지 않은 항목이 있습니다.",
        };
      }
      entries.push(entry);
    }
    return { ok: true, data: entries };
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "방명록 서버에 연결하지 못했습니다.",
    };
  }
}

/** 방명록 글 등록 */
export async function createGuestbookEntry(
  input: GuestbookEntryInput,
): Promise<GuestbookResult<GuestbookEntry>> {
  const connection = getGuestbookConnection();
  if (connection.status === "unconfigured") {
    return { ok: false, reason: "unconfigured", message: UNCONFIGURED_MESSAGE };
  }

  try {
    const response = await fetch(`${connection.baseUrl}/guestbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      return readErrorResult(response, "방명록 글을 등록하지 못했습니다.");
    }
    const payload: unknown = await response.json();
    const entry = parseGuestbookEntry(payload);
    if (entry === null) {
      return {
        ok: false,
        reason: "invalid-response",
        message: "방명록 등록 응답 형식이 올바르지 않습니다.",
      };
    }
    return { ok: true, data: entry };
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "방명록 서버에 연결하지 못했습니다.",
    };
  }
}
