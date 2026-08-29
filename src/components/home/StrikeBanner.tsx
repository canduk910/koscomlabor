import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { ArrowRightIcon } from "@/components/ui/icons";
import { RallyStatusBadge } from "@/components/rally/RallyStatus";
import type { RallyPhase } from "@/lib/rally";

/**
 * 메인페이지 9/4 총파업 배너 (디자인 스펙 §52.9 — `RallyBanner` 를 **대체한다**).
 *
 * 사용자 지시(2026-08-29): *"결의대회처럼 총파업 참석안내 페이지를 만들고 배너를 최상단에
 * 배치해줘."* 8/28 은 지났고(D-6) 결의대회 배너는 **렌더 조건이 아니라 파일째** 내려갔다.
 *
 * ## ★ 왜 `RallyBanner` 를 «일반화»하지 않고 «대체»했는가 (§52.9 판정)
 *
 * 일반화(`EventBanner` + props)는 **두 사용처가 동시에 살아 있을 때** 값을 한다. D-6 으로
 * 결의대회 배너는 사용처가 0 이 됐다. 그리고 문면이 **컴포넌트 → 호출부**로 올라가면
 * 그 문자열의 **정본 파일이 흐려진다** — 이 사이트의 문안 게이트는 «소스 문자열 집합 차분»으로
 * 판정하므로, 확정 문면은 **한 파일에 리터럴로** 있어야 한다.
 * 선례가 정확히 같다: `RallyEntryCard` → `RallyBanner` 때도 **구 컴포넌트를 삭제하고 표면
 * 언어만 승계**했다. **같은 처분의 반복이다.**
 *
 * ★ **컴포넌트는 하나이고 `surface` 가 두 값을 갖는다. 두 벌로 만들지 마라.**
 * 딥블루 강조 면을 세로로 쌓지 않는다(§0.2-5) — 두 개를 쌓으면 **어느 쪽이 더 급한지 알 방법이
 * 사라진다.** 긴급 공지가 있으면 히어로는 공지이고 이 배너는 `panel` 로 내려온다.
 *
 * | surface | 표면 | 표제 |
 * |---------|------|------|
 * | `hero`  | 딥블루 면 + shadow-hero | 40 / 64px |
 * | `panel` | 테두리 단독 · 흰 면 | 24px |
 *
 * `bg-primary-tint`·`bg-primary-soft` 금지(§20.2.2 — `DeadlineStrip` 과 한 덩어리로 읽힌다).
 * 그림자·배경색을 테두리와 함께 주지 마라(§16.5).
 *
 * **D-n 을 넣지 마라**(§20.0-2). 미니달력이 *언제*(D-n)를 말하고 이 배너는 *몇 시에·어디로*를
 * 말한다. 같은 숫자를 두 번 크게 쓰면 조합원이 "같은 말을 두 번 한다"고 읽고 둘 다 대충 본다.
 *
 * ⚠ **`RALLY_PAST_NOTE` 같은 `past` 상태 문장을 만들지 마라**(§52.3). 배지 `완료` 가 상태를
 * 말한다. 8/28 의 그 문장은 **리더 확정 문자열이고 그 날짜가 박혀 있다** — 9/4 판을 지으면
 * **검증을 안 거친 신규 저작**이 된다.
 *
 * 날짜 계산은 호출부가 `strikePhase()` 로 수행해 넘긴다 — 컴포넌트는 시간을 모른다.
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
      /* 화면에 헤딩이 없는 조각이라 `aria-label`. 화면에 `<h2>` 가 있으면 `aria-labelledby` 다
         (`union-webapp-dev` §8 — 사이트 전수 11:5 로 이미 서 있는 규칙) */
      aria-label="총파업 참석 안내"
      className={[
        hero
          ? "rounded-panel bg-primary shadow-hero p-5 md:rounded-panel-lg md:p-12"
          : /* past 는 시각적 강도만 낮춘다. border-border-soft(1.24)는 UI 경계로 3:1 미달이라 금지 */
            `rounded-panel border bg-bg p-5 md:p-6 ${past ? "border-border-strong" : "border-primary"}`,
        className ?? "",
      ]
        .filter((c) => c)
        .join(" ")}
    >
      {phase !== "upcoming" ? (
        <p className="mb-3">
          {/* 배지는 `RallyStatusBadge` 를 그대로 쓴다(§52.9-1) — **새 배지를 만들지 마라.**
              두 화면이 각자 배지를 들면 언젠가 한쪽만 고쳐져 상태가 갈린다(§20.6.1).
              타입 `RallyPhase` 는 3값 유니온이라 **행사 중립**이다. */}
          <RallyStatusBadge phase={phase} onDark={hero} />
        </p>
      ) : null}

      {/*
        사용자 확정 문면(리더 D-8) — 상태와 무관하게 **한 글자도 고치지 않는다**. 상태는 배지가 말한다.
        취소선 금지 — "취소된 일정"으로 오독된다.

        ⚠ **제목에 시각을 넣지 마라.** 원문에 시각이 둘이다(총파업 `11시` · 전 조합원 집결 `10시 30분`).
        제목에 어느 쪽을 써도 다른 쪽과 충돌한다 — **행동 시각은 부제가, `11시` 는 참석 안내 페이지의
        개요가 진다**(D-8).

        ★ **`text-wrap: balance` 를 빼지 마라**(§36.3 — 실측으로 잡은 결함). 이 자리 문자열은
        마지막 줄에 어절 하나만 남기 쉽다.
        ⚠ **`<br>`·`<span>` 으로 나누거나 문자열을 두 요소로 쪼개지 마라** — **텍스트 노드가 갈라져
        문안 대조 grep 이 실패한다.**
      */}
      <p
        className={
          hero
            ? /* ★★ **`break-words` 를 빼지 마라**(디자이너 실측 2026-08-29 · §52.11).
                 200% 확대에서 이 제목의 min-content 가 **298** 인데 슬롯이 **201** 이라
                 **문서 가로 스크롤 97px** 이 난다. 붙이면 **298 → 75 · 초과 0**.

                 ⚠⚠ **`break-keep` 이 원인이 아니다.** 빼도 폭이 그대로다 —
                 **`9/4(금)` 은 숫자·괄호·기호라 «끊을 자리가 자체적으로 없다»**
                 (`union-design-system §0.8` 셋째 문자 종류). 8/28 배너가 겪은 것과 **같은 결함**이다.
                 → **`break-keep` 을 빼서 고치려 하지 마라. 아무 효과가 없고 한글만 음절로 잘린다.**

                 ⚠ `panel` 분기에도 함께 넣었다 — 같은 문자열이라 좁은 화면에서 같은 위험을 진다.
                 **한쪽만 붙이면 «왜 여기만?» 의 답이 «지금 안 넘쳐서» 가 되고, 그 근거는 문면에 매달린다.**

                 ★ **`text-balance` 는 제목에 «있어야» 한다.** 기본 크기 2줄 조판
                 (`9/4(금) 총파업` / `참석안내` · 어절 고립 0)이 그 결과다.
                 ⚠ **부제에 없다는 이유로 제목에서 빼지 마라 — 처방이 반대인 것이 설계값이다**(§52.20-2).
                 ⚠ 200% 6줄 조판(`9/4(` / `금)` / `총파` / `업` / `참석` / `안내`)은 **`break-words` 의
                 대가이고 판정된 상태다.** **결함으로 올리지도, 고치려 하지도 마라** — 되돌리면 문서가 97px 밀린다. */
              "font-display text-hero text-balance break-keep break-words text-white md:text-hero-lg"
            : "text-h2 text-balance break-keep break-words text-ink"
        }
      >
        9/4(금) 총파업 참석안내
      </p>
      {/* 부제 — **대상(`전 조합원`)이 게시 조건이다**(검증 §52-6). 원문에 시각이 둘이라
          (간부 10시 / 전 조합원 10시 30분) 대상을 빼면 **간부가 오독한다.**
          360px 에서 여러 행이 되는 것이 설계값이다 — **`nowrap` 을 넣지 마라**(§20.2.4). */}
      {/*
        ★★ 처방 — **부제에 `text-balance` 를 붙이지 마라. 제목과 처방이 «반대»다.**

        붙이면 **더 나빠진다**(디자이너 실측 · §52.18-1(4)):
        **가운뎃점이 줄머리로 간다**(`· 세종대로` · `·시청역)`) — 가운뎃점은 앞 낱말에 붙는
        구분자라 줄머리에 서면 뜻이 흐려진다. 그리고 **여는 괄호와 닫는 괄호가 두 줄로 갈린다**
        (`(광화문역` / `·시청역)`).
        ⚠ 제목에 있는 것을 보고 «일관성» 으로 여기에 붙이지 마라 — **일관성 결여가 아니라 실측 판정이다.**
      */}
      {/*
        ★★ 판정 — **200% 모바일에서 `전 조합원` 과 `집결 10:30` 이 갈리는 것은 «정상»이다.**

        **조판으로 못 막는다**: 한 줄에 담으려면 슬롯 **303.8px** 이 필요한데 200% 모바일 슬롯은
        **201px** 이다(뷰포트 약 463px 부터 가능 — 선언 뷰포트 360·390·412 는 전부 갈린다).
        **문면은 사용자 지정이라 못 바꾸고, 여백(`p-5`)은 표면 언어라 못 줄인다.**

        **그래도 조건은 충족이다**: 막으려던 것은 «간부가 `10:30` 을 자기 시각으로 오독하는 것» 인데,
        **첫 줄이 `전 조합원`** 이라 **대상이 시각보다 먼저 읽힌다** — 오독 방향과 **반대**다.
        `전` 한 글자만 남는 줄도 **0** 이다(실측).
        ⚠⚠ **`D-14` 의 조건 문면 ««같은 줄»에서 갈리게 하라» 는 죽었다**(리더 D-17 · §52.20-0).
          **인용하지 마라** — 그것을 근거로 «미달성» 이라 읽고 문면·여백을 만지는 것이 이 주석이 막는 행동이다.
      */}
      <p
        className={`mt-2 break-keep break-words text-body ${hero ? "text-primary-soft" : "text-ink"}`}
      >
        전 조합원 집결 10:30 · 세종대로(광화문역·시청역)
      </p>

      {/* 패널 전체를 링크로 만들지 마라(§17.1·§19.2.2). 인터랙티브 요소는 이 CTA 1개다.
          라벨 `참석 안내 보기` 는 **8/28 에서 승계한 것**이다(D-9) — 신규 문자열 0.
          ⚠ `aria-label`·`title` 을 붙이지 마라(`union-webapp-dev` §8) — 내부 텍스트가 접근성 이름을 진다 */}
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
