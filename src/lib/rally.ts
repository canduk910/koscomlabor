import { daysUntilKst } from "@/lib/date";
import { STRUGGLE_SCHEDULE } from "@/lib/struggleSchedule";

/**
 * 8/28 총력투쟁 결의대회 참석 안내의 **상태 계산** (디자인 스펙 §20.6).
 *
 * 날짜는 `src/lib/struggleSchedule.ts` 가 단일 출처다. 여기의 `RALLY_DATE` 는 그 배열에서
 * 8/28 항목을 **가리키기 위한 키**이며, 아래 가드가 두 벌이 되는 순간을 즉시 잡는다.
 * D-n·상태는 전부 렌더 시점 계산이다 — 하드코딩 금지(§20.6).
 */

/** 결의대회 날짜(날짜 전용 ISO). `STRUGGLE_SCHEDULE` 에 같은 날짜 항목이 반드시 있어야 한다 */
export const RALLY_DATE = "2026-08-28";

/*
 * 단일 출처 이탈 조기 발견(§20.5-2). 일정 배열에서 8/28 이 사라지거나 날짜가 바뀌면
 * 참석 안내 페이지만 옛 날짜를 들고 남는다 — 조합원에게 서로 다른 날짜가 나가는 결함이다.
 * 렌더를 막지는 않는다(안내 콘텐츠 자체는 여전히 유효하다). 서버 로그로만 경고한다.
 */
if (!STRUGGLE_SCHEDULE.some((event) => event.date === RALLY_DATE)) {
  console.error(
    `[rally] RALLY_DATE(${RALLY_DATE}) 가 STRUGGLE_SCHEDULE 에 없습니다 — 일정 단일 출처가 갈렸습니다.`,
  );
}

/** 예고 / 당일 / 경과. **코드 내부 이름**이며 화면 문자열이 아니다(§20.6.1) */
export type RallyPhase = "upcoming" | "today" | "past";

/**
 * 렌더 시점의 결의대회 상태.
 *
 * `daysUntilKst` 는 무효 입력에 `null` 을 준다 — 이때는 **upcoming 으로 취급**한다(§20.6).
 * 계산이 실패했다고 "지났습니다"라고 말하면 시스템이 모르는 사실을 단정하는 것이 된다.
 */
export function rallyPhase(now?: Date): RallyPhase {
  const days = daysUntilKst(RALLY_DATE, now);
  if (days === null) return "upcoming";
  if (days === 0) return "today";
  if (days < 0) return "past";
  return "upcoming";
}
