import { listPosts } from "@/lib/api/posts";
import { getApiConnection } from "@/lib/api/http";
import {
  type PostListItem,
  selectUpcomingDeadlines,
  toPostListItem,
} from "@/lib/postView";
import type { PostListStatus } from "@/components/board/PostList";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HeroPanel } from "@/components/home/HeroPanel";
import { DeadlineStrip } from "@/components/home/DeadlineStrip";
import { OnnuriGuideCard } from "@/components/home/OnnuriGuideCard";
import { BoardTabs } from "@/components/board/BoardTabs";

/**
 * 메인페이지 (스펙 §3·§11·§14) — DB(API) 전환판.
 * 렌더 전략: 서버 컴포넌트 fetch + ISR revalidate 60초 (리더 권장안 채택).
 * 정적 프리렌더 포기 — 컨테이너가 next server이므로 가능. D-n·마감 스트립도
 * 요청 시점(최대 60초 지연) 계산으로 전환되어 빌드 고정 한계가 해소된다.
 * API 미설정/실패 시 목록은 빈 상태 + 정직한 안내 (가짜 동작 금지).
 */
export const revalidate = 60;

interface CategoryData {
  posts: PostListItem[];
  status: PostListStatus;
}

async function loadCategory(category: "notice" | "news"): Promise<CategoryData> {
  const result = await listPosts({ category });
  if (!result.ok) {
    return {
      posts: [],
      status: result.reason === "unconfigured" ? "unconfigured" : "error",
    };
  }
  return { posts: result.data.map(toPostListItem), status: "ok" };
}

export default async function Home() {
  const connection = getApiConnection();
  const [notices, news] =
    connection.status === "configured"
      ? await Promise.all([loadCategory("notice"), loadCategory("news")])
      : [
          { posts: [], status: "unconfigured" as const },
          { posts: [], status: "unconfigured" as const },
        ];

  // 히어로 urgent 바인딩: 서버 정렬(urgent 우선 → 최신순)이므로 공지 목록의
  // 첫 항목이 urgent면 그것이 곧 "urgent 최신 1건" — 별도 쿼리 없이 파생
  const first = notices.posts[0];
  const urgentNotice = first !== undefined && first.urgent ? first : null;

  const deadlinePosts = selectUpcomingDeadlines([...notices.posts, ...news.posts]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto mt-6 w-full max-w-page px-4 md:px-6">
          <HeroPanel post={urgentNotice} />
          {deadlinePosts.length > 0 ? (
            <div className="mt-3">
              <DeadlineStrip posts={deadlinePosts} />
            </div>
          ) : null}
          <div className="mt-8">
            <OnnuriGuideCard />
          </div>
          <div className="mt-8">
            <BoardTabs
              notices={notices.posts}
              news={news.posts}
              noticesStatus={notices.status}
              newsStatus={news.status}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
