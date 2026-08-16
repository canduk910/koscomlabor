/**
 * 날짜 배지 (스펙 §11.5) — deadline 있는 목록 아이템 좌측(md+ 전용).
 * 56×56px, 세로 스택: "M/D" 18px/800 + "D-n" 15px/600.
 * 변형:
 * - default: 배경 primary-soft / 텍스트 #093389 (9.23:1 — 채택 #22)
 * - imminent(D-7 이내): 배경 urgent-strong / #ffffff (8.46:1 — 채택 #14)
 * - emphasis: 배경 primary / #ffffff (11.37:1 — 예약, 현 범위 미사용)
 * 레퍼런스의 밝은 블루 배지(#2e7df7+흰 텍스트, 3.89:1)는 미채택 — 도입 금지.
 */

export type DateBadgeVariant = "default" | "imminent" | "emphasis";

const VARIANT_CLASS: Record<DateBadgeVariant, string> = {
  default: "bg-primary-soft text-primary",
  imminent: "bg-urgent-strong text-white",
  emphasis: "bg-primary text-white",
};

interface DateBadgeProps {
  /** "M/D" 표기 (예: 8/30) */
  monthDay: string;
  /** 하단 보조 표기 (예: "D-3") */
  subLabel: string;
  variant?: DateBadgeVariant;
  className?: string;
}

export function DateBadge({
  monthDay,
  subLabel,
  variant = "default",
  className,
}: DateBadgeProps) {
  return (
    <span
      className={`rounded-badge flex size-14 shrink-0 flex-col items-center justify-center leading-none ${VARIANT_CLASS[variant]} ${className ?? ""}`}
    >
      {/* §12.2: M/D — Gmarket Sans Bold 700(-0.01em), D-n — Medium 500(자간 0) */}
      <span className="font-display text-body font-bold tracking-[-0.01em]">{monthDay}</span>
      <span className="font-display mt-0.5 text-caption font-medium">{subLabel}</span>
    </span>
  );
}
