import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { RallyMap } from "@/components/rally/RallyMap";
import { QrAttendanceCard } from "@/components/rally/QrAttendanceCard";
import { RallySchedule } from "@/components/rally/RallySchedule";
import { WayfindingBlock } from "@/components/rally/WayfindingBlock";
import { RALLY_PAST_NOTE, RallyStatusBadge } from "@/components/rally/RallyStatus";
import { rallyPhase } from "@/lib/rally";
/* `STAGE3_SENTENCE`(블록 2 본) 은 2026-08-21 에 블록 2 에서 빠졌다 — 배치도 이미지에 `무대3 (LED)`
   라벨이 있고 **무대 카드가 같은 사실을 이미 진다**(요구 182). 상수는 `rallyMap.ts` 에 살아 있고
   `STAGE3_SENTENCE_CARD` 가 그것을 파생한다 — **지우지 마라**(요구 88 · 한 출처). */
import { STAGE3_SENTENCE_CARD, ZONE_STATUS } from "@/lib/rallyMap";
import { ROUTES } from "@/lib/routes";

/**
 * 8/28 총력투쟁 결의대회 참석 안내 (디자인 스펙 §20.3).
 *
 * 최상위 라우트인 이유: 메인에서 직행하는 1급 진입점이고, 카카오톡 등으로 공유된 URL 이
 * 남으므로 `/bargaining-2026` 개편·폐기에 **동반 사망하면 안 된다**(§20.0-4).
 *
 * 이 페이지의 모든 문장은 검증 게이트를 통과한 표현이다. 근거:
 *  - 원문 전사: `_workspace/00_input/content-rally-20260828.md`
 *  - 검증 판정: `_workspace/01_verifier_factcheck.md` 검증 리포트(4회차) — **조건부 승인**
 *  - 문안 게이트: `_workspace/02_designer_spec.md` §20.10 (리더 확정)
 *
 * **문안을 임의로 고치지 마라.** 특히 다음은 게시 조건이라 지우면 반려된다:
 *  - `설치될 예정`·`배포할 예정`·`대오 논의` — 확정형으로 바꾸면 없는 확실성을 주장한다
 *  - 인명의 **소속 병기** — 소속 없는 `윤석구 위원장`·`김동명 위원장` 은 게시 불가(검증 §7-1)
 *  - `※ 상황에 따라 식순 변경 가능` 을 표와 같은 화면에(검증 §7-2)
 * 그리고 다음은 의도적으로 **빠져 있다**:
 *  - `우측 도로`·특정 도로 하이라이트 — 방향 기준점이 없어 검증 불가(검증 §5-2)
 *  - `528세대` — 원문 이미지 외 근거 0(검증 §7-10)
 *  - 손피켓·주최측 지도 캡처 이미지 — 출처·저작권 미확인(검증 §7-11)
 *  - `18:00` 을 집결 시각으로 쓰는 것 — 주최측 장내 정리 시간대다(검증 §7-6)
 *  - 화장실 지도 핀·지도 앱 딥링크 — 좌표 미검증(§7-7) / 검색 URL 형식 미검증
 *  - OS·기기별 위치서비스 설정 경로 — 기기마다 달라 틀리면 현장에서 출석에 실패한다(요구 17)
 *  - `크롬은 안 됩니다`/`크롬도 됩니다` — 양방향 모두. 원문이 가부를 쓰지 않았다
 *  - `2회 미완료 시 출석 무효`·`20:00까지 오시면 됩니다`·`폐회 후 출석`(요구 16)
 *  - LED무대 좌표 — 도면 없이 찍으면 순수 날조다(검증 §5-12-8)
 *
 * ISR revalidate 60초: 상태(예고/당일/종료)를 요청 시점에 계산하므로 정적 프리렌더를 쓰지 않는다.
 * KST 자정 경계에서 최대 60초 전환이 늦는 것은 허용값이다(§18.7 선례).
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title:
    "8/28(금) 저녁 결의대회 참석 안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "2026년 8월 28일(금) 18:30 국회의사당역 5번 출구 집결. 코스콤지부 집결 위치와 결의대회 순서를 안내합니다.",
};

/*
 * 네이버 지도 Client ID — `NEXT_PUBLIC_*` 은 **빌드타임에 번들로 임베드**된다
 * (`deploy/web/docker-compose.yml` 의 build.args → Dockerfile ARG/ENV).
 * 미설정이면 `<figure>` 자체를 렌더하지 않는다(§20.4.5): 조합원에게 운영 사정을 노출할 이유가
 * 없고, 위치 정보는 바로 위 "코스콤지부 집결 위치" 블록에 온전히 있다. 경고는 서버 콘솔로만 간다.
 */
const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

if (NAVER_MAP_CLIENT_ID === "") {
  console.warn(
    "[rally] NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 미설정 — 참석 안내 페이지의 지도 블록을 렌더하지 않습니다.",
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 text-ink md:text-h1">{children}</h2>;
}

/** L2 면 카드 (무대·출석·화장실) — `bg-surface` 위 본문은 16.65 */
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-panel bg-surface p-5">
      <h3 className="text-lead text-ink">{title}</h3>
      <div className="mt-2 break-keep text-body text-ink">{children}</div>
    </li>
  );
}

