import {
  addDaysIso,
  daysUntilKst,
  formatKoreanMonthDay,
  todayIsoKst,
  weekdayIndexIso,
} from "@/lib/date";

/**
 * 카운트다운 달력 (디자인 스펙 §18) — `/bargaining-2026` 남은 일정 전용.
 *
 * 이 컴포넌트는 **추가 레이어**다. 아래 상세 카드(장소·시간·상세 안내)를 대체하지 않으며,
 * 달력이 렌더되지 않는 상태(§18.7 상태 E)에서도 카드만으로 정보가 완결되어야 한다.
 *
 * 설계상 되살리면 안 되는 것(§18.0 버린 안):
 *  - 월 단위 격자(8월 전체 + 9월 전체) — 62칸에 일정 2칸이면 임박함이 희석된다.
 *    범위는 **오늘이 속한 주의 일요일 ~ 마지막 일정이 속한 주의 토요일** 연속 1개 격자다.
 *  - 지난 날짜의 흐린 회색 숫자 — #6b7280 on #ffffff 는 4.83 으로 AAA 미달(§0.3).
 *    지난 칸은 **숫자 없는 빈 칸**이다.
 *  - `role="grid"` — 방향키 이동이 가능한 인터랙티브 위젯의 role 이다. 이 달력은 비인터랙티브다.
 *  - hover·트랜지션·등장 애니메이션 — 마우스에만 반응하는 상태를 만들지 않는다(§0.4 · §18.8.3).
 *
 * 색은 **중대도**(level)가 정하고 **임박도**는 D-n 숫자와 헤드라인이 담당한다(§18.3.2).
 * D-n 으로 색을 정하면 8/28·9/4 가 같은 색이 되어 총파업의 중대성이 화면에서 사라진다.
 */

export interface CalendarEvent {
  /** 날짜 전용 ISO (YYYY-MM-DD) — SCHEDULE 의 date 를 그대로 넘긴다 */
  date: string;
  /** 일정 정식 명칭. 스크린리더 낭독·카드와 동일 문자열을 쓴다(축약 금지) */
  title: string;
  /**
   * 중대도. 색·굵기를 결정한다. 임박도가 아니다(§18.3.2).
   * - "peak"  : 최상위 — 총파업
   * - "major" : 강조   — 결의대회 등
   */
  level: "peak" | "major";
}

