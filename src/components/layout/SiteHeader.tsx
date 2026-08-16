import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * 헤더 — KFIU 깃발 마크 + 지부명 2행, 전체가 홈 링크 1개 (스펙 §3.1, 2026-08-16 CI 개정).
 * - 마크: /brand/kfiu-mark.png (자산 스펙 §10.3, 원본비 1.284:1), 높이 모바일 40px / md+ 48px,
 *   텍스트와 gap 0.75rem. 헤더 배경 #ffffff — 흰 배경 JPG 유래 자산 배치 조건 충족.
 * - alt="" + aria-hidden: 인접 지부명 텍스트가 의미를 전달하므로 장식 처리.
 *
 * asHeading: 메인페이지에서는 로고가 페이지 h1이지만, 상세 페이지에서는
 * 게시물 제목이 h1이므로 false를 넘겨 <p>로 렌더한다 (h1 중복·위계 역전 방지).
 */
export function SiteHeader({ asHeading = true }: { asHeading?: boolean }) {
  const LogoTag = asHeading ? "h1" : "p";
  return (
    <header className="border-b border-border-soft bg-bg py-3 md:py-4">
      <div className="mx-auto w-full max-w-page px-4 md:px-6">
        <LogoTag>
          <Link
            href={ROUTES.home}
            className="inline-flex min-h-touch items-center gap-3 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <Image
              src="/brand/kfiu-mark.png"
              alt=""
              aria-hidden="true"
              width={247}
              height={192}
              priority
              className="h-10 w-auto md:h-12"
            />
            <span className="flex flex-col justify-center">
              <span className="text-caption font-normal text-ink-muted">
                전국금융산업노동조합
              </span>
              <span className="text-h2 font-bold text-ink md:text-h1">
                코스콤지부
              </span>
            </span>
          </Link>
        </LogoTag>
      </div>
    </header>
  );
}
