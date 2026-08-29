"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  APPROX_NOTE,
  KOSCOM_COLUMN_NOTE,
  LEGEND_KEY,
  MAP_AFFORDANCE_NOTE,
  MAP_GESTURE_NOTE,
  MAP_SR_INTRO,
  STRIKE_MAP_FEATURES,
  STRIKE_MAP_FIT_BOUNDS,
  STRIKE_MAP_MAX_ZOOM,
  STRIKE_MAP_MIN_ZOOM,
  featureLabelAnchor,
  featurePoints,
  featureRoadviewPoint,
  featureShortName,
  labelGapOf,
} from "@/lib/strikeMap";
import type {
  StrikeLabelPlacement,
  StrikeLatLng,
  StrikeMapFeature,
  StrikeMapTone,
} from "@/lib/strikeMap";
import type {
  NaverLatLngBounds,
  NaverMap,
  NaverMapEventListener,
  NaverMapsNamespace,
  NaverMarker,
  NaverOverlay,
  NaverPanorama,
} from "@/lib/naverMaps";
import { StrikeRoadviewSheet } from "./StrikeRoadviewSheet";
import type { StrikePanoStatus } from "./StrikeRoadviewSheet";

/**
 * 9/4 총파업 «세종대로 안내지도» — 대오 4개를 «대등하게» 그린다(강조 하나가 없다. 코스콤 대오가 확정되면
 * 해당 pill 의 면 반전 하나로 끝난다 — `strikeMap.ts` 머리 주석).
 * 설계 `_workspace/02_designer_spec.md` §54 · 검증 `_workspace/01_verifier_factcheck.md` §53~§55.
 * ⚠ 8/28 `RallyMap.tsx` 를 복사하지 마라 — 대체면·여백 상수가 전부 여의도 기하다(승계는 §54.2 패턴 8가지뿐).
 * ⚠⚠ 401 이면 네이버 객체가 «있는데 내부가 null» 이라 정리 호출이 throw 하고, unmount effect 의 예외를 React 가
 *   회복하지 못해 페이지가 통째로 죽는다 — 정리 호출은 전부 `safely()` 를 통과한다. 벗기지 마라(§54.10).
 */

type MapStatus = "loading" | "ready" | "failed";

/** onError 없이 매달리는 경우까지 실패로 확정한다(§54.2 패턴 1) */
const LOAD_TIMEOUT_MS = 8_000;
const RESIZE_DEBOUNCE_MS = 150;

/** 초기 뷰 여백(px) — 8/28 여의도 값을 쓰지 마라. `top` 만 48 인 것은 광화문역 pill 이 두 점 «위»에 서야 해서다(§54.16-14).
 *  ⚠ `fitBounds` 에 줌 상한을 걸지 마라 — «사용자 조작 상한»(`maxZoom`)과 다른 계약이다(§54.16-1) */
const FIT_PADDING = { top: 48, right: 24, bottom: 44, left: 24 } as const;

/** pill 폭 상한 = 상자 폭 × 0.7. 0폭 앵커 안에서는 `%` 가 해석되지 않아 px 로 확정해 내린다 */
const LABEL_MAX_WIDTH_RATIO = 0.7;
const LABEL_MAX_WIDTH_VAR = "--strike-label-max";

/* ★ 규칙: 마커 `zIndex` 는 «범례 행 순서»를 그대로 따른다(배열 순서 = 범례 13행 순서). 뒤 행이 위다(§54.17-2).
   ⚠⚠ 범례 행 순서를 바꾸면 z 순서가 «함께» 바뀐다 — 둘은 한 쌍이다. `id` 로 z 를 덮어쓰는 특례를 만들지 마라.
   ⚠ 도형(원 20 · 밴드 25)은 이 규칙 «밖»이다(§54.5-2) */
const MARKER_Z_BASE = 100;
/** 이름 pill — 도형·배지보다 항상 위. 안에서는 다시 «범례 행 순서»를 따른다 */
const LABEL_Z_BASE = 1_000;
/** 거리뷰 «지금 보는 위치» 표식 — 라벨(1000+)보다 아래, 배지(100+)보다 위 */
const SPOT_Z = 900;

/* 색 — §54.7 대비 검증표의 값. **신규 색 0 · 신규 토큰 0** */
const GO = "#093389"; // 파랑 11.37 — 조합원이 갈 곳(대오·역)
const REFERENCE = "#4b5563"; // 회색 7.56 — 참고 지물(무대·화장실)
const INK = "#1a1a1a"; // 17.40 — **의미를 지지 않는 중립색**
const CASING = "#ffffff"; // 흰 casing — 타일 색을 예측하지 않고 대비를 만드는 아래층

const toneColor = (tone: StrikeMapTone): string => (tone === "go" ? GO : REFERENCE);

/* 9/4 도형은 «전부» `estimated` 라 선종은 단일 `shortdot`, 구분은 색·형태만 진다(§53-6). 원(0.10)이 띠(0.14)보다
   옅은 것은 «이 안 어딘가»와 «여기 모인다»의 차이다. ⚠ `fillOpacity` 0.20 이상 금지(8/28 `verified` 와 같아져
   확신도 위계가 무너진다) · 회색 금지(M-2) · 테두리 제거 금지(면만으로는 WCAG 1.4.11 3:1 을 못 만든다 · M-15) */
const SHAPE_STYLE = {
  strokeStyle: "shortdot",
  strokeWeight: 3,
  casingWeight: 7,
  bandFillOpacity: 0.14,
  circleFillOpacity: 0.1,
} as const;

/* ⚠ 원(3,3)과 밴드(1,6)의 점선 «밀도» 차이는 네이버가 두 도형을 다른 경로로 그리는 «렌더 산물»이고 «확신도 차이가
   아니다»(코드는 둘 다 `SHAPE_STYLE` 하나). ⚠⚠ 맞추려고 커스텀 대시 배열을 쓰지 마라 — 9/4 는 «문서 없는 API 0개»가 판정이다(§54.17-4) */
function featureZIndex(feature: StrikeMapFeature, index: number): number {
  switch (feature.kind) {
    case "circle":
      return 20;
    case "band":
      return 25;
    case "dot":
    case "dots":
      return MARKER_Z_BASE + index;
  }
}

/** ⚠ 인증 실패 뒤 `setMap(null)`·`destroy()` 는 throw 하고, unmount effect 의 예외는 React 가 회복하지
 *  못해 트리 전체가 날아간다(지도뿐 아니라 개요·집결시간·식순이 함께 사라진다). 벗기지 마라(§54.10) */
function safely(run: () => void): void {
  try {
    run();
  } catch {
    /* 정리 실패는 조합원에게 보일 일이 아니다 — 문서에 남은 콘텐츠를 지키는 것이 우선이다 */
  }
}

const SYMBOL_MALE = "#1785DE";
const SYMBOL_FEMALE = "#F2492A";

/** 화장실 픽토그램 — 8/28 `symbolSvg` 와 «같은 도형»이다(§54.5-4). 두 벌이니 한쪽만 고치지 마라. ⚠ 이모지로 바꾸지
 *  마라(글꼴이 없으면 두부로 떨어진다) · 지도 배지와 범례는 «같은 그림»이어야 한다(§54.14 #502) · 두 색은 도형 전용이다(§54.7) */
function symbolSvg(kind: "toilet", size: number): string {
  if (kind !== "toilet") return "";
  return [
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" style="display:block;">`,
    `<circle cx="7" cy="3.9" r="2.9" fill="${SYMBOL_MALE}"/>`,
    `<rect x="4.0" y="7.8" width="6.0" height="8.6" rx="0.9" fill="${SYMBOL_MALE}"/>`,
    `<rect x="4.5" y="16.2" width="2.2" height="4.9" rx="0.5" fill="${SYMBOL_MALE}"/>`,
    `<rect x="7.3" y="16.2" width="2.2" height="4.9" rx="0.5" fill="${SYMBOL_MALE}"/>`,
    `<circle cx="17" cy="3.9" r="2.9" fill="${SYMBOL_FEMALE}"/>`,
    `<path d="M17 7.2 22.3 17.4 H11.7 Z" fill="${SYMBOL_FEMALE}"/>`,
    `<rect x="14.6" y="17.2" width="2.1" height="3.9" rx="0.5" fill="${SYMBOL_FEMALE}"/>`,
    `<rect x="17.3" y="17.2" width="2.1" height="3.9" rx="0.5" fill="${SYMBOL_FEMALE}"/>`,
    "</svg>",
  ].join("");
}

function placeStyle(placement: StrikeLabelPlacement, gap: number): string {
  switch (placement) {
    case "right":
      return `left:${gap}px;top:0;transform:translateY(-50%);`;
    case "left":
      return `right:${gap}px;top:0;transform:translateY(-50%);`;
    case "top":
      return `left:0;bottom:${gap}px;transform:translateX(-50%);`;
    case "bottom":
      return `left:0;top:${gap}px;transform:translateX(-50%);`;
  }
}

/**
 * 누를 수 있는 마커의 히트 정보 — `null` 이면 그 표식은 **순수 장식**이다.
 * ★ 규칙(§54.18-1): **`roadview` 인 항목만 누를 수 있고, 히트는 «pill 이 있으면 pill · 없으면 기호 배지»** 다.
 *   **점(dot)은 언제나 장식**이다. ⚠⚠ **광화문역 두 점에 «각각» 히트를 주지 마라** — «한 항목» 계약
 *   (구현 조건 15)이 화면에서 깨지고 **같은 이름 둘**이 되어 출구 번호를 안 쓰기로 한 M-13 이 무너진다.
 *   **pill 하나 = 팝업 하나**여야 그 위험이 구조적으로 0 이다.
 */
interface StrikeHit {
  id: string;
  /** 접근성 이름 — **범례 행 문면 «전문»**(`feature.legend`)이다(M-34).
   *  ⚠⚠ **`featureShortName`(= «— » 앞부분)으로 줄이지 마라.** 범례 9·10행이 **둘 다 `간이화장실`** 이라
   *  짧은 이름을 쓰면 **버튼 두 개의 접근성 이름이 완전히 같아진다** — 스크린리더 사용자가 **어느 것인지 고를 수
   *  없다.** ★ **«구별 불가»는 «못 쓰는 것»이고 «반복»은 «불편»이다 — 무게가 다르다.**
   *  ★ **8/28 은 짧은 이름을 쓸 수 있었다**(`RallyMap.tsx` — *«길게 쓰면 그룹 순회 때 범례 전문이 6번 반복»*).
   *  **`{번호} {이름}` 의 «번호»가 구별자였기 때문이다.** ⚠ **9/4 에는 번호가 0 이다**(§54.16-12) —
   *  **8/28 의 처방을 근거만 보고 옮기지 마라. 그 처방이 기대던 구별자가 여기엔 없다.**
   *  ⚠ **`aria-label` 로 만들지 마라**(`union-webapp-dev` §8 — 내용을 «대체»한다). `sr-only` 내부 텍스트다.
   *  ⚠ 와드 라벨(`featureShortName`)과 **다른 값이다. 하나로 합치지 마라** — 와드는 «한 번에 하나»라
   *  같은 이름이 충돌하지 않지만, 접근성 이름은 **다섯 개가 한 목록에 함께 선다.** */
  name: string;
}

