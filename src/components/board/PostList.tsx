import Link from "next/link";
import type { ReactNode } from "react";
import type { PostCategory } from "@/lib/api/posts";
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
  /** 분류는 API 정본 타입 재사용 — 리터럴 재기술 금지 (§15.6R-H #4) */
  kind: PostCategory;
  status: PostListStatus;
}

/** 빈 상태 문구 (§6·§15.6R-B). Record<PostCategory> — 분류가 늘면 컴파일 에러로 누락이 잡힌다 */
const EMPTY_MESSAGES: Record<PostCategory, string> = {
  notice: "등록된 공지사항이 없습니다",
  news: "등록된 소식이 없습니다",
  education: "등록된 교육 자료가 없습니다",
};

/** 메타 행 공통 클래스 — 15px/400 #4b5563 (7.56 AAA). 말줄임 금지: flex-wrap 으로 흘려보낸다 */
const META_ROW_CLASS = "flex flex-wrap items-center gap-x-1 text-caption text-ink-muted";

interface MetaToken {
  key: string;
  node: ReactNode;
}

/** 값이 실제로 있는 문자열만 토큰이 된다 (§15.6R-D 판정 4 — 빈 값에서 구분점이 새지 않게) */
function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

/**
 * 메타 토큰 나열 (§15.6R-D 판정 4 — 빈 토큰 안전 규칙).
 * - 구분점 `·` 은 **선행 토큰이 1개 이상일 때만** 렌더 → `· ·`·행 선두 `·`·행 말미 `·` 가
 *   어떤 조합에서도 발생하지 않는다. (토큰마다 앞에 구분점을 붙이는 방식은 조건이 늘수록 누락이 생긴다)
 * - 구분점을 **뒤따르는 토큰과 같은 nowrap 래퍼**(inline-flex)에 두어, 줄바꿈이 그 사이에서
 *   일어나 `·` 만 행 끝에 매달리는 것을 막는다.
 * - 구분점은 `aria-hidden` — 스크린리더에는 토큰 텍스트만 전달된다.
 */
function MetaTokens({ tokens }: { tokens: readonly MetaToken[] }) {
  return (
    <>
      {tokens.map((token, index) => (
        <span key={token.key} className="inline-flex items-center gap-x-1">
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          {token.node}
        </span>
      ))}
    </>
  );
}

