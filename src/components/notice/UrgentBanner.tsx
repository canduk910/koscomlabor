import Link from "next/link";
import type { PostSummary } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { WarningIcon } from "@/components/ui/icons";

/**
 * 긴급 공지 배너 (스펙 §3.2) — verified 공지 중 urgent 최신 1건이 있을 때만 렌더.
 * 색+아이콘+"긴급" 배지 3중 병행 (색 단독 의미 전달 금지).
 */
export function UrgentBanner({ post }: { post: PostSummary }) {
  return (
    <section
      role="region"
      aria-label="긴급 공지"
      className="border-l-4 border-urgent bg-urgent-tint py-4"
    >
      <div className="mx-auto w-full max-w-page px-4 md:px-6">
        <div className="flex items-center gap-2">
          <WarningIcon className="size-5 shrink-0 text-urgent-strong" />
          <UrgentBadge />
        </div>
        <Link
          href={ROUTES.notice(post.slug)}
          className="mt-1 inline-flex min-h-touch items-center text-body font-bold text-ink underline focus-visible:outline-3 focus-visible:outline-urgent-strong focus-visible:outline-offset-2"
        >
          {post.title}
        </Link>
        <p className="text-caption text-urgent-strong">
          <time dateTime={post.dateIso}>{post.dateLabel}</time>
        </p>
      </div>
    </section>
  );
}
