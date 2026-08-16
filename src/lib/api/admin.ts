import {
  type ApiResult,
  getApiConnection,
  invalidResponse,
  isRecord,
  networkFailure,
  readErrorResult,
  unconfiguredResult,
} from "@/lib/api/http";
import {
  type ApiAttachment,
  type ApiPostDetail,
  type PostCategory,
  type PostType,
  parseAttachment,
  parsePostDetail,
  parsePostSummary,
} from "@/lib/api/posts";

/**
 * Admin API 계층 (06 명세 §12·§13).
 * - 인증: 서버 세션 httpOnly 쿠키 — **모든 요청 credentials: "include" 필수**
 *   (07 문서 §7.2 — CORS Allow-Credentials 활성화됨, 허용 Origin 명시 목록)
 * - 에러 code 분기: 방명록 방식 계승 (http.ts 공용 — UNAUTHORIZED/RATE_LIMITED/
 *   VALIDATION_ERROR/LINK_FETCH_FAILED/PAYLOAD_TOO_LARGE/NOT_FOUND)
 * - publishedAt은 서버 자동 기록 — 입력에 포함하지 않는다 (§15-6 리더 판정)
 */

/** admin 목록/상세 — deletedAt 노출 (§13.1 GET /admin/posts) */
export interface ApiAdminPost extends Omit<ApiPostDetail, "body"> {
  body: string | null;
  deletedAt: string | null;
}

export interface AdminPostInput {
  category: PostCategory;
  type: PostType;
  title: string;
  body?: string;
  url?: string;
  source?: string;
  urgent?: boolean;
  /** YYYY-MM-DD */
  deadline?: string | null;
}

export interface LinkPreview {
  title: string;
  siteName: string | null;
}

export interface AdminSession {
  ok: true;
  expiresAt?: string;
}

/** 백엔드 한도와 동일 수치 (06 명세 §13.3 — 클라이언트 선검증용) */
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

function parseAdminPost(value: unknown): ApiAdminPost | null {
  const summary = parsePostSummary(value);
  if (summary === null || !isRecord(value)) return null;
  const body = typeof value.body === "string" ? value.body : null;
  const deletedAt = typeof value.deletedAt === "string" ? value.deletedAt : null;
  return { ...summary, body, deletedAt };
}

async function requestJson(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<ApiResult<unknown>> {
  const connection = getApiConnection();
  if (connection.status === "unconfigured") return unconfiguredResult();
  try {
    const response = await fetch(`${connection.baseUrl}${path}`, {
      ...init,
      credentials: "include", // 세션 쿠키 전송 — 전 admin 요청 필수 (07 §7.2)
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      return readErrorResult(response, fallback);
    }
    return { ok: true, data: (await response.json()) as unknown };
  } catch {
    return networkFailure("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/* ---------- 인증 (§12) ---------- */

export async function adminLogin(password: string): Promise<ApiResult<AdminSession>> {
  const result = await requestJson(
    "/admin/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    },
    "로그인하지 못했습니다.",
  );
  if (!result.ok) return result;
  if (!isRecord(result.data) || result.data.ok !== true) {
    return invalidResponse("로그인 응답 형식이 올바르지 않습니다.");
  }
  const expiresAt = typeof result.data.expiresAt === "string" ? result.data.expiresAt : undefined;
  return { ok: true, data: { ok: true, expiresAt } };
}

export async function adminLogout(): Promise<ApiResult<null>> {
  const result = await requestJson("/admin/logout", { method: "POST" }, "로그아웃하지 못했습니다.");
  if (!result.ok) return result;
  return { ok: true, data: null };
}

/** 세션 유효성 확인 — admin UI 초기 로드용 (§12.1 GET /admin/me) */
export async function adminMe(): Promise<ApiResult<null>> {
  const result = await requestJson("/admin/me", { method: "GET" }, "세션을 확인하지 못했습니다.");
  if (!result.ok) return result;
  return { ok: true, data: null };
}

/* ---------- 게시물 CRUD (§13.1) ---------- */

export async function adminListPosts(params?: {
  category?: PostCategory;
  limit?: number;
  offset?: number;
}): Promise<ApiResult<ApiAdminPost[]>> {
  const query = new URLSearchParams();
  if (params?.category !== undefined) query.set("category", params.category);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.size > 0 ? `?${query.toString()}` : "";

  const result = await requestJson(
    `/admin/posts${qs}`,
    { method: "GET" },
    "게시물 목록을 불러오지 못했습니다.",
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.data)) {
    return invalidResponse("admin 게시물 목록 응답 형식이 올바르지 않습니다.");
  }
  const posts: ApiAdminPost[] = [];
  for (const item of result.data) {
    const post = parseAdminPost(item);
    if (post === null) {
      return invalidResponse("admin 게시물 목록 응답에 유효하지 않은 항목이 있습니다.");
    }
    posts.push(post);
  }
  return { ok: true, data: posts };
}

export async function adminCreatePost(input: AdminPostInput): Promise<ApiResult<ApiPostDetail>> {
  const result = await requestJson(
    "/admin/posts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "게시물을 저장하지 못했습니다.",
  );
  if (!result.ok) return result;
  const post = parsePostDetail(result.data);
  if (post === null) return invalidResponse("게시물 생성 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: post };
}

export async function adminUpdatePost(
  id: string,
  patch: Partial<AdminPostInput>,
): Promise<ApiResult<ApiPostDetail>> {
  const result = await requestJson(
    `/admin/posts/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "게시물을 수정하지 못했습니다.",
  );
  if (!result.ok) return result;
  const post = parsePostDetail(result.data);
  if (post === null) return invalidResponse("게시물 수정 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: post };
}

export async function adminDeletePost(id: string): Promise<ApiResult<{ id: string }>> {
  const result = await requestJson(
    `/admin/posts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "게시물을 삭제하지 못했습니다.",
  );
  if (!result.ok) return result;
  if (!isRecord(result.data) || result.data.deleted !== true || typeof result.data.id !== "string") {
    return invalidResponse("게시물 삭제 응답 형식이 올바르지 않습니다.");
  }
  return { ok: true, data: { id: result.data.id } };
}

/* ---------- 링크 메타데이터 (§13.2) ---------- */

export async function adminPreviewLink(url: string): Promise<ApiResult<LinkPreview>> {
  const result = await requestJson(
    "/admin/posts/preview-link",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
    "제목을 가져오지 못했습니다.",
  );
  if (!result.ok) return result;
  if (!isRecord(result.data) || typeof result.data.title !== "string") {
    return invalidResponse("링크 미리보기 응답 형식이 올바르지 않습니다.");
  }
  const siteName = typeof result.data.siteName === "string" ? result.data.siteName : null;
  return { ok: true, data: { title: result.data.title, siteName } };
}

/* ---------- 파일 첨부 (§13.3) ---------- */

export async function adminUploadAttachment(
  postId: string,
  file: File,
): Promise<ApiResult<ApiAttachment>> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await requestJson(
    `/admin/posts/${encodeURIComponent(postId)}/attachments`,
    { method: "POST", body: formData },
    `파일을 업로드하지 못했습니다: ${file.name}`,
  );
  if (!result.ok) return result;
  const attachment = parseAttachment(result.data);
  if (attachment === null) return invalidResponse("첨부 업로드 응답 형식이 올바르지 않습니다.");
  return { ok: true, data: attachment };
}

export async function adminDeleteAttachment(id: string): Promise<ApiResult<null>> {
  const result = await requestJson(
    `/admin/attachments/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "첨부를 삭제하지 못했습니다.",
  );
  if (!result.ok) return result;
  return { ok: true, data: null };
}