export default function RallyPage() {
  // 하드코딩 0 — 렌더 시점 계산이다(§20.6)
  const phase = rallyPhase();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <div className="mx-auto mt-8 w-full max-w-page px-4 md:mt-14 md:px-8">
          {/* 상단 복귀 링크 (§16.12.1) — 하단과 같은 문자열 2회는 허용 패턴이다(§20.3.7) */}
          <p>
            <Link
              href={ROUTES.bargaining}
              className="inline-flex min-h-touch items-center text-caption font-semibold text-primary hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <span aria-hidden="true">←&nbsp;</span>
              26년 임단협 투쟁 안내로 돌아가기
            </Link>
          </p>

          {/* 상태 배지 + 상태 문장 — today/past 에서만. upcoming 은 아무 상태도 말하지 않는다 */}
          {phase !== "upcoming" ? (
            <p className="mt-4">
              <RallyStatusBadge phase={phase} />
            </p>
          ) : null}

          {/* 사용자 지정 문구 — 상태와 무관하게 **한 글자도 고치지 않는다**. 취소선 금지(§20.6) */}
          <h1 className={`text-title break-keep text-ink md:text-display ${phase === "upcoming" ? "mt-4" : "mt-3"}`}>
            8/28(금) 저녁 결의대회 참석 안내
          </h1>

          {phase === "past" ? (
            <p className="mt-3 max-w-[var(--container-prose)] break-keep text-body text-ink">
              {RALLY_PAST_NOTE}
            </p>
          ) : null}

          {/* 정식명칭 1회 노출 (검증 §4) — 미니달력 셀이 깨지므로 일정 title 은 축약형을 유지한다 */}
          <p className="mt-3 max-w-[var(--container-prose)] break-keep text-body text-ink-muted">
            2026년 산별중앙교섭 투쟁 승리를 위한 총파업 총력투쟁 결의대회
          </p>

          {/* ── 블록 1 — 집결 안내 (검증 §3 게시 조건) ── */}
          <section aria-labelledby="gather-heading" className="mt-section md:mt-section-lg">
            <div id="gather-heading">
              <SectionHeading>집결 안내</SectionHeading>
            </div>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              <p className="text-caption font-semibold text-ink-muted">집결</p>
              <p className="mt-1 text-lead text-ink">2026년 8월 28일(금)</p>
              {/*
                **18:30 이 이 페이지의 유일한 대형 수치다**(검증 §3).
                18:00 을 집결 시각으로 쓰지 마라 — 18:00~18:30 은 주최측 장내 정리 시간대이며
                식순표 안에만 존재한다(검증 §7-6).
                sr-only 장형은 같은 시각의 한국어 표기일 뿐 새 사실을 만들지 않는다(§19.4.3 선례).
              */}
              <p className="font-display mt-1 text-hero leading-none text-ink md:text-hero-lg">
                <time dateTime="2026-08-28T18:30:00+09:00">
                  <span aria-hidden="true">18:30</span>
                  <span className="sr-only">오후 6시 30분</span>
                </time>
              </p>

              {/*
                행 순서는 **참석 시간 → 본대회 → 장소**다(요구 126 · §28.4.2).
                **큰 범위 → 그 안의 한 지점 → 장소** 순이고, 유일한 비시각 항목인 `장소` 가 맨 아래다.
              */}
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 md:mt-8">
                {/*
                  ⚠ **`코스콤지부 | 20:30까지 참가 계획` 행이 제거되고 이 행으로 교체됐다**
                  (사용자 지시 · 검증 15회차 요구 122·123). 사용자 원 요청이 `18:30 ~ 20:30` 표기였고,
                  그 행과 각주 1 을 **"쓸데없는 사족"으로 지목**했다.

                  ⚠ **`집회 시간`·`행사 시간` 으로 바꾸지 마라**(요구 123 금지):
                  그것은 **주최측 종료를 단정**하는 표기이고, 사용자가 명시한 **`20:20 이 공식 행사종료`** 와
                  충돌한다. **`참석 시간`** 은 페이지 제목(`…결의대회 **참석** 안내`)의 용어 재사용이라 **창작 0** 이다.
                  주어(`코스콤지부 …`)를 되살리지도 마라 — **사용자가 명시적으로 지운 것**이다.

                  **대형 `18:30` 에 `~ 20:30` 을 붙이지 않는다**(§28.4.1): 캡션이 `집결` 이라
                  범위를 붙이면 *"집결이 2시간"* 으로 읽히고, 캡션을 `집회` 로 바꾸면
                  **이 페이지의 핵심 메시지(`집결 18:30`)와 홈 진입 카드가 어긋난다.**
                  중복도 아니다 — 대형 `18:30` 은 *"몇 시에 가야 하나"*, 이 행은 *"얼마나 하나"* 로
                  **다른 질문에 답한다.** `20:30` 을 굵게·크게 하지 마라(§20.3.2 유일 대형 수치 규칙).

                  `<time>` 은 대형 `18:30` 전용을 유지한다 — 한 표에서 한 행만 마크업이 다르면
                  그 차이 자체가 의미로 읽힌다(§22.13.5).
                */}
                <dt className="text-caption font-semibold text-ink-muted">참석 시간</dt>
                <dd className="break-keep text-body text-ink">
                  <span aria-hidden="true">18:30 ~ 20:30</span>
                  <span className="sr-only">오후 6시 30분부터 오후 8시 30분까지</span>
                </dd>
                <dt className="text-caption font-semibold text-ink-muted">본대회</dt>
                <dd className="text-body text-ink">19:00 개회</dd>
                <dt className="text-caption font-semibold text-ink-muted">장소</dt>
                <dd className="break-keep text-body text-ink">국회의사당역 5번 출구 메인무대 앞</dd>
              </dl>

              {/*
                오시는 길(§29 · 검증 17회차 요구 118·135). 링크 카드와 **교통 안내가 한 컴포넌트**다 —
                **교통 안내 없는 길찾기 링크를 만들 방법 자체를 없앤다**(네이버 화면 상단의 `자동차` 탭을
                누르면 자가용 경로가 나오는데 당일 인근 도로는 통제된다).

                **자리가 근거다**: 링크의 도착지가 곧 위 `장소` 행의 내용이라 그 바로 아래가
                인접성이 성립하는 자리이고, "여기 어떻게 가지?"는 페이지를 열자마자 드는 생각인데
                블록 1 은 지도보다 위에 있다. `※` 2행보다 **위**인 이유: 링크는 `장소` 에 묶이고
                `※` 는 시각에 묶이며, 마지막 자리는 **당일 해야 하는 행동**(2차 출석)이 갖는 것이 맞다.

                **hairline 으로 `<dl>` 과 가른다**: 집결 정보(`18:30`·`<dl>`)와 오시는 길은 **다른 층위**다.
                **새 카드를 중첩하지 마라** — 링크 카드가 이미 테두리를 갖고 있다.
              */}
              <WayfindingBlock className="mt-6 border-t border-border-soft pt-5" />

              {/*
                ⚠ **각주 1(`※ 20:30 은 코스콤지부의 참가 계획입니다…`)은 전체 삭제됐다**
                (검증 15회차 요구 122 — 요구 58·59 폐기, 12회차 요구 100 이 여기에 흡수).
                사용자가 **"쓸데없는 사족"으로 지목**했고, `20:30` 의 성격이 §6.8.1 로 정리되면서
                주어를 설명하던 그 각주의 근거 자체가 사라졌다. **되살리지 마라.**

                **아래 각주 2 는 무수정 유지다**(요구 124 · 60). `ink-muted` 로 흐리지도 마라 —
                읽어야 하는 문장이다. `20:30` 을 드러낼수록 **이 문장이 더 필요해진다**:
                참석 시간이 20:30 에 끝나는데 2차 출석 창은 21:00 까지라 **30분 공백**이 생기고,
                이 문장이 "자리를 뜨기 전에 찍으라"로 그 공백을 메운다.
                **`자리를 뜨면 출석이 되지 않습니다` 로 강화하지 마라** — 지오펜스 반경이 미확인이다.
                `20:00~21:00` 에 **색 강조 금지**(요구 13).
              */}
              <p className="mt-1 max-w-[var(--container-prose)] break-keep text-body text-ink">
                ※ 2차 출석은 20:00~21:00 입니다. 현장에서 위치가 확인돼야 하니 자리를 뜨기 전에 완료해
                주세요.
              </p>
            </div>
          </section>

          {/* ── 블록 2 — 코스콤지부 집결 위치 (검증 §2-2 문안 필수) ──
              **지도보다 위에 온다**(§20.0-8). 지도가 화면을 채우면 아래 텍스트를 읽지 않는다.
              단서를 이유로 위치를 흐리지 않는다(리더 지시 2): 위치가 첫 줄 20px, 단서가 둘째 줄 18px.
              단서를 ink-muted 로 흐리지 않는다 — 읽어야 하는 문장이다. */}
          <section aria-labelledby="position-heading" className="mt-section md:mt-section-lg">
            <div id="position-heading">
              <SectionHeading>코스콤지부 집결 위치</SectionHeading>
            </div>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              {/*
                주최측 배치도 원본 (사용자 지시 2026-08-21 — "제목과 내용 사이에 배치").

                ★ **이 이미지의 역할은 "위치 안내"가 아니라 "출처 증거"다**(§36.9-1).
                위치를 읽는 도구는 아래 지도다(3구역만 · 100m · 라벨 · 범례 · 팝업).
                그래서 모바일에서 이미지 안 라벨이 판독되지 않는 것이 치명적이지 않다 — 아래 참조.

                ⚠ **화살표·강조 테두리·크롭을 넣지 마라.** 주최측 원본이라는 것이 이 이미지의
                존재 이유이고, 손대는 순간 원본이 아니게 된다. 강조는 아래 지도가 이미 하고 있다.

                ⚠ **`unoptimized` 를 쓰지 마라** — QR 과 반대 판정이고 근거가 다르다.
                QR 은 모듈 경계선이 재인코딩에 무너지지만, 이것은 위성사진이라 손실 압축에 적합하다.
                `quality={90}` 은 이미지 안에 읽을 문자가 있기 때문이고,
                `sizes` 가 데이터 비용의 실질 대책이다 — 360px 단말은 약 384px 변형만 받는다.

                ⚠ **폭 상한을 두지 마라.** QR 의 `max-w-[480px]` 근거는 *"스캔 대상이 아니라
                크게 낼 이유가 없다"* 인데 이것은 반대다 — 안에 읽어야 할 문자가 있다.

                ★ **`alt` 첫머리에 `주최측 배치도 —` 를 붙이지 마라**(요구 201) —
                스크린리더가 `alt` 다음 `figcaption` 을 이어 읽어 **두 번 들린다.**
                ★ **`alt` 에 `코스콤지부`·`배정 예정`·거리 수치를 넣지 마라**(요구 195) —
                **이미지에 없는 것**이고 본문이 이미 진다. `alt` 는 이미지가 보여주는 것만 말한다.
                (스크린리더 사용자는 `본문: 코스콤지부 = 3구역` + `alt: 3구역 = 2구역 북동·KDB 쪽`
                 두 조각으로 연결이 성립한다.)

                ★ **캡션 `주최측 배치도` 는 장식이 아니다**(요구 202).
                본문 앞머리의 `주최측 안내에 따르면` 을 지운 **대체물**이고, 빼면 이 블록에서
                **출처 표기가 완전히 사라진다**(§2 는 2급 자료에 출처 명기를 게시 조건으로 건다).
                **이미지 자체는 출처를 말하지 못한다** — 위성지도에 색칠한 그림일 뿐이고,
                *"이것이 주최측 자료다"* 는 문자만 할 수 있다.
              */}
              <figure className="mb-6">
                <Image
                  src="/images/rally-2026-08-28/rally-layout.png"
                  width={1077}
                  height={995}
                  quality={90}
                  sizes="(min-width: 768px) 832px, 100vw"
                  alt="여의도 의사당대로를 따라 집회 1·2·3구역과 무대 1·2·3이 표시된 위성지도입니다. 집회 3구역은 2구역의 북동쪽(KDB산업은행 쪽)이고 그 앞이 무대3(LED)입니다."
                  className="rounded-badge border border-border-soft block h-auto w-full"
                />
                <figcaption className="mt-3 text-caption text-ink">주최측 배치도</figcaption>
              </figure>
              {/*
                검증 18회차 §18-8 · 19회차 §19-5 · 20회차 요구 163 **확정본**이다. 임의로 고치지 마라.

                ⚠ **`확인 중이며, 확인되는 대로 지도에 반영하겠습니다` 를 되살리지 마라**(요구 157).
                그것은 **우리 작업 상태의 서술(A 유형)** 이었고 **좌표가 나와 상태가 끝났다 — 남기면 거짓이다.**

                ⚠ **반대로 이 두 가지는 지우지 마라**(요구 160 — 경계):
                  **B `배정될 예정입니다`** — 배치도 원문 표기다. 지우면 확정으로 읽힌다
                  **C 정밀도 한계(±20~30m)의 문면 이행** — §18-1
                **둘을 함께 지우면 없는 확실성을 주장하게 되어 반대 방향의 오류가 된다**(§19-1).

                ★ **단, C 를 지는 문장이 2026-08-21 에 바뀌었다.** 종전에는 이 블록의
                `※ 지도의 구역 표시는 주최측 배치도를 옮긴 근사 위치입니다` 였는데 **삭제했다.**
                **철회가 아니라 4중 고지를 하나로 모은 것이다**(검증 §37):
                  ① 도형 점선·옅은 면   ② 범례 키 줄 `옅은 면 = 범위 근사`
                  ③ 범례 ④ 행 `…근사 구간이라 실제 경계와 다를 수 있습니다`   ④ 이 블록의 ※
                **③이 최적이다**(도형 바로 옆에서 읽힌다). ④는 **원본 이미지 바로 아래라
                "옮긴 근사"의 대상이 눈앞에 원본으로 있다.** → **④만 지우고 ①②③ 무수정.**
                ⚠ **①②③ 중 하나라도 지우면 C 가 무너진다. 그때는 ④를 되살려야 한다.**

                ⚠ **금지어**(요구 163-2 · 151):
                  `여의도공원 쪽`·`여의도공원 방향` — 공원 경계는 **2구역 남동단에서도 1m** 라 두 구역을
                    가르지 못한다. **조합원을 2구역으로 보낼 수 있다.** 원 안내자료 표현이라도 옮기지 마라
                  `더샵아일랜드파크` — 옛 배포 문구의 기억을 되살린다
                  **단일 거리 수치**(`약 327 m`) · 좌표 노출 · `확정`·`배정되었습니다`

                방위 단서(`나란한 두 구역 중 북동쪽 — KDB산업은행 쪽`)는 18-8 의 `2구역 언급 금지` 를
                **이 목적에 한해 해제**한 것이다(요구 163) — *"2구역이 어디다"* 가 아니라
                *"우리 구역이 둘 중 어느 쪽이다"* 를 말하므로 성질이 다르다.
                **`앞` 이 아니라 `쪽` 이다** — 산업은행 외곽선까지 60m 이고 도로 건너다.
              */}
              {/*
                ★ **`주최측 안내에 따르면` 을 되살리지 마라**(사용자 지시 2026-08-21).
                출처는 위 이미지의 **캡션 `주최측 배치도`** 가 진다 — 문장 앞머리에 또 쓰면 중복이다.
                **캡션을 지우면 이 문장도 함께 재검토해야 한다**(출처 표기가 0이 된다).

                ⚠ **`배정될 예정입니다` 는 지우지 마라**(요구 160 · B 유형) — 배치도 원문 표기다.
                ★ 그리고 **이 문장을 이미지가 대신한다고 보지 마라**(검증 §37):
                **`break.png` 에는 `코스콤지부` 라는 글자가 없다**(위성지도 부분만 캡처됐다).
                이미지가 보여주는 것은 `집회 3구역` 이라는 라벨이고,
                **그것이 우리 자리라는 사실은 이 문장에만 있다.**
              */}
              <p className="break-keep break-words text-lead text-ink">
                {ZONE_STATUS.assignment}
              </p>
              {/*
                ★ **`여의도` 를 지우지 마라**(요구 191 — 검증 판정 2026-08-21).
                §18-8 확정안으로 블록을 통째 교체할 때 **옛 문장의 `여의도` 가 렌더에서 완전히 사라졌다.**
                남은 `여의도` 는 `여의도공원` 뿐이고 **전부 화장실 안내라 집회 장소를 가리키지 않는다.**

                **사이트 정합성이 결정적 근거다**: `src/lib/struggleSchedule.ts` 가 8/28 일정을
                **`서울 여의도 · 저녁`** 으로 렌더한다 — **투쟁 일정에서 `여의도` 를 보고 들어온 조합원이
                상세 페이지에서 그 낱말을 못 찾는다.**

                **창작이 아니다** — `여의도 의사당대로` 는 **원문 §6.9 표기 그대로**다
                (`- 여의도 의사당대로 (9호선 국회의사당역 인근)`).

                ⚠ **옛 문장(`집회 장소는 여의도 의사당대로(국회의사당역 인근)입니다.`)을 되살리지 마라.**
                그것은 **집회 전체 층위**인데 이 블록은 **`코스콤지부 집결 위치`** 다 — 넣으면 블록이 두 층위를 섞는다.
                **낱말 하나면 지명은 복구되고 층위는 안 흔들린다.**
                ⚠ **`<dl>` 장소 행에는 넣지 마라** — 원문 §1 축자 인용이고 무수정 판정됐다.
              */}
              {/*
                파생 근거(요구 188) — 채택 좌표 §23-1 기준
                5번 출구 ↔ 3구역 : 폴리곤 최근접 249 m ~ 최원 꼭짓점 396 m
                (앞쪽 변 중점 253 m · 중심 322 m · 뒤쪽 변 중점 392 m)
                ★ 좌표가 바뀌면 이 값을 다시 재고 렌더 문자열과 대조하라.
                  `약 30~100 m` 오류가 살아남은 원인이 **근거가 없어 대조할 대상이 없었던 것**이다.
              */}
              <p className="mt-3 max-w-[var(--container-prose)] break-keep text-body text-ink">
                국회의사당역 5번 출구에서 여의도 의사당대로를 따라 남동쪽으로 약 250~400 m
              </p>
              {/*
                방위 단서(§30.17.5) — **자리와 굵기가 판정 사항이다.**

                **자리**: 경로 문장 **다음**, 무대 문장 **앞**. 읽는 순서가 행동 순서와 같아야 한다 —
                ① 우리는 3구역 → ② 5번 출구에서 남동쪽 250~400 m → **③ 도착해서 나란한 두 띠 중 어느 쪽인가**
                → ④ 앞에 무대3. **③ 은 ② 다음에만 뜻이 있다.** `※` 두 줄보다 위다(`※` 는 단서, 이건 본문).

                **위계는 `font-semibold` 그것뿐이다.** 블록 2 산문 중 유일하게 굵은 문장이 된다.
                **크기·색·아이콘·박스 전부 기각** — `#093389`·적색은 이 사이트의 **의미색**이고
                이 문장은 링크도 긴급도 아니다. 박스는 방금 지운 상태 패널을 되살리는 것이다.
                대비 변경 0(`#1a1a1a` on `#ffffff` = 17.40:1) — **굵기만 바뀐다.**

                ⚠ **지도 위 상태 패널로 옮기지 마라**(§30.16.4 안은 폐기됐다).
              */}
              {/*
                ★ **굵기를 뺐다**(2026-08-21). §30.17.5 의 `font-semibold` 근거는
                *"블록 2 산문 중 유일하게 굵은 문장"* 이었는데, **산문이 6줄 → 4줄로 줄어
                하나만 굵으면 나머지가 부차적으로 읽힌다.** §30.17.5 를 되살리지 마라.

                ★★ **이 문장을 지우지 마라. 한 번 지웠다가 되살린 것이다.**
                검증 §37 이 *"방위는 그림이 문장보다 낫다"* 로 삭제를 판정했는데,
                **그 근거가 모바일에서 성립하지 않는다** — 리더가 실측했다:
                `break.png` 를 360px 단말 표시 크기(328×303)로 축소하면
                **`집회 3구역` 라벨이 띠를 따라 회전돼 있어 얼룩으로 보인다. 글자로 인식되지 않는다.**

                ★ 다만 되살린 진짜 근거는 이미지 판독성이 아니다 — **이 문장의 존재 이유가
                처음부터 이미지와 무관했다.** 현장에 도착하면 **눈앞에 나란한 두 대오**가 있고,
                우리 지도는 요구 149 로 **3구역만 그리므로 "옆에 또 있다"를 말하지 않는다.**
                **KDB산업은행이라는 눈에 보이는 지물이 유일한 판별 수단**이고,
                틀리면 **다른 지부 대오에 선다**(요구 163 의 원래 근거).
                → §5.3(문안 절제)이 *"행동이 갈리는 사실"* 을 삭제 예외로 지정한 바로 그 경우다.
              */}
              <p className="mt-1 max-w-[var(--container-prose)] break-keep text-body text-ink">
                {ZONE_STATUS.bearing}
              </p>
              {/* 기존 승인 문장 — 조합원이 **현장에서 자기 자리를 최종 확인하는 수단**이다.
                  도형이 `estimated`(±20~30m) 인 이상 이 문장이 마지막 관문이라 **빼지 마라.** */}
              <p className="mt-1 break-keep text-body text-ink">
                ※ 현장에서 지부 깃발을 확인해 주세요.
              </p>
            </div>
          </section>

          {/* ── 블록 2-A — QR 출석체크 안내 (§20.19.1) ──
              지도보다 **위**에 온다. ① 출석 2회는 집결 18:30 과 함께 하루의 시간표를 이루고,
              ② 사전 준비물(위치서비스 동의)은 **집을 나서기 전에** 해야 하는 행동이다.
              지도 아래에 두면 모바일에서 한참 스크롤한 뒤에야 만나는데 그때는 이미 늦다. */}
          <section aria-labelledby="attendance-heading" className="mt-section md:mt-section-lg">
            <div id="attendance-heading">
              <SectionHeading>QR 출석체크 안내</SectionHeading>
            </div>
            <QrAttendanceCard />
          </section>

          {/* ── 블록 3 — 지도 + 내 위치 ──
              Client ID 미설정이면 이 섹션 전체를 렌더하지 않는다(§20.4.5).
              위치 정보는 블록 2 에 온전히 있으므로 은폐가 아니다.
              `<figure>`·범례·내 위치 UI 는 `RallyMap` 이 함께 렌더한다 — 범례 ⑥ 행이
              내 위치 표시 여부에 따라 달라지고(§20.14.4), 범례 행 자체가 `MAP_FEATURES` 에서
              파생되기 때문이다(§20.20.5). */}
          {NAVER_MAP_CLIENT_ID !== "" ? (
            <section aria-labelledby="map-heading" className="mt-section md:mt-section-lg">
              <div id="map-heading">
                <SectionHeading>위치 지도</SectionHeading>
              </div>
              {/*
                ⚠ **구역 상태 패널(§28.2)은 제거됐다**(§30.10.1 · 요구 163-1). **되살리지 마라.**

                **그 패널의 설계 근거는 단 하나였다**: *"④ 를 그냥 지우면 조합원은 이전에 본 위치를 기억한다.
                지워진 자리는 스스로 말하지 않는다."* — **④ 가 좌표를 갖고 돌아왔으므로 근거가 소멸했다.**

                남기면 같은 사실이 **④ pill · 범례 ④ 행 · 팝업 · 블록 2 산문**에 더해 **5곳**에 나온다.
                그리고 `pendingOnMap` 을 §19-5 문장으로 대체하면 `assignment` 와 **글자까지 같아져
                같은 문장이 블록 2 와 여기서 두 번 출력된다**(§20-9).

                **`배정 예정` 이 사라지는 것이 아니다** — ④ 라벨의 `(예정)` · 범례 ④ 행 · 블록 2 산문이 진다.
              */}
              <RallyMap clientId={NAVER_MAP_CLIENT_ID} />

              {/*
                오시는 길 — **`<figure>` 밖, 지도 섹션의 마지막**이다(§29.2).

                읽기 순서가 맞다: 지도를 본다 → 범례로 지점을 확인한다 → **"그래서 어떻게 가지?"** → 길찾기.
                의미 구조도 맞다 — `<figure>`/`<figcaption>` 은 **그림과 그 설명**이고
                길찾기는 지도의 설명이 아니라 **별개의 행동 수단**이다.

                ⚠ **`<figure>` 안으로 옮기지 마라**: 3단계(드래그·전체 화면·지도 안 `+/−`)가
                `<figure>` 내부를 재구성한다. 밖에 두는 것이 그 변경과 충돌을 0으로 만든다.
                컨트롤 행에 버튼으로 붙이는 것도 같은 이유로 안 된다(그리고 길찾기는 버튼이 아니라 카드다).

                **블록 1 의 것과 같은 컴포넌트다** — 문자열·URL 이 한 벌이라 한쪽만 고쳐질 수 없다.
              */}
              <WayfindingBlock className="mt-section" />
            </section>
          ) : null}

          {/* ── 블록 4 — 무대 · 화장실 (검증 §9 문안 그대로) ──
              `출석` 카드는 **뺐다**(§20.19.5): 출석 정보가 두 곳에 흩어지면 조합원이 한쪽만 보고
              절차를 놓친다. 그 카드가 담던 문장(손피켓 배포 예정)은 블록 2-A 의 이미지 캡션
              자리로 **이동**했다 — 정보 손실 0. */}
          <section aria-labelledby="facility-heading" className="mt-section md:mt-section-lg">
            <div id="facility-heading">
              <SectionHeading>무대 · 화장실</SectionHeading>
            </div>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoCard title="무대">
                {/*
                  ★ 요구 182 — **무대를 다루는 유일한 카드인데 무대가 3개가 됐다.**
                  12회차 §12-9 위험(*조합원이 무대를 찾아 되돌아간다*)은 **지도에서는 무대3 표시로 해소됐지만
                  이 카드에는 그대로 남아 있었다.** 두 번째 줄이 그것을 닫는다.

                  **블록 2 와 중복되는 것은 의도된 것이다** — 블록 2 는 경로 설명, 여기는 시설 목록이라
                  맥락이 다르고 **카드만 보는 조합원이 있다**(6회차 원칙: 두 블록을 이어 읽지 않는다).
                  **문자열은 `STAGE3_SENTENCE_CARD` 하나에서 나온다**(요구 88).

                  ⚠ **`메인무대(무대 1)` 의 괄호를 지우지 마라**(§24-2 이름 규칙):
                  **산문은 원문 이름을 앞세우고 별칭을 1회 선언**한다 — 조합원이 카톡에서 받은 낱말이
                  `메인무대` 이기 때문이다. **범례는 반대로 배지와 같은 이름(`무대 1`)을 쓴다.**
                  두 표기가 공존하는 것이 규칙이다. **통일하지 마라.**
                */}
                메인무대(무대 1)는 국회의사당역 5번 출구 앞에 설치될 예정입니다.
                <span className="mt-2 block break-keep">{STAGE3_SENTENCE_CARD}</span>
              </InfoCard>
              <InfoCard title="화장실">
                {/* 서울시 공식 표기로 교정한다 — 원문 어순은 지도 앱 검색이 되지 않는다(검증 §5-3).
                    안내자료 표기를 병기해 원문과의 대조 가능성을 남긴다(§20.10-6).
                    지도 앱 딥링크를 넣지 마라 — 검색 URL 형식은 이번 검증 대상이 아니다.
                    인용부호는 **곡선따옴표로 통일**한다(리더 판정 2026-08-18) — 문안 내용은 불변 */}
                여의도공원 화장실 2호(개나리) 이용
                {/*
                  거리 줄 — **검증 25회차 확정 문안**(요구 186·187). 종전 `코스콤지부 구역에서 약 30~100 m` 는
                  **오류가 2건 겹쳐 있었다.** 되돌리지 마라.

                  **오류 1 — 상한이 틀렸다.** 좌표 교체 탓이 아니라 **원래부터** 틀렸다(옛 좌표로도 약 179m).
                  **오류 2 — 거리의 대상이 틀렸다.** 바로 위 `여의도공원 화장실 2호(개나리) 이용` 을 수식하는 것으로
                  읽혔는데, **우리가 잰 것은 우리가 찍은 OSM 노드이고 그것이 `2호(개나리)` 인지는 모른다.**
                  §18-9-3 이 두 층위를 문면으로 분리해 뒀는데 거리 줄이 그 분리를 무너뜨려
                  **미검증 동일시를 사실처럼 진술**하고 있었다.
                  → ⚠ **`지도에 표시한 공원 화장실까지` 를 줄이거나 흐리게 하지 마라.**
                     **이 줄이 오류 2 를 고치는 문장**이고, 약화시키면 고친 오류가 돌아온다.
                     지도 라벨과 **같은 이름**을 써서 무엇을 재었는지 확정한다.

                  **파생 근거**(요구 188 — 거리는 코드로 계산하지 않고 완성된 문자열로 두되 근거를 여기 남긴다.
                  ★ **최종 게이트가 이 주석 ↔ 렌더 값을 대조한다.** 그 단계가 없어서 위 오류가 살아 있었다):
                    화장실 ↔ 3구역  최단 **28.9 m** ~ 최장 **173.4 m**
                      뒤쪽(남동) 변  28.9 ~  60.5 m   → `약 30~60 m`
                      앞쪽(무대3) 변 165.0 ~ 173.4 m  → `약 170 m`
                    무대3 중심 ↔ 앞쪽 변 **22.9 m** · 뒤쪽 변 **165.1 m**  (`앞/뒤` 어휘의 근거)
                  **좌표가 바뀌면 이 값들을 전수 재검산하라.**

                  ⚠ **`남동쪽 끝` 이 아니라 `무대3 쪽 끝` 이다** — **현장에 나침반이 없다.**
                  집회장에서 모두가 아는 기준은 무대이고, 페이지가 이미 `3구역 앞에는 무대3(LED)…` 로
                  **"앞 = 무대"를 선언**해 어휘가 깔려 있다.
                  (블록 2 의 `북동쪽 — KDB산업은행 쪽` 과 충돌하지 않는다: 그것은 **어느 구역인가**(가로),
                   이것은 **내 구역 안 어디인가**(세로) — 축도 어휘도 블록도 다르다.)

                  ★ **조판**(§30.18) — **세 줄로 쪼갠다. 가운뎃점을 쓰지 않는다.**
                  **한 줄로 이으면 `30~170` 이라는 단일 범위로 되읽혀 방금 고친 오류 1 을 조판이 되살린다.**
                  두 거리는 **범위가 아니라 선택지**다(조합원이 *"내가 어느 끝에 서는가"* 를 고른다).
                  `·` 는 360px 에서 앞뒤 공백이 **유일한 줄바꿈 기회**라 줄 끝에 매달려 부스러기로 읽힌다.
                  - **`<br>` 금지** — 안쪽 `block` span 이라야 `break-keep` 이 정상 동작한다
                  - **바깥 `mt-2` 하나만.** 세 줄 사이에 `mt-1` 을 넣지 마라 — 행간 1.7 이 이미 12.6px 를 주고
                    **그래야 세 줄이 한 덩어리로 묶여** 아래 `※` 줄과 분리된다
                  - **`<strong>` 이 아니라 `font-semibold`** — `<strong>` 은 *강한 중요도*를 주장하는데
                    여기 강조는 **훑기 보조**다. 굵게 하는 것은 **수치 두 개뿐**
                  - **조건구(`구역 뒤쪽 끝에서`)를 본문 그대로 두라** — 한글은 왼쪽부터 읽으므로 조건이 먼저 지나간다.
                    **조건 없이 수치만 눈에 들어오면 그게 오류 1 의 재발이다**
                  - 320px 에서 둘째 줄이 2줄이 되는 것은 **실패가 아니다. 문자열을 줄여 맞추지 마라**

                  ⚠ **카드의 `2호(개나리)` 원문 표기는 유지한다**(요구 153) — 주최측이 그렇게 안내했다는 것은
                  **사실**이다. 지도 라벨·범례는 `공원 화장실` 이다. **한쪽에 맞춰 통일하지 마라.**
                  ⚠ **랜드마크(`세븐일레븐` 등)를 추가하지 마라**(검증 판정 — 실재·8/28 영업·같은 건물·시인성
                  **넷 다 미확인**이다). 아래 `지도 데이터 기준 위치라 실제와 다를 수 있습니다` 가
                  이미 그 상황의 정직함을 지고 있고, 미검증 랜드마크는 그것을 훼손한다.

                  아래 두 줄은 4·5회차 승인 문안이며 **무수정**이다.
                */}
                <span className="mt-2 block break-keep">
                  <span className="block">지도에 표시한 공원 화장실까지</span>
                  <span className="block">
                    구역 뒤쪽 끝에서 <span className="font-semibold">약 30~60 m</span>
                  </span>
                  <span className="block">
                    무대3 쪽 끝에서는 <span className="font-semibold">약 170 m</span>
                  </span>
                </span>
                <span className="mt-2 block break-keep">
                  {"※ 정확한 위치는 지도 앱에서 “여의도공원 화장실”로 검색해 주세요."}
                </span>
                <span className="mt-2 block break-keep text-caption text-ink-muted">
                  {"안내자료 표기: “여의도공원2호 개나리 개방화장실”"}
                </span>
              </InfoCard>
            </ul>
          </section>

          {/* ── 블록 5 — 결의대회 순서 ── */}
          <section aria-labelledby="program-heading" className="mt-section md:mt-section-lg">
            <div id="program-heading">
              <SectionHeading>결의대회 순서</SectionHeading>
            </div>
            <RallySchedule />
          </section>

          {/* ── 블록 6 — 돌아가기 ── */}
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
