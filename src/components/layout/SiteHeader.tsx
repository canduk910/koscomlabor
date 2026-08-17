import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * 헤더 v5 — 상단 2px 브랜드 트림 + 흰 바탕 + 파란 텍스트 (스펙 §16.9.1, 왼가슴 자수 스타일).
 * - 배경 --color-bg(#ffffff), **상단 2px solid --color-primary 띠 1줄만**(풀폭).
 *   하단 띠는 폐기: 히어로 패널(라운드+그림자)의 형태 대비가 경계를 만들고, 4px 띠 2줄은
 *   화면을 상자로 가둬 구식 인상의 원인이 된다(§16.1-2 — 테두리 남용 금지).
 * - 세로 패딩 py-3.5 md:py-5 (14/20px) — 여백이 주역(§0.2-1). 총높이 모바일 ≈74 / md+ ≈86px.
 * - KFIU 마크: 흰 배경 위 직접 배치라 radius 불요(원본 흰 바탕이 배경에 동화).
 * - 명칭 2줄 등폭 록업 (§13.5.2 — 폰트 메트릭 기반, 두 줄 모두 Gmarket Bold 700 /
 *   자간 -0.02em / 행간 1.15 / --color-primary(11.37:1 — 채택 #8) / 줄바꿈 금지):
 *   1줄 "전국금융산업노동조합"  모바일 17.7px / md+ 18.9px (= 2줄 × 1.183)
 *   2줄 "코스콤(한국증권전산)지부" 모바일 15px  / md+ 16px (§13.5 8차 — 모바일은 15px 하한 고정)
 *   크기는 스펙 확정 계산값 고정 지정(arbitrary 허용 — 등폭 우선, §13.5.2).
 * - focus-visible: 표준 파랑 링 복원 (§13.2 흰 링 규정 폐기).
 *
 * asHeading: 메인페이지에서는 로고가 페이지 h1, 상세 페이지에서는 게시물 제목이
 * h1이므로 false를 넘겨 <p>로 렌더한다 (h1 중복·위계 역전 방지).
 */
export function SiteHeader({ asHeading = true }: { asHeading?: boolean }) {
  const LogoTag = asHeading ? "h1" : "p";
  return (
    <header className="border-t-2 border-primary bg-bg py-3.5 md:py-5">
      <div className="mx-auto w-full max-w-page px-4 md:px-8">
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
              className="h-8 w-auto md:h-9"
            />
            <span className="flex flex-col justify-center">
              <span className="font-display text-[17.7px]/[1.15] font-bold tracking-[-0.02em] whitespace-nowrap text-primary md:text-[18.9px]/[1.15]">
                전국금융산업노동조합
              </span>
              <span className="font-display text-[15px]/[1.15] font-bold tracking-[-0.02em] whitespace-nowrap text-primary md:text-[16px]/[1.15]">
                코스콤(한국증권전산)지부
              </span>
            </span>
          </Link>
        </LogoTag>
      </div>
    </header>
  );
}
