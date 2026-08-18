import Link from "next/link";
import {
  addDaysIso,
  daysUntilKst,
  formatKoreanMonthDay,
  formatMonthDaySlash,
  todayIsoKst,
  weekdayIndexIso,
} from "@/lib/date";
import { futureEventsInOrder, type EventLevel } from "@/lib/struggleSchedule";
import { ROUTES } from "@/lib/routes";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * 카운트다운 달력 (디자인 스펙 §18 · §19) — `/bargaining-2026`(full)과 메인페이지(mini).
 *
 * **size 는 치수·배치 프리셋일 뿐이다**(§19.0 #1). 데이터·범위 계산·상태 판정 7단계·
 * `sr-only` 규약·셀 폭 기하는 두 size 가 100% 공유한다. 별도 `MiniCalendar` 를 만들지 않는
 * 이유는 셀 폭 여유가 **0.30px**(§18.6.1-b)인 설계에서 기하가 두 파일로 갈리면 한쪽 패딩만
 * 바뀌어도 다른 쪽이 조용히 깨지고, 복제된 접근성 규약은 반드시 갈리기 때문이다.
 *
 * 이 컴포넌트는 **추가 레이어**다. 상세 페이지의 카드(장소·시간·상세 안내)를 대체하지 않으며,
 * 달력이 렌더되지 않는 상태(§18.7 상태 E)에서도 카드만으로 정보가 완결되어야 한다.
 * 메인에는 애초에 그 카드가 없었고 미니달력은 없던 자리에 추가되는 레이어라 무엇도 가리지
 * 않는다 — 장소·시간은 상세 페이지에 그대로 있고 하단 링크가 거기로 간다(§19.0.2).
 *
 * 설계상 되살리면 안 되는 것(§18.0 · §19.0 버린 안):
 *  - 월 단위 격자(8월 전체 + 9월 전체) — 62칸에 일정 2칸이면 임박함이 희석된다.
 *    범위는 **오늘이 속한 주의 일요일 ~ 마지막 일정이 속한 주의 토요일** 연속 1개 격자다.
 *  - 지난 날짜의 흐린 회색 숫자 — #6b7280 on #ffffff 는 4.83 으로 AAA 미달(§0.3).
 *    지난 칸은 **숫자 없는 빈 칸**이다.
 *  - `role="grid"` — 방향키 이동이 가능한 인터랙티브 위젯의 role 이다. 이 달력은 비인터랙티브다.
 *  - hover·트랜지션·등장 애니메이션 — 마우스에만 반응하는 상태를 만들지 않는다(§0.4 · §18.8.3).
 *  - mini 에서 셀을 좁히거나 행 수를 줄이는 것 — 폭 여유 0.30px 을 즉시 소진하고, 행을 줄이면
 *    9/4 총파업이 화면에서 사라진다. **축소가 곧 은폐**다(§19.0 #2).
 *
 * 격자 셀 색은 **중대도**(level)가 정하고 **임박도**는 D-n 숫자와 헤드라인이 담당한다(§18.3.2).
 * D-n 으로 색을 정하면 8/28·9/4 가 같은 색이 되어 총파업의 중대성이 화면에서 사라진다.
 */

export interface CalendarEvent {
  /** 날짜 전용 ISO (YYYY-MM-DD) — STRUGGLE_SCHEDULE 의 date 를 그대로 넘긴다 */
  date: string;
  /** 일정 정식 명칭. 스크린리더 낭독·카드와 동일 문자열을 쓴다(축약 금지) */
  title: string;
  /**
   * 중대도. 색·굵기를 결정한다. 임박도가 아니다(§18.3.2).
   * - "peak"  : 최상위 — 총파업
   * - "major" : 강조   — 결의대회 등
   */
  level: EventLevel;
}

/** 치수·배치 프리셋. 데이터·접근성·기하 규약은 두 값이 완전히 공유한다(§19.1) */
export type CalendarSize = "full" | "mini";

export interface StruggleCalendarProps {
  /** 표시할 일정. 정렬은 컴포넌트가 한다(호출부 정렬 의존 금지) */
  events: readonly CalendarEvent[];
  /** 기본 "full"(상세 페이지). "mini" 는 메인페이지 전용 */
  size?: CalendarSize;
  /** 기준 시각 주입구 — 테스트·프리뷰 전용. 미지정 시 렌더 시점 */
  now?: Date;
  className?: string;
}

/** 요일 표기는 문자열 추정이 아니라 Intl 로 만든다(§18.10) */
const WEEKDAY_NARROW_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  weekday: "narrow",
});
const WEEKDAY_LONG_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  weekday: "long",
});

