import Link from "next/link";
import type { PostSummary } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { daysUntilKst, formatMonthDaySlash } from "@/lib/date";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { EmptyState } from "@/components/board/EmptyState";
import { DateBadge } from "@/components/home/DateBadge";

interface PostListProps {
  posts: PostSummary[];
  kind: "notice" | "news";
  emptyMessage: string;
}

/**
 * 게시글 목록 (스펙 §5 + v2 카드화 §11.6).
 * - v2: 구분선 리스트 → 카드 리스트 (흰 카드, radius 16px, shadow-card,
 *   패딩 1rem 1.25rem, 아이템 간 gap 0.75rem, hover shadow-card-hover)
 * - urgent 좌측 보더 4px(--color-urgent)는 카드 좌변 유지, focus 내향 아웃라인 유지
 * - deadline 게시물(§11.5): md+ 좌측 날짜 배지, 모바일은 제목 아래 D-n 텍스트
 * - 정렬(urgent 우선 → 게시일 내림차순)은 콘텐츠 로더가 보장한다.
 */
export function PostList({ posts, kind, emptyMessage }: PostListProps) {
  if (posts.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const hrefFor = kind === "notice" ? ROUTES.notice : ROUTES.news;

  return (
    <ul className="flex flex-col gap-3">
      {posts.map((post) => {
        const days = post.deadline !== null ? daysUntilKst(post.deadline) : null;
        const hasDeadline = days !== null && days >= 0;
        const imminent = hasDeadline && days <= 7;
        return (
          <li
            key={post.slug}
            className={`shadow-card hover:shadow-card-hover rounded-2xl bg-bg transition-shadow ${
              post.urgent ? "border-l-4 border-urgent" : ""
            }`}
          >
            <Link
              href={hrefFor(post.slug)}
              className="group block px-5 py-4 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-[-3px]"
            >
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
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
                    {/* §12.2: 모바일 D-n — Gmarket Sans Medium 500, 자간 0 */}
                    {hasDeadline ? (
                      <span
                        className={`font-display font-medium md:hidden ${
                          imminent ? "text-urgent-strong" : "text-primary"
                        }`}
                      >
                        D-{days}
                      </span>
                    ) : null}
                    <time dateTime={post.dateIso}>{post.dateLabel}</time>
                    {post.source !== null ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{post.source}</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
