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
 * 카운트다운 달력(디자인 스펙 §18 · §19) — `/bargaining-2026`(full)과 메인페이지(mini). `size` 는 치수·배치
 * 프리셋일 뿐이고 데이터·범위 계산·상태 판정·`sr-only` 규약·셀 폭 기하는 두 size 가 100% 공유한다.
 * 달력이 렌더되지 않아도(§18.7 상태 E) 상세 페이지 카드만으로 정보가 완결되는 **추가 레이어**다(§19.0.2).
 *
 * ⚠ **별도 `MiniCalendar` 를 만들지 마라** — 셀 폭 여유가 1px 미만이라 기하가 갈리면 조용히 깨진다(§19.1.1).
 * ⚠ **월 단위 격자로 되돌리지 마라** — 62칸에 일정 2칸이면 임박함이 희석된다(§18.0).
 * ⚠ **지난 날짜에 흐린 회색 숫자를 넣지 마라** — AAA 미달이다(§0.3). 지난 칸은 숫자 없는 빈 칸이다.
 * ⚠ **`role="grid"` 를 붙이지 마라** — 방향키 이동이 되는 위젯의 role 인데 이 달력은 비인터랙티브다.
 * ⚠ **hover·트랜지션·등장 애니메이션 금지** — 마우스에만 반응하는 상태를 만들지 않는다(§0.4 · §18.8.3).
 * ⚠ **mini 에서 셀을 좁히거나 행 수를 줄이지 마라** — 행이 줄면 9/4 총파업이 사라진다. **축소가 곧 은폐**다.
 * ⚠ **셀 색을 D-n 으로 정하지 마라** — 색은 중대도(level)가 진다. D-n 이면 8/28·9/4 가 같은 색이 된다(§18.3.2).
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

/** 카드 면 — **두 size 가 완전히 동일하다. 패딩을 바꾸지 마라**(§19.1.1 ★). 메인·상세의 컨테이너가 같아
 *  패딩이 같아야 모바일 셀 폭과 §18.6.1-b 의 실측 여유가 mini 에도 그대로 유효하다.
 *  **1px 이라도 건드리면 그 순간 재측정 트리거가 발동한다.** */
const CARD_BASE = "rounded-panel bg-bg shadow-card p-3 md:p-6";

/**
 * 모든 셀 공통(높이는 size 프리셋이 준다) — radius 12px, 숫자와 라벨을 붙여 중앙 정렬.
 * ⚠ **`whitespace-nowrap` 을 지우지 마라**(QA 15회차 P2) — 라벨이 2줄로 쪼개지면 셀 높이가 고정이라 행은
 *   안 밀리고 **내용이 색면 밖으로 빠져나가** 흰 라벨이 흰 카드 위에 놓인다(현 데이터로는 미발현).
 * ⚠ **`overflow-hidden`·`truncate` 를 두지 마라** — 잘린 `D-2…` 는 줄바꿈보다 나쁘다. 넘쳐도 패딩 안이다.
 * ⚠ **`gap-1` 을 `gap-0.5` 로 되돌리지 마라** — 모바일 셀 상하 여백이 4.5px 까지 눌린다(md+ 는 무관).
 */
