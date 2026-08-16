import Link from "next/link";
import type { PostListItem } from "@/lib/postView";
import { ROUTES } from "@/lib/routes";
import { daysUntilKst, formatMonthDaySlash } from "@/lib/date";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { DocumentIcon, ExternalLinkIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/board/EmptyState";
import { DateBadge } from "@/components/home/DateBadge";

/** 목록 데이터 상태 — unconfigured/error 시 가짜 목록 대신 정직한 안내 (가짜 동작 금지) */
export type PostListStatus = "ok" | "error" | "unconfigured";

interface PostListProps {
  posts: PostListItem[];
  kind: "notice" | "news";
  status: PostListStatus;
}

const EMPTY_MESSAGES: Record<"notice" | "news", string> = {
  notice: "등록된 공지사항이 없습니다",
  news: "등록된 소식이 없습니다",
};

/**
 * 게시글 목록 (스펙 §5 + v2 카드화 §11.6 + 링크형·첨부 §14.1) — DB(API) 데이터 기반.
 * - 작성형: 카드 전체가 상세 링크
 * - 링크형: 카드 전체가 외부 링크(새 창) — 3중 병행: ↗ 아이콘(16px) + 메타 행
 *   "외부 링크(새 창) · 도메인" + 접근성 이름(메타가 <a> 내부 텍스트라 자동 포함)
 * - 첨부: 메타 행에 문서 아이콘 16px + "첨부 n" (존재 표시만 — 파일명은 상세)
 * - 정렬(urgent 우선 → 게시일 내림차순)은 서버(API)가 보장한다.
 */
export function PostList({ posts, kind, status }: PostListProps) {
  if (posts.length === 0) {
    if (status === "unconfigured") {
      return (
        <EmptyState
          message="게시판을 준비 중입니다"
          subMessage="서비스가 연결되면 게시물이 표시됩니다"
        />
      );
    }
    if (status === "error") {
      return (
        <EmptyState
          message="게시물을 불러오지 못했습니다"
          subMessage="잠시 후 다시 확인해 주세요"
        />
      );
    }
    return <EmptyState message={EMPTY_MESSAGES[kind]} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {posts.map((post) => {
        const days = post.deadline !== null ? daysUntilKst(post.deadline) : null;
        const hasDeadline = days !== null && days >= 0;
        const imminent = hasDeadline && days <= 7;
        const isExternal = post.type === "link" && post.url !== null;

        const cardContent = (
          <span className="flex items-start gap-4">
            {hasDeadline && post.deadline !== null ? (
              <DateBadge
                monthDay={formatMonthDaySlash(post.deadline)}
                subLabel={`D-${days}`}
                variant={imminent ? "imminent" : "default"}
                className="hidden md:flex"
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex items-start gap-2">
                {post.urgent ? <UrgentBadge withIcon /> : null}
                <span className="line-clamp-2 text-body font-semibold text-ink group-hover:text-primary-strong group-hover:underline">
                  {post.title}
                  {isExternal ? (
                    <ExternalLinkIcon className="ml-1 inline size-4 align-[-2px]" />
                  ) : null}
                </span>
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
                {hasDeadline ? (
                  <span
                    className={`font-display font-medium md:hidden ${
                      imminent ? "text-urgent-strong" : "text-primary"
                    }`}
                  >
                    D-{days}
                  </span>
                ) : null}
                <time dateTime={post.publishedAt}>{post.dateLabel}</time>
                {isExternal && post.domain !== null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>외부 링크(새 창) · {post.domain}</span>
                  </>
                ) : null}
                {!isExternal && post.source !== null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{post.source}</span>
                  </>
                ) : null}
                {post.attachmentCount > 0 ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <DocumentIcon className="size-4" />
                      첨부 {post.attachmentCount}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          </span>
        );

        const linkClass =
          "group block px-5 py-4 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-[-3px]";

        return (
          <li
            key={post.id}
            className={`shadow-card hover:shadow-card-hover rounded-2xl bg-bg transition-shadow ${
              post.urgent ? "border-l-4 border-urgent" : ""
            }`}
          >
            {isExternal && post.url !== null ? (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {cardContent}
              </a>
            ) : (
              <Link
                href={
                  post.category === "news" ? ROUTES.news(post.id) : ROUTES.notice(post.id)
                }
                className={linkClass}
              >
                {cardContent}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
