import {
  type ApiResult,
  getApiConnection,
  invalidResponse,
  isRecord,
  networkFailure,
  readErrorResult,
  SSR_FETCH_TIMEOUT_MS,
  unconfiguredResult,
} from "@/lib/api/http";

/**
 * 공약 API — 공개 조회 + 관리자 CRUD.
 *
 * 공개와 관리자를 한 파일에 둔다: 응답 파서가 «관리자 = 공개 + 3필드» 라 파생 관계이고,
 * 나누면 공개 파서를 고칠 때 관리자 쪽이 조용히 남는다.
 * ⚠ 관리자 요청은 전부 `credentials: "include"` 다 — 인증이 세션 httpOnly 쿠키다.
 */

/**
 * 카테고리·상태 코드 — **프론트 단일 출처**. 서버 `PLEDGE_CATEGORIES`/`PLEDGE_STATUSES`,
 * DB CHECK 제약과 값·순서가 같다. 한국어 라벨은 여기 없다 → `@/lib/pledges`.
 * ⛔ 이 배열을 좁히지 마라 — 좁히면 해당 공약이 파싱에서 조용히 버려지고
 *   "관리자는 등록했는데 화면에 없는" 부분 고장이 된다(posts 에서 실제로 겪은 사고다).
 */
export const PLEDGE_CATEGORIES = ["strong", "happy", "fair", "dream"] as const;
export type PledgeCategory = (typeof PLEDGE_CATEGORIES)[number];

export const PLEDGE_STATUSES = ["done", "talking", "undone"] as const;
export type PledgeStatus = (typeof PLEDGE_STATUSES)[number];

export function isPledgeCategory(value: unknown): value is PledgeCategory {
  return PLEDGE_CATEGORIES.some((category) => category === value);
}

export function isPledgeStatus(value: unknown): value is PledgeStatus {
  return PLEDGE_STATUSES.some((status) => status === value);
}

export interface ApiPledge {
  id: string;
  category: PledgeCategory;
  title: string;
  /** 세부 항목. 줄바꿈 구분 · null = 없음 */
  detail: string | null;
  status: PledgeStatus;
  note: string | null;
  /** 공약집 2쪽 「핵심공약」 수록 여부 */
  highlight: boolean;
}

