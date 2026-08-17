import { DocumentIcon } from "@/components/ui/icons";

/**
 * 빈 상태 (스펙 §16.9.8) — 게시물 0건일 때 목록 대신 표시.
 * 가짜 예시 게시물로 채우지 않는다. 정적 상태이므로 role="status" 미부여.
 *
 * 표면은 **L2 면**(rounded-panel + bg-surface, 그림자·테두리 금지 — §16.5).
 * surface 위 대비: 제목 #1a1a1a 16.65 / 보조 #4b5563 7.23 / 아이콘 #6b7280 4.63(UI) — 전부 유효.
 */
export function EmptyState({
  message,
  subMessage = "새 글이 등록되면 이곳에 표시됩니다",
}: {
  message: string;
  subMessage?: string;
}) {
  return (
    <div className="rounded-panel bg-surface px-6 py-14 text-center">
      <DocumentIcon className="mx-auto size-10 text-border-strong" />
      <p className="mt-4 text-body font-semibold text-ink">{message}</p>
      <p className="mt-2 text-caption text-ink-muted">{subMessage}</p>
    </div>
  );
}
