import Image from "next/image";

/**
 * 푸터 (스펙 §3.4 + v2 딥블루 밴드 §11.6).
 * - v2: 배경 --color-primary(#093389), 상단 보더 제거. 지부명 #ffffff/700(11.37:1 — #11),
 *   저작권 --color-primary-soft(9.23:1 — #23).
 * - 연락처·주소는 실 정보 확보 전이므로 항목 자체를 렌더하지 않는다 (플레이스홀더 금지).
 * - 로고 행 (§10.3): 흰 칩(--color-bg)에 KFIU 마크+코스콤 기본형 각 24px, gap 1rem,
 *   링크 아님, 유의미 alt. v2에서 칩 보더 제거(딥블루 대비로 불필요).
 *   딥블루 위에서도 흰 칩이 "흰 배경 위 로고" 규정을 계속 충족.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 bg-primary py-8">
      <div className="mx-auto w-full max-w-page px-4 md:px-6">
        <p className="text-caption font-bold text-white">
          전국금융산업노동조합 코스콤지부
        </p>
        <div className="rounded-badge mt-3 inline-flex items-center gap-4 bg-bg px-3 py-2">
          <Image
            src="/brand/kfiu-mark.png"
            alt="전국금융산업노동조합"
            width={247}
            height={192}
            className="h-6 w-auto"
          />
          <Image
            src="/brand/koscom-logo.png"
            alt="코스콤"
            width={387}
            height={96}
            className="h-6 w-auto"
          />
        </div>
        <p className="mt-3 text-caption text-primary-soft">
          © 2026 전국금융산업노동조합 코스콤지부
        </p>
      </div>
    </footer>
  );
}