/**
 * 카드 면 — **두 size 가 완전히 동일하다. 패딩을 바꾸지 마라(§19.1.1 ★).**
 * 메인과 상세는 컨테이너(`max-w-page` + `px-4 md:px-8`)가 같으므로 패딩이 같으면 모바일
 * 셀 폭이 39.42 / 37.28px 로 완전히 일치하고, §18.6.1-b 의 실측 여유(2.44 / **0.30px**)가
 * mini 에도 그대로 유효하다. 1px 이라도 건드리면 그 순간 재측정 트리거가 발동한다.
 */
const CARD_BASE = "rounded-panel bg-bg shadow-card p-3 md:p-6";

/**
 * 모든 셀 공통(높이는 size 프리셋이 준다) — radius 12px, 숫자와 라벨을 붙여 중앙 정렬.
 *
 * `whitespace-nowrap` 는 **줄바꿈 방어**다(QA 15회차 P2). 라벨은 세로 스택의 2번째 줄이라
 * 폭이 모자라면 `D-` / `20` 2줄로 쪼개진다. 셀 높이는 고정이므로 행이 밀리지는 않고
 * **내용이 색면 밖으로 빠져나간다** — 흰 라벨이 흰 카드 배경 위로 나가 읽을 수 없게 된다
 * (360px 실측: 라벨 22.5px→45px, 셀 scrollHeight 56→62). 현 데이터 최대값은 D-17 이라
 * 미발현이지만, 이 페이지는 2차 총파업 가능성을 안내하고 있어 3주 이상 뒤 일정이
 * 일정 목록에 들어오면 즉시 발현한다(360px 에서 D-20·D-22·D-23·D-25·D-28·D-29·D-30·
 * D-32~D-36·D-38·D-40 의 14개 값이 줄바꿈된다 — 브라우저 실측). **지우지 마라.**
 * 셀·라벨 어디에도 `overflow-hidden`·`truncate` 를 두지 않는다 — 줄바꿈을 막은 자리가
 * **잘림**이 되면 조합원이 `D-2…` 같은 잘린 D-n 을 보게 되어 줄바꿈보다 나쁘다.
 * 넘치더라도 카드 패딩(12px) 안에서 보이게 둔다 — 실측 최대 넘침은 `D-40` 의 0.69px 이고
 * 조상 전 계층이 `overflow: visible` 이라 잘리지 않는다.
 * 월 경계 `9/1` 표기(슬래시 뒤가 줄바꿈 기회)와 `오늘`(한글은 글자 사이에서 끊긴다)도
 * 같은 위험을 갖기에 라벨별로 붙이지 않고 **공통 클래스 한 곳**에서 처리한다.
 */
const CELL_BASE =
  "font-display flex w-full flex-col items-center justify-center gap-0.5 rounded-badge leading-none whitespace-nowrap";

/** size 별 치수·배치 (§19.1.1). 여기 없는 것은 전부 두 size 가 공유한다 */
const SIZE_PRESET: Record<
  CalendarSize,
  {
    card: string;
    cell: string;
    eventName: string;
    countdown: string;
    headlineGroup: string;
    table: string;
    caption: string;
  }
> = {
  full: {
    card: "",
    cell: "h-14 md:h-18",
    eventName: "text-lead text-ink",
    countdown: "font-display text-hero md:text-hero-lg mt-1",
    headlineGroup: "",
    table: "mt-5 md:mt-7",
    caption: "text-caption text-ink-muted mb-3 text-left",
  },
  mini: {
    /*
     * md+ 는 좌측 열(헤드라인·링크) + 우측 열(격자) 2열.
     *
     * **DOM 순서는 헤드라인 → 격자 → 링크로 고정**하고(모바일 시각 순서와 동일), md+ 에서만
     * 각 항목을 명시적으로 배치해 링크를 좌측 열로 되돌린다. CSS `order` 로 시각만 바꾸면
     * Tab 순서·스크린리더 낭독이 DOM 순서를 따라가 **보이는 것과 다른 순서로 읽힌다.**
     * 행은 `[auto_1fr]` — 1행은 헤드라인 높이, 격자가 두 행을 span 해 카드 높이를 정한다.
     * 세로 gap 은 0(`gap-x-6`)이라 링크는 헤드라인 바로 아래(`md:mt-4` = 16px)에 온다.
     *
     * 좌열 폭 12rem 을 늘리면 셀이 좁아진다 — 768px 기준 14rem 으로 키우면
     * 여유 17.9 → 13.3px. **재측정 트리거**다(§19.4.1)
     */
    card: "md:grid md:grid-cols-[12rem_1fr] md:grid-rows-[auto_1fr] md:gap-x-6 md:items-start",
    cell: "h-11 md:h-14",
    // min-w-0 · shrink-0: 일정명이 길어지면 2줄로 흐르고 D-n 은 줄지 않는다(§19.4.3)
    eventName: "text-caption text-ink min-w-0",
    countdown: "font-display text-title md:text-h1 mt-1 shrink-0",
    headlineGroup: "flex flex-wrap items-baseline gap-2 md:col-start-1 md:row-start-1 md:block",
    table: "mt-4 md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0",
    caption: "sr-only",
  },
};

