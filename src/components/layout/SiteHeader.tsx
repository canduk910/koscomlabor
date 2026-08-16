import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * 헤더 v3 — 자수 아이덴티티 네이비 밴드 (스펙 §13, §3.1·§11.6 헤더 규정 대체).
 * - 풀폭 네이비 밴드: bg-primary(#093389 — 자수 네이비는 KFIU 파랑의 직물 표현으로
 *   해석, 신규 색 0건). 하단 보더 제거(밴드 자체가 경계).
 * - 좌측 KFIU 마크: 기존 자산 그대로 radius 8px — 흰 배경 사각이 자수의
 *   "흰 사각 + 깃발" 원형을 재현하며 §10.3 흰 배경 규정 충족.
 * - 우측 흰색 2줄(자수 원문): "전국금융산업노동조합" 15px/600 Pretendard,
 *   "코스콤(한국증권전산)지부" Gmarket Bold 700/-0.02em, 모바일 20px(스케일 밖
 *   커스텀 — 13자 명칭의 375px 수용 계산은 §13.2) / md+ 32px, 줄바꿈 금지.
 * - focus-visible 흰 링 3px(네이비 위 기존 파랑 링 시인 불가 — §13.3 연쇄 영향).
 *
 * asHeading: 메인페이지에서는 로고가 페이지 h1, 상세 페이지에서는 게시물 제목이
 * h1이므로 false를 넘겨 <p>로 렌더한다 (h1 중복·위계 역전 방지).
 */
export function SiteHeader({ asHeading = true }: { asHeading?: boolean }) {
  const LogoTag = asHeading ? "h1" : "p";
  return (
    <header className="bg-primary py-3 md:py-4">
      <div className="mx-auto w-full max-w-page px-4 md:px-6">
        <LogoTag>
          <Link
            href={ROUTES.home}
            className="inline-flex min-h-touch items-center gap-3 focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            <Image
              src="/brand/kfiu-mark.png"
              alt=""
              aria-hidden="true"
              width={247}
              height={192}
              priority
              className="h-10 w-auto rounded-lg md:h-12"
            />
            <span className="flex flex-col justify-center">
              <span className="text-caption font-semibold text-white">
                전국금융산업노동조합
              </span>
              <span className="font-display text-[1.25rem]/[1.3] font-bold tracking-[-0.02em] whitespace-nowrap text-white md:text-h1">
                코스콤(한국증권전산)지부
              </span>
            </span>
          </Link>
        </LogoTag>
      </div>
    </header>
  );
}
