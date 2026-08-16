/**
 * 푸터 (스펙 §3.4).
 * 연락처·주소는 실 정보 확보 전이므로 항목 자체를 렌더하지 않는다 (플레이스홀더 연락처 금지).
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border-soft bg-surface py-8">
      <div className="mx-auto w-full max-w-page px-4 md:px-6">
        <p className="text-caption font-semibold text-ink">
          전국금융산업노동조합 코스콤지부
        </p>
        <p className="mt-2 text-caption text-ink-muted">
          © 2026 전국금융산업노동조합 코스콤지부
        </p>
      </div>
    </footer>
  );
}
