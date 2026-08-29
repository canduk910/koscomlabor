import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DateBadge } from "@/components/home/DateBadge";
import { StruggleCalendar } from "@/components/bargaining/StruggleCalendar";
import { ArrowRightIcon, DocumentIcon } from "@/components/ui/icons";
import { daysUntilKst, formatMonthDaySlash } from "@/lib/date";
import { STRUGGLE_SCHEDULE } from "@/lib/struggleSchedule";
import { STRIKE_DATE } from "@/lib/strike";
import { ROUTES } from "@/lib/routes";

/**
 * 26년 임단협 투쟁 안내 (디자인 스펙 §17).
 *
 * 게시물 분류가 아니라 **정적 페이지**다 — 8페이지 구조 문서이고 투쟁 종료 후 폐기·보존
 * 판단이 별도로 필요하다.
 *
 * 이 페이지의 모든 문장은 검증을 통과한 사실만 담는다. 근거:
 *  - 원문 전사: `_workspace/00_input/content-bargaining-2026.md`
 *  - 게시 방침: `_workspace/00_input/decision-bargaining-2026.md`
 *  - 검증 판정: `_workspace/01_verifier_factcheck.md` 2·3회차
 *
 * **문안을 임의로 고치지 마라.** 아래는 검증 게이트를 통과한 표현이며,
 * 특히 다음은 의도적으로 **빠져 있다**:
 *  - `필수유지업무 인력 제외` — 법적 근거 미확인(노동조합법 제42조의2①·제71조② 확인 결과
 *    금융 항목은 "한국은행사업"뿐이다). 조합원이 "법상 당연히 제외된다"고 믿으면
 *    자기 참여 의무를 오판한다
 *  - 9/4 집결 장소 — ⚠ **이 전제는 2026-08-29 에 소멸했다.** 주최측 자료(2급)가 들어와
 *    `세종대로 (광화문역, 시청역)` 과 집결 시각이 확정됐다. 아래 카드의 `meta`·`detail` 과
 *    `/strike-2026-09-04` 가 그 사실을 말한다 — **«지부 공지로 안내한다» 는 더 이상 맞지 않는다.**
 *    (여전히 없는 것은 **코스콤지부 대오 위치**다. 그것은 주최측 자료에도 없다)
 *  - 임금피크제 `~2028년까지` 시한 — 외부에서 확인되지 않았다
 *  - 6월 결렬 선언 날짜(6/25 vs 6/24 상충)·교섭 횟수(16 vs 14 상충)
 *  - "중재/중재안" — 조정과 중재는 법상 별개다(제60조① vs 제70조①)
 *  - 투표 독려 문구 — 투표는 2026-08-12 에 끝났다. 현재형으로 쓰면 오보다
 *
 * ISR revalidate 60초: D-n 을 요청 시점에 계산하므로 정적 프리렌더를 쓰지 않는다.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "26년 임단협 투쟁 안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "금융노조 산별중앙교섭이 결렬되어 9월 4일 총파업에 들어갑니다. 남은 일정과 교섭 경과를 안내합니다.",
};

/*
 * 남은 일정은 `src/lib/struggleSchedule.ts` 가 **단일 출처**다(§19.3.3).
 * 메인페이지 미니달력도 같은 배열을 읽는다 — 여기에 다시 적으면 두 벌이 되고,
 * 한쪽만 고쳐졌을 때 조합원에게 서로 다른 날짜가 나간다.
 */

