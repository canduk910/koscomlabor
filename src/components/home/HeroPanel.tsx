import Link from "next/link";
import type { PostSummary } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * 히어로 패널 (스펙 §11.4 — §3.2 긴급 배너 대체).
 * - 모드 1: verified+urgent 최신 1건 바인딩 (배지+게시일 / hero 제목 / 흰 액센트 바 / CTA)
 * - 모드 2: 폴백 (urgent 0건) — 스펙 §11.4 지정 문구 그대로. 레퍼런스 홍보물의
 *   투쟁 문구·일정은 미검증 콘텐츠이므로 어떤 형태로도 복사 금지 (§11.1).
 * - 우하단 장식 원형(--color-primary-bright)은 aria-hidden 장식 — 텍스트 겹침 금지 규정에
 *   따라 코너 밖으로 3/4을 내보내고 콘텐츠(z-10) 아래에 둔다.
 * - 제목은 h2 (페이지 h1은 헤더 지부명 유지 — §11.4 마크업 규정).
 */
export function HeroPanel({ post }: { post: PostSummary | null }) {
  return (
    <section
      aria-label="주요 소식"
      className="rounded-card bg-primary shadow-card relative overflow-hidden p-6 md:rounded-panel md:p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -bottom-12 size-36 rounded-full bg-primary-bright"
      />
      {post !== null ? (
        <div className="relative z-10">
          <p className="flex flex-wrap items-center gap-3">
            <UrgentBadge withIcon />
            <time dateTime={post.dateIso} className="text-caption text-primary-soft">
              {post.dateLabel}
            </time>
          </p>
          <h2 className="mt-4 line-clamp-3 text-hero text-white md:text-hero-lg">
            {post.title}
          </h2>
          <div aria-hidden="true" className="mt-4 h-1 w-16 bg-white" />
          <p className="mt-6">
            <Link
              href={ROUTES.notice(post.slug)}
              className="inline-flex min-h-touch items-center gap-2 rounded-full bg-white px-6 text-body font-bold text-primary hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              자세히 보기
              <ArrowRightIcon className="size-5" />
            </Link>
          </p>
        </div>
      ) : (
        <div className="relative z-10">
          <p className="text-caption font-semibold text-primary-soft">
            전국금융산업노동조합
          </p>
          <h2 className="mt-2 text-hero text-white md:text-hero-lg">코스콤지부</h2>
          <p className="mt-4 text-body font-normal text-primary-soft">
            코스콤 조합원을 위한 공식 소식 공간
          </p>
        </div>
      )}
    </section>
  );
}
