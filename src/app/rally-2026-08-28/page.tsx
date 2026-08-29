import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { RallyMap } from "@/components/rally/RallyMap";
import { PreSurveyBanner } from "@/components/rally/PreSurveyBanner";
import { QrAttendanceCard } from "@/components/rally/QrAttendanceCard";
import { RallySchedule } from "@/components/rally/RallySchedule";
import { WayfindingBlock } from "@/components/rally/WayfindingBlock";
import { RALLY_PAST_NOTE, RallyStatusBadge } from "@/components/rally/RallyStatus";
import { rallyPhase } from "@/lib/rally";
/* `STAGE3_SENTENCE` 계열은 이 페이지에서 쓰지 않는다(소비처 0). 상수는 `rallyMap.ts` 에 남긴다 —
   되살릴 때 문안을 다시 지어내지 않게 하는 것이 그 역할이다(요구 88 · 한 출처). */
import { ZONE_STATUS } from "@/lib/rallyMap";
import { ROUTES } from "@/lib/routes";

/**
 * 8/28 총력투쟁 결의대회 참석 안내 (디자인 스펙 §20.3). 최상위 라우트인 이유: 공유된 URL 이 남으므로 `/bargaining-2026`
 * 개편·폐기에 **동반 사망하면 안 된다**(§20.0-4). `revalidate 60` — 상태(예고/당일/종료)를 요청 시점에 계산한다(자정 경계 60초 지연은 허용값 · §18.7).
 *
 * **문안을 임의로 고치지 마라** — 전 문장이 검증 게이트를 통과한 표현이다. 근거: `_workspace/` 의
 * `00_input/content-rally-20260828.md` · `01_verifier_factcheck.md` · `02_designer_spec.md` §20.10.
 * 지우면 반려: 인명의 **소속 병기**(§7-1) · `※ 상황에 따라 식순 변경 가능`(§7-2).
 * **되살리지 마라**(의도적 부재): 도로 하이라이트(§5-2) · `528세대`(§7-10) · 손피켓·지도 캡처(§7-11) · `18:00` 집결(§7-6) ·
 * 화장실 핀·딥링크(§7-7) · 기기별 위치서비스 경로(요구 17) · `크롬은/도 됩니다` 양방향 · `2회 미완료 시 출석 무효` 류(요구 16) · LED무대 좌표(§5-12-8).
 *
 * ⚠ 200% 폭은 **«그 문면이 앉을 슬롯»부터 확인하고** 재라 — 슬롯이 네 종류다(카드 밖 281 · 카드 안 201 · 배너 215 · 순서표 셀 46.6 px).
 *   측정은 `width:0` 의 `scrollWidth`. 실측표: `_workspace/04_qa_report.md` 부록 D · `union-qa-testing` §5.7.
 * ⚠ **이 파일 주석의 CSS px 값을 «작아 보인다»고 고치지 마라** — 루트 `font-size` 가 **12px** 이다(`globals.css` `html{font-size:75%}`).
 *   기본 16px 로 환산하면 슬롯이 `288/832` 로 나오지만 **참값은 360→306 · 1280→624** 다. **288 로 되돌리지 마라**
 *   (회수 기록: `_workspace/00_input/rally-images-20260826/measure/README.md` §M-9 — 지도 이미지 실측의 M-9 이고 `strikeMap` 의 M-9 과 다르다).
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title:
    "8/28(금) 저녁 결의대회 참석 안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "2026년 8월 28일(금) 18:30 집결. 코스콤지부는 국회의사당역 3번 출구 KDB산업은행 앞입니다. 집결 위치와 결의대회 순서를 안내합니다.",
};

/*
 * `NEXT_PUBLIC_*` 은 **빌드타임에 번들로 임베드**된다(`deploy/web/docker-compose.yml` build.args).
 * 미설정이면 `<figure>` 자체를 렌더하지 않는다(§20.4.5) — 위치 정보는 블록 2 에 온전히 있다.
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

          {/* 참석 예비조사 배너(디자인 §37.2 · 검증 §45-11 조건 7). ⚠ **자리가 판정 사항 — 옮기지 마라**: `<h1>` 위 · `<h1>`↔정식명칭 사이 · 블록 1 «안» 전부 금지.
              ⚠ **여백·배지·헤딩을 더하지 마라** — 이 배너가 대형 `18:30` 을 밀어 판정선 360×640 `today` 여유가 30px 뿐이다. `mt-6` 은 고정값이고 래퍼 없이 `<a>` 가 진다(§37.4 · `past` 분기는 §37.6). */}
          <PreSurveyBanner phase={phase} />

          {/* ── 블록 1 — 집결 안내 (검증 §3 게시 조건) ── */}
          <section aria-labelledby="gather-heading" className="mt-section md:mt-section-lg">
            <div id="gather-heading">
              <SectionHeading>집결 안내</SectionHeading>
            </div>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              <p className="text-caption font-semibold text-ink-muted">집결</p>
              <p className="mt-1 text-lead text-ink">2026년 8월 28일(금)</p>
              {/* **18:30 이 이 페이지의 유일한 대형 수치다**(검증 §3). ⚠ 18:00 을 집결 시각으로 쓰지 마라 — 주최측 장내 정리 시간대다(§7-6). */}
              <p className="font-display mt-1 text-hero leading-none text-ink md:text-hero-lg">
                <time dateTime="2026-08-28T18:30:00+09:00">
                  <span aria-hidden="true">18:30</span>
                  <span className="sr-only">오후 6시 30분</span>
                </time>
              </p>

              {/* 행 순서는 **참석 시간 → 본대회 → 장소**다(요구 126 · §28.4.2) — 큰 범위 → 그 안의 한 지점 → 장소. */}
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 md:mt-8">
                {/* ⚠ **`집회 시간`·`행사 시간` 으로 바꾸지 마라**(요구 123 — 주최측 종료를 단정한다) · 주어(`코스콤지부 …`)도 되살리지 마라(요구 122 — 사용자가 지웠다).
                    ⚠ **대형 `18:30` 에 `~ 20:30` 을 붙이지 마라**(§28.4.1) — 캡션이 `집결` 이라 "집결이 2시간"으로 읽힌다. `20:30` 을 굵게·크게도 하지 마라(§20.3.2 유일 대형 수치).
                    ⚠ `<time>` 은 대형 `18:30` 전용 — 한 표에서 한 행만 마크업이 다르면 그 차이가 의미로 읽힌다(§22.13.5). */}
                <dt className="text-caption font-semibold text-ink-muted">참석 시간</dt>
                <dd className="break-keep text-body text-ink">
                  <span aria-hidden="true">18:30 ~ 20:30</span>
                  <span className="sr-only">오후 6시 30분부터 오후 8시 30분까지</span>
                </dd>
                <dt className="text-caption font-semibold text-ink-muted">본대회</dt>
                <dd className="text-body text-ink">19:00 개회</dd>
                <dt className="text-caption font-semibold text-ink-muted">장소</dt>
                <dd className="break-keep text-body text-ink">국회의사당역 3번 출구 → 여의도공원 방향 KDB산업은행 앞</dd>
              </dl>

              {/* 오시는 길(§29 · 요구 118) — 링크 카드와 **교통 안내가 한 컴포넌트**다: **교통 안내 없는 길찾기 링크를 만들 방법 자체를 없앤다**(당일 인근 도로는 통제된다).
                  자리(`<dl>` 아래 · `※` 위)는 판정 사항이다. ⚠ **새 카드를 중첩하지 마라** — 링크 카드가 이미 테두리를 갖고 있다. */}
              <WayfindingBlock className="mt-6 border-t border-border-soft pt-5" />

              {/* ⚠ **각주 1(`※ 20:30 은 코스콤지부의 참가 계획입니다…`)은 삭제됐다 — 되살리지 마라**(요구 122 · §6.8.1). ⚠ **각주 2 는 무수정 유지**(요구 124·60) — `ink-muted` 로 흐리거나 `20:10~21:00` 에 색 강조 금지(요구 13).
                  ⚠ **`자리를 뜨면 출석이 되지 않습니다` 로 강화하지 마라** — 지오펜스 반경이 미확인이다.
                  ⚠ **시각은 주최측 안내 이미지에서 온다 — 이미지가 바뀌면 여기도 같이 고쳐라**(출처는 `QrAttendanceCard` 의 `QR_IMAGE` 주석). */}
              <p className="mt-1 max-w-[var(--container-prose)] break-keep text-body text-ink">
                ※ 2차 출석은 20:10~21:00 입니다. 현장에서 위치가 확인돼야 하니 자리를 뜨기 전에 완료해
                주세요.
              </p>
            </div>
          </section>

          {/* ── 블록 2 — 코스콤지부 집결 위치 (검증 §2-2 문안 필수) ── **지도보다 위에 온다**(§20.0-8): 지도가 화면을 채우면 아래 텍스트를 읽지 않는다.
              단서를 `ink-muted` 로 흐리지 마라 — 읽어야 하는 문장이다. */}
          <section aria-labelledby="position-heading" className="mt-section md:mt-section-lg">
            <div id="position-heading">
              <SectionHeading>코스콤지부 집결 위치</SectionHeading>
            </div>
            <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8">
              {/* 주최측 배치도. ★ **역할은 «위치 안내»가 아니라 «출처 증거»다**(§36.9-1) — 위치를 읽는 도구는 아래 지도이고, 모바일에서 구역 라벨이 안 읽히는 것은 치명적이지 않다(산문 ①③④⑤가 진다).
                  지금 판본의 koscom 로고·주황 표시는 지부가 더한 것이라 1순위도 함께 진다(§36.11-8 · 검증 L-1).
                  ⚠ **우리가 화살표·강조 테두리·크롭을 새로 그려 넣지 마라** — 이미지 안 주황 표시가 허용되는 근거는 **«손댄 주체가 우리가 아니다»** 다(검증 L-1.2).
                  ⚠ 캡션이 `배치도` 3자로 줄어 이 블록의 출처 표기는 사실상 0 이다(L-15 · §47-4). **출처 배지·꼬리표·`※` 로 되살리지 마라** — 사용자가 걷어낸 바로 그것이다.
                  ⚠ **`unoptimized` 를 쓰지 마라** — 위성사진이라 손실 압축에 적합하다. 아래 `branch-layout-2.png` 는 **반대 판정**이니 둘을 통일하지 마라(§36.11-4). `quality={90}` 은 안에 읽을 문자가 있어서다.
                  ⚠ **폭 상한을 두지 마라** — 안에 읽어야 할 문자가 있다(QR 의 `max-w` 근거와 반대다).
                  ⚠ **`alt` 를 `주최측 배치도 —` 로 시작하지 마라**(요구 201) — `figcaption` 과 이어 읽혀 두 번 들린다. `코스콤지부`·거리 수치·«지부가 표시했다»도 `alt` 금지(§44-6).
                  ⚠⚠ **`alt` 의 `도로 위`·`길가` 는 산문 ⑤와 «함께 움직인다»**(§44-5 쌍 2) — 한쪽만 바꾸면 비시각 사용자의 연결이 끊긴다. **고칠 때는 둘을 같이 열어라.** */}
              <figure className="mb-6">
                <Image
                  src="/images/rally-2026-08-28/rally-layout-2.png"
                  width={1374}
                  height={1264}
                  quality={90}
                  sizes="(min-width: 768px) 832px, 100vw"
                  alt="여의도 의사당대로를 따라 집회 1·2·3구역과 무대 1·2·3이 표시된 위성지도입니다. 집회 3구역은 2구역의 북동쪽(KDB산업은행 쪽)이고 그 앞이 무대3(LED)입니다. 코스콤 로고에서 나온 화살표 두 개가 집회 3구역의 무대3 쪽 앞부분에서 두 지점을 가리킵니다 — 하나는 3구역 안 도로 위, 다른 하나는 3구역 밖 KDB산업은행 쪽 길가입니다."
                  className="rounded-badge border border-border-soft block h-auto w-full"
                />
                {/* 축자 문면(사용자 지시 L-15 · 검증 §47). **3자 그대로 둔다 — 한정어를 붙이지 마라.** */}
                <figcaption className="mt-3 break-keep break-words text-caption text-ink">
                  배치도
                </figcaption>
              </figure>
              {/* 금융노조 지부배치도(`branch-layout-2.png`) — **금융노조가 배포한 공식 자료다**(검증 L-2). 우리가 만든 표가 아니다.
                  ★ **«찾는 도구»가 아니라 «출처 증거»다**(§36.11-8 위계 3순위) — 표에서 찾을 답은 산문 ①④가 준다. 360px 에서 지부명이 판독되지 않지만 **게시 블로커가 아니다.**
                  ⚠ **그렇다고 작게 줄이거나 접지 마라**(§0.4 콘텐츠 은폐 금지). ⚠ **폭 상한(`max-w-[…]`)을 두지 마라** — 안에 읽을 문자가 있다.
                  ⚠⚠ **`unoptimized` 는 의도이고 위 `map.png` 과 «반대 판정»이다**(§36.11-4) — 문자 표라 성질이 QR 쪽이고 경계선이 재인코딩에 무너진다. **PNG 를 JPEG 로 바꾸지 마라.**
                  `quality`·`sizes` 를 일부러 비웠다(`unoptimized` 가 둘 다 무시한다). 재압축은 `png({compressionLevel:9, palette:false})` 만 무손실이다 — `effort:10` 은 팔레트 경로를 켜서 조용히 손실이 된다(바꾸면 픽셀 대조로 확인하라).
                  ⚠ **`unoptimized` 를 빼면 «확대용 링크·버튼·안내 문장 0»(§36.11-3) 판정이 함께 무너진다** — 핀치 확대가 원본 1209px 에 닿는 것이 그 근거다. **둘은 함께 움직인다.**
                  ★★ **우측 `산업은행 인도` 상자의 세부(칸 이름·괄호 숫자·`신보(1)`·순서)를 문안에도 `alt` 에도 쓰지 마라**(검증 조건 4).
                  ⚠ 그 금지의 근거는 «미확인이라 못 쓴다» → **«확인됐으나 쓸 필요가 없다»(L-12)** 로 바뀌었다. **«이제 확인됐으니 써도 되겠다»로 뒤집지 마라.**
                  ⚠ `alt` 금지(§44-6): 우측 상자 · 45개 지부 나열 · **캡션 낱말로 시작하기**. ⚠ 캡션 `금융노조지부배치도` 는 **사용자 지정 문면 — 띄어쓰기를 넣지 마라**(검증 조건 3 축자).
                  ⚠ **두 그림 사이에 hairline(`border-t`)을 넣지 마라**(§36.11-1) — 선이 3중이 된다. 캡션 `mt-3` : 그림 사이 `mb-6` = **1:2** 가 «캡션 1 이 이미지 2 의 것»으로 읽히는 오독을 막는 유일한 장치다.
                  ⚠ **«한 쌍»으로 묶으려고 간격을 좁히지 마라** — 출처가 다른 별개 자료다. */}
              <figure className="mb-6">
                <Image
                  src="/images/rally-2026-08-28/branch-layout-2.png"
                  width={1209}
                  height={1665}
                  unoptimized
                  alt="무대 세 곳 아래에 지부를 나눠 배치한 표입니다. 무대는 메인무대(의사당역 5번 출구) · LED무대(KBS삼거리) · LED무대 2(산업은행 삼거리)이고, 코스콤(한국증권전산)지부는 LED무대 2 칸에서 한국산업은행지부 다음 줄, SC제일은행지부 오른쪽에 있습니다."
                  className="rounded-badge border border-border-soft block h-auto w-full"
                />
                <figcaption className="mt-3 break-keep break-words text-caption text-ink">
                  금융노조지부배치도
                </figcaption>
              </figure>
              {/* 산문 ①(`ZONE_STATUS.assignment`)은 검증 §18-8 · §19-5 · 요구 163 **확정본**이다. 임의로 고치지 마라.
                  ⚠ **`확인 중이며, 확인되는 대로 지도에 반영하겠습니다` 를 되살리지 마라**(요구 157) — 좌표가 나와 상태가 끝났다. **남기면 거짓이다.**
                  ⚠ **정밀도 한계(±20~30m)의 문면 이행은 지우지 마라**(§18-1). 지금 그 고지는 ① 도형 점선·옅은 면 ② 범례 키 줄 ③ 범례 ④ 행이 진다(이 블록의 `※` 는 §37 로 삭제됐다). **①②③ 중 하나라도 지우면 그 `※` 를 되살려야 한다.**
                  ⚠ **금지어**(요구 163-2·151): `여의도공원 쪽`·`여의도공원 방향` — 두 구역을 가르지 못해 **조합원을 2구역으로 보낼 수 있다**(원 안내자료 표현이라도 옮기지 마라) ·
                  `더샵아일랜드파크` · 단일 거리 수치(`약 327 m`) · 좌표 노출 · `확정`·`배정되었습니다`. 방위 단서의 `2구역` 언급은 이 목적에 한해 해제된 것이다(요구 163). **`앞` 이 아니라 `쪽` 이다.** */}
              {/* ⚠ **`주최측 안내에 따르면` 을 되살리지 마라**(사용자 지시 2026-08-21 · §47-4). 캡션이 `배치도` 로 줄어 출처 표기가 0 이 됐지만 검증은 그 상태로 게시 가능이라 판정했고,
                  이 금지의 근거는 «캡션이 대신 진다» 가 아니라 **사용자 지시 자체**다.
                  ⚠ **이 문장을 이미지가 대신한다고 보지 마라**(§37) — 그림에 `코스콤지부` 라는 글자가 없다(로고는 회사 CI `koscom`). **우리 자리라는 사실은 이 문장에만 있다.** */}
              <p className="break-keep break-words text-lead text-ink">
                {ZONE_STATUS.assignment}
              </p>
              {/* ⚠ **`여의도` 를 지우지 마라**(요구 191) — 지우면 렌더에서 집회 장소를 가리키는 `여의도` 가 0 이 된다(남는 것은 화장실 안내의 `여의도공원` 뿐이다).
                  `struggleSchedule.ts` 가 8/28 을 `서울 여의도 · 저녁` 으로 렌더하므로 **일정에서 `여의도` 를 보고 들어온 조합원이 상세에서 그 낱말을 못 찾는다.** 창작도 아니다(원문 §6.9 축자).
                  ⚠ 옛 문장(`집회 장소는 여의도 의사당대로(국회의사당역 인근)입니다.`)을 되살리지 마라 — 집회 «전체» 층위라 이 블록과 층위가 섞인다. ⚠ `<dl>` 장소 행에도 넣지 마라(원문 §1 축자 인용). */}
              {/* 거리 파생 근거(5번 출구↔3구역 249~396 m)·재측정 절차: 검증 요구 188 · §23-1. ★ 좌표가 바뀌면 값을 다시 재고 렌더 문자열과 대조하라. */}
              {/* 산문 ② — `break-words` 는 문면 무수정 보험이다(§38.1): 200% 카드 안 슬롯 201px 에 이 줄이 194px 라 **여유가 7px 뿐**이고, 안 넘치는 줄에서는 높이 변화 0 이다. */}
              <p className="mt-3 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
                국회의사당역 3번 출구에서 여의도공원 쪽으로 약 230 m — KDB산업은행 앞입니다
              </p>
              {/* 산문 ③(방위 단서) — **자리가 판정 사항이다**(§30.17.5): 경로 문장 «다음» · 무대 문장 «앞» · `※` 두 줄보다 위(읽는 순서가 행동 순서와 같아야 한다).
                  ⚠ **굵기·크기·색·아이콘·박스를 주지 마라** — §30.17.5 의 `font-semibold` 는 2026-08-21 에 철회됐다(산문이 줄어 하나만 굵으면 나머지가 부차적으로 읽힌다). 지도 위 상태 패널로 옮기는 안도 폐기(§30.16.4).
                  ★★ **이 문장을 지우지 마라 — 한 번 지웠다가 되살린 것이다.** 현장에는 나란한 두 대오가 있는데 우리 지도는 3구역만 그리므로(요구 149) **KDB산업은행이 유일한 판별 수단**이고,
                  틀리면 **다른 지부 대오에 선다.** §5.3 이 «행동이 갈리는 사실»을 삭제 예외로 지정한 바로 그 경우다. */}
              {/* 문면은 `rallyMap.ts` 의 `ZONE_STATUS.bearing` 에서 온다 — **그 상수를 고치는 사람이 여기 여유 7px 을 모른다.** 길어지면 `break-words` 가 유일한 방어다(§38.1). */}
              <p className="mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
                {ZONE_STATUS.bearing}
              </p>
              {/* 산문 ④ — **다리 문장**(축자 · «없으면 게시 불가»). 정본은 검증 §47-3 A안.
                  ★ **이것이 막는 사고**: 위 표는 우리 무대를 `LED무대 2` 라 부르고 지도는 `무대3(LED)` 라 부른다. 조합원이 `LED무대 2` 를 지도의 `무대2(LED)` 로 읽으면 **집회 2구역(다른 지부 대오)으로 간다.**
                  두 이름이 같은 무대라는 사실은 **이 문장에만 있다**(사용자 확인 L-11). ⚠ **§37-1 을 근거로 지우지 마라** — §37-1 이 지운 것은 «3구역 앞에 무대3» 문장이고 ④는 다른 말을 한다.
                  ⚠⚠ **지도 범례로 옮기지 마라** — 지도 섹션은 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 조건부라 값이 비면 **이름 충돌은 남고 다리만 사라진다.** 같은 이유로 `rallyMap.ts` 범례에 `LED무대 2` 를 병기하지도 마라.
                  ⚠ **④·⑤를 그림 «위»로 올리지 마라** — 표의 `alt` 가 `LED무대 2` 를 낭독한 직후에 와야 뜻이 붙는다. ⚠ **`※` 로 달지 마라** — 본문 사실이고, 이 페이지는 `※` 개수를 센다.
                  ⚠ **`(산업은행 삼거리)` 를 빼지 마라**(§47-3 B안 기각 — 위 표의 칸 머리글과 글자가 일치해야 그 칸을 찾는다) · **역순으로 쓰지 마라**(D안 기각 — 조합원은 표에서 지도로 가는 방향으로 읽는다) ·
                  `같은 무대입니다` 를 `가리킨다`·`대응한다` 로 바꾸지 마라(필요한 것은 동일성 하나다).
                  ★★ **④는 이제 캡션이 아니라 «그림 안 문자»에 걸린다**(§44-5 쌍 1 해체 · §47-2) — 캡션을 바꿔도 안 깨지지만 **이미지가 교체되면 두 낫표 안 글자를 그림에서 직접 읽어 대조하라**(`grep` 으로는 안 걸린다 · QA 부록 G-8).
                  ⚠ **방향어(`위/아래`)로 대체하지 마라**(§47-1) — 두 그림이 둘 다 ④ 위에 있어 갈리지 않는다. ⚠ `break-words` 를 빼지 마라 — §38.1 판정선(패널 직속 `break-keep` 단독 한계 6자)에 종결 덩어리가 걸린다. */}
              <p className="mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
                「LED무대 2(산업은행 삼거리)」와 「무대3(LED)」는 같은 무대입니다.
              </p>
              {/* 산문 ⑤ — **지부천막**(검증 §44-2(6) 축자 · 조건 9 «필수»). ★ **이 사실을 말할 수 있는 것이 이 문장뿐이다** — 배치도의 주황 사각형 둘에는 라벨이 없어 확대해도 어느 것이 무엇인지가 그림에 문자로 없다(L-13).
                  ⚠⚠ **`도로 위`·`길가` 는 위 `map` 의 `alt` 와 «함께 움직인다»**(§44-5 쌍 2) — 한쪽만 바꾸면 연결이 끊긴다.
                  ⚠ **«출석»이라는 낱말을 넣지 마라**(`출석체크는 지부천막에서` 류) — 정규 출석 경로는 QR 이고 천막이 그것을 대체한다는 근거가 없다. **조합원이 QR 을 건너뛰면 출석 기록을 잃는다.**
                  ⚠ 천막의 **운영 시간·상주 여부는 자료가 0 이다.** ⚠ **색 단독 의존 금지**(`주황색 사각형 두 개가 …`) · **기하·서수 표현 금지**(`3구역 앞쪽`·`약 30 m 지점`) — L-10 은 손그림 사각형의 경계 정밀도를 보증하지 않았다. */}
              <p className="mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
                코스콤지부 집결자리는 도로 위이고, 지부천막은 산업은행 쪽 길가에 있습니다.
              </p>
              {/* 기존 승인 문장 — 도형이 `estimated`(±20~30m)인 이상 **현장에서 자기 자리를 최종 확인하는 마지막 관문**이다. **빼지 마라.**
                  `break-words` 는 블록 2 산문 ①~⑤와 한 규칙을 쓰려고 붙였다(비용 0). ⚠ **`break-all` 로 바꾸지 마라** — 한글이 아무 데서나 끊긴다. */}
              <p className="mt-1 break-keep break-words text-body text-ink">
                ※ 현장에서 지부 깃발을 확인해 주세요.
              </p>
            </div>
          </section>

          {/* ── 블록 2-A — QR 출석체크 안내 (§20.19.1) ── 지도보다 **위**에 온다: 출석 2회는 집결 18:30 과 함께 하루의 시간표를 이루고,
              사전 준비물(위치서비스 동의)은 **집을 나서기 전에** 해야 하는 행동이다. */}
          <section aria-labelledby="attendance-heading" className="mt-section md:mt-section-lg">
            <div id="attendance-heading">
              <SectionHeading>QR 출석체크 안내</SectionHeading>
            </div>
            <QrAttendanceCard />
          </section>

          {/* ── 블록 3 — 지도 + 내 위치 ── Client ID 미설정이면 이 섹션 전체를 렌더하지 않는다(§20.4.5 — 위치 정보는 블록 2 에 온전히 있다).
              `<figure>`·범례·내 위치 UI 는 `RallyMap` 이 함께 렌더한다(범례 행이 `MAP_FEATURES` 파생 · §20.14.4·§20.20.5). */}
          {NAVER_MAP_CLIENT_ID !== "" ? (
            <section aria-labelledby="map-heading" className="mt-section md:mt-section-lg">
              <div id="map-heading">
                <SectionHeading>위치 지도</SectionHeading>
              </div>
              {/* ⚠ **구역 상태 패널(§28.2)은 제거됐다 — 되살리지 마라**(§30.10.1 · 요구 163-1). 설계 근거였던 «지워진 자리는 스스로 말하지 않는다»는
                  ④가 좌표를 갖고 돌아오며 소멸했고, 남기면 같은 사실이 5곳에 나온다(§20-9). */}
              <RallyMap clientId={NAVER_MAP_CLIENT_ID} />

              {/* 오시는 길 — **`<figure>` 밖, 지도 섹션의 마지막**이다(§29.2): 길찾기는 그림의 «설명»이 아니라 별개의 행동 수단이다.
                  ⚠ **`<figure>` 안으로 옮기지 마라**(드래그·전체 화면·`+/−` 가 내부를 재구성한다) · 컨트롤 행에 버튼으로 붙이지 마라.
                  **블록 1 의 것과 같은 컴포넌트다** — 문자열·URL 이 한 벌이라 한쪽만 고쳐질 수 없다. */}
              <WayfindingBlock className="mt-section" />
            </section>
          ) : null}

          {/* ── 블록 4(무대 · 화장실) 는 **삭제됐다**(사용자 지시 2026-08-23) — 지도 마커·범례가 같은 사실을 말한다.
              ⚠ 함께 사라진 두 문장(화장실 거리 · `※ 정확한 위치는 지도 앱에서 “여의도공원 화장실”로 검색해 주세요.`)을 되살릴 곳은 **지도 범례·팝업이지 이 자리가 아니다.**
              되돌린다면 검증 25회차 확정 문안을 **그대로** 쓰라 — 다시 지어내지 마라(원문은 커밋 66e4dc2 이전의 이 파일). */}
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