/** 아웃라인은 내향으로 그린다 — 외향이면 인접 셀 여백(2px)을 침범해 격자가 어긋난다(§18.3.4) */
const OUTLINE_INSET = "outline-2 outline-offset-[-2px]";

/** 상태별 면·숫자 클래스 (§18.3.2). 전 조합 AAA(§18.9 · §19.6) */
const CELL_TODAY = `text-body font-bold text-primary ${OUTLINE_INSET} outline-primary`;
const CELL_EVENT_MAJOR = "bg-primary text-body font-bold text-white";
const CELL_EVENT_PEAK = "bg-urgent-strong text-lead font-bold text-white";
const CELL_PLAIN = "text-body text-ink";

/** 2번째 줄 라벨 — 15px 는 §16.3 하한이라 더 줄일 수 없다. 3글자 이상 라벨 금지(§18.6.1) */
const LABEL_TODAY = "text-caption font-medium text-primary";
const LABEL_MAJOR = "text-caption font-medium text-white";
const LABEL_PEAK = "text-caption font-semibold text-white";

/**
 * 격자 안 숫자 표기. 매월 1일은 `9/1` 형식 — 격자에서 월 전환을 알리는 유일한 표지라
 * 생략하지 않는다(§18.2.1).
 */
function cellNumberText(iso: string): string {
  const date = new Date(iso);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return day === 1 ? `${month}/${day}` : `${day}`;
}

