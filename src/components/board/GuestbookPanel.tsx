import { getGuestbookConnection } from "@/lib/api/guestbook";
import { ConstructionIcon } from "@/components/ui/icons";

/**
 * 방명록 준비 중 카드 (스펙 §7.1).
 * 비활성 폼을 보여주는 방식 금지 — 폼 자체를 렌더하지 않는다.
 */
function PreparingCard() {
  return (
    <div className="rounded-xl border border-border-strong bg-surface px-4 py-8 text-center">
      <ConstructionIcon className="mx-auto size-10 text-border-strong" />
      <h2 className="mt-4 text-h2 text-ink">방명록 준비 중입니다</h2>
      <p className="mt-2 text-body font-normal text-ink-muted">
        방명록 기능을 준비하고 있습니다. 준비가 끝나면 이곳에서 글을 남길 수
        있습니다.
      </p>
    </div>
  );
}

/**
 * 방명록 탭 패널.
 * NCP 백엔드 미구축 상태 — API 계층(src/lib/api/guestbook.ts)이 unconfigured를
 * 반환하면 준비 중 카드만 렌더한다 (가짜 동작 금지).
 */
export function GuestbookPanel() {
  const connection = getGuestbookConnection();

  if (connection.status === "unconfigured") {
    return <PreparingCard />;
  }

  // 환경변수가 설정되어도 §7.2 작성 폼·목록은 백엔드 구축 완료 후 구현한다.
  // 그 전까지는 동작하지 않는 폼을 노출하지 않기 위해 준비 중 카드를 유지한다.
  return <PreparingCard />;
}
