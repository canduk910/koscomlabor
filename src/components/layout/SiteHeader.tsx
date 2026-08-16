import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * 헤더 — 텍스트 로고 2행 전체가 홈 링크 1개 (스펙 §3.1).
 * CI 미확보 상태이므로 로고 이미지는 넣지 않는다 (추측 CI 금지).
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
            className="inline-flex min-h-touch flex-col justify-center focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span className="text-caption font-normal text-ink-muted">
              전국금융산업노동조합
            </span>
            <span className="text-h2 font-bold text-ink md:text-h1">
              코스콤지부
            </span>
          </Link>
        </LogoTag>
      </div>
    </header>
  );
}
