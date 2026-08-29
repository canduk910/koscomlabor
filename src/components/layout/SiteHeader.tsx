import Image from "next/image";

import { FontScaleControl } from "@/components/layout/FontScaleControl";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * 헤더 — 상단 2px 브랜드 트림 + 흰 바탕 + 파란 텍스트 (§16.9.1).
 * ⚠ 하단 띠를 되살리지 마라 — 띠 2줄은 화면을 상자로 가둔다(§16.1-2 테두리 남용 금지).
 * ⚠ 명칭 2줄 록업의 글자 크기는 두 줄의 폭을 맞추기 위한 **스펙 확정 계산값**이다(§13.5.2).
 *   임의 값으로 바꾸면 등폭이 깨진다.
 *
 * asHeading: 홈에서는 로고가 페이지 h1, 상세 페이지에서는 게시물 제목이 h1 이므로
 * false 를 넘겨 <p> 로 렌더한다(h1 중복·위계 역전 방지).
 */
export function SiteHeader({ asHeading = true }: { asHeading?: boolean }) {
  const LogoTag = asHeading ? "h1" : "p";
  return (
    /* 스크롤해도 붙어 있는다.
     * ⚠ `z-[200]` 을 낮추지 마라 — 네이버 지도 컨트롤이 z-index 100 이라 그보다 낮으면
     *   지도 위를 지날 때 헤더가 아래로 깔린다. (로드뷰 시트 z-[300] 이 헤더보다 위인 것은 의도다.)
     * ⚠ 배경을 반투명으로 바꾸지 마라 — 뒤 글자가 비쳐 지부명 대비가 무너진다.
     */
    <header className="border-b border-border-soft sticky top-0 z-[200] border-t-2 border-t-primary bg-bg py-3.5 md:py-5">
      {/* 로고 ↔ 글자 크기 슬라이더 한 행.
          ⚠ `flex-wrap` 을 빼지 마라 — 로고 록업이 nowrap 이라 줄일 수 없고, 한 줄에 못 들어가면
            가로 스크롤이 난다. 접히는 것 자체는 옳은 대체동작이다.
          ⚠⚠ 다만 **이 행이 접히면 그 아래 모든 것이 50px 내려간다.** 첫 화면 예산(실측 2026-08-27 ·
            루트 12px · 스크롤바 0). ★ **이 표가 이 항목의 단일 출처다** — `FOLLOWUPS.md` #20 이
            *"예산표를 소스 주석에 박았다"* 로 여기에 위임했다. 지우면 어디에도 남지 않는다:

              로고 록업        207.0  = 마크 30.9 + gap 9 + 텍스트열 167.1  ← 스펙 확정(§13.5.2) · 줄일 수 없다
              글자크기 컨트롤   93.2  = 가 9.5 + gap 4.5 + 슬라이더 60 + gap 4.5 + 가 14.7
              행 gap-x-2         6.0
              px-4 좌우         24.0
              ───────────────────────
              한 줄 유지 최소폭 330.2  → **절벽 331px** · 360 에서 여유 **29px**

            ⚠ 여유는 조건과 함께 읽어라: `clientWidth` 360(스크롤바 0 · 실기기) → **29px**,
              345(스크롤바 15 · 데스크톱) → **14.8px**. 둘 다 참이고 판정(한 줄)은 같다.
            ⚠ **이 표는 «루트 12px» 전용이다.** 슬라이더가 헤더를 넓히는 당사자라 배율이 오르면
              절벽도 오른다 — 130%(루트 20.8px)에서 절벽은 432px 이고 360 에서 두 줄이 된다.
              그것은 결함이 아니라 설계된 `flex-wrap` 대체동작이다.
            ⚠ 헤더에 무엇을 더하거나 **문자열을 늘리면**(방아쇠는 텍스트열 167.1 이다)
              **예산을 다시 재고 절벽을 함께 적어라**(union-qa-testing §5.8.1).
            경위 · 320px 판정 · 오염 사고 이력: `_workspace/FOLLOWUPS.md` #20 · `04_qa_report.md` I-1.
          ★ `gap-x-2` 는 «시각»이 아니라 «임계폭»을 정한다 — `justify-between` 이라 넓은 화면에서는
            남는 공간이 간격을 정하므로 줄여도 보이는 모습이 바뀌지 않는다 */}
      <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 md:px-8">
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
