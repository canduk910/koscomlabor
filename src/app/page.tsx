import {
  getLatestUrgentNotice,
  getVerifiedNews,
  getVerifiedNotices,
} from "@/lib/content";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { UrgentBanner } from "@/components/notice/UrgentBanner";
import { BoardTabs } from "@/components/board/BoardTabs";

/**
 * 메인페이지 — 헤더 / [조건부] 긴급 배너 / 탭 게시판 / 푸터 (스펙 §3).
 * 목록 데이터는 서버에서 로드(verified 게이트 통과분만)해 탭 컴포넌트에 전달한다.
 */
export default function Home() {
  const notices = getVerifiedNotices();
  const news = getVerifiedNews();
  const urgentNotice = getLatestUrgentNotice();

  return (
    <>
      <SiteHeader />
      {urgentNotice !== null ? <UrgentBanner post={urgentNotice} /> : null}
      <main className="flex-1">
        <div className="mx-auto mt-8 w-full max-w-page px-4 md:px-6">
          <BoardTabs notices={notices} news={news} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
