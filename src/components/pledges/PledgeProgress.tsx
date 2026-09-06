import type { PledgeStatus } from "@/lib/api/pledges";
import { PLEDGE_STATUS_META, PLEDGE_STATUS_ORDER, type PledgeTally } from "@/lib/pledges";

function countsOf(tally: PledgeTally): Record<PledgeStatus, number> {
  return { done: tally.done, talking: tally.talking, undone: tally.undone };
}

/**
 * 진행 막대(조각 3개) — 메인 요약·카테고리 칸·전체보기가 **모두 이것 하나**를 쓴다.
 *
 * ★ **막대는 언제나 보조다. 뜻을 지는 것은 «건수 글자»다.** 그래서 `aria-hidden` 이고,
 *   부르는 쪽이 반드시 숫자를 함께 낸다. ⛔ 막대만 두고 숫자를 빼지 마라 — 그 순간
 *   정보가 색으로만 남는다(union-design-system §2).
 *
 * 조각 대비: 조각 ↔ 트랙(#e5e7eb) = 4.05 / 4.06 / 4.50 — UI 3:1 통과(실측).
 * ⚠ **조각 사이 틈(gap)을 없애지 마라.** 틈이 없으면 판정 대상 배경이 «옆 조각»이 되고,
 *   초록 ↔ 호박은 서로 3:1 을 보장하지 못한다. 틈이 트랙 색을 드러내 각 조각의 이웃을
 *   **우리가 고른 한 색으로 고정**한다(globals.css 의 이중 링과 같은 수법이다).
 */
export function PledgeBar({
  tally,
  className = "",
}: {
  tally: PledgeTally;
  className?: string;
}) {
  const counts = countsOf(tally);
  // 0 건인 조각은 «렌더하지 않는다» — flexGrow 0 으로 두면 폭은 0 인데 gap 이 남아
  // 막대 가운데에 정체 불명의 틈이 생긴다
  const segments = PLEDGE_STATUS_ORDER.filter((status) => counts[status] > 0);
  return (
    <div
      aria-hidden="true"
      className={`flex gap-0.5 overflow-hidden rounded-full bg-border-soft ${className}`}
    >
      {segments.map((status) => (
        <div
          key={status}
          className={PLEDGE_STATUS_META[status].dotClass}
          // flexBasis 0 + flexGrow=건수 → 폭이 «정확히» 건수 비례가 된다.
          // 퍼센트 폭을 쓰면 gap 만큼 합이 100% 를 넘어 마지막 조각이 잘린다.
          style={{ flexGrow: counts[status], flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

/** 막대 + 상태별 건수 범례. 숫자가 정본이고 막대·점은 그것을 그림으로 되풀이한다 */
export function PledgeProgress({
  tally,
  className = "",
}: {
  tally: PledgeTally;
  className?: string;
}) {
  const counts = countsOf(tally);
  return (
    <div className={className}>
      <PledgeBar tally={tally} className="h-2.5" />
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {PLEDGE_STATUS_ORDER.map((status) => {
          const meta = PLEDGE_STATUS_META[status];
          return (
            <li key={status} className="flex items-center gap-1.5 text-caption text-ink">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${meta.dotClass}`} />
              <span className="break-keep break-words">{meta.label}</span>
              <b className="font-bold tabular-nums">{counts[status]}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
