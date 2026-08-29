import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { RallyStatusBadge } from "@/components/rally/RallyStatus";
import { strikePhase } from "@/lib/strike";
import { ROUTES } from "@/lib/routes";

/**
 * 9/4 총파업 참석 안내 (디자인 스펙 §52).
 *
 * 최상위 라우트인 이유: 메인에서 직행하는 1급 진입점이고, 카카오톡 등으로 공유된 URL 이
 * 남으므로 `/bargaining-2026` 개편·폐기에 **동반 사망하면 안 된다**(§20.0-4).
 *
 * 이 페이지의 모든 문장은 검증 게이트를 통과한 사실만 담는다. 근거:
 *  - 원문 전사: `_workspace/00_input/strike-20260904/content-strike-20260904.md`
 *  - **확정본**: `_workspace/00_input/strike-20260904/LEADER-DECISIONS.md` (D-1 ~ D-29)
 *    ⚠ **범위를 D-16 까지로 읽지 마라** — 이 페이지가 구현하는
 *      **D-17**(D-14 조건 개정) · **D-26**(블록 순서 교체)이 그 밖에 있다.
 *  - 검증 판정: `_workspace/01_verifier_factcheck.md` §51 · §52
 *  - 형태 스펙: `_workspace/02_designer_spec.md` §52
 *
 * ## ★★ `/rally-2026-08-28` 을 복사해 오지 마라 — 이 페이지는 새로 짠 것이다
 *
 * 복사하면 **8/28 QR 자산이 딸려 온다**(`QrAttendanceCard` · `EXTERNAL_LINKS.unionAttendance` ·
 * 출석 시각 4개). 그 URL 은 **시각 판정 로직이 살아 있어 9/4 에 누르면 출석에 실패한다** —
 * 조합원은 «고장났다»가 아니라 «출석 실패»로 겪는다(검증 조건 13).
 * **«QR 출석체크가 있다»고 적는 것과 «8/28 링크를 붙이는 것»은 전혀 다른 일이다.**
 *
 * ## ★★★ 조건 17(가) — 왜 코스콤지부 위치가 **한 줄도 없는가**
 *
 * **사실 자체가 없다.** 주최측 자료에도 코스콤지부 표시가 없고, **대오가 배정됐는지조차 모른다.**
 * 그리고 사용자가 축자로 지시했다 — *"빈블록이 아니라 그냥 없는 것처럼 처리해줘.
 * 내부지침으로만 들어갈 수도 있다 정도로."*(D-1) → **웹에 안 올릴 수도 있다는 뜻이다.**
 *
 * 침묵했을 때 조합원이 하는 일은 **현장에서 지부 깃발을 찾는 것** — 원래 하는 행동이다.
 * 그래서 침묵이 새 위험을 만들지 않는다.
 *
 * ⚠ **검증 §51-3 의 «블록은 만든다 + C 유형 문면» 은 D-1 이 죽였다. 인용하지 마라.**
 *   확정 문면이었던 `코스콤지부 대오는 지부 공지로 안내합니다.` 도 **함께 죽었다.**
 *
 * ★ **이 페이지의 QR 한 줄과 «같은 상태»로 묶어 읽지 마라.** 그쪽 근거는 **QR `<p>` 바로 위**에
 *   따로 적혀 있다 — **두 근거를 한 덩어리로 합치지 마라**(§52.18-6 · QA 481).
 *   합치면 다음 사람이 «일관성» 을 이유로 **둘 중 하나를 뒤집는다.**
 *
 * ## 의도적으로 **빠져 있는 것** — 자리도 만들지 않았다
 *
 *  - **코스콤지부 위치·대오·천막** — 제목·부제·주석 어디에도 한 줄도 없다(D-1).
 *    ⚠ 결의대회 페이지에는 있는데 여기 없는 것이 **빈자리처럼 보일 것이다. 채우지 마라.**
 *    빈 블록·플레이스홀더·«추후 안내» 자리표시를 만드는 순간 다음 사람이 그것을 채운다.
 *  - **「4. 준비사항」 전체**(본조·지부 양쪽) — 조직 준비 분담표다. 사용자 지시:
 *    *"지부준비물은 조합원은 알 필요없으니까 무시하자. 없는 정보로 해"*(D-2)
 *  - **「1. 목표 및 요구사항」** — 원문 `임금피크제 폐지` vs 사이트 `DEMANDS` 의
 *    `임금피크제 단계적 폐지` 로 **같은 사실이 두 벌**이 된다. 요구안은 임단협 페이지가 말한다(D-3)
 *  - **QR 링크·시각·방법·상품권·지급 조건** — 9/4 근거 0(D-4·§52-9)
 *  - **`위치서비스를 미리 켜 두세요`** — 9/4 출석이 GPS 기반인지 **근거가 0**이다.
 *    §6.4 는 **8/28 자료**다. 틀리면 조합원이 엉뚱한 준비를 한다
 *  - **지도 이미지 및 지도 파생 사실**(간이화장실·버스 하차·남산/청파 주차·대오 1~4·무대 위치)
 *    — 원본 파일 0건(D-5). 사용자: *"문자만 먼저 내자"*
 *  - **정식명칭 줄** — 원문 제목이 `9.4 전국 금융노동자 총파업(안)` 이라 「(안)」이 페이지
 *    최상단에서 확정도 충돌을 일으킨다. 결의대회의 «정식명칭 1회 노출» 규칙을 복사하지 마라(D-7)
 *  - **`past` 상태 문장**(`RALLY_PAST_NOTE` 같은 줄) — 배지 `완료` 가 상태를 말한다(§52.3)
 *  - **참석 예비조사 배너** — 사용자 축자 *"추후 추가할게"*. **아직 없다**(검증 조건 14)
 *
 * ## ★★★ 블록 순서 — **「집결시간」이 「개요」 위다. 원문 절 순서와 «반대»이고, 그것이 판정이다**
 *
 * (리더 D-26 · 디자이너 §52.21 · 2026-08-29)
 *
 * ⚠⚠ **이 순서를 «세로 예산 때문에 바꾼 것»으로 읽지 마라. 세로는 «결과»이지 «이유»가 아니다.**
 * 그렇게 읽으면 **«세로가 넉넉해지면 되돌리자»** 로 가고, 되돌리는 순간 아래 §3 판정과 다시 어긋난다.
 *
 * **진짜 이유 — 초판의 비일관을 정정한 것이다:**
 * 이 페이지는 **집결시간 블록 «안»의 행 순서를 이미 §3(정보 위계는 «조합원이 해야 할 행동» 기준)으로
 * 뒤집었다**(`전 조합원` 을 `간부` 위로 · D-14). **그런데 같은 근거가 «블록 순서»에는 적용되지 않았다.**
 * 초판이 «원문 절 순서 유지»를 택한 근거는 **리더의 게시 범위 표**였는데,
 * **그 표는 «게시 여부» 판정이지 «블록 순서» 지시가 아니었다.** → **같은 근거를 두 층위에 일관되게 적용한다.**
 *  - §3 의 1순위는 «행동 필요 + **기한 있음**» 이다 — **집결시간이 그것이고**, «무슨 행사인가»는 2순위다.
 *  - 이 페이지의 계약은 «**언제·어디로**» 다. 읽는 흐름이 **행동 → 맥락**이 된다.
 *  - **문자열 변화 0.** 원문 어느 문장도 깎지 않았다 — 축자 게이트 영향이 없다.
 *
 * ⚠ **대가**: «어디»(장소)가 «몇 시» 뒤로 간다. **완화 3가지가 이미 있다:**
 *   ① `<h1>` 이 행사를 말한다(`9/4(금) 총파업 참석안내`)
 *   ② 홈 배너 부제가 이미 `전 조합원 집결 10:30 · 세종대로(광화문역·시청역)` 로 **둘을 붙였다**
 *   ③ 개요는 **바로 다음 블록**이다(스크롤 한 번)
 *   ★ **이 셋 중 하나라도 사라지면 순서를 재판정하라.**
 *
 * ⚠ **여백을 깎아서 번 것이 아니다** — `mt-section`(54px) · 카드 `p-5` · `gap-y-1` **전부 그대로다.**
 *   여백·카드 합치기·대형 수치 축소·복귀 링크 제거는 **전부 기각된 처방**이다(§52.21-5).
 *
 * ## ★★ 세로 예산 — 블록을 더하기 전에 읽어라 (D-15 · §52.12 · §52.21)
 *
 * **측정 조건이 값의 일부다**(`union-qa-testing` §5.7 — 값·방법·기준은 한 벌이다):
 * **프로덕션 빌드**(`next build` 산출물) · Playwright Chromium · **360×640** ·
 * `innerWidth − clientWidth` = **15**(클래식 스크롤바 · `clientWidth` 345) · 루트 **12px** ·
 * `await document.fonts.ready` 이후 · `visibilityState: "visible"` · 2026-08-29 실측.
 *
 * | phase | 대형 `10시 30분` 하단 | 판정선 640 대비 |
 * |---|---|---|
 * | `upcoming` | **334.52px** | 여유 **305.48px** |
 * | **`today`** | **361.52px** | 여유 **278.48px** |
 *
 * ⚠ **순서 교체 «전»에는 `upcoming` 618.34 / `today` 645.34 로 `today` 가 판정선을 5.34px 넘었다.**
 *   위 값은 그것을 **283.82px** 벌어 해소한 결과다 — **여백은 한 픽셀도 줄이지 않았다.**
 *
 * ⚠⚠ **디자이너 §52 초판 예측(603 / 여유 37)은 15px 짧았다. 그 값을 인용하지 마라.**
 *   원인이 갈렸다(§52.21-3): 프로토타입이 **런타임 주입이라 Tailwind 가 `gap-y-1` 을 생성하지 않아**
 *   `row-gap: 0` 으로 렌더됐다 — **3px × (6행 사이 5곳) = 15px** 이 통째로 빠져 있었다.
 *   ★ **규율: 런타임 주입 프로토타입으로 «세로 예산»을 확정하지 마라.** 가로 넘침은 인라인 우회로
 *   참값을 얻을 수 있지만, **세로는 모든 간격 클래스가 살아 있어야 참값이 나온다** — 산출물에서만 확정한다.
 *
 * **여유가 생겼다고 «비었으니 채우자»로 가지 마라.** 얇은 것이 설계값이다(§52.15-2).
 *  - 삽입 지점 A(참석 예비조사 배너)는 8/28 실측 **+114.2px(`upcoming`) / +144.2px(`today`)** 인데
 *    **지금 순서는 그것까지 흡수한다**(448.72 / 505.72 · 여유 191 / 134). **뺄 것이 없다.**
 *    ⚠ 그 두 수치는 **8/28 문면 기준 참고값**이다 — **실제로 들어올 때 다시 재라.**
 *  - 그 이상이 필요해지면 예비 수단이 **이미 실측돼 있다**(§52.21-4 · 개요 `dl` 컨테이너 쿼리 · **−77.63px**).
 *    ⚠ **지금 도입하지 마라** — 이 프로젝트에 컨테이너 쿼리 전례가 0 이고 QA 측정 규율도 없다.
 *
 * 추후 콘텐츠의 «주소»(플레이스홀더가 아니다):
 *   A. `<h1>` 아래·첫 `<section>` 위 → 참석 예비조사 배너 (세로 예산 재측정 필수)
 *   B. **개요 다음**·QR 줄 앞 → 코스콤지부 위치 섹션 (검증 재판정 필요 — §51-3 은 D-1 로 죽었다)
 *      ⚠ 순서 교체 전에는 이 자리를 «집결시간 다음»으로 적었다. **그 표현은 죽었다**(§52.21-2).
 *        코스콤 위치는 «전체 장소(개요)»보다 **세부**라 **일반 → 특수** 순서를 지켜야 한다.
 *   C. B 섹션 안 → 지도 이미지 (`aspect-ratio` 고정 박스로 CLS 0)
 *
 * ISR revalidate 60초: 상태(예고/당일/종료)를 요청 시점에 계산하므로 정적 프리렌더를 쓰지 않는다.
 */
