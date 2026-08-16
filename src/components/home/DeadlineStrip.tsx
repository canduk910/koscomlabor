import Link from "next/link";
import type { PostListItem } from "@/lib/postView";
import { ROUTES } from "@/lib/routes";
import { daysUntilKst, formatMonthDaySlash } from "@/lib/date";

/**
 * 마감 스트립 (스펙 §11.5 — 레퍼런스1 하단 타임라인 바).
 * - 노출 조건: deadline이 오늘 이후인 verified 게시물 1건 이상 (판정은 로더 —
 *   getUpcomingDeadlinePosts). 0건이면 page.tsx에서 미렌더.
 * - 배경 primary-soft, radius 12px, 모바일 가로 스크롤(페이지 가로 스크롤 금지).
 * - 항목: "M/D 제목" 15px/700/#093389 (9.23:1 — 채택 #22), 각각 게시물 상세 링크.
 * - D-7 이내: 항목 전체 red 칩(urgent-strong + 흰 텍스트, 8.46:1) + "D-n" 텍스트 병행
 *   (색만으로 임박을 전달하지 않음). soft 배경 위 빨강 텍스트는 대비 미달로 금지.
 * - 항목 간 세로 구분선 1px 장식(aria-hidden).
 */
export function DeadlineStrip({ posts }: { posts: PostListItem[] }) {
  if (posts.length === 0) return null;

  return (
    <nav aria-label="마감 예정 일정" className="rounded-badge bg-primary-soft px-4 py-3">
      <ul className="flex items-center gap-1 overflow-x-auto">
        {posts.map((post, index) => {
          if (post.deadline === null) return null;
          const days = daysUntilKst(post.deadline);
          const imminent = days !== null && days <= 7;
          const monthDay = formatMonthDaySlash(post.deadline);
          const href =
            post.category === "news" ? ROUTES.news(post.id) : ROUTES.notice(post.id);
          return (
            <li key={post.id} className="flex shrink-0 items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="h-4 w-px shrink-0 bg-primary" />
              ) : null}
              <Link
                href={href}
                className={`inline-flex min-h-touch items-center gap-1 whitespace-nowrap text-caption font-bold focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  imminent
                    ? "rounded-lg bg-urgent-strong px-3 py-1 text-white"
                    : "px-2 text-primary"
                }`}
              >
                {imminent ? <span>D-{days}</span> : null}
                <span>
                  {monthDay} {post.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
