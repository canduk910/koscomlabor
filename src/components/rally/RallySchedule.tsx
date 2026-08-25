/**
 * 결의대회 순서(식순) 16행 + **코스콤 조합원 일정 열**(디자인 스펙 §20.3.6).
 *
 * 원문: 주최측 안내자료 이미지 2 "6. 결의대회 순서" 전사
 * (`_workspace/00_input/content-rally-20260828.md` §4). **시각·항목명을 고치지 마라.**
 *
 * ★ **예외 하나 — 첫 행 시작 시각을 `18:00` → `17:40` 으로 바꿨다**(사용자 지시 2026-08-25).
 * 코스콤 일정이 **17:40 에 시작**하는데 표가 18:00 부터라 그 항목을 놓을 행이 없었다.
 * **나머지 15행의 시각은 하나도 건드리지 않았다.**
 *
 * ★★ **코스콤 조합원 일정 열 추가**(사용자 지시 2026-08-25 · 원문은 사용자가 첨부한
 * `4. 조합원 상세일정` 표). 우리 일정이 공식 식순의 **여러 행에 걸치면 그 열만 병합**한다
 * (`rowSpan`). 예: `결의대회 행사(19:00~20:30)` 는 공식 3~15행을 한 칸으로 덮는다.
 *
 * ⚠ **우리 열의 각 항목에 «자기 시각»을 함께 적는다.** 우리 일정의 경계가 공식 식순의 행
 * 경계와 **일치하지 않기 때문**이다(예: `종료 출석체크 20:20~20:30` 은 공식 마지막 행
 * `20:20~` 안에 있다). 시각을 빼면 행 경계가 우리 시각인 것처럼 읽혀 **거짓이 된다.**
 *
 * ⚠ **원문의 `(3구역 내 예정, 추후 상세 안내)` 는 지웠다**(사용자 확인 2026-08-25 — *"3구역 확정이야"*).
 * 남긴 표기는 `집회장소 내 코스콤지역 (3구역)` 이다.
 * **되살리지 마라** — 페이지 본문과 지도는 3구역을 **확정 사실**로 말하고 있어(`코스콤지부는 집회
 * 3구역입니다` · 지도 ③ `코스콤 집결위치`), `예정` 이 한 칸에라도 남으면 **같은 페이지가 같은 사실을
 * 두 가지 확정도로 말하게 된다.** 조합원은 낮은 쪽을 믿는다.
 *
 * ## 3열 레이아웃 — 종전 «3열은 성립하지 않는다» 는 판단을 바꾼 근거
 *
 * 종전 주석: *"비고 열을 만들지 않는다: 360px 에서 3열은 성립하지 않는다(내용 열이 100px
 * 이하로 눌린다)"*. 그 계산의 전제는 **시간 열 112px** 이었다.
 * 시간 열을 **모바일에서 72px 로** 줄여 그 전제를 없앴다 — `<wbr>` 이 이미 `17:40~` / `18:30`
 * 두 줄을 허용하고 있어 112px 이 필요하지 않다. 남는 폭은 내용/코스콤 열이 나눠 갖는다.
 * ⚠ **폭을 다시 만지면 390px 에서 실측하라.**
 *
 * 게시 조건 (검증 리포트 4회차 §7):
 * - `※ 상황에 따라 식순 변경 가능` 을 표와 **같은 화면**에 둔다(§7-2) — 표 위·아래 2곳.
 * - 인명은 **소속 병기 필수**(§7-1).
 */

interface ScheduleRow {
  time: string;
  content: string;
  /** 원문 "비고" 열의 인명. 소속을 반드시 포함한다(검증 §7-1) */
  person: string | null;
  /**
   * 이 행에서 시작하는 **코스콤 조합원 일정 칸**. 없으면 위 칸의 `rowSpan` 에 덮여 있다는 뜻이다.
   * ⚠ `rowSpan` 합이 **정확히 16** 이어야 표가 깨지지 않는다 — 항목을 고치면 다시 세라.
   */
  koscom?: {
    rowSpan: number;
    items: readonly KoscomItem[];
  };
}

