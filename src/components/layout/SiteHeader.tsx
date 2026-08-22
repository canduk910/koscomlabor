import Image from "next/image";

import { FontScaleControl } from "@/components/layout/FontScaleControl";
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
    /*
     * ★ **스크롤해도 붙어 있는다**(사용자 지시 2026-08-22 — 캡처에 표시한 영역).
     *
     * `z-[200]` 인 이유(값을 낮추지 마라):
     *   - 네이버 지도가 만드는 컨트롤·저작권은 **`z-index: 100`** 이다. `z-40` 이면
     *     **지도 위를 지날 때 헤더가 그 아래로 깔린다**(로드뷰 시트에서 이미 겪은 실패다).
     *   - 로드뷰 하단 시트는 `z-[300]` 이라 **여전히 헤더보다 위**다 — 그게 맞다.
     *     시트가 열려 있는 동안은 시트가 주역이다.
     *   - 전체 화면 지도는 `<dialog showModal()>` 의 **top layer** 라 z-index 와 무관하게 위다.
     *
     * `border-b`: 붙어 있을 때 아래 내용과의 경계가 없으면 글자가 헤더로 흘러 들어오는 것처럼 보인다.
     * ⚠ **배경을 반투명으로 바꾸지 마라** — 뒤 글자가 비쳐 지부명 대비가 무너진다(§0.4 저대비 금지).
     */
    <header className="border-b border-border-soft sticky top-0 z-[200] border-t-2 border-t-primary bg-bg py-3.5 md:py-5">
      {/* 로고 ↔ 글자 크기 슬라이더 한 행.
          ⚠ **`flex-wrap` 을 빼지 마라** — 로고 록업이 `whitespace-nowrap` 이라 줄일 수 없고,
          텍스트 확대에서 두 덩어리가 한 줄에 못 들어가면 **가로 스크롤이 난다**(푸터 로고 선례). */}
      <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 md:px-8">
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
        <FontScaleControl />
      </div>
    </header>
  );
}
