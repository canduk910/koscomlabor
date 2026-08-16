/**
 * 게시물 입력 검증 (명세 06 §13.1 수치 — 리더 승인).
 * publishedAt 은 입력으로 받지 않는다 (자동 기록, §15-6 판정).
 */

export interface PostInput {
  category: "notice" | "news";
  type: "link" | "article";
  title: string;
  body: string | null;
  url: string | null;
  source: string | null;
  urgent: boolean;
  deadline: string | null; // YYYY-MM-DD
}

export type PostValidation =
  | { ok: true; value: PostInput }
  | { ok: false; message: string };

const TITLE_MAX = 300;
const BODY_MAX = 50_000;
const SOURCE_MAX = 200;
const URL_MAX = 2_000;
const DEADLINE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function codePoints(value: string): number {
  return [...value].length;
}

function optionalTrimmed(value: unknown, field: string, max: number): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: `${field} 은(는) 문자열이어야 합니다.` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (codePoints(trimmed) > max) return { ok: false, message: `${field} 은(는) ${max}자 이하여야 합니다.` };
  return { ok: true, value: trimmed };
}

/** create: 전체 검증. patch: 기존 값에 병합 후 이 함수로 재검증한다. */
export function validatePostInput(payload: unknown): PostValidation {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, message: "요청 본문이 올바른 JSON 객체가 아닙니다." };
  }
  const record = payload as Record<string, unknown>;

  if ("publishedAt" in record || "published_at" in record) {
    return { ok: false, message: "게시 시각(publishedAt)은 서버가 자동 기록하며 지정할 수 없습니다." };
  }

  const category = record["category"];
  if (category !== "notice" && category !== "news") {
    return { ok: false, message: "category 는 notice 또는 news 여야 합니다." };
  }
  const type = record["type"];
  if (type !== "link" && type !== "article") {
    return { ok: false, message: "type 은 link 또는 article 이어야 합니다." };
  }

  const rawTitle = record["title"];
  if (typeof rawTitle !== "string" || rawTitle.trim().length === 0) {
    return { ok: false, message: "제목(title)은 필수입니다." };
  }
  const title = rawTitle.trim();
  if (codePoints(title) > TITLE_MAX) {
    return { ok: false, message: `제목은 ${TITLE_MAX}자 이하여야 합니다.` };
  }

  const body = optionalTrimmed(record["body"], "본문(body)", BODY_MAX);
  if (!body.ok) return body;
  const source = optionalTrimmed(record["source"], "출처(source)", SOURCE_MAX);
  if (!source.ok) return source;
  const url = optionalTrimmed(record["url"], "URL", URL_MAX);
  if (!url.ok) return url;

  if (url.value !== null) {
    try {
      const parsed = new URL(url.value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, message: "url 은 http/https 만 허용됩니다." };
      }
    } catch {
      return { ok: false, message: "url 형식이 올바르지 않습니다." };
    }
  }

  const rawUrgent = record["urgent"];
  if (rawUrgent !== undefined && typeof rawUrgent !== "boolean") {
    return { ok: false, message: "urgent 는 boolean 이어야 합니다." };
  }

  const rawDeadline = record["deadline"];
  let deadline: string | null = null;
  if (rawDeadline !== undefined && rawDeadline !== null) {
    if (typeof rawDeadline !== "string" || !DEADLINE_PATTERN.test(rawDeadline)) {
      return { ok: false, message: "deadline 은 YYYY-MM-DD 형식이어야 합니다." };
    }
    const parsed = new Date(`${rawDeadline}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: "deadline 이 유효한 날짜가 아닙니다." };
    }
    deadline = rawDeadline;
  }

  // 유형별 필수 조합 (DB CHECK 와 동일 — 서버 검증이 선행)
  if (type === "link" && url.value === null) {
    return { ok: false, message: "링크형 게시물은 url 이 필수입니다." };
  }
  if (type === "article" && body.value === null) {
    return { ok: false, message: "작성형 게시물은 body 가 필수입니다." };
  }
  if (category === "news" && type === "article" && source.value === null) {
    return { ok: false, message: "금융노조 소식(작성형)은 출처(source)가 필수입니다." };
  }

  return {
    ok: true,
    value: {
      category,
      type,
      title,
      body: body.value,
      url: url.value,
      source: source.value,
      urgent: rawUrgent === true,
      deadline,
    },
  };
}
