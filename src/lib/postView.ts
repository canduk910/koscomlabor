import type {
  ApiAttachment,
  ApiPostDetail,
  ApiPostSummary,
  PostCategory,
} from "@/lib/api/posts";
import { resolveApiUrl } from "@/lib/api/http";
import { daysUntilKst, formatEntryDate } from "@/lib/date";

/**
 * 게시물 뷰 모델 — API 정본(ApiPost*)에서 표시용 파생값을 계산한다
 * (06 명세 §11.4: 표시 포맷·정렬값은 프론트 파생 계층 책임).
 * 서버 컴포넌트에서 파생을 마쳐 클라이언트에는 직렬화 가능한 평면 구조만 전달한다.
 */

export interface PostListItem {
  id: string;
  /** 분류는 API 정본 타입을 재사용한다 — 리터럴 재기술 금지 (§15.6R-H #3) */
  category: PostCategory;
  type: "link" | "article";
  title: string;
  urgent: boolean;
  /** YYYY-MM-DD | null */
  deadline: string | null;
  source: string | null;
  /** 링크형 외부 URL */
  url: string | null;
  /** 링크형 URL의 호스트만 (전체 URL 노출 금지 — 스펙 §14.1) */
  domain: string | null;
  /** ISO 8601 — <time datetime> 용 정본 */
  publishedAt: string;
  /** YYYY.MM.DD (KST, Intl 계산) */
  dateLabel: string;
  attachmentCount: number;
}

export interface AttachmentView {
  id: string;
  filename: string;
  /** "1.2MB" / "340KB" 표기 */
  sizeLabel: string;
  /** 다운로드 절대 URL */
  href: string;
}

export interface PostDetailView extends PostListItem {
  body: string | null;
  attachments: AttachmentView[];
}

function extractDomain(url: string | null): string | null {
  if (url === null) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** 크기 표기: 1MB 이상 소수 1자리 MB(스펙 §14.1), 미만은 정수 KB */
export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function toPostListItem(post: ApiPostSummary): PostListItem {
  return {
    id: post.id,
    category: post.category,
    type: post.type,
    title: post.title,
    urgent: post.urgent,
    deadline: post.deadline,
    source: post.source,
    url: post.url,
    domain: post.type === "link" ? extractDomain(post.url) : null,
    publishedAt: post.publishedAt,
    dateLabel: formatEntryDate(post.publishedAt),
    attachmentCount: post.attachments.length,
  };
}

function toAttachmentView(attachment: ApiAttachment): AttachmentView | null {
  const href = resolveApiUrl(attachment.url);
  if (href === null) return null;
  return {
    id: attachment.id,
    filename: attachment.filename,
    sizeLabel: formatFileSize(attachment.sizeBytes),
    href,
  };
}

export function toPostDetailView(post: ApiPostDetail): PostDetailView {
  return {
    ...toPostListItem(post),
    body: post.body,
    attachments: post.attachments
      .map(toAttachmentView)
      .filter((view): view is AttachmentView => view !== null),
  };
}

/** 마감 스트립용: deadline이 오늘(KST) 이후(오늘 포함)인 게시물, 마감 오름차순 */
export function selectUpcomingDeadlines(posts: PostListItem[]): PostListItem[] {
  return posts
    .filter((post) => {
      if (post.deadline === null) return false;
      const days = daysUntilKst(post.deadline);
      return days !== null && days >= 0;
    })
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
}
