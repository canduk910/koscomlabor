import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { RallyMap } from "@/components/rally/RallyMap";
import { QrAttendanceCard } from "@/components/rally/QrAttendanceCard";
import { RallySchedule } from "@/components/rally/RallySchedule";
import { RALLY_PAST_NOTE, RallyStatusBadge } from "@/components/rally/RallyStatus";
import { rallyPhase } from "@/lib/rally";
import { DISTANCE_TEXT_LONG } from "@/lib/rallyMap";
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

              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 md:mt-8">
                <dt className="text-caption font-semibold text-ink-muted">본대회</dt>
                <dd className="text-body text-ink">19:00 개회</dd>
                <dt className="text-caption font-semibold text-ink-muted">장소</dt>
                <dd className="break-keep text-body text-ink">국회의사당역 5번 출구 메인무대 앞</dd>
              </dl>
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
                `우측 도로` 는 계속 금지다(검증 §5-2 유효) — 방향어는 기준점이 없어 조합원이
                반대편에 선다. 도로는 5회차에 **의사당대로로 특정**됐다(검증 §5-12-2):
                5번 출구와 더샵을 잇는 도로가 이것뿐이다.
              */}
              <p className="break-keep break-words text-lead text-ink">
                더샵아일랜드파크 앞 의사당대로 · [결의대회대오 2]
              </p>
              {/*
                거리는 **범위**로만 쓴다(검증 요구 29). `약 320 m` 같은 단일 수치를 되살리지 마라 —
                구간의 실제 시종점이 미확인이라 갖고 있지 않은 정밀도를 주장하게 된다.
              */}
              <p className="mt-2 max-w-[var(--container-prose)] break-keep text-body text-ink">
                {DISTANCE_TEXT_LONG}
              </p>
              {/*
                유보 절(`… "각 지부별 대오 논의" … 당일 변경될 수 있으니`)은 **뺐다**(§20.3.3 개정):
                사용자가 "대오도 대강 정해졌고"라고 확인했다. 다만 아래 행동 지시는 남긴다 —
                미확정 표시가 아니라 **조합원이 실제로 할 수 있는 행동**이고, 배치가 정해졌어도
                당일 대오가 밀리거나 조정되는 일은 흔하다.
              */}
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
              <RallyMap clientId={NAVER_MAP_CLIENT_ID} />
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
