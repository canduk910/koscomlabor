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
import { RallyBanner } from "@/components/home/RallyBanner";
import { SectionNav } from "@/components/home/SectionNav";
import { HomeSection } from "@/components/home/HomeSection";
import { StruggleCalendar } from "@/components/bargaining/StruggleCalendar";
import { STRUGGLE_SCHEDULE, nextStruggleEvent } from "@/lib/struggleSchedule";
import { rallyPhase } from "@/lib/rally";

/**
 * 메인페이지 (스펙 §15 — 탭 → 섹션 나열 전환판. §3 구조도·§4 탭 스펙은 폐기).
 * 렌더 전략: 서버 컴포넌트 fetch + ISR revalidate 60초 (리더 권장안 채택).
 * API 미설정/실패 시 목록은 빈 상태 + 정직한 안내 (가짜 동작 금지).
 *
 * 이 페이지의 합격 기준은 **은폐 금지**(§15.1)다:
 * - `hidden`·`display:none` 으로 감춘 콘텐츠 컨테이너 0개, `role="tab(panel)"` 0건
 * - "기본 선택" 개념 없음, 아코디언·접기·더보기 없음, JS 없이 4개 섹션 전부 렌더
 * - 히어로·마감 스트립은 **바로가기 레이어**일 뿐이며 거기 나온 게시물도 아래 목록에 그대로 남는다
 *   (아래 `notices.posts` 전체를 공지 섹션에 넘긴다 — 히어로에 올라간 urgent 공지를 빼지 말 것)
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

  // 히어로 urgent 바인딩: 서버 정렬(urgent 우선 → 최신순)이므로 공지 목록의
  // 첫 항목이 urgent면 그것이 곧 "urgent 최신 1건" — 별도 쿼리 없이 파생
  const first = notices.posts[0];
  const urgentNotice = first !== undefined && first.urgent ? first : null;

  // 마감 스트립은 3분류 전부를 받는다 (리더 판정 2026-08-17). 마감일은 §14.6-4 대로 분류·유형
  // 공통 속성이고, 교육은 신청·수강 기한이 실재한다. 분류에 따라 마감일이 어떤 때만 스트립에
  // 뜨면 "관리자가 마감일을 넣었는데 조합원에게 안 보인다" = 이번 작업이 제거하는 실패 모드다.
  // 항목 링크는 `ROUTES.post` 매핑이므로 education 도 올바른 경로(/education/<id>)로 간다.
  const deadlinePosts = selectUpcomingDeadlines([
    ...notices.posts,
    ...news.posts,
    ...education.posts,
  ]);

  /**
   * 섹션 id → 콘텐츠 (§15.5 매핑표). `Record<HomeSectionId, ...>` 이므로
   * HOME_SECTIONS 에 섹션을 추가하면 컴파일 에러로 누락이 잡힌다.
   * 공지·소식·노동교육은 같은 `PostList` 를 쓴다 — 분류별 시각 규칙 0건.
   */
  const sectionContent: Record<HomeSectionId, ReactNode> = {
    notices: <PostList posts={notices.posts} kind="notice" status={notices.status} />,
    news: <PostList posts={news.posts} kind="news" status={news.status} />,
    education: (
      <PostList posts={education.posts} kind="education" status={education.status} />
    ),
    guestbook: <GuestbookPanel />,
  };

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* 컨테이너 960px(max-w-page) — 썸네일이 카드 우측에 들어오므로 텍스트 열을 지키려면
            폭이 필요하다(§16.7.1). 본문 장문은 상세 페이지에서 prose 672px 로 별도 제한된다 */}
        <div className="mx-auto mt-6 w-full max-w-page px-4 md:mt-10 md:px-8">
          {/* ── 도입 블록 (§16.11.2 — 구조 유지, 간격은 §16.7.2 표) ──

              ★ **8/28 배너가 최상단이다**(사용자 지시 2026-08-21 · §36.2).
              *"가장 상단에 8/28(금) 결의대회 참석안내 배너를 붙이고, 기존의 26년 임단협
              투쟁 안내는 삭제하자."*

              | urgent | phase | 히어로 자리 | 8/28 배너 |
              |--------|-------|-------------|-----------|
              | 있음   | 전부  | **공지**    | `panel` — 바로 아래 |
              | 없음   | upcoming/today | **배너 = `hero`** | (히어로가 곧 배너) |
              | 없음   | **past** | ★ **비운다** | `panel` — 최상단 |

              ⚠ **배너는 화면에 1개다.** `hero` 와 `panel` 을 함께 렌더하지 마라 —
              같은 링크가 한 화면에 두 번 나오고 딥블루 강조 면이 둘이 된다(§0.2-5).
              `HeroPanel` 은 urgent 가 없으면 스스로 `null` 을 반환한다.
          */}
          <HeroPanel post={urgentNotice} />
          {urgentNotice !== null ? (
            /* 긴급 공지가 히어로를 차지했다 → 배너는 보조 표면으로 그 아래 */
            <RallyBanner surface="panel" phase={rallyPhase()} className="mt-3 md:mt-4" />
          ) : rallyPhase() !== "past" ? (
            /* 히어로 자리를 배너가 차지한다 */
            <RallyBanner surface="hero" phase={rallyPhase()} />
          ) : (
            /* 8/28 이 지났고 긴급 공지도 없다 → 배너는 보조 표면으로 최상단.
               히어로는 비어 있고, 아래 미니달력이 9/4 총파업을 `peak` 로 이어받는다 */
            <RallyBanner surface="panel" phase="past" />
          )}
          {deadlinePosts.length > 0 ? (
            <div className="mt-3 md:mt-4">
              <DeadlineStrip posts={deadlinePosts} />
            </div>
          ) : null}
          {/*
            미니달력 (§19.2.1) — 투쟁 일정은 온누리 가이드보다 상위 정보라 그 위에 온다.
            마감 스트립(게시물 마감)과는 담는 정보·표면·형태·시맨틱이 전부 다르다(§19.2.3).
            일정이 전부 지나면 감싸는 여백까지 통째로 사라진다 — 빈 32px 이 남으면 안 되므로
            컴포넌트의 null 반환에 맡기지 않고 여기서 렌더 여부를 판정한다.
            달력에는 전 일정을 넘긴다(격자는 지난 일정도 빈 칸으로 자리를 지킨다).
          */}
          {nextStruggleEvent() !== null ? (
            <div className="mt-8 md:mt-10">
              <StruggleCalendar events={STRUGGLE_SCHEDULE} size="mini" />
            </div>
          ) : null}
          {/*
            ★ **`RallyEntryCard` 는 삭제됐다**(§36.2 · 2026-08-21). 되살리지 마라.
            8/28 배너가 최상단으로 올라가면서 **같은 곳을 가리키는 진입점이 둘이 됐고**,
            사용자 판정이 *"삭제 — 히어로가 대신한다"* 였다.
            그 컴포넌트의 **표면 언어(테두리 단독 · 흰 면)는 `RallyBanner surface="panel"` 이
            승계**했고, `rallyPhase()` 상태 표시도 함께 옮겼다.
          */}
          <div className="mt-8 md:mt-10">
            <OnnuriGuideCard />
          </div>

          {/* ── 섹션 스택 (§16.7.2 간격표) ── */}
          <SectionNav className="mt-14 md:mt-18" />
          {HOME_SECTIONS.map((section, index) => (
            <HomeSection
              key={section.id}
              id={section.id}
              label={section.label}
              /* 첫 섹션은 바로가기 내비와 한 그룹(40/56px), 이후 섹션 간은 72/120px.
                 72/24 = 3.0배 · 120/28 = 4.3배 — "섹션 위 여백 ≥ 내부 여백 2배" 충족(§16.7.2) */
              className={
                index === 0 ? "mt-10 md:mt-14" : "mt-section md:mt-section-lg"
              }
            >
              {sectionContent[section.id]}
            </HomeSection>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