export interface StruggleCalendarProps {
  /** 표시할 일정. 정렬은 컴포넌트가 한다(호출부 정렬 의존 금지) */
  events: readonly CalendarEvent[];
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
 * 모든 셀 공통 — 높이 56px(모바일)/72px(md+), radius 12px. 숫자와 라벨을 붙여 중앙 정렬.
 *
 * `whitespace-nowrap` 는 **줄바꿈 방어**다(QA 15회차 P2). 라벨은 세로 스택의 2번째 줄이라
 * 폭이 모자라면 `D-` / `20` 2줄로 쪼개진다. 셀 높이는 `h-14` 로 고정이므로 행이 밀리지는
 * 않고 **내용이 색면 밖으로 빠져나간다** — 흰 라벨이 흰 카드 배경 위로 나가 읽을 수 없게 된다
 * (360px 실측: 라벨 22.5px→45px, 셀 scrollHeight 56→62). 현 데이터 최대값은 D-17 이라
 * 미발현이지만, 이 페이지는 2차 총파업 가능성을 안내하고 있어 3주 이상 뒤 일정이
 * SCHEDULE 에 들어오면 즉시 발현한다(360px 에서 D-20·D-22·D-23·D-25·D-28·D-29·D-30·
 * D-32~D-36·D-38·D-40 의 14개 값이 줄바꿈된다 — 브라우저 실측).
 * 셀·라벨 어디에도 `overflow-hidden`·`truncate` 를 두지 않는다 — 줄바꿈을 막은 자리가
 * **잘림**이 되면 조합원이 `D-2…` 같은 잘린 D-n 을 보게 되어 줄바꿈보다 나쁘다.
 * 넘치더라도 카드 패딩(12px) 안에서 보이게 둔다 — 실측 최대 넘침은 `D-40` 의 0.69px 이고
 * 조상 전 계층이 `overflow: visible` 이라 잘리지 않는다.
 * 월 경계 `9/1` 표기(슬래시 뒤가 줄바꿈 기회)와 `오늘`(한글은 글자 사이에서 끊긴다)도
 * 같은 위험을 갖기에 라벨별로 붙이지 않고 **공통 클래스 한 곳**에서 처리한다.
 */
const CELL_BASE =
  "font-display flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-badge leading-none whitespace-nowrap md:h-18";

/** 아웃라인은 내향으로 그린다 — 외향이면 인접 셀 여백(2px)을 침범해 격자가 어긋난다(§18.3.4) */
const OUTLINE_INSET = "outline-2 outline-offset-[-2px]";

/** 상태별 면·숫자 클래스 (§18.3.2). 전 조합 AAA(§18.9) */
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

export function StruggleCalendar({ events, now, className }: StruggleCalendarProps) {
  // 1~2. 오늘 기준 미래 일정만 남긴다 (daysUntilKst 는 무효 입력에 null 을 준다 —
  //      null >= 0 은 JS 에서 true 이므로 반드시 null 을 먼저 걸러낸다)
  const today = todayIsoKst(now);
  const future = events
    .filter((event) => {
      const days = daysUntilKst(event.date, now);
      return days !== null && days >= 0;
    })
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

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

  if (weeks.length > 6) {
    // 6행(42일)을 넘으면 "오늘과 목표가 한 화면에 함께 보인다"는 전제가 무너진다.
    // 렌더는 그대로 진행하되 리더 판단 요청 대상이다(§18.1.2)
    console.warn(
      `[StruggleCalendar] 격자가 ${weeks.length}행입니다(상한 6행). 설계 전제 재검토가 필요합니다.`,
    );
  }

  const eventByDate = new Map(future.map((event) => [event.date, event]));

  // 헤드라인 대상은 총파업(peak). 없으면 가장 가까운 미래 일정 (§18.4)
  const headline = future.find((event) => event.level === "peak") ?? future[0];
  const headlineDays = daysUntilKst(headline.date, now);

  return (
    <div className={`rounded-panel bg-bg shadow-card p-3 md:p-6 ${className ?? ""}`}>
      {/* 카운트다운 — 페이지에서 가장 큰 글자. aria-live 를 쓰지 않는다(정적 렌더 값, §18.4) */}
      <p className="text-lead text-ink">
        {formatKoreanMonthDay(headline.date)} {headline.title}
      </p>
      <p className="font-display text-hero text-urgent-strong md:text-hero-lg mt-1">
        {headlineDays !== null && headlineDays > 0 ? `D-${headlineDays}` : "오늘"}
      </p>

      <table className="mt-5 w-full table-fixed md:mt-7">
        <caption className="text-caption text-ink-muted mb-3 text-left">
          {formatKoreanMonthDay(start)} – {formatKoreanMonthDay(end)}
          <span className="sr-only">
            , 총파업까지 남은 일정 달력입니다. 일정이 있는 날에는 일정 이름과 D-n 을 함께 읽습니다.
          </span>
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
                const event = eventByDate.get(iso);
                const isToday = iso === today;

                // 지난 칸은 숫자 없는 빈 칸. &nbsp; 도 넣지 않는다(§18.0 #2)
                if (iso < today) return <td key={iso} className="p-0.5 md:p-1" />;

                if (event !== undefined) {
                  // 오늘과 겹치면 면 색은 일정이 이기고 오늘은 아웃라인으로 중첩한다(§18.3.4).
                  // 아웃라인을 빼면 "오늘"이라는 정보가 소실되므로 §16.5 의 승인된 예외다
                  const peak = event.level === "peak";
                  const days = daysUntilKst(iso, now);
                  const label = isToday ? "오늘" : `D-${days}`;
                  return (
                    <td key={iso} className="p-0.5 md:p-1">
                      <time
                        dateTime={iso}
                        className={`${CELL_BASE} ${peak ? CELL_EVENT_PEAK : CELL_EVENT_MAJOR} ${
                          isToday ? `${OUTLINE_INSET} outline-white` : ""
                        }`}
                      >
                        <span aria-hidden="true">{cellNumberText(iso)}</span>
                        <span aria-hidden="true" className={peak ? LABEL_PEAK : LABEL_MAJOR}>
                          {label}
                        </span>
                        <span className="sr-only">
                          {formatKoreanMonthDay(iso)} {event.title}, {label}
                        </span>
                      </time>
                    </td>
                  );
                }

                if (isToday) {
                  return (
                    <td key={iso} className="p-0.5 md:p-1">
                      <time dateTime={iso} className={`${CELL_BASE} ${CELL_TODAY}`}>
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
                    <time dateTime={iso} className={`${CELL_BASE} ${CELL_PLAIN}`}>
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
    </div>
  );
}
