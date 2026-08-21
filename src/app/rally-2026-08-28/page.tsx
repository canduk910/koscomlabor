import type { Metadata } from "next";
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
import { ZONE_STATUS } from "@/lib/rallyMap";
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
                ⚠ **위치 주장을 전부 걷어낸 자리다**(검증 12회차 요구 99 · 2026-08-21).

                주최측이 새 배치도로 `1·2·3구역` 체계를 안내했고 **코스콤지부는 3구역 배정 예정**이다.
                종전 문구(`더샵아일랜드파크 앞 의사당대로` + 거리 `약 220~340 m`)가 가리키던 자리는
                새 자료 기준 **2구역 — 다른 지부 대오**다. **되살리지 마라.**

                `배정될 예정입니다` 의 **`예정` 을 지우지 마라** — 원문 표기가 `3구역 배정 예정` 이고
                §6.9 전사 자체가 아직 **원본 대조 전**이다.
                `확인 중이며, 확인되는 대로 지도에 반영하겠습니다` 는 **우리 상태의 사실 서술**이다:
                조합원에게 "왜 지도에 자리가 없는지"를 설명해 §0.4 은폐가 아님을 문면으로 밝힌다. **빼지 마라.**
                `여의도 의사당대로(국회의사당역 인근)` 는 **두 자료가 일치**하는 확인 사실이다.
              */}
              {/* 문안은 `ZONE_STATUS` 한 곳에서 나온다 — 지도 위 상태 패널과 **같은 출처**여야
                  구역 확인 시 한쪽만 고쳐지는 사고가 없다(§28.2.4 · 요구 88 원칙) */}
              <p className="break-keep break-words text-lead text-ink">
                주최측 안내에 따르면 {ZONE_STATUS.assignment}
              </p>
              <p className="mt-2 max-w-[var(--container-prose)] break-keep text-body text-ink">
                {ZONE_STATUS.pending}
              </p>
              <p className="mt-3 max-w-[var(--container-prose)] break-keep text-body text-ink">
                집회 장소는 여의도 의사당대로(국회의사당역 인근)입니다.
              </p>
              {/* 기존 승인 문장 — **구역 좌표가 없는 동안 조합원이 현장에서 자기 자리를 찾는
                  유일한 수단이다.** 훨씬 중요해졌다. */}
              <p className="mt-3 break-keep text-body text-ink">
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
                구역 상태 패널(§28.2) — **지도 바로 위**다.

                **범례 각주만으로는 부족하다**: 각주는 범례 행들 아래라 조합원이 거기까지 읽지 않고,
                **④ 를 그냥 지우면 이전에 본 위치가 기억에 남는다.**
                *"지워진 자리는 스스로 말하지 않는다. 무엇이 왜 없는지는 별도로 말해야 한다."*

                왜 지도 **위**인가: ① 조합원이 지도를 보기 **전에** 상태를 안다 — *"④가 왜 없지"* 를
                겪지 않는다 ② 지도가 화면 하단을 덮을수록 **지도 위가 비어** 최악 스크롤 구간에서도 보인다
                ③ 오버레이로 만들면 지도를 가려 §0.4 에 인접한다 — **지도 밖 문자**여야
                §28.1("좌표를 모르면 지도에 아무 기호도 놓지 않는다")과도 일치한다.

                ⚠ **`RallyMap` 안이 아니라 여기 있는 이유**: 스펙은 `<figure>` 안을 지정했지만
                3단계(드래그·전체화면·키보드) 백업 패치가 `RallyMap.tsx` 를 **통째로 덮는다.**
                거기 두면 3단계 복원 시 **이 패널이 조용히 사라진다.** 시각 위치는 동일하다 —
                `<figure>` 의 첫 시각 요소가 지도 박스이기 때문이다. **되돌리지 마라.**

                **접거나 `sr-only` 로 돌리지 마라. 아이콘·적색을 쓰지 마라** — 적색은 이 사이트에서
                **긴급 공지 전용**이고 이것은 *긴급*이 아니라 *미확정*이다. **색으로 겁주지 않는다.**
                좌측 파랑 바는 **장식 전용**이고 의미는 문자가 진다(§9.1 선례).
                본문이 `text-body`(18px)인 이유: 지도 아래 안내 문구들(15px)보다 **한 단계 위**여야 한다.
                문자열은 블록 2 와 **같은 출처**(`ZONE_STATUS`)에서 파생한다(요구 88 원칙).
              */}
              <div className="rounded-card mt-6 border-l-4 border-primary bg-surface p-4">
                <p className="break-keep text-body font-semibold text-ink">
                  {ZONE_STATUS.assignment}
                </p>
                <p className="mt-1 break-keep text-body font-semibold text-ink">
                  {ZONE_STATUS.pendingOnMap}
                </p>
              </div>
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
                메인무대는 국회의사당역 5번 출구 앞에 설치될 예정입니다.
              </InfoCard>
              <InfoCard title="화장실">
                {/* 서울시 공식 표기로 교정한다 — 원문 어순은 지도 앱 검색이 되지 않는다(검증 §5-3).
                    안내자료 표기를 병기해 원문과의 대조 가능성을 남긴다(§20.10-6).
                    지도 앱 딥링크를 넣지 마라 — 검색 URL 형식은 이번 검증 대상이 아니다.
                    인용부호는 **곡선따옴표로 통일**한다(리더 판정 2026-08-18) — 문안 내용은 불변 */}
                여의도공원 화장실 2호(개나리) 이용
                {/*
                  ⚠ **거리 1줄(`코스콤지부 집결 위치에서 여의도공원까지 약 80 m`)은 삭제됐다**
                  (검증 12회차 요구 101). 기준점이던 "코스콤지부 = 대오 2" 가 **무효**가 됐다.
                  안전 방향(과대추정)이었지만 **무효한 근거로 계산된 수치를 남기지 않는다.**
                  구역이 확인되기 전에는 거리를 다시 쓰지 마라 — 요구 41·42 는 철회됐다.
                  아래 두 줄은 4·5회차 승인 문안이며 **무수정**이다.
                */}
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
