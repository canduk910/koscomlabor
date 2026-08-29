import type { ReactNode } from "react";
import { listPosts, type PostCategory } from "@/lib/api/posts";
import { getApiConnection } from "@/lib/api/http";
import {
  type PostListItem,
  selectUpcomingDeadlines,
  toPostListItem,
} from "@/lib/postView";
import { HOME_SECTIONS, type HomeSectionId } from "@/lib/homeSections";
import { PostList, type PostListStatus } from "@/components/board/PostList";
import { GuestbookPanel } from "@/components/board/GuestbookPanel";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HeroPanel } from "@/components/home/HeroPanel";
import { DeadlineStrip } from "@/components/home/DeadlineStrip";
import { OnnuriGuideCard } from "@/components/home/OnnuriGuideCard";
import { StrikeBanner } from "@/components/home/StrikeBanner";
import { HomeTabs, type HomeTabItem } from "@/components/home/HomeTabs";
import { StruggleCalendar } from "@/components/bargaining/StruggleCalendar";
import { STRUGGLE_SCHEDULE, nextStruggleEvent } from "@/lib/struggleSchedule";
import { strikePhase } from "@/lib/strike";

/**
 * 메인페이지 (스펙 §15). 서버 컴포넌트 fetch + ISR 60초. API 미설정·실패 시 빈 상태 + 정직한
 * 안내(**가짜 동작 금지**). 합격 기준은 **은폐 금지**(§15.1) — 히어로·마감 스트립은 바로가기
 * 레이어일 뿐이다. ⚠ `notices.posts` **전체**를 공지 탭에 넘겨라(히어로의 urgent 를 빼지 마라).
 */
export const revalidate = 60;

interface CategoryData {
  posts: PostListItem[];
  status: PostListStatus;
}

/** API 미설정 시의 정직한 기본값 (분류 수만큼 필요 — §15.6R-H) */
const UNCONFIGURED: CategoryData = { posts: [], status: "unconfigured" };

async function loadCategory(category: PostCategory): Promise<CategoryData> {
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
  const [notices, news, education] =
    connection.status === "configured"
      ? await Promise.all([
          loadCategory("notice"),
          loadCategory("news"),
          loadCategory("education"),
        ])
      : [UNCONFIGURED, UNCONFIGURED, UNCONFIGURED];

  // 히어로 urgent 바인딩은 **서버 정렬(urgent 우선 → 최신순)에 기댄다** — 그래서 공지 목록의
  // 첫 항목이 urgent 면 그것이 곧 "urgent 최신 1건"이다(§11.4 모드 1 · 별도 쿼리 없이 파생).
  // ⚠ 서버 정렬을 바꾸면 이 파생이 조용히 깨진다.
  const first = notices.posts[0];
  const urgentNotice = first !== undefined && first.urgent ? first : null;

  // ⚠ 마감 스트립은 **3분류 전부**를 받는다(§14.6-4) — 분류에 따라 어떤 때만 뜨면
  // "관리자가 마감일을 넣었는데 조합원에게 안 보인다"가 된다
  const deadlinePosts = selectUpcomingDeadlines([
    ...notices.posts,
    ...news.posts,
    ...education.posts,
  ]);

  /** 섹션 id → 콘텐츠 (§15.5). `Record<HomeSectionId, …>` 라 섹션 추가 시 누락이 컴파일 에러로 잡힌다 */
  const panels: Record<HomeSectionId, ReactNode> = {
    notices: <PostList posts={notices.posts} kind="notice" status={notices.status} />,
    news: <PostList posts={news.posts} kind="news" status={news.status} />,
    education: (
      <PostList posts={education.posts} kind="education" status={education.status} />
    ),
    guestbook: <GuestbookPanel />,
  };
  /* 탭 라벨 **건수** — §0.4 사고 재발 방지 장치(규칙은 `HomeTabs` 머리 주석).
   * ⚠ 방명록은 `null` 이다. **0 으로 적지 마라** — 0 은 "글이 없다"는 사실 주장이다. */
  const counts: Record<HomeSectionId, number | null> = {
    notices: notices.posts.length,
    news: news.posts.length,
    education: education.posts.length,
    guestbook: null,
  };
  const tabItems: HomeTabItem[] = HOME_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    count: counts[section.id],
    panel: panels[section.id],
  }));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* 컨테이너 960px — 썸네일이 카드 우측에 들어와 텍스트 열을 지키려면 폭이 필요하다(§16.7.1) */}
        <div className="mx-auto mt-6 w-full max-w-page px-4 md:mt-10 md:px-8">
          {/* 도입 블록(§16.11.2). 배너 자리 결정표는 §52.10.
              ⚠ **배너는 화면에 1개다** — `hero` 와 `panel` 을 함께 렌더하지 마라(§0.2-5).
              ⚠ `RallyBanner`(8/28)는 **파일째** 내려갔다(§52.9) — **복사본을 만들지 마라**(git 이력).
                단 `/rally-2026-08-28` **페이지는 살아 있다**(뿌려진 URL 이 열려야 한다).
              ⚠ 9/5 부터 `panel` 배너만 남는다(§52.10-1) — **«다음 일정이 없습니다»를 짓지 마라** */}
          <HeroPanel post={urgentNotice} />
          {urgentNotice !== null ? (
            /* 긴급 공지가 히어로를 차지했다 → 배너는 보조 표면으로 그 아래 */
            <StrikeBanner surface="panel" phase={strikePhase()} className="mt-3 md:mt-4" />
          ) : strikePhase() !== "past" ? (
            /* 히어로 자리를 배너가 차지한다 */
            <StrikeBanner surface="hero" phase={strikePhase()} />
          ) : (
            /* 9/4 가 지났고 긴급 공지도 없다 → 배너는 보조 표면으로 최상단 */
            <StrikeBanner surface="panel" phase="past" />
          )}
          {deadlinePosts.length > 0 ? (
            <div className="mt-3 md:mt-4">
              <DeadlineStrip posts={deadlinePosts} />
            </div>
          ) : null}
          {/* 미니달력(§19.2.1 — 마감 스트립과 다른 것이다 §19.2.3). ⚠ 렌더 여부를 컴포넌트의
              `null` 반환에 맡기지 마라 — **감싸는 여백 32px 이 빈 채로 남는다** */}
          {nextStruggleEvent() !== null ? (
            <div className="mt-8 md:mt-10">
              <StruggleCalendar events={STRUGGLE_SCHEDULE} size="mini" />
            </div>
          ) : null}
          {/* ⚠ **`RallyEntryCard` 를 되살리지 마라**(§36.2) — 같은 곳을 가리키는 진입점이 둘이 된다.
              표면 언어는 `StrikeBanner surface="panel"` 이 승계했다 */}
          <div className="mt-8 md:mt-10">
            <OnnuriGuideCard />
          </div>

          {/* 게시판 **탭**(사용자 지시 2026-08-22 — `SectionNav` + 세로 스택을 대체. 그 둘은 사용처 0).
              ⚠ **`HomeTabs` 머리 주석을 읽고 나서 손대라** — 탭 사고(§0.4) 재발 방지 장치가 거기 있다 */}
          <HomeTabs className="mt-14 md:mt-18" items={tabItems} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