export function StruggleCalendar({
  events,
  size = "full",
  now,
  className,
}: StruggleCalendarProps) {
  const preset = SIZE_PRESET[size];

  // 1~2. 오늘 이후 일정만, 날짜 오름차순(동일 날짜는 peak 우선).
  //      격자와 헤드라인이 같은 배열을 쓴다 — 단일 출처(§19.3.3)
  const today = todayIsoKst(now);
  const future = futureEventsInOrder(events, now);

  // 3. 남은 일정이 없으면 달력 자체를 렌더하지 않는다(§18.7 상태 E).
  //    "일정이 모두 종료되었습니다" 류의 안내 문구를 만들지 않는다 — 문안 창작 금지(§17.7)
  if (future.length === 0) return null;

  // 4~6. 오늘이 속한 주의 일요일 ~ 마지막 일정이 속한 주의 토요일 (항상 완전한 주)
  const last = future[future.length - 1];
  const start = addDaysIso(today, -weekdayIndexIso(today));
  const end = addDaysIso(last.date, 6 - weekdayIndexIso(last.date));
  const totalDays = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  const weeks: string[][] = [];
  for (let offset = 0; offset < totalDays; offset += 7) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysIso(start, offset + i)));
  }

  /*
   * 격자가 비면 렌더하지 않는다 — 아래 `weeks[0].map`(요일 헤더)이 `undefined` 를 읽어
   * TypeError 로 페이지 전체가 죽는 것을 막는다(QA 15회차 P5 · 17회차 Q2).
   *
   * **발생 조건**: `start`·`end` 중 하나라도 빈 문자열이면 `Date.parse("")` 가 `NaN` 이라
   * `totalDays` 가 `NaN` 이 되고, 위 for 문이 0회 돌아 `weeks` 가 `[]` 로 남는다.
   * `addDaysIso`·`todayIsoKst` 는 무효 입력에 빈 문자열을 주므로 무효한 `now` 가
   * 이 상태를 만든다.
   *
   * **지금은 도달 불가하다**(정직하게 기록한다): 무효한 `now` 는 그 전에
   * `futureEventsInOrder` → `daysUntilKst` 안의 `Intl.DateTimeFormat.formatToParts` 가
   * `RangeError: Invalid time value` 로 먼저 던진다(node 실측 확인). 즉 이 가드는 **현재
   * 버그를 고치는 코드가 아니라 구조적 방어**다 — 위 예외에 `null` 반환 가드가 붙는 순간
   * (그게 그 예외의 자연스러운 수정 방향이다) 이 경로가 곧바로 살아난다.
   * 호출부가 메인·상세 2곳으로 늘어 노출면이 커졌으므로 남겨 둔다.
   *
   * 반환 규약은 §18.7 상태 E("일정이 전부 지나면 null")와 같다 — 빈 카드·안내 문구 금지.
   */
  if (weeks.length === 0) return null;

  if (weeks.length > 6) {
    // 6행(42일)을 넘으면 "오늘과 목표가 한 화면에 함께 보인다"는 전제가 무너진다.
    // 렌더는 그대로 진행하되 리더 판단 요청 대상이다(§18.1.2)
    console.warn(
      `[StruggleCalendar] 격자가 ${weeks.length}행입니다(상한 6행). 설계 전제 재검토가 필요합니다.`,
    );
  }

  /*
   * 같은 날 2건도 잃지 않는다(§19.3.2) — 셀은 peak 를 표시하고 sr-only 는 그 날의 모든
   * 일정 제목을 나열한다. `new Map(future.map(...))` 로 만들면 **뒤 항목이 앞을 덮어**
   * major 가 peak 를 지운다. future 가 peak 우선으로 정렬돼 있으므로 배열 앞이 곧 대표다.
   */
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of future) {
    const sameDay = eventsByDate.get(event.date);
    if (sameDay === undefined) eventsByDate.set(event.date, [event]);
    else sameDay.push(event);
  }

  // 헤드라인 대상은 **가장 가까운 미래 일정**(§19.3 — §18.4 개정). 메인·상세가 같은 값을
  // 보여야 조합원이 날짜를 잘못 읽지 않는다. 총파업의 중대성은 격자의 적색 셀이 계속 담당한다
  const headline = future[0];
  const headlineDays = daysUntilKst(headline.date, now);
  const headlineColor =
    headline.level === "peak" ? "text-urgent-strong" : "text-primary";
  const rangeLabel = `${formatKoreanMonthDay(start)} – ${formatKoreanMonthDay(end)}`;

  const card = (
    <div className={[CARD_BASE, preset.card, size === "full" ? className : ""].filter((c) => c).join(" ")}>
      {/* 카운트다운. aria-live 를 쓰지 않는다(정적 렌더 값, §18.4) */}
      <div className={preset.headlineGroup || undefined}>
        <p className={preset.eventName}>
          {size === "mini" ? (
            <>
              {/* 시각 표기만 짧게. SR 은 긴 형식 그대로 얻는다(§19.4.3) */}
              <span aria-hidden="true">
                {formatMonthDaySlash(headline.date)} {headline.title}
              </span>
              <span className="sr-only">
                {formatKoreanMonthDay(headline.date)} {headline.title}
              </span>
            </>
          ) : (
            `${formatKoreanMonthDay(headline.date)} ${headline.title}`
          )}
        </p>
        <p className={`${preset.countdown} ${headlineColor}`}>
          {headlineDays !== null && headlineDays > 0 ? `D-${headlineDays}` : "오늘"}
        </p>
      </div>

      <table className={`${preset.table} w-full table-fixed`}>
        {/*
          mini 는 범위 표기를 화면에 띄우지 않는다 — 격자의 첫·마지막 칸 숫자와 월 경계
          `9/1` 표기가 범위를 이미 보여주고, 같은 정보가 상세 달력에 시각 노출돼 있다.
          SR 은 전문을 그대로 얻으므로 정보가 적지 않다(§19.5.2). 또한 메인에는 마감
          스트립이 있어 표 이름이 `26년 임단협` 으로 시작해야 구별된다(§19.1.2).
        */}
        <caption className={preset.caption}>
          {size === "mini" ? (
            `26년 임단협 투쟁 일정 달력입니다. ${rangeLabel}. 일정이 있는 날에는 일정 이름과 D-n 을 함께 읽습니다.`
          ) : (
            <>
              {rangeLabel}
              <span className="sr-only">
                , 총파업까지 남은 일정 달력입니다. 일정이 있는 날에는 일정 이름과 D-n 을 함께
                읽습니다.
              </span>
            </>
          )}
        </caption>
        <thead>
          <tr>
            {weeks[0].map((iso) => (
              <th key={iso} scope="col" className="text-caption pb-2 font-normal text-ink-muted">
                <span aria-hidden="true">{WEEKDAY_NARROW_FORMATTER.format(new Date(iso))}</span>
                <span className="sr-only">{WEEKDAY_LONG_FORMATTER.format(new Date(iso))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((iso) => {
                // 상태 판정은 배타적 — 위에서부터 먼저 맞는 것(§18.1.2 7단계)
                const sameDay = eventsByDate.get(iso);
                const isToday = iso === today;

                // 지난 칸은 숫자 없는 빈 칸. &nbsp; 도 넣지 않는다(§18.0 #2)
                if (iso < today) return <td key={iso} className="p-0.5 md:p-1" />;

                if (sameDay !== undefined) {
                  // 오늘과 겹치면 면 색은 일정이 이기고 오늘은 아웃라인으로 중첩한다(§18.3.4).
                  // 아웃라인을 빼면 "오늘"이라는 정보가 소실되므로 §16.5 의 승인된 예외다
                  const peak = sameDay[0].level === "peak";
                  const days = daysUntilKst(iso, now);
                  const label = isToday ? "오늘" : `D-${days}`;
                  return (
                    <td key={iso} className="p-0.5 md:p-1">
                      <time
                        dateTime={iso}
                        className={`${CELL_BASE} ${preset.cell} ${
                          peak ? CELL_EVENT_PEAK : CELL_EVENT_MAJOR
                        } ${isToday ? `${OUTLINE_INSET} outline-white` : ""}`}
                      >
                        <span aria-hidden="true">{cellNumberText(iso)}</span>
                        <span aria-hidden="true" className={peak ? LABEL_PEAK : LABEL_MAJOR}>
                          {label}
                        </span>
                        <span className="sr-only">
                          {formatKoreanMonthDay(iso)}{" "}
                          {sameDay.map((event) => event.title).join(", ")}, {label}
                        </span>
                      </time>
                    </td>
                  );
                }

                if (isToday) {
                  return (
                    <td key={iso} className="p-0.5 md:p-1">
                      <time dateTime={iso} className={`${CELL_BASE} ${preset.cell} ${CELL_TODAY}`}>
                        <span aria-hidden="true">{cellNumberText(iso)}</span>
                        <span aria-hidden="true" className={LABEL_TODAY}>
                          오늘
                        </span>
                        <span className="sr-only">{formatKoreanMonthDay(iso)} 오늘</span>
                      </time>
                    </td>
                  );
                }

                // 일반 칸에는 sr-only 를 넣지 않는다 — 18칸을 전부 읽으면 표 탐색이 소음이 된다.
                // 월 경계(매월 1일)만 예외로 완전 표기한다(§18.8.1)
                const monthBoundary = new Date(iso).getUTCDate() === 1;
                return (
                  <td key={iso} className="p-0.5 md:p-1">
                    <time dateTime={iso} className={`${CELL_BASE} ${preset.cell} ${CELL_PLAIN}`}>
                      {monthBoundary ? (
                        <>
                          <span aria-hidden="true">{cellNumberText(iso)}</span>
                          <span className="sr-only">{formatKoreanMonthDay(iso)}</span>
                        </>
                      ) : (
                        cellNumberText(iso)
                      )}
                    </time>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {size === "mini" ? (
        /*
         * 상세 진입점. HeroPanel 은 urgent 공지가 1건이라도 있으면 모드 1 로 전환되어
         * 투쟁 안내 CTA 가 사라진다 — 이 링크가 없으면 메인에서 /bargaining-2026 으로
         * 가는 경로가 0개가 된다(§19.2.2). 카드 전체를 링크로 만들지 않는다(§17.1).
         *
         * **격자 뒤에 온다.** 링크는 격자를 본 다음의 출구이므로 본체보다 먼저 나오면
         * 훑는 화면에서 조합원이 격자를 지나치고 링크만 본다(리더 판정 2026-08-18).
         * md+ 에서만 좌측 열(1열 2행)로 되돌아간다 — DOM 순서는 그대로다.
         */
        <p className="mt-3 md:col-start-1 md:row-start-2 md:mt-4">
          <Link
            href={ROUTES.bargaining}
            className="ease-out-soft inline-flex min-h-touch items-center gap-1 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            자세히 보기
            <ArrowRightIcon className="size-5" />
          </Link>
        </p>
      ) : null}
    </div>
  );

  /*
   * mini 는 메인에 블록으로 얹히므로 이름이 필요하다 — `<h2>` 를 만들면 헤딩 아웃라인
   * (h1 지부명 → h2×4 섹션)이 깨진다. HeroPanel 과 같은 `aria-label` 패턴을 쓴다(§19.1.2).
   * full 은 상세 페이지의 `<section aria-labelledby="schedule-heading">` 안에 이미 들어간다.
   */
  return size === "mini" ? (
    <section aria-label="26년 임단협 투쟁 안내" className={className}>
      {card}
    </section>
  ) : (
    card
  );
}
