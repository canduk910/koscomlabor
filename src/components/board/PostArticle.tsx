import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import type { PostDetailView } from "@/lib/postView";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { DocumentIcon, ExternalLinkIcon } from "@/components/ui/icons";

/**
 * 게시글 상세 본문 (공지사항·금융노조 소식 공용) — DB(API) 데이터 기반.
 * - 마크다운 원문을 react-markdown으로 변형 없이 렌더 (raw HTML 미실행 — XSS 안전).
 * - 본문 내 h1/h2는 문서 위계상 h2로 매핑 (페이지 h1은 게시물 제목).
 * - 링크형: 본문 위에 외부 원문 링크 행 (3중 병행 — ↗ 아이콘 + "새 창" 문구 + 접근성 이름).
 * - 첨부 블록 (스펙 §14.1): 본문 아래 2rem, 파일당 1행 카드(행 전체 다운로드 링크).
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
  post: PostDetailView;
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
          <time dateTime={post.publishedAt}>{post.dateLabel}</time>
          {post.source !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.source}</span>
            </>
          ) : null}
        </p>

        {post.type === "link" && post.url !== null ? (
          <p className="mt-6">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-touch items-center gap-2 text-body font-semibold text-primary-strong underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              원문 보기 — 외부 링크(새 창)
              {post.domain !== null ? ` · ${post.domain}` : ""}
              <ExternalLinkIcon className="size-5 shrink-0" />
            </a>
          </p>
        ) : null}

        {post.body !== null ? (
          <div className="mt-8">
            <Markdown components={markdownComponents}>{post.body}</Markdown>
          </div>
        ) : null}

        {post.attachments.length > 0 ? (
          <ul className="mt-8 flex flex-col gap-2">
            {post.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={attachment.href}
                  className="rounded-badge group flex min-h-touch items-center gap-3 bg-surface px-4 py-3 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  <DocumentIcon className="size-5 shrink-0 text-border-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption font-semibold text-ink group-hover:text-primary group-hover:underline">
                      {attachment.filename}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {attachment.sizeLabel}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-caption text-border-strong">
                    ↓
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}

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
