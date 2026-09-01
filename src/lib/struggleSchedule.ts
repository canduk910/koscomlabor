import { daysUntilKst } from "@/lib/date";

/**
 * 26년 임단협 투쟁 일정 — **단일 출처** (디자인 스펙 §19.3.3).
 *
 * 메인페이지 미니달력과 `/bargaining-2026` 상세가 이 모듈 하나를 읽는다.
 * 두 페이지가 각자 일정을 들고 있으면 한쪽만 고쳐졌을 때 조합원에게 **서로 다른 날짜**가
 * 나간다 — 이 사이트에서 가장 나쁜 결함이다. D-day 계산도 여기 한 곳에서만 한다.
 *
 * **문안을 고치지 마라.** 아래 문자열은 `/bargaining-2026` 에 있던 값을 위치만 옮긴 것이며
 * 검증 게이트를 통과한 표현이다(§17.7 · 검증 판정 `_workspace/01_verifier_factcheck.md`).
 */

/** 중대도. 색·굵기를 결정한다. 임박도가 아니다(§18.3.2) */
export type EventLevel = "peak" | "major";

export interface ScheduleItem {
  /** 날짜 전용 ISO (YYYY-MM-DD) */
  date: string;
  /** 일정 정식 명칭 */
  title: string;
  /** 장소·시간 */
  meta: string;
  /** 상세 안내 */
  detail: string;
  level: EventLevel;
}

/** 확정 일정 — D-n 은 렌더 시점에 계산한다(하드코딩 금지, §17.3) */
export const STRUGGLE_SCHEDULE: readonly ScheduleItem[] = [
  {
    date: "2026-08-28",
    title: "총력투쟁 결의대회",
    meta: "서울 여의도 · 저녁",
    detail: "총파업 D-7 집회입니다.",
    level: "major",
  },
  /*
   * ★ **`meta`·`detail` 은 2026-08-29 에 교체됐다**(검증 §51-5(1)·§52-5 · 리더 D-10).
   * 종전 값(`종일` / `집결 장소와 시간은 지부 공지로 별도 안내합니다.`)은 주최측 자료가
   * 들어온 순간 **거짓이 됐다** — 장소와 시각이 원문에 있다.
   *
   * ⚠ **되돌리지도, 늘리지도 마라:**
   *  - `종일` 금지 — 원문 근거 0 이고 장소가 빠지는 것이 애초의 결함이었다
   *  - `· 오전` 금지 — 식순이 **`15:15`(폐회선언)** 까지 간다. 8/28 의 `· 저녁` 을 형식만 보고
   *    흉내 내면 거짓이다. ★ **금지는 그대로이나 근거 수치가 바뀌었다** — 2026-09-01 신판 식순에서
   *    폐회가 `14:20` → `15:15` 로 **55분 밀렸다**(검증 §61 A-5). 낡은 `14:20` 을 인용하지 마라
   *  - `· 11시` 금지 — 이 두 줄은 `/bargaining-2026` 카드에서 **연달아** 나온다.
   *    `11시` 가 `10시 30분` 바로 위에 붙으면 *"11시까지 가면 되나"* 로 읽혀 **30분 늦는다**(§52-5)
   *  - `11시~15:15` 류 **범위 금지** — 원문은 파업의 시간 범위를 말하지 않는다. `15:15` 는
   *    **폐회선언 시각**이지 «파업 종료 시각»이 아니다(§51-5 — 이 프로젝트가 반복 금지한 것)
   */
  {
    date: "2026-09-04",
    title: "총파업",
    meta: "서울 세종대로",
    detail: "전 조합원 집결은 10시 30분입니다.",
    level: "peak",
  },
];

/** 날짜와 중대도만 있으면 순서를 정할 수 있다 — 달력의 CalendarEvent 도 이 형태를 만족한다 */
interface DatedEvent {
  date: string;
  level: EventLevel;
}

/** 같은 날 2건이면 peak 가 앞선다(§19.3.1) — 격자 셀 표시와 헤드라인 대상이 같은 규칙을 쓴다 */
const LEVEL_ORDER: Record<EventLevel, number> = { peak: 0, major: 1 };

/**
 * 오늘 이후(당일 포함) 일정만 날짜 오름차순으로 — 동일 날짜는 peak 우선.
 *
 * 달력 격자와 D-day 헤드라인이 **같은 배열**을 쓴다. 각자 정렬하면 언젠가 갈린다.
 * `daysUntilKst` 는 무효 입력에 `null` 을 주는데 **`null >= 0` 은 JS 에서 `true`** 이므로
 * null 을 먼저 걸러낸다(§19.3.1).
 */
export function futureEventsInOrder<T extends DatedEvent>(
  events: readonly T[],
  now?: Date,
): T[] {
  return events
    .filter((event) => {
      const days = daysUntilKst(event.date, now);
      return days !== null && days >= 0;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
    );
}

/**
 * 가장 가까운 미래 일정. 전부 지났으면 `null`(§19.3.1).
 *
 * `null` 은 곧 "메인 미니달력·상세 달력 미렌더"를 뜻한다(§18.7 상태 E).
 * 이때 "일정이 모두 종료되었습니다" 류의 안내 문구를 만들지 않는다 — 문안 창작 금지(§17.7).
 */
export function nextStruggleEvent(now?: Date): ScheduleItem | null {
  return futureEventsInOrder(STRUGGLE_SCHEDULE, now)[0] ?? null;
}
