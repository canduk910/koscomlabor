/**
 * 서버측 입력 검증 (명세 4.2절). 프론트 검증은 UX일 뿐 — 보안 경계는 여기다.
 * 길이는 유니코드 코드포인트 기준.
 */

export interface ValidatedInput {
  author: string;
  body: string;
}

export type ValidationResult =
  | { ok: true; value: ValidatedInput }
  | { ok: false; message: string };

const AUTHOR_MAX = 20;
const BODY_MAX = 500;

/** 개행(\n, \r) 외 제어 문자 (C0/C1) — body 용 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
/** 모든 제어 문자 (개행 포함) — author 용 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_ALL = /[\u0000-\u001F\u007F-\u009F]/;

/** 이중 방어: 명백한 스크립트 페이로드는 입구에서 거부 (이스케이프는 렌더 계층 책임) */
const SCRIPT_PATTERNS = [/<\s*script/i, /javascript\s*:/i, /\bon[a-z]+\s*=/i, /<\s*iframe/i];

const URL_PATTERN = /https?:\/\//gi;
const MAX_URLS = 2; // 3개 이상 거부 (스팸 휴리스틱)

function codePointLength(value: string): number {
  return [...value].length;
}

export function validateGuestbookInput(payload: unknown): ValidationResult {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, message: "요청 본문이 올바른 JSON 객체가 아닙니다." };
  }
  const record = payload as Record<string, unknown>;
  const rawAuthor = record["author"];
  const rawBody = record["body"];

  if (typeof rawAuthor !== "string") {
    return { ok: false, message: "닉네임(author)은 필수 문자열입니다." };
  }
  if (typeof rawBody !== "string") {
    return { ok: false, message: "본문(body)은 필수 문자열입니다." };
  }

  const author = rawAuthor.trim();
  const body = rawBody.trim();

  if (author.length === 0) {
    return { ok: false, message: "닉네임을 입력해 주세요." };
  }
  if (codePointLength(author) > AUTHOR_MAX) {
    return { ok: false, message: `닉네임은 ${AUTHOR_MAX}자 이하여야 합니다.` };
  }
  if (CONTROL_CHARS_ALL.test(author)) {
    return { ok: false, message: "닉네임에 사용할 수 없는 문자가 포함되어 있습니다." };
  }

  if (body.length === 0) {
    return { ok: false, message: "본문을 입력해 주세요." };
  }
  if (codePointLength(body) > BODY_MAX) {
    return { ok: false, message: `본문은 ${BODY_MAX}자 이하여야 합니다.` };
  }
  if (CONTROL_CHARS_EXCEPT_NEWLINE.test(body)) {
    return { ok: false, message: "본문에 사용할 수 없는 문자가 포함되어 있습니다." };
  }

  for (const pattern of SCRIPT_PATTERNS) {
    if (pattern.test(author) || pattern.test(body)) {
      return { ok: false, message: "허용되지 않는 내용이 포함되어 있습니다." };
    }
  }

  const urlMatches = body.match(URL_PATTERN);
  if (urlMatches !== null && urlMatches.length > MAX_URLS) {
    return { ok: false, message: "링크는 2개까지만 포함할 수 있습니다." };
  }

  return { ok: true, value: { author, body } };
}