export const revalidate = 60; // strikePhase() 가 렌더 시점 계산이므로 rally 와 같은 값을 승계한다

/*
 * 메타데이터 — **스펙 §52.18-7 확정 문면이다. 글자 단위로 이대로 쓴다**(QA 480).
 * **개발자가 짓는 자리가 아니다.** 조각별 출처는 전부 승인분이고 **신규 저작 0** 이다:
 *   `9/4(금) 총파업 참석안내`                      → D-8 확정 문면
 *   ` — 전국금융산업노동조합 코스콤(한국증권전산)지부` → 사이트 공통 접미(rally 와 같은 형식)
 *   `2026년 9월 4일(금) 11시` · `세종대로 (광화문역, 시청역)` → **원문 「2. 개요」 축자**
 *   `전 조합원 집결은 10시 30분입니다.`             → **D-10 확정 `detail` 축자**
 *
 * ⚠ **연결자 `·` 와 마침표만 우리가 넣은 것**이고 그 둘도 **검증 대상에 올라가 있다**(§52.19-4).
 *   → **빼는 것도 판정 사항이다. 임의로 손대지 마라.**
 *   ★ `·` 이 없으면 `11시 세종대로` 로 붙어 읽혀 **없는 지명처럼 보인다.**
 * ⚠ `description` 은 **화면에 안 보이지만 검색결과·메신저 링크 미리보기로 조합원에게 나간다.**
 *   문안 게이트 대상이다 — 한 글자라도 지어 넣으면 2차 검증에서 잡힌다.
 * ⚠ `description` 안의 `세종대로 (광화문역, 시청역)` 은 **원문 축자 형태**다.
 *   배너 표기(`세종대로(광화문역·시청역)`)로 맞추지 마라 — **D-20 이 닫았다.**
 */
