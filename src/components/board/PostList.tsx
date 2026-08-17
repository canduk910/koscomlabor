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
 * 게시글 목록 (스펙 §5 + v2 카드화 §11.6 + 링크형·첨부 §14.1) — DB(API) 데이터 기반.
 * 공지사항·금융노조 소식·노동교육이 **완전히 같은 목록 언어**를 공유한다 (§15.5 — 분류별
 * 시각 규칙 0건). 조합원은 목록 읽는 법을 한 번만 배운다.
 *
 * - 작성형: 카드 전체가 상세 링크 (`ROUTES.post` 분류 매핑 — 삼항 분기 금지 §15.6R-G)
 * - 링크형: 카드 전체가 외부 링크(새 창) — 3중 병행: ↗ 아이콘(16px) + 메타 2행의
 *   "외부 링크(새 창) · 도메인" + 접근성 이름(메타가 <a> 내부 텍스트라 자동 포함)
 * - 메타 블록 2행 (§15.6R-D):
 *     1행  [D-n(모바일)] {게시일} · {출처/채널명} · {첨부 n}   ← 항상
 *     2행  외부 링크(새 창) · {도메인}                        ← 링크형일 때만
 *   `source`(채널명)를 **링크형에도 렌더한다** — 링크형에서 채널명이 사라지면 fact-verifier
 *   게이트의 필수 완화 조치("금융노조 제작물이 아님을 카드 표면에서 구분")가 무력화된다.
 *   규칙의 키는 `category` 가 아니라 `type` 이다(분류 무관 — 판정 3).
 * - 작성형 카드는 2행이 렌더되지 않아 현행과 동일하다(회귀 0).
 * - 첨부: 문서 아이콘 16px + "첨부 n" (존재 표시만 — 파일명은 상세)
 * - 정렬(urgent 우선 → 게시일 내림차순)은 서버(API)가 보장한다.
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
    <ul className="flex flex-col gap-3">
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
                  {isExternal ? (
                    <ExternalLinkIcon className="ml-1 inline size-4 align-[-2px]" />
                  ) : null}
                </span>
              </span>
              <span className={`mt-1.5 ${META_ROW_CLASS}`}>
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
        );

        const linkClass =
          "group block px-5 py-4 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-[-3px]";

        return (
          <li
            key={post.id}
            className={`shadow-card hover:shadow-card-hover rounded-2xl bg-bg transition-shadow ${
              post.urgent ? "border-l-4 border-urgent" : ""
            }`}
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