/** 코스콤 일정 한 항목 — 원문(사용자 첨부 `4. 조합원 상세일정`)의 한 행에 대응한다 */
interface KoscomItem {
  /** **반드시 적는다** — 공식 행 경계와 우리 시각이 다르기 때문이다(위 주석) */
  time: string;
  title: string;
  /** 원문 `상세내용` 의 하위 항목 */
  details?: readonly string[];
  /** 원문 `비고` 열 */
  note?: string;
}

const RALLY_PROGRAM: readonly ScheduleRow[] = [
  {
    /* ★ `18:00` 에서 바꾼 유일한 시각(사용자 지시) — 근거는 파일 상단 주석 */
    time: "17:40~18:30",
    content: "장내 정리 및 조합원 안내",
    person: null,
    koscom: {
      rowSpan: 1,
      items: [
        {
          time: "17:40~18:30",
          title: "퇴근 후 집결장소 이동",
          /*
           * ⚠ **원문은 `국회지하도보` 였다.** 오타로 판단해 `국회지하보도` 로 고쳤다(사용자 확인 2026-08-25).
           * 원문 보존이 기본이지만, **오타를 그대로 두면 조합원이 «도보 경로»로 오독**한다 —
           * 실제로 가리키는 것은 국회 앞 **지하보도**(지하 통로)다. 글자 두 개를 뒤집은 것 외에는 무수정이다.
           */
          note: "여의도 의사당대로(국회의사당역 인근) · 대중교통 이용 또는 한화손해보험 커피앳웍스 앞 국회지하보도 이용",
        },
      ],
    },
  },
  {
    time: "18:30~19:00",
    content: "사전집회",
    person: null,
    /* 우리 항목 **둘**이 이 한 행 안에 들어간다 — 병합이 아니라 한 칸에 두 항목이다 */
    koscom: {
      rowSpan: 1,
      items: [
        {
          time: "18:30~18:50",
          title: "참석명단 작성 및 물품 수령",
          details: [
            "참석명단 작성 (금융노조 QR코드 인증도 진행)",
            "투쟁용품 수령 (투쟁조끼, 손피켓, 우천 시 우의 등)",
            "저녁간식 수령",
          ],
          /* 원문의 `예정 · 추후 상세 안내` 는 뺐다 — 근거는 파일 상단 주석 */
          note: "집회장소 내 코스콤지역 (3구역)",
        },
        {
          time: "18:50~19:00",
          title: "시작 출석체크",
          note: "담당 운영위원 및 금융노조 출석QR코드",
        },
      ],
    },
  },
  {
    time: "19:00~19:05",
    content: "개회선언, 지도부/내외빈 입장",
    person: null,
    /* 공식 3~15행(19:00~20:20)을 한 칸으로 덮는다. **13 을 고치면 아래 행 수와 다시 맞춰라** */
    koscom: {
      rowSpan: 13,
      items: [{ time: "19:00~20:30", title: "결의대회 행사", note: "금융노조 진행" }],
    },
  },
  { time: "19:05~19:10", content: "깃발 입장", person: null },
  { time: "19:10~19:15", content: "노동의례", person: null },
  { time: "19:15~19:25", content: "참가 조직 소개", person: null },
  { time: "19:25~19:35", content: "대회사", person: "윤석구 금융노조 위원장" },
  { time: "19:35~19:40", content: "2분 현장발언", person: null },
  { time: "19:40~19:50", content: "문화공연", person: null },
  { time: "19:50~19:55", content: "격려사", person: "김동명 한국노총 위원장" },
  { time: "19:55~20:00", content: "국회의원 발언", person: null },
  { time: "20:00~20:05", content: "2분 현장발언", person: null },
  { time: "20:05~20:10", content: "상징의식", person: null },
  { time: "20:10~20:15", content: "결의문 낭독", person: null },
  { time: "20:15~20:20", content: "구호제창 및 파업가 제창", person: null },
  {
    time: "20:20~",
    content: "폐회선언",
    person: null,
    koscom: {
      rowSpan: 1,
      items: [
        { time: "20:20~20:30", title: "종료 출석체크", note: "담당 운영위원 및 금융노조 출석QR코드" },
        {
          time: "20:30~",
          title: "투쟁용품 반납 및 해산",
          details: ["투쟁용품 반납 (투쟁조끼)"],
          note: "집회장소에서 반납",
        },
      ],
    },
  },
];

