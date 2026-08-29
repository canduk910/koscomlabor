"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KOSCOM_COLUMN_NOTE,
  LEGEND_KEY,
  MAP_GESTURE_NOTE,
  MAP_SR_INTRO,
  STRIKE_MAP_FEATURES,
  STRIKE_MAP_FIT_BOUNDS,
  STRIKE_MAP_MAX_ZOOM,
  STRIKE_MAP_MIN_ZOOM,
  featureLabelAnchor,
  featurePoints,
  labelGapOf,
} from "@/lib/strikeMap";
import type {
  StrikeLabelPlacement,
  StrikeMapFeature,
  StrikeMapTone,
} from "@/lib/strikeMap";
import type {
  NaverLatLngBounds,
  NaverMap,
  NaverMapEventListener,
  NaverMapsNamespace,
  NaverOverlay,
  NaverPanorama,
} from "@/lib/naverMaps";
import { StrikeRoadviewSheet } from "./StrikeRoadviewSheet";
import type { StrikePanoStatus } from "./StrikeRoadviewSheet";

/**
 * 9/4 총파업 **세종대로 안내지도** — 경량 컴포넌트(디자인 §54 · §54.16 · 검증 §53·§54·§55).
 *
 * ## ★★ `RallyMap.tsx`(4,353줄)를 복사하지 «않은» 이유 (M-5)
 *
 * 그 파일의 **대체면 3줄이 통짜 문자열**이다 — `국회의사당역 3번 출구 KDB산업은행 앞` ·
 * `코스콤지부 — 집회 3구역`. **키 실패 시 9/4 페이지가 «여의도»를 안내한다.**
 * 그리고 `FIT_PADDING`·`FIT_MAX_ZOOM`·종횡비가 **전부 여의도 기하에서 유도**됐는데
 * 9/4 콘텐츠는 **약 550 m × 95 m 세로 스트립**이라 상수를 새로 유도해야 한다.
 * → 승계한 것은 **패턴 8가지**뿐이다(§54.2): 로더 4중 실패 경로 · 생성·파괴 동일 effect ·
 *   `figure` 골격 · 마운트 노드 `aria-hidden` 금지 · `isolate` · 흰 casing 2겹 ·
 *   범례가 데이터 배열에서 파생 · pill 폭 상한 CSS 변수.
 *
 * ## 이 지도가 답하는 것 — **강조가 «없다»**
 *
 * 8/28 은 «우리 자리 하나»를 가리켰지만 **9/4 는 대오 4개를 대등하게** 그린다.
 * 그래서 «강조 하나»가 없고, 코스콤 대오가 확정되면 **해당 pill 의 면 반전 하나**로 2단계가 끝난다
 * (레이아웃 변경 0 · 도형 스타일 변경 0 — `strikeMap.ts` 머리 주석의 «2단계» 문단이 그 주소다).
 *
 * ## ★★ 401 이 페이지를 «통째로» 죽인다 — 정리 경로 방어가 필수다 (§54.10)
 *
 * 인증이 깨지면 `window.naver.maps` 는 **있지만 내부가 null** 이다. 그 상태에서 정리가
 * `overlay.setMap(null)`·`map.destroy()` 를 부르면 **네이버 코드 안에서 throw** 하고,
 * **passive unmount effect 에서 던진 예외는 React 가 회복하지 못해 트리 전체가 날아간다**
 * (재현: `main` 0개 · `body.innerText` = *"This page couldn't load"*).
 * → **이 파일의 정리 호출은 전부 `safely()` 를 통과한다. 벗기지 마라.**
 * → 그리고 그것이 **키 미설정 시 `<section>` 을 통째로 렌더하지 않는** 조건부(M-6)의 근거다 —
 *   «미확인 최악에 대한 보험»이 아니라 **«확인된 실패 모드에 대한 방화벽»**이다.
 */

type MapStatus = "loading" | "ready" | "failed";

/** onError 없이 매달리는 경우까지 실패로 확정한다(§54.2 패턴 1) */
const LOAD_TIMEOUT_MS = 8_000;
const RESIZE_DEBOUNCE_MS = 150;

/**
 * 초기 뷰 여백(px) — **여의도 값(52/20/76/32)을 쓰지 마라.**
 * 상하는 pill 한 줄(약 22px) + 여유이고, 좌우 24 는 pill 이 상자 밖으로 나가지 않게 하는 최소값이다.
 * ★ `top` 이 44 가 아니라 **48** 인 이유: 광화문역 pill 이 **두 점 «위»**에 서야 한다(§54.16-14 #22).
 *
 * ⚠⚠ **`fitBounds` 에 줌 상한(`FIT_MAX_ZOOM`)을 걸지 마라.** 8/28 에서 그 값이 **3왕복**했고,
 * 권고를 그대로 따랐으면 조합원이 확대를 못 하게 됐다.
 * **확대 상한은 «사용자 조작 상한»(`maxZoom`)이고 «정밀도 주장 방어»가 아니다 — 다른 계약이다.**
 * 정밀도 방어는 넷이 나눠 진다: ① 모든 줌에서 유지되는 `shortdot` ② 미터 반경이라 확대할수록
 * «범위»가 커 보이는 무대 원 ③ 지도 «위»의 `LEGEND_KEY` ④ 지도 아래 범례 13행.
 */
const FIT_PADDING = { top: 48, right: 24, bottom: 44, left: 24 } as const;

/** pill 폭 상한 = 상자 폭 × 0.7. 0폭 앵커 안에서는 `%` 가 해석되지 않아 px 로 확정해 내린다 */
const LABEL_MAX_WIDTH_RATIO = 0.7;
const LABEL_MAX_WIDTH_VAR = "--strike-label-max";

/**
 * ★★ **규칙: 지도 마커의 `zIndex` 는 «범례 행 순서»를 그대로 따른다. 뒤 행이 위다.** (QA F2 · §54.17-2)
 *
 * `STRIKE_MAP_FEATURES` 의 배열 순서 = 범례 13행 순서이고, **점 배지도 이름 pill 도 그 순서로 쌓인다.**
 * 그래서 **범례 11행(시청역 화장실) < 13행(시청역) → 역 점이 화장실 배지 «위»**다.
 *
 * ⚠⚠ **범례 행 순서를 바꾸면 z 순서가 «함께» 바뀐다. 둘은 한 쌍이다** — 검증이 문면 순서를 손대면
 *   지도의 가림 관계가 같이 움직인다. 특례(`id` 로 z 를 덮어쓰기)를 만들지 마라.
 *
 * **왜 «역이 위»가 맞는가**(우연이 아니라 판정이다):
 * 1. **위계가 맞다** — 역은 계약 ③(«어느 역에서 내려 어느 쪽으로 걷나»)이고 화장실은 «도착 후» 정보다.
 *    범례 행 순서가 이미 그 위계다.
 * 2. **확신도 손실이 작다** — 역 점(지름 12+링 3)이 위면 화장실 배지(20px)는 **면이 남고 테두리 일부만**
 *    가린다. 반대로 하면 **작은 역 점이 큰 배지 밑에 들어가 통째로 사라진다.**
 * 3. **규칙이 하나다** — 8/28 도 `zIndex: 200 + index` 로 배열 순서가 z 를 정했다.
 *
 * ⚠ 도형(원 20 · 밴드 25)은 이 규칙 «밖»이다 — 그쪽은 §54.5-2 가 «밴드가 원 위»로 따로 판정했다.
 */
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

