import { WarningIcon } from "@/components/ui/icons";

/**
 * "긴급" 배지 — 배경 urgent-strong / 흰 텍스트 15px/700 (8.46:1 AAA).
 * withIcon: 목록 아이템용 14px 경고 아이콘 포함 (스펙 §5).
 * 스크린리더에는 배지 텍스트 "긴급"이 전달되고 아이콘은 aria-hidden.
 *
 * §16.9.4: **색 단독 의존이 아니다** — 배경색 + 경고 아이콘 + "긴급" 텍스트 3중 병행.
 * 이 배지가 urgent 의 유일한 표지다(목록 카드의 좌측 4px 빨간 바는 §16.1-5 로 폐기).
 * radius 만 rounded(4px) → rounded-badge(12px)로 통일. 색·문구·아이콘·aria 는 변경 0.
 */
export function UrgentBadge({ withIcon = false }: { withIcon?: boolean }) {
  return (
    <span className="rounded-badge inline-flex shrink-0 items-center gap-1 bg-urgent-strong px-2 py-0.5 text-caption font-bold text-white">
      {withIcon ? <WarningIcon className="size-3.5" /> : null}
      긴급
    </span>
  );
}
