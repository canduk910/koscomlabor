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

export type GuestbookResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "network" | "invalid-response"; message: string };

const UNCONFIGURED_MESSAGE =
  "방명록 백엔드(NCP)가 아직 연결되지 않았습니다 (NEXT_PUBLIC_API_BASE_URL 미설정).";

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

/* ---------- API 함수 (백엔드 연결 시 사용할 시그니처) ---------- */

/** 방명록 글 목록 조회 */
export async function listGuestbookEntries(): Promise<GuestbookResult<GuestbookEntry[]>> {
  const connection = getGuestbookConnection();
  if (connection.status === "unconfigured") {
    return { ok: false, reason: "unconfigured", message: UNCONFIGURED_MESSAGE };
  }

  try {
    const response = await fetch(`${connection.baseUrl}/guestbook`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: "network",
        message: `방명록 목록을 불러오지 못했습니다 (HTTP ${response.status}).`,
      };
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
      return {
        ok: false,
        reason: "network",
        message: `방명록 글을 등록하지 못했습니다 (HTTP ${response.status}).`,
      };
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
