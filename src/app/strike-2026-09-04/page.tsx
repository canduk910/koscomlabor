import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon, ExternalLinkIcon } from "@/components/ui/icons";
import { RallyStatusBadge } from "@/components/rally/RallyStatus";
import { StrikeMap } from "@/components/strike/StrikeMap";
import { strikePhase } from "@/lib/strike";
import { EXTERNAL_LINKS, ROUTES, UNION_ATTENDANCE_DISPLAY_HOST } from "@/lib/routes";

/**
 * 9/4 총파업 참석 안내 (디자인 스펙 §52). **모든 문장은 검증 게이트를 통과한 사실만 담는다.**
 * 근거: 원문 전사 `00_input/strike-20260904/content-strike-20260904.md` · **확정본** 같은 폴더
 * `LEADER-DECISIONS.md`(D-1~D-29) · 검증 `01_verifier_factcheck.md` §51·§52 · 형태 `02_designer_spec.md` §52.
 * ⚠ **확정본 범위를 D-16 까지로 읽지 마라** — 이 페이지가 구현하는 **D-17**·**D-26** 이 그 밖에 있다.
 * ⚠ 최상위 라우트인 이유: 공유된 URL 이 남으므로 `/bargaining-2026` 개편·폐기에
 *   **동반 사망하면 안 된다**(§20.0-4). **하위로 옮기지 마라.**
 *
 * ## ★★ `/rally-2026-08-28` 을 복사해 오지 마라 — 이 페이지는 새로 짠 것이다
 *
 * 복사하면 **8/28 QR 자산이 딸려 온다** — `QrAttendanceCard` **통째로**(주최측 이미지 ·
 * 출석 시각 4개 · `손피켓` · `상품권 5만원` · `참석명단 작성(지부천막)` · `인증샷`·`수기접수`).
 * **그것들은 9/4 근거가 0 이다**(§57-4). 이 페이지는 새로 짠 것이다.
 *
 * ## ⚠⚠ 2026-08-29 — **«URL 도 딸려 온다» 는 죽었다. 나머지는 그대로 살아 있다**(M-26 · 검증 §57)
 *
 * 종전 이 자리는 `EXTERNAL_LINKS.unionAttendance` 를 «딸려 오는 것» 목록에 넣고
 * *«그 URL 은 시각 판정 로직이 살아 있어 9/4 에 누르면 출석에 실패한다»* 라고 적었다.
 * **사용자 확인으로 9/4 QR 이 «같은 주소»를 쓴다**(2급 — 정하는 주체가 본조·주최측이고
 * 사용자는 전달자다 · §57-2) → **그 문장은 거짓이다.** 지금 이 페이지는 **그 URL 을 스스로 쓴다**
 * (아래 QR 출석체크 카드). 함께 죽은 문장: *«"QR 출석체크가 있다"고 적는 것과
 * "8/28 링크를 붙이는 것"은 전혀 다른 일이다»*. **둘 다 인용하지 마라.**
 *
 * ★★ **위험은 «사라진» 것이 아니라 «이동» 했다** — «틀린 링크로 간다» 에서
 *   **«8/28 조건이 함께 온다»** 로(§57-5 #1). 그래서 **주소 하나만** 가져오고 **카드는 안 가져온다.**
 *   ⚠ 이것을 «위험이 사라졌다»로 읽으면 다음 사람이 `손피켓`·`상품권`·`5만원`·`1차·2차`·`지부천막`
 *   **기대 0 까지 함께 풀어 버린다.** 확인된 것은 **«주소 하나»** 뿐이다.
 * ⚠ **게시 조건(§57-2)**: 2급이라 **9/3~9/4 에 도착지를 다시 연다** — 응답 200 ·
 *   `<title>` 이 「금융노조 집회참석」 유지. **«URL 동일성»과 «그 서버가 9/4 에 열린다»는 다르다.**
 *
 * ## ★★★ 조건 17(가) — 왜 코스콤지부 위치가 **한 줄도 없는가**
 *
 * **사실 자체가 없다**(주최측 자료에 표시가 없고 대오 배정 여부조차 모른다 · D-1). 침묵해도 조합원은
 * **현장에서 지부 깃발을 찾는** 원래 행동을 하므로 **침묵이 새 위험을 만들지 않는다.**
 * ⚠ **검증 §51-3 의 «블록은 만든다 + C 유형 문면» 은 D-1 이 죽였다. 인용하지 마라** —
 *   확정 문면이었던 `코스콤지부 대오는 지부 공지로 안내합니다.` 도 함께 죽었다.
 *
 * ★ **이 페이지의 QR 한 줄과 «같은 상태»로 묶어 읽지 마라.** 그쪽 근거는 **QR `<p>` 바로 위**에
 *   따로 적혀 있다 — **두 근거를 한 덩어리로 합치지 마라**(§52.18-6 · QA 481).
 *   합치면 다음 사람이 «일관성» 을 이유로 **둘 중 하나를 뒤집는다.**
 *
 * ## 의도적으로 **빠져 있는 것** — 자리도 만들지 않았다. **채우지 마라:**
 *
 *  - **코스콤지부 위치·대오·천막** — 어디에도 한 줄도 없다(D-1). ⚠ 결의대회 페이지에는 있어서
 *    **빈자리처럼 보인다.** 빈 블록·플레이스홀더를 만드는 순간 다음 사람이 그것을 채운다.
 *  - **「4. 준비사항」 전체** — 조직 준비 분담표라 조합원 대상이 아니다(D-2)
 *  - **「1. 목표 및 요구사항」** — 사이트 `DEMANDS` 와 문면이 갈려 **같은 사실이 두 벌**이 된다.
 *    요구안은 임단협 페이지가 말한다(D-3)
 *  - **QR 시각·상품권·지급 조건** — 9/4 근거 0(D-4·§52-9 · §57-4 에서 재확인)
 *    ⚠ **«링크·방법» 은 2026-08-29 에 이 목록에서 빠졌다**(M-26) — 주소가 확인돼 **아래 카드**가 됐다.
 *    ★ **나머지를 함께 빼지 마라.** «주소가 같다» ≠ «조건이 같다» — 시각·상품권·지급 조건은
 *      **여전히 9/4 근거가 0** 이다(§57-4).
 *  - **`위치서비스를 미리 켜 두세요`** — 9/4 출석이 GPS 기반인지 **근거가 0**(§6.4 는 8/28 자료).
 *    틀리면 조합원이 엉뚱한 준비를 한다
 *  - **주최측 지도 이미지 및 그 파생 사실** — 원본 파일 0건(D-5)
 *  - **정식명칭 줄** — 원문 제목의 「(안)」이 최상단에서 확정도 충돌을 일으킨다.
 *    **결의대회의 «정식명칭 1회 노출» 규칙을 복사하지 마라**(D-7)
 *  - **`past` 상태 문장** — 배지 `완료` 가 상태를 말한다(§52.3)
 *  - **참석 예비조사 배너** — **아직 없다**(검증 조건 14)
 *
 * ## ★★★ 블록 순서 — **「집결시간」이 「개요」 위다. 원문 절 순서와 «반대»이고, 그것이 판정이다**
 *   (리더 D-26 · 디자이너 §52.21)
 *
 * ⚠⚠ **«세로 예산 때문»으로 읽지 마라 — 세로는 «결과»이지 «이유»가 아니다**(그렇게 읽으면 «넉넉해지면
 *   되돌리자»로 간다). 진짜 이유는 §3(정보 위계 = «조합원이 해야 할 행동» 기준)을 **블록 «안»의 행
 *   순서에 이어 블록 순서에도 일관되게 적용한 것**이다(D-14 → D-26). **원문 문자열 변화는 0 이다.**
 * ⚠ **대가**: «어디»가 «몇 시» 뒤로 간다. 완화 3가지 — ① `<h1>` 이 행사를 말한다 ② 홈 배너 부제가
 *   둘을 붙였다 ③ 개요가 바로 다음 블록이다. ★ **셋 중 하나라도 사라지면 순서를 재판정하라.**
 * ⚠ **여백을 깎아서 번 것이 아니다** — 여백·카드 합치기·대형 수치 축소·복귀 링크 제거는
 *   **전부 기각된 처방**이다(§52.21-5).
 *
 * ## ★★ 세로 예산 — 블록을 더하기 전에 읽어라 (D-15 · §52.12 · §52.21). 판정선 **360×640**.
 *
 * **실측값·측정 환경표·삽입 지점 A 증분은 `02_designer_spec.md` §52.21 에 있다** — 값·방법·기준은
 * 한 벌이라 조건 없이 인용하지 마라(`union-qa-testing` §5.7).
 * ⚠⚠ **디자이너 §52 «초판» 예측을 인용하지 마라 — 짧았다**(§52.21-3). ★ **규율: 런타임 주입
 *   프로토타입으로 «세로 예산»을 확정하지 마라** — 가로 넘침과 달리 **세로는 모든 간격 클래스가
 *   살아 있어야 참값이 나온다.**
 * ⚠ **여유가 생겼다고 «비었으니 채우자»로 가지 마라. 얇은 것이 설계값이다**(§52.15-2).
 * ⚠ 예비 수단(개요 `dl` 컨테이너 쿼리 · §52.21-4)을 **지금 도입하지 마라** — 컨테이너 쿼리 전례가
 *   0 이고 QA 측정 규율도 없다.
 *
 * 추후 콘텐츠의 «주소»(플레이스홀더가 아니다):
 *   A. `<h1>` 아래·첫 `<section>` 위 → 참석 예비조사 배너 (**세로 예산 재측정 필수**)
 *   B. **[2026-08-29 채워짐]** 개요 다음·QR 줄 앞 → **`세종대로 안내지도` 섹션**(`StrikeMap`).
 *      ⚠ 순서 교체 전 표현(«집결시간 다음»)은 **죽었다**(§52.21-2) — 코스콤 위치는 «전체 장소»보다
 *        세부라 **일반 → 특수** 순서를 지켜야 한다.
 *   ⚠ **C(«B 섹션 안 → 지도 이미지»)는 죽었다. 인용하지 마라**(M-4·M-17) — 주최측 원본은 바탕이
 *     상용 지도 캡처라 미게시로 확정됐고, 그 자리를 **네이버 지도 API 블록**이 대체했다.
 *
 * ISR revalidate 60초: 상태를 요청 시점에 계산하므로 정적 프리렌더를 쓰지 않는다.
 */
