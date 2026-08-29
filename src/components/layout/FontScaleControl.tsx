"use client";

import { useSyncExternalStore } from "react";

/**
 * 글자 크기 슬라이더 — 루트 `font-size` 하나로 사이트 전체 타이포를 조합원이 직접 맞춘다.
 * 타이포 토큰이 전부 `rem` 이라 제목·본문·캡션·간격이 같은 비율로 함께 움직인다.
 *
 * ⚠ `rem` 이 아닌 두 곳은 **의도된 예외**라 따라오지 않는다 — 되돌리지 마라:
 *   ① 헤더 로고 록업(nowrap 이라 키우면 360px 에서 넘친다) ② 지도 마커 라벨(겹침 판정이
 *   픽셀 실측 기반이라 글자가 커지면 접힘 계산이 어긋난다 — 지도는 자체 축척계를 가진다).
 * ⚠ 브라우저 자체 확대와 **곱해진다**(200% × 130% = 실효 260%). 그래서 `flex-wrap` 을 뺀
 *   새 행을 만들지 마라.
 */

/** localStorage 키 — 값은 퍼센트 정수 문자열. `layout.tsx` 의 선반영 스크립트와 **같은 키를 쓴다** */
const STORAGE_KEY = "koscomlabor:font-scale";
/*
 * ⚠ **`MIN` 을 90 으로 되돌리지 마라.** 하한은 처음 90 이었고 **사용자 지시로 75 로 내렸다**
 *   (2026-08-22 — *"최저를 더 작게"*). 75% 면 본문이 13.5px 이라 «18px 하한 위반»으로 보이지만,
 *   그 하한은 **기본값의 하한**이지 **사용자가 스스로 줄이는 것**까지 막는 규칙이 아니다
 *   (WCAG 가 막는 것은 «확대를 못 하게» 하는 쪽이다). 이 근거는 여기 말고 어디에도 없다.
 * `MAX` 130 은 `flex-wrap` 이 이미 검증된 200% 확대의 절반 수준이라 레이아웃이 견딘다.
 */
const MIN = 75;
const MAX = 130;
const STEP = 5;
/* ⚠ `globals.css` 의 `html { font-size }` 와 **같은 값**이어야 한다. 기본 75% 도 사용자 지시다 */
const DEFAULT = 75;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT;
  return Math.min(MAX, Math.max(MIN, Math.round(n / STEP) * STEP));
}

/*
 * 저장값은 모듈 스코프 캐시 + `useSyncExternalStore` 로 읽는다.
 * ⚠ `useEffect` 안에서 `setState` 로 읽어 오지 마라 — 린트 위반이자 실제 결함이다.
 *   기본값으로 한 번 그린 뒤 다시 그려 슬라이더 손잡이가 눈에 띄게 튄다.
 */
let cached: number | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): number {
  if (cached === null) {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      cached = v === null ? DEFAULT : clamp(Number(v));
    } catch {
      cached = DEFAULT;
    }
  }
  return cached;
}

/** 서버·하이드레이션 시점의 값 — **`layout.tsx` 가 페인트 전에 실제 값을 이미 얹어 뒀다** */
const getServerSnapshot = (): number => DEFAULT;

export function FontScaleControl() {
  const scale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const apply = (next: number) => {
    const v = clamp(next);
    cached = v;
    document.documentElement.style.fontSize = `${v}%`;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* 저장 실패해도 이번 방문에는 적용된다 */
    }
    for (const cb of listeners) cb();
  };

  return (
    /* `ml-auto`: 줄바꿈으로 아래 줄에 내려가도 오른쪽에 붙는다(빼면 왼쪽으로 튄다).
       ★ 이 컨트롤의 폭이 «헤더 절벽»을 정한다 — 헤더가 접히면 그 아래 모든 것이 50px 내려간다.
         **이 행이 예산의 93.2px 항이다**(가 9.5 + gap 4.5 + 슬라이더 60 + gap 4.5 + 가 14.7).
         전체 예산표와 조건은 `SiteHeader` 주석에 있다(`_workspace/FOLLOWUPS.md` #20 이 그리로 위임했다).
       ⚠ `sm:gap-2`·`sm:w-24`·`md:w-28` 을 지우지 마라 — 좁은 화면에서만 줄이는 것이 설계다.
       ⚠ 슬라이더를 더 줄이지 마라 — 60px 에 12스텝(75~130 · step 5)이라 이미 5px/스텝이고,
         이 컨트롤은 **접근성 기능**이라 작게 만드는 것이 목적과 충돌한다(터치 높이 44 는 유지된다). */
    <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
      {/* 두 `가` 는 장식이 아니라 눈금이다. aria-hidden 인 것은 슬라이더가 이름·값을 이미 말하기 때문 */}
      <span aria-hidden="true" className="text-[11px] leading-none font-bold text-ink-muted">
        가
      </span>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={scale}
        onChange={(e) => apply(Number(e.target.value))}
        aria-label="글자 크기"
        aria-valuetext={`${scale} 퍼센트`}
        className="accent-primary h-touch w-20 cursor-pointer focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 sm:w-24 md:w-28"
      />
      <span aria-hidden="true" className="text-[17px] leading-none font-bold text-ink-muted">
        가
      </span>
      {/* 현재 값 — md+ 에서만 보인다(360px 에서는 로고와 한 줄에 못 들어가 헤더가 늘 두 줄이 된다).
          은폐가 아닌 이유: `aria-valuetext` 가 스크린리더에 언제나 값을 말한다 — 대체 경로가 상시 존재 */}
      <span className="hidden w-10 text-right text-[12px] tabular-nums text-ink-muted md:inline">
        {scale}%
      </span>
    </div>
  );
}
