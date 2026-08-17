import Image from "next/image";

/**
 * 푸터 (스펙 §16.9.2 — v2 딥블루 밴드 §11.6 의 시각 갱신판).
 * - 배경 --color-primary(#093389). 지부명 #ffffff/700 18px(11.37:1 — 이 면의 유일한 1차 정보),
 *   저작권 --color-primary-soft(9.23:1).
 * - **상단 모서리 32px 라운드**(rounded-t-panel-lg): 딥블루 밴드가 페이지를 자르는 인상을
 *   없애고 히어로의 라운드 언어와 짝을 맞춘다(§16.9.2).
 * - 연락처·주소는 실 정보 확보 전이므로 항목 자체를 렌더하지 않는다 (플레이스홀더 금지).
 * - 로고 행 (§10.3): 흰 칩(--color-bg)에 KFIU 마크+코스콤 기본형 각 28px, gap 1rem,
 *   링크 아님, 유의미 alt. 칩 보더 없음(딥블루 대비로 불필요) — 표면 규칙 L3 준수.
 * - 색·문구·alt 변경 0 (§13.5.2 지부명 표기 규칙 준수).
 */
export function SiteFooter() {
  return (
    <footer className="rounded-t-panel-lg mt-20 bg-primary py-12 md:mt-section-lg md:py-16">
      <div className="mx-auto w-full max-w-page px-4 md:px-8">
        <p className="text-body font-bold text-white">
          전국금융산업노동조합 코스콤(한국증권전산)지부
        </p>
        <div className="rounded-card mt-5 inline-flex items-center gap-4 bg-bg px-4 py-3">
          <Image
            src="/brand/kfiu-mark.png"
            alt="전국금융산업노동조합"
            width={247}
            height={192}
            className="h-7 w-auto"
          />
          <Image
            src="/brand/koscom-logo.png"
            alt="코스콤"
            width={387}
            height={96}
            className="h-7 w-auto"
          />
        </div>
        <p className="mt-5 text-caption text-primary-soft">
          © 2026 전국금융산업노동조합 코스콤(한국증권전산)지부
        </p>
      </div>
    </footer>
  );
}