export const revalidate = 60; // strikePhase() 가 렌더 시점 계산이므로 rally 와 같은 값을 승계한다

/*
 * 메타데이터 — **스펙 §52.18-7 확정 문면. 글자 단위로 이대로 쓴다. 개발자가 짓는 자리가 아니다** —
 * 조각별 출처가 전부 승인분이고 **신규 저작 0** 이다(D-8 · 사이트 공통 접미 · 원문 「2. 개요」 축자 · D-10).
 * ⚠ 연결자 `·` 와 마침표만 우리가 넣은 것이고 **그 둘도 검증 대상이다 — 임의로 손대지 마라**(§52.19-4).
 *   ★ `·` 이 없으면 `11시 세종대로` 로 붙어 읽혀 **없는 지명처럼 보인다.**
 * ⚠ `description` 은 **안 보이지만 검색결과·메신저 미리보기로 나간다** — 문안 게이트 대상이다.
 * ⚠ `description` 의 `세종대로 (광화문역, 시청역)` 은 **원문 축자**다.
 *   배너 표기(`세종대로(광화문역·시청역)`)로 맞추지 마라 — **D-20 이 닫았다.**
 */
export const metadata: Metadata = {
  title: "9/4(금) 총파업 참석안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "2026년 9월 4일(금) 11시 · 세종대로 (광화문역, 시청역). 전 조합원 집결은 10시 30분입니다.",
};

