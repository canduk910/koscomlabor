/**
 * 날짜 표기 유틸 — 표기 변환은 반드시 Intl로 계산한다 (union-webapp-dev 스킬 §4).
 * 수동 계산(문자열 슬라이싱으로 요일/월 추정 등) 금지.
 */

/** 날짜 전용 값(YYYY-MM-DD, UTC 자정)을 흔들림 없이 표기하기 위해 UTC 고정 */
const DISPLAY_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ISO_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  // en-CA는 YYYY-MM-DD 형식을 산출한다 (datetime 속성용 ISO 날짜)
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsOf(
  formatter: Intl.DateTimeFormat,
  date: Date,
): { year: string; month: string; day: string } | null {
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** 게시일 표기: `YYYY.MM.DD` (디자인 스펙 §5) */
export function formatPostDate(date: Date): string {
  const p = partsOf(DISPLAY_FORMATTER, date);
  if (!p) return "";
  return `${p.year}.${p.month}.${p.day}`;
}

/** `<time datetime="...">` 속성용 ISO 날짜 문자열 (YYYY-MM-DD) */
export function toIsoDateString(date: Date): string {
  const p = partsOf(ISO_FORMATTER, date);
  if (!p) return "";
  return `${p.year}-${p.month}-${p.day}`;
}

/** 방명록 작성 시각(ISO 8601 UTC 타임스탬프)은 KST 기준 날짜로 표기 */
const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 방명록 엔트리 작성일 표기: `YYYY.MM.DD` (Asia/Seoul 기준).
 * 게시물 날짜(날짜 전용 값, UTC 고정)와 달리 실제 시각이므로 KST로 변환해 표기한다.
 * 유효하지 않은 입력은 빈 문자열 반환.
 */
export function formatEntryDate(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsOf(KST_FORMATTER, date);
  if (!p) return "";
  return `${p.year}.${p.month}.${p.day}`;
}
