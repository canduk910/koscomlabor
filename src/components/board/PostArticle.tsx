import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import type { PostDetailView } from "@/lib/postView";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { ArrowDownIcon, DocumentIcon, ExternalLinkIcon } from "@/components/ui/icons";

/**
 * 게시글 상세 본문 (세 분류 공용) — §16.12.
 * 마크다운 원문을 react-markdown 으로 변형 없이 렌더한다(raw HTML 미실행 — XSS 안전).
 * 본문 안 h1/h2 는 h2 로 매핑한다 — 페이지 h1 은 게시물 제목이다.
 * 복귀 링크가 상단·하단 2개인 것은 의도다(§16.12.1) — 긴 본문에서 상단 복귀 수단이 없었다.
 */
const markdownComponents: Components = {
  h1: ({ children }) => <h2 className="mt-10 text-h2 text-ink">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-10 text-h2 text-ink">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-8 text-lead text-ink">{children}</h3>,
  p: ({ children }) => <p className="mt-5 text-body text-ink">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary-strong underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mt-5 list-disc pl-6 text-body text-ink">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-5 list-decimal pl-6 text-body text-ink">{children}</ol>
  ),
  li: ({ children }) => <li className="mt-2">{children}</li>,
  /* 인용의 분리 수단은 좌측 보더 하나뿐이다 — 표면 규칙상 다른 표지를 더하지 마라(§16.12.2) */
  blockquote: ({ children }) => (
    <blockquote className="mt-6 border-l-2 border-primary pl-5 text-ink">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="mt-10 border-border-soft" />,
};

/** 상단·하단 공통 복귀 링크 문구 — 두 곳에 문자열을 적지 않는다 */
const BACK_LABEL = "목록으로 돌아가기";

interface PostArticleProps {
  post: PostDetailView;
  /** 목록(해당 섹션)으로 돌아가는 링크 */
  backHref: string;
}

export function PostArticle({ post, backHref }: PostArticleProps) {
  return (
    <article className="mx-auto mt-8 w-full max-w-page px-4 md:mt-14 md:px-8">
      {/* ⚠ `max-w-prose` 유틸리티를 쓰지 마라 — Tailwind v4 의 내장 정적 유틸리티(65ch)라
            `--container-prose` 테마 변수로 덮이지 않고 서체 메트릭에 따라 값이 흔들린다.
            토큰을 직접 참조해 단일 출처를 유지한다(§16.3.3). */}
      {/* ★★ `break-keep break-words` 는 여기 «한 곳»에만 건다 — 상속 속성이라 이 래퍼 하나가
            제목·본문·링크·목록·인용을 전부 덮는다. ⚠ 렌더러마다 나눠 붙이지 마라(한 곳만 빠진다).
            제목·본문이 관리자가 쓰는 임의 문자열이라 필요하다(처방 근거: union-design-system §0.8).
            첨부 파일명의 `truncate` 는 영향받지 않는다 — nowrap 이 이긴다. 그것이 그 자리의 설계다.
          ⚠ **런타임 미검증이다** — 상세로 가는 게시물이 0건이라 못 쟀다. 첫 게시물이 올라오면
            200% 게이트를 한 번 돌려라(`_workspace/FOLLOWUPS.md` #22) */}
      <div className="mx-auto max-w-[var(--container-prose)] break-keep break-words">
        {/* ① 상단 복귀 링크 (§16.12.1 신규) */}
        <p>
          <Link
            href={backHref}
            className="inline-flex min-h-touch items-center text-caption font-semibold text-primary hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">←&nbsp;</span>
            {BACK_LABEL}
          </Link>
        </p>

        {/* ② 긴급 배지(조건부) → 제목 → 메타. 제목 상단 여백은 배지가 있으면 좁힌다(근접) */}
        {post.urgent ? (
          <p className="mt-4">
            <UrgentBadge withIcon />
          </p>
        ) : null}
        <h1
          className={`text-title text-ink md:text-display ${post.urgent ? "mt-3" : "mt-4"}`}
        >
          {post.title}
        </h1>
        <p className="mt-4 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
          <time dateTime={post.publishedAt}>{post.dateLabel}</time>
          {post.source !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.source}</span>
            </>
          ) : null}
        </p>

        {/* ③ 썸네일 — 링크형 + thumbnailUrl 있을 때만. 목록과 달리 첫 화면 요소라 eager 로 받는다.
            next/image 미사용·헤어라인·ring/inset 금지 사유는 `PostList.tsx` 주석 참조 */}
        {post.type === "link" && post.thumbnailUrl !== null ? (
          <span className="rounded-panel bg-surface mt-8 block aspect-video w-full overflow-hidden border border-border-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.thumbnailUrl}
              alt=""
              width={1280}
              height={720}
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </span>
        ) : null}

        {/* ④ 원문 보기 — 링크형 상세의 1순위 행동이라 필 버튼이다(§16.12.1).
            ⚠ hover 에서 배경색을 바꾸지 마라 — 새 파랑을 만들게 된다 */}
        {post.type === "link" && post.url !== null ? (
          <p className="mt-6">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full bg-primary px-7 text-body font-bold text-white transition-transform duration-200 hover:outline-2 hover:outline-primary hover:outline-offset-2 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5"
            >
              원문 보기 — 외부 링크(새 창)
              {post.domain !== null ? ` · ${post.domain}` : ""}
              <ExternalLinkIcon className="size-5 shrink-0" />
            </a>
          </p>
        ) : null}

        {/* ⑤ 본문 */}
        {post.body !== null ? (
          <div className="mt-8 md:mt-10">
            <Markdown components={markdownComponents}>{post.body}</Markdown>
          </div>
        ) : null}

        {/* ⑥ 첨부 (§16.12.3) — "첨부파일" h2 는 UI 레이블이지 게시물 콘텐츠 문안이 아니다 */}
        {post.attachments.length > 0 ? (
          <>
            <h2 className="mt-12 text-h2 text-ink">첨부파일</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {post.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a
                    href={attachment.href}
                    className="rounded-card bg-bg shadow-card hover:shadow-card-hover ease-out-soft group flex min-h-touch items-center gap-4 px-5 py-4 transition-[box-shadow,transform] duration-200 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-[-3px] motion-safe:hover:-translate-y-0.5"
                  >
                    <DocumentIcon className="size-5 shrink-0 text-border-strong" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink group-hover:text-primary group-hover:underline">
                        {attachment.filename}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {attachment.sizeLabel}
                      </span>
                    </span>
                    {/* 텍스트 화살표(↓)는 서체마다 위치·크기가 튀므로 아이콘으로 교체 */}
                    <ArrowDownIcon className="size-5 shrink-0 text-border-strong" />
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/* ⑦ 하단 복귀 링크 */}
        <p className="mt-12">
          <Link
            href={backHref}
            className="inline-flex min-h-touch items-center text-body text-primary-strong underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">←&nbsp;</span>
            {BACK_LABEL}
          </Link>
        </p>
      </div>
    </article>
  );
}
