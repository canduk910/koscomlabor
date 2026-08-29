import { daysUntilKst } from "@/lib/date";
import { STRUGGLE_SCHEDULE } from "@/lib/struggleSchedule";
import type { RallyPhase } from "@/lib/rally";

/**
 * 9/4 총파업 참석 안내의 **상태 계산** (디자인 스펙 §52.9-1).
 *
 * 날짜는 `src/lib/struggleSchedule.ts` 가 단일 출처다. 여기의 `STRIKE_DATE` 는 그 배열에서
 * 9/4 항목을 **가리키기 위한 키**이며, 아래 가드가 두 벌이 되는 순간을 즉시 잡는다.
 * D-n·상태는 전부 렌더 시점 계산이다 — 하드코딩 금지.
 *
 * ★ **`rallyPhase()` 를 재사용하지 않는다.** 그 함수는 `RALLY_DATE`(8/28) 전용이고,
 * 두 행사가 한 함수를 공유하면 «어느 날짜의 상태인가»가 호출부에서 사라진다.
 *
 * ⚠ **`RallyPhase` 타입은 그대로 쓴다.** `upcoming | today | past` 는 **행사 중립**이고
 * `RallyStatusBadge` 가 그 타입을 받는다(§52.9-1 — 새 배지를 만들지 마라).
 * `StrikePhase` 라는 별명을 만들지 마라 — **같은 계약에 이름이 둘이 되면** 나중에 한쪽만 늘어난다.
 */

/** 총파업 날짜(날짜 전용 ISO). `STRUGGLE_SCHEDULE` 에 같은 날짜 항목이 반드시 있어야 한다 */
export const STRIKE_DATE = "2026-09-04";

/*
 * 단일 출처 이탈 조기 발견(`rally.ts` 와 같은 형태 · 검증 §52-7). 일정 배열에서 9/4 가
 * 사라지거나 날짜가 바뀌면 **참석 안내 페이지만 옛 날짜를 들고 남는다** — 조합원에게 서로 다른
 * 날짜가 나가는 결함이고, 이 사이트에서 가장 나쁜 종류다.
 * 렌더를 막지는 않는다(안내 콘텐츠 자체는 여전히 유효하다). 서버 로그로만 경고한다.
 */
if (!STRUGGLE_SCHEDULE.some((event) => event.date === STRIKE_DATE)) {
  console.error(
    `[strike] STRIKE_DATE(${STRIKE_DATE}) 가 STRUGGLE_SCHEDULE 에 없습니다 — 일정 단일 출처가 갈렸습니다.`,
  );
}

/**
 * 렌더 시점의 총파업 상태.
 *
 * `daysUntilKst` 는 무효 입력에 `null` 을 준다 — 이때는 **upcoming 으로 취급**한다.
 * 계산이 실패했다고 "지났습니다"라고 말하면 시스템이 모르는 사실을 단정하는 것이 된다.
 */
export function strikePhase(now?: Date): RallyPhase {
  const days = daysUntilKst(STRIKE_DATE, now);
  if (days === null) return "upcoming";
  if (days === 0) return "today";
  if (days < 0) return "past";
  return "upcoming";
}