/**
 * 도형 스타일 — **9/4 의 도형은 «전부» `estimated` 다**(§53-6 승격 근거 0 · 타입이 강제한다).
 * 그래서 **선종은 단일 `shortdot`** 이고, **구분은 색(`tone`)과 형태(띠/원)만이** 진다.
 *
 * ⚠ **`fillOpacity` 를 0.20 이상으로 올리지 마라** — 8/28 의 `verified`(0.20)와 같아져
 *   확신도 위계가 화면에서 무너지고 `LEGEND_KEY` 의 «옅은 면»이 거짓이 된다.
 * ⚠ **`estimated` 를 회색으로 바꾸지 마라**(M-2) — 회색은 참고 지물의 색이다.
 * ⚠ **테두리를 빼지 마라.** 면만으로는 WCAG 1.4.11(비텍스트 3:1)을 못 만든다(α 0.53 이 필요한데
 *   그 값은 위계를 뒤집는다). **3:1 은 테두리가 진다.**
 * ★ 8/28 `BAND_STYLE` 주석이 *«밴드가 2개 이상이 되면 이 판정으로 돌아와라»* 라고 했고
 *   **돌아와서 판정했다**(M-15): 9/4 네 밴드는 **22~75 m 떨어져 맞닿지 않아**
 *   «두 밴드 사이 경계선» 위험이 발생하지 않는다. **테두리 유지.**
 */
const SHAPE_STYLE = {
  strokeStyle: "shortdot",
  strokeWeight: 3,
  casingWeight: 7,
  /** 대오 띠 */
  bandFillOpacity: 0.14,
  /** 무대 원 — 띠보다 옅다. 원은 «이 안 어딘가»를 말하지 «여기 모인다»를 말하지 않는다 */
  circleFillOpacity: 0.1,
} as const;

/**
 * ⚠ **원(3,3)과 밴드(1,6)의 점선 «밀도»가 눈에 띄게 다르다.** 우리 코드는 **둘 다 위 `SHAPE_STYLE`
 * 하나**를 쓴다(`shortdot` · `strokeWeight: 3`) — 차이는 **네이버가 `Circle` 과 `Polygon` 을 다른 경로로
 * 그리는 산물**이다(QA 가 `_getDashStyle` 원본으로 둘 다 `shortdot` 임을 확정했다).
 *
 * ★ **확신도 차이가 «아니다».** 확신도 위계는 **«점선 ↔ 실선»의 대립**이 지는데 둘 다 점선이고,
 *   이 지도에 **실선 도형은 0개**다. 두 도형은 색·형태가 이미 다르다(회색 원 ↔ 파랑 띠).
 * ⚠⚠ **맞추려고 커스텀 대시 배열을 쓰지 마라** — 문서화된 API 가 아니고, **9/4 는 «문서 없는 API 0개»를
 *   판정으로 세웠다**(§54.16-6 (1) · `FOLLOWUPS #12` 확산 차단). 얻는 것(미관)과 잃는 것(계약)이
 *   비교가 안 된다. 근거: `02_designer_spec.md` §54.17-4.
 */
function featureZIndex(feature: StrikeMapFeature, index: number): number {
  switch (feature.kind) {
    case "circle":
      return 20;
    /* 밴드가 원 «위»에 그려진다 — 원은 회색·곡선, 밴드는 파랑·직선이라 두 축으로 갈린다 */
    case "band":
      return 25;
    /* ★ 점 배지는 «범례 행 순서»로 쌓인다 — 근거는 `MARKER_Z_BASE` 주석에 있다 */
    case "dot":
    case "dots":
      return MARKER_Z_BASE + index;
  }
}

/**
 * ★★ **정리(cleanup) 방어** — §54.10.
 *
 * 인증 실패 뒤 네이버 객체는 «있지만 내부가 null» 이라 `setMap(null)`·`destroy()` 가 throw 한다.
 * **passive unmount effect 의 예외는 React 가 회복하지 못해 트리 전체가 날아간다** —
 * 그러면 지도뿐 아니라 **개요·집결시간·식순이 함께 사라진다.**
 * **지도 실패가 페이지를 죽여서는 안 된다.** 이 함수를 벗기지 마라.
 */
function safely(run: () => void): void {
  try {
    run();
  } catch {
    /* 정리 실패는 조합원에게 보일 일이 아니다 — 문서에 남은 콘텐츠를 지키는 것이 우선이다 */
  }
}

/* ------------------------------------------------------------------ *
 * 기호 · 라벨 HTML — 네이버가 문자열로 주입한다
 * ------------------------------------------------------------------ */

const SYMBOL_MALE = "#1785DE";
const SYMBOL_FEMALE = "#F2492A";

/**
 * 화장실 픽토그램 — **8/28 `RallyMap.tsx` 의 `symbolSvg` 와 같은 도형**이다(§54.5-4 «8/28 SVG 승계»).
 *
 * ⚠ **이모지(`🚻`)가 아니라 SVG 인 이유**: 이모지는 플랫폼마다 완전히 다른 그림이고
 * 이모지 글꼴이 없는 환경에서는 **흑백 활자나 두부(□)로 떨어진다.** SVG 는 어디서나 같은 그림이다.
 * ⚠ **문자열 하나에서 나온다** — 지도 배지(네이버가 주입하는 raw HTML)와 범례(React)가
 * **같은 그림**이어야 대응이 성립한다(QA-502).
 * ⚠ **두 색은 의미색이 아니다**(§54.7 — 도형 전용 · UI 3:1 통과 · **텍스트에 쓰지 마라**).
 *
 * ★ **8/28 과 «두 벌»인 것을 알고 있다.** 공유 모듈로 뽑으려면 `RallyMap.tsx` 의 구조를 고쳐야 하고
 *   그 파일은 «고치지 마라» 규율이 두껍다(리더 승인 사항). **한쪽만 고치지 마라 — 그림이 갈린다.**
 */
