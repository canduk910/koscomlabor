/**
 * 공약 도메인 + 입력 검증.
 *
 * 카테고리·상태 리터럴의 **단일 출처**다. DB CHECK 제약(마이그레이션 1755300000006)과
 * 짝을 이룬다 — 둘 중 하나만 늘리면 "등록은 되는데 저장에서 500" 또는 그 반대가 된다.
 * ⛔ 이 배열의 값을 각 파일에 다시 쓰지 마라. postValidate.ts 가 같은 사고로 이 형태가 됐다.
 */

export const PLEDGE_CATEGORIES = ["strong", "happy", "fair", "dream"] as const;
export type PledgeCategory = (typeof PLEDGE_CATEGORIES)[number];

export function isPledgeCategory(value: unknown): value is PledgeCategory {
  return typeof value === "string" && (PLEDGE_CATEGORIES as readonly string[]).includes(value);
}

/** 신호등 3단계. 화면 라벨(달성·협의중·미달성)은 **프론트가 갖는다** — 여기 적지 마라 */
export const PLEDGE_STATUSES = ["done", "talking", "undone"] as const;
export type PledgeStatus = (typeof PLEDGE_STATUSES)[number];

export function isPledgeStatus(value: unknown): value is PledgeStatus {
  return typeof value === "string" && (PLEDGE_STATUSES as readonly string[]).includes(value);
}

const CATEGORY_VALUES_TEXT = PLEDGE_CATEGORIES.join(", ");
export const PLEDGE_CATEGORY_ERROR = `category 는 ${CATEGORY_VALUES_TEXT} 중 하나여야 합니다.`;
export const PLEDGE_STATUS_ERROR = `status 는 ${PLEDGE_STATUSES.join(", ")} 중 하나여야 합니다.`;

export interface PledgeInput {
  category: PledgeCategory;
  title: string;
  /** 세부 항목. 줄바꿈 구분 · null = 없음 */
  detail: string | null;
  status: PledgeStatus;
  /** 비고 · null = 없음 */
  note: string | null;
  highlight: boolean;
}

export type PledgeValidation = { ok: true; value: PledgeInput } | { ok: false; message: string };

const TITLE_MAX = 200; // DB varchar(200) 과 동일 — 서버 검증이 선행해 500 대신 400 을 낸다
const DETAIL_MAX = 2_000;
const NOTE_MAX = 1_000;

function codePoints(value: string): number {
  return [...value].length;
}

/**
 * 줄 단위 정리 — 앞뒤 공백과 빈 줄을 걷어내되 **줄바꿈 자체는 보존한다.**
 * 세부 항목은 «여러 줄»이 곧 «여러 항목»이라 `trim()` 만 하면 항목 구분이 남고,
 * 개행을 공백으로 바꾸면 항목이 한 문장으로 뭉개진다.
 */
function normalizeMultiline(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function optionalText(
  value: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: `${field} 은(는) 문자열이어야 합니다.` };
  const normalized = normalizeMultiline(value);
  if (normalized.length === 0) return { ok: true, value: null };
  if (codePoints(normalized) > max) {
    return { ok: false, message: `${field} 은(는) ${max}자 이하여야 합니다.` };
  }
  return { ok: true, value: normalized };
}

/** create: 전체 검증. patch: 기존 값에 병합한 뒤 이 함수로 재검증한다 (posts 와 동일 규약). */
export function validatePledgeInput(payload: unknown): PledgeValidation {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, message: "요청 본문이 올바른 JSON 객체가 아닙니다." };
  }
  const record = payload as Record<string, unknown>;

  // sortOrder 는 서버가 정한다 (카테고리 안 말미에 붙인다). 입력으로 받으면 두 관리자가
  // 동시에 다른 순번을 보낼 때 순서가 어긋난다 — posts 의 publishedAt 과 같은 이유다.
  if ("sortOrder" in record || "sort_order" in record) {
    return { ok: false, message: "표시 순서(sortOrder)는 서버가 정하며 지정할 수 없습니다." };
  }

  const category = record["category"];
  if (!isPledgeCategory(category)) return { ok: false, message: PLEDGE_CATEGORY_ERROR };

  const rawTitle = record["title"];
  if (typeof rawTitle !== "string" || rawTitle.trim().length === 0) {
    return { ok: false, message: "공약명(title)은 필수입니다." };
  }
  const title = rawTitle.trim();
  if (codePoints(title) > TITLE_MAX) {
    return { ok: false, message: `공약명은 ${TITLE_MAX}자 이하여야 합니다.` };
  }

  const detail = optionalText(record["detail"], "세부 내용(detail)", DETAIL_MAX);
  if (!detail.ok) return detail;
  const note = optionalText(record["note"], "비고(note)", NOTE_MAX);
  if (!note.ok) return note;

  // status 생략 = 미달성. 새 공약은 아직 이행되지 않았다는 것이 유일하게 안전한 기본값이다
  // (기본값을 '달성'쪽으로 두면 관리자가 상태를 안 고른 공약이 «달성»으로 게시된다).
  const rawStatus = record["status"];
  if (rawStatus !== undefined && !isPledgeStatus(rawStatus)) {
    return { ok: false, message: PLEDGE_STATUS_ERROR };
  }

  const rawHighlight = record["highlight"];
  if (rawHighlight !== undefined && typeof rawHighlight !== "boolean") {
    return { ok: false, message: "highlight 는 boolean 이어야 합니다." };
  }

  return {
    ok: true,
    value: {
      category,
      title,
      detail: detail.value,
      status: rawStatus ?? "undone",
      note: note.value,
      highlight: rawHighlight === true,
    },
  };
}