export const metadata: Metadata = {
  title: "9/4(금) 총파업 참석안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "2026년 9월 4일(금) 11시 · 세종대로 (광화문역, 시청역). 전 조합원 집결은 10시 30분입니다.",
};

/**
 * `SectionHeading` 은 **`id` 를 직접 받는다.**
 * 결의대회 페이지는 `<div id="…">` 로 감쌌는데(그 파일의 헬퍼가 `id` 를 안 받는다)
 * **새 파일에서 그 우회를 승계할 이유가 없다.** 랜드마크 이름 규칙은 그대로 지킨다 —
 * 화면에 헤딩이 있으므로 `aria-labelledby`(`union-webapp-dev` §8).
 */
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-h2 text-ink md:text-h1">
      {children}
    </h2>
  );
}

/**
 * 시각 문자열의 `-` **뒤**에 줄바꿈 기회를 준다.
 *
 * ★ 숫자·콜론·하이픈에는 **줄바꿈 기회가 자체적으로 없다**(`union-design-system §0.8` 셋째 문자 종류).
 * ⚠ **`<wbr>` 은 `textContent` 에 남지 않는다**(축자 보존 ✓). 그러나 **프리렌더 HTML 문자열에서는
 * 갈린다** — 최종 게이트가 HTML 에 대고 `10:30-11:00` 을 grep 하면 **0건**이 나온다.
 * **태그를 제거하고 세라**(`grep -c` 금지 — `grep -o | wc -l`).
 *
 * ⚠ **`RallySchedule` 의 같은 헬퍼를 import 하지 마라.** 그 컴포넌트는 8/28 전용이고
 * «고치지 마라» 규율이 두껍다 — 여기서는 **지역 헬퍼로 다시 쓴다**(§52.15-4).
 */
