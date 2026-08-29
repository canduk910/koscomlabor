import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { ArrowRightIcon } from "@/components/ui/icons";
import { RallyStatusBadge } from "@/components/rally/RallyStatus";
import type { RallyPhase } from "@/lib/rally";

/**
 * 메인페이지 9/4 총파업 배너 (스펙 §52.9 — `RallyBanner` 를 **대체한다**). 컴포넌트는 하나이고
 * `surface` 가 두 값을 갖는다. 날짜는 호출부가 `strikePhase()` 로 넘긴다(컴포넌트는 시간을 모른다).
 *
 * ⚠ **두 벌로 만들지 마라. 문면을 호출부로 올리지도 마라**(§52.9) — 확정 문면이 한 파일에
 *   리터럴로 있어야 문안 게이트(소스 문자열 집합 차분)가 성립한다.
 * ⚠ 딥블루 면을 세로로 쌓지 마라(§0.2-5) · `bg-primary-tint`·`bg-primary-soft` 금지(§20.2.2) ·
 *   그림자와 테두리를 함께 주지 마라(§16.5) · **D-n 을 넣지 마라**(§20.0-2 · 미니달력의 몫).
 * ⚠ **`past` 상태 문장을 만들지 마라**(§52.3) — 배지 `완료` 가 상태를 말한다. 8/28 의
 *   `RALLY_PAST_NOTE` 를 9/4 판으로 지으면 **검증을 안 거친 신규 저작**이 된다.
 */
export function StrikeBanner({
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
      /* 화면에 헤딩이 없는 조각이라 `aria-label` 이다(`union-webapp-dev` §8) */
      aria-label="총파업 참석 안내"
      className={[
        hero
          ? "rounded-panel bg-primary shadow-hero p-5 md:rounded-panel-lg md:p-12"
          : /* past 는 시각적 강도만 낮춘다. `border-border-soft` 는 UI 경계 3:1 미달이라 금지 */
            `rounded-panel border bg-bg p-5 md:p-6 ${past ? "border-border-strong" : "border-primary"}`,
        className ?? "",
      ]
        .filter((c) => c)
        .join(" ")}
    >
      {phase !== "upcoming" ? (
        <p className="mb-3">
          {/* ⚠ **새 배지를 만들지 마라**(§52.9-1) — 두 화면이 각자 배지를 들면 한쪽만 고쳐진다 */}
          <RallyStatusBadge phase={phase} onDark={hero} />
        </p>
      ) : null}

      {/* 사용자 확정 문면 — **한 글자도 고치지 마라**(취소선도 금지). ⚠ **제목에 시각을 넣지 마라**
          (원문에 시각이 둘이라 어느 쪽을 써도 충돌한다). ⚠ **`<br>`·`<span>` 으로 쪼개지 마라** —
          텍스트 노드가 갈라져 문안 대조 grep 이 실패한다 */}
      <p
        className={
          hero
            ? /* ★ **`break-words` 를 빼지 마라**(양 분기 다) — 되돌리면 200% 에서 문서가 97px 밀린다(§52.11).
                 ⚠⚠ **`break-keep` 을 빼서 고치려 하지 마라** — `9/4(금)` 은 숫자·괄호·기호라 끊을 자리가
                   자체적으로 없다. 아무 효과가 없고 한글만 음절로 잘린다(`union-design-system` §0.8).
                 ★ **`text-balance` 는 제목에 «있어야» 한다.** ⚠ 부제에 없다는 이유로 빼지 마라 —
                   **처방이 반대인 것이 설계값이다**(§52.20-2). 200% 6줄 조판은 그 대가이고 **판정된
                   상태다 — 결함으로 올리지도, 고치려 하지도 마라**(§52.18-2). */
              "font-display text-hero text-balance break-keep break-words text-white md:text-hero-lg"
            : "text-h2 text-balance break-keep break-words text-ink"
        }
      >
        9/4(금) 총파업 참석안내
      </p>
      {/* 부제 — **대상(`전 조합원`)이 게시 조건이다**(검증 §52-6): 원문에 시각이 둘이라 대상을
          빼면 **간부가 오독한다.** ⚠ 여러 행이 되는 것이 설계값 — `nowrap` 을 넣지 마라(§20.2.4) */}
      {/* ★★ 처방 — **부제에 `text-balance` 를 붙이지 마라. 제목과 처방이 «반대»다.** 붙이면
          **가운뎃점이 줄머리로 가고**(`· 세종대로`) **괄호가 두 줄로 갈린다**(`(광화문역` / `·시청역)`)
          — 실측이다(§52.18-1(4)). ⚠ 제목에 있는 것을 보고 «일관성»으로 붙이지 마라 */}
      {/* ★★ 판정 — **200% 모바일에서 `전 조합원` 과 `집결 10:30` 이 갈리는 것은 «정상»이다.**
          조판으로 못 막고(슬롯 201 vs 필요 303.8 · 문면·여백 둘 다 고정) **그래도 조건은 충족이다** —
          **첫 줄이 `전 조합원`** 이라 대상이 시각보다 먼저 읽혀 막으려던 오독과 방향이 반대다.
          ⚠⚠ D-14 의 ««같은 줄»에서 갈리게 하라» 문면은 **죽었다. 인용하지 마라**(§52.20-0) */}
      <p
        className={`mt-2 break-keep break-words text-body ${hero ? "text-primary-soft" : "text-ink"}`}
      >
        전 조합원 집결 10:30 · 세종대로(광화문역·시청역)
      </p>

      {/* ⚠ 패널 전체를 링크로 만들지 마라(§17.1·§19.2.2) — 인터랙티브 요소는 이 CTA 1개다.
          ⚠ `aria-label`·`title` 을 붙이지 마라 — 내부 텍스트가 접근성 이름을 진다(`union-webapp-dev` §8) */}
      <p className={hero ? "mt-8 md:mt-10" : "mt-5"}>
        {hero ? (
          <Link
            href={ROUTES.strike0904}
            className="font-display ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full bg-white px-7 text-body font-medium tracking-[-0.01em] text-primary transition-colors duration-150 hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            참석 안내 보기
            <ArrowRightIcon className="size-5" />
          </Link>
        ) : past ? (
          <Link
            href={ROUTES.strike0904}
            className="ease-out-soft inline-flex min-h-touch items-center gap-1 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            참석 안내 보기
            <ArrowRightIcon className="size-5" />
          </Link>
        ) : (
          <Link
            href={ROUTES.strike0904}
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