/*
 * 네이버 지도 Client ID — `NEXT_PUBLIC_*` 은 **빌드타임에 번들로 임베드**된다
 * (`deploy/web/docker-compose.yml` build.args → Dockerfile ARG/ENV).
 *
 * ★★ **미설정이면 `<section>` 을 통째로 렌더하지 않는다**(M-6 · M-16) — 인증 401 이면
 * `window.naver.maps` 내부가 null 이라 정리 경로가 throw 하고 **passive unmount effect 의 예외를
 * React 가 회복하지 못해 트리 전체가 날아간다.** 이 조건부가 **이미 게시된 문자 정보를 지킨다.**
 * ⚠ **죽은 어포던스를 만들지 마라** — 키가 없을 때 «헤딩 + 영구 실패 박스»만 남기지 않는다.
 * ⚠⚠ 이때 **코스콤 대오 한 줄도 함께 사라진다 — «의도된 상태»다**(그 문장이 막는 위험이 지도에서만
 *   생긴다). **위험과 완화는 같은 조건부 안에 있어야 한다 — 지도 밖으로 빼지 마라.**
 */
const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

if (NAVER_MAP_CLIENT_ID === "") {
  console.warn(
    "[strike] NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 미설정 — 9/4 참석 안내 페이지의 지도 섹션을 렌더하지 않습니다.",
  );
}

/** `SectionHeading` 은 **`id` 를 직접 받는다** — 결의대회 페이지의 `<div id="…">` 우회를 승계하지 않는다.
 *  랜드마크 이름 규칙: 화면에 헤딩이 있으므로 `aria-labelledby`(`union-webapp-dev` §8) */
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-h2 text-ink md:text-h1">
      {children}
    </h2>
  );
}

