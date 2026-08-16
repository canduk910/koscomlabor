import Link from "next/link";
import type { PostSummary } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { EmptyState } from "@/components/board/EmptyState";

interface PostListProps {
  posts: PostSummary[];
  kind: "notice" | "news";
  emptyMessage: string;
}

/**
 * 게시글 목록 (스펙 §5) — 공지사항·금융노조 소식 공용.
 * 아이템 전체가 블록 링크(터치 대상), urgent는 좌측 보더 + 배지 + 아이콘 3중 구분.
 * 정렬(urgent 우선 → 게시일 내림차순)은 콘텐츠 로더가 보장한다.
 */
export function PostList({ posts, kind, emptyMessage }: PostListProps) {
  if (posts.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const hrefFor = kind === "notice" ? ROUTES.notice : ROUTES.news;

  return (
    <ul className="divide-y divide-border-soft">
      {posts.map((post) => (
        <li
          key={post.slug}
          className={post.urgent ? "border-l-4 border-l-urgent pl-3" : undefined}
        >
          <Link
            href={hrefFor(post.slug)}
            className="group block py-4 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-[-3px]"
          >
            <span className="flex items-start gap-2">
              {post.urgent ? <UrgentBadge withIcon /> : null}
              <span className="line-clamp-2 text-body font-semibold text-ink group-hover:text-primary-strong group-hover:underline">
                {post.title}
              </span>
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
              <time dateTime={post.dateIso}>{post.dateLabel}</time>
              {post.source !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{post.source}</span>
                </>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
