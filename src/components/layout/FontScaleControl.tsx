"use client";

import { useSyncExternalStore } from "react";

/**
 * 글자 크기 슬라이더 — **사이트 전체 타이포를 조합원이 직접 맞춘다**(사용자 지시 2026-08-22).
 *
 * ## 왜 루트 `font-size` 하나로 되는가
 *
 * `globals.css` 의 타이포 토큰이 **전부 `rem`** 이라, `<html>` 의 `font-size` 를 바꾸면
 * 제목·본문·캡션·간격(`--spacing-*`)이 **같은 비율로 함께** 움직인다.
 * 값마다 따로 계산하지 않는다 — 위계가 어긋나지 않는 유일한 방법이다.
 *
 * ⚠ **`rem` 이 아닌 곳은 따라오지 않는다. 의도된 예외 두 곳:**
 *   1. **헤더 로고 록업**(`SiteHeader` 의 `text-[17.7px]` 등) — `whitespace-nowrap` 이라
 *      키우면 360px 에서 가로로 넘친다. 지부명은 **크기가 아니라 자리로** 위계를 진다.
 *   2. **지도 마커 라벨**(`RallyMap` 의 인라인 `font-size:15px`) — 라벨 겹침 판정이
 *      **픽셀 실측 기반**이라 글자가 커지면 접힘 계산이 어긋난다(§21.2.3 히스테리시스).
 *      지도는 자체 `+`/`−` 를 가진 별도 축척계다.
 *
 * ## 값의 범위
 *
 * 기본 100%(본문 18px — 설계 기준값). **90~130%.**
 * 하한을 90 으로 둔 것은 조합원 중 다수가 야외에서 작은 화면으로 본다는 전제 때문이고,
 * 상한 130 은 **`flex-wrap` 이 이미 검증된 200% 확대의 절반 수준**이라 레이아웃이 견딘다.
 *
 * ⚠ **브라우저 자체 확대와 곱해진다** — 사용자가 브라우저에서 200% 를 걸고 여기서 130% 를 주면
 * 실효 260% 다. 그래서 **`flex-wrap` 을 뺀 새 행을 만들지 마라**(§ 푸터 로고·모달 상단 바 선례).
 */

/** localStorage 키 — 값은 퍼센트 정수 문자열. `layout.tsx` 의 선반영 스크립트와 **같은 키를 쓴다** */
const STORAGE_KEY = "koscomlabor:font-scale";
const MIN = 90;
const MAX = 130;
const STEP = 5;
const DEFAULT = 100;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT;
  return Math.min(MAX, Math.max(MIN, Math.round(n / STEP) * STEP));
}

/*
 * 저장값을 **모듈 스코프 캐시 + `useSyncExternalStore`** 로 읽는다.
 *
 * ⚠ **`useEffect` 안에서 `setState` 로 읽어 오지 마라**(린트 `set-state-in-effect` 이자 실제 결함):
 * 기본값으로 한 번 그린 뒤 다시 그려 **슬라이더 손잡이가 눈에 띄게 튄다.**
 * `useSyncExternalStore` 는 **하이드레이션에는 `getServerSnapshot`(기본값)** 을 쓰고
 * 그 직후 실제 값으로 한 번에 맞춰 준다 — 서버·클라이언트 불일치 경고도 나지 않는다.
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
    /* `ml-auto`: 좁은 화면에서 `flex-wrap` 으로 **아래 줄로 내려가도 오른쪽에 붙는다.**
       빼면 줄바꿈된 순간 왼쪽으로 튀어 로고 아래에 어정쩡하게 걸린다 */
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {/* 두 `가` 는 **장식이 아니라 눈금**이다(§2 — 뜻을 형태 하나에만 싣지 않는다).
          `aria-hidden`: 슬라이더 자신이 이름과 값을 이미 말한다 */}
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
        className="accent-primary h-touch w-24 cursor-pointer focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:w-28"
      />
      <span aria-hidden="true" className="text-[17px] leading-none font-bold text-ink-muted">
        가
      </span>
      {/* 현재 값 — **md+ 에서만 보인다.** 360px 에서는 로고(231px)와 함께 한 줄에 못 들어가
          헤더가 늘 두 줄이 된다. 스크린리더에는 `aria-valuetext` 가 언제나 값을 말하므로
          **정보가 사라지는 것이 아니다**(§0.4 은폐 아님 — 대체 경로가 상시 존재한다). */}
      <span className="hidden w-10 text-right text-[12px] tabular-nums text-ink-muted md:inline">
        {scale}%
      </span>
    </div>
  );
}
