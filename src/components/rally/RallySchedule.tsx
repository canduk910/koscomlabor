/**
 * 결의대회 순서(식순) 16행 + **코스콤 조합원 일정 열**(디자인 스펙 §20.3.6).
 *
 * ## ★★ 두 열은 출처가 달라 고칠 수 있는 범위가 다르다 — 이 구분을 지우지 마라(§45-11 조건 9)
 * - **공식 순서**(시각·내용·인명): 주최측 안내자료 전사(`00_input/content-rally-20260828.md` §4).
 *   **한 글자도 고치지 마라.** 인명은 **소속 병기 필수**(검증 §7-1).
 *   ★ 예외 1건 — 첫 행 시작 시각만 `18:00` → `17:40`(사용자 지시. 코스콤 일정이 17:40 에 시작하는데 놓을
 *     행이 없었다). **나머지 15행 시각은 무수정이다.**
 * - **코스콤 조합원 일정**: 지부 자체 자료라 **사용자 지시가 오면 고친다**(이력은 검증 §45-7).
 * 안 적으면 다음 사람이 코스콤 열 수정을 «금지 위반»으로 읽거나 «공식 열도 고쳐도 된다»로 안다.
 *
 * ⚠ **우리 열의 각 항목에 «자기 시각»을 함께 적는다** — 우리 일정의 경계가 공식 행 경계와 달라(`종료
 *   출석체크 20:20~20:30` 은 공식 `20:20~` 행 안) 빼면 행 경계가 우리 시각인 것처럼 읽혀 **거짓이 된다.**
 * ⚠ **원문의 `(3구역 내 예정, 추후 상세 안내)` 를 되살리지 마라**(사용자 확인 *"3구역 확정이야"*) — 본문·
 *   지도가 3구역을 **확정**으로 말하는데 `예정` 이 남으면 같은 페이지가 같은 사실을 두 확정도로 말한다.
 * ⚠ **열 폭을 다시 만지면 390px 에서 실측하라** — 3열은 시간 열을 모바일에서 줄여야 성립한다.
 *
 * 게시 조건(검증 §7-2): `※ 상황에 따라 식순 변경 가능` 을 표와 **같은 화면**에 둔다 — 표 위·아래 2곳.
 */

interface ScheduleRow {
  time: string;
  content: string;
  /** 원문 "비고" 열의 인명. 소속을 반드시 포함한다(검증 §7-1) */
  person: string | null;
  /** 이 행에서 시작하는 **코스콤 조합원 일정 칸**(없으면 위 칸의 `rowSpan` 에 덮여 있다).
   *  ⚠ `rowSpan` 합이 **정확히 16** 이어야 표가 안 깨진다 — 항목을 고치면 다시 세라. */
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
          /* ⚠ **원문은 `국회지하도보` 였다.** 오타로 판단해 `국회지하보도` 로 고쳤다(사용자 확인) — 그대로
             두면 조합원이 «도보 경로»로 오독한다. 글자 두 개를 뒤집은 것 외에는 무수정이다 */
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
            /* ★ `투쟁조끼` → `총파업머리띠`(사용자 지시 · §45-7(a) 승인 — 코스콤 열이다).
               ⚠⚠ **`손피켓` 을 지우지 마라** — **출석 QR 이 손피켓에 들어 있어**(블록 2-A) 이 줄이 조합원이
                 QR 을 손에 넣는 지점이다. 행동이 갈린다.
               ⚠ **`등` 을 유지한다** — 빼면 «이 셋이 전부»라는, 우리가 갖고 있지 않은 단정이 된다.
               ⚠ **`총파업머리띠` 붙여쓰기를 고치지 마라** — 사용자 지정 문면이다(§5.7) */
            "투쟁용품 수령 (총파업머리띠, 손피켓, 우천 시 우의 등)",
            "저녁간식 수령",
          ],
          /* 원문의 `예정 · 추후 상세 안내` 는 뺐다 — 근거는 파일 상단 주석 */
          note: "집회장소 내 코스콤지역 (3구역)",
        },
        {
          /* ★ `담당 운영위원 및` 을 뺐다(사용자 지시 · 시작·종료 출석체크 두 곳 모두).
             ⚠ **되살리려면 상품권 조건 문장과 함께 봐라** — 그 문장이 조건을 «둘»로 세고 있어 운영위원
             체크가 돌아오면 조합원이 «셋을 해야 하나»로 읽는다 */
          time: "18:50~19:00",
          title: "시작 출석체크",
          note: "금융노조 출석QR코드",
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
        { time: "20:20~20:30", title: "종료 출석체크", note: "금융노조 출석QR코드" },
        /* ★ `투쟁용품 반납 및 해산` → `해산`(사용자 지시 · §45-7(b)(c) 승인 — 코스콤 열이다). `details`
           (투쟁용품 반납)·`note`(집회장소에서 반납)를 함께 지웠다: *"투쟁조끼를 안쓸거라 따로 반납할 물품이
           없어."* 반납할 물품이 없으면 그 시각의 일은 해산뿐이다.
           ⚠⚠ **칸이 빈약해 보인다고 문장을 짓지 마라** — 빈약함과 사실이 그것뿐인 것은 다르다(§5.3).
           ⚠ **`반납 없음` 같은 형태로 남기지도 마라** — 없는 것을 «없다»로 적는 것도 문장이다.
           ⚠ `투쟁조끼`·`반납` 이 **렌더되는 문자**에서 사라지는 것은 의도된 것이다(§45-8 프리렌더 실측 0건).
             ★ **소스 grep 은 0 이 아니다 — 이 주석들이 잡힌다.** 정당한 출현이니 실패로 처리하지 마라 */
        { time: "20:30~", title: "해산" },
      ],
    },
  },
];