function TimeText({ value }: { value: string }) {
  const i = value.indexOf("-");
  // `14:20` 단독 행 — **`~` 를 붙이지 마라**(검증 조건 8). 원문은 폐회선언 시각만 말한다
  if (i < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, i + 1)}
      <wbr />
      {value.slice(i + 1)}
    </>
  );
}

interface ProgramRow {
  /** 원문 표기 그대로. **구분자는 `-` 다** — `~` 로 통일하지 마라(검증 조건 8 · §51-7) */
  time: string;
  content: string;
  /**
   * 원문 「비고」 — **소속 병기가 게시 조건이다**(검증 조건 4 · §7-1).
   * 소속 없는 `윤석구 위원장`·`김동명 위원장` 은 게시 불가이고,
   * **`김동명 한국노총 위원장 외` 의 「외」와 어순은 고정**이다. 재배열하지 마라.
   */
  person: string | null;
}

/** 원문 「5. 총파업 식순」 20행 축자 */
const PROGRAM: readonly ProgramRow[] = [
  { time: "10:30-11:00", content: "대오정비", person: null },
  { time: "11:00-11:30", content: "사전집회 / 구호제창 / 동영상 상영", person: null },
  { time: "11:30-11:35", content: "지도부 및 내외빈 입장", person: null },
  { time: "11:35-11:40", content: "깃발 입장", person: null },
  { time: "11:40-11:45", content: "노동의례", person: null },
  { time: "11:45-11:55", content: "참가조직 소개", person: null },
  { time: "11:55-12:05", content: "총파업 선언 및 대회사", person: "윤석구 금융노조 위원장" },
  { time: "12:05-12:10", content: "구호제창", person: null },
  { time: "12:10-12:20", content: "격려사", person: "김동명 한국노총 위원장 외" },
  { time: "12:20-12:30", content: "투쟁사", person: null },
  { time: "12:30-12:50", content: "문화공연 1", person: null },
  { time: "12:50-13:00", content: "연대사", person: null },
  { time: "13:00-13:10", content: "투쟁사", person: null },
  { time: "13:10-13:30", content: "문화공연 2", person: null },
  { time: "13:30-13:40", content: "연대사", person: null },
  { time: "13:40-14:00", content: "문화공연 3", person: null },
  { time: "14:00-14:10", content: "상징의식", person: null },
  { time: "14:10-14:15", content: "결의문 낭독", person: null },
  { time: "14:15-14:20", content: "파업가 제창", person: null },
  { time: "14:20", content: "폐회선언", person: null },
];

