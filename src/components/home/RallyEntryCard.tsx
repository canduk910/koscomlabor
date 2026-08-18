import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { ArrowRightIcon } from "@/components/ui/icons";
import { RallyStatusBadge } from "@/components/rally/RallyStatus";
import type { RallyPhase } from "@/lib/rally";

/**
 * 메인페이지 결의대회 참석 안내 진입 블록 (디자인 스펙 §20.2).
 *
 * **미니달력과 담는 사실이 다르다**(§20.0-2): 달력은 *언제*(D-n), 이 블록은 *몇 시에·어디로*.
 * 그래서 여기에는 **D-n 을 표시하지 않는다** — 같은 숫자를 두 번 크게 쓰면 조합원이
 * "같은 말을 두 번 한다"고 읽고 둘 다 대충 본다.
 *
 * 표면은 **테두리 단독**이다(§16.5). 그림자·배경색을 함께 주지 마라 —
 * 메인 도입부 5개 블록이 각각 다른 표면 언어를 갖는 것이 서로를 구별하는 유일한 수단이다.
 * `bg-primary-tint`·`bg-primary-soft` 면 금지: `DeadlineStrip` 과 한 덩어리로 읽힌다(§20.2.2).
 *
 * **조건부 렌더가 아니다.** 8/28 이 지나도 렌더한다(리더 결정 2) — 상태만 바뀐다(§20.6).
 * 히어로가 urgent 공지로 모드 1 이 되어도 이 블록은 그대로 남는다(리더 결정 1).
 *
 * 날짜 계산은 호출부가 `rallyPhase()` 로 수행해 넘긴다(§18.7 패턴) — 컴포넌트는 시간을 모른다.
 */
export function RallyEntryCard({
  phase,
  className,
}: {
  phase: RallyPhase;
  className?: string;
}) {
  const past = phase === "past";
  return (
    <section
      aria-label="결의대회 참석 안내"
      className={`rounded-panel border-2 bg-bg p-5 md:p-6 ${
        /* past 는 시각적 강도만 낮춘다. border-border-soft(1.24)는 UI 경계로 3:1 미달이라 금지(§20.6) */
        past ? "border-border-strong" : "border-primary"
      }${className ? ` ${className}` : ""}`}
    >
      {phase !== "upcoming" ? (
        <p className="mb-3">
          <RallyStatusBadge phase={phase} />
        </p>
      ) : null}

      {/* 사용자 지정 문구 — 상태와 무관하게 **한 글자도 고치지 않는다**. 상태는 배지가 말한다(§20.6).
          취소선 금지 — "취소된 일정"으로 오독된다(§17.3) */}
      <p className="text-h2 break-keep text-ink">8/28(금) 저녁 결의대회 참석 안내</p>
      {/* 360px 에서 2행이 설계값이다 — nowrap 을 넣지 마라(§20.2.4) */}
      <p className="mt-2 break-keep text-body text-ink">집결 18:30 · 국회의사당역 5번 출구</p>

      {/* 패널 전체를 링크로 만들지 마라(§17.1·§19.2.2). 인터랙티브 요소는 이 CTA 1개다 */}
      <p className="mt-5">
        {past ? (
          <Link
            href={ROUTES.rally0828}
            className="ease-out-soft inline-flex min-h-touch items-center gap-1 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            참석 안내 보기
            <ArrowRightIcon className="size-5" />
          </Link>
        ) : (
          <Link
            href={ROUTES.rally0828}
            className="font-display ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full bg-primary px-7 text-body font-medium tracking-[-0.01em] text-white transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            참석 안내 보기
            <ArrowRightIcon className="size-5" />
          </Link>
        )}
      </p>
    </section>
  );
}
