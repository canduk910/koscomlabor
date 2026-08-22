import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { ArrowRightIcon } from "@/components/ui/icons";
import { RallyStatusBadge } from "@/components/rally/RallyStatus";
import type { RallyPhase } from "@/lib/rally";

/**
 * 메인페이지 8/28 결의대회 배너 (디자인 스펙 §36 — `RallyEntryCard` 를 대체한다).
 *
 * 사용자 지시(2026-08-21): *"메인페이지 가장 상단에 8/28(금) 결의대회 참석안내 배너를 붙이고,
 * 기존의 26년 임단협 투쟁 안내는 삭제하자."*
 *
 * ★ **컴포넌트는 하나이고 `surface` 가 두 값을 갖는다. 두 벌로 만들지 마라.**
 * 딥블루 강조 면을 세로로 쌓지 않는다 — `HeroPanel` 자신의 규정이
 * *"페이지의 **유일한** 강조 면"*(§0.2-5)이고, 두 개를 쌓으면 **어느 쪽이 더 급한지
 * 알 방법이 사라진다.** 긴급 공지가 있으면 히어로는 공지이고 이 배너는 `panel` 로 내려온다.
 *
 * | surface | 표면 | 표제 |
 * |---------|------|------|
 * | `hero`  | 딥블루 면 + shadow-hero | 40 / 64px |
 * | `panel` | 테두리 단독 · 흰 면 | 24px |
 *
 * `panel` 은 **`RallyEntryCard` 가 쓰던 표면을 그대로 승계한다** — 컴포넌트는 삭제되지만
 * 표면 언어는 살아남는다. `bg-primary-tint`·`bg-primary-soft` 금지(§20.2.2 — `DeadlineStrip`
 * 과 한 덩어리로 읽힌다). 그림자·배경색을 테두리와 함께 주지 마라(§16.5).
 *
 * **D-n 을 넣지 마라**(§20.0-2). 미니달력이 *언제*(D-n)를 말하고 이 배너는 *몇 시에·어디로*를
 * 말한다. 같은 숫자를 두 번 크게 쓰면 조합원이 "같은 말을 두 번 한다"고 읽고 둘 다 대충 본다.
 *
 * 날짜 계산은 호출부가 `rallyPhase()` 로 수행해 넘긴다(§18.7 패턴) — 컴포넌트는 시간을 모른다.
 */
export function RallyBanner({
  surface,
  phase,
  className,
}: {
  surface: "hero" | "panel";
  phase: RallyPhase;
  className?: string;
}) {
  const past = phase === "past";
  const hero = surface === "hero";

  return (
    <section
      aria-label="결의대회 참석 안내"
      className={[
        hero
          ? "rounded-panel bg-primary shadow-hero p-5 md:rounded-panel-lg md:p-12"
          : /* past 는 시각적 강도만 낮춘다. border-border-soft(1.24)는 UI 경계로 3:1 미달이라 금지(§20.6) */
            `rounded-panel border-2 bg-bg p-5 md:p-6 ${past ? "border-border-strong" : "border-primary"}`,
        className ?? "",
      ]
        .filter((c) => c)
        .join(" ")}
    >
      {phase !== "upcoming" ? (
        <p className="mb-3">
          <RallyStatusBadge phase={phase} onDark={hero} />
        </p>
      ) : null}

      {/*
        사용자 지정 문구 — 상태와 무관하게 **한 글자도 고치지 않는다**. 상태는 배지가 말한다(§20.6).
        취소선 금지 — "취소된 일정"으로 오독된다(§17.3).

        ★ **`text-wrap: balance` 를 빼지 마라**(§36.3 — 실측으로 잡은 결함).
        이 문자열은 40px 에서 575.6px · 64px 에서 921px 이라 **360·1280 양쪽에서
        마지막 줄에 `안내` 한 어절만 남는다.** `HeroPanel` 이 기록한 *"`유` 한 글자가
        둘째 줄로 고립"* 과 **같은 결함**이다.

        ⚠ **`<br>`·`<span>` 으로 나누거나 문자열을 두 요소로 쪼개지 마라** —
        **텍스트 노드가 갈라져 문안 대조 grep 이 실패한다.** `balance` 는 단일 텍스트 노드를
        유지한 채 줄 길이만 고르게 만든다. 미지원 브라우저는 현행 동작으로 떨어지므로
        **회귀가 아니라 순수 개선**이다.
        ⚠ **`HeroPanel` 모드 1(공지 제목)에 확대 적용하지 마라** — 길이가 임의이고
        `line-clamp-3` 와 상호작용한다. 별도 판정 사항이다.
      */}
      <p
        className={
          hero
            ? "font-display text-hero text-balance text-white md:text-hero-lg"
            : "text-h2 text-balance break-keep text-ink"
        }
      >
        8/28(금) 저녁 결의대회 참석 안내
      </p>
      {/* 360px 에서 2행이 설계값이다 — nowrap 을 넣지 마라(§20.2.4) */}
      <p
        className={`mt-2 break-keep text-body ${hero ? "text-primary-soft" : "text-ink"}`}
      >
        집결 18:30 · 국회의사당역 3번 출구
      </p>

      {/* 패널 전체를 링크로 만들지 마라(§17.1·§19.2.2). 인터랙티브 요소는 이 CTA 1개다 */}
      <p className={hero ? "mt-8 md:mt-10" : "mt-5"}>
        {hero ? (
          <Link
            href={ROUTES.rally0828}
            className="font-display ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full bg-white px-7 text-body font-medium tracking-[-0.01em] text-primary transition-colors duration-150 hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            참석 안내 보기
            <ArrowRightIcon className="size-5" />
          </Link>
        ) : past ? (
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