/**
 * 게시글 목록 (스펙 §16.9.3 + §16.10 썸네일) — DB(API) 데이터 기반.
 * 공지사항·금융노조 소식·노동교육이 **완전히 같은 목록 언어**를 공유한다 (§15.5 — 분류별
 * 시각 규칙 0건). 조합원은 목록 읽는 법을 한 번만 배운다.
 *
 * - 작성형: 카드 전체가 상세 링크 (`ROUTES.post` 분류 매핑 — 삼항 분기 금지 §15.6R-G)
 * - 링크형: 카드 전체가 외부 링크(새 창) — 3중 병행: ↗ 아이콘(16px) + 메타 2행의
 *   "외부 링크(새 창) · 도메인" + 접근성 이름(메타가 <a> 내부 텍스트라 자동 포함)
 * - 메타 블록 2행 (§15.6R-D — **§16 에서 변경 0. 삭제 금지**):
 *     1행  [D-n(모바일)] {게시일} · {출처/채널명} · {첨부 n}   ← 항상
 *     2행  외부 링크(새 창) · {도메인}                        ← 링크형일 때만
 *   `source`(채널명)를 **링크형에도 렌더한다** — 링크형에서 채널명이 사라지면 fact-verifier
 *   게이트의 필수 완화 조치("금융노조 제작물이 아님을 카드 표면에서 구분")가 무력화된다.
 *   규칙의 키는 `category` 가 아니라 `type` 이다(분류 무관 — 판정 3).
 * - 작성형 카드는 2행이 렌더되지 않아 현행과 동일하다(회귀 0).
 * - 첨부: 문서 아이콘 16px + "첨부 n" (존재 표시만 — 파일명은 상세)
 * - 정렬(urgent 우선 → sort_order → 게시일 내림차순)은 서버(API)가 보장한다.
 *
 * ## 썸네일 슬롯 (§16.10) — 혼재 처리의 핵심
 * - 렌더 조건은 **`thumbnailUrl !== null` 뿐**이다. `category` 로 분기하지 않고
 *   **플레이스홀더도 만들지 않는다**(§16.10.2 — 없는 것을 만들지 않는다).
 * - **md+ 에서 썸네일은 우측**(`md:order-2`)이다. 이래야 썸네일이 있는 카드와 없는 카드의
 *   **제목 좌측 x좌표가 동일**해 세로 스캔이 끊기지 않는다. 좌측 배치로 바꾸지 말 것 —
 *   md+ 에서 제목 시작점이 216px 어긋나고 360px 에서는 제목 열이 164px 로 줄어든다.
 * - 모바일은 카드 상단 풀블리드(텍스트 열 288px 유지 → 메타 2행 검산 그대로 유효).
 * - 카드 프레임(radius·그림자·패딩·타이포·hover·focus)은 썸네일 유무와 무관하게 **하나**다.
 *
 * ## 표면·모션 (§16.5·§16.6) — 되살리지 말 것
 * - urgent 카드의 좌측 4px `border-urgent` 바 **폐기**: 그림자+배경+테두리 3중 위반이었고,
 *   긴급의 강조 면은 히어로가 담당한다. 표지는 "긴급" 배지(색+아이콘+레이블 3중 병행)다.
 * - L1 카드 = 흰 배경 + `shadow-card` **단독**. 테두리를 추가하지 말 것.
 * - hover 는 `box-shadow`·`transform`(2px)·색만. `motion-safe:` 한정이라 "동작 줄이기"에서
 *   상승·확대가 일어나지 않는다.
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
    <ul className="flex flex-col gap-3 md:gap-4">
      {posts.map((post) => {
        const days = post.deadline !== null ? daysUntilKst(post.deadline) : null;
        const hasDeadline = days !== null && days >= 0;
        const imminent = hasDeadline && days <= 7;
        const isExternal = post.type === "link" && post.url !== null;

        // 1행 "언제 · 누가" — 게시일은 항상 존재하므로 최소 1토큰이 보장된다
        const primaryTokens: MetaToken[] = [
          {
            key: "date",
            node: <time dateTime={post.publishedAt}>{post.dateLabel}</time>,
          },
        ];
        if (hasText(post.source)) {
          primaryTokens.push({ key: "source", node: post.source });
        }
        if (post.attachmentCount > 0) {
          primaryTokens.push({
            key: "attachment",
            node: (
              <span className="inline-flex items-center gap-1">
                <DocumentIcon className="size-4" />
                첨부 {post.attachmentCount}
              </span>
            ),
          });
        }

        // 2행 "어떻게 · 어디로" — 링크형 전용
        const linkTokens: MetaToken[] = [];
        if (isExternal) {
          linkTokens.push({ key: "external", node: "외부 링크(새 창)" });
          if (hasText(post.domain)) {
            linkTokens.push({ key: "domain", node: post.domain });
          }
        }

        const cardContent = (
          <>
            {/* ① 썸네일 — thumbnailUrl 이 있을 때만 (§16.10.2). 플레이스홀더 금지.
                헤어라인(border-border-soft = 1.24:1 장식 구분선, 신규 색 0건 — 디자이너 판정
                2026-08-17): 흰 배경 썸네일이 흰 카드 위에서 경계를 잃는다. 실측으로
                `-WrzgLtvuPU` 는 둘레가 #ffffff 100%(대비 1.00:1), `ATbGKR-Agmk` 는 둘레의
                47%가 1.5:1 미만이었다. 흰 배경은 노조·교육 인포그래픽의 표준 관행이라 반복된다.
                ⚠ ring / inset box-shadow 로 바꾸지 마라 — inset 은 자손보다 아래에 그려져
                박스를 꽉 채우는 자식 img 가 완전히 덮는다(구현해도 화면 변화 0).
                border 만 콘텐츠 박스 밖에 그려져 살아남는다.
                모바일 `border-b` 1변인 이유: 상단 풀블리드라 좌·우·상 3변이 카드 자신의
                경계와 겹치고, 거기 테두리를 두르면 같은 선에 그림자+테두리 이중 신호가 생겨
                §16.5 가 막으려는 상태가 된다. md+ 는 흰 패딩에 둘러싸여 떠 있으므로 4변 */}
            {post.thumbnailUrl !== null ? (
              <span className="bg-surface block aspect-video w-full overflow-hidden border-b border-border-soft md:order-2 md:w-48 md:shrink-0 md:rounded-badge md:border">
                {/*
                  next/image 를 쓰지 않는 이유 (§16.10.4): ① 소스가 API 호스트(환경변수)라
                  images.remotePatterns 를 환경마다 설정해야 한다 ② 이미 최적 크기(192/328px
                  표시에 320~1280px 소스)이고 서버가 Cache-Control: immutable 로 내려준다
                  ③ 최적화 프록시를 한 단 더 두면 실패 지점이 늘어난다.
                  래퍼 aspect-video + width/height 동시 지정으로 CLS 0.
                  실패(404·타임아웃) 시 래퍼의 bg-surface 회색 박스만 남는다 — alt="" 이므로
                  대체 텍스트·깨진 아이콘이 노출되지 않고, onError 핸들러도 두지 않는다
                  (서버 컴포넌트를 유지한다 — "use client" 를 부르지 않는다).
                  alt="" : 제목이 바로 인접해 있으므로 썸네일은 장식이다(§0.5).
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="ease-out-soft h-full w-full object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.03]"
                />
              </span>
            ) : null}

            {/* ② 텍스트 블록 — md+ 는 좌측(order-1). 패딩은 모바일만(이미지가 풀블리드) */}
            <span className="block p-5 md:order-1 md:min-w-0 md:flex-1 md:p-0">
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
                    <span className="line-clamp-2 text-body font-semibold text-ink group-hover:text-primary-strong group-hover:underline md:text-lead">
                      {post.title}
                      {isExternal ? (
                        <ExternalLinkIcon className="ml-1 inline size-4 align-[-2px]" />
                      ) : null}
                    </span>
                  </span>
                  <span className={`mt-2 ${META_ROW_CLASS}`}>
                    {/* D-n(모바일 전용 — md+ 는 DateBadge 가 담당)은 구분점 없이 행 선두에 온다.
                        구분점을 넣으면 md+ 에서 D-n 이 숨겨져 행이 `·` 로 시작한다 (판정 4 위반) */}
                    {hasDeadline ? (
                      <span
                        className={`font-display font-medium md:hidden ${
                          imminent ? "text-urgent-strong" : "text-primary"
                        }`}
                      >
                        D-{days}
                      </span>
                    ) : null}
                    <MetaTokens tokens={primaryTokens} />
                  </span>
                  {linkTokens.length > 0 ? (
                    <span className={META_ROW_CLASS}>
                      <MetaTokens tokens={linkTokens} />
                    </span>
                  ) : null}
                </span>
              </span>
            </span>
          </>
        );

        const linkClass =
          "group block focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-[-3px] md:flex md:items-start md:gap-6 md:p-6";

        return (
          <li
            key={post.id}
            /* overflow-hidden 필수: 모바일 풀블리드 썸네일의 상단 모서리를 카드 radius 로
               클립하고 hover 확대분(1.03)을 가둔다 */
            className="rounded-card bg-bg shadow-card hover:shadow-card-hover ease-out-soft overflow-hidden transition-[box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5"
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
              <Link href={ROUTES.post(post.category, post.id)} className={linkClass}>
                {cardContent}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