function symbolSvg(kind: "toilet", size: number): string {
  if (kind !== "toilet") return "";
  return [
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" style="display:block;">`,
    /* 남 — 원 머리 + 몸통 + 다리 둘 */
    `<circle cx="7" cy="3.9" r="2.9" fill="${SYMBOL_MALE}"/>`,
    `<rect x="4.0" y="7.8" width="6.0" height="8.6" rx="0.9" fill="${SYMBOL_MALE}"/>`,
    `<rect x="4.5" y="16.2" width="2.2" height="4.9" rx="0.5" fill="${SYMBOL_MALE}"/>`,
    `<rect x="7.3" y="16.2" width="2.2" height="4.9" rx="0.5" fill="${SYMBOL_MALE}"/>`,
    /* 여 — 원 머리 + 치마(삼각) + 다리 둘 */
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
 * 지도 위 이름 pill — **10개뿐**이다(대오 4 · 무대 4 · 역 2).
 *
 * - 글자는 **불투명 흰 pill 위**에만 올린다 — 타일 위에 직접 얹으면 대비를 계산할 수 없다.
 *   대비는 `#093389` 11.37 / `#4b5563` 7.56 이고 **흰 배경이 그것을 만든다**(casing 이 아니라).
 * - `width:max-content` 가 없으면 안 된다 — 앵커가 **0폭 컨테이닝 블록**이라 절대배치 요소의
 *   가용폭이 0 으로 계산돼 라벨이 **min-content(글자 몇 개씩)로 접힌다.**
 * - 마커 DOM 전체에 `aria-hidden="true"` — 뜻은 **범례 13행이 문자로** 진다(§54.12).
 *
 * ⚠⚠ **폰트를 `rem` 으로 바꾸지 마라 — 여기만 고정 px 인 데는 이유가 있다**(§54.6-4).
 *   pill 은 **좌표에 묶인 위치 요소**라 루트 확대를 따르면 **가리키는 대상을 덮는다**
 *   (8/28 이 «pill 이 밴드의 62% 를 덮었다»로 겪은 실패이고, 확대는 그것을 «확실히» 만든다).
 *   **WCAG 1.4.4 는 «콘텐츠 손실 없이»를 요구하는데 콘텐츠는 범례에 있고 범례는 정상 확대된다** —
 *   캔버스 «밖»(헤딩·완화 안내·`LEGEND_KEY`·코스콤 한 줄·범례)은 전부 `rem` 이다.
 *   «대칭»을 이유로 이 값을 바꾸면 pill 이 도형을 덮는다.
 */
function pillHtml(options: {
  text: string;
  placement: StrikeLabelPlacement;
  gap: number;
  color: string;
}): string {
  const { text, placement, gap, color } = options;
  return [
    '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
    `<div style="position:absolute;${placeStyle(placement, gap)}box-sizing:border-box;`,
    `background:${CASING};border:1px solid ${color};border-radius:9999px;padding:2px 8px;`,
    `font-size:11px;font-weight:600;line-height:1.3;color:${color};`,
    "white-space:normal;word-break:keep-all;width:max-content;",
    `max-width:var(${LABEL_MAX_WIDTH_VAR},70%);box-shadow:0 1px 4px rgb(0 0 0 / .30);">`,
    text,
    "</div></div>",
  ].join("");
}

/**
 * 역 점 배지 — **지름 12px 채움 + 흰 링 3px**(§54.16-11 처방 A) + **흰 중심점**(처방 D).
 *
 * ★ 흰 링이 하는 일: **시청역 점이 대오 4 밴드 «안»에 들어간다**(C 안의 파생 결과 · 조건 17).
 *   링이 밴드 면과 점 사이에 **명시적 경계**를 만들어 «서로를 가린다»를 막는다 —
 *   점이 밴드 «위에 얹힌 층»으로 읽혀야 한다.
 * ★ 흰 중심점이 하는 일: `◉` 가 **«이것은 역 입구다»**를 말한다(§54.5-4). 무표시 점이면
 *   «지점»으로만 읽혀 밴드 안에서 *"여기 서라"* 로 오독될 여지가 남는다.
 * ⚠ **좌표를 옮겨 겹침을 풀지 마라** — 그 순간 `verified` 가 `estimated` 가 된다(M-19).
 *
 * ## ⚠⚠ 남는 위험 — **«확대»에 위임한다. 크기로 고치는 처방은 «없다»** (QA F3 · §54.17-3)
 *
 * 초기 뷰에서 대오 4 밴드 테두리가 가려진다 — **동쪽 32.6% · 서쪽 15.2%**(QA 실측).
 * ★ **종전의 «점 지름을 12 → 10px 로 줄여라» 처방은 죽었다. 되살리지 마라** —
 *   적용해도 **32.6% → 30.6%(2%p)** 다. **동쪽의 지배 기여자는 점(11.3px)이 아니라 «화장실 배지(24px)»** 이고,
 *   설계 예측(18%)이 1.6배 틀린 원인도 **가림 계산에 그 배지를 안 넣은 것**이었다.
 *
 * **대체 처방을 전부 기각했다 — 왜 못 고치는지를 남긴다:**
 * - **화장실 배지 축소** → 픽토그램이 **판독 불가**가 된다(만국 공통 기호가 뜻을 잃는다).
 * - **좌표 이동** → **M-19 금지.** `verified` 가 `estimated` 가 된다.
 * - **밴드 폭 확대** → **M-9 가 B 안을 기각했다.** 원본에 폭 치수가 **0** 이라 «없는 주장»을 만든다.
 * - **밴드 `fillOpacity` 인상** → 0.20 이상이면 `verified` 와 같아져 **확신도 위계가 무너진다.**
 *
 * → **가림은 «초기 뷰 한 배율의 성질»이다.** 밴드는 미터·배지는 화면 px 이라 **z17 에서 비율이 절반 아래**로
 *   떨어지고(시청역 화장실 ↔ 시청역 중심거리 13.04 → 27.6px), **겹침이 0** 이 된다.
 *   그리고 **범례 13행이 「구간」을 문자로 확정**한다(`시청역(1·2호선) — 대오 4 남쪽 구간입니다`).
 * ⚠ **이 완화는 «확대 버튼이 보인다»에 의존한다 — 확대 버튼을 조건부로 숨기지 마라.**
 */
function stationDotHtml(color: string): string {
  return [
    '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
    "<span style=\"position:absolute;left:0;top:0;transform:translate(-50%,-50%);",
    `width:12px;height:12px;border-radius:9999px;background:${color};`,
    `box-shadow:0 0 0 3px ${CASING},0 1px 3px rgb(0 0 0 / .35);`,
    'display:flex;align-items:center;justify-content:center;">',
    `<span style="width:4px;height:4px;border-radius:9999px;background:${CASING};"></span>`,
    "</span></div>",
  ].join("");
}

/**
 * 화장실 배지 — **픽토그램만.** 이름 pill 을 붙이지 않는다(§54.5-3).
 *
 * ⚠ **은폐가 아니다**: ① 범례 3행은 그대로 있다 ② 픽토그램이 **종류를 스스로 말한다**
 * ③ 셋 중 어느 것인지는 **범례가 «대오 N 기준 위치»로** 말하고 그 대오 pill 4개가 지도에 보인다.
 * **지운 것은 «지도 위 텍스트»이지 «항목»이 아니다.**
 *
 * 테두리가 `dashed` 인 것은 **확신도**다(원본 픽토그램 환산 · 승격 경로 0).
 * 역 배지의 `solid` 와 갈리는 유일한 지점이고, 그 축은 **선종이지 색이 아니다.**
 * 흰 면 + 2px 흰 링이 **시청역 화장실이 대오 4 테두리 위(0.35 m)에 놓이는 문제**를 같은 방식으로 푼다.
 */
function toiletBadgeHtml(): string {
  return [
    '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
    "<span style=\"position:absolute;left:0;top:0;transform:translate(-50%,-50%);",
    "width:20px;height:20px;box-sizing:border-box;border-radius:9999px;",
    `background:${CASING};border:1.5px dashed ${REFERENCE};`,
    `box-shadow:0 0 0 2px ${CASING},0 1px 3px rgb(0 0 0 / .35);`,
    'display:flex;align-items:center;justify-content:center;">',
    symbolSvg("toilet", 13),
    "</span></div>",
  ].join("");
}

/* ------------------------------------------------------------------ *
 * 그리기
 * ------------------------------------------------------------------ */

/**
 * 항목 1개를 그린다 — **도형(흰 casing 2겹) + 점 배지 + 이름 pill**.
 *
 * 타일 색은 예측할 수 없다. 흰 굵은 스트로크를 아래 깔면 타일이 밝든 어둡든 **두 경계 중 한쪽은
 * 반드시 대비를 만든다** — 배경을 가정하지 않고 대비를 보장하는 유일한 구조적 수단이다.
 * ⚠ 9/4 타일에서 casing 이 실제로 보이는지는 **QA 실측 대상**이다(8/28 값을 인용하지 마라).
 */
function drawFeature(
  maps: NaverMapsNamespace,
  map: NaverMap,
  feature: StrikeMapFeature,
  index: number,
): NaverOverlay[] {
  const color = toneColor(feature.tone);
  const z = featureZIndex(feature, index);
  const casingZ = z - 1;
  const overlays: NaverOverlay[] = [];

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

  /*
   * 점 배지 — `dots`(광화문역)는 **같은 기호를 두 번** 그린다. 그것이 «범례 1행 · pill 1개 · 점 2개»
   * 를 쪼개지 않고 만족하는 형태다(M-20 판정 20).
   * ⚠ **두 점 사이에 선·도형을 긋지 마라** — «역이 도로를 가로지른다»가 된다.
   */
  const content =
    feature.symbol === "toilet" ? toiletBadgeHtml() : stationDotHtml(color);
  for (const point of featurePoints(feature)) {
    overlays.push(
      new maps.Marker({
        map,
        position: new maps.LatLng(point.lat, point.lng),
        clickable: false,
        zIndex: z,
        icon: { content, anchor: new maps.Point(0, 0) },
      }),
    );
  }

  if (feature.label !== null) {
    const at = featureLabelAnchor(feature);
    overlays.push(
      new maps.Marker({
        map,
        position: new maps.LatLng(at.lat, at.lng),
        clickable: false,
        zIndex: LABEL_Z_BASE + index,
        icon: {
          content: pillHtml({
            text: feature.label,
            placement: feature.placement,
            gap: labelGapOf(feature),
            color,
          }),
          anchor: new maps.Point(0, 0),
        },
      }),
    );
  }

  return overlays;
}

/* ------------------------------------------------------------------ *
 * 거리뷰 «지금 보는 위치» 표식
 * ------------------------------------------------------------------ */

const SPOT_BOX = 88;
const SPOT_CONE_RADIUS = 44;
/** `getPov().fov` 를 못 읽었을 때만 쓰는 값 — 파노라마 생성 옵션의 `fov` 와 같다 */
const SPOT_CONE_FALLBACK_FOV = 100;

/**
 * 위(진북)로 열린 부채꼴 경로. SVG 는 y 가 아래로 커지므로 «위»는 `-cos` 다.
 * ⚠ 반각이 180°를 넘으면 큰 호여야 한다 — 넘는 순간 부채꼴이 **반대로 접힌 도형**이 된다.
 */
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

/**
 * 파노라마 생성 — **던지면 `null` 을 돌려준다.**
 *
 * 인증이 깨진 뒤에는 `maps.Panorama` 가 «있어도» 생성이 네이버 코드 안에서 throw 한다(§54.10 과 같은 기전).
 * 그 예외가 effect 본문에서 그대로 올라가면 **트리 전체가 날아간다** — 지도 하나 때문에
 * 개요·집결시간·식순이 사라지는 것이 이 프로젝트가 재현한 사고다.
 * ⚠ 훅 밖의 순수 함수로 둔 것은 우연이 아니다 — effect 본문에서 `try/catch` 로 상태를 나누면
 *   같은 분기가 두 벌이 된다. **판정은 «null 인가» 하나다.**
 */
function createPanorama(
  maps: NaverMapsNamespace,
  Panorama: NonNullable<NaverMapsNamespace["Panorama"]>,
  node: HTMLElement,
  at: { lat: number; lng: number },
): NaverPanorama | null {
  try {
    return new Panorama(node, {
      position: new maps.LatLng(at.lat, at.lng),
      /* ★ `pov.pan` 을 고정하지 않는다 — 조합원이 누른 임의 지점이라 고정값은 늘 틀린다.
         생략하면 네이버가 **촬영 진행 방향**을 잡아 준다 */
      pov: { tilt: 0, fov: SPOT_CONE_FALLBACK_FOV },
      logoControl: true,
      zoomControl: true,
      aroundControl: false,
      /* `flightSpot` = **주변 항공뷰 아이콘**(공식 문서 표현). 좁은 시트에서 오탭이 잦아 끈다.
         ⚠ **이동 기능이 아니다** — 예전 주석의 «하늘로 날아가는 이동 지점»은 틀린 설명이었다 */
      flightSpot: false,
      minScale: 0,
      maxScale: 4,
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * 지도 안 컨트롤
 * ------------------------------------------------------------------ */

/**
 * 지도 안 컨트롤 — **남색 면 + 흰 글자**(대비 11.37).
 * ⚠ **반투명으로 만들지 마라** — 지도 배경이 매 프레임 바뀌어 대비를 보장할 수 없다.
 * ⚠ **44px 높이를 줄이지 마라** — `h-[44px]` 다(`h-11` 은 글자 75% 에서 33px 로 줄어든다).
 *
 * ## ★★ 포커스 링은 **버튼 «안쪽»**이고 **색을 뒤집는다** (QA F1 · §54.17-1)
 *
 * ⚠ **종전 결론 *«포커스 링은 버튼 «바깥»이다»* 는 죽었다. 인용하지 마라.**
 * **죽은 것은 «바깥»이라는 결론이지 그 «이유»가 아니다** — *«남색 면 위에 남색 링을 그리면
 * 안 보인다»* 는 **지금도 참**이다. 그 판정이 빠뜨린 것은 **«링 «색»을 바꾼다»는 선택지**였고,
 * 그래서 «남색 링은 안 된다»에서 **«그러므로 바깥»**으로 건너뛰었다.
 *
 * **바깥 링이 실제로 무너진 두 가지:**
 * 1. `MapControlStack` 의 `overflow-hidden` 이 **바깥 링을 통째로 잘라** 화면에 안 그려졌다
 *    (WCAG 2.4.7 위반 · 확대·축소·`처음 위치로`·거리뷰 **4개 전부**).
 * 2. ★ **잘리기 «전»에도 근거가 없었다.** 스택은 버튼 사이 틈이 **0**이라 중간 버튼의
 *    링 **가로 두 변(면적 47%)이 이웃 버튼(`rgb(9,51,137)`) 위**에 놓인다 — **대비 1:1.**
 *    **링을 링으로 읽게 하는 것이 가로 두 변**이라 세로 두 줄만 남으면 판독 가능한 표시가 아니다.
 *    남은 좌·우변도 **«지도 타일 위»**라 `union-design-system §0.7`(*«배경이 매 프레임 바뀌는 곳에서
 *    테두리로 만든 경계는 배경에 따라 약해진다»*)에 그대로 걸린다.
 *
 * → **`outline-offset: -3px`(border-box 안쪽)** 로 그리고 링 색을 면과 반대로 둔다.
 *   배경이 **«우리 면»**이라 **대비표를 만들 수 있다**(OFF `#ffffff`↔`#093389` · ON `#093389`↔`#ffffff`
 *   — 둘 다 **11.37**). 바깥 링은 배경이 지도 타일이라 그 표가 **애초에 불가능**하다.
 * ⚠⚠ **`MapControlStack` 의 `overflow-hidden` 을 빼서 «고치려» 하지 마라**(QA-532) —
 *   그 순간 위 2번이 되살아난다. **안쪽 링은 클립 영역 «안»이라 잘리지 않는다. 구조 변경 0 이다.**
 * ⚠ **`-outline-offset-3` 은 이 프로젝트에서 여기서 처음 쓴다.** 런타임 주입으로는 검증되지 않으므로
 *   **`getComputedStyle(btn).outlineOffset === "-3px"` 를 «값으로» 확인해야 한다**(QA-531).
 */
const MAP_CTRL_BASE =
  "ease-out-soft flex h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap px-3 text-[13px] font-bold transition-opacity duration-150 hover:opacity-85 focus-visible:outline-3 focus-visible:-outline-offset-3";
/** 기본(OFF) — **남색 면**이므로 링은 **흰색**(11.37) */
const MAP_CTRL_CLASS = `${MAP_CTRL_BASE} bg-primary text-white focus-visible:outline-white disabled:bg-surface disabled:text-ink-muted`;
/** 켜진 상태 — **색을 뒤집는다**(뜻은 `aria-pressed` 와 라벨이 함께 진다 · §2). **흰 면**이므로 링은 **남색**(11.37) */
const MAP_CTRL_ON_CLASS = `${MAP_CTRL_BASE} bg-bg text-primary focus-visible:outline-primary`;

/**
 * 컨트롤 묶음 — 한 덩어리로 둥글게 자르고 사이를 가는 흰 선으로 나눈다.
 * ⚠ **아래 두 모서리에 두지 마라** — 축척 바·`© NAVER Corp.` 가 이미 쓴다.
 */
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

/**
 * 확대·축소 — **키보드 사용자의 유일한 확대 경로**다(`keyboardShortcuts: false`).
 *
 * ⚠⚠ **조건부로 숨기지 마라.** §54.16-3 의 «겹치면 확대하면 된다» 완화가 **«버튼이 보인다»에
 * 의존한다** — 숨기는 순간 그 근거가 죽고, 완화 문구에 `+`/`−` 를 안 적기로 한 판정도 함께 깨진다.
 * **`+`·`−` 를 텍스트 문자로 쓰지 마라** — 서체마다 위치·크기가 튄다. SVG 다.
 */
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

/** 처음 위치로 — 되돌리는 화살표. **드래그로 길을 잃었을 때 유일한 복귀 경로다. 지우지 마라** */
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

/** `prefers-reduced-motion: reduce` — 참이면 확대를 애니메이션 없이 즉시 처리한다 */
function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ *
 * 대체면
 * ------------------------------------------------------------------ */

/**
 * 대체면 — **두 문장뿐이다. 세 번째 줄을 만들지 마라.**
 *
 * ⚠⚠ **8/28 `RallyMapFallback` 3줄을 복제하면 여의도를 안내한다**(M-5 · §53-12 #13) —
 * `국회의사당역 3번 출구 KDB산업은행 앞` · `코스콤지부 — 집회 3구역`.
 * ★ **9/4 는 대체 문장이 «필요 없다»**: 범례 13행이 **캔버스 밖**에 있고 **정적 데이터에서 파생**되므로
 *   **지도 로드와 무관하게 렌더된다.** 8/28 은 범례가 마커 상태에 얽혀 있어 대체면이 위치를 말해야 했다.
 * 절대 위치(«세종대로»)는 **개요 블록의 `장소` 행**이 이미 진다.
 */
function StrikeMapFallback({ status }: { status: Exclude<MapStatus, "ready"> }) {
  return (
    <div className="rounded-card flex h-full flex-col items-center justify-center bg-surface px-5 py-6 text-center">
      <p className="break-keep break-words text-body font-semibold text-ink">
        {status === "failed" ? "지도를 불러오지 못했습니다." : "지도를 불러오는 중입니다."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 본체
 * ------------------------------------------------------------------ */

export function StrikeMap({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<MapStatus>("loading");
  /** 현재 zoom — `+`/`−` 비활성 판정에 쓴다 */
  const [zoom, setZoom] = useState<number | null>(null);
  /** 초기 화면에서 벗어났는가 — `처음 위치로` 노출 판정 */
  const [moved, setMoved] = useState(false);
  /** 스크립트에 파노라마 모듈이 없으면 **토글 버튼을 아예 렌더하지 않는다**(죽은 어포던스 금지) */
  const [panoSupported, setPanoSupported] = useState(false);

  /** 거리뷰 모드 — 지도에 길 레이어를 깔고 **클릭으로 위치를 정하는** 상태. 시트와 «독립»이다 */
  const [streetMode, setStreetMode] = useState(false);
  /**
   * 열린 거리뷰의 지점. `null` 이면 시트가 없다.
   * ★ **초기 파노라마를 «우리가» 고르지 않는다**(§54.16-6 (2) · M-20 판정 15).
   *   원문 「장소: 세종대로 (광화문역, 시청역)」이 **두 역을 대등하게** 말하므로 하나를 초기 시점으로
   *   두면 ***«그쪽으로 오라»*** 로 읽힌다 — **대오 하나를 고르면 그것이 «우리 자리»로 읽히는 것과
   *   정확히 같은 기전**이다. **조합원이 고르는 것이 이 문제를 원천 소거한다.**
   * ⚠ **`estimated` 좌표(대오·무대)를 시작점으로 «우리가» 쓰지 마라** — ±25 m 면 엉뚱한 곳을 비춘다.
   *   조합원이 그 위를 누르는 것은 **조합원의 선택**이지 우리 주장이 아니다.
   */
  const [streetAt, setStreetAt] = useState<{ lat: number; lng: number } | null>(null);
  const [panoDate, setPanoDate] = useState("");
  const [panoStatus, setPanoStatus] = useState<StrikePanoStatus>("idle");
  /** 지도 위 «지금 보는 위치» 표식의 좌표·시선(파노라마와 양방향 동기) */
  const [spotAt, setSpotAt] = useState<{ lat: number; lng: number } | null>(null);
  const [spotPan, setSpotPan] = useState(0);
  const [spotFov, setSpotFov] = useState(SPOT_CONE_FALLBACK_FOV);

  const mountRef = useRef<HTMLDivElement | null>(null);
  /** 지도 상자 — **`ResizeObserver` 를 여기 건다**(아래 이유 참조) */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  const boundsRef = useRef<NaverLatLngBounds | null>(null);
  const panoMountRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<NaverPanorama | null>(null);
  /** 시트를 닫을 때 포커스를 여기로 되돌린다 */
  const streetButtonRef = useRef<HTMLButtonElement | null>(null);

  /** 상자 폭의 70% 를 px 로 확정해 CSS 변수로 내린다 — 0폭 앵커 안에서는 `%` 가 해석되지 않는다 */
  const syncLabelWidth = useCallback(() => {
    const box = boxRef.current;
    if (box === null) return;
    box.style.setProperty(
      LABEL_MAX_WIDTH_VAR,
      `${Math.round(box.clientWidth * LABEL_MAX_WIDTH_RATIO)}px`,
    );
  }, []);

  /** 전 항목을 담는 초기 화면. 범위는 `STRIKE_MAP_FIT_BOUNDS` 가 배열에서 자동 계산한다 */
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
    /* ⚠ 여기서 줌 상한을 걸지 마라 — `FIT_PADDING` 주석의 «3왕복»이 그 자리다 */
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
     * 조작 계약(§54.16-1 · M-14 — **사용자 선택으로 §54.3 «움직이지 않는 지도»를 뒤집은 결과다**).
     *
     * **왜 위험한 것을 했는가 — 다음 사람에게 남긴다:**
     * 디자이너가 «고정 뷰»를 권고했고 근거도 타당했다(*"±25 m 좌표를 확대하면 없는 정밀도를 주장한다"*).
     * **사용자가 그 위험을 고지받고 «8/28처럼 드래그·확대»를 택했다.**
     * **근거가 틀려서가 아니라 결정권자가 달라서 뒤집혔다.**
     *
     * 그래서 딸려 온 것: `touch-action: none` → **지도 위에서 페이지가 안 내려간다**(알려진 제약)
     * → 완화는 **지도 «위» 안내 문구 하나**가 진다(`MAP_GESTURE_NOTE`).
     *
     * | 안 여는 것 | 왜 |
     * |---|---|
     * | 휠 줌(`scrollWheel:false`) | 데스크톱에서 페이지를 스크롤하다 지도 위를 지나면 **의도치 않게 확대된다** |
     * | 키보드 방향키 이동(`keyboardShortcuts:false`) | 지도가 포커스를 받으면 **방향키로 페이지를 못 내린다.** 확대는 버튼으로 되고, **«키보드로 지도를 이동할 수 없다»는 알려진 제약**이며 그 사용자의 경로는 **범례 13행**이다 |
     *
     * ⚠ `disableDoubleClickZoom` 은 스펙이 지정하지 않았다 — **더블탭 줌을 열었으므로 같은 제스처의
     *   마우스 판인 더블클릭도 함께 연다.** 둘을 갈라 놓을 근거가 없고, 데스크톱에는 «페이지가 안
     *   내려간다» 위험이 없다. (8/28 은 둘 다 막았는데 그쪽은 고정 뷰 성격이 남아 있던 시기다.)
     * `logoControl`·`mapDataControl` 은 **끄지 마라**(네이버 이용약관상 출처·로고 표기 필수).
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

    /*
     * 네이버가 마운트 노드에 `tabindex="0"` 을 붙인다. `keyboardShortcuts: false` 라
     * 포커스가 들어와도 **할 일이 없는 빈 탭 정지점**이고 접근성 이름도 없다 — 제거가 맞다.
     * 지도 안에 남는 정지점은 **네이버 로고·저작권 링크**뿐이며 그 포커스 표시는 덮어쓰지 않는다.
     * ⚠ 마운트 노드에 **`aria-hidden` 을 걸지 마라** — 그 링크들이 숨겨진 영역 안의 포커스 가능
     *   요소가 되어 WCAG 2.4.3·4.1.2 위반이 된다.
     */
    node.removeAttribute("tabindex");

    const overlays: NaverOverlay[] = [];
    STRIKE_MAP_FEATURES.forEach((feature, index) => {
      overlays.push(...drawFeature(maps, map, feature, index));
    });
    overlaysRef.current = overlays;

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

  /** 시트를 닫는다. **거리뷰 모드도 함께 끈다** — 길만 남으면 눌러도 열 것이 없다 */
  const closeStreetView = useCallback(() => {
    setStreetAt(null);
    setSpotAt(null);
    setStreetMode(false);
    setPanoDate("");
    setPanoStatus("idle");
    streetButtonRef.current?.focus({ preventScroll: true });
  }, []);

  const toggleStreetMode = useCallback(() => {
    setStreetMode((on) => {
      if (on) {
        setStreetAt(null);
        setSpotAt(null);
        setPanoDate("");
        setPanoStatus("idle");
      }
      return !on;
    });
  }, []);

  /* 인증 실패는 스크립트가 이 전역 콜백으로 알린다 — 등록하지 않으면 Client ID 가 틀렸을 때
     빈 지도가 남는다(가짜 동작 금지). 마운트 즉시 등록해 로드 경합을 피한다 */
  useEffect(() => {
    window.navermap_authFailure = () => setStatus("failed");
    return () => {
      delete window.navermap_authFailure;
    };
  }, []);

  /*
   * 스크립트가 이미 로드된 상태로 마운트되는 경우(뒤로가기 등) `onLoad` 가 오지 않으므로 여기서 만든다.
   * **정리를 같은 effect 에 두는 것이 중요하다** — 분리하면 StrictMode 재마운트에서 파괴만 되고
   * 재생성되지 않아 빈 박스가 남는다.
   * ⚠ 정리 호출은 **전부 `safely()` 안이다**(§54.10). 벗기면 401 에서 페이지가 통째로 죽는다.
   */
  useEffect(() => {
    /*
     * ⚠ **`react-hooks/set-state-in-effect` 를 여기서만 끈다 — 근거를 남긴다.**
     *
     * 그 규칙이 막는 것은 *«렌더 상태에서 렌더 상태를 파생시키는 것»* 인데, 여기는 그것이 아니다:
     * **외부 시스템(네이버 스크립트)이 «이미 로드돼 있는가»를 마운트 시점에 «표본»으로 읽는** 자리다.
     * 스크립트가 이미 로드된 채 마운트되면(뒤로가기 등) `<Script onLoad>` 가 오지 않아
     * **이 한 줄이 없으면 지도가 영영 안 그려진다.**
     *
     * 대안(마이크로태스크·rAF 로 미루기)을 **버렸다**: 그러면 생성이 정리보다 늦게 도착할 수 있어
     * **StrictMode 재마운트에서 «파괴만 되고 빈 박스가 남는»** 그 사고가 되살아난다 —
     * `생성·파괴를 같은 effect 에` 두는 것(§54.2 패턴 2)이 애초에 그것을 막으려고 세운 규율이다.
     * ⚠ 8/28 `RallyMap` 도 **같은 모양**이다(그쪽은 컴파일러가 분석을 포기해 경고가 안 뜰 뿐이다).
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.naver?.maps !== undefined) build();
    return () => {
      for (const overlay of overlaysRef.current) {
        safely(() => overlay.setMap(null));
      }
      overlaysRef.current = [];
      const map = mapRef.current;
      mapRef.current = null;
      boundsRef.current = null;
      safely(() => map?.destroy());
    };
  }, [build]);

  /* 8초 타임아웃 — `onError` 없이 매달리는 경우까지 실패로 확정한다 */
  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("failed"), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  /*
   * 상자 폭이 바뀌면 재적합. 고정 zoom 을 쓰지 않는 대신 이 관측이 필수다.
   *
   * ⚠⚠ **감시 대상은 «마운트 노드»가 아니라 «부모(상자)»다.** 네이버는 초기화할 때 마운트 요소에
   * **인라인 `width`/`height` 를 px 로 직접 박는다** — 그 노드의 크기는 우리 CSS 소관이 아니라
   * 위젯 소관이라 **마운트 노드에 걸면 영영 울리지 않는다**(8/28 파노라마에서 실측으로 잡았다).
   * 이 함정은 새 기능이 만든 것이 아니다 — **화면 회전·모바일 주소창 접힘에도 있는 잠복 결함**이다.
   */
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
        safely(() => fit(maps, map));
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(box);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fit, status, syncLabelWidth]);

  /*
   * ★★ **파노라마 서브모듈은 본 스크립트 `onLoad` «이후»에 도착한다.**
   *
   * `submodules=panorama` 는 본 스크립트가 **`maps-panorama.js` 를 따로 받아 오게** 하는 지시라
   * `onLoad` 시점에는 `maps.Panorama` 가 아직 `undefined` 다(8/28 실측 그대로이고,
   * **9/4 산출물에서도 재현했다** — 한 번만 확인했더니 거리뷰 토글이 영영 안 나왔다).
   * → **도착할 때까지 짧게 재확인하고, 시한을 넘기면 «미지원»으로 확정한다**(죽은 어포던스 금지).
   * ⚠ **`build()` 안의 1회 확인으로 되돌리지 마라** — 그러면 거리뷰가 통째로 사라진다.
   * ⚠ 첫 확인도 **콜백 안**에서 한다(0ms) — effect 본문에서 곧바로 `setState` 하면 캐스케이딩 렌더다.
   */
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

  /* 줌·드래그를 따라간다 — `처음 위치로` 는 **움직였을 때만** 나타난다 */
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

  /*
   * ★ **거리뷰 모드** — 길 레이어를 깔고 **클릭으로 위치를 정한다**.
   *
   * ⚠ `maps.StreetLayer` 가 없으면 **길만 빠지고 클릭 이동은 남는다**(QA-516) —
   *   그래서 레이어와 클릭 리스너를 **한 조건으로 묶지 않는다.**
   * ⚠ `StreetLayer` 는 타일 오버레이라 **지도 클릭을 가로채지 않는다.**
   * ⚠ **`status` 를 의존성에서 빼지 마라** — 지도가 아직 `null` 인 시점에 한 번 돌고 끝나면
   *   길이 영영 안 깔린다.
   */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || status !== "ready" || !streetMode) return;

    const layer = maps.StreetLayer === undefined ? null : new maps.StreetLayer();
    layer?.setMap(map);

    const listener = map.addListener("click", (payload?: unknown) => {
      /* 네이버 클릭 이벤트는 `{ coord }` 를 준다 — 타입 선언에 없으므로 여기서 좁힌다 */
      const coord = (payload as { coord?: { lat(): number; lng(): number } } | undefined)?.coord;
      if (coord === undefined) return;
      const lat = coord.lat();
      const lng = coord.lng();
      const pano = panoRef.current;
      if (pano !== null) {
        /* 이미 열려 있으면 **인스턴스를 다시 만들지 않고** 위치만 옮긴다 —
           새로 만들면 시트가 깜빡이고 촬영일자가 잠깐 비는 것이 보인다 */
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

  /*
   * 파노라마 인스턴스는 **시트가 열려 있는 동안만** 존재한다.
   *
   * ★★ **문서에 없는 API 를 «하나도» 쓰지 않는다**(M-20 판정 18 · `union-webapp-dev` §7).
   *   8/28 의 `getProjection().fromOffsetToCoord`(바닥 탭 이동)와 `Marker({ map: panorama })`
   *   (파노라마 안 라벨)를 **둘 다 안 가져온다** — §7 의 조건(*«없어졌을 때 무엇이 남는가»*)을
   *   **«아예 안 기댄다»로 푼다.** 가장 강한 형태의 만족이고 **위험이 두 벌이 되지 않는다.**
   *   대신 **파노라마 이동은 네이버 기본 화살표**가, **«어디인지»는 시트 제목과 지도 위 표식**이 진다.
   *
   * ★ 실패해도 **시트를 닫지 않는다** — 닫으면 *"눌렀는데 아무 일도 안 났다"* 로 읽힌다.
   *   **다음에 할 일**(«지도에 표시된 길 위의 다른 지점»)을 알려야 하고, 그러려면 시트가 열려 있어야 한다.
   */
  useEffect(() => {
    if (streetAt === null) return;
    const maps = window.naver?.maps;
    const node = panoMountRef.current;
    const Panorama = maps?.Panorama;
    if (maps === undefined || node === null || Panorama === undefined) {
      setPanoStatus("failed");
      return;
    }

    /* ⚠ 인증이 깨진 뒤에는 **생성 자체가 throw 한다**(§54.10 과 같은 기전) — 그것도 «실패»다 */
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

    /*
     * ★★ **크기 감시는 «마운트 노드»가 아니라 «부모»에서** (`union-webapp-dev` §7).
     * 네이버 파노라마는 `size` 옵션이 없으면 **초기화 시점 요소 크기로 고정**되고 마운트 요소에
     * **인라인 px 를 박는다** — 그 노드를 감시하면 **영영 안 울린다.**
     * 시트 높이 드래그·화면 회전·주소창 접힘을 **한 지점에서** 받는다.
     */
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
      }),
      /* 시선을 돌리면 지도 표식의 부채꼴도 같이 돈다 */
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
      if (resizeFrame !== 0) window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      for (const l of listeners) safely(() => maps.Event.removeListener(l));
      panoRef.current = null;
      /* ⚠ §54.10 — 인증이 깨진 뒤에는 이 호출이 throw 한다. 방어를 벗기지 마라 */
      safely(() => pano.destroy());
    };
    /* `streetAt` 이 바뀌면 파노라마를 새로 만든다 — 지점이 «처음 열렸다»는 뜻이다.
       이미 열린 뒤의 이동은 위 클릭 리스너가 `setPosition` 으로 처리한다 */
  }, [streetAt]);

  /*
   * 지도 위 «지금 보는 위치» 표식 — 점 + 시선 부채꼴. 모드가 꺼지면 함께 사라진다.
   *
   * ⚠ **색은 `#1a1a1a`(ink)다 — 8/28 의 주황을 가져오지 않았다.** §54.7 이 **«신규 색 0»**을
   *   못박았고 주황은 이 지도의 색표에 없다. `#093389`(대오·역)·`#4b5563`(무대·화장실)은 **이미
   *   뜻을 진 의미색**이라 여기 쓰면 «갈 곳»이나 «참고 지물»로 읽힌다.
   *   `ink` 는 이 지도에서 **캔버스 밖 글자에만 쓰여 캔버스 안에서 뜻이 비어 있는 중립색**이다.
   *   ★ 디자이너가 «8/28 주황 승계»로 판정하면 여기만 바꾸면 된다(한 곳이다).
   * ⚠ **`clickable: false` 를 바꾸지 마라** — 이 표식이 클릭을 먹으면 그 자리를 다시 누를 수 없어
   *   «보는 위치 주변으로 조금 옮기기»가 막힌다.
   */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || !streetMode || spotAt === null) return;

    const marker = new maps.Marker({
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

    return () => {
      safely(() => marker.setMap(null));
    };
  }, [spotAt, spotPan, spotFov, streetMode]);

  /*
   * `Esc` 로 시트를 닫는다. **`<dialog showModal()>` 을 쓰지 않으므로 직접 진다** —
   * 그것은 배경을 `inert` 로 만드는데 **지도를 눌러 위치를 옮기는 것이 이 기능의 계약**이다.
   */
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
        /* `submodules=panorama` 가 없으면 `maps.Panorama`·`maps.StreetLayer` 가 아예 없다 —
           그러면 거리뷰 토글이 렌더되지 않는다(죽은 어포던스 0) */
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=panorama`}
        strategy="afterInteractive"
        onLoad={build}
        onError={() => setStatus("failed")}
      />

      <figure className="mt-6">
        <p className="sr-only">{MAP_SR_INTRO}</p>

        {/*
          드래그 개방의 **유일한 실효 완화 수단**(§55-1 «강함» · 8/28 §27.16.3 실측 승계).

          ★ **지도 «위»다. 아래로 내리지 마라** — 지도가 화면 하단을 덮을수록 그 아래에 있는 것은
          **전부 화면 밖**이라 **위험이 최대인 순간에 완화가 0이 된다.** 우연이 아니라 기하다.
          ★ 지도 아래에 있는 것: **범례 13행 · 코스콤 대오 한 줄 · 식순 · QR 한 줄.**
          지도에 갇히면 그것을 **못 본다** — «불편»이 아니라 **콘텐츠 도달 실패**다.
          ⚠ **흐리지 마라(`ink-muted` 금지) · 접지 마라 · `sr-only` 로 돌리지 마라 · `※` 를 붙이지 마라.**
        */}
        <p className="mb-2 max-w-[var(--container-prose)] break-keep break-words text-caption font-semibold text-ink">
          {MAP_GESTURE_NOTE}
        </p>

        {/*
          ★★ 확신도 키를 **지도 «위»로 옮겼다**(§54.16-1 방어 3). 확대하면 조합원이 지도에 붙어 있어
          **지도 아래 범례가 화면에서 멀어지는데**, 키 줄이 상자 바로 위에 있으면 확대 상태에서도
          **같은 화면에 남는다.**
          ⚠ **«옮긴» 것이지 «복제»가 아니다 — 화면 출현은 1회다**(QA-511. 2회면 실패다).
        */}
        <p className="mb-2 max-w-[var(--container-prose)] break-keep break-words text-caption text-ink">
          {LEGEND_KEY}
        </p>

        {/*
          고정 종횡비 박스 — 실패·로딩에서도 크기가 변하지 않아 **CLS 0**.

          ★ **`aspect-[4/5]` 는 초판 `3/5` 를 뒤집은 값이다**(§54.16-2). 드래그를 열면
          **«지도 밖 빈 곳»이 장식이 아니라 완화 문구의 «참값»**이 된다 — `3/5`(336×560)면
          360×640 에서 빈 곳이 **12px** 이라 *«지도 위나 아래 빈 곳을 쓸어 주세요»* 가 **거짓**이다.
          `4/5`(336×420)면 **106px**(터치 규격 44px 의 2.4배)이고 판정선은 **44px** 이다.
          ⚠ 실측 빈 곳이 44px 미만이면 **문장이 아니라 종횡비를 고친다**(검증 게시 조건 19).
          ⚠ 대가: 라벨 여유가 39 → 27px 로 줄었다. **그 완화는 «확대»가 진다.**
          ⚠ **`md:aspect-*` 분기를 만들지 마라** — 콘텐츠가 세로 스트립이다.
          ★ **`max-w-[420px]`**: 동서가 약 95 m 뿐이라 폭을 늘려도 **축척은 세로가 정한다.**
            폭만 커지면 좌우 빈 타일이 늘 뿐이다.
        */}
        <div
          ref={boxRef}
          /*
           * ★ **`isolate` 를 빼지 마라.** 네이버가 마커에 붙이는 `z-index` 는 1000대인데
           * `position: relative` 만으로는 **쌓임 맥락이 만들어지지 않아** 그 값이 문서 최상위에서
           * 경쟁한다 — 8/28 에서 **마커 배지가 고정 헤더(z-200)를 뚫고 올라왔다.**
           */
          className="rounded-card relative isolate aspect-[4/5] w-full max-w-[420px] overflow-hidden"
        >
          {/*
            `touchAction: "none"` 은 **사용자 결정으로 열린 한 손가락 드래그의 본체**다(8/28 승계).
            이 한 줄이 «지도 위에서는 페이지가 안 내려간다»는 **알려진 제약**을 만들고,
            그래서 위 완화 문구가 **필수**다 — **둘은 한 쌍이다. 한쪽만 되돌리지 마라.**
          */}
          <div ref={mountRef} className="size-full" style={{ touchAction: "none" }} />

          {status === "ready" ? (
            <>
              <MapControlStack side="left">
                <ZoomButtons zoom={zoom} onZoom={zoomBy} />
                {/* 드래그로 길을 잃었을 때 **유일한 복귀 경로**다. 움직였을 때만 나타난다 */}
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

              {/* 파노라마 모듈이 없으면 **버튼 자체를 렌더하지 않는다**(죽은 어포던스 금지).
                  ⚠ **글자 버튼이다.** 정사각 44px 로 못박으면 가용 폭이 24px 이 되어
                  13px `거리뷰`(약 39px)가 두 줄로 깨진다(8/28 실측). 폭은 글자가 정한다 */}
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

          {status !== "ready" ? <StrikeMapFallback status={status} /> : null}
        </div>

        {/*
          ★ **코스콤지부 대오 한 줄** — 자리는 `figure` «안» · 캔버스 «밖»이다(§53-15 조건 11).
          범례 행도 아니고 지도 밖 본문도 아니다.
          ★ **지도를 «본 뒤» 읽는 문장**이라 아래다(완화 문구는 «행동 완화»라 위다 — 두 자리는 다르다).
          ⚠⚠ **키가 없어 지도 섹션이 사라지면 이 문장도 함께 사라진다 — «의도된 상태»다.**
            위험(지도가 대오 4개를 보여 준다)과 완화(넷 중 하나를 임의로 고르지 말라)가
            **같은 조건부 안에** 있어야 한다. **«사라지는 버그»로 보고 지도 밖으로 빼지 마라.**
        */}
        <p className="mt-4 max-w-[var(--container-prose)] break-keep break-words text-caption text-ink">
          {KOSCOM_COLUMN_NOTE}
        </p>

        {/*
          범례 13행 — **이 지도의 텍스트 등가 «전부»다**(9/4 에는 «위쪽 텍스트 블록»이 없다).
          행은 `STRIKE_MAP_FEATURES` 에서 파생된다 — 배열에서 빠진 항목의 행은 자동으로 사라진다.
          ⚠ **범례 행을 지우지 마라.** 줄이려면 **지도에서 뺀다**(§0.4 은폐 금지).
          ⚠ **접지 마라 · `sr-only` 로 돌리지 마라.**
          **`<figure>` 의 마지막 직계 자식이어야 한다**(HTML 스펙).

          ★ 행은 **flex 아이템**이라 `break-words` 가 «안 든다» — 200% 판정선은 «문장 길이»가 아니라
          **«최장 어절 9자»**다(§54.6-2 실측). 현재 최장은 `화장실입니다` **6자**(202px · 최악 슬롯 281).
          ⚠ **`min-w-0`·`break-all`·`overflow-wrap:anywhere` 로 «고치지» 마라** — 넘치지 않는다(실측).
          ⚠ **그렇다고 `break-words` 를 떼지도 마라** — 자리가 바뀌면 그 자리에서 다시 필요해진다.
        */}
        <figcaption className="mt-4 max-w-[var(--container-prose)]">
          <ul className="flex flex-col gap-2">
            {STRIKE_MAP_FEATURES.map((feature) => (
              <li
                key={feature.id}
                className="flex gap-2 break-keep break-words text-caption text-ink"
              >
                {/* ★ **지도 배지와 같은 그림이어야 한다**(QA-502) — `symbol` 이 있는 행은 글리프
                    문자가 아니라 같은 `symbolSvg` 를 그린다. `dangerouslySetInnerHTML` 대상은
                    **우리가 만든 상수 문자열뿐**이다(외부 입력 0).
                    ⚠ **기호로 확신도를 말하지 마라** — 무대(추정)·화장실(추정)·역(확인)이 섞여 있어
                    «빈 원 = 추정» 류 문법을 세우면 즉시 깨진다. 확신도는 **선종과 `LEGEND_KEY`** 가 진다 */}
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

      {/* 거리뷰 하단 시트 — **`position: fixed` 라 문서 세로를 «0» 먹는다**(QA-519) */}
      {streetAt !== null ? (
        <StrikeRoadviewSheet
          panoDate={panoDate}
          panoStatus={panoStatus}
          mountRef={panoMountRef}
          onClose={closeStreetView}
        />
      ) : null}
    </>
  );
}
