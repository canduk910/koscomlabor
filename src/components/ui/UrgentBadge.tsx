import { WarningIcon } from "@/components/ui/icons";

/**
 * "긴급" 배지 — 배경 urgent-strong / 흰 텍스트 15px/700 (대비 8.31:1).
 * withIcon: 목록 아이템용 14px 경고 아이콘 포함 (스펙 §5).
 * 스크린리더에는 배지 텍스트 "긴급"이 전달되고 아이콘은 aria-hidden.
 */
export function UrgentBadge({ withIcon = false }: { withIcon?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-urgent-strong px-2 py-0.5 text-caption font-bold text-white">
      {withIcon ? <WarningIcon className="size-3.5" /> : null}
      긴급
    </span>
  );
}