/** 요구안 — 임금은 대비가 핵심이라 전폭 카드로 분리하고, 나머지는 항목 수에 무관한 그리드 */
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

          {/* ① 남은 일정 — 1순위(행동 필요 + 기한 있음). 행동 요청은 이 블록에만 둔다 */}
          <section aria-labelledby="schedule-heading" className="mt-section md:mt-section-lg">
            <div id="schedule-heading">
              <SectionHeading>남은 일정</SectionHeading>
            </div>
            {/*
              달력은 카드를 대체하지 않는 **추가 레이어**다(§18.0 #4). 카드가 장소·시간·상세
              안내의 정본이며, 일정이 전부 지나면 달력만 사라지고 카드는 그대로 남는다.
              now 를 넘기지 않는다 — 프로덕션은 렌더 시점(revalidate 60초)으로 계산한다.
            */}
            <StruggleCalendar events={STRUGGLE_SCHEDULE} className="mt-6" />
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {STRUGGLE_SCHEDULE.map((item) => {
                // 요청 시점 계산 — 8/28 이 지나면 이 카드가 스스로 "완료"로 전환된다
                const days = daysUntilKst(item.date);
                const past = days !== null && days < 0;
                return (
                  <li
                    key={item.date}
                    className="rounded-2xl shadow-card flex items-start gap-4 bg-bg p-5"
                  >
                    <DateBadge
                      monthDay={formatMonthDaySlash(item.date)}
                      subLabel={days === null || past ? "종료" : days === 0 ? "오늘" : `D-${days}`}
                      /*
                        색은 중대도(level)가 정한다 — D-7 이내 판정으로 색을 고르면 8/28·9/4 가
                        둘 다 emphasis 가 되어 총파업의 중대성이 화면에서 사라진다(§18.5).
                        이 페이지는 variant `imminent` 를 **최상위 중대도**의 시각 표현으로
                        사용한다. 이름을 바꾸면 PostList 의 마감 임박 표시까지 흔들리므로
                        DateBadge 는 손대지 않는다.
                      */
                      variant={past ? "default" : item.level === "peak" ? "imminent" : "emphasis"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lead text-ink">{item.title}</span>
                        {past ? <DoneBadge /> : null}
                      </span>
                      <span className="mt-1 block text-caption text-ink-muted">{item.meta}</span>
                      <span className="mt-2 block text-body text-ink">{item.detail}</span>
                      {/*
                        ★★ **2026-08-29 에 목적지가 갈렸다 — 리더 D-9.**
                        종전 이 주석은 *"`참석 안내 보기` 는 **항상** `/rally-2026-08-28`"* 라고
                        못박고 있었다. **그 판정을 D-9 가 뒤집었다. 되돌리지 마라.**

                        지금: **`참석 안내 보기` 는 항상 `/strike-2026-09-04`**,
                        `자세히 보기` 는 항상 `/bargaining-2026`.
                        규율 자체(**라벨은 목적지와 1:1** · 같은 문자열이 다른 곳으로 가면 그 자체가
                        QA 실패다 · §20.0-3)는 **그대로 살아 있다** — 뒤집힌 것은 목적지뿐이다.

                        **왜 8/28 카드에서 내렸는가:**
                         1. 9/4 카드에 같은 라벨을 붙이면 **한 화면에 같은 문자열이 두 목적지**를 갖는다.
                            새 라벨(`총파업 안내 보기`)을 지으면 조합원이 **둘의 차이를 문자열에서
                            찾으려 한다** — 차이는 날짜 배지와 「종료」 배지가 이미 말한다(§5.3 신규 문자열 0).
                         2. **`참석 안내 보기` 는 «지금 참석할 것»을 가리키는 라벨**이다.
                            끝난 행사에 붙어 있는 편이 더 어색하다.

                        ⚠ **`/rally-2026-08-28` 은 이것으로 사이트 내 도달 경로가 0 인 «고아 라우트»가
                        된다(홈 배너도 D-6 으로 내려갔다). 그것은 «부작용»이 아니라 «판정»이다** —
                        **URL 은 살아 있어야 한다.** 카톡·문자로 뿌려진 링크가 그대로 열리는 것이
                        그 페이지를 남기는 유일한 이유다. **라우트를 삭제하지 마라.**
                        QA 에게: **이 라우트가 «고아»로 잡히는 것은 의도된 상태다. 실패로 올리지 마라.**

                        링크가 없으면 이 카드가 막다른 길이 되고, 이 페이지만 본 조합원은
                        집결 시각·위치를 영영 못 본다 — 그래서 **9/4 카드가 그 역할을 승계한다**(§20.2.5).
                      */}
                      {item.date === STRIKE_DATE ? (
                        <Link
                          href={ROUTES.strike0904}
                          className="ease-out-soft mt-3 inline-flex min-h-touch items-center gap-1 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                          참석 안내 보기
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

          {/* ② 쟁의권 확보 — 총파업의 근거. 조합원 규모 수치는 쓰지 않는다(투표율 오산 방지) */}
          <section aria-labelledby="mandate-heading" className="mt-section md:mt-section-lg">
            <div id="mandate-heading">
              <SectionHeading>쟁의권 확보</SectionHeading>
            </div>
            <div className="rounded-panel mt-6 bg-surface p-6 md:p-10">
              {/* ★ `break-words` — 텍스트 확대 200% 에서 이 줄이 **문서 가로 스크롤 34px** 을 만들고 있었다
                  (슬롯 185 vs `scrollWidth` 299 → 114 초과 · QA 실측 2026-08-27).
                  ⚠ **`break-keep` 으로는 안 풀린다** — `96.05%` 는 **숫자·마침표·기호라 끊을 자리가 없다.**
                  홈 배너 헤드라인(`8/28(금) …`)과 **같은 계열이고 처방이 하나**다. */}
              <p className="font-display text-hero break-words text-primary">96.05%</p>
              <p className="mt-2 text-lead text-ink">찬성률</p>
              <p className="mt-4 text-body text-ink">투표 68,878명 중 66,154명 찬성</p>
              <p className="mt-4 text-caption text-ink-muted">
                전국금융산업노동조합 발표 (2026-08-12 쟁의행위 찬반투표)
              </p>
            </div>
          </section>

          {/* ③ 요구안 — 항목 수에 의존하지 않는 레이아웃(늘거나 줄어도 깨지지 않는다) */}
          <section aria-labelledby="demands-heading" className="mt-section md:mt-section-lg">
            <div id="demands-heading">
              <SectionHeading>2026 산별중앙교섭 요구안</SectionHeading>
            </div>

            {/* 임금은 노조/사측 대비가 핵심이므로 전폭 카드. 색만으로 의미를 싣지 않고 수치 병기 */}
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

            {/*
              지방이전 저지는 **요구안 목록의 항목이 아니다** — 교섭 초기 요구안 보도에는 없고
              총파업 국면(8/13 보도)에서 핵심 쟁점으로 등장한다(01 문서 3회차).
              6번째 항목으로 붙이면 존재하지 않는 "6대 요구안"을 만들어내는 것이므로 별도 블록.
            */}
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

          {/* ④ 교섭 경과 — 과거형 고정. 선 요소를 추가하지 않고 2열 정렬로 표현(§16.5) */}
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
                    {/* 최종 결렬만 텍스트 색으로 강조 — 좌측 바 금지(§16.5 표면 규칙) */}
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

          {/* ⑤ 조정 절차 — 정정본. "중재/중재안"·"필수유지업무"·파업 요건 서술을 쓰지 않는다 */}
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

          {/* ⑥ 원본 자료 — 캘린더 이미지는 넣지 않는다(원문 오기 노출) */}
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
