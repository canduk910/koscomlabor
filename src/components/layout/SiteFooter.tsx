import Image from "next/image";

/**
 * 푸터 (스펙 §3.4, 2026-08-16 CI 개정).
 * - 연락처·주소는 실 정보 확보 전이므로 항목 자체를 렌더하지 않는다 (플레이스홀더 연락처 금지).
 * - 로고 행 (§10.3): KFIU 마크 + 코스콤 기본형, 각 높이 24px, gap 1rem, 링크 아님.
 *   푸터 배경이 surface(#f9fafb)이므로 로고 행 전체를 흰색 #ffffff 칩
 *   (radius 8px, 패딩 8px 12px, 보더 1px solid border-soft 장식)에 배치해
 *   "흰 배경 위 전용" 규정을 충족한다.
 * - 인접 설명 텍스트가 없으므로 유의미 alt: "전국금융산업노동조합" / "코스콤".
 * - 코스콤 로고는 위계상 푸터 소속 표기 한정 (헤더 금지 — §10.3).
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border-soft bg-surface py-8">
      <div className="mx-auto w-full max-w-page px-4 md:px-6">
        <p className="text-caption font-semibold text-ink">
          전국금융산업노동조합 코스콤지부
        </p>
        <div className="mt-3 inline-flex items-center gap-4 rounded-lg border border-border-soft bg-bg px-3 py-2">
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
        <p className="mt-3 text-caption text-ink-muted">
          © 2026 전국금융산업노동조합 코스콤지부
        </p>
      </div>
    </footer>
  );
}
