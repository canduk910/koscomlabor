import {
  type ApiResult,
  getApiConnection,
  invalidResponse,
  isRecord,
  networkFailure,
  readErrorResult,
  unconfiguredResult,
} from "@/lib/api/http";

/**
 * 공개 게시물 API (06 명세 §11 — 계약의 출처는 명세, 프론트가 따른다).
 * - GET /posts: 최상위 배열 + X-Total-Count (§11.1), 정렬은 서버 책임(urgent 우선 → publishedAt DESC)
 * - GET /posts/:id: PostSummary + body (§11.2)
 * - 응답 필드는 명세와 필드 단위 일치로 명시 검증 (any/근거 없는 as 금지)
 */

export type PostCategory = "notice" | "news";
export type PostType = "link" | "article";

export interface ApiAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** API 도메인 상대 경로 — 프론트가 base URL을 붙인다 (§11.1) */
  url: string;
}

export interface ApiPostSummary {
  id: string;
  category: PostCategory;
  type: PostType;
  title: string;
  url: string | null;
  source: string | null;
  urgent: boolean;
  /** YYYY-MM-DD | null (KST 마감일) */
  deadline: string | null;
  /** ISO 8601 UTC — 표시·정렬 기준 게시일 */
  publishedAt: string;
  attachments: ApiAttachment[];
}

export interface ApiPostDetail extends ApiPostSummary {
  /** markdown 원문 | null (링크형은 선택 코멘트) */
  body: string | null;
}

export interface ListPostsParams {
  category: PostCategory;
  urgent?: boolean;
  limit?: number;
  offset?: number;
}

/* ---------- 응답 검증 ---------- */

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

export function parseAttachment(value: unknown): ApiAttachment | null {
  if (!isRecord(value)) return null;
  const { id, filename, mimeType, sizeBytes, url } = value;
  if (
    typeof id !== "string" ||
    typeof filename !== "string" ||
    typeof mimeType !== "string" ||
    typeof sizeBytes !== "number" ||
    typeof url !== "string"
  ) {
    return null;
  }
  return { id, filename, mimeType, sizeBytes, url };
}

export function parsePostSummary(value: unknown): ApiPostSummary | null {
  if (!isRecord(value)) return null;
  const { id, category, type, title, urgent, publishedAt } = value;
  if (
    typeof id !== "string" ||
    (category !== "notice" && category !== "news") ||
    (type !== "link" && type !== "article") ||
    typeof title !== "string" ||
    typeof urgent !== "boolean" ||
    typeof publishedAt !== "string"
  ) {
    return null;
  }
  const url = readNullableString(value.url);
  const source = readNullableString(value.source);
  const deadline = readNullableString(value.deadline);
  if (url === undefined || source === undefined || deadline === undefined) return null;

  if (!Array.isArray(value.attachments)) return null;
  const attachments: ApiAttachment[] = [];
  for (const item of value.attachments) {
    const attachment = parseAttachment(item);
    if (attachment === null) return null;
    attachments.push(attachment);
  }

  return { id, category, type, title, url, source, urgent, deadline, publishedAt, attachments };
}

export function parsePostDetail(value: unknown): ApiPostDetail | null {
  const summary = parsePostSummary(value);
  if (summary === null || !isRecord(value)) return null;
  const body = readNullableString(value.body);
  if (body === undefined) return null;
  return { ...summary, body };
}

/* ---------- API 함수 (서버 컴포넌트 사용 전제 — 렌더 캐시는 라우트 revalidate 위임) ---------- */

/** 공개 게시물 목록 (최상위 배열). 목록에는 body가 포함되지 않는다 (§11.1) */
export async function listPosts(params: ListPostsParams): Promise<ApiResult<ApiPostSummary[]>> {
  const connection = getApiConnection();
  if (connection.status === "unconfigured") return unconfiguredResult();

  const query = new URLSearchParams({ category: params.category });
  if (params.urgent !== undefined) query.set("urgent", String(params.urgent));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  try {
    const response = await fetch(`${connection.baseUrl}/posts?${query.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return readErrorResult(response, "게시물 목록을 불러오지 못했습니다.");
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return invalidResponse("게시물 목록 응답 형식이 올바르지 않습니다.");
    }
    const posts: ApiPostSummary[] = [];
    for (const item of payload) {
      const post = parsePostSummary(item);
      if (post === null) {
        return invalidResponse("게시물 목록 응답에 유효하지 않은 항목이 있습니다.");
      }
      posts.push(post);
    }
    return { ok: true, data: posts };
  } catch {
    return networkFailure("게시물 서버에 연결하지 못했습니다.");
  }
}

/** 공개 게시물 상세 (body 포함). 없는 id/삭제된 글은 not-found (§11.2) */
export async function getPost(id: string): Promise<ApiResult<ApiPostDetail>> {
  const connection = getApiConnection();
  if (connection.status === "unconfigured") return unconfiguredResult();

  try {
    const response = await fetch(`${connection.baseUrl}/posts/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return readErrorResult(response, "게시물을 불러오지 못했습니다.");
    }
    const payload: unknown = await response.json();
    const post = parsePostDetail(payload);
    if (post === null) {
      return invalidResponse("게시물 상세 응답 형식이 올바르지 않습니다.");
    }
    return { ok: true, data: post };
  } catch {
    return networkFailure("게시물 서버에 연결하지 못했습니다.");
  }
}
