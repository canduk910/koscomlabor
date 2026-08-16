import {
  getLatestUrgentNotice,
  getUpcomingDeadlinePosts,
  getVerifiedNews,
  getVerifiedNotices,
} from "@/lib/content";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HeroPanel } from "@/components/home/HeroPanel";
import { DeadlineStrip } from "@/components/home/DeadlineStrip";
import { OnnuriGuideCard } from "@/components/home/OnnuriGuideCard";
import { BoardTabs } from "@/components/board/BoardTabs";

/**
 * 메인페이지 v2 (스펙 §3·§11) — 헤더 / 히어로 패널 / [조건부] 마감 스트립 /
 * 가이드 카드 / 탭 게시판 / 딥블루 푸터.
 * - 히어로(§11.4)가 구 긴급 배너(§3.2)를 대체: urgent 최신 1건 바인딩 또는 폴백.
 * - 간격: 헤더↓히어로 1.5rem, 히어로↓스트립 0.75rem, (스트립)↓다음 요소 2rem,
 *   카드↓탭 2rem (§9.1·§11.4).
 * - 목록 데이터는 서버에서 로드(verified 게이트 통과분만)해 탭 컴포넌트에 전달.
 */
export default function Home() {
  const notices = getVerifiedNotices();
  const news = getVerifiedNews();
  const urgentNotice = getLatestUrgentNotice();
  const deadlinePosts = getUpcomingDeadlinePosts();

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
            <BoardTabs notices={notices} news={news} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
