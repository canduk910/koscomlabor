import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import type { PostDetailView } from "@/lib/postView";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { ArrowDownIcon, DocumentIcon, ExternalLinkIcon } from "@/components/ui/icons";

/**
 * 게시글 상세 본문 (공지사항·금융노조 소식·노동교육 공용) — 스펙 §16.12.
 * - 마크다운 원문을 react-markdown으로 변형 없이 렌더 (raw HTML 미실행 — XSS 안전).
 * - 본문 내 h1/h2는 문서 위계상 h2로 매핑 (페이지 h1은 게시물 제목).
 * - 링크형: 썸네일(있을 때) + "원문 보기" primary 필 버튼 — 3중 병행 유지
 *   (↗ 아이콘 + "외부 링크(새 창)" 문구 + 접근성 이름).
 * - 첨부 블록 (§16.12.3): "첨부파일" h2 + 파일당 L1 카드 1행(행 전체 다운로드 링크).
 * - 복귀 링크는 상단·하단 2개다(§16.12.1) — 같은 목적지·같은 이름의 링크 2개는 허용 패턴이며,
 *   긴 본문에서 상단 복귀 수단이 없던 문제를 해소한다. 문구는 기존 문자열 재사용(신규 카피 0).
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
  /* 인용 표지는 2px 파란 좌측 보더 1개(11.37) — 4px 회색 보더 대신. 본문 색은 ink(17.40)로
     올려 AAA 를 유지한다(§16.12.2). 표면 규칙상 인용의 분리 수단은 이 보더 하나뿐이다 */
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
      {/*
        본문 줄 길이는 컨테이너가 960px 로 넓어져도 prose 672px 를 넘지 않는다(§16.3.3).
        ⚠ `max-w-prose` 유틸리티를 쓰지 않는다: Tailwind v4 의 `max-w-prose` 는 **내장 정적
        유틸리티(65ch)** 이고 `--container-prose` 테마 변수로 덮이지 않는다. 실측 620px(≈34자)로
        스펙의 672px(37.3자)와 어긋나고 서체 메트릭에 따라 값이 흔들렸다(§16 이전부터의 결함).
        토큰을 직접 참조해 단일 출처를 유지한다.
      */}
      <div className="mx-auto max-w-[var(--container-prose)]">
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

        {/* ② 긴급 배지(조건부) → 제목 → 메타.
            제목 상단 여백: 배지가 있으면 mt-3(배지와의 근접), 없으면 복귀 링크와 같은 mt-4 */}
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

        {/* ③ 썸네일 — 링크형 + thumbnailUrl 있을 때만 (§16.10).
            목록과 달리 첫 화면 요소이므로 loading="eager". next/image 미사용 사유는 PostList 주석.
            헤어라인은 목록 카드와 동일 근거(디자이너 판정 2026-08-17). 상세는 4변 전체이고
            ring/inset 을 쓰면 안 되는 이유는 PostList.tsx 주석 참조 */}
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

        {/* ④ 원문 보기 — 링크형 상세의 1순위 행동이므로 필 버튼으로 격상(§16.12.1).
            문구·rel·아이콘은 변경 0. hover 에서 배경색을 바꾸지 않는다(새 파랑을 만들지 않기 위해) */}
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

        {/* ⑥ 첨부 (§16.12.3) — L1 카드 스택. "첨부파일" h2 는 회색 행 목록이 무엇인지
            문장으로 확정하는 UI 레이블이며 게시물 콘텐츠 문안이 아니다 */}
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