/** 누를 수 있게 그려진 마커 하나 — 포인터 클릭 리스너를 나중에 이 마커에 건다 */
interface StrikeHitEntry {
  id: string;
  marker: NaverMarker;
}

/**
 * 마커 히트의 **쉬는 상태 그림자**를 «변수»로만 내린다 — 실제 `box-shadow` 와 **포커스 이중 링**은
 * `globals.css` 의 `[data-strike-hit]` 규칙이 준다(QA O-1 · 근거·대비값은 그 주석에 있다).
 * ⚠ 여기서 `box-shadow` 를 «직접» 쓰지 마라 — 인라인이 되어 `:focus-visible` 이 못 이기고 **링이 안 나온다.**
 * ⚠ `focus-visible:outline-primary` 로 되돌리지 마라 — `#093389` ↔ 어두운 타일 대비가 **1.53** 이라
 *   어두운 타일에서 «반드시» 미달이다. 주색으로는 못 고친다.
 */
const HIT_REST_SHADOW_VAR = "--strike-hit-shadow";

/**
 * ⚠⚠ **터치 대상 24×24 는 «지도 마커 한정» 예외다**(리더 판정 27 · §54.18-1 (1)). 근거를 **값으로** 남긴다:
 * 서쪽 열 마커 **최소 중심 간격 26.7px**(메인무대 pill ↔ 간이화장실 배지) · pill 세로 **22 → 24**(padding 2 → 3) ·
 * 픽토그램 배지 **24** · **잔여 여유 2.7px** → **WCAG 2.5.8 AA 충족 / 2.5.5 AAA(44×44)는 «못 만든다»**.
 * 44 를 주면 **인접 히트가 서로를 삼켜 «누를 수 없는 지물»이 생긴다** — 44 를 지키면 접근성이 **더** 나빠진다.
 * **좌표를 옮겨 간격을 벌리는 것은 금지**다(M-19 — `verified` 가 `estimated` 가 된다).
 * ⚠ **페이지의 다른 곳(복귀 링크·CTA·지도 컨트롤·시트 조작·팝업 버튼)은 44 그대로다. 이 예외를 확산시키지 마라.**
 */
const HIT_MIN_PX = 24;

/*
 * ★★ **지도 위 겹침은 «화면 고정»인지 «지리 고정»인지 먼저 가른다** (QA F-D 판정 · M-44).
 *
 * pill·배지는 **화면 고정 px**(배율이 바뀌어도 크기가 그대로)이고 그것이 매달린 지점은 **지리 고정**이라
 * **배율마다 둘의 관계가 바뀐다.** 둘을 **한 계면 상수 하나로 풀려고 하면 «못 푼다» —
 * 한 배율을 사고 다른 배율을 잃는다.**
 * 할 수 있는 것은 셋뿐이다: ① 어느 배율에서 나타나고 사라지는지 **«산출»** ② **«못 누르는 지물»이 생기는지**로
 * **«판정»** ③ 정말 없애야 하면 **한쪽의 좌표계를 바꾼다**(값 조정이 아니라).
 *
 * ⚠⚠ **`labelGap` 20 을 24 로 올려 z17 교차를 «고치지» 마라 — 판정은 «고칠 대상이 아니다» 다:**
 *   1. z17 **한 배율**의 과도 현상이고 **z18 에서 스스로 사라진다**(세로 이격이 배율에 비례 · z17 에서 임계에 1px 모자람).
 *   2. 겹침 **7px²** 는 히트 **576px² 의 1.2%** — **남은 569px² 가 24×24 규격을 유지**하고 그 자리는 z17 에서 상자 밖이다.
 *   3. gap 24 로는 **z17 «가로» 겹침(8.6px)조차 다 못 산다**(≥28.6 필요). **한 배율을 사려다 그 배율도 못 산다.**
 *   4. ★ **여유가 «0» 인 자리가 있다**(히트 ↔ 장식 pill **0.0px 맞닿음**). `labelGap` 이 `FIT_PADDING.right` 안에서
 *      pill 우단을 밀면 **`fitBounds` 결과 → 축척 → 서쪽 열 0.0px 자리**가 함께 움직인다.
 *      **여유 0 인 자리 «옆»에서는 상수를 만지지 마라.**
 *
 * ★ 이 교차는 **§54.18-1(«pill 이 있으면 pill, 없으면 기호»)이 M-30(광화문역 두 점)을 푼 «대가»** 다.
 *   대가를 적어 두는 이유는 하나다 — **다음 사람이 이것을 «결함»으로 오인하지 않게** 하려는 것이다.
 *
 * ── 같은 축의 «관측» 하나 (고치지 않는다 · M-46) ──────────────────────────────
 * 상자를 **200px** 까지 줄이면 `cityhall` pill **하나**가 상자 밖으로 나간다(재적합 후에도).
 * **재적합 결함이 아니다** — `fitBounds` 패딩이 **«앵커 점»만** 보고 **pill 폭(88px)** 을 모르기 때문이다.
 * ⚠ **200px 는 실기기 조건 밖**이다: 360px 뷰포트 → 상자 **336** · 글자 200% → **296**. **296px 에서는 0 이다.**
 * ⚠ **`FIT_PADDING.right` 를 키워 «고치지» 마라** — 위 4번(여유 0 인 자리)이 그대로 걸린다.
 */

/** 지도 위 이름 pill(10개) — 글자는 «불투명 흰 pill 위»에만 올린다(타일 위에 직접 얹으면 대비를 계산할 수 없다).
 *  뜻은 범례 13행이 진다(§54.12). ⚠ `width:max-content` 를 빼지 마라 — 앵커가 «0폭 컨테이닝 블록»이라
 *  라벨이 min-content 로 접힌다. ⚠⚠ 폰트를 `rem` 으로 바꾸지 마라 — pill 은 «좌표에 묶인 위치 요소»라
 *  확대를 따르면 가리키는 대상을 덮는다(캔버스 «밖»은 전부 `rem` · §54.6-4 · 디자인 §0.8.2).
 *  ★ `hit` 이 있으면 pill 이 **버튼**이 된다. 그때만 바깥 `aria-hidden` 을 **벗긴다** — 포커스 가능한 요소를
 *  `aria-hidden` 뒤에 두면 WCAG 4.1.2 즉시 위반이다(**`aria-hidden` 과 포커스 가능 여부는 한 쌍**).
 *  ⚠ `<button>` 으로 만들지 마라 — Enter 가 클릭 이벤트를 «또» 만들어 네이버 마커 클릭 리스너와 **이중 발동**한다.
 *  키보드는 아래 `keydown` 위임이 진다(8/28 과 같은 구조) */
