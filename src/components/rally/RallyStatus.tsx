import type { RallyPhase } from "@/lib/rally";

/**
 * 결의대회 상태 배지 (디자인 스펙 §20.6).
 *
 * 메인 진입 블록과 참석 안내 페이지가 **같은 배지**를 쓴다. 두 화면이 각자 배지를 들면
 * 언젠가 한쪽만 고쳐져 "같은 8/28 일정이 화면마다 다른 상태"가 된다.
 *
 * - `완료` 는 §17.3 에서 확정돼 이미 달력·`/bargaining-2026` 에 배포된 문자열이다.
 *   여기만 다른 말을 쓰면 더 나쁜 불일치가 생기므로 **문자열·클래스를 그대로 재사용**한다(§20.6.1).
 * - upcoming 은 배지가 없다 — 아무 상태도 말하지 않는 것이 정상 상태다.
 */
/**
 * `onDark` — **딥블루 강조 면 위에 놓일 때만 `true`**(메인 히어로 배너 · §36.1).
 *
 * ★ 없으면 결함이 난다: 기본 `오늘` 배지는 `bg-primary text-white` 인데
 * **히어로 면도 `bg-primary` 라 배지가 배경에 묻혀 사라진다.** 같은 색 위에 같은 색이다.
 * 어두운 면에서는 명도를 뒤집어 **흰 면 + 딥블루 글자**로 둔다(`#093389` on `#ffffff` = 11.37).
 *
 * `완료` 는 `hero` 조합이 발생하지 않는다 — `past` 에서는 히어로를 비우고 배너가 `panel` 로
 * 내려오기 때문이다(§36.2). 그래도 대비는 성립하도록 뒀다(흰 면 위 `ink-muted` 4.83, 보조 텍스트).
 */
export function RallyStatusBadge({
  phase,
  onDark = false,
}: {
  phase: RallyPhase;
  onDark?: boolean;
}) {
  if (phase === "today") {
    return (
      <span
        className={
          onDark
            ? "rounded-full bg-white px-3 py-1 text-caption font-bold text-primary"
            : "rounded-full bg-primary px-3 py-1 text-caption font-bold text-white"
        }
      >
        오늘
      </span>
    );
  }
  if (phase === "past") {
    return (
      <span
        className={
          onDark
            ? "rounded-full bg-white px-3 py-1 text-caption text-ink-muted"
            : "rounded-full bg-surface px-3 py-1 text-caption text-ink-muted"
        }
      >
        완료
      </span>
    );
  }
  return null;
}

/**
 * 경과 상태 문장 (§20.10-4 · §20.6.1 — **리더 확정 문자열**).
 *
 * **계산할 수 있는 것만 말한다.** 이 문장은 `daysUntilKst()` 하나로 자동 출력되며 아무도
 * 개최 여부를 확인하지 않는다. 산별교섭이 타결되면 집회가 열리지 않을 수도 있으므로
 * `열렸습니다`·`개최됐습니다`·`성황리에` 를 쓰면 열리지도 않은 집회를 열렸다고 기록하게 된다.
 * 날짜 경과(계산 가능)만 서술한다. **이 문자열을 고치지 마라.**
 */
export const RALLY_PAST_NOTE =
  "2026년 8월 28일 일정이 지났습니다. 아래 안내는 기록으로 남겨 둡니다.";