/**
 * 시각 문자열에 **`~` 뒤 줄바꿈 기회(`<wbr>`)** 를 준다. 스펙(§20.3.6)의 `whitespace-nowrap` 을 그대로 두면
 * **텍스트 확대에서 시간이 열 폭을 넘어 옆 열 위로 겹쳐 찍힌다.** `~` 한 지점만 열면 기본 크기는 1줄을
 * 유지하고 확대에서만 갈라진다 — 숫자·콜론에는 줄바꿈 기회가 없어 **여기 말고는 끊기지 않는다.**
 * ⚠ **코스콤 열의 시각에도 반드시 쓴다** — 안 쓰면 `19:00~20:30` 이 통째로 안 끊기는 덩어리가 된다.
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
      {/* ★ **가로 스크롤 컨테이너**(사용자 지시 *"확대하더라도 안 넘치게"*). 3열을 유지하는 한 확대에서
          완전히 담을 수 없어 **문서가 밀리지 않게** 하는 쪽을 택했다 — 넘침이 이 상자 안에서 끝난다.
          기본 크기에서는 표가 이미 들어가 스크롤바가 뜨지 않는다.
          ⚠ **스크롤바를 숨기지 마라** — 더 있다는 단서가 사라진다.
          ⚠ `sr-only`(=`absolute`)를 표 안에 넣으려면 **그 셀에 `relative` 를 함께** 줘라(`#9` 의 함정) */}
      <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <caption className="mb-3 break-keep text-left text-caption text-ink">{CHANGE_NOTE}</caption>
        <thead>
          <tr>
            {/* ★ **`78` 은 실측값이다** — 72 로 잡으니 가장 긴 시각 문자열이 0.2px 모자라 두 줄로 깨졌다.
                ⚠ 다시 줄이려면 그 폭을 먼저 재라(서체·글자 크기가 바뀌면 값도 바뀐다).
                확대 200% 에서 두 줄이 되는 것은 `<wbr>` 의 정상 동작이다 */}
            <th
              scope="col"
              className="w-[78px] pb-2 text-left text-caption font-semibold text-ink-muted md:w-[128px]"
            >
              시간
            </th>
            {/* 이름을 `내용` 에서 바꿨다 — 옆에 우리 열이 생긴 이상 **누구의 순서인지**가 없으면 두 열을
                섞어 읽는다. 원문 표의 항목명 자체는 그대로다. */}
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
            /* ⚠ **테두리를 `<tr>` 이 아니라 `<td>` 에 준다** — `border-collapse` 에서 `<tr>` 테두리는 행
               전체를 가로질러 **병합된 칸을 잘라 버린다**(13행 칸에 가로줄이 12개 그어진다) */
            <tr key={row.time}>
              <td className="border-t border-border-soft py-3 pr-1.5 align-top text-caption text-ink">
                <TimeText value={row.time} />
              </td>
              <td className="border-t border-border-soft py-3 pr-3 align-top break-keep text-caption text-ink">
                {row.content}
                {row.person !== null ? (
                  <span className="mt-1 block text-caption text-ink-muted">{row.person}</span>
                ) : null}
              </td>
              {/* ★ `koscom` 이 없는 행은 셀을 아예 그리지 않는다 — 위 칸의 `rowSpan` 이 덮고 있어
                  빈 `<td>` 를 넣으면 병합이 깨진다 */}
              {row.koscom !== undefined ? (
                <td
                  rowSpan={row.koscom.rowSpan}
                  className="border-t border-border-soft bg-primary-tint px-3 py-3 align-top break-keep text-caption text-ink"
                >
                  {row.koscom.items.map((item, index) => (
                    <div key={item.time} className={index === 0 ? "" : "mt-3"}>
                      {/* 시각을 **항목마다** 적는 이유는 파일 상단 주석에 있다 — 빼면 거짓이 된다.
                          ★★ **제목은 `inline-block` 이다**(사용자 지시 *"시각과 필요한 일이 연결되서 줄바뀜
                          되는 경우에는 시각 바로 뒤에 줄바뀜을 넣어줘."*). 원자 인라인 상자라 «줄에 안 들어가면
                          통째로 다음 줄»이고 들어가면 한 줄이다 — **«경우에는»을 CSS 로 얻는 방법이 이것뿐이다.**
                          ⚠ **`block` 으로 바꾸지 마라** — 항상 두 줄이 되어 `20:30~ 해산` 까지 높이를 먹는다.
                          ⚠ **`whitespace-nowrap` 을 더하지 마라** — 제목이 셀보다 넓으면 밖으로 나간다.
                          ⚠ `ml-1.5` 는 **같은 줄일 때의 간격**이다. 다음 줄로 가면 자동으로 사라진다 */}
                      <p className="font-semibold text-primary">
                        <TimeText value={item.time} />
                        <span className="ml-1.5 inline-block font-bold text-ink">{item.title}</span>
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