/**
 * 시각 문자열에 **`~` 뒤 줄바꿈 기회(`<wbr>`)** 를 준다.
 *
 * 시각은 끊어 읽으면 안 되는 값이라 스펙(§20.3.6)은 `whitespace-nowrap` 을 썼는데,
 * 그대로 두면 **텍스트 확대에서 열 폭을 넘어 옆 열 위로 겹쳐 찍힌다**(실측).
 * `~` 한 지점만 열어 두면 기본 크기에서는 1줄을 유지하고 확대에서만 갈라진다.
 * 숫자·콜론에는 줄바꿈 기회가 없으므로 **여기 말고는 끊기지 않는다.**
 *
 * ⚠ **코스콤 열의 시각에도 반드시 쓴다**(2026-08-25). 안 쓰면 `19:00~20:30` 같은
 * 11글자가 **통째로 끊기지 않는 덩어리**가 되어, 확대 시 그 열에서 가장 크게 넘치는 요소가 된다.
 */
function TimeText({ value }: { value: string }) {
  const i = value.indexOf("~");
  if (i < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, i + 1)}
      <wbr />
      {value.slice(i + 1)}
    </>
  );
}

/** 표 위·아래 2곳에 같은 문장을 둔다 — 원문 표 하단 단서이며 검증 §7-2 의 게시 조건이다 */
const CHANGE_NOTE = "※ 상황에 따라 식순 변경 가능";

