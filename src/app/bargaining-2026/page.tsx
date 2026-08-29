import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DateBadge } from "@/components/home/DateBadge";
import { StruggleCalendar } from "@/components/bargaining/StruggleCalendar";
import { ArrowRightIcon, DocumentIcon } from "@/components/ui/icons";
import { daysUntilKst, formatMonthDaySlash } from "@/lib/date";
import { STRUGGLE_SCHEDULE } from "@/lib/struggleSchedule";
import { RALLY_DATE } from "@/lib/rally";
import { STRIKE_DATE } from "@/lib/strike";
import { ROUTES } from "@/lib/routes";

/**
 * 26년 임단협 투쟁 안내 (스펙 §17) — 게시물 분류가 아니라 **정적 페이지**다.
 * ISR 60초: D-n 을 요청 시점에 계산하므로 정적 프리렌더를 쓰지 않는다.
 * 근거: `_workspace/00_input/content-bargaining-2026.md`(원문) · `decision-bargaining-2026.md`
 * (게시 방침) · `01_verifier_factcheck.md` 2·3회차(판정 — 아래 «빠진 것»의 근거도 전부 여기).
 *
 * **문안을 임의로 고치지 마라.** 다음은 **의도적으로 빠져 있다**: `필수유지업무 인력 제외`
 * (법적 근거 미확인 — 조합원이 "법상 당연히 제외된다"고 믿으면 **자기 참여 의무를 오판한다**) ·
 * 임금피크제 시한 · 6월 결렬 선언 날짜 · 교섭 횟수 · "중재/중재안"(조정과 법상 별개) ·
 * 투표 독려 문구(투표는 2026-08-12 에 끝났다 — 현재형으로 쓰면 오보다).
 *
 * ⚠ **9/4 집결 장소는 더 이상 «지부 공지로 안내» 가 아니다** — 주최측 자료로 확정됐고 아래
 *   카드의 `meta`·`detail` 과 `/strike-2026-09-04` 가 그 사실을 말한다.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "26년 임단협 투쟁 안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "금융노조 산별중앙교섭이 결렬되어 9월 4일 총파업에 들어갑니다. 남은 일정과 교섭 경과를 안내합니다.",
};

/* 남은 일정의 **단일 출처**는 `src/lib/struggleSchedule.ts` 다(§19.3.3) — **여기에 다시 적지 마라** */

const DEMANDS = [
  "주 4.5일제 도입",
  "정년 연장 60세 → 65세",
  "임금피크제 단계적 폐지",
  "신입직원 채용 확대",
] as const;

/** 교섭 경과 — 상충하는 항목(6월 결렬 선언 날짜·교섭 횟수)은 의도적으로 제외 */
const TIMELINE = [
  {
    date: "7월 7일",
    title: "1차 조정회의",
    detail: "노조 6.0%, 사측 2.5%로 입장 차이가 좁혀지지 않았습니다.",
    emphasis: false,
  },
  {
    date: "7월 13일",
    title: "2차 조정회의 — 조정 중지, 최종 결렬",
    detail: null,
    emphasis: true,
  },
  { date: "7월 22일", title: "코스콤지부 투쟁상황실 설치", detail: null, emphasis: false },
  { date: "7월 27일", title: "코스콤지부 릴레이 1인시위 시작", detail: null, emphasis: false },
  { date: "8월 11일", title: "금융노조 임원단 지부순방", detail: null, emphasis: false },
  { date: "8월 12일", title: "쟁의행위 찬반투표 실시 — 가결", detail: null, emphasis: false },
] as const;

