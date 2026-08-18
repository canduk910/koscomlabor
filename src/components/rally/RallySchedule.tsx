/**
 * 결의대회 순서(식순) 16행 (디자인 스펙 §20.3.6).
 *
 * 원문: 주최측 안내자료 이미지 2 "6. 결의대회 순서" 전사
 * (`_workspace/00_input/content-rally-20260828.md` §4). **시각·항목명을 고치지 마라.**
 *
 * 게시 조건 (검증 리포트 4회차 §7):
 * - `※ 상황에 따라 식순 변경 가능` 을 표와 **같은 화면**에 둔다(§7-2). 16행 표는 360px 에서
 *   약 980px 이라 한 화면을 넘기므로 **표 위(`<caption>`)와 표 아래 2곳**에 둔다.
 *   `<caption>` 은 스크린리더가 표 진입 시 가장 먼저 읽는 자리이기도 하다.
 * - 인명은 **소속 병기 필수**(§7-1). 소속 없는 `윤석구 위원장`·`김동명 위원장` 은 게시 불가다 —
 *   조합원이 누구인지 식별할 수 없다.
 *
 * 비고 열을 만들지 않는다: 360px 에서 3열은 성립하지 않는다(내용 열이 100px 이하로 눌린다).
 * 인명은 내용 셀의 둘째 줄로 내려가며 **정보는 그대로 남는다** — 은폐가 아니다(§0.4).
 */

interface ScheduleRow {
  time: string;
  content: string;
  /** 원문 "비고" 열의 인명. 소속을 반드시 포함한다(검증 §7-1) */
  person: string | null;
}

const RALLY_PROGRAM: readonly ScheduleRow[] = [
  { time: "18:00~18:30", content: "장내 정리 및 조합원 안내", person: null },
  { time: "18:30~19:00", content: "사전집회", person: null },
  { time: "19:00~19:05", content: "개회선언, 지도부/내외빈 입장", person: null },
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
  { time: "20:20~", content: "폐회선언", person: null },
];

/** 표 위·아래 2곳에 같은 문장을 둔다 — 원문 표 하단 단서이며 검증 §7-2 의 게시 조건이다 */
const CHANGE_NOTE = "※ 상황에 따라 식순 변경 가능";

export function RallySchedule() {
  return (
    <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
      <table className="w-full table-fixed">
        <caption className="mb-3 break-keep text-left text-caption text-ink">{CHANGE_NOTE}</caption>
        <thead>
          <tr>
            {/* w-[112px] 을 줄이지 마라 — 104px 이면 `18:00~18:30` 의 여유가 8.7px 이 되어
                §18 검산 규칙상 실측 없이는 쓸 수 없는 값이 된다(§20.3.6) */}
            <th
              scope="col"
              className="w-[112px] pb-2 text-left text-caption font-semibold text-ink-muted md:w-[140px]"
            >
              시간
            </th>
            <th scope="col" className="pb-2 text-left text-caption font-semibold text-ink-muted">
              내용
            </th>
          </tr>
        </thead>
        <tbody>
          {RALLY_PROGRAM.map((row) => (
            <tr key={row.time} className="border-t border-border-soft">
              {/*
                시각은 **끊어 읽으면 안 되는 값**이라 스펙(§20.3.6)은 `whitespace-nowrap` 을 썼다.
                그대로 두면 텍스트 확대 200%(폰트만 2배, 열 폭은 112px 고정)에서 시간 문자열이
                169px 이 되어 **내용 열 위로 겹쳐 찍힌다**(실측). 그래서 nowrap 대신
                `~` 뒤에 **명시적 줄바꿈 기회(`<wbr>`)** 만 준다:
                - 기본 크기에서는 100px 가용에 83px 이라 기회를 쓰지 않는다 → **1줄 유지**(실측).
                - 200% 에서만 `18:00~` / `18:30` 로 갈라져 겹침이 사라진다.
                숫자·콜론에는 줄바꿈 기회가 없으므로 이 `<wbr>` 외의 지점에서는 끊기지 않는다.
              */}
              <td className="py-3 pr-3 align-top text-caption text-ink">
                {row.time.includes("~") ? (
                  <>
                    {row.time.slice(0, row.time.indexOf("~") + 1)}
                    <wbr />
                    {row.time.slice(row.time.indexOf("~") + 1)}
                  </>
                ) : (
                  row.time
                )}
              </td>
              <td className="py-3 align-top break-keep text-caption text-ink">
                {row.content}
                {row.person !== null ? (
                  <span className="mt-1 block text-caption text-ink-muted">{row.person}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 break-keep text-caption text-ink">{CHANGE_NOTE}</p>
    </div>
  );
}