export function RallySchedule() {
  return (
    <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
      {/*
        ★ **가로 스크롤 컨테이너**(2026-08-25 · 사용자 지시 *"확대하더라도 안 넘치게"*).

        **왜 «표만 미는 것» 이 최선인가 — 3열을 유지하는 한 확대에서 완전히 담을 수 없다.**
        360px + 텍스트 확대 200% 실측: 페이지 여백 `px-4`(16→32) 와 카드 패딩 `p-5`(20→40) 가
        **rem 이라 함께 2배**가 되어 표에 남는 폭이 **216px** 뿐이다. 그 안에서
        시간 78(px 고정) + 공식 38% = 82 → **코스콤 열에 56px** 만 남는다.
        한국어 22.5px 글자 기준 **두 글자**도 못 담는 폭이다.
        필요한 최소치는 시간 92 + 공식 111 + 코스콤 130 ≈ **333px** 로, 216px 로는 성립하지 않는다.

        그래서 **문서가 밀리지 않게** 하는 쪽을 택했다 — 넘침은 이 상자 안에서 끝난다.
        기본 크기에서는 표가 이미 들어가므로 **스크롤바가 뜨지 않고 화면은 종전과 픽셀 동일**이다.

        ⚠ **`#9` 의 함정(스크롤 컨테이너 안 `position:absolute` 요소가 밖으로 새 나간다)은
        이 표에 해당하지 않는다** — `absolute` 자손 **0개**를 실측으로 확인했다.
        나중에 `sr-only`(=`absolute`)를 표 안에 넣으려면 **그 셀에 `relative` 를 함께** 줘라.
        ⚠ 스크롤바를 숨기지 마라(§ 탭 줄 선례) — 더 있다는 단서가 사라진다.
      */}
      <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <caption className="mb-3 break-keep text-left text-caption text-ink">{CHANGE_NOTE}</caption>
        <thead>
          <tr>
            {/*
              ⚠ 종전 주석은 *"`w-[112px]` 을 줄이지 마라"* 였다. **그 값의 근거는 «한 줄로 담기»** 였는데,
              시각 셀은 이미 `<wbr>` 로 두 줄을 허용하고 있어(아래 참조) 한 줄이 조건이 아니다.
              3열이 되면서 폭이 더 비싸졌으므로 **모바일 78 / md+ 128** 로 줄였다.

              ★ **78 은 실측으로 정한 값이다.** 처음 72 로 잡았더니 `20:00~20:05` 가 두 줄로 깨졌다 —
              가장 긴 시각 문자열이 **66.2px** 인데 `pr-1.5`(6px)를 빼면 가용이 **66.0px** 이라
              **0.2px 모자랐다.** 78 이면 가용 72px 로 5.8px 여유가 있다.
              ⚠ **다시 줄이려면 이 66.2 를 먼저 재라** — 서체·글자 크기가 바뀌면 값도 바뀐다.
              (텍스트 확대 200% 에서는 `<wbr>` 이 두 줄로 갈라 겹침을 막는다 — 그때는 두 줄이 정상이다.)
            */}
            <th
              scope="col"
              className="w-[78px] pb-2 text-left text-caption font-semibold text-ink-muted md:w-[128px]"
            >
              시간
            </th>
            {/* 이름을 `내용` 에서 바꿨다 — 옆에 우리 일정 열이 생긴 이상 **누구의 순서인지**가 없으면
                두 열을 섞어 읽는다. 원문 표의 항목명은 그대로다. */}
            <th
              scope="col"
              className="w-[38%] pb-2 pr-3 text-left text-caption font-semibold text-ink-muted"
            >
              금융노조 공식 순서
            </th>
            {/* 우리 열은 **면으로 구분**한다(§2 — 색만으로 뜻을 싣지 않는다: 제목이 이름을 진다) */}
            <th
              scope="col"
              className="rounded-t-card bg-primary-tint px-3 pb-2 pt-2 text-left text-caption font-semibold text-primary"
            >
              코스콤 조합원 일정
            </th>
          </tr>
        </thead>
        <tbody>
          {RALLY_PROGRAM.map((row) => (
            /*
              ⚠ **테두리를 `<tr>` 이 아니라 `<td>` 에 준다.** `border-collapse: collapse` 에서
              `<tr>` 테두리는 **행 전체를 가로지르므로 병합된 칸을 잘라 버린다** — 13행을 덮은
              `결의대회 행사` 칸에 가로줄이 12개 그어진다. 셀에 주면 병합 칸에는 한 번만 그어진다.
            */
            <tr key={row.time}>
              {/*
                시각은 **끊어 읽으면 안 되는 값**이라 스펙(§20.3.6)은 `whitespace-nowrap` 을 썼다.
                그대로 두면 텍스트 확대 200%에서 시간 문자열이 열 폭을 넘어 **내용 열 위로 겹쳐
                찍힌다**(실측). 그래서 nowrap 대신 `~` 뒤에 **명시적 줄바꿈 기회(`<wbr>`)** 만 준다.
                숫자·콜론에는 줄바꿈 기회가 없으므로 이 `<wbr>` 외의 지점에서는 끊기지 않는다.
              */}
              <td className="border-t border-border-soft py-3 pr-1.5 align-top text-caption text-ink">
                <TimeText value={row.time} />
              </td>
              <td className="border-t border-border-soft py-3 pr-3 align-top break-keep text-caption text-ink">
                {row.content}
                {row.person !== null ? (
                  <span className="mt-1 block text-caption text-ink-muted">{row.person}</span>
                ) : null}
              </td>
              {/*
                ★ **`koscom` 이 없는 행은 셀을 아예 그리지 않는다** — 위 칸의 `rowSpan` 이 덮고 있다.
                빈 `<td>` 를 넣으면 병합이 깨져 표가 어긋난다.
              */}
              {row.koscom !== undefined ? (
                <td
                  rowSpan={row.koscom.rowSpan}
                  className="border-t border-border-soft bg-primary-tint px-3 py-3 align-top break-keep text-caption text-ink"
                >
                  {row.koscom.items.map((item, index) => (
                    <div key={item.time} className={index === 0 ? "" : "mt-3"}>
                      {/* 시각을 **항목마다** 적는 이유는 파일 상단 주석에 있다 — 빼면 거짓이 된다 */}
                      <p className="font-semibold text-primary">
                        <TimeText value={item.time} />
                        <span className="ml-1.5 font-bold text-ink">{item.title}</span>
                      </p>
                      {item.details !== undefined ? (
                        <ul className="mt-1 space-y-0.5">
                          {item.details.map((detail) => (
                            <li key={detail} className="text-ink">
                              · {detail}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {item.note !== undefined ? (
                        <p className="mt-1 text-ink-muted">{item.note}</p>
                      ) : null}
                    </div>
                  ))}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-4 break-keep text-caption text-ink">{CHANGE_NOTE}</p>
    </div>
  );
}