/** 시각 문자열의 **구분자 뒤**에 줄바꿈 기회를 준다 — 숫자·콜론·하이픈·물결에는 **줄바꿈 기회가
 *  자체적으로 없다**(`union-design-system` §0.8 셋째 문자 종류).
 *  ★★ **구분자는 «두 종류»다**(2026-09-01 신판) — 대부분 `-` 인데 **`13:00~13:15`·`13:15~13:30`
 *    두 행만 `~`** 다. 이 함수는 **어느 쪽이든 찾아서 그 뒤에 `<wbr>` 을 넣을 뿐**이고 문자 자체는
 *    손대지 않는다. ⚠ **여기서(또는 데이터에서) 구분자를 통일하지 마라** — 원문이 섞어 쓴다
 *    (§51-7 원문 보존 · 검증 §61-5 (2) · 게시 조건 45).
 *  ⚠ **`<wbr>` 은 `textContent` 에는 안 남지만(축자 보존 ✓) 프리렌더 HTML 에서는 갈린다** —
 *  게이트가 HTML 에 대고 `10:30-11:00` 을 grep 하면 **0건**이다. **태그를 제거하고 세라**
 *  (`grep -c` 금지 — `grep -o | wc -l`).
 *  ⚠ **`RallySchedule` 의 같은 헬퍼를 import 하지 마라** — 8/28 전용이라 지역 헬퍼로 다시 쓴다 */
function TimeText({ value }: { value: string }) {
  const i = value.search(/[-~]/);
  // `15:15` 단독 행 — **구분자를 붙이지 마라**(검증 조건 8). 원문은 폐회선언 시각만 말한다
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
  /** 원문 표기 그대로. ★★ **구분자를 통일하지 마라** — 20행 중 **`13:00~13:15`·`13:15~13:30`
   *  두 행만 `~`** 이고 나머지는 `-` 다(원문 축자 · §51-7 · 검증 §61-5 (2) · 게시 조건 45) */
  time: string;
  content: string;
}

/** 원문 「5. 총파업 식순」 20행 축자 — **2026-09-01 신판**(`design/총파업_식순.jpg`)으로 전면 교체.
 *  구판 값(폐회 `14:20` · 연대사→투쟁사 순 · 응원이벤트 없음)은 **주최측 신판이 들어온 순간 거짓**이
 *  됐다(검증 §61 A-5 · 게시 조건 45).
 *
 * ★★★ **「비고」를 되살리지 마라.** 신판 원본의 비고란은 **20행 전부 공란**이다(검증자가 원본
 *   직접 판독 · §61-1 · A-6). v1 에 있던 `윤석구 금융노조 위원장`·`김동명 한국노총 위원장 외` 는
 *   **근거가 «두 겹»으로 없다** — 인명도, 소속도 신판에 없다.
 *   ⚠ **«전에 있었으니 유지»가 바로 §5.8.2 가 막은 «구판에 기댄 판정»이다.**
 *   ⚠⚠ **`/rally-2026-08-28` 의 `RallySchedule` 에 같은 두 이름이 남아 있는 것은 «정당한 출현»이다**
 *     — 그쪽 근거는 **8/28 원문의 비고란**이다. **여기서 지웠다고 그쪽까지 지우지 마라**(§5.8.3).
 *
 * ★ **비고 «열»은 이 표에 원래 없다** — D-29 가 이미 3열 → 2열로 정했고, 비고는 내용 셀의
 *   **둘째 줄**이었다. 이번에 사라진 것은 그 둘째 줄이다. **3열로 되돌리지 마라**(200% 에서 내용
 *   열이 한글 1자 폭으로 눌린다 · 디자이너 실측). */
const PROGRAM: readonly ProgramRow[] = [
  { time: "10:30-11:00", content: "대오정비" },
  { time: "11:00-11:30", content: "사전집회 / 구호제창 / 동영상 상영/경과보고" }, // ★ `상영/경과보고` 에 공백 없음(원문 그대로)
  { time: "11:30-11:35", content: "지도부 및 내외빈 입장" },
  { time: "11:35-11:40", content: "깃발 입장" },
  { time: "11:40-11:45", content: "노동의례" },
  { time: "11:45-11:55", content: "참가조직 소개" },
  { time: "11:55-12:05", content: "총파업 선언 및 대회사" },
  { time: "12:05-12:10", content: "구호제창" },
  { time: "12:10-12:30", content: "격려사" },
  { time: "12:30-12:50", content: "문화공연 1" },
  { time: "12:50-13:00", content: "투쟁사" },
  { time: "13:00~13:15", content: "응원이벤트" }, // ★ 구분자가 `~` — 원문 그대로. `-` 로 고치지 마라
  { time: "13:15~13:30", content: "연대사" }, // ★ 구분자가 `~` — 원문 그대로. `-` 로 고치지 마라
  { time: "13:30-13:50", content: "문화공연 2" },
  { time: "13:50-14:00", content: "투쟁사" },
  { time: "14:00-14:50", content: "문화공연 3" },
  { time: "14:50-15:00", content: "상징의식" },
  { time: "15:00-15:10", content: "결의문 낭독" },
  { time: "15:10-15:15", content: "파업가 제창" },
  { time: "15:15", content: "폐회선언" }, // ★ 종료 시각이 아니라 «폐회선언 시각»이다. 범위로 펴지 마라
];