function pillHtml(options: {
  text: string;
  placement: StrikeLabelPlacement;
  gap: number;
  color: string;
  hit: StrikeHit | null;
}): string {
  const { text, placement, gap, color, hit } = options;
  /* `min-height` 로 24 를 **보증**한다 — padding 만으로는 글꼴 메트릭에 따라 값이 흔들린다(위 `HIT_MIN_PX`).
     ⚠ 누를 수 있는 pill 만 키우지 마라 — pill 이 두 크기가 되면 «크기»가 뜻을 지게 되는데 어포던스 축은
     문장 하나가 진다(§54.18-1 (3)). 10개 전부 같은 상자다 */
  const box =
    `position:absolute;${placeStyle(placement, gap)}box-sizing:border-box;` +
    `background:${CASING};border:1px solid ${color};border-radius:9999px;padding:3px 8px;` +
    `min-height:${HIT_MIN_PX}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
    `font-size:11px;font-weight:600;line-height:1.3;color:${color};` +
    "white-space:normal;word-break:keep-all;width:max-content;" +
    `max-width:var(${LABEL_MAX_WIDTH_VAR},70%);`;
  /* 타일 위 pill 을 «떠 있는 것»으로 만드는 그림자. 히트일 때는 **변수로** 내린다(위 `HIT_REST_SHADOW_VAR`) */
  const drop = "0 1px 4px rgb(0 0 0 / .30)";
  if (hit === null) {
    return [
      '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
      `<div style="${box}box-shadow:${drop};">`,
      text,
      "</div></div>",
    ].join("");
  }
  return [
    '<div style="position:relative;width:0;height:0;">',
    `<span role="button" tabindex="0" data-strike-hit="${hit.id}" style="${box}${HIT_REST_SHADOW_VAR}:${drop};cursor:pointer;">`,
    `<span aria-hidden="true">${text}</span>`,
    `<span class="sr-only">${hit.name}</span>`,
    "</span></div>",
  ].join("");
}

/** 역 점 배지 — 지름 12px 채움 + 흰 링 3px + 흰 중심점(§54.16-11). 흰 링은 시청역 점이 대오 4 밴드 «안»에 들어갈 때
 *  «얹힌 층»으로 읽히게 하고, 흰 중심점(`◉`)은 «역 입구»를 말한다. ⚠ 좌표를 옮겨 겹침을 풀지 마라 — `verified` 가
 *  `estimated` 가 된다(M-19). ⚠ 종전의 «점 지름 12 → 10px» 처방은 죽었다(대체 처방 전부 기각) — 남는 가림은
 *  «초기 뷰 한 배율의 성질»이라 «확대»에 위임하며, 그래서 확대 버튼을 조건부로 숨기면 안 된다(§54.17-3) */
function stationDotHtml(color: string): string {
  return [
    /* ★ **점은 언제나 장식이다**(§54.18-1) — `pointer-events:none` · `aria-hidden`. 역의 히트는 pill 이 진다.
       ⚠ 광화문역은 이 함수가 **두 번** 그려진다. 여기에 히트를 주면 «같은 이름 둘»이 된다 */
    '<div aria-hidden="true" style="pointer-events:none;position:relative;width:0;height:0;">',
    "<span style=\"position:absolute;left:0;top:0;transform:translate(-50%,-50%);",
    `width:12px;height:12px;border-radius:9999px;background:${color};`,
    `box-shadow:0 0 0 3px ${CASING},0 1px 3px rgb(0 0 0 / .35);`,
    'display:flex;align-items:center;justify-content:center;">',
    `<span style="width:4px;height:4px;border-radius:9999px;background:${CASING};"></span>`,
    "</span></div>",
  ].join("");
}

/** 화장실 배지 — 픽토그램만. 이름 pill 을 붙이지 않는다(§54.5-3 · 범례 3행이 남으므로 은폐가 아니다).
 *  테두리 `dashed` 는 «확신도»다 — 역 배지의 `solid` 와 갈리는 축은 «선종»이지 색이 아니다.
 *  ★ `hit` 이 있으면 **픽토그램이 «누를 것»이 된다**(§54.18-1 «pill 이 없으면 기호») — pill 은 여전히 안 만든다
 *  (M-28 · 겹침 재측정 회피 · pill 10개 상한).
 *  ★ 보이는 배지는 20px + 흰 링 2px = 24px 이고, **히트 상자를 24px 로 «명시»한다** — 링은 `box-shadow` 라
 *  요소 크기에 안 들어가서 그대로 두면 히트가 20px 이 된다(`HIT_MIN_PX` 근거표) */
function toiletBadgeHtml(hit: StrikeHit | null): string {
  const badge = [
    '<span aria-hidden="true" style="',
    "width:20px;height:20px;box-sizing:border-box;border-radius:9999px;",
    `background:${CASING};border:1.5px dashed ${REFERENCE};`,
    `box-shadow:0 0 0 2px ${CASING},0 1px 3px rgb(0 0 0 / .35);`,
    'display:flex;align-items:center;justify-content:center;">',
    symbolSvg("toilet", 13),
    "</span>",
  ].join("");
  const seat =
    "position:absolute;left:0;top:0;transform:translate(-50%,-50%);" +
    `width:${HIT_MIN_PX}px;height:${HIT_MIN_PX}px;display:flex;align-items:center;justify-content:center;`;
  /* `roadview` 가 없는 픽토그램 항목은 지금 0 이지만 분기를 남긴다 — 히트 규칙은 «데이터가 정한다»가
     이 구현의 계약이고, 없애면 규칙이 «화장실은 늘 눌린다»로 굳는다 */
  if (hit === null) {
    return `<div aria-hidden="true" style="pointer-events:none;position:relative;width:0;height:0;"><span style="${seat}">${badge}</span></div>`;
  }
  return [
    '<div style="position:relative;width:0;height:0;">',
    /* 배지 히트에는 쉬는 그림자를 «안» 준다 — 그림자는 안쪽 20px 배지가 이미 갖고 있다(이중으로 주면 번진다).
       포커스 이중 링은 `globals.css` 의 `[data-strike-hit]:focus-visible` 이 진다 */
    `<span role="button" tabindex="0" data-strike-hit="${hit.id}" style="${seat}cursor:pointer;">`,
    badge,
    `<span class="sr-only">${hit.name}</span>`,
    "</span></div>",
  ].join("");
}

/** 항목 1개 — 도형(흰 casing 2겹) + 점 배지 + 이름 pill. 타일 색은 예측할 수 없으므로 흰 굵은 스트로크를
 *  아래 깔아 배경을 가정하지 않고 대비를 만든다(§54.7 · casing 가시성은 9/4 타일에서 실측한다) */
function drawFeature(
  maps: NaverMapsNamespace,
  map: NaverMap,
  feature: StrikeMapFeature,
  index: number,
): { overlays: NaverOverlay[]; hits: StrikeHitEntry[] } {
  const color = toneColor(feature.tone);
  const z = featureZIndex(feature, index);
  const casingZ = z - 1;
  const overlays: NaverOverlay[] = [];
  const hits: StrikeHitEntry[] = [];

  /* ★ 히트 규칙 한 줄(§54.18-1) — **«pill 이 있으면 pill, 없으면 기호»**. `roadview` 가 아니면 둘 다 `null` 이다.
     ⚠ 대오 4 · 무대 4 는 pill 이 있어도 `roadview` 가 없어 **안 눌린다** */
  const hit: StrikeHit | null =
    feature.roadview === true ? { id: feature.id, name: feature.legend } : null;
  const labelHit = feature.label !== null ? hit : null;
  const badgeHit = feature.label === null ? hit : null;

  if (feature.kind === "band") {
    const path = feature.polygon.map(([lat, lng]) => new maps.LatLng(lat, lng));
    overlays.push(
      new maps.Polygon({
        map,
        paths: [path],
        strokeColor: CASING,
        strokeWeight: SHAPE_STYLE.casingWeight,
        strokeOpacity: 1,
        fillColor: CASING,
        fillOpacity: 0,
        clickable: false,
        zIndex: casingZ,
      }),
      new maps.Polygon({
        map,
        paths: [path],
        strokeColor: color,
        strokeWeight: SHAPE_STYLE.strokeWeight,
        strokeOpacity: 1,
        strokeStyle: SHAPE_STYLE.strokeStyle,
        fillColor: color,
        fillOpacity: SHAPE_STYLE.bandFillOpacity,
        clickable: false,
        zIndex: z,
      }),
    );
  }

  if (feature.kind === "circle") {
    const center = new maps.LatLng(feature.center.lat, feature.center.lng);
    overlays.push(
      new maps.Circle({
        map,
        center,
        radius: feature.radiusMeters,
        strokeColor: CASING,
        strokeWeight: SHAPE_STYLE.casingWeight,
        strokeOpacity: 1,
        fillColor: CASING,
        fillOpacity: 0,
        clickable: false,
        zIndex: casingZ,
      }),
      new maps.Circle({
        map,
        center,
        radius: feature.radiusMeters,
        strokeColor: color,
        strokeWeight: SHAPE_STYLE.strokeWeight,
        strokeOpacity: 1,
        strokeStyle: SHAPE_STYLE.strokeStyle,
        fillColor: color,
        fillOpacity: SHAPE_STYLE.circleFillOpacity,
        clickable: false,
        zIndex: z,
      }),
    );
  }

  /* 점 배지 — `dots`(광화문역)는 «같은 기호를 두 번» 그린다(§54.16-10 · 범례 1행 · pill 1개 · 점 2개).
     ⚠ 두 점 사이에 선·도형을 긋지 마라 — «역이 도로를 가로지른다»가 된다 */
  const content =
    feature.symbol === "toilet" ? toiletBadgeHtml(badgeHit) : stationDotHtml(color);
  for (const point of featurePoints(feature)) {
    const marker = new maps.Marker({
      map,
      position: new maps.LatLng(point.lat, point.lng),
      /* ⚠ 히트일 때만 `clickable` 이다 — 그래야 **네이버가 «마커 클릭»과 «지도 클릭»을 스스로 가른다**.
         거리뷰 모드에서 배지를 눌렀을 때 «길을 눌러 이동»이 함께 발동하지 않는 것이 이 한 줄에 달려 있다 */
      clickable: badgeHit !== null,
      zIndex: z,
      icon: { content, anchor: new maps.Point(0, 0) },
    });
    overlays.push(marker);
    if (badgeHit !== null) hits.push({ id: badgeHit.id, marker });
  }

  if (feature.label !== null) {
    const at = featureLabelAnchor(feature);
    const marker = new maps.Marker({
      map,
      position: new maps.LatLng(at.lat, at.lng),
      clickable: labelHit !== null,
      zIndex: LABEL_Z_BASE + index,
      icon: {
        content: pillHtml({
          text: feature.label,
          placement: feature.placement,
          gap: labelGapOf(feature),
          color,
          hit: labelHit,
        }),
        anchor: new maps.Point(0, 0),
      },
    });
    overlays.push(marker);
    if (labelHit !== null) hits.push({ id: labelHit.id, marker });
  }

  return { overlays, hits };
}

/** 파노라마 안 위치 표식(와드)의 꼬리 길이(px).
 *  ★ **1단이면 된다** — 8/28 은 여러 지점을 «동시에» 띄워 3단(8·38·68)이 필요했지만 9/4 는 «연 지점 하나»뿐이라
 *  겹칠 상대가 없다(§54.18-4 (3)). ⚠ 단을 늘려 «다른 지점도 띄우자»로 가지 마라 — 대상 5개가 세종대로를 따라
 *  남북으로 늘어서 있어 로드뷰에서 **지평선 한 줄에 겹친다**(§58-6) */
const WARD_STEM_PX = 8;
/** 라벨(1000+)·거리뷰 표식(900)과 겨루지 않는다 — 와드는 «파노라마 안»이라 지도 z 축과 다른 세계다 */
const WARD_Z = 300;

/**
 * 와드 — **«지금 연 그 지점» 하나만** 띄운다(§58-6). 라벨은 **`legend` 의 «— » 앞부분**(신규 문자열 0).
 * ⚠ **범례 전문을 넣지 마라** — `nowrap` 한 줄이라 문장이 화면을 가로지른다.
 * ⚠ **「근사」를 여기 넣지 마라** — 시트에 이미 있다. **같은 화면에 두 번이면 §5.3 위반**이다.
 * ★ **대비**(§0.7 · §54.18-4 (3)): 파노라마는 **사진**이라 배경이 임의다(밝은 하늘과 어두운 그늘이 한 화면에 있다).
 *   **흰 casing 만으로는 밝은 하늘에서 흰 배지가 사라진다** → `#1a1a1a` **1px 외곽선**이 그것을 막는다.
 *   ⚠ `#1a1a1a` 는 **의미색이 아니라 중립색**이라 §2 «의미색 3종 상한»을 늘리지 않는다(지도 표식과 같은 쓰임).
 * ★ 테두리 **선종이 확신도**를 진다(역 `solid` · 화장실 `dashed`) — **지도의 기호와 로드뷰의 기호가 다르면
 *   대응이 끊긴다.** ⚠ 분기는 **`confidence` 데이터 축**으로. **`id` 비교 금지**(`strikeMap.ts` 머리 주석).
 */
function wardHtml(options: {
  name: string;
  color: string;
  dashed: boolean;
  mark: string;
}): string {
  const { name, color, dashed, mark } = options;
  return [
    '<div aria-hidden="true" style="pointer-events:none;transform:translate(-50%,-100%);white-space:nowrap;">',
    `<div style="display:inline-flex;align-items:center;gap:4px;background:${CASING};`,
    `border:2px ${dashed ? "dashed" : "solid"} ${color};border-radius:9999px;padding:3px 8px;`,
    `font-size:12px;font-weight:700;line-height:1.2;color:${color};`,
    `box-shadow:0 0 0 1px ${INK},0 2px 6px rgb(0 0 0 / .35);">`,
    mark,
    `<span>${name}</span>`,
    "</div>",
    `<div style="width:2px;height:${WARD_STEM_PX}px;background:${color};margin:0 auto;box-shadow:0 0 0 1px ${INK};"></div>`,
    "</div>",
  ].join("");
}

const SPOT_BOX = 88;
const SPOT_CONE_RADIUS = 44;
/** `getPov().fov` 를 못 읽었을 때만 쓰는 값 — 파노라마 생성 옵션의 `fov` 와 같다 */
const SPOT_CONE_FALLBACK_FOV = 100;

/** 위(진북)로 열린 부채꼴. SVG 는 y 가 아래로 커지므로 «위»는 `-cos` 다.
 *  ⚠ 반각이 180°를 넘으면 큰 호(`largeArc`)여야 한다 — 아니면 부채꼴이 «반대로 접힌 도형»이 된다 */
function spotConePath(halfDeg: number): string {
  const c = SPOT_BOX / 2;
  const rad = (halfDeg * Math.PI) / 180;
  const dx = SPOT_CONE_RADIUS * Math.sin(rad);
  const dy = SPOT_CONE_RADIUS * Math.cos(rad);
  const round = (n: number): string => n.toFixed(2);
  const largeArc = halfDeg > 90 ? 1 : 0;
  return [
    `M${round(c)} ${round(c)}`,
    `L${round(c - dx)} ${round(c - dy)}`,
    `A${SPOT_CONE_RADIUS} ${SPOT_CONE_RADIUS} 0 ${largeArc} 1 ${round(c + dx)} ${round(c - dy)}`,
    "Z",
  ].join(" ");
}

/** 파노라마 생성 — 던지면 `null` 을 돌려준다. 인증이 깨지면 생성이 네이버 코드 안에서 throw 하고 그 예외가
 *  effect 본문에서 올라가면 페이지가 통째로 죽는다(§54.10). 훅 밖 순수 함수라 판정은 «null 인가» 하나다 */
function createPanorama(
  maps: NaverMapsNamespace,
  Panorama: NonNullable<NaverMapsNamespace["Panorama"]>,
  node: HTMLElement,
  at: { lat: number; lng: number },
): NaverPanorama | null {
  try {
    return new Panorama(node, {
      position: new maps.LatLng(at.lat, at.lng),
      /* `pov.pan` 을 고정하지 않는다 — 조합원이 누른 임의 지점이라 고정값은 늘 틀리고, 생략하면 네이버가 촬영 진행 방향을 잡는다 */
      pov: { tilt: 0, fov: SPOT_CONE_FALLBACK_FOV },
      logoControl: true,
      zoomControl: true,
      aroundControl: false,
      /* `flightSpot` = 주변 항공뷰 아이콘(공식 문서 표현 · «이동 기능이 아니다»). 좁은 시트에서 오탭이 잦아 끈다 */
      flightSpot: false,
      minScale: 0,
      maxScale: 4,
    });
  } catch {
    return null;
  }
}

/**
 * 지도 안 컨트롤 — 남색 면 + 흰 글자(11.37). ⚠ 반투명 금지(지도 배경이 매 프레임 바뀌어 대비를 보장할 수 없다) ·
 * `h-11` 금지(글자 75% 에서 33px 로 줄어든다 — `h-[44px]` 다).
 * ★ 포커스 링은 `-outline-offset-3`, 즉 border-box **«안쪽»**이고 링 «색»을 면과 반대로 둔다(OFF 흰 링 · ON 남색
 *   링 — 둘 다 11.37). 안쪽이어야 배경이 «우리 면»이라 대비표를 만들 수 있다. 바깥 링은 ① `MapControlStack` 의
 *   `overflow-hidden` 이 잘랐고 ② 잘리기 전에도 가로 두 변이 이웃 버튼 위(1:1)라 링으로 읽히지 않았다.
 *   **종전 결론 «바깥»은 죽었다. 인용하지 마라**(§54.17-1 · 값 확인 QA-531 · `overflow-hidden` 유지 QA-532).
 */
const MAP_CTRL_BASE =
  "ease-out-soft flex h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap px-3 text-[13px] font-bold transition-opacity duration-150 hover:opacity-85 focus-visible:outline-3 focus-visible:-outline-offset-3";
const MAP_CTRL_CLASS = `${MAP_CTRL_BASE} bg-primary text-white focus-visible:outline-white disabled:bg-surface disabled:text-ink-muted`;
const MAP_CTRL_ON_CLASS = `${MAP_CTRL_BASE} bg-bg text-primary focus-visible:outline-primary`;

/** 컨트롤 묶음. ⚠ 아래 두 모서리에 두지 마라 — 축척 바·`© NAVER Corp.` 가 이미 쓴다 */
function MapControlStack({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-card shadow-card absolute top-3 z-10 flex w-fit flex-col divide-y divide-white/25 overflow-hidden ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {children}
    </div>
  );
}

/** 확대·축소 — `keyboardShortcuts: false` 라 «키보드 사용자의 유일한 확대 경로»다. ⚠ `+`·`−` 는 SVG 다(서체 편차).
 *  ⚠⚠ 조건부로 숨기지 마라 — §54.16-3 의 «겹치면 확대하면 된다» 완화가 이 버튼이 보인다는 데 의존한다 */
function ZoomButtons({
  zoom,
  onZoom,
}: {
  zoom: number | null;
  onZoom: (delta: number) => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="확대"
        title="확대"
        onClick={() => onZoom(1)}
        disabled={zoom !== null && zoom >= STRIKE_MAP_MAX_ZOOM}
        className={MAP_CTRL_CLASS}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="축소"
        title="축소"
        onClick={() => onZoom(-1)}
        disabled={zoom !== null && zoom <= STRIKE_MAP_MIN_ZOOM}
        className={MAP_CTRL_CLASS}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            d="M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M3.6 12a8.4 8.4 0 1 0 2.7-6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M3.2 3.8v5.4h5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 팝업 안 버튼 — 좁은 면 판. ⚠ **`min-h-touch`(44)를 줄이지 마라** — 24 예외는 **지도 마커 한정**이다
 *  (`HIT_MIN_PX` 근거표). 팝업 버튼은 캔버스 «위»에 뜨지만 좌표에 묶여 있지 않아 간격 제약이 없다 */
const POPUP_BUTTON_CLASS =
  "ease-out-soft inline-flex min-h-touch shrink-0 items-center justify-center whitespace-nowrap rounded-full border-2 border-primary bg-bg px-4 text-caption font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/**
 * 지점 팝업 — **지도 박스 «안» 고정 패널**(§54.18-3). 8/28 이 세운 형태를 승계한다.
 * ⚠⚠ **말풍선·`InfoWindow` 로 만들지 마라** — 위치를 «계산»으로 풀면 **드래그할 때 팝업이 마커를 따라
 *   박스 밖으로 나간다.** 9/4 는 드래그·확대를 열어 뒀다(M-14) — 고정 패널은 **가로 잘림이 계산이 아니라
 *   «구조»로 0** 이다. ⚠ **전체 화면 모달로 만들지 마라** — 지도와 팝업이 함께 보여야 대응이 성립한다.
 * ★ **최대 높이는 박스의 50%** 다 — 넘치면 **패널이 스크롤한다. 지도를 줄이지 마라**(§54.18-3 (1)).
 *   그래야 팝업이 열린 채로도 **드래그할 절반이 언제나 남는다.**
 *
 * 문면(§58-5 확정) — **`legend` 파생 · 신규 문자열 0**:
 * ⚠ **제목 줄을 만들지 마라** — 9/4 는 번호가 0 이고(§54.16-12) **화장실 3은 `label: null`** 이다.
 *   `label` 을 채우면 **지도에 pill 이 생긴다**(pill 10개 상한 · §54.5-3).
 * ⚠ **`popupNote`(거리 rows)를 가져오지 마라** — 8/28 은 «실제로 «잰» 값»만 쓴다는 계약이고
 *   **9/4 는 잰 거리가 0** 이며 거리 문구는 §53-15 가 금지한다.
 * ⚠ **접근성 이름을 `aria-label` 로 만들지 마라** — `legend` 문면이 진다(`union-webapp-dev` §8).
 */
function StrikeMapPopup({
  feature,
  side,
  onRoadview,
  onClose,
}: {
  feature: StrikeMapFeature;
  side: "top" | "bottom";
  /** 이 지점의 거리뷰를 연다. `null` 이면 버튼을 렌더하지 않는다(파노라마 모듈 미로드 — 죽은 어포던스 금지) */
  onRoadview: (() => void) | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* 열리면 **팝업으로 포커스를 옮긴다**(되돌리기는 호출부). 안 옮기면 다른 지점으로 «교체»될 때 낭독이
     일어나지 않는다. 의존성이 `feature.id` 인 이유가 그 «교체»다 */
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [feature.id]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`rounded-card shadow-card absolute inset-x-3 z-20 max-h-[50%] overflow-y-auto border-2 border-border-strong bg-bg p-3 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary ${
        side === "top" ? "top-3" : "bottom-3"
      }`}
    >
      <p className="break-keep break-words text-caption leading-[1.55] text-ink">
        {feature.legend}
      </p>
      {/* ★ **`confidence` 축으로만 분기한다** — `id === "toilet-north"` 류 분기를 만들면 **역에 붙을 길이 생긴다.**
          `verified` 좌표를 「근사」라 말하는 것은 거짓이다(§58-3). ⚠ `ink-muted` 로 흐리지 마라 */}
      {feature.confidence === "estimated" ? (
        <p className="mt-1.5 break-keep break-words text-caption leading-[1.55] text-ink">
          {APPROX_NOTE}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        {/* ⚠ 낱말은 **`거리뷰 보기`** 다(§55-4 통일) — 8/28 의 `로드뷰 보기` 를 복사하지 마라 */}
        {onRoadview !== null ? (
          <button type="button" onClick={onRoadview} className={POPUP_BUTTON_CLASS}>
            거리뷰 보기
          </button>
        ) : null}
        <button type="button" onClick={onClose} className={POPUP_BUTTON_CLASS}>
          닫기
        </button>
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 대체면. ⚠⚠ 8/28 `RallyMapFallback` 3줄을 복제하면 «여의도»를 안내한다(§53-12 #13).
 *  ⚠ 이 면은 **`absolute inset-0` 래퍼 «안»에서만** 보인다 — 호출부 주석 참조. 래퍼를 빼면 0px 가 된다 */
function StrikeMapFallback({ status }: { status: Exclude<MapStatus, "ready"> }) {
  return (
    <div className="rounded-card flex h-full flex-col items-center justify-center bg-surface px-5 py-6 text-center">
      <p className="break-keep break-words text-body font-semibold text-ink">
        {status === "failed" ? "지도를 불러오지 못했습니다." : "지도를 불러오는 중입니다."}
      </p>
      {/* ★ **`failed` 에서만** 둘째 줄이다 — 로딩은 곧 뜨므로 목록으로 보낼 이유가 없다.
          ⚠⚠ **「범례」라는 낱말을 쓰지 마라** — **화면에 그런 제목이 없다**(`figcaption` 목록에 헤딩이 0).
          조합원이 무엇을 찾아야 할지 모른다. **「아래 목록」이 «실제로 보이는 것»을 가리킨다.**
          ⚠ 이 줄이 «지도가 죽어도 위치 정보는 남는다»의 유일한 안내다. 지우지 마라 */}
      {status === "failed" ? (
        <p className="mt-1 break-keep break-words text-caption text-ink">
          무대·대오 위치는 아래 목록에 있습니다.
        </p>
      ) : null}
    </div>
  );
}

export function StrikeMap({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<MapStatus>("loading");
  const [zoom, setZoom] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  /** 스크립트에 파노라마 모듈이 없으면 **토글 버튼을 아예 렌더하지 않는다**(죽은 어포던스 금지) */
  const [panoSupported, setPanoSupported] = useState(false);

  const [streetMode, setStreetMode] = useState(false);
  /** 열린 거리뷰의 지점(`null` 이면 시트가 없다). ★ 초기 파노라마를 «우리가» 고르지 않는다 — 원문이 두 역을 대등
   *  하게 말해 하나를 고르면 «그쪽으로 오라»가 된다(§54.16-6 (2)). ⚠ `estimated` 좌표를 시작점으로 쓰지 마라 */
  const [streetAt, setStreetAt] = useState<{ lat: number; lng: number } | null>(null);
  /** 거리뷰를 **«지물에서» 열었을 때만** 채운다 — 파노라마 와드와 시트 「근사」 줄이 여기서 나온다.
   *  ⚠ 거리뷰 모드에서 «길을 눌러» 연 경우는 `null` 이다(가리킬 지물이 없다 — 와드도 근사 줄도 없다) */
  const [streetSpot, setStreetSpot] = useState<{
    at: StrikeLatLng;
    name: string;
    approximate: boolean;
    tone: StrikeMapTone;
    mark: string;
  } | null>(null);
  const [panoDate, setPanoDate] = useState("");
  const [panoStatus, setPanoStatus] = useState<StrikePanoStatus>("idle");
  const [spotAt, setSpotAt] = useState<{ lat: number; lng: number } | null>(null);
  const [spotPan, setSpotPan] = useState(0);
  const [spotFov, setSpotFov] = useState(SPOT_CONE_FALLBACK_FOV);
  /** 열린 팝업 — **한 번에 하나**(§54.18-3 (3)). ★ **«누른 그 점»을 함께 들고 있는다**(§58-4):
   *  `feature` 만 두면 광화문역에서 **어느 점인지 잃는다**. 기본은 **전부 닫힘**(자동 열림 금지) */
  const [popup, setPopup] = useState<{
    feature: StrikeMapFeature;
    at: StrikeLatLng;
    side: "top" | "bottom";
  } | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  const hitsRef = useRef<StrikeHitEntry[]>([]);
  /** 열린 팝업의 id — `selectFeature` 가 «같은 것을 다시 누르면 닫는다»를 판정할 때 쓴다.
   *  상태를 클로저로 읽으면 옛 값을 본다(`useCallback([])`) */
  const popupIdRef = useRef<string | null>(null);
  /** 거리뷰를 «어느 마커에서» 열었나 — 닫을 때 포커스를 그리로 되돌린다. `null` 이면 거리뷰 토글로 */
  const streetOriginRef = useRef<string | null>(null);
  const boundsRef = useRef<NaverLatLngBounds | null>(null);
  const panoMountRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<NaverPanorama | null>(null);
  const streetButtonRef = useRef<HTMLButtonElement | null>(null);

  const syncLabelWidth = useCallback(() => {
    const box = boxRef.current;
    if (box === null) return;
    box.style.setProperty(
      LABEL_MAX_WIDTH_VAR,
      `${Math.round(box.clientWidth * LABEL_MAX_WIDTH_RATIO)}px`,
    );
  }, []);

  const fit = useCallback((maps: NaverMapsNamespace, map: NaverMap) => {
    const bounds =
      boundsRef.current ??
      (() => {
        const created = new maps.LatLngBounds(
          new maps.LatLng(STRIKE_MAP_FIT_BOUNDS.south, STRIKE_MAP_FIT_BOUNDS.west),
          new maps.LatLng(STRIKE_MAP_FIT_BOUNDS.north, STRIKE_MAP_FIT_BOUNDS.east),
        );
        boundsRef.current = created;
        return created;
      })();
    map.fitBounds(bounds, FIT_PADDING);
    /* ⚠ 여기서 줌 상한을 걸지 마라 — 근거는 `FIT_PADDING` 주석 */
    setMoved(false);
  }, []);

  const build = useCallback(() => {
    const maps = window.naver?.maps;
    const node = mountRef.current;
    if (maps === undefined || node === null) {
      setStatus("failed");
      return;
    }
    if (mapRef.current !== null) return;

    syncLabelWidth();

    /*
     * 조작 계약(§54.16-1 · M-14) — 죽은 절 §54.3 «움직이지 않는 지도»를 «8/28처럼 드래그·확대»로
     * 뒤집은 결과다(근거가 틀려서가 아니라 사용자가 위험을 고지받고 택했다). 딸려 온 제약:
     * `touch-action: none` 이라 지도 «위»에서 페이지가 안 내려간다 → 완화는 지도 «위» 안내 문구
     * (`MAP_GESTURE_NOTE`)가 진다. 둘은 한 쌍이다.
     * ⚠ 휠 줌·키보드 이동은 열지 않는다(페이지 스크롤을 빼앗는다 · 키보드 경로는 범례 13행) ·
     *   `logoControl`·`mapDataControl` 을 끄지 마라(네이버 이용약관상 출처·로고 표기 필수).
     */
    let map: NaverMap;
    try {
      map = new maps.Map(node, {
        mapTypeId: maps.MapTypeId.NORMAL,
        draggable: true,
        pinchZoom: true,
        scrollWheel: false,
        keyboardShortcuts: false,
        disableDoubleClickZoom: false,
        disableDoubleTapZoom: false,
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: true,
        center: new maps.LatLng(STRIKE_MAP_FIT_BOUNDS.south, STRIKE_MAP_FIT_BOUNDS.west),
        zoom: STRIKE_MAP_MIN_ZOOM,
        minZoom: STRIKE_MAP_MIN_ZOOM,
        maxZoom: STRIKE_MAP_MAX_ZOOM,
      });
    } catch {
      /* 인증이 이미 깨진 채로 생성이 실패할 수 있다 — 대체면으로 떨어뜨리고 페이지는 지킨다(§54.10) */
      setStatus("failed");
      return;
    }
    mapRef.current = map;

    /* 네이버가 붙이는 `tabindex="0"` 을 뗀다 — `keyboardShortcuts: false` 라 할 일이 없는 빈 정지점이다. ⚠ 대신
       `aria-hidden` 을 걸지 마라 — 안의 네이버 로고·저작권 링크가 «숨겨진 영역의 포커스 가능 요소»가 된다(§54.2) */
    node.removeAttribute("tabindex");

    const overlays: NaverOverlay[] = [];
    const hits: StrikeHitEntry[] = [];
    /* ⚠⚠ 도형·마커 «생성»도 감싼다 — 인증이 깨지면 `new maps.Polygon/Circle/Marker` 가 throw 하고,
       이 함수는 **effect 본문과 `<Script onLoad>` 에서 불리므로 예외가 그대로 올라가 트리가 통째로 날아간다**
       (§54.10 과 «같은 기전». 정리 쪽만 `safely()` 였다 · QA F-C 계열).
       ⚠ 이미 만든 것은 `overlaysRef` 에 남겨 정리 대상으로 둔다 — 안 남기면 «떠도는 오버레이»가 된다 */
    try {
      STRIKE_MAP_FEATURES.forEach((feature, index) => {
        const drawn = drawFeature(maps, map, feature, index);
        overlays.push(...drawn.overlays);
        hits.push(...drawn.hits);
      });
    } catch {
      overlaysRef.current = overlays;
      hitsRef.current = hits;
      setStatus("failed");
      return;
    }
    overlaysRef.current = overlays;
    hitsRef.current = hits;

    fit(maps, map);
    setZoom(map.getZoom());
    setStatus("ready");
  }, [fit, syncLabelWidth]);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (map === null) return;
    const next = Math.max(
      STRIKE_MAP_MIN_ZOOM,
      Math.min(STRIKE_MAP_MAX_ZOOM, map.getZoom() + delta),
    );
    if (next === map.getZoom()) return;
    map.setZoom(next, !prefersReducedMotion());
  }, []);

  const resetView = useCallback(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null) return;
    fit(maps, map);
    setZoom(map.getZoom());
  }, [fit]);

  /** 히트를 눌렀을 때의 화면 자리 — **세로만 정한다**(§54.18-3 (1) · 가로는 박스에 고정이라 계산할 것이 없다).
   *  마커가 박스 위쪽이면 팝업은 아래로 붙어 **가리키는 대상을 덮지 않는다.**
   *  ⚠ 지리 좌표로 추정하지 마라 — **렌더된 DOM 에서 읽는다** */
  const popupSideOf = useCallback((id: string): "top" | "bottom" => {
    const el = mountRef.current?.querySelector<HTMLElement>(`[data-strike-hit="${id}"]`) ?? null;
    const box = boxRef.current;
    if (el === null || box === null) return "bottom";
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 - b.top < b.height / 2 ? "bottom" : "top";
  }, []);

  /** 팝업을 연 마커로 포커스를 되돌린다 — 없으면(재그리기·화면 밖) 아무것도 하지 않는다 */
  const focusHit = useCallback((id: string): void => {
    mountRef.current
      ?.querySelector<HTMLElement>(`[data-strike-hit="${id}"]`)
      ?.focus({ preventScroll: true });
  }, []);

  /** 팝업 열기/닫기 — **한 번에 하나만.** 같은 항목을 다시 누르면 닫힌다(토글).
   *  ⚠ `roadview` 가 아닌 항목이 들어오면 **아무 일도 하지 않는다** — 대오·무대에 팝업이 열리는 길을 막는다 */
  const selectFeature = useCallback(
    (id: string | null) => {
      const next =
        id === null || popupIdRef.current === id
          ? null
          : (() => {
              const feature = STRIKE_MAP_FEATURES.find((f) => f.id === id);
              if (feature === undefined) return null;
              const at = featureRoadviewPoint(feature);
              if (at === null) return null;
              return { feature, at, side: popupSideOf(id) };
            })();
      popupIdRef.current = next?.feature.id ?? null;
      setPopup(next);
    },
    [popupSideOf],
  );

  /** 시트를 닫는다. **거리뷰 모드도 함께 끈다** — 길만 남으면 눌러도 열 것이 없다 */
  const closeStreetView = useCallback(() => {
    setStreetAt(null);
    setStreetSpot(null);
    setSpotAt(null);
    setStreetMode(false);
    setPanoDate("");
    setPanoStatus("idle");
    /* 지물에서 열었으면 **그 마커로** 돌려준다 — 토글로 보내면 조합원이 «어디를 보고 있었는지»를 잃는다 */
    const origin = streetOriginRef.current;
    streetOriginRef.current = null;
    if (origin !== null) focusHit(origin);
    else streetButtonRef.current?.focus({ preventScroll: true });
  }, [focusHit]);

  const toggleStreetMode = useCallback(() => {
    /* ⚠ 팝업을 함께 닫는다 — 팝업과 시트가 «동시에» 뜨면 지도가 두 겹으로 덮인다(§25.7) */
    selectFeature(null);
    setStreetMode((on) => {
      if (on) {
        setStreetAt(null);
        setStreetSpot(null);
        setSpotAt(null);
        setPanoDate("");
        setPanoStatus("idle");
      }
      return !on;
    });
  }, [selectFeature]);

  /** 팝업의 「거리뷰 보기」 — **«누른 그 점»에서 연다**(§58-4).
   *  ⚠⚠ **광화문역 두 점의 중점에서 열지 마라** — 도로 노면 한가운데다(판정은 `featureRoadviewPoint`).
   *  ⚠⚠ **팝업을 함께 닫는다**(§25.7) — 안 닫으면 지도가 **두 겹**으로 덮인다. 그리고 「근사」 한 줄이
   *    팝업에서 사라지므로 **시트가 그 문장을 이어받아야 한다**(§58-2 — 두 자리가 한 쌍이다) */
  const openRoadviewHere = useCallback(() => {
    const open = popup;
    if (open === null) return;
    streetOriginRef.current = open.feature.id;
    setStreetAt(open.at);
    setSpotAt(open.at);
    setStreetSpot({
      at: open.at,
      name: featureShortName(open.feature),
      approximate: open.feature.confidence === "estimated",
      tone: open.feature.tone,
      mark:
        open.feature.symbol === undefined
          ? `<span>${open.feature.glyph}</span>`
          : symbolSvg(open.feature.symbol, 13),
    });
    setStreetMode(true);
    setPanoDate("");
    selectFeature(null);
  }, [popup, selectFeature]);

  /* 인증 실패는 스크립트가 이 전역 콜백으로 알린다 — 등록하지 않으면 Client ID 가 틀렸을 때 빈 지도가 남는다(가짜 동작 금지) */
  useEffect(() => {
    window.navermap_authFailure = () => setStatus("failed");
    return () => {
      delete window.navermap_authFailure;
    };
  }, []);

  /* 스크립트가 이미 로드된 채 마운트되면(뒤로가기 등) `onLoad` 가 오지 않으므로 여기서 만든다.
     ⚠ 생성과 정리를 «같은 effect 에» 두어라 — 분리하면 StrictMode 재마운트에서 파괴만 되고 빈 박스가 남는다(§54.2) */
  useEffect(() => {
    /* ⚠ 이 규칙을 여기서만 끄는 근거: 렌더 상태 파생이 아니라 «외부 스크립트가 이미 로드됐는가»를 마운트 시점에
       «표본»으로 읽는 자리다(없으면 뒤로가기 진입에서 지도가 안 그려진다). ⚠ rAF 로 미루지 마라 — «빈 박스»가 되살아난다 */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.naver?.maps !== undefined) build();
    return () => {
      for (const overlay of overlaysRef.current) {
        safely(() => overlay.setMap(null));
      }
      overlaysRef.current = [];
      hitsRef.current = [];
      const map = mapRef.current;
      mapRef.current = null;
      boundsRef.current = null;
      safely(() => map?.destroy());
    };
  }, [build]);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("failed"), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  /* 상자 폭이 바뀌면 재적합(고정 zoom 을 안 쓰는 대신 이 관측이 필수다).
     ⚠⚠ 감시 대상은 «마운트 노드»가 아니라 «부모(상자)»다 — 네이버가 마운트 요소에 인라인 px 를 박아 그 크기가
     우리 CSS 가 아니라 위젯 소관이므로 마운트 노드에 걸면 «영영 울리지 않는다»(§54.14 #505 · `union-webapp-dev` §7).
     ★ 같은 이유로 **크기를 알려 줄 때도 «상자» 치수를 쓴다** — 마운트 노드의 `clientWidth` 는 네이버가 박아 둔
       «옛 px» 이라 그것을 읽으면 자기가 쓴 값을 자기에게 되돌려 주는 꼴이 된다. */
  useEffect(() => {
    const box = boxRef.current;
    if (box === null || status !== "ready") return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const maps = window.naver?.maps;
        const map = mapRef.current;
        if (maps === undefined || map === null) return;
        syncLabelWidth();
        /*
         * ★★ `fit()` **«앞»** 에 지도에 «새 크기»를 알린다(QA F-B).
         * 네이버 지도는 **`window.resize` 만 듣는다** — 뷰포트는 그대로인데 **상자만** 줄면(글자 크기 200% 등)
         * 지도는 **옛 크기를 계속 믿고** `fitBounds` 가 그 값으로 계산해 **마커가 한 픽셀도 안 움직인다.**
         * ⚠⚠ **`map.refresh()` 로 대체하지 마라 — 실측으로 안 고쳐진다**(상자 300×375 인데 `getSize()` 는
         *   336×420 그대로). `refresh()` 는 **투영·타일**을 다시 보는 것이지 컨테이너를 재는 것이 아니다.
         *   ⚠ `Event.trigger(map,"resize")` 는 듣긴 하지만 **«이벤트 이름» 계약**이라 조용히 끊길 수 있다 —
         *     `setSize` 는 **우리가 «잰 값»을 넘기는 메서드 계약**이고 파노라마 쪽과 **같은 패턴**이다.
         * ★ **참값 판정은 «마커가 움직이는가»** 다. `--strike-label-max` 가 바뀌는 것은
         *   «RO 가 울렸다»의 증거일 뿐 «재적합이 됐다»가 아니다(§5.8.4 ③ 프록시 금지).
         */
        safely(() => map.setSize(new maps.Size(box.clientWidth, box.clientHeight)));
        safely(() => fit(maps, map));
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(box);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fit, status, syncLabelWidth]);

  /* ★ 파노라마 서브모듈은 본 스크립트 `onLoad` «이후»에 도착해 그 시점 `maps.Panorama` 가 아직 `undefined` 다 —
     도착까지 짧게 재확인하고 시한을 넘기면 «미지원»으로 확정한다. ⚠ `build()` 안의 1회 확인으로 되돌리지 마라(거리뷰가 통째로 사라진다).
     ⚠ 첫 확인의 `setTimeout(…, 0)` 을 직접 호출로 «펴지» 마라 — effect 본문에서 곧바로 `setState` 하면 캐스케이딩 렌더다 */
  useEffect(() => {
    if (status !== "ready") return;
    let timer = 0;
    const deadline = Date.now() + LOAD_TIMEOUT_MS;
    const check = () => {
      if (window.naver?.maps?.Panorama !== undefined) {
        setPanoSupported(true);
        return;
      }
      if (Date.now() >= deadline) return;
      timer = window.setTimeout(check, 200);
    };
    timer = window.setTimeout(check, 0);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || status !== "ready") return;
    const onZoom = () => {
      setZoom(map.getZoom());
      setMoved(true);
    };
    const onDrag = () => setMoved(true);
    const listeners: NaverMapEventListener[] = [
      map.addListener("zoom_changed", onZoom),
      map.addListener("dragend", onDrag),
    ];
    return () => {
      for (const l of listeners) safely(() => maps.Event.removeListener(l));
    };
  }, [status]);

  /* 마커 히트 → 팝업 · 지도 빈 곳 클릭 → 닫기(§54.18-3 (3)).
     ★ **포인터 클릭은 «네이버 마커 이벤트»가 받는다** — 그래야 네이버가 «마커 클릭»과 «지도 클릭»을 스스로 갈라
       거리뷰 모드에서 배지를 눌렀을 때 «길을 눌러 이동»이 **함께 발동하지 않는다.**
     ⚠ DOM 클릭 위임으로 바꾸지 마라 — 네이버의 지도 클릭은 우리 리스너 «전»에 합성되므로 `stopPropagation`
       으로 못 막고, 팝업이 열리자마자 지도 클릭이 그것을 닫는다 */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || status !== "ready") return;
    const listeners: NaverMapEventListener[] = hitsRef.current.map((h) =>
      h.marker.addListener("click", () => selectFeature(h.id)),
    );
    listeners.push(map.addListener("click", () => selectFeature(null)));
    return () => {
      for (const l of listeners) safely(() => maps.Event.removeListener(l));
    };
  }, [selectFeature, status]);

  /* 키보드 — 마커는 `role="button"` 이라 Enter·Space 를 **우리가** 처리해야 한다.
     ⚠ 마커를 `<button>` 으로 만들어 «공짜»로 얻으려 하지 마라 — Enter 가 클릭 이벤트를 만들어
       위 네이버 마커 리스너와 **이중 발동**(열자마자 토글로 닫힘)한다.
     ★ 이것이 §55-7(«키보드 사용자가 거리뷰에 도달 못 할 수 있다»)을 부분 해소한다 — 마커가 탭 정지점이 된다 */
  useEffect(() => {
    const node = mountRef.current;
    if (node === null || status !== "ready") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target instanceof Element ? e.target : null;
      const id = target?.closest<HTMLElement>("[data-strike-hit]")?.dataset.strikeHit;
      if (id === undefined) return;
      /* Space 는 페이지를 스크롤한다 — 버튼 구실을 하려면 막아야 한다 */
      e.preventDefault();
      selectFeature(id);
    };
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [selectFeature, status]);

  /* 줌·팬 중에도 팝업은 **열린 채 유지**한다(박스 고정이라 흔들리지 않는다).
     다만 **연 마커가 화면 밖으로 나가면 닫는다** — 가리키는 대상이 없는 설명은 뜻이 없다(8/28 승계) */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || popup === null) return;
    const at = featureLabelAnchor(popup.feature);
    const check = () => {
      if (!map.getBounds().hasLatLng(new maps.LatLng(at.lat, at.lng))) selectFeature(null);
    };
    const listener = map.addListener("idle", check);
    return () => safely(() => maps.Event.removeListener(listener));
  }, [popup, selectFeature]);

  /* `Esc` 로 팝업을 닫는다. ⚠ **`document` 레벨이어야 한다** — 팝업에 포커스 트랩이 없어 다른 곳을 누르면
     포커스가 팝업 밖으로 나가는데 그때도 닫혀야 한다. ★ 시트 `Esc` 와 겹치지 않는다 — 팝업이 열려 있으면
     시트는 닫혀 있다(「거리뷰 보기」가 팝업을 함께 닫는다 · §25.7) */
  useEffect(() => {
    if (popup === null) return;
    const openId = popup.feature.id;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      selectFeature(null);
      focusHit(openId);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusHit, popup, selectFeature]);

  /* 거리뷰 모드 — 길 레이어를 깔고 «클릭으로 위치를 정한다»(`StreetLayer` 는 타일 오버레이라 지도 클릭을 가로채지 않는다).
     ⚠ `maps.StreetLayer` 가 없어도 클릭 이동은 남아야 하니 레이어와 클릭 리스너를 한 조건으로 묶지 마라(QA-516).
     ⚠ `status` 를 의존성에서 빼지 마라(길이 안 깔린다) */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || status !== "ready" || !streetMode) return;

    /* ⚠ 생성도 감싼다 — 존재 검사를 통과해도 인증이 깨진 뒤에는 생성자가 throw 하고, 그 예외가 effect 본문에서
       올라가면 페이지가 통째로 죽는다(§54.10 · QA F-C 계열). 길이 안 깔려도 **클릭 이동은 남아야 한다**(QA-516) —
       그래서 아래 클릭 리스너는 이 `try` **밖**이다. 한 조건으로 묶지 마라 */
    let layer: NaverOverlay | null = null;
    try {
      if (maps.StreetLayer !== undefined) {
        layer = new maps.StreetLayer();
        layer.setMap(map);
      }
    } catch {
      layer = null;
    }

    const listener = map.addListener("click", (payload?: unknown) => {
      /* 네이버 클릭 이벤트는 `{ coord }` 를 준다 — 타입 선언에 없으므로 여기서 좁힌다 */
      const coord = (payload as { coord?: { lat(): number; lng(): number } } | undefined)?.coord;
      if (coord === undefined) return;
      const lat = coord.lat();
      const lng = coord.lng();
      const pano = panoRef.current;
      if (pano !== null) {
        /* 이미 열려 있으면 인스턴스를 다시 만들지 않고 위치만 옮긴다 — 새로 만들면 시트가 깜빡이고 촬영일자가 잠깐 빈다 */
        safely(() => pano.setPosition(new maps.LatLng(lat, lng)));
      } else {
        setStreetAt({ lat, lng });
        setSpotAt({ lat, lng });
        setPanoDate("");
      }
    });

    return () => {
      safely(() => layer?.setMap(null));
      safely(() => maps.Event.removeListener(listener));
    };
  }, [status, streetMode]);

  /* 파노라마 인스턴스는 «시트가 열려 있는 동안만» 존재한다. ★ 실패해도 시트를 닫지 마라.
     ★ 문서에 없는 API 는 **`Marker({ map: panorama })` 하나**다(와드 · `FOLLOWUPS #12` 의 절반).
     ⚠ **`getProjection().fromOffsetToCoord`(바닥 탭 이동)는 여전히 «안 쓴다»** — 사용자가 요구하지 않았고
       이동은 **네이버 기본 화살표**가 진다. 이 페이지에서 그 이름을 찾다가 «누락»으로 보지 마라.
     ⚠⚠ 종전 주석의 *«두 API 를 하나도 쓰지 않는다»* 는 **죽었다. 인용하지 마라**(M-31 · §58-7) */
  useEffect(() => {
    if (streetAt === null) return;
    const maps = window.naver?.maps;
    const node = panoMountRef.current;
    const Panorama = maps?.Panorama;
    if (maps === undefined || node === null || Panorama === undefined) {
      setPanoStatus("failed");
      return;
    }

    const pano = createPanorama(maps, Panorama, node, streetAt);
    if (pano === null) {
      setPanoStatus("failed");
      return;
    }
    panoRef.current = pano;
    setPanoStatus("loading");

    /** 촬영 연월 — 메타에 있을 때만. **없으면 빈 문자열이다. 지어내지 마라** */
    const syncDate = () => {
      try {
        const loc = pano.getLocation?.();
        const raw = loc?.photodate ?? loc?.photoDate;
        if (raw === undefined || raw === null) return setPanoDate("");
        const digits = String(raw).replace(/\D/g, "");
        setPanoDate(digits.length >= 6 ? `촬영 ${digits.slice(0, 4)}.${digits.slice(4, 6)}` : "");
      } catch {
        setPanoDate("");
      }
    };

    /* ★★ 크기 감시는 «마운트 노드»가 아니라 «부모»에서 한다 — 네이버 파노라마가 마운트 요소에 인라인 px 를
       박기 때문에 그 노드를 감시하면 «영영 안 울린다»(`union-webapp-dev` §7).
       시트 높이 드래그·화면 회전·주소창 접힘을 «한 지점»에서 받는다 */
    const observed = node.parentElement;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      if (resizeFrame !== 0) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        if (observed === null) return;
        const rect = observed.getBoundingClientRect();
        /* 0 은 시트가 닫히는 중이라는 뜻 — 그 크기로 그리면 파노라마가 깨진 채 남는다 */
        if (rect.width <= 0 || rect.height <= 0) return;
        safely(() => pano.setSize?.(new maps.Size(rect.width, rect.height)));
      });
    });
    if (observed !== null) observer.observe(observed);

    /*
     * ★★ 와드(파노라마 안 «지금 연 그 지점» 표식) — **문서에 없는 API 다**(`Marker({ map: panorama })` ·
     *   `FOLLOWUPS #12` · `union-webapp-dev` §7). **기능 감지 + `try/catch` + 조용한 비활성**으로 감싼다.
     *   ⚠ **8/28 은 이 가드가 없다**(`RallyMap.tsx` 로드뷰 라벨). 여기서 감싸면 **미해결이 8/28 하나로 남는다** —
     *     확산을 «범위»로 막는 것이다. **이 `try/catch` 를 벗기지 마라.**
     *   ★ **없어지면 무엇이 남는가**: **거리뷰 자체는 그대로 열린다.** «어디인지»는 **범례 13행 · 지도 마커 ·
     *     지도 위 시선 부채꼴**이 진다. ⚠ **실패를 조합원에게 알리지 마라** — 없어진 것을 모르는 편이 낫다(오류가 아니다).
     * ⚠⚠ **`init` 직후에 만들면 `left:-9999px` 에 박혀 영영 안 보인다**(8/28 실측 · `setPov` 로도 안 풀린다) —
     *   **첫 `pano_changed` 뒤 한 틱**에 만든다. `setPanoId(같은 id)` 로 흔들지 마라(오히려 -9999 로 돌아간다).
     * ⚠ **«전부» 띄우지 마라** — 근거는 `wardHtml` 주석.
     * ★ 위치는 **파노라마 카메라가 아니라 «그 지물»**이다 — 카메라는 가장 가까운 촬영점으로 옮겨 가고,
     *   와드가 답하는 질문은 *«그래서 그것이 사진 속 어디인가»* 다.
     * ⚠ **시야 밖 «저 방향» 표시를 만들지 마라**(§54.18-4 (4)) — 화장실 좌표가 ±25 m 라 **방위 주장이 크게
     *   틀릴 수 있다.** 네이버가 시야 밖 마커를 치우는 거동을 그대로 둔다.
     */
    let ward: NaverMarker | null = null;
    let wardTimer = 0;
    let wardBuilt = false;
    const buildWard = () => {
      if (wardBuilt || streetSpot === null) return;
      wardBuilt = true;
      if (typeof maps.Marker !== "function") return;
      wardTimer = window.setTimeout(() => {
        try {
          ward = new maps.Marker({
            map: pano,
            position: new maps.LatLng(streetSpot.at.lat, streetSpot.at.lng),
            /* 눌러도 아무 일도 없어야 한다 — 와드는 «어디인지»만 말한다 */
            clickable: false,
            zIndex: WARD_Z,
            icon: {
              content: wardHtml({
                name: streetSpot.name,
                color: toneColor(streetSpot.tone),
                /* ★ 확신도 분기는 **`confidence` 축**이다(`approximate` 가 그 파생값) — `id` 비교 금지 */
                dashed: streetSpot.approximate,
                mark: streetSpot.mark,
              }),
              anchor: new maps.Point(0, 0),
            },
          });
        } catch {
          /* 조용한 비활성 — 거리뷰는 그대로 열려 있다 */
          ward = null;
        }
      }, 0);
    };

    const listeners: NaverMapEventListener[] = [
      pano.addListener("init", () => {
        setPanoStatus("idle");
        syncDate();
      }),
      /* 커버리지가 없는 지점 — **«실패»가 아니라 «없음»이다.** 문면이 갈린다(§55-6) */
      pano.addListener("pano_status", (payload?: unknown) => {
        const ok = maps.PanoramaStatus === undefined || payload === maps.PanoramaStatus.OK;
        if (!ok) setPanoStatus("empty");
      }),
      pano.addListener("pano_changed", () => {
        setPanoStatus("idle");
        syncDate();
        const p = pano.getPosition?.();
        if (p) setSpotAt({ lat: p.lat(), lng: p.lng() });
        buildWard();
      }),
      pano.addListener("pov_changed", () => {
        const pov = pano.getPov?.();
        if (pov) {
          setSpotPan(pov.pan ?? 0);
          /* `fov` 가 0·음수·비정상이면 부채꼴이 사라지거나 뒤집힌다 — 그때는 기본값을 쓴다 */
          const fov = pov.fov;
          setSpotFov(typeof fov === "number" && fov > 0 ? fov : SPOT_CONE_FALLBACK_FOV);
        }
      }),
    ];

    /* 파노라마가 없는 지점은 이벤트를 하나도 주지 않는 경우가 있어 시한을 함께 건다 */
    const timer = window.setTimeout(() => {
      let panoId: string | null = null;
      try {
        panoId = pano.getPanoId();
      } catch {
        setPanoStatus("failed");
        return;
      }
      if (panoId === null) setPanoStatus("empty");
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(wardTimer);
      if (resizeFrame !== 0) window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      for (const l of listeners) safely(() => maps.Event.removeListener(l));
      /* ⚠ 파노라마보다 «먼저» 뗀다 — `destroy()` 뒤에 남은 오버레이를 떼면 네이버 내부가 이미 비어 throw 한다 */
      safely(() => ward?.setMap(null));
      panoRef.current = null;
      /* ⚠ §54.10 — 인증이 깨진 뒤에는 이 호출이 throw 한다. 방어를 벗기지 마라 */
      safely(() => pano.destroy());
    };
    /* `streetAt` 이 바뀌면 새로 만든다(«처음 열렸다»는 뜻) — 이미 열린 뒤의 이동은 위 클릭 리스너가 `setPosition` 으로 처리한다.
       ⚠ `streetSpot` 은 `streetAt` 과 **언제나 함께** 세팅된다(`openRoadviewHere`·`closeStreetView`) — 파노라마가
         «와드 때문에» 다시 만들어지는 일은 없다. 한쪽만 바꾸는 호출부를 만들지 마라 */
  }, [streetAt, streetSpot]);

  /* 지도 위 «지금 보는 위치» 표식 — 점 + 시선 부채꼴. 모드가 꺼지면 함께 사라진다.
     ⚠ 색은 `#1a1a1a`(ink)다 — §54.7 이 «신규 색 0»을 못박았고 `#093389`·`#4b5563` 은 이미 뜻을 진 의미색이라
     여기 쓰면 «갈 곳»·«참고 지물»로 읽힌다. ⚠ `clickable: false` 를 바꾸지 마라 — 그 자리를 다시 못 누른다 */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || !streetMode || spotAt === null) return;

    /* ⚠⚠ **생성을 감싼다**(QA F-C 실측) — `maps.Marker` 가 없거나 인증이 깨진 뒤면 여기서 throw 하고,
       **effect 본문의 예외는 React 가 회복하지 못해 `main` 이 0개가 된다**(트리가 통째로 날아간다).
       §54.10(401 → 페이지 백지)과 **같은 기전**이고, 정리 쪽만 `safely()` 였다.
       ★ **표식만 생략한다 — 거리뷰 자체는 열려야 한다**(QA-546 · `union-webapp-dev` §7 «없어졌을 때 무엇이 남는가»).
       ⚠ **와드 쪽 가드만으로는 부족했다** — 이 effect 가 «먼저» 죽으면 그 가드가 무의미해진다 */
    let marker: NaverMarker | null = null;
    try {
      marker = new maps.Marker({
        map,
        position: new maps.LatLng(spotAt.lat, spotAt.lng),
        zIndex: SPOT_Z,
        clickable: false,
        icon: {
          content:
            `<div aria-hidden="true" style="width:${SPOT_BOX}px;height:${SPOT_BOX}px;position:relative;transform:rotate(${spotPan}deg)">` +
            `<svg viewBox="0 0 ${SPOT_BOX} ${SPOT_BOX}" width="${SPOT_BOX}" height="${SPOT_BOX}" ` +
            'style="position:absolute;inset:0;" aria-hidden="true" focusable="false">' +
            `<path d="${spotConePath(spotFov / 2)}" fill="rgba(26,26,26,.26)"/></svg>` +
            '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
            `width:16px;height:16px;border-radius:9999px;background:${INK};border:3px solid ${CASING};` +
            'box-shadow:0 2px 8px rgba(20,22,26,.45)"></div></div>',
          anchor: new maps.Point(SPOT_BOX / 2, SPOT_BOX / 2),
        },
      });
    } catch {
      /* 조용한 비활성 — 지도 위 «지금 보는 위치»만 사라지고 거리뷰는 그대로 열려 있다 */
      marker = null;
    }

    return () => {
      safely(() => marker?.setMap(null));
    };
  }, [spotAt, spotPan, spotFov, streetMode]);

  /* `Esc` 로 시트를 닫는다 — `<dialog showModal()>` 을 쓰지 않으므로 직접 진다(배경 `inert` 는 «지도를 눌러 위치를 옮긴다»는 계약을 죽인다) */
  useEffect(() => {
    if (streetAt === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeStreetView();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeStreetView, streetAt]);

  return (
    <>
      <Script
        /* `submodules=panorama` 가 없으면 `maps.Panorama`·`maps.StreetLayer` 가 아예 없고 거리뷰 토글이 렌더되지 않는다 */
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=panorama`}
        strategy="afterInteractive"
        onLoad={build}
        onError={() => setStatus("failed")}
      />

      <figure className="mt-6">
        <p className="sr-only">{MAP_SR_INTRO}</p>

        {/* 드래그 개방의 «유일한 실효 완화 수단»이다(§55-1 «강함»).
            ★ 지도 «위»다. 아래로 내리지 마라 — 지도가 화면 하단을 덮을수록 그 아래(범례 · 코스콤 한 줄 · 식순 · QR)는
            전부 화면 밖이라 «위험이 최대인 순간에 완화가 0» 이 된다.
            ⚠ 흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라 · `※` 를 붙이지 마라.
            ★★ 조작 어포던스(`MAP_AFFORDANCE_NOTE`)는 **이 문단 «안» 둘째 문장**이다(§59 · M-33).
            ⚠ **새 `<p>` 로 떼어내지 마라** — 지도 «위» 우리 문단이 3덩어리가 되면 «지도에 닿기 전에 읽어야 할 벽»이 된다.
            ⚠ **`<br>`·`block` span 으로 줄을 가르지도 마라** — 그러면 문단이 «안 나뉜 척하는 두 덩어리»가 된다.
            두 문장은 **한 흐름으로 이어 읽힌다**(사이는 공백 하나). */}
        <p className="mb-2 max-w-[var(--container-prose)] break-keep break-words text-caption font-semibold text-ink">
          {MAP_GESTURE_NOTE} {MAP_AFFORDANCE_NOTE}
        </p>

        {/* 확신도 키는 지도 «위»다(§54.16-1 방어 3) — 확대해도 상자 바로 위라 같은 화면에 남는다.
            ⚠ «옮긴» 것이지 «복제»가 아니다 — 화면 출현 1회. 2회면 실패다(§54.16-8 #511) */}
        <p className="mb-2 max-w-[var(--container-prose)] break-keep break-words text-caption text-ink">
          {LEGEND_KEY}
        </p>

        {/* 고정 종횡비 박스 — 실패·로딩에서도 높이가 같아 CLS 0.
            ★ `aspect-[4/5]` 는 초판 `3/5` 를 뒤집은 값이다(§54.16-2) — `3/5` 면 360×640 에서 지도 밖 빈 곳이
            12px 이라 완화 문구가 «거짓»이 된다(판정선 44px · §54.16-5). ⚠ 빈 곳이 44px 미만이면 «문장»이 아니라
            «종횡비»를 고쳐라 · `md:aspect-*` 분기 금지 · `max-w-[420px]` 유지(축척은 «세로»가 정한다) */}
        <div
          ref={boxRef}
          /* ⚠ `isolate` 를 빼지 마라 — 네이버 마커의 `z-index` 는 1000대인데 쌓임 맥락이 없으면 그 값이 문서
             최상위에서 경쟁해 마커 배지가 고정 헤더(z-200)를 뚫고 올라온다(8/28 실측) */
          className="rounded-card relative isolate aspect-[4/5] w-full max-w-[420px] overflow-hidden"
        >
          {/* `touchAction: "none"` 은 사용자 결정으로 열린 한 손가락 드래그의 «본체»다 — 위 완화 문구와
              한 쌍이다. 한쪽만 되돌리지 마라 */}
          <div ref={mountRef} className="size-full" style={{ touchAction: "none" }} />

          {status === "ready" ? (
            <>
              <MapControlStack side="left">
                <ZoomButtons zoom={zoom} onZoom={zoomBy} />
                {/* 드래그로 길을 잃었을 때 **유일한 복귀 경로**다. 움직였을 때만 나타난다. 지우지 마라 */}
                {moved ? (
                  <button
                    type="button"
                    aria-label="처음 위치로"
                    title="처음 위치로"
                    onClick={resetView}
                    className={MAP_CTRL_CLASS}
                  >
                    <ResetIcon />
                  </button>
                ) : null}
              </MapControlStack>

              {/* 파노라마 모듈이 없으면 버튼 자체를 렌더하지 않는다(죽은 어포던스 금지).
                  ⚠ «글자 버튼»이다 — 정사각 44px 로 못박으면 13px `거리뷰`(약 39px)가 두 줄로 깨진다 */}
              {panoSupported ? (
                <MapControlStack side="right">
                  <button
                    type="button"
                    ref={streetButtonRef}
                    aria-pressed={streetMode}
                    aria-label={streetMode ? "거리뷰 모드 끄기" : "거리뷰 모드 켜기"}
                    title={streetMode ? "거리뷰 모드 끄기" : "거리뷰 모드 켜기"}
                    onClick={toggleStreetMode}
                    className={streetMode ? MAP_CTRL_ON_CLASS : MAP_CTRL_CLASS}
                  >
                    거리뷰
                  </button>
                </MapControlStack>
              ) : null}
            </>
          ) : null}

          {/* 팝업 — 박스 «안»이라 **세로 예산 0**이고 CLS 도 0 이다. ⚠ 박스 «밖»으로 빼지 마라 */}
          {popup !== null ? (
            <StrikeMapPopup
              feature={popup.feature}
              side={popup.side}
              /* 파노라마 모듈이 없으면 버튼을 안 그린다 — 눌러도 아무 일 없는 죽은 어포던스를 두지 않는다 */
              onRoadview={panoSupported ? openRoadviewHere : null}
              onClose={() => {
                const openId = popup.feature.id;
                selectFeature(null);
                focusHit(openId);
              }}
            />
          ) : null}

          {/* ⚠⚠ **`absolute inset-0` 을 빼지 마라 — 빼면 이 면이 «0px» 만 보인다(실측).**
              앞 형제인 마운트 노드가 `size-full`(= 상자 높이 전부)이라 일반 흐름에서는 대체면이 **상자 바닥
              «아래»에서 시작**하고 `overflow-hidden` 이 통째로 자른다. 8/28 `RallyMap` 은 처음부터 이렇게 감쌌다.
              ★ 이것이 «실패했다»를 조합원에게 **말할 수 있는 유일한 자리**다 — 위 `build()` 의 실패 분기가
              이 면에 기댄다(안 보이면 «조용히 빈 상자»가 된다) */}
          {status !== "ready" ? (
            <div className="absolute inset-0">
              <StrikeMapFallback status={status} />
            </div>
          ) : null}
        </div>

        {/* 코스콤지부 대오 한 줄 — 자리는 `figure` «안» · 캔버스 «밖»이다(§53-15 조건 11 · 지도를 «본 뒤» 읽는다).
            ⚠⚠ 키가 없어 지도 섹션이 사라지면 이 문장도 함께 사라진다 — «의도된 상태»다. 위험(대오 4개를 보여
            준다)과 완화(넷 중 하나를 임의로 고르지 말라)가 같은 조건부 «안»에 있어야 한다. 밖으로 빼지 마라 */}
        <p className="mt-4 max-w-[var(--container-prose)] break-keep break-words text-caption text-ink">
          {KOSCOM_COLUMN_NOTE}
        </p>

        {/* 범례 13행 — 이 지도의 «텍스트 등가 전부»다. 행은 `STRIKE_MAP_FEATURES` 에서 파생된다.
            ⚠ 범례 행을 지우지 마라 — 줄이려면 «지도에서 뺀다»(§0.4 은폐 금지). 접지도 `sr-only` 로 돌리지도 마라.
            `<figure>` 의 «마지막 직계 자식»이어야 한다(HTML 스펙).
            ★ 행은 flex 아이템이라 `break-words` 가 «안 든다» — 200% 판정선은 «최장 어절 9자»다(§54.6-2).
            ⚠ `min-w-0`·`break-all` 로 «고치지» 마라(넘치지 않는다). 그렇다고 `break-words` 를 떼지도 마라 */}
        <figcaption className="mt-4 max-w-[var(--container-prose)]">
          <ul className="flex flex-col gap-2">
            {STRIKE_MAP_FEATURES.map((feature) => (
              <li
                key={feature.id}
                className="flex gap-2 break-keep break-words text-caption text-ink"
              >
                {/* ★ 지도 배지와 «같은 그림»이어야 한다(§54.14 #502 · `dangerouslySetInnerHTML` 대상은 우리 상수뿐).
                    ⚠ 기호로 확신도를 말하지 마라 — 확신도는 «선종»과 `LEGEND_KEY` 가 진다 */}
                {feature.symbol !== undefined ? (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-4 shrink-0"
                    dangerouslySetInnerHTML={{ __html: symbolSvg(feature.symbol, 16) }}
                  />
                ) : (
                  <span aria-hidden="true" className="shrink-0">
                    {feature.glyph}
                  </span>
                )}
                <span>{feature.legend}</span>
              </li>
            ))}
          </ul>
        </figcaption>
      </figure>

      {streetAt !== null ? (
        <StrikeRoadviewSheet
          panoDate={panoDate}
          panoStatus={panoStatus}
          /* ★ 「근사」 한 줄은 **`confidence` 축**으로만 붙는다 — 역에는 붙을 길이 구조적으로 없다(§58-3).
             ⚠ 팝업이 닫히면서 그 문장이 사라지므로 **시트가 이어받는다**(§58-2 — 두 자리가 한 쌍이다).
             ⚠ 거리뷰 «모드»에서 길을 눌러 연 경우는 `false` 다 — 가리키는 지물이 없어 근사를 말할 대상이 없다 */
          approximate={streetSpot?.approximate === true}
          mountRef={panoMountRef}
          onClose={closeStreetView}
        />
      ) : null}
    </>
  );
}
