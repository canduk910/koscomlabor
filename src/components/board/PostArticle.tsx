import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import type { PostDetail } from "@/lib/content";
import { UrgentBadge } from "@/components/ui/UrgentBadge";

/**
 * 게시글 상세 본문 (공지사항·금융노조 소식 공용).
 * - 마크다운 원문을 react-markdown으로 변형 없이 렌더 (형식 변환만 — 스킬 §3).
 *   기본 설정상 원문 내 raw HTML은 실행되지 않고 텍스트로 표시된다 (XSS 안전).
 * - 본문 내 h1/h2는 문서 위계상 h2로 매핑 (페이지 h1은 게시물 제목).
 * - 타이포·색은 전부 디자인 토큰 유틸리티만 사용.
 */
const markdownComponents: Components = {
  h1: ({ children }) => <h2 className="mt-8 text-h2 text-ink">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-8 text-h2 text-ink">{children}</h2>,
  h3: ({ children }) => (
    <h3 className="mt-6 text-body font-bold text-ink">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-4 text-body text-ink">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary-strong underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 list-disc pl-6 text-body text-ink">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal pl-6 text-body text-ink">{children}</ol>
  ),
  li: ({ children }) => <li className="mt-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-border-strong pl-4 text-ink-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="mt-8 border-border-soft" />,
};

interface PostArticleProps {
  post: PostDetail;
  /** 목록(해당 탭)으로 돌아가는 링크 */
  backHref: string;
}

export function PostArticle({ post, backHref }: PostArticleProps) {
  return (
    <article className="mx-auto mt-8 w-full max-w-page px-4 md:px-6">
      <div className="mx-auto max-w-prose">
        {post.urgent ? (
          <p className="mb-2">
            <UrgentBadge withIcon />
          </p>
        ) : null}
        <h1 className="text-h2 font-bold text-ink md:text-h1">{post.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
          <time dateTime={post.dateIso}>{post.dateLabel}</time>
          {post.source !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.source}</span>
            </>
          ) : null}
        </p>

        <div className="mt-8">
          <Markdown components={markdownComponents}>{post.body}</Markdown>
        </div>

        <p className="mt-12">
          <Link
            href={backHref}
            className="inline-flex min-h-touch items-center text-body text-primary-strong underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">←&nbsp;</span>목록으로 돌아가기
          </Link>
        </p>
      </div>
    </article>
  );
}
