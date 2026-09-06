import Link from "next/link";
import type { ApiPledge } from "@/lib/api/pledges";
import {
  PLEDGE_CATEGORY_LABELS,
  PLEDGE_CATEGORY_ORDER,
  PLEDGE_DASHBOARD_NAME,
  tallyPledges,
} from "@/lib/pledges";
import { ROUTES } from "@/lib/routes";
import { ArrowRightIcon } from "@/components/ui/icons";
import { PledgeBar, PledgeProgress } from "@/components/pledges/PledgeProgress";

/**
 * 메인페이지 **공약 이행 요약 상황판**(사용자 지시 2026-09-06).
 *
 * ★ 여기는 «요약»만 둔다 — 개별 공약 43건은 `/pledges` 다(사용자 확정).
 *   ⛔ 여기에 공약 목록을 펼치지 마라. 메인이 감당 못 할 길이가 되고, 그 판단은 이미 났다.
 *   ⛔ 반대로 「전체보기」 링크를 빼지 마라 — 그것이 43건에 닿는 **유일한 경로**다.
 *
 * ★ **색은 배지·점·막대 조각에만 쓴다.** 카드 면·테두리를 신호등 색으로 칠하지 마라 —
 *   메인에는 이미 파랑(주색)과 적색(긴급 배너)이 있다(globals.css 신호등 주석).
 *
 * ⚠ 데이터를 못 가져오면 **이 블록을 통째로 렌더하지 않는다**(호출부에서 `null` 검사).
 *   메인에 «0건»이 뜨면 그것은 «아직 아무것도 안 했다»는 **사실 주장**이 된다 —
 *   통신 실패를 그렇게 말하면 안 된다.
 */
export function PledgeDashboard({
  pledges,
  className = "",
}: {
  pledges: ApiPledge[];
  className?: string;
}) {
  const tally = tallyPledges(pledges.map((pledge) => pledge.status));

  return (
    <section
      aria-labelledby="pledge-dashboard-title"
      className={`rounded-panel shadow-card bg-bg p-5 md:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* 이름은 `PLEDGE_DASHBOARD_NAME` 하나에서 온다 — 여기 리터럴을 적지 마라.
            ⚠ `break-keep break-words` 를 빼지 마라: 19자라 200% 확대에서 줄바꿈이 필요하다(§0.8) */}
        <h2 id="pledge-dashboard-title" className="break-keep break-words text-h2 text-ink">
          {PLEDGE_DASHBOARD_NAME}
        </h2>
        <Link
          href={ROUTES.pledges}
          className="ease-out-soft inline-flex min-h-touch items-center gap-1.5 text-caption font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          전체보기
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>

      <p className="mt-1 break-keep break-words text-caption text-ink-muted">
        공약 <b className="font-bold tabular-nums text-ink">{tally.total}</b>건 중{" "}
        <b className="font-bold tabular-nums text-ink">{tally.done}</b>건 달성 ({tally.donePercent}%)
      </p>

      <PledgeProgress tally={tally} className="mt-4" />

      {/*
        카테고리 4칸.
        ⚠ **모바일은 «세로 나열»이고 md 부터만 4열이다**(union-design-system §0.8.1).
          좁은 폭에서 그리드 트랙은 «내용의 min-content»로 자기 폭을 정하므로
          `break-words` 가 듣지 않는다 — `든든한 코스콤` 이 3자 덩어리 둘이라
          200% 확대에서 2열만 돼도 트랙이 넘친다. **되돌려 `grid-cols-2` 를 모바일에 주지 마라.**
      */}
      <ul className="mt-6 flex flex-col gap-3 md:grid md:grid-cols-4 md:gap-4">
        {PLEDGE_CATEGORY_ORDER.map((category) => {
          const rows = pledges.filter((pledge) => pledge.category === category);
          const sub = tallyPledges(rows.map((pledge) => pledge.status));
          return (
            <li
              key={category}
              className="rounded-badge flex items-center justify-between gap-3 bg-surface p-3 md:block md:p-4"
            >
              <span className="min-w-0 break-keep break-words text-caption font-semibold text-ink">
                {PLEDGE_CATEGORY_LABELS[category]}
              </span>
              {/* `0 / 12` 는 눈으로는 즉시 읽히지만 낭독하면 «영 슬래시 십이»가 된다 —
                  비시각 사용자에게는 문장으로 준다. 두 표현이 같은 수를 말하도록 **한 곳에서** 낸다 */}
              <span className="shrink-0 text-caption text-ink-muted md:mt-2 md:block">
                <span className="sr-only">
                  {sub.total}건 중 {sub.done}건 달성
                </span>
                <span aria-hidden="true">
                  <b className="font-bold tabular-nums text-ink">{sub.done}</b> /{" "}
                  <span className="tabular-nums">{sub.total}</span>
                </span>
              </span>
              {/* 미니 막대는 md 부터만 — 모바일 행에서는 숫자 옆 공간이 없어 조각이
                  판독 불가능한 폭이 된다. 숫자는 양쪽에 다 있으므로 정보 손실은 0 이다 */}
              <PledgeBar tally={sub} className="mt-2 hidden h-1.5 md:flex" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