export interface ApiAdminPledge extends ApiPledge {
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PledgeInput {
  category: PledgeCategory;
  title: string;
  detail?: string | null;
  status?: PledgeStatus;
  note?: string | null;
  highlight?: boolean;
}

/** 부분 수정 — 보낸 키만 바뀐다(서버가 기존 값 위에 병합 후 전체 재검증). */
export type PledgePatch = Partial<PledgeInput>;

/**
 * 공개 목록 응답 — **배열이 아니라 봉투다**(서버 `publicListSchema` 와 짝).
 * `published: false` 면 서버가 데이터를 아예 안 보낸다 → `pledges` 는 빈 배열이다.
 * ★ 화면은 이 둘을 «다르게» 다뤄야 한다:
 *   `published === false` → 의도된 비공개(상세 페이지는 404)
 *   `ok === false`        → 통신 실패(「불러오지 못했습니다」)
 *   ⛔ 둘을 합치지 마라 — 서버가 죽었을 때 「없는 페이지」를 보여주게 된다.
 */
export interface PledgeListResult {
  published: boolean;
  pledges: ApiPledge[];
}

/** 공개 여부 (관리자 전용) */
export interface PledgeVisibility {
  pledgesPublished: boolean;
  /** ISO 8601 UTC | null */
  updatedAt: string | null;
}

/** 서버 한도와 동일 수치 (클라이언트 선검증용) */
export const PLEDGE_TITLE_MAX = 200;
export const PLEDGE_DETAIL_MAX = 2_000;
export const PLEDGE_NOTE_MAX = 1_000;

/* ---------- 응답 검증 (any·근거 없는 as 금지) ---------- */

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

export function parsePledge(value: unknown): ApiPledge | null {
  if (!isRecord(value)) return null;
  const { id, category, title, status, highlight } = value;
  if (
    typeof id !== "string" ||
    !isPledgeCategory(category) ||
    typeof title !== "string" ||
    !isPledgeStatus(status) ||
    typeof highlight !== "boolean"
  ) {
    return null;
  }
  const detail = readNullableString(value.detail);
  const note = readNullableString(value.note);
  if (detail === undefined || note === undefined) return null;
  return { id, category, title, detail, status, note, highlight };
}

function parseAdminPledge(value: unknown): ApiAdminPledge | null {
  const base = parsePledge(value);
  if (base === null || !isRecord(value)) return null;
  const { sortOrder, createdAt, updatedAt } = value;
  if (
    typeof sortOrder !== "number" ||
    !Number.isInteger(sortOrder) ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }
  const deletedAt = readNullableString(value.deletedAt);
  if (deletedAt === undefined) return null;
  return { ...base, sortOrder, createdAt, updatedAt, deletedAt };
}

function parseArray<T>(payload: unknown, parse: (v: unknown) => T | null): T[] | null {
  if (!Array.isArray(payload)) return null;
  const out: T[] = [];
  for (const item of payload) {
    const parsed = parse(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

/* ---------- 공개 ---------- */

/**
 * 공개 공약 목록 — **전건**. 페이징 파라미터가 없다(서버도 받지 않는다).
 * 화면이 진행률을 내므로 일부만 오면 숫자가 조용히 틀린다 — `routes/pledges.ts` 참조.
 *
 * ⚠ 응답이 봉투 형식이 아니면 `invalid-response` 다 — **관용 파싱을 넣지 마라.**
 *   구버전 API(최상위 배열)를 «공개»로 해석하면, 웹이 API 보다 먼저 배포된 구간에
 *   **비공개여야 할 상황판이 새어 나간다.** 형식이 다르면 «못 읽음»이고, 못 읽으면 안 보인다.
 */
export async function listPledges(): Promise<ApiResult<PledgeListResult>> {
  const connection = getApiConnection();
  if (connection.status === "unconfigured") return unconfiguredResult();

  try {
    const response = await fetch(`${connection.baseUrl}/pledges`, {
      headers: { Accept: "application/json" },
      // ⛔ 지우지 마라 — 근거는 `http.ts` 의 SSR_FETCH_TIMEOUT_MS 주석
      signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return readErrorResult(response, "공약 목록을 불러오지 못했습니다.");
    const payload: unknown = await response.json();
    if (!isRecord(payload) || typeof payload.published !== "boolean") {
      return invalidResponse("공약 목록 응답 형식이 올바르지 않습니다.");
    }
    const parsed = parseArray(payload.pledges, parsePledge);
    if (parsed === null) return invalidResponse("공약 목록 응답 형식이 올바르지 않습니다.");
    return { ok: true, data: { published: payload.published, pledges: parsed } };
  } catch {
    return networkFailure("공약 서버에 연결하지 못했습니다.");
  }
}

/* ---------- 관리자 ---------- */

async function adminRequest(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<ApiResult<unknown>> {
  const connection = getApiConnection();
  if (connection.status === "unconfigured") return unconfiguredResult();
  try {
    const response = await fetch(`${connection.baseUrl}${path}`, {
      ...init,
      credentials: "include", // 세션 쿠키 — 전 admin 요청 필수
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
    if (!response.ok) return readErrorResult(response, fallback);
    return { ok: true, data: (await response.json()) as unknown };
  } catch {
    return networkFailure("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function parseVisibility(value: unknown): PledgeVisibility | null {
  if (!isRecord(value) || typeof value.pledgesPublished !== "boolean") return null;
  const updatedAt = readNullableString(value.updatedAt);
  if (updatedAt === undefined) return null;
  return { pledgesPublished: value.pledgesPublished, updatedAt };
}

export async function adminGetPledgeVisibility(): Promise<ApiResult<PledgeVisibility>> {
  const result = await adminRequest(
    "/admin/pledges/visibility",
    { method: "GET" },
    "공개 여부를 불러오지 못했습니다.",
  );
  if (!result.ok) return result;
  const parsed = parseVisibility(result.data);
  if (parsed === null) return invalidResponse("공개 여부 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: parsed };
}

export async function adminSetPledgeVisibility(
  pledgesPublished: boolean,
): Promise<ApiResult<PledgeVisibility>> {
  const result = await adminRequest(
    "/admin/pledges/visibility",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pledgesPublished }),
    },
    "공개 여부를 바꾸지 못했습니다.",
  );
  if (!result.ok) return result;
  const parsed = parseVisibility(result.data);
  if (parsed === null) return invalidResponse("공개 여부 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: parsed };
}

export async function adminListPledges(): Promise<ApiResult<ApiAdminPledge[]>> {
  const result = await adminRequest("/admin/pledges", { method: "GET" }, "공약 목록을 불러오지 못했습니다.");
  if (!result.ok) return result;
  const parsed = parseArray(result.data, parseAdminPledge);
  if (parsed === null) return invalidResponse("공약 목록 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: parsed };
}

export async function adminCreatePledge(input: PledgeInput): Promise<ApiResult<ApiAdminPledge>> {
  const result = await adminRequest(
    "/admin/pledges",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "공약을 등록하지 못했습니다.",
  );
  if (!result.ok) return result;
  const parsed = parseAdminPledge(result.data);
  if (parsed === null) return invalidResponse("공약 등록 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: parsed };
}

export async function adminUpdatePledge(
  id: string,
  patch: PledgePatch,
): Promise<ApiResult<ApiAdminPledge>> {
  const result = await adminRequest(
    `/admin/pledges/${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) },
    "공약을 수정하지 못했습니다.",
  );
  if (!result.ok) return result;
  const parsed = parseAdminPledge(result.data);
  if (parsed === null) return invalidResponse("공약 수정 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: parsed };
}

export async function adminDeletePledge(id: string): Promise<ApiResult<{ id: string }>> {
  const result = await adminRequest(
    `/admin/pledges/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "공약을 삭제하지 못했습니다.",
  );
  if (!result.ok) return result;
  if (!isRecord(result.data) || typeof result.data.id !== "string") {
    return invalidResponse("공약 삭제 응답 형식이 올바르지 않습니다.");
  }
  return { ok: true, data: { id: result.data.id } };
}
