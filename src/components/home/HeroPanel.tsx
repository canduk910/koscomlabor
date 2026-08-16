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
      {/* 장식 원형은 모드 1 전용 (§11.4 개정 — QA 9회차 디자이너 판정: 모드 2 록업과의 겹침 방지) */}
      {post !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -bottom-12 size-36 rounded-full bg-primary-bright"
        />
      ) : null}
      {post !== null ? (
        <div className="relative z-10">
          <p className="flex flex-wrap items-center gap-3">
            <UrgentBadge withIcon />
            <time dateTime={post.dateIso} className="text-caption text-primary-soft">
              {post.dateLabel}
            </time>
          </p>
          {/* §12.2: 히어로 제목 — Gmarket Sans Bold 700, 자간 -0.03em (hero 토큰의 800은 Bold로 대체) */}
          <h2 className="font-display mt-4 line-clamp-3 text-hero font-bold tracking-[-0.03em] text-white md:text-hero-lg">
            {post.title}
          </h2>
          <div aria-hidden="true" className="mt-4 h-1 w-16 bg-white" />
          <p className="mt-6">
            <Link
              href={ROUTES.notice(post.slug)}
              className="font-display inline-flex min-h-touch items-center gap-2 rounded-full bg-white px-6 text-body font-medium tracking-[-0.01em] text-primary hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              자세히 보기
              <ArrowRightIcon className="size-5" />
            </Link>
          </p>
        </div>
      ) : (
        <div className="relative z-10">
          {/* §11.4 6차 개정: 명칭 2줄 등폭 록업 (§13.5.2 방식·비율 1.183 — 두 줄 모두
              Gmarket Bold 700 / -0.02em / 행간 1.15 / #ffffff. 크기는 스펙 확정 계산값:
              모바일 30.8/26px, md+ 66.2/56px) */}
          <h2 className="flex flex-col">
            <span className="font-display text-[30.8px]/[1.15] font-bold tracking-[-0.02em] whitespace-nowrap text-white md:text-[66.2px]/[1.15]">
              전국금융산업노동조합
            </span>
            <span className="font-display text-[26px]/[1.15] font-bold tracking-[-0.02em] whitespace-nowrap text-white md:text-[3.5rem]/[1.15]">
              코스콤(한국증권전산)지부
            </span>
          </h2>
          <p className="mt-4 text-body font-normal text-primary-soft">
            코스콤 조합원을 위한 정보 공유
          </p>
        </div>
      )}
    </section>
  );
}