const CELL_BASE =
  "font-display flex w-full flex-col items-center justify-center gap-1 rounded-badge leading-none whitespace-nowrap";

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
    cell: "h-16 md:h-20",
    eventName: "text-lead text-ink",
    countdown: "font-display text-hero md:text-hero-lg mt-1",
    headlineGroup: "",
    table: "mt-5 md:mt-7",
    caption: "text-caption text-ink-muted mb-3 text-left",
  },
  mini: {
    /* md+ 는 좌열(헤드라인·링크) + 우열(격자) 2열이고 격자가 두 행을 span 한다.
       ⚠ **DOM 순서는 헤드라인 → 격자 → 링크로 고정**하고 md+ 에서만 명시 배치로 링크를 좌열로 되돌린다 —
         CSS `order` 로 시각만 바꾸면 Tab 순서·낭독이 **보이는 것과 다른 순서**가 된다.
       ⚠ 좌열 폭 `12rem` 을 늘리면 셀이 좁아진다 — **재측정 트리거**다(§19.4.1) */
    card: "md:grid md:grid-cols-[12rem_1fr] md:grid-rows-[auto_1fr] md:gap-x-6 md:items-start",
    cell: "h-14 md:h-16",
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

/** `D-n`·`오늘` 라벨 — **13px**. `--text-caption` 의 «15px 하한»을 어긴 것이 아니라 **적용 대상이 다르다**:
 *  그 하한은 보조 **문장**의 것이고 여기는 **숫자 배지 안의 라벨**이다(15px 이면 `D-13` 이 테두리에 붙는다).
 *  전문은 `sr-only` 가 그대로 읽어 정보 손실 0 이고 `rem` 이라 슬라이더를 따라 커진다.
 *  ⚠ **3글자 이상 라벨 금지**(§18.6.1). */
const LABEL_SIZE = "text-[0.8125rem] leading-none";
const LABEL_TODAY = `${LABEL_SIZE} font-medium text-primary`;
const LABEL_MAJOR = `${LABEL_SIZE} font-medium text-white`;
const LABEL_PEAK = `${LABEL_SIZE} font-semibold text-white`;

/** 격자 안 숫자 표기. 매월 1일은 `9/1` 형식 — 격자에서 월 전환을 알리는 유일한 표지라 생략하지 않는다(§18.2.1) */
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

  // 1~2. 오늘 이후 일정만, 날짜 오름차순(동일 날짜는 peak 우선). 격자·헤드라인 단일 출처(§19.3.3)
  const today = todayIsoKst(now);
  const future = futureEventsInOrder(events, now);

  // 3. 남은 일정이 없으면 달력 자체를 렌더하지 않는다(§18.7 상태 E).
  //    ⚠ "일정이 모두 종료되었습니다" 류 안내 문구를 만들지 마라 — 문안 창작 금지(§17.7)
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

  /* 격자가 비면 렌더하지 않는다 — `weeks[0].map` 이 `undefined` 를 읽어 페이지가 죽는 것을 막는다
     (QA 15회차 P5 · 17회차 Q2). **지금은 도달 불가하다**(무효 `now` 는 그 전에 `Intl` 이 `RangeError` 로
     던진다) — 버그 수정이 아니라 **구조적 방어**이고, 그 예외에 `null` 가드가 붙는 순간 살아난다.
     ⚠ 반환 규약은 §18.7 상태 E 와 같다 — **빈 카드·안내 문구 금지** */
  if (weeks.length === 0) return null;

  if (weeks.length > 6) {
    // 6행(42일)을 넘으면 "오늘과 목표가 한 화면에 보인다"는 전제가 무너진다 — 리더 판단 대상(§18.1.2)
    console.warn(
      `[StruggleCalendar] 격자가 ${weeks.length}행입니다(상한 6행). 설계 전제 재검토가 필요합니다.`,
    );
  }

  /* 같은 날 2건도 잃지 않는다(§19.3.2) — 셀은 peak 를 표시하고 `sr-only` 는 그 날 전부를 나열한다.
     ⚠ `new Map(future.map(...))` 로 만들지 마라 — **뒤 항목이 앞을 덮어** major 가 peak 를 지운다 */
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of future) {
    const sameDay = eventsByDate.get(event.date);
    if (sameDay === undefined) eventsByDate.set(event.date, [event]);
    else sameDay.push(event);
  }

  // 헤드라인 대상은 **가장 가까운 미래 일정**(§19.3) — 메인·상세가 같은 값을 보여야 날짜를 잘못 안 읽는다
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
        {/* mini 는 범위 표기를 화면에 안 띄운다 — 격자 숫자와 `9/1` 이 이미 범위를 보여주고 SR 은 전문을
            얻는다(§19.5.2). 표 이름은 `26년 임단협` 으로 시작해야 마감 스트립과 구별된다(§19.1.2) */}
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
                  // 오늘과 겹치면 면 색은 일정이 이기고 오늘은 아웃라인으로 중첩한다 — 아웃라인을 빼면
                  // "오늘"이 소실되므로 §16.5 의 승인된 예외다(§18.3.4)
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

                // 일반 칸에 `sr-only` 를 넣지 않는다(18칸 전부 읽으면 소음). 월 경계만 완전 표기(§18.8.1)
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
        /* 상세 진입점. ⚠ **지우지 마라** — `HeroPanel` 이 urgent 공지 1건에도 모드 1 로 전환돼 투쟁 안내
           CTA 가 사라지므로, 이것이 없으면 메인에서 `/bargaining-2026` 으로 가는 경로가 0개가 된다(§19.2.2).
           ⚠ **격자 «뒤»에 온다** — 앞에 오면 훑는 화면에서 조합원이 격자를 지나치고 링크만 본다.
           ⚠ **카드 전체를 링크로 만들지 마라**(§17.1 패널 전체 링크 금지) — 진입점은 이 링크 하나다 */
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

  /* mini 는 메인에 블록으로 얹혀 이름이 필요한데 `<h2>` 를 만들면 헤딩 아웃라인이 깨진다 — `HeroPanel`
     과 같은 `aria-label` 패턴을 쓴다(§19.1.2). full 은 상세 페이지의 `<section aria-labelledby>` 안이다 */
  return size === "mini" ? (
    <section aria-label="26년 임단협 투쟁 안내" className={className}>
      {card}
    </section>
  ) : (
    card
  );
}
