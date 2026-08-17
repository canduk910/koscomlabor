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
import { SectionNav } from "@/components/home/SectionNav";
import { HomeSection } from "@/components/home/HomeSection";

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
        <div className="mx-auto mt-6 w-full max-w-page px-4 md:px-6">
          {/* ── 도입 블록 (§15.2 — 현행 유지) ── */}
          <HeroPanel post={urgentNotice} />
          {deadlinePosts.length > 0 ? (
            <div className="mt-3">
              <DeadlineStrip posts={deadlinePosts} />
            </div>
          ) : null}
          <div className="mt-8">
            <OnnuriGuideCard />
          </div>

          {/* ── 섹션 스택 (§15.2 간격표) ── */}
          <SectionNav className="mt-12" />
          {HOME_SECTIONS.map((section, index) => (
            <HomeSection
              key={section.id}
              id={section.id}
              label={section.label}
              /* 첫 섹션은 바로가기 내비와 한 그룹(32/40px), 이후 섹션 간 구분은 64/80px */
              className={index === 0 ? "mt-8 md:mt-10" : "mt-16 md:mt-20"}
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