/** 완료 배지 — 취소선을 쓰지 않는다("취소된 일정"으로 오독된다, §17.3) */
function DoneBadge() {
  return (
    <span className="rounded-full bg-surface px-3 py-1 text-caption text-ink-muted">완료</span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 text-ink md:text-h1">{children}</h2>;
}

export default function BargainingPage() {
  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <div className="mx-auto mt-8 w-full max-w-page px-4 md:mt-14 md:px-8">
          <h1 className="text-title text-ink md:text-h1">26년 임단협 투쟁 안내</h1>
          <p className="mt-4 max-w-[var(--container-prose)] text-body text-ink">
            금융노조 산별중앙교섭이 결렬되어 9월 4일 총파업에 들어갑니다.
          </p>

          {/* ① 남은 일정 — **행동 요청은 이 블록에만 둔다** */}
          <section aria-labelledby="schedule-heading" className="mt-section md:mt-section-lg">
            <div id="schedule-heading">
              <SectionHeading>남은 일정</SectionHeading>
            </div>
            {/* 달력은 카드를 대체하지 않는 **추가 레이어**다(§18.0 #4) — 카드가 장소·시간의 정본이다 */}
            <StruggleCalendar events={STRUGGLE_SCHEDULE} className="mt-6" />
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {STRUGGLE_SCHEDULE.map((item) => {
                // 요청 시점 계산 — 8/28 이 지나면 이 카드가 스스로 "완료"로 전환된다
                const days = daysUntilKst(item.date);
                const past = days !== null && days < 0;
                /* 라벨 ↔ 목적지를 **한 자리에서** 가른다 — 링크를 두 벌로 두면 한쪽만 바뀐다 */
                const detailLink =
                  item.date === STRIKE_DATE
                    ? { href: ROUTES.strike0904, label: "참석 안내 보기" }
                    : item.date === RALLY_DATE
                      ? { href: ROUTES.rally0828, label: "지난 안내 보기" }
                      : null;
                return (
                  <li
                    key={item.date}
                    className="rounded-2xl shadow-card flex items-start gap-4 bg-bg p-5"
                  >
                    <DateBadge
                      monthDay={formatMonthDaySlash(item.date)}
                      subLabel={days === null || past ? "종료" : days === 0 ? "오늘" : `D-${days}`}
                      /* 색은 **중대도(`level`)가 정한다** — 남은 일수로 고르면 총파업의 중대성이
                         사라진다(§18.5). ⚠ `DateBadge` 를 손대지 마라 — `PostList` 까지 흔들린다 */
                      variant={past ? "default" : item.level === "peak" ? "imminent" : "emphasis"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lead text-ink">{item.title}</span>
                        {past ? <DoneBadge /> : null}
                      </span>
                      <span className="mt-1 block text-caption text-ink-muted">{item.meta}</span>
                      <span className="mt-2 block text-body text-ink">{item.detail}</span>
                      {/* ★★ **라벨과 목적지는 1:1 이다**(§20.0-3) — 같은 문자열이 다른 곳으로 가면
                          그 자체가 QA 실패다. ⚠ **8/28 에 `참석 안내 보기` 를 다시 붙이지 마라** —
                          그것은 «지금 참석할 것»의 라벨이다(검증 §56-6 · 이력 `03_developer_impl.md` M-24).
                          ⚠ **`/rally-2026-08-28` 라우트를 삭제하지 마라**(§20.0-4) — 뿌려진 URL 이 열려야
                            하고, 이 링크가 그 도달 경로다.
                          ⚠ **«완료된 일정» 단서를 새로 짓지 마라** — 도착 페이지가 `RALLY_PAST_NOTE` 를
                            이미 렌더한다(이 카드의 배지와 층위가 다르다) */}
                      {detailLink ? (
                        <Link
                          href={detailLink.href}
                          className="ease-out-soft mt-3 inline-flex min-h-touch items-center gap-1 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                          {detailLink.label}
                          <ArrowRightIcon className="size-5" />
                        </Link>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 max-w-[var(--container-prose)] text-caption text-ink-muted">
              교섭 진행에 따라 일정이 변동될 수 있으며, 2차 총파업이 진행될 수 있습니다.
            </p>
          </section>

          {/* ② 쟁의권 확보 — ⚠ 조합원 규모 수치를 쓰지 마라(투표율 오산) */}
          <section aria-labelledby="mandate-heading" className="mt-section md:mt-section-lg">
            <div id="mandate-heading">
              <SectionHeading>쟁의권 확보</SectionHeading>
            </div>
            <div className="rounded-panel mt-6 bg-surface p-6 md:p-10">
              {/* ★ **`break-words` 를 빼지 마라** — 200% 에서 가로 스크롤 34px 이 났다. ⚠ `break-keep`
                  으로는 안 풀린다: `96.05%` 는 숫자·기호라 끊을 자리가 없다(`union-design-system` §0.8) */}
              <p className="font-display text-hero break-words text-primary">96.05%</p>
              <p className="mt-2 text-lead text-ink">찬성률</p>
              <p className="mt-4 text-body text-ink">투표 68,878명 중 66,154명 찬성</p>
              <p className="mt-4 text-caption text-ink-muted">
                전국금융산업노동조합 발표 (2026-08-12 쟁의행위 찬반투표)
              </p>
            </div>
          </section>

          <section aria-labelledby="demands-heading" className="mt-section md:mt-section-lg">
            <div id="demands-heading">
              <SectionHeading>2026 산별중앙교섭 요구안</SectionHeading>
            </div>

          {/* ③ 요구안 — 항목 수에 의존하지 않는 레이아웃(늘거나 줄어도 깨지지 않는다).
              임금은 노조/사측 **대비**가 핵심이라 전폭 카드로 분리한다 */}
            {/* ⚠ 색만으로 의미를 싣지 마라 — 수치를 병기한다 */}
            <div className="rounded-2xl shadow-card mt-6 bg-bg p-5 md:p-8">
              <h3 className="text-lead text-ink">실질임금 인상</h3>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-badge bg-primary p-4">
                  <dt className="text-caption text-primary-soft">노조 요구</dt>
                  <dd className="font-display mt-1 text-title text-white">6.0%</dd>
                </div>
                <div className="rounded-badge bg-urgent-strong p-4">
                  <dt className="text-caption text-white">사측 제시</dt>
                  <dd className="font-display mt-1 text-title text-white">2.5%</dd>
                </div>
              </dl>
              <p className="mt-4 text-body text-ink">
                노조는 8.0%에서 6.0%로 수정 제안했고, 사측은 2.5%를 제시했습니다.
              </p>
            </div>

            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {DEMANDS.map((demand) => (
                <li key={demand} className="rounded-2xl shadow-card bg-bg p-5">
                  <span className="text-body font-semibold text-ink">{demand}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-caption text-ink-muted">지부 안내자료(2026-08-12) 기준</p>

            {/* ⚠ 지방이전 저지를 **요구안 목록에 넣지 마라**(검증 3회차) — 없는 "6대 요구안"이 된다 */}
            <div className="rounded-panel mt-8 bg-surface p-6 md:p-8">
              <h3 className="text-lead text-ink">총파업 국면의 핵심 쟁점</h3>
              <p className="mt-3 text-body font-semibold text-ink">금융기관 지방이전 저지</p>
              <p className="mt-2 max-w-[var(--container-prose)] text-body text-ink">
                정부가 추진하는 2차 공공기관 이전에 대한 저지가 총파업의 핵심 쟁점으로 함께
                다뤄지고 있습니다.
              </p>
              <p className="mt-4 text-caption text-ink-muted">
                언론 보도 기준 (지부 안내자료 요구안 목록에는 포함되지 않음)
              </p>
            </div>
          </section>

          {/* ④ 교섭 경과 — 과거형 고정. ⚠ 선 요소를 추가하지 마라(§16.5) */}
          <section aria-labelledby="timeline-heading" className="mt-section md:mt-section-lg">
            <div id="timeline-heading">
              <SectionHeading>교섭 경과</SectionHeading>
            </div>
            <ol className="mt-6 max-w-[var(--container-prose)]">
              {TIMELINE.map((entry) => (
                <li key={entry.date} className="mt-6 flex flex-col gap-1 sm:flex-row sm:gap-6">
                  <span className="font-display shrink-0 text-body font-medium text-ink-muted sm:w-24">
                    {entry.date}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* ⚠ 강조는 텍스트 색만 — 좌측 바 금지(§16.5) */}
                    <span
                      className={`block text-body font-semibold ${
                        entry.emphasis ? "text-urgent-strong" : "text-ink"
                      }`}
                    >
                      {entry.title}
                    </span>
                    {entry.detail !== null ? (
                      <span className="mt-1 block text-body text-ink">{entry.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ⑤ 조정 절차 — ⚠ "중재/중재안"·"필수유지업무"·파업 요건 서술을 쓰지 마라 */}
          <section aria-labelledby="mediation-heading" className="mt-section md:mt-section-lg">
            <div id="mediation-heading">
              <SectionHeading>조정 절차란</SectionHeading>
            </div>
            <div className="rounded-panel mt-6 bg-surface p-6 md:p-8">
              <div className="max-w-[var(--container-prose)] text-body text-ink">
                <p>노사가 스스로 합의하지 못하면 중앙노동위원회가 조정 절차를 진행합니다.</p>
                <p className="mt-4">
                  조정에서 나오는 조정안은 수락을 권고하는 것이며 구속력이 없습니다.
                </p>
                <p className="mt-4">
                  &lsquo;조정 중지&rsquo;는 위원회가 더 이상 접점을 찾기 어렵다고 판단한 것입니다.
                </p>
                <p className="mt-4">이 절차를 거쳐야 합법적인 쟁의행위가 가능합니다.</p>
                <p className="mt-4 font-semibold">
                  즉 파업은 절차를 모두 지킨 뒤 남은 마지막 수단입니다.
                </p>
              </div>
            </div>
          </section>

          {/* ⑥ 원본 자료 — ⚠ 캘린더 이미지를 넣지 마라(원문 오기가 노출된다) */}
          <section aria-labelledby="source-heading" className="mt-section md:mt-section-lg">
            <div id="source-heading">
              <SectionHeading>원본 자료</SectionHeading>
            </div>
            <a
              href="/docs/2026-imdantu-struggle-plan.pdf"
              className="rounded-2xl shadow-card ease-out-soft group mt-6 flex min-h-touch items-center gap-3 bg-bg p-5 transition-shadow hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <DocumentIcon className="size-6 shrink-0 text-primary" />
              <span className="text-body font-semibold text-ink group-hover:underline">
                2026 임단투 투쟁계획 안내 (PDF)
              </span>
            </a>
            <p className="mt-4 max-w-[var(--container-prose)] text-caption text-ink-muted">
              지부 안내자료 원본입니다. 2026년 8월 12일 작성분으로 찬반투표 결과가 반영되어 있지
              않으며, 8월 일정표에 표기 오류가 있습니다.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