/** 원문 하단 단서 — **마침표까지 축자다.** 「조정될 수 있습니다」로 문체를 고치지 마라.
 *  **표와 같은 화면에 없으면 게시 불가**다(검증 조건 2 · §51-1) — 표가 길어 표 위(`<caption>`) +
 *  표 아래(`<p>`) 2곳에 둔다(§52.7-4).
 *  ⚠ **이 페이지의 `※` 는 이것 하나뿐이다**(종류 1 · 출현 2). **세 번째 `※` 를 만들지 마라** */
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
                ★ **행 순서가 원문과 반대다 — 승인된 역전이다**(리더 D-14). 두 사실이 둘 다 온전히
                게시되고 대상 명칭이 각 행에 축자로 붙으며, 정보 위계는 «조합원이 해야 할 행동» 기준이다(§3).
                ⚠ **간부 행을 빼지 마라** — 순서만 바뀌는 것이지 내용이 주는 것이 아니다.
                ⚠⚠ **D-14 의 조건 문면 «대상 명칭이 시각과 «같은 줄»에서 갈리게 하라» 는 죽었다**
                  (D-17 · §52.20-0). **인용하지 마라 — 조판 수단이 없다.** 그 목적(간부가 `10시 30분` 을
                  자기 시각으로 오독하는 것 방지)은 **대상 캡션이 대형 수치 «위»에 오는 것**으로 달성된다.
                ★ **개요 블록과 합치지 마라** — 한 카드에서 `11시` 와 `10시 30분` 이 나란히 서면
                  *"11시까지 가면 되나"* 오독이 페이지 안에서 재현된다(D-10).
              */}
              <p className="text-caption font-semibold text-ink-muted">전 조합원</p>
              {/*
                **`10시 30분` 이 이 페이지의 유일한 대형 수치다.**
                ⚠ **`10:30` 으로 바꾸지 마라** — 원문 「3. 집결시간」 축자다(배너의 `10:30` 은 사용자 지정 문면).
                ⚠ **`sr-only` 장형(`오전 10시 30분`)을 만들지 마라** — `10시 30분` 은 이미 한국어라
                  병기는 **신규 문자열 창작**이 된다.
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
                ★★ **`grid-cols-[auto_1fr]` 을 모바일에도 주지 마라**(디자이너 실측 · §52.2) —
                `break-words` 는 **min-content 기여값을 줄이지 않아** `1fr` 트랙이 원래 폭을 그대로 잡고,
                200% 에서 카드가 넘쳐 **문서가 가로로 밀린다.** → 모바일 1열 스택, 2열은 `md:` 에서만.
                ⚠ **`break-all`·`overflow-wrap:anywhere` 로 우회하지 마라** — 레이아웃을 고치는 쪽이 회귀가 작다.
                ⚠ **`md:` 는 텍스트 확대와 무관하다** — 미디어 쿼리의 `rem` 은 루트 `font-size` 를 따르지 않고
                  초기 16px 고정이다. 데스크톱 2열의 200% 안전은 **따로 쟀다**(§52.2).
                간격 비율 참값 — **항목 간 15px : 라벨↔값 3px = 5:1**(`row-gap 3 + dt mt-4 12 = 15px`).
                ⚠ **클래스 이름의 숫자(`mt-4`·`gap-y-1`)를 간격 비율로 적지 마라 — «4:1» 은 오답이다**
                  (§52.21-3 · QA 491). «클래스 비율»은 화면 값이 아니고,
                  **`row-gap` 은 «6행 사이 5곳 전부»에 붙는다.**
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
            ── 삽입 지점 B — 세종대로 안내지도 (2026-08-29 · M-1~M-21 · 디자인 §54·§54.16) ──

            ★ **자리 근거**: 개요의 `장소` 행이 세운 「세종대로」를 이 지도가 **세부로 받는다**
              (일반 → 특수). **첫 화면 판정선(`360×640`)에는 영향이 0 이다** — 이 자리가 판정선 아래다.
              ⚠ 그래도 **QA 가 삽입 «후»에 다시 재라**(`today` 를 반드시 함께).
            ⚠ **헤딩 문면 `세종대로 안내지도` 를 좁히지 마라**(M-10) — 이 지도는 무대·대오·화장실·역을
              함께 그린다. «집결 위치»·«코스콤 위치» 류로 바꾸면 **범위를 좁혀 거짓이 된다.**
            ⚠ **이 섹션 «밖»에 지도 관련 문장을 만들지 마라** — 완화 안내·확신도 키·코스콤 한 줄·범례가
              전부 `figure` 안에 있고 그 자리는 `StrikeMap` 이 정본이다.
          */}
          {NAVER_MAP_CLIENT_ID !== "" ? (
            <section aria-labelledby="map-heading" className="mt-section md:mt-section-lg">
              <SectionHeading id="map-heading">세종대로 안내지도</SectionHeading>
              <StrikeMap clientId={NAVER_MAP_CLIENT_ID} />
            </section>
          ) : null}

          {/*
            QR 출석체크 — **사실 한 줄**(리더 D-4 개정 · 검증 §52-4 확정 문면).

            ## ★★★ 조건 17(나) — 왜 **이 한 줄만** 있는가

            **사실이 «있다».** 지부 당사자 진술이라 **«있다»가 1급 확정**이고, 사용자 답변도
            *"9/4 당일에도 있다"* 였다 — **알려 주라는 답**이다. 없는 것은 **세부(방법·시각·URL)뿐**이다.

            침묵했을 때 조합원이 하는 일이 문제다: **출석체크를 안 찾거나, 8/28 방식을 유추한다.**

            ⚠⚠ **2026-08-29 개정(M-26 · 검증 §57-5 #1)** — 종전 이 자리는
            *«유추가 틀리면 **출석에 실패한다** — 그래서 침묵이 새 위험을 만든다»* 였다.
            **틀렸다. 유추는 «맞았다»** — 9/4 QR 이 같은 주소를 쓴다(사용자 확인 · 2급).
            ★ **그런데도 침묵은 여전히 새 위험을 만든다. 이유가 «바뀐» 것이다:**
            조합원이 8/28 페이지에서 주소를 찾아낼 때 **`1차·2차`(8/28 시각) · `상품권 5만원`(8/28 조건) ·
            `참석명단 작성(지부천막)`(8/28 동선) · `손피켓`(8/28 배포물)이 «함께» 딸려 온다.**
            ★★ **위험은 «소멸»이 아니라 «이동» 했다.** 그래서 처분이 «침묵»이 아니라
            **«주소만 우리가 준다»**(아래 카드)로 정해졌다.
            ⚠ 이것을 «위험이 사라졌다»로 읽지 마라 — 그러면 위 네 항목의 **기대 0 까지 함께 풀린다**(§57-4).

            ★ **파일 머리의 «코스콤지부 위치는 왜 없는가»(조건 17(가))와 «같은 상태»로 묶어 읽지 마라.**
              그쪽은 **사실 자체가 없고**, 여기는 **사실은 있고 세부가 없다.** 처분이 다른 것이 옳다.
              ⚠ **두 근거를 한 덩어리로 합치지 마라**(§52.18-6 · QA 481) — 합치면 다음 사람이
              «일관성» 을 이유로 **둘 중 하나를 뒤집는다.**

            ★ 형태 조건 4건(D-10) — **전부 여기서 이행된다:**
             1. **`※` 를 붙이지 마라** — 사실 진술이지 단서가 아니다. 이 페이지의 `※` 는 원문 단서 1종뿐이다
             2. ⚠ **개정됐다(M-26 · 검증 §57-3 (3))**. 종전: *«링크·필 버튼·카드로 만들지 마라 —
                `<p>` 하나이고 면·테두리·그림자·`href` 가 0 이다»*. **그 근거(«누를 곳이 없다»)가
                소멸했다** — 주소가 확인돼 **바로 아래 카드가 누를 곳이다.**
                ★ **살아남은 것 3가지**: ① **필 버튼으로 만들지 마라**(필 버튼은 «페이지 «안» 조작»의
                형태다 · §0.7 — 외부 이동은 **카드**) ② **`※` 로 달지 마라**
                ③ **본문 한 줄과 카드를 갈라 놓지 마라 — 한 벌이다**
             3. **원문 축자 블록 «안»에 넣지 마라** — `<section>` 3개 어디에도 안 들어간다(컨테이너 직속).
                위·아래 여백이 대칭이라 **어느 블록에도 소속되지 않는다**
             4. **두 문장을 분리하지 마라** — 단일 텍스트 노드 1개다. `<br>`·`<span>` 으로 쪼개면 grep 이 깨진다

            ⚠⚠ **§52-2 는 «절반»만 살아 있다**(M-26 · §57-5 #2). 문면이
              `방법과 시각은 추후 안내합니다` → **`인증 시각은 추후 안내합니다`** 로 바뀌었다.
               - **«시각은 추후»** — **유효.** 9/4 출석 시각은 여전히 미정이다(§57-6 #2). **빼지 마라.**
               - **«방법은 추후»** — **죽었다.** 방법(=주소)을 안다. **아래 카드가 그 방법이다.**
              ★ 종전 근거(*«8/28 참석자가 그때 방식을 유추하고, 유추가 틀리면 출석에 실패한다»*)는
                **틀렸다 — 유추는 맞았다**(§57-5 #1). 막을 것은 유추가 아니라
                **«유추와 함께 딸려 오는 8/28 조건»** 이다.
              ⚠ **`인증 시각은` 을 `시각은` 으로 줄이지 마라** — 카드가 붙어 있어 «카드를 누르는 시각»
                으로도 읽힌다(§57-3 (1)).
            ⚠ 금지어(요구 157 A 유형으로 미끄러진다): `확인 중` · `확인되는 대로` · `반영하겠습니다` ·
              `준비 중` · `업데이트 예정`. 그리고 **`지부 공지로` 를 쓰지 마라** — 사용자 축자가
              *"추후 추가할게"* 라 **이 페이지에 추가될 가능성이 높은데** 그 표현은 조합원을 다른 채널로 보낸다.

            자리 근거: 읽는 순서가 집결시간(내가 몇 시) → 개요(무슨 행사) → **여기**(그날 출석체크가 있다)
            → 식순 이다. 최상단에 두지 않는 이유는 **이 줄에 지금 할 수 있는 행동이 없어서**이고,
            식순 뒤에 두지 않는 이유는 **표가 806px 이라 그 아래가 안 읽혀서**다.
            ★ **카드가 붙어도 이 자리 판정은 그대로다** — 카드가 준 것은 «누를 곳»이지 «지금 할 수 있는
              행동»이 아니다. 도착지는 **당일 지정 시각에만** 체크를 받는다.
          */}
          <p className="mt-section break-keep break-words text-body text-ink md:mt-section-lg">
            당일 QR 출석체크가 있습니다. 인증 시각은 추후 안내합니다.
          </p>

          {/*
            ★★ **QR 출석체크 카드**(리더 M-26 · 검증 §57-3 (2) — **한 글자도 고치지 마라**).

            ## 왜 «넣는다» 인가 — 근거는 «편익»이 아니라 **«대안이 더 나쁘다»** 다

            M-24 로 `/rally-2026-08-28` 이 `/bargaining-2026` 에서 **한 번의 클릭 거리**가 됐다.
            그래서 **«링크를 안 넣는다»가 링크를 «막는» 것이 아니다** — 조합원은 8/28 카드에서
            같은 주소를 찾아내고, 그때 **`1차·2차`(8/28 시각) · `상품권 5만원`(8/28 조건) ·
            `참석명단 작성(지부천막)`(8/28 동선) · `손피켓`(8/28 배포물)** 을 **한 덩어리로** 가져간다.
            → **«안 넣는다»는 링크에 «8/28 조건을 묶어서» 주는 것이다**(§57-1).

            ## ⚠ 옮겨 오면 안 되는 것 — **확인된 것은 «주소 하나»뿐이다**

            **8/28 카드의 설명 3줄을 옮기지 마라** — *"손피켓이 없어도 이 링크로 인증할 수 있습니다."* ·
            *"손피켓의 QR을 찍으면 나오는 출석체크 페이지와 같습니다. 지정된 출석 시간에만 체크됩니다."*
            **전부 손피켓 전제**이고 **9/4 배포물은 미확인**이다(§57-6 #3).
            ⚠ **`손피켓` 금지** · ⚠ **`바로하기` 금지** — 8/28 카드 제목이 `손피켓 QR인증 바로하기` 다.
              **두 페이지의 라벨이 갈려야** «한 문자열 두 목적지» 충돌이 없다(§20.0-3 계열).
            ⚠ **`지정된 출석 시간` 을 쓰지 마라** — 9/4 는 시각이 미정이라 **그 확정 명사를 못 쓴다.**
              그래서 `당일 지정된 시각에만` 이다.

            ## 문면 근거

            | 줄 | 근거 |
            |---|---|
            | `금융노조 QR 출석체크` | 도착지 `<title>` 「**금융노조** 집회참석」과 낱말이 겹쳐 **«맞게 왔다»가 확인된다**. 뒤 낱말은 위 `<p>` 와 같다 |
            | `당일 지정된 시각에만 체크됩니다.` | ★ 도착지 실측 문면(「지정된 시간에만 체크 가능합니다」)의 **요지**다 — 우리 창작이 아니다. **`당일` 이 «미리 눌러 출석했다고 믿는» 경로를 막는다**(성공 피드백 유무는 확인 불가 · §57-6 #1) |

            ## 형태 — **8/28 카드와 «일부러» 같게 뒀다**(§57-3 (3) 조건 5 · §0.7)

            **카드 = 외부 이동**이다. ⚠ **필 버튼으로 바꾸지 마라** — 필 버튼은 «페이지 «안» 조작»의 형태다.
            남색 면(`bg-primary` ↔ 흰 글자 대비 **12.6** AAA)까지 `QrAttendanceCard` 와 같은 값을 쓴다 —
            **두 페이지가 같은 것을 같은 형태로** 말한다.
            ⚠ **클래스 문자열이 두 벌이다**(여기 · `src/components/rally/QrAttendanceCard.tsx`).
              **공통 컴포넌트로 묶지 않았다** — 그쪽 카드는 제목·설명 구성이 다르고 주석이 8/28 판정을
              통째로 지고 있다. **한쪽 형태를 고치면 다른 쪽도 열어 보라.**

            ## 접근성 — **`aria-label` 을 붙이지 마라**(`union-webapp-dev §8`)

            **카드 전체가 단일 `<a>`** 라 **내부 텍스트(제목 + 설명 + 도메인 줄)가 접근성 이름을 진다.**
            `aria-label` 을 붙이는 순간 **설명 줄(«당일 지정된 시각에만»)이 링크 낭독에서 사라진다.**
            외부 이동 **3중 병행**(§14.1): ↗ 아이콘 + 도메인 표기 + 내부 텍스트가 지는 이름.
            ★ **도메인은 `href` 에서 파생한다**(`UNION_ATTENDANCE_DISPLAY_HOST`) — 리터럴을 적으면
              링크와 표시가 갈린다. **`break-all` 은 도메인 줄에만**(공백 없는 라틴 덩어리 · §0.8).
          */}
          <a
            href={EXTERNAL_LINKS.unionAttendance}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-card shadow-card ease-out-soft group mt-4 block bg-primary p-4 transition-opacity duration-150 hover:opacity-95 hover:outline-2 hover:-outline-offset-4 hover:outline-white focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span className="block break-keep break-words text-lead font-bold text-white group-hover:underline">
              금융노조 QR 출석체크
              <ExternalLinkIcon className="ml-1 inline size-5 align-[-3px]" />
            </span>
            <span className="mt-1 block break-keep break-words text-caption text-white">
              당일 지정된 시각에만 체크됩니다.
            </span>
            <span className="mt-1.5 block break-all text-caption text-white/80">
              외부 링크(새 창) · {UNION_ATTENDANCE_DISPLAY_HOST}
            </span>
          </a>

          {/* ── 블록 3 — 총파업 식순 (원문 「5. 총파업 식순」) ── */}
          <section aria-labelledby="program-heading" className="mt-section md:mt-section-lg">
            <SectionHeading id="program-heading">총파업 식순</SectionHeading>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              {/*
                ★ **표는 2열이다(시간 / 내용). 비고는 내용 셀 둘째 줄.**
                ⚠ **3열로 만들지 마라** — 200% 에서 내용 열이 **한글 1자 폭**으로 눌린다(디자이너 실측).
                  **`RallySchedule` 의 3열을 근거로 밀지도 마라**: 그쪽 셋째 열은 «전 행에 걸친 다른
                  출처»였고 이번 비고는 **같은 출처의 부속 정보 2건**이다.
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
                        ★★ **시간 셀의 `break-words` 를 빼지 마라**(디자이너 실측 · §52.7-3) — 200% 에서
                        `<wbr>` 이 만든 최장 덩어리가 셀 폭을 넘겨 **내용 열 위로 겹쳐 찍힌다.**
                        ⚠ **`w-[78px]` 을 키워서 고치려 하지 마라** — px 고정이라 확대를 따라가지 않고,
                          200% 를 덮을 만큼 키우면 내용 열이 사라진다.
                          **처방은 «셀 안에서 접히게 하는 것» 하나뿐이다.**
                      */}
                      <td className="border-t border-border-soft py-3 pr-1.5 align-top break-keep break-words text-caption text-ink">
                        <TimeText value={row.time} />
                      </td>
                      {/* ⚠ **둘째 줄(구 「비고」)을 되살리지 마라** — 신판 비고란은 20행 전부
                          공란이다(`PROGRAM` 주석 · 검증 §61 A-6). */}
                      <td className="border-t border-border-soft py-3 align-top break-keep break-words text-caption text-ink">
                        {row.content}
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
