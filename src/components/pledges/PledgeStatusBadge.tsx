import type { PledgeStatus } from "@/lib/api/pledges";
import { PLEDGE_STATUS_META } from "@/lib/pledges";

/**
 * 신호등 배지 — **색 + 기호 + 글자, 셋을 항상 함께** 낸다(union-design-system §2).
 *
 * ⛔ **셋 중 어느 하나도 조건부로 빼지 마라.** 기호를 떼면 흑백·색각이상에서 세 상태가
 *   같아 보이고, 글자를 떼면 «◐ 가 무슨 뜻인가»를 아무 데서도 알 수 없다.
 *   좁은 자리가 필요하면 `size="sm"` 을 쓴다 — 작아질 뿐 셋은 남는다.
 *
 * 대비: 배지 조합은 전부 AAA(7.74~8.43). 실측치는 globals.css 신호등 주석에 있다.
 *
 * ★ 기호는 **«시각» 채널의 셋 중 하나**다 — 색을 못 읽는 사람에게 상태를 가르는 것이 이것이다.
 *   ⛔ **화면에서 기호를 빼지 마라.**
 * ★ 다만 스크린리더에는 **바로 옆 글자 라벨이 이미 읽힌다.** 그래서 기호에는 `aria-hidden` 을 준다 —
 *   ⛔ **떼지 마라.** 떼면 「● 달성」처럼 두 번 읽히고, 43건 목록에서 43번 반복된다.
 */
export function PledgeStatusBadge({
  status,
  size = "md",
  className = "",
}: {
  status: PledgeStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = PLEDGE_STATUS_META[status];
  const sizeClass =
    size === "sm" ? "gap-1 px-2 py-0.5 text-caption" : "gap-1.5 px-2.5 py-1 text-caption";
  return (
    <span
      className={`rounded-badge inline-flex shrink-0 items-center font-bold ${meta.badgeClass} ${sizeClass} ${className}`}
    >
      {/* 기호는 폰트 폴백에서 크기가 들쭉날쭉해 보이지 않도록 한 칸으로 고정한다 */}
      <span aria-hidden="true" className="text-[0.9em] leading-none">
        {meta.mark}
      </span>
      {meta.label}
    </span>
  );
}
