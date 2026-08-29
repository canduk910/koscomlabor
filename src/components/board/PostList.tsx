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

/** 빈 상태 문구. Record<PostCategory> — 분류가 늘면 컴파일 에러로 누락이 잡힌다 */
const EMPTY_MESSAGES: Record<PostCategory, string> = {
  notice: "등록된 공지사항이 없습니다",
  news: "등록된 소식이 없습니다",
  education: "등록된 교육 자료가 없습니다",
};

/** 메타 행 공통 클래스 — ⚠ 말줄임을 쓰지 마라. flex-wrap 으로 흘려보낸다 */
const META_ROW_CLASS = "flex flex-wrap items-center gap-x-1 text-caption text-ink-muted";

interface MetaToken {
  key: string;
  node: ReactNode;
}

/** 값이 실제로 있는 문자열만 토큰이 된다 — 빈 값에서 구분점이 새지 않게 */
function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

/**
 * 메타 토큰 나열 — 구분점은 선행 토큰이 있을 때만 렌더하고, 뒤 토큰과 같은 nowrap 래퍼에 둔다.
 * ⚠ 토큰마다 앞에 붙이는 방식으로 바꾸지 마라 — 조건이 늘수록 빈 구분점이 샌다(§15.6R-D 판정 4).
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
 * 게시글 목록 (§16.9.3 · §16.10) — 세 분류가 같은 목록 언어를 공유한다(분류별 시각 규칙 0건).
 * 메타 1행 = [D-n] 게시일 · 출처 · 첨부 n / 2행 = 외부 링크(새 창) · 도메인(링크형만). 정렬은 서버 소관.
 *
 * ⚠ 링크형에서 source(채널명)를 빼지 마라 — "금융노조 제작물이 아님을 카드 표면에서 구분"이라는
 *   fact-verifier 게이트의 필수 완화 조치가 무력화된다. 키는 category 가 아니라 type 이다.
 * ⚠ 썸네일을 category 로 분기하거나 플레이스홀더를 만들지 마라. md+ 우측 배치를 좌측으로 옮기지도 마라
 *   — 썸네일 유무에 따라 제목 좌측 x 가 어긋나 세로 스캔이 끊긴다.
 * ⚠ urgent 좌측 4px 빨간 바와 카드 테두리를 되살리지 마라 — 3중 표면 위반이고, 긴급의 강조 면은 히어로다.
 * 근거·실측: `_workspace/02_designer_spec.md` §16.10.2 · §16.5 · §15.6R-D
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
            {/* ① 썸네일 — 헤어라인은 흰 배경 썸네일이 흰 카드 위에서 경계를 잃는 것을 막는다(§16.5 예외).
                모바일이 하단 1변인 것은 나머지 3변이 카드 경계와 겹쳐 이중 신호가 되기 때문이다.
                ⚠ ring / inset box-shadow 로 바꾸지 마라(§16.5) — inset 은 자식 img 가 덮어 화면이 안 바뀐다 */}
            {post.thumbnailUrl !== null ? (
              <span className="bg-surface block aspect-video w-full overflow-hidden border-b border-border-soft md:order-2 md:w-48 md:shrink-0 md:rounded-badge md:border">
                {/* next/image 를 쓰지 않는다(§16.10.4 — 소스가 환경변수 API 호스트이고 이미 최적 크기다).
                    래퍼 aspect-video + width/height 로 CLS 0. alt="" : 제목이 인접하므로 장식이다.
                    ⚠ onError 핸들러를 달지 마라 — 서버 컴포넌트를 유지해야 한다 */}
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

            {/* ② 텍스트 블록 — 패딩은 모바일만 진다(모바일 썸네일이 풀블리드라 카드에 여백이 없다) */}
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
                    {/* D-n(모바일 전용)은 구분점 없이 행 선두에 온다 — 넣으면 md+ 에서 D-n 이
                        숨겨져 행이 구분점으로 시작한다 */}
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
            /* overflow-hidden 필수 — 풀블리드 썸네일 모서리를 카드 radius 로 클립하고 hover 확대분을 가둔다 */
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
