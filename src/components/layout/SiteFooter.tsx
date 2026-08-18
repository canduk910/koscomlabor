import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

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
 * - 관리자 링크(2026-08-18): 저작권과 같은 행, 색은 --color-primary-soft 로 저작권과 동일
 *   (딥블루 대비 9.23:1 — AAA). 눈에 덜 띄게 만들려고 대비를 낮추지 않는다(§0.4 저대비 금지);
 *   시각적 절제는 크기(text-caption)와 배치로만 얻는다. underline 은 저작권 문단과 링크를
 *   색이 아닌 형태로 구분하기 위한 것이다. 포커스 링은 딥블루 면 관례대로 흰색(HeroPanel 동일).
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
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6">
          <p className="text-caption text-primary-soft">
            © 2026 전국금융산업노동조합 코스콤(한국증권전산)지부
          </p>
          <Link
            href={ROUTES.admin}
            className="ease-out-soft inline-flex min-h-touch items-center text-caption text-primary-soft underline underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            관리자
          </Link>
        </div>
      </div>
    </footer>
  );
}