/**
 * 원문 하단 단서 — **마침표까지 축자다.** 「조정될 수 있습니다」로 문체를 고치지 마라.
 * **표와 같은 화면에 없으면 게시 불가**다(검증 조건 2 · §51-1).
 * 표 위(`<caption>`) + 표 아래(`<p>`) 2곳에 둔다 — 같은 문자열 2회는 이 프로젝트의 허용 패턴이고,
 * 표가 기본 크기에서 806px 이라 위에만 두면 스크롤과 함께 사라진다(§52.7-4).
 *
 * ⚠ **이 페이지의 `※` 는 이것 하나뿐이다**(종류 1 · 출현 2). **세 번째 `※` 를 만들지 마라.**
 */
const CHANGE_NOTE = "※ 세부 프로그램은 조정될 수 있음.";

export default function StrikePage() {
  // 하드코딩 0 — 렌더 시점 계산이다
  const phase = strikePhase();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <div className="mx-auto mt-8 w-full max-w-page px-4 md:mt-14 md:px-8">
          {/* 상단 복귀 링크 — 하단과 같은 문자열 2회는 허용 패턴이다(§20.3.7).
              ⚠ `aria-label`·`title` 을 붙이지 마라 — 내부 텍스트가 접근성 이름을 진다(§8) */}
          <p>
            <Link
              href={ROUTES.bargaining}
              className="inline-flex min-h-touch items-center text-caption font-semibold text-primary hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span aria-hidden="true">←&nbsp;</span>
              26년 임단협 투쟁 안내로 돌아가기
            </Link>
          </p>

          {/* 상태 배지 — today/past 에서만. upcoming 은 아무 상태도 말하지 않는 것이 정상 상태다 */}
          {phase !== "upcoming" ? (
            <p className="mt-4">
              <RallyStatusBadge phase={phase} />
            </p>
          ) : null}

          {/* 리더 확정 문면(D-8) — **한 글자도 고치지 않는다**. 취소선 금지.
              `break-words` 는 필수다 — `9/4(금)` 이 숫자·괄호·기호라 끊을 자리가 없다(§0.8) */}
          <h1
            className={`text-title break-keep break-words text-ink md:text-display ${phase === "upcoming" ? "mt-4" : "mt-3"}`}
          >
            9/4(금) 총파업 참석안내
          </h1>

          {/* ── 블록 1 — 집결시간 (원문 「3. 집결시간」 축자) · **페이지 유일 대형 수치** ── */}
          <section aria-labelledby="gather-heading" className="mt-section md:mt-section-lg">
            <SectionHeading id="gather-heading">집결시간</SectionHeading>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              {/*
                ★ **행 순서가 원문과 반대다 — 승인된 역전이다**(리더 D-14).
                원문은 `간부 10시` → `전 조합원 10시 30분` 인데 화면은 **전 조합원을 위로** 올린다.
                순서는 «원문 형식»이지 «사실»이 아니고, 두 사실이 **둘 다 온전히** 게시되며
                대상 명칭이 각 행에 **축자로** 붙는다. 이 페이지를 보는 사람의 절대다수가
                «전 조합원»이고, 정보 위계는 **«조합원이 해야 할 행동» 기준**이다(§3).

                ⚠ **간부 행을 빼지 마라.** 순서만 바뀌는 것이지 내용이 주는 것이 아니다.

                ⚠⚠ **`D-14` 의 조건 문면 «대상 명칭이 시각과 «같은 줄»에서 갈리게 하라» 는 죽었다**
                  (리더 D-17 · §52.20-0). **인용하지 마라 — 조판 수단이 없다.**
                  이 블록에서 그 목적(간부가 `10시 30분` 을 자기 시각으로 오독하는 것 방지)은
                  **대상 캡션(`전 조합원`)이 대형 수치 «위»에 오는 것**으로 달성된다 —
                  **대상이 시각보다 먼저 읽힌다.** 오독 방향과 반대다.
                  (같은 판정이 홈 배너 부제에도 걸려 있다. 근거는 `StrikeBanner` 부제 주석에 있다.)

                ★ **블록 1(개요)과 합치지 마라.** 합치면 한 카드에서 `11시` 와 `10시 30분` 이
                나란히 서고 *"11시까지 가면 되나"* 오독이 페이지 안에서 재현된다(D-10).
              */}
              <p className="text-caption font-semibold text-ink-muted">전 조합원</p>
              {/*
                **`10시 30분` 이 이 페이지의 유일한 대형 수치다.**
                ⚠ **`10:30` 으로 바꾸지 마라** — 원문 「3. 집결시간」 축자다. 배너의 `10:30` 은
                  사용자 지정 문면이라 그쪽만 그 표기를 쓴다.
                ⚠ **`sr-only` 장형(`오전 10시 30분`)을 만들지 마라** — 8/28 의 `18:30`+장형 병기는
                  **숫자 표기라서** 필요했다. `10시 30분` 은 이미 한국어라 병기는 **신규 문자열 창작**이다.
              */}
              <p className="font-display mt-1 text-hero leading-none break-keep break-words text-ink md:text-hero-lg">
                <time dateTime="2026-09-04T10:30:00+09:00">10시 30분</time>
              </p>

              <dl className="mt-6 grid gap-y-1 md:mt-8 md:grid-cols-[auto_1fr] md:gap-x-4 md:gap-y-2">
                <dt className="break-keep break-words text-caption font-semibold text-ink-muted">
                  지부 위원장 및 전체상임간부
                </dt>
                <dd className="break-keep break-words text-body text-ink">10시</dd>
              </dl>
            </div>
          </section>

          {/* ── 블록 2 — 개요 (원문 「2. 개요」 축자) ── */}
          <section aria-labelledby="overview-heading" className="mt-section md:mt-section-lg">
            <SectionHeading id="overview-heading">개요</SectionHeading>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              {/*
                ★★ **`grid-cols-[auto_1fr]` 을 모바일에도 주지 마라**(디자이너 실측 · §52.2).
                `break-words`(=`overflow-wrap:break-word`)는 **min-content 기여값을 줄이지 않는다** —
                블록 안에서는 `세종대로 (광화문역, 시청역)` 이 146 → 31 로 접히지만 **`1fr` 트랙은
                146 을 그대로 잡는다.** 200% 에서 카드가 41px 넘치고 **문서가 9px 밀렸다.**
                → 모바일은 1열 스택, 2열은 `md:` 에서만.
                ⚠ **`break-all`·`overflow-wrap:anywhere` 로 우회하지 마라** — 레이아웃을 고치는 쪽이 회귀가 작다.
                ⚠ **`md:` 는 텍스트 확대와 무관하다** — 미디어 쿼리의 `rem` 은 루트 `font-size` 를
                따르지 않고 초기 16px 고정이다(실측). 그래서 «확대되면 1열로 도망가는» 일이 없고,
                데스크톱 2열의 200% 안전은 **따로 쟀다**(1280·200% 넘침 0).

                간격 비율 — **항목 간 15px : 라벨↔값 3px = 5:1**(§1 을 항목 단위로 이행). **참값이다.**
                ⚠ **클래스 이름의 숫자(`mt-4` · `gap-y-1`)를 비율로 적지 마라**(§52.21-3) —
                  그것은 «클래스 비율»이고 **화면에 나타나는 값이 아니다.**
                  **`row-gap` 은 «dt↔dd 사이»만이 아니라 «6행 사이 5곳 전부»에 붙는다** — 항목 간 실제 간격은
                  `row-gap 3 + dt mt-4 12 = 15px` 이고 dt↔dd 는 `3px` 다.
                라벨 3개(`일시`·`장소`·`참석대상`)는 **원문 축자**다. 우리가 지은 이름이 아니다.
              */}
              <dl className="grid gap-y-1 md:grid-cols-[auto_1fr] md:gap-x-4 md:gap-y-2">
                <dt className="break-keep break-words text-caption font-semibold text-ink-muted">
                  일시
                </dt>
                <dd className="break-keep break-words text-body text-ink">
                  <time dateTime="2026-09-04T11:00:00+09:00">2026년 9월 4일(금) 11시</time>
                </dd>

                {/* ⚠ **배너 표기(`세종대로(광화문역·시청역)`)로 맞추지 마라 — 게시 조건이다**(§52-6).
                    배너는 사용자 확정 요약 표기, 여기는 **원문 축자**이고 두 표기는 한 화면에 없다
                    (배너=홈 · 개요=이 페이지). 공백·쉼표까지 원문 그대로다. */}
                <dt className="mt-4 break-keep break-words text-caption font-semibold text-ink-muted md:mt-0">
                  장소
                </dt>
                <dd className="break-keep break-words text-body text-ink">
                  세종대로 (광화문역, 시청역)
                </dd>

                <dt className="mt-4 break-keep break-words text-caption font-semibold text-ink-muted md:mt-0">
                  참석대상
                </dt>
                <dd className="break-keep break-words text-body text-ink">금융노조 전 조합원</dd>
              </dl>
            </div>
          </section>

          {/*
            QR 출석체크 — **사실 한 줄**(리더 D-4 개정 · 검증 §52-4 확정 문면).

            ## ★★★ 조건 17(나) — 왜 **이 한 줄만** 있는가

            **사실이 «있다».** 지부 당사자 진술이라 **«있다»가 1급 확정**이고, 사용자 답변도
            *"9/4 당일에도 있다"* 였다 — **알려 주라는 답**이다. 없는 것은 **세부(방법·시각·URL)뿐**이다.

            침묵했을 때 조합원이 하는 일이 문제다: **출석체크를 안 찾거나, 8/28 방식을 유추한다.**
            유추가 틀리면 **출석에 실패한다** — 그래서 침묵이 새 위험을 만든다.

            ★ **파일 머리의 «코스콤지부 위치는 왜 없는가»(조건 17(가))와 «같은 상태»로 묶어 읽지 마라.**
              그쪽은 **사실 자체가 없고**, 여기는 **사실은 있고 세부가 없다.** 처분이 다른 것이 옳다.
              ⚠ **두 근거를 한 덩어리로 합치지 마라**(§52.18-6 · QA 481) — 합치면 다음 사람이
              «일관성» 을 이유로 **둘 중 하나를 뒤집는다.**

            ★ 형태 조건 4건(D-10) — **전부 여기서 이행된다:**
             1. **`※` 를 붙이지 마라** — 사실 진술이지 단서가 아니다. 이 페이지의 `※` 는 원문 단서 1종뿐이다
             2. **링크·필 버튼·카드로 만들지 마라** — `<p>` 하나이고 면·테두리·그림자·`href` 가 0 이다.
                누를 곳이 없는데 형태가 «어디로 간다»를 약속하면 **조합원이 8/28 링크를 뒤진다**(§0.7)
             3. **원문 축자 블록 «안»에 넣지 마라** — `<section>` 3개 어디에도 안 들어간다(컨테이너 직속).
                위·아래 여백이 대칭이라 **어느 블록에도 소속되지 않는다**
             4. **두 문장을 분리하지 마라** — 단일 텍스트 노드 1개다. `<br>`·`<span>` 으로 쪼개면 grep 이 깨진다

            ⚠ **«방법과 시각은 추후 안내합니다»를 빼지 마라 — 조건이다**(§52-2).
              「있다」만 말하면 **8/28 참석자가 그때 방식(손피켓 QR·그 URL)을 유추하고, 유추가 틀리면
              출석에 실패한다** — 아예 안 적는 것보다 나쁘다.
            ⚠ 금지어(요구 157 A 유형으로 미끄러진다): `확인 중` · `확인되는 대로` · `반영하겠습니다` ·
              `준비 중` · `업데이트 예정`. 그리고 **`지부 공지로` 를 쓰지 마라** — 사용자 축자가
              *"추후 추가할게"* 라 **이 페이지에 추가될 가능성이 높은데** 그 표현은 조합원을 다른 채널로 보낸다.

            자리 근거: 읽는 순서가 집결시간(내가 몇 시) → 개요(무슨 행사) → **여기**(그날 출석체크가 있다)
            → 식순 이다. 최상단에 두지 않는 이유는 **이 줄에 지금 할 수 있는 행동이 없어서**이고,
            식순 뒤에 두지 않는 이유는 **표가 806px 이라 그 아래가 안 읽혀서**다.
          */}
          <p className="mt-section break-keep break-words text-body text-ink md:mt-section-lg">
            당일 QR 출석체크가 있습니다. 방법과 시각은 추후 안내합니다.
          </p>

          {/* ── 블록 3 — 총파업 식순 (원문 「5. 총파업 식순」) ── */}
          <section aria-labelledby="program-heading" className="mt-section md:mt-section-lg">
            <SectionHeading id="program-heading">총파업 식순</SectionHeading>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              {/*
                ★ **표는 2열이다(시간 / 내용). 비고는 내용 셀 둘째 줄.**
                3열로 만들면 200% 에서 내용 열이 **26px = 한글 1자**로 눌린다(디자이너 실측).
                원문 비고는 **20행 중 2행만** 차는데 폭은 상시 점유한다.
                ⚠ **`RallySchedule` 의 3열을 근거로 3열을 밀지 마라** — 그 세 번째 열은
                  «전 행에 걸친 다른 출처»였다. 이번 비고는 **같은 출처의 부속 정보 2건**이다.
                ⚠ **`overflow-x-auto` 스크롤 상자를 만들지 마라** — 2열은 담긴다(실측 넘침 0).
                  필요 없는 스크롤 상자는 **«옆에 더 있다»는 거짓 단서**를 준다.
                ⚠ **20행을 접지 마라**(«더 보기»·아코디언 금지 · §0.4 콘텐츠 은폐 금지).
              */}
              <table className="w-full table-fixed">
                <caption className="mb-3 break-keep break-words text-left text-caption text-ink">
                  {CHANGE_NOTE}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="w-[78px] pb-2 text-left text-caption font-semibold text-ink-muted md:w-[128px]"
                    >
                      시간
                    </th>
                    <th
                      scope="col"
                      className="pb-2 text-left text-caption font-semibold text-ink-muted"
                    >
                      내용
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PROGRAM.map((row) => (
                    <tr key={row.time}>
                      {/*
                        ★★ **시간 셀의 `break-words` 를 빼지 마라**(디자이너 실측 · §52.7-3).
                        200% 에서 `<wbr>` 이 만든 최장 덩어리 `10:30-` 이 **88px** 인데 셀이 **78px** 이라
                        **10px 이 내용 열 위로 겹쳐 찍힌다.** 붙이면 20행 전수 넘침 0 이다.
                        ⚠ **`w-[78px]` 은 px 고정이라 확대를 따라가지 않는다** — 폭을 키워서는 못 고친다
                          (기본 크기에서 낭비가 되고, 200% 를 덮으려면 200px 이 필요해 내용 열이 사라진다).
                          **처방은 «셀 안에서 접히게 하는 것» 하나뿐이다.**
                      */}
                      <td className="border-t border-border-soft py-3 pr-1.5 align-top break-keep break-words text-caption text-ink">
                        <TimeText value={row.time} />
                      </td>
                      <td className="border-t border-border-soft py-3 align-top break-keep break-words text-caption text-ink">
                        {row.content}
                        {row.person !== null ? (
                          <span className="mt-1 block text-caption text-ink-muted">
                            {row.person}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 break-keep break-words text-caption text-ink">{CHANGE_NOTE}</p>
            </div>
          </section>

          {/* ── 돌아가기 ── */}
          <p className="mt-section md:mt-section-lg">
            <Link
              href={ROUTES.bargaining}
              className="ease-out-soft inline-flex min-h-touch items-center gap-2 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <ArrowLeftIcon className="size-5" />
              26년 임단협 투쟁 안내로 돌아가기
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
