"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  EXIT5,
  LABEL_PRIORITY_MIN_ZOOM,
  LEGEND_KEY,
  LOW_ACCURACY_NOTE,
  LOW_ACCURACY_THRESHOLD_M,
  MAP_FEATURES,
  MAP_FIT_BOUNDS,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  circledNumber,
  featureLabelAnchor,
  featureRoadviewPoint,
  labelPlacementAt,
  myLocationFeature,
} from "@/lib/rallyMap";
import type {
  GeoConfidence,
  LabelPlacement,
  LabelPriority,
  MapFeature,
  MapTone,
} from "@/lib/rallyMap";
import { bearingLabel8, formatDistanceKo, haversineMeters } from "@/lib/geo";
import type {
  NaverLatLng,
  NaverLatLngBounds,
  NaverMap,
  NaverMapEventListener,
  NaverMapsNamespace,
  NaverMarker,
  NaverMarkerIcon,
  NaverOverlay,
  NaverPanorama,
} from "@/lib/naverMaps";

/**
 * 결의대회 위치 지도 + 내 위치 (디자인 스펙 §20.4 · §20.14 · §20.20).
 *
 * **이 지도는 보조다.** 같은 정보가 위 "코스콤지부 집결 위치" 블록에 항상 텍스트로 있고, 여기
 * 대체면도 **초기 DOM 에 존재**해 스크립트 차단·네트워크 실패에서도 보인다. 지도가 성공했을 때만
 * 더 풍부한 표현으로 교체된다 — 판단 순서가 반대면 §0.4 위반이다.
 * **무엇을 그릴지 스스로 정하지 않는다** — `src/lib/rallyMap.ts` 의 `MAP_FEATURES` 를 해석만 한다.
 *
 * ⚠ `logoControl`·`mapDataControl` 을 끄지 마라 — 네이버 이용약관상 출처·로고 표기가 필수다.
 * ⚠ 위성·하이브리드 전환 UI 를 넣지 마라 — 위성 타일 위에서는 도형 대비를 보장할 수 없다.
 * ⚠ 밴드 스타일에 `id === "column-1"` 같은 id 기반 분기를 넣지 마라(§20.20.2) —
 *   스타일은 **`confidence` 에서만** 파생돼야 확신도가 승격될 때 데이터 한 글자로 전부 따라온다.
 */

type MapStatus = "loading" | "ready" | "failed";

/** 내 위치 상태. **거부는 오류가 아니다**(§20.14.3) — 별도 상태로 두고 중립 문구를 낸다 */
type LocationStatus = "idle" | "requesting" | "shown" | "denied" | "error";

interface MyLocation {
  lat: number;
  lng: number;
  /** `coords.accuracy`(m). 비정상(≤0)이면 null — 정확도 문구·원을 생략한다 */
  accuracyM: number | null;
  distanceText: string;
  bearing: string;
  inBounds: boolean;
}

/** 스크립트가 응답 없이 매달리는 경우의 가드(§20.4.3) */
const LOAD_TIMEOUT_MS = 8_000;
/** 리사이즈 → fitBounds 재실행 디바운스(§20.4.3) */
const RESIZE_DEBOUNCE_MS = 150;
/**
 * 라벨 최대 폭 = 지도 폭의 **70%**(§30.4.5). CSS 변수로 내려 리사이즈 시 마커 재생성 없이 갱신한다.
 *
 * ⚠ **이 비율은 천장이지 목표가 아니다. 라벨을 늘리는 근거로 인용하지 마라** — 문자열은 검증 확정본이다.
 * ⚠ `FIT_PADDING`·`BAND_STYLE.estimated` 와 **한 묶음이다**(§30.11). 하나만 되돌리면 §30.4.4 가 재현되지 않는다.
 */
const LABEL_MAX_WIDTH_RATIO = 0.7;
const LABEL_MAX_WIDTH_VAR = "--rally-label-max";

/** 지속 추적 금지(§20.14.1-4). `watchPosition` 을 쓰지 마라 — 배터리·프라이버시 비용이 크다 */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

/*
 * 초기 화면 여백(px). 각 변은 **그 방향으로 가장 멀리 나가는 라벨**에서 유도된다(유도표 §30.3).
 * ⚠ **`left 32` 는 ③ 이 `left` 배치인 것에 종속된다** — ③ 방향을 바꾸면 여기부터 다시 유도하라.
 * ⚠ **① 을 `always`(pill)로 되돌리면 left 를 재유도해야 한다**(§30.4.1 이 ① 을 배지로 둔 이유) —
 *   `5번 출구` pill 이 32 로는 안 담긴다.
 */
const FIT_PADDING = { top: 52, right: 20, bottom: 76, left: 32 } as const;

/**
 * **초기 화면(`fitBounds`)의 줌 상한**(§30.2.1).
 * ⚠ **`MAP_MAX_ZOOM`(조작 상한)과 합치지 마라**(확대가 막혀 §21.1.1 계약이 깨진다) · **지우지도 마라**
 *   (페이지 지도는 박스 폭 상한 때문에 안 걸리지만 **전체 화면 모달은 걸린다**).
 * ⚠ **`FIT_MIN_ZOOM` 은 없다** — z15 로 떨어지는 것을 막는 장치가 코드에 없고, z16 이 유지되는 것은
 *   **"성질"이지 계약이 아니다.** 지물·`FIT_PADDING` 이 바뀌면 **뷰포트 하한 이분 탐색을 다시 돌려라**
 *   (기준값 `_workspace/03_developer_impl.md`). **"여유 ○m" 환산값은 비선형이라 믿지 마라.**
 */
const FIT_MAX_ZOOM = 16;

/**
 * **3단계-B(전체 화면 지도) 렌더 스위치** — 켜짐(§31 · QA-260 판정).
 * ⚠ **`false` 로 되돌릴 때 함께 되돌릴 것**: 컨트롤 행 4개 → 3개(§31.6) · 문안 게이트 55·56·74 무효.
 * 타입 `boolean` 을 그대로 둬라 — 리터럴로 좁히면 반대쪽 분기가 "도달 불가"로 보인다.
 */
const STAGE3B_FULLSCREEN_MAP: boolean = true;

/** 라벨 마커의 zIndex 시작값 — 도형보다 항상 위에 오도록 넉넉히 띄운다 */
const LABEL_Z_BASE = 1_000;

/* 색 — §20.7·§20.16 대비 검증표의 값. 지도 타일 위라 §16.5 표면 규칙의 예외를 적용한다(§20.0.1):
   불투명 흰 면 + 경계 + 그림자를 **동시에** 주는 것이 대비를 보장하는 유일한 구조적 수단이다 */
const GO = "#093389"; // 파랑 — 조합원이 갈 곳(출구·대오)
const REFERENCE = "#4b5563"; // 회색 — 참고 지물(기준 부지·무대·내 위치 라벨 배지)
const INK = "#1a1a1a"; // 내 위치 도트·정확도 원. **의미색을 추가하지 않는다**(§2 3종 상한)
const CASING = "#ffffff"; // 흰 casing — 타일 색을 예측하지 않고 대비를 만드는 아래층 스트로크

const toneColor = (tone: MapTone): string => (tone === "go" ? GO : REFERENCE);

/**
 * 밴드 스타일은 **확신도에서만** 파생된다(§20.20.3).
 * ⚠ **`estimated` 를 회색으로 바꾸지 마라** — 회색은 참고 지물의 색이고 대오는 갈 곳 계열이다.
 */
const BAND_STYLE: Record<
  GeoConfidence,
  {
    fillOpacity: number;
    strokeOpacity: number;
    strokeStyle: string;
    strokeWeight: number;
    /** 라벨 pill 에 붙는 접미어 — 확신도를 **문자로도** 말한다(§2 색 단독 의존 금지) */
    labelSuffix: string;
    /** 흰 casing 은 **테두리가 있는 도형에만** 깐다 */
    casing: boolean;
    zIndex: number;
  }
> = {
  verified: {
    fillOpacity: 0.2,
    strokeOpacity: 1,
    strokeStyle: "solid",
    strokeWeight: 3,
    labelSuffix: "",
    casing: true,
    zIndex: 30,
  },
  calculated: {
    fillOpacity: 0.2,
    strokeOpacity: 1,
    strokeStyle: "shortdash",
    strokeWeight: 3,
    labelSuffix: "",
    casing: true,
    zIndex: 30,
  },
  /*
   * `estimated` 밴드(§30.6). **면은 보조 채널이고 WCAG 1.4.11(비텍스트 3:1)은 테두리가 진다.**
   * ⚠ **`fillOpacity` 를 0.08 로 되돌리지 마라**(타일 대비 1.15:1 — §0.4 은폐) · **0.20 이상으로
   *   올리지도 마라**(`verified` 와 같아져 확신도 3단 위계가 무너진다).
   * ⚠ **테두리를 없애지 마라** — 없앴던 근거(두 밴드 사이 경계선 금지)는 **밴드가 2개일 때만**
   *   성립한다. **밴드가 다시 2개 이상이 되면 이 판정으로 돌아와라.**
   */
  estimated: {
    fillOpacity: 0.14,
    strokeOpacity: 1,
    /* `shortdot` — 점선은 지도학에서 **경계 불확정**을 뜻하는 관습이고,
       `verified`(solid)·`calculated`(shortdash)와 패턴으로 갈려 확신도 3단이 유지된다 */
    strokeStyle: "shortdot",
    strokeWeight: 3,
    /* **`" (범위는 근사)"` 를 되살리지 마라**(요구 156) — pill 이 길어져 인접 도형과 겹치고,
       확신도는 이미 4개 채널(그중 2개가 문자)이 져서 §2 가 충족돼 있다 */
    labelSuffix: "",
    /** 테두리가 생겼으므로 흰 casing 이 따라온다 — casing 은 **테두리가 있는 도형에만** 깐다 */
    casing: true,
    zIndex: 25,
  },
};


function featureZIndex(feature: MapFeature): number {
  switch (feature.kind) {
    case "outline":
      return 10;
    case "circle":
      return 20;
    case "band":
      return BAND_STYLE[feature.confidence].zIndex;
    case "dot":
      return 40;
    case "pin":
      return MY_LOCATION_Z;
  }
}

const MY_LOCATION_Z = 50;

/**
 * 라벨 pill HTML 의 공통 규칙.
 * - 텍스트는 **불투명 흰 pill 위**에만 올린다 — 타일 위에 직접 얹으면 대비를 계산할 수 없다.
 * - 라벨 텍스트 색은 전부 같다. **근사라고 글자를 흐리지 않는다**(§0.3).
 * - `word-break:keep-all` 필수. **라벨 문자열을 줄이지 마라** — 검증 조건이다(§20.4.2).
 */
/**
 * 로드뷰 «지금 보는 위치» 표식의 **시야 부채꼴**. 각도는 `pano.getPov().fov` 를 그대로 쓴다.
 * ⚠ **고정 상수로 되돌리지 마라** — 이 도형은 *"이만큼이 보인다"* 는 **사실 주장**이고 `fov` 는
 * 줌에 따라 변하므로 상수는 곧 거짓이 된다.
 */
const SPOT_BOX = 88;
const SPOT_CONE_RADIUS = 44;
/** `getPov().fov` 를 못 읽었을 때만 쓰는 값 — 파노라마 생성 옵션의 `fov` 와 같다 */
const SPOT_CONE_FALLBACK_FOV = 100;

/**
 * 위(진북 = `rotate(0)`)로 열린 부채꼴 경로. **꼭짓점은 박스 정중앙**이고 그 자리에 주황 점이 얹힌다.
 * SVG 는 y 가 아래로 커지므로 «위»는 `-cos` 다. `sweep-flag = 1` 이어야 바깥으로 볼록해진다.
 * ⚠ 반각이 180°를 넘으면 `large-arc-flag` 가 필요하다 — 없으면 **반대로 접힌 도형**이 된다.
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
 * 맨 휠로 지도를 확대할 기기인가 — `(hover: hover) and (pointer: fine)` = **마우스가 달린 기기**.
 * ⚠ **이 조건을 지우지 마라** — §27.13 의 위험(*"지도가 화면을 덮은 모바일에서 페이지가 안 내려간다"*)을
 * 막는 유일한 장치다. 호출 시점에 매번 잰다(마우스를 붙였다 뗐다 하는 경우까지 따라간다).
 */
function wheelZoomEnabled(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * ★ **로드뷰 «바닥을 누르면 그 방향으로 이동»** — 네이버 파노라마 API 에 이 동작을 켜는 **옵션이 없다.**
 * (공식 옵션 전수: `size`·`panoId`·`position`·`pov`·`visible`·`minScale`·`maxScale`·`minZoom`·`maxZoom`·
 *  `flightSpot`·`logoControl`·`zoomControl`·`aroundControl` — `flightSpot` 은 항공뷰 아이콘이지 이동이 아니다.
 *  이벤트도 `init`·`pano_changed`·`pano_status`·`pov_changed` 넷뿐이라 **클릭 좌표를 주는 이벤트가 없다.**)
 * 그래서 우리가 만든다: 탭 지점 → 방향 → 한 보폭 → `setPosition` 이 가장 가까운 실제 촬영점으로 붙인다.
 */

/** 두 좌표 사이 방위각(도, 진북 0 · 시계 방향) */
function bearingDeg(from: NaverLatLng, to: NaverLatLng): number {
  const rad = Math.PI / 180;
  const φ1 = from.lat() * rad;
  const φ2 = to.lat() * rad;
  const Δλ = (to.lng() - from.lng()) * rad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** 한 보폭 앞의 좌표. 이 거리에서 정확할 필요는 없다 — `setPosition` 이 실제 촬영점으로 붙인다 */
function stepAhead(
  maps: NaverMapsNamespace,
  from: NaverLatLng,
  bearing: number,
  meters: number,
): NaverLatLng {
  const rad = Math.PI / 180;
  const dLat = (meters * Math.cos(bearing * rad)) / 111320;
  const dLng = (meters * Math.sin(bearing * rad)) / (111320 * Math.cos(from.lat() * rad));
  return new maps.LatLng(from.lat() + dLat, from.lng() + dLng);
}

/** 한 걸음(m). **실측으로 고른 값** — 더 작으면 제자리처럼 보이고 더 크면 촬영점을 여러 칸 건너뛴다 */
const ROADVIEW_STEP_M = 12;
/** 이 이상 손가락이 움직였으면 **탭이 아니라 시선 회전**이다 */
const ROADVIEW_TAP_SLOP_PX = 8;
/** 이보다 오래 누르고 있었으면 탭이 아니다(길게 눌러 끄는 중일 수 있다) */
const ROADVIEW_TAP_MS = 600;
/**
 * 지평선보다 이만큼 **아래**를 눌러야 이동한다 — 하늘·건물 윗부분에서 움직이면 *"안 누른 곳으로 갔다"* 가 된다.
 * ⚠ `fromOffsetToCoord` 는 **세로를 무시**하므로 이 판정은 **우리가 해야 한다.**
 */
const ROADVIEW_HORIZON_MARGIN_PX = 10;
/** 탭을 무시할 요소 — 네이버 화살표·항공뷰·컨트롤·로고·저작권. 같이 처리하면 **두 번 움직인다** */
const ROADVIEW_IGNORE_TAP =
  '[class*="arrow"],[class*="flight"],[class*="control"],[class*="logo"],[class*="copyright"]';

/**
 * 종류 기호 픽토그램(화장실 — 파랑 남 + 주황 여). 뜻은 배지 번호·`aria-label`·범례 문자가 진다(§2).
 * ⚠ **이모지(`🚻`)를 쓰지 마라** — 플랫폼마다 그림이 다르고, 글꼴이 없으면 두부(□)로 떨어진다.
 * ⚠ **이 함수 하나에서만 나와야 한다** — 지도 배지와 범례가 같은 그림이어야 대응이 성립한다(요구 88).
 */
/* ⚠ **채도를 낮추지 마라** — 17px 로 줄면 색이 죽는다. 이 둘은 **의미색이 아니다**(화장실 관용색) */
const SYMBOL_MALE = "#1785DE";
const SYMBOL_FEMALE = "#F2492A";

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

function labelHtml(options: {
  /** `null` 이면 번호 배지를 그리지 않는다 — 내 위치는 안내도의 지점이 아니다(§20.21.1) */
  badge: string | null;
  text: string;
  placement: LabelPlacement;
  /** 앵커에서 라벨까지의 간격(px). 라벨끼리의 충돌을 푸는 유일한 자유도다 */
  gap: number;
  badgeColor: string;
  outline: "solid" | "dashed";
  outlineColor: string;
  /**
   * `false` 면 **번호 배지만** 남긴다(§21.2.2). 축소했을 때 등급이 낮은 라벨을 접는 수단이며,
   * **범례가 번호의 뜻을 계속 설명**하므로 정보 손실이 아니다.
   */
  textVisible: boolean;
  /** 겹침 판정 시 DOM 에서 찾기 위한 식별자 */
  id: string;
  /**
   * 팝업이 열려 있는 항목인가(§25.2 겹4) — `INK` 3px 링을 상시 건다.
   * ⚠ **링에 파랑·회색을 쓰지 마라** — 이 지도에서 그 둘은 확정도·성격 **의미색**이다(§20.20.3).
   */
  selected: boolean;
  /**
   * 키보드 그룹의 **현재 항목**인가(§27.8.1 roving tabindex).
   * 그룹 안에서 `tabindex="0"` 은 **하나뿐**이어야 페이지 탭 정지점이 1개로 유지된다.
   */
  focused: boolean;
  /** 번호 배지를 앵커 위에 정확히 얹는다(`kind: "dot"` 전용 — 근거는 `labelIconContent` 의 dot 분기) */
  anchored?: boolean;
  /** 번호 앞에 붙는 종류 기호. 값이 있으면 배지 배경이 **남색 → 흰색**으로 바뀐다 */
  symbol?: "toilet" | null;
  /** `symbol` 이 있을 때 번호 칩에 넣을 **민글자 숫자**(`④` 가 아니라 `4`) — 17px 칩에서 겹동그라미는 안 읽힌다 */
  symbolNumber?: string;
}): string {
  /* `gap`(앵커↔라벨)의 좌우 28px 은 실측값이다 — 16px 이면 360px 에서 ①과 ④ pill 이 3px 겹쳤다.
     값 자체는 `labelPlacementAt`(`src/lib/rallyMap.ts`)이 정한다 */
  const {
    badge,
    text,
    placement,
    gap,
    badgeColor,
    outline,
    outlineColor,
    textVisible,
    id,
    selected,
    focused,
    anchored = false,
    symbol = null,
    symbolNumber = "",
  } = options;
  /*
   * 마커는 **포커스 가능한 버튼**이다(§27.8.2).
   * ⚠ `aria-hidden` 을 되살리지 마라 — 포커스 가능한 채로 숨기면 WCAG 2.4.3·4.1.2 즉시 위반이다.
   *   **`aria-hidden` 과 포커스 가능 여부는 한 쌍으로 움직인다.**
   * ⚠ `aria-label` 은 **`{번호} {이름}`** 으로 짧게 — 길게 쓰면 그룹 순회 때 범례 전문이 반복된다(§27.8.3).
   */
  const a11y =
    `id="rally-marker-${id}" role="button" tabindex="${focused ? 0 : -1}"` +
    ` aria-label="${badge === null ? text : `${badge} ${text}`}"` +
    ` aria-pressed="${selected ? "true" : "false"}"`;
  /* 선택 링은 흰 테두리 **바깥**에 얹는다 — 배지·pill 모두 같은 방식(§25.6.2) */
  const ring = selected ? `box-shadow:0 0 0 3px ${INK};` : "";
  // 배지만 남길 때는 pill 을 그리지 않는다 — 흰 면이 남으면 접은 의미가 없다
  const badgeOnly = !textVisible && badge !== null;
  const place =
    placement === "right"
      ? `left:${gap}px;top:0;transform:translateY(-50%);`
      : placement === "left"
        ? `right:${gap}px;top:0;transform:translateY(-50%);`
        : placement === "top"
          ? `left:0;bottom:${gap}px;transform:translateX(-50%);`
          : `left:0;top:${gap}px;transform:translateX(-50%);`;
  const pillBorder =
    outline === "dashed"
      ? `border:1.5px dashed ${outlineColor};`
      : `border:1px solid ${outlineColor};`;
  // 배지가 없으면 왼쪽 여백을 배지 자리만큼 좁힌다(배지 4px + 24px + gap 6px → 12px)
  const pad = badge === null ? "4px 12px" : "4px 10px 4px 4px";

  if (badgeOnly) {
    /*
     * 접힌 상태: 번호 원(28px) + 흰 링·그림자. 히트 영역은 **44×44px**(요구 D · §25.8) —
     * **시각 크기는 28px 그대로**이고 투명하게만 넓힌다(`data-rally-badge` 는 보이는 원에 붙는다).
     * ⚠ **면(밴드·외곽선)을 가진 항목의 배지를 앵커 위에 얹지 마라**(도형 외곽선을 덮는다) —
     *   `anchored` 는 **점 전용 예외**다(점에는 덮을 면이 없고 배지가 도트를 대체한다).
     * ⚠ **히트를 44 보다 키우지 마라** — ④⑤ 중심 간 dx 가 49px 이라 ⑤ 를 눌렀는데 ④ 가 열린다.
     * ⚠ **확신도(실선/점선)를 배지 테두리가 이어받는다**(§30.7.2 · 요구 152) — 지우면 **확인 지점과
     *   근사 지점이 지도 위에서 완전히 똑같아진다**(`solid` = 확인 / `dashed` = 근사).
     */
    const anchorPlace = anchored ? "left:0;top:0;transform:translate(-50%,-50%);" : place;
    /*
     * 종류 기호가 있으면 배지 본체가 픽토그램이 되고 번호는 **왼쪽 아래 칩**으로 내려간다.
     * ⚠ **번호를 없애지 마라** — 범례의 화장실 행이 서로 구분되지 않고 `※ …번호를 누르면` 이 거짓이 된다.
     * ⚠ **칩을 오른쪽·위로 키우지 마라**(그 두 경계는 28px 원 그대로) — 알약으로 넓혔더니 bbox 동단
     *   지점이 지도 오른쪽 끝에서 잘렸다. **바탕이 흰색인 이유**: 컬러 픽토그램은 짙은 남색 위에서
     *   제 색이 죽는다(확신도는 테두리가 진다).
     */
    if (symbol !== null) {
      const symbolBorder = outline === "dashed" ? `2px dashed ${badgeColor}` : `2px solid ${badgeColor}`;
      return [
        `<div data-rally-label="${id}" data-rally-folded="1" style="position:relative;width:0;height:0;">`,
        `<span data-rally-hit="${id}" ${a11y} style="position:absolute;${anchorPlace}width:28px;height:28px;cursor:pointer;">`,
        `<span style="position:absolute;left:-8px;top:-8px;width:44px;height:44px;"></span>`,
        `<span data-rally-badge="${id}" style="position:absolute;inset:0;box-sizing:border-box;`,
        `display:flex;align-items:center;justify-content:center;border-radius:9999px;background:#ffffff;`,
        `border:${symbolBorder};${ring}`,
        `box-shadow:0 1px 3px rgb(0 0 0 / .35)${selected ? `,0 0 0 3px ${INK}` : ""};">`,
        symbolSvg(symbol, 20),
        "</span>",
        /* 번호 칩 — `data-rally-number` 는 **화면에 번호가 있는 것 전부**를 세는 표식이다(요구 86) */
        `<span data-rally-number="${id}" aria-hidden="true" style="position:absolute;left:-7px;bottom:-7px;width:17px;height:17px;box-sizing:border-box;`,
        `display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${badgeColor};`,
        `border:1.5px solid #ffffff;color:#ffffff;font-size:11px;font-weight:700;line-height:1;`,
        `box-shadow:0 1px 2px rgb(0 0 0 / .3);">${symbolNumber}</span>`,
        `</span></div>`,
      ].join("");
    }
    const badgeBorder = outline === "dashed" ? "2px dashed #ffffff" : "2px solid #ffffff";
    return [
      `<div data-rally-label="${id}" data-rally-folded="1" style="position:relative;width:0;height:0;">`,
      `<span data-rally-hit="${id}" ${a11y} style="position:absolute;${anchorPlace}width:28px;height:28px;cursor:pointer;">`,
      `<span style="position:absolute;left:-8px;top:-8px;width:44px;height:44px;"></span>`,
      `<span data-rally-badge="${id}" data-rally-number="${id}" style="position:absolute;inset:0;box-sizing:border-box;`,
      `border-radius:9999px;background:${badgeColor};border:${badgeBorder};color:#ffffff;`,
      `font-size:15px;font-weight:700;line-height:24px;text-align:center;${ring}`,
      `box-shadow:0 1px 3px rgb(0 0 0 / .35)${selected ? `,0 0 0 3px ${INK}` : ""};">${badge}</span>`,
      /* 종류 칩 자리(현재 비어 있음) — 위 `symbol !== null` 분기가 픽토그램 배지를 그린다 */
      "",
      `</span></div>`,
    ].join("");
  }
  return [
    `<div data-rally-label="${id}" style="position:relative;width:0;height:0;">`,
    /* pill 도 눌리면 팝업이 열린다(§25.2 겹2) — 일부만 안 눌리면 마커가 두 종류로 갈린다.
       ⚠ **pill 히트를 44px 로 늘리지 마라** — 배지 히트와 겹친다(§25.8.1) */
    `<div data-rally-pill="${id}" data-rally-hit="${id}" ${a11y} style="position:absolute;${place}box-sizing:border-box;display:flex;align-items:center;gap:6px;cursor:pointer;`,
    `background:#ffffff;${pillBorder}border-radius:9999px;padding:${pad};`,
    `box-shadow:0 1px 4px rgb(0 0 0 / .30)${selected ? `,0 0 0 3px ${INK}` : ""};font-size:15px;font-weight:600;color:${INK};`,
    /* width:max-content 가 없으면 안 된다 — 앵커가 0폭 컨테이닝 블록이라 절대배치 요소의
       shrink-to-fit 가용폭이 0 으로 계산되고, 라벨이 **min-content(글자 몇 개씩)로 접힌다.** */
    "line-height:1.3;white-space:normal;word-break:keep-all;width:max-content;",
    `max-width:var(${LABEL_MAX_WIDTH_VAR},60%);">`,
    badge === null
      ? ""
      : /* `data-rally-number` = 화면에 번호가 있는 것 전부(요구 86) · `data-rally-badge` = **접힌 배지 전용**
           (§22·§23 실측 기준값이 그 셀렉터에 묶여 있다 — 붙이는 자리를 바꾸지 마라) */
        `<span data-rally-number="${id}" style="flex:0 0 24px;width:24px;height:24px;border-radius:9999px;background:${badgeColor};color:#ffffff;font-size:15px;font-weight:700;line-height:24px;text-align:center;">${badge}</span>`,
    /* pill 안 글자는 `aria-label` 과 같은 내용이라 숨긴다 — 안 숨기면 두 번 읽힌다 */
    '<span aria-hidden="true">',
    text,
    "</span></div></div>",
  ].join("");
}

/**
 * 내 위치 핀 — 물방울 24×32px. **앵커는 핀 끝(하단 꼭짓점)** 이고 그 점이 좌표다.
 * ① 5번 출구의 원형 도트와 **형태가 명확히 다르다**(원형 vs 물방울) — 12px 에서도 구분된다.
 */
function pinHtml(): string {
  return [
    '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
    '<svg width="24" height="32" viewBox="0 0 24 32" ',
    'style="position:absolute;left:-12px;top:-32px;filter:drop-shadow(0 1px 3px rgb(0 0 0 / .35));">',
    '<path d="M12 1.2C6.1 1.2 1.3 6 1.3 11.9c0 7.6 8.9 17.9 9.9 19.1a1.1 1.1 0 0 0 1.6 0c1-1.2 9.9-11.5 9.9-19.1C22.7 6 17.9 1.2 12 1.2Z" ',
    `fill="${INK}" stroke="#ffffff" stroke-width="2"/></svg></div>`,
  ].join("");
}

/*
 * ⚠ **`dotHtml`·`dashedDotHtml`(확신도 도트)을 되살리지 마라 — 먼저 판정을 뒤집어라.**
 * 점(`dot`)은 **번호 배지 자체가 그 지점**이라, 도트를 따로 찍으면 한 지점에 표식이 둘이 되고
 * 그것이 화장실 4개를 8개처럼 보이게 만들던 원인이다. 확신도 축은 `badgeBorder` 가 이어받았다.
 * (그림이 다시 필요하면 git 이력에 있다 — 점 간격은 임의로 고르면 이음매가 깨진다.)
 */

/**
 * 도형 1개를 **흰 casing(아래층) + 본체(위층)** 2겹으로 만든다(§20.4.2).
 * 타일 색은 예측할 수 없으므로 **흰 굵은 스트로크를 아래 깔아** 타일이 밝든 어둡든 두 경계 중
 * 한쪽이 대비를 만들게 한다 — 배경을 가정하지 않고 대비를 보장하는 유일한 구조적 수단이다.
 */
function drawFeature(
  maps: NaverMapsNamespace,
  map: NaverMap,
  feature: MapFeature,
): NaverOverlay[] {
  const color = toneColor(feature.tone);
  const z = featureZIndex(feature);
  const casingZ = z - 1;

  switch (feature.kind) {
    case "dot":
    case "pin":
      // 점·핀은 HTML 마커가 곧 도형이다. **내 위치에 정확도 원을 그리지 마라**(§20.21.1)
      return [];

    case "outline": {
      /* ⚠ **bbox 사각형으로 그리지 마라.** 부지가 도로와 나란한 평행사변형이라 축정렬 bbox 는
         면적을 1.8배로 부풀리고 북동 모서리가 대오 밴드를 침범한다 */
      const path = feature.polygon.map(([lat, lng]) => new maps.LatLng(lat, lng));
      return [
        new maps.Polygon({
          map,
          paths: [path],
          strokeColor: CASING,
          strokeWeight: 5,
          strokeOpacity: 1,
          fillColor: CASING,
          fillOpacity: 0,
          clickable: false,
          zIndex: casingZ,
        }),
        /* ⚠ **채움을 넣지 마라**(§5-13-6) — 부지는 위치 기준 지물이라 면을 채우면 대오 밴드와
           같은 위계로 읽혀 "여기 모인다"로 오독된다. 선도 밴드(3px)보다 가늘다(2px) */
        new maps.Polygon({
          map,
          paths: [path],
          strokeColor: color,
          strokeWeight: 2,
          strokeOpacity: 1,
          strokeStyle: "solid",
          fillColor: color,
          fillOpacity: 0,
          clickable: false,
          zIndex: z,
        }),
      ];
    }

    case "circle": {
      const center = new maps.LatLng(feature.center.lat, feature.center.lng);
      return [
        new maps.Circle({
          map,
          center,
          radius: feature.radiusMeters,
          strokeColor: CASING,
          strokeWeight: 7,
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
          strokeWeight: 3,
          strokeOpacity: 1,
          strokeStyle: "shortdash",
          fillColor: color,
          fillOpacity: 0.1,
          clickable: false,
          zIndex: z,
        }),
      ];
    }

    case "band": {
      const style = BAND_STYLE[feature.confidence];
      const path = feature.polygon.map(([lat, lng]) => new maps.LatLng(lat, lng));
      const overlays: NaverOverlay[] = [];
      if (style.casing) {
        overlays.push(
          new maps.Polygon({
            map,
            paths: [path],
            strokeColor: CASING,
            strokeWeight: 7,
            strokeOpacity: 1,
            fillColor: CASING,
            fillOpacity: 0,
            clickable: false,
            zIndex: casingZ,
          }),
        );
      }
      overlays.push(
        new maps.Polygon({
          map,
          paths: [path],
          strokeColor: color,
          strokeWeight: style.strokeWeight,
          strokeOpacity: style.strokeOpacity,
          strokeStyle: style.strokeStyle,
          fillColor: color,
          fillOpacity: style.fillOpacity,
          clickable: false,
          zIndex: z,
        }),
      );
      return overlays;
    }
  }
}

/**
 * 선택된 항목의 **헤일로**(강조 층) — 도형 *아래*에 깔리는 별도 오버레이다.
 * ⚠ **도형 자신의 스타일을 바꾸지 마라** — 선굵기·채움·선종은 `confidence` 에서만 파생되므로
 *   선택으로 흔들면 **"확신도가 올라갔다"로 읽힌다**(§20.20.3).
 * ⚠ **새 색을 만들지 마라**(§2 3종 상한) · **`zIndex` 를 casing 위로 올리지 마라**(§20.4.2 두 겹 구조).
 * **점·핀은 헤일로를 만들지 않는다** — 라벨 마커가 이미 링을 두르고, 미터 반경 원은 축소하면
 * 도트보다 작아진다.
 */
function createHighlight(
  maps: NaverMapsNamespace,
  map: NaverMap,
  feature: MapFeature,
): NaverOverlay[] {
  const color = toneColor(feature.tone);
  /** casing(`z - 1`)보다 **한 단 더 아래**. 두 겹 구조를 덮지 않는다 */
  const z = featureZIndex(feature) - 2;
  const style = {
    map,
    strokeColor: color,
    strokeWeight: 14,
    strokeOpacity: 0.3,
    strokeStyle: "solid" as const,
    fillColor: color,
    fillOpacity: 0.18,
    clickable: false,
    zIndex: z,
  };

  switch (feature.kind) {
    case "dot":
    case "pin":
      return [];
    case "circle":
      return [
        new maps.Circle({
          ...style,
          center: new maps.LatLng(feature.center.lat, feature.center.lng),
          radius: feature.radiusMeters,
        }),
      ];
    case "outline":
    case "band":
      return [
        new maps.Polygon({
          ...style,
          paths: [feature.polygon.map(([lat, lng]) => new maps.LatLng(lat, lng))],
        }),
      ];
  }
}

/** 변하지 않는 외부 상태의 구독자 — `useSyncExternalStore` 계약을 만족시키는 no-op */
const subscribeNever = (): (() => void) => () => {};

/**
 * 항목 1개의 **라벨 마커**를 만든다(도형은 `drawFeature` 가 담당).
 * 번호 배지는 `numbered !== false` 인 항목에만 붙고, 배지 문자는 **배열 순서에서** 나온다.
 */
function labelIconContent(
  feature: MapFeature,
  index: number,
  textVisible: boolean,
  zoom?: number,
  selected = false,
  focused = false,
): string {
  const color = toneColor(feature.tone);
  const suffix = feature.kind === "band" ? BAND_STYLE[feature.confidence].labelSuffix : "";
  /* **점(`dot`)은 도형을 따로 그리지 않는다 — 번호 배지가 곧 그 지점이다.**
     ⚠ **`pin`(내 위치)은 그대로 둔다** — 앵커가 핀 끝이라 성질이 다르고 번호가 없다(§20.21.1) */
  const shape = feature.kind === "pin" ? pinHtml() : "";
  // 방향·간격 해석은 `labelPlacementAt` 하나가 담당한다(§23.2.3) — 여기서 분기하지 마라
  const { placement, gap } = labelPlacementAt(feature, zoom);
  return (
    shape +
    labelHtml({
      badge: feature.numbered === false ? null : circledNumber(index),
      text: `${feature.label}${suffix}`,
      placement,
      gap,
      badgeColor: color,
      outline: feature.outline,
      outlineColor: color,
      textVisible,
      id: feature.id,
      selected,
      focused,
      anchored: feature.kind === "dot",
      symbol: feature.symbol ?? null,
      symbolNumber: String(index + 1),
    })
  );
}

/** 라벨 마커 + 줌에 따라 아이콘을 갈아끼우는 데 필요한 정보 */
interface LabelEntry {
  marker: NaverMarker;
  feature: MapFeature;
  index: number;
}

/**
 * 항목 1개의 **라벨 마커**를 만든다(도형은 `drawFeature` 가 담당).
 * 번호 배지는 `numbered !== false` 인 항목에만 붙고, 배지 문자는 **배열 순서에서** 나온다.
 */
function createLabelMarker(
  maps: NaverMapsNamespace,
  map: NaverMap,
  feature: MapFeature,
  index: number,
  textVisible: boolean,
  zoom?: number,
): NaverMarker {
  const anchor = featureLabelAnchor(feature, zoom);
  return new maps.Marker({
    map,
    position: new maps.LatLng(anchor.lat, anchor.lng),
    icon: {
      content: labelIconContent(feature, index, textVisible, zoom),
      anchor: new maps.Point(0, 0),
    },
    // 배지·pill 을 눌러 팝업을 연다(§25.4). **도형은 클릭 대상이 아니다** — 어포던스 문구가
    // `번호를 누르면` 이라 도형을 눌리게 만들면 그 문안이 거짓이 된다(§25.2.1)
    clickable: true,
    /*
     * 적층(§34 · §22.10 2-C) — **번호가 없는 라벨(= 사용자 표식)은 안내도 라벨 전체보다 아래.**
     * 위에 두면 그 pill 이 배지의 히트 영역을 가로채 **누른 팝업이 안 열린다.** 시각 가림과 달리
     * **히트 가로채기는 조합원이 해소할 수 없다** — 2-C: 가로채기 0, 양보 불가.
     * ⚠ **`id === "my-location"` 로 분기하지 마라**(§20.20.2 계열) — 기준은 *"사용자 표식인가"* 라
     *   **`numbered === false`** 로 가른다(다음 사용자 표식이 생겨도 규칙이 따라온다).
     * ⚠ **`LABEL_Z_BASE - 1` 을 더 내리지 마라**(도형 z 보다 위여야 핀이 안 가린다) ·
     *   **`MY_LOCATION_Z`(도형 z)는 다른 축이다. 건드리지 마라.**
     */
    zIndex: feature.numbered === false ? LABEL_Z_BASE - 1 : LABEL_Z_BASE + index,
  });
}

/**
 * 키보드 그룹의 **진입 첫 지점**(§27.8.1) — 조합원이 확실히 가야 하는 «행동의 시작점»이어야 한다.
 * 구역 좌표가 확정돼 집결 지점이 «확인»으로 올라가면 **진입 지점을 그쪽으로 옮기는 것을 검토하라.**
 */
const KEYBOARD_ENTRY_ID = "exit5";

/** 그룹 안 순회 순서 — 지도 안 `+`·`−` 다음에 지도 지점 6개(배열 순서 = 번호 순서) */
function keyboardOrder(): string[] {
  return ["rally-zoom-in", "rally-zoom-out", ...MAP_FEATURES.map((f) => f.id)];
}

/** 라벨을 다시 그리는 데 필요한 것 전부 — **페이지 지도와 전체 화면 지도가 이 함수 하나를 공유한다** */
interface LabelPaintContext {
  labels: LabelEntry[];
  /** 겹침 때문에 접힌 항목(히스테리시스 상태) — 함수가 갱신한다 */
  folded: Set<string>;
  selectedId: string | null;
  /** 키보드 그룹의 현재 항목 — roving tabindex 를 아이콘에 반영한다(§27.8.1) */
  focusedId: string | null;
  node: HTMLElement | null;
}

/**
 * 줌·선택·포커스 상태를 라벨 아이콘에 반영한다(§21.2 · §25.2 · §27.8).
 * ⚠ **모듈 함수로 둔다** — 전체 화면 지도가 같은 규칙을 쓰는데 두 벌이면 한쪽만 고쳐진다(§27.14.4-3).
 */
function paintLabels(ctx: LabelPaintContext, currentZoom: number): void {
  const { labels: entries, folded, selectedId, focusedId, node } = ctx;
  if (entries.length === 0) return;

  /* 텍스트 pill 노출 = **`textMode === "always"` 인 항목만**(§25.1) — `popup` 항목은 줌이 올라가도
     텍스트를 띄우지 않는다(이름은 클릭 팝업이 진다). `always` 안에서는 등급 임계가 적용된다 */
  const visible = new Map<string, boolean>();
  for (const e of entries) {
    visible.set(
      e.feature.id,
      e.feature.textMode === "always" &&
        currentZoom >= LABEL_PRIORITY_MIN_ZOOM[e.feature.labelPriority],
    );
  }
  const maps = window.naver?.maps;
  const paint = () => {
    for (const e of entries) {
      const icon: NaverMarkerIcon = {
        content: labelIconContent(
          e.feature,
          e.index,
          visible.get(e.feature.id) === true,
          currentZoom,
          selectedId === e.feature.id,
          focusedId === e.feature.id,
        ),
        anchor: { x: 0, y: 0 },
      };
      e.marker.setIcon(icon);
      /*
       * `minZoomOverride` 는 방향을 바꾸므로 **앵커 좌표도 함께 바뀐다**(§23.2.3).
       * 아이콘만 갈아끼우면 라벨이 옛 앵커에 붙은 채 방향만 뒤집혀 **엉뚱한 곳을 가리킨다.**
       */
      if (maps !== undefined && e.feature.minZoomOverride !== undefined) {
        const at = featureLabelAnchor(e.feature, currentZoom);
        e.marker.setPosition(new maps.LatLng(at.lat, at.lng));
      }
    }
    /* 아이콘 교체는 DOM 을 갈아치우므로 **포커스가 날아간다** — 그린 직후 되돌린다(§27.8.1).
       ⚠ **이미 그룹 안에 포커스가 있을 때만** 되돌린다 — 조건 없이 부르면 모달이 열릴 때
       `닫기` 로 보내 둔 초기 포커스를 지도가 빼앗는다 */
    if (focusedId !== null && node !== null) {
      const active = document.activeElement;
      const inGroup =
        active instanceof HTMLElement &&
        (active.closest("[data-rally-hit]") !== null || active.id.startsWith("rally-zoom"));
      if (inGroup) {
        const el = node.querySelector<HTMLElement>(`[data-rally-hit="${focusedId}"]`);
        if (el !== null && document.activeElement !== el) el.focus({ preventScroll: true });
      }
    }
  };
  paint();

  // 그린 뒤 실제 사각형으로 겹침을 판정하고, 낮은 등급을 접는다
  if (node === null) return;
  requestAnimationFrame(() => {
    const rects: { id: string; rank: number; r: DOMRect }[] = [];
    for (const e of entries) {
      if (visible.get(e.feature.id) !== true) continue;
      const el = node.querySelector(`[data-rally-pill="${e.feature.id}"]`);
      if (el === null) continue;
      rects.push({
        id: e.feature.id,
        rank: PRIORITY_RANK[e.feature.labelPriority],
        r: el.getBoundingClientRect(),
      });
    }
    rects.sort((a, b) => a.rank - b.rank);
    const kept: typeof rects = [];
    const foldedNow = new Set<string>();
    let changed = false;
    for (const cand of rects) {
      /* **히스테리시스**(§21.9.3) — 접는 기준(교차 0)과 펴는 기준(8px 이격)이 다르다.
         ⚠ 한 값으로 양방향을 판정하면 경계에서 **라벨이 깜빡인다** */
      const margin = folded.has(cand.id) ? LABEL_REVEAL_GAP : LABEL_MIN_GAP;
      const hit = kept.some(
        (k) =>
          Math.min(k.r.right, cand.r.right) - Math.max(k.r.left, cand.r.left) > -margin &&
          Math.min(k.r.bottom, cand.r.bottom) - Math.max(k.r.top, cand.r.top) > -margin,
      );
      // `primary` 는 겹쳐도 접지 않는다 — 접으면 지도가 핵심 정보를 잃는다
      if (hit && cand.rank > 0) {
        visible.set(cand.id, false);
        foldedNow.add(cand.id);
        changed = true;
      } else {
        kept.push(cand);
      }
    }
    folded.clear();
    for (const id of foldedNow) folded.add(id);
    if (changed) paint();
  });
}

/**
 * `내 위치` 라벨의 **박스 경계 x 클램프**(§30.16.3-1 · §30.17.1 — **필수**). `placement: "right"` 인데
 * 3구역이 지도 동쪽 끝이라 **가장 흔한 상황에서 pill 이 박스 밖으로 나간다.** 고정 방향으로는 못 푼다.
 * ⚠ **스펙 숫자로 계산하지 마라**(내용이 런타임에 정해지는 유일한 라벨이라 모델이 폭을 못 잡는다) ·
 *   **적용 대상은 `my-location` 하나뿐. 고정 항목에 걸지 마라.**
 * ⚠ **y 는 건드리지 마라**(핀과의 수직 관계가 깨진다) — 그래서 `transform` 이 아니라 `margin-left` 다.
 * ⚠ **안내도 라벨을 `내 위치` 때문에 옮기지 마라**(누르지 않은 조합원 전원이 비용을 낸다) —
 *   남는 겹침은 허용한다(§30.16.3-2 · 범례가 같은 내용을 문자로 갖고 있어 은폐가 아니다).
 */
function clampMyLocationLabel(node: HTMLElement | null, box: HTMLElement | null): void {
  if (node === null || box === null) return;
  const pill = node.querySelector<HTMLElement>('[data-rally-pill="my-location"]');
  if (pill === null) return;
  /* 이전 보정을 지우고 **원래 자리에서 다시 잰다** — 누적하면 팬할 때마다 라벨이 기어간다 */
  pill.style.removeProperty("margin-left");
  const b = box.getBoundingClientRect();
  const r = pill.getBoundingClientRect();
  const min = b.left + MY_LOCATION_CLAMP_INSET;
  const max = b.right - MY_LOCATION_CLAMP_INSET;
  let dx = 0;
  if (r.right > max) dx = max - r.right;
  /* 왼쪽이 더 급하다 — 오른쪽으로 밀어 왼쪽이 잘리면 클램프가 스스로 결함을 만든다 */
  if (r.left + dx < min) dx = min - r.left;
  if (dx !== 0) pill.style.marginLeft = `${dx}px`;
}

/** 모달 배경 스크롤 잠금(§23.1.5) — `showModal()` 과 **별도로** 잠근다(브라우저마다 처리가 다르다).
    잠글 때의 `scrollY` 를 돌려주고 푸는 쪽이 그 값을 복원한다 */
function lockBodyScroll(): number {
  const y = window.scrollY;
  const body = document.body;
  body.style.position = "fixed";
  body.style.top = `-${y}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.overflow = "hidden";
  return y;
}

/**
 * 잠금 해제 + 위치 복원. **셋이 모두 필요하다 — 하나만 빠져도 어긋난다:** ① **레이아웃 강제 반영**
 * (`void body.offsetHeight` — `fixed` 를 막 푼 시점에는 문서 높이가 뷰포트 높이라 `scrollTo` 가 **0 으로
 * 잘린다**) ② **`behavior:"instant"`**(이 사이트는 `scroll-behavior: smooth` 라 브라우저 복원과 경합한다)
 * ③ 호출부의 **`focus({ preventScroll: true })`**(기본 `focus()` 는 스크롤을 옮긴다)
 */
function unlockBodyScroll(y: number): void {
  const body = document.body;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.overflow = "";
  void body.offsetHeight;
  window.scrollTo({ top: y, left: 0, behavior: "instant" });
}

/**
 * 지점 팝업 — **박스 안 고정 패널**(§25.4~§25.6). 두 지도가 **이 한 벌을 공유한다.**
 * 가로는 박스에 고정이고 세로만 마커 반대편에 붙는다 — **좌우 잘림이 계산이 아니라 구조로 0**이다.
 * ⚠ **팝업에 `aria-hidden` 을 걸지 마라**(§27.8.2) — 안에 포커스 가능 요소(`닫기`)가 있어 즉시 위반이다.
 */
function MapPopupPanel({
  feature,
  index,
  side,
  onClose,
  onRoadview,
}: {
  feature: MapFeature;
  index: number;
  side: "top" | "bottom";
  onClose: () => void;
  /** 이 지점의 로드뷰를 연다. `null` 이면 버튼을 렌더하지 않는다(파노라마 모듈 미로드 등) */
  onRoadview: ((feature: MapFeature) => void) | null;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* 열리면 **팝업으로 포커스를 옮긴다**(§27.8.2 · 되돌리기는 호출부) — 안 옮기면 마커 아이콘이 다시
     그려지며 포커스가 `body` 로 떨어져 **Tab 이 페이지 처음부터 순회한다.**
     의존성이 `feature.id` 인 이유: 다른 지점으로 **교체**될 때도 새 내용으로 다시 읽혀야 한다 */
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [feature.id]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`rounded-card shadow-card absolute inset-x-4 z-20 mx-auto max-w-[480px] border-2 border-border-strong bg-bg p-3 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 ${
        side === "top" ? "top-4" : "bottom-4"
      }`}
    >
      <p className="flex items-start gap-2 text-[16px] font-bold leading-snug text-ink">
        {/* 팝업↔지도 대응의 절반을 이 배지가 진다 — 빼지 마라(§25.6.2) */}
        <span
          className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-bg"
          style={{ background: toneColor(feature.tone) }}
        >
          {circledNumber(index)}
        </span>
        <span className="break-keep break-words">{feature.label}</span>
      </p>
      {/* 본문은 **범례에서 파생**한다. ⚠ 별도 문자열 상수를 만들지 마라 — 한쪽만 고쳐진다(요구 88) */}
      <p className="mt-1.5 break-keep break-words text-caption leading-[1.55] text-ink">
        {feature.legend}
      </p>
      {/*
        거리 등 팝업 전용 보탬(정의는 `MapFeature.popupNote`). ⚠ **조판을 바꾸지 마라**(§30.18):
        **줄을 쪼갠다**(이으면 두 값이 단일 범위로 되읽힌다 — 범위가 아니라 선택지다) ·
        **`<br>` 금지**(안쪽 `block` span 이라야 `break-keep` 이 동작한다) ·
        **줄 사이 `mt` 금지**(그래야 한 덩어리로 묶인다) · **`<strong>` 이 아니라 `font-semibold`**.
      */}
      {feature.popupNote !== undefined ? (
        <p className="mt-2 break-keep break-words text-caption leading-[1.55] text-ink">
          <span className="block">{feature.popupNote.lead}</span>
          {feature.popupNote.rows.map((row) => (
            <span key={row.label} className="block">
              {row.label} <span className="font-semibold">{row.value}</span>
            </span>
          ))}
        </p>
      ) : null}
      {/*
        로드뷰 진입점 — **각 지점 팝업이 자기 로드뷰를 연다.**
        ⚠ **`닫기` 보다 앞에 둔다** — 팝업을 연 다음 행동이 "더 보기"이고 `닫기` 는 마지막이다.
        ⚠ **`onRoadview` 가 `null` 이면 렌더하지 않는다** — 눌러도 아무 일 없는 죽은 어포던스를 두지 않는다.
      */}
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        {onRoadview !== null ? (
          <button
            type="button"
            onClick={() => onRoadview(feature)}
            className={POPUP_BUTTON_CLASS}
          >
            로드뷰 보기
          </button>
        ) : null}
        <button type="button" onClick={onClose} className={POPUP_BUTTON_CLASS}>
          닫기
        </button>
      </div>
    </div>
  );
}

/**
 * 팝업 안 버튼 — `CONTROL_CLASS` 의 **좁은 면 판**(글자 15px · `px-4`).
 * ⚠ **`min-h-touch`(44px)를 줄이지 마라**(터치 하한 · 야외 장갑) — 더 작아 보이게 하려면
 * **높이가 아니라 글자·여백**을 건드려라.
 */
const POPUP_BUTTON_CLASS =
  "ease-out-soft inline-flex min-h-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-primary bg-bg px-4 text-caption font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/**
 * 지도 안 컨트롤 — **남색 면 + 흰 글자**(대비 12.6 · AAA). 배경이 매 프레임 바뀌므로 테두리가 아니라
 * **채운 면**이 어디서나 같은 세기로 읽힌다.
 * ⚠ **반투명으로 만들지 마라**(§27.4.2) — 대비를 보장할 수 없다.
 * ⚠ **44px 높이를 줄이지 마라**(터치 하한 · 야외 장갑). `h-[44px]` 는 **`h-11` 이 아니다** —
 *   `h-11` 은 글자 크기 75% 에서 33px 로 줄어든다.
 * ⚠ 포커스 링은 **버튼 바깥** — 남색 면 위에 남색 링은 안 보인다.
 */
const MAP_CTRL_BASE =
  "ease-out-soft flex h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap px-3 text-[13px] font-bold transition-opacity duration-150 hover:opacity-85 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";
/** 기본 상태. 비활성은 **면을 밝게 빼서** 남색 무리 안에서 «지금은 안 됨»이 한눈에 보이게 한다 */
const MAP_CTRL_CLASS = `${MAP_CTRL_BASE} bg-primary text-white disabled:bg-surface disabled:text-ink-muted`;
/** 눌린(켜진) 상태 — **색을 뒤집는다.** 뜻은 `aria-pressed` 와 라벨이 함께 진다(§2) */
const MAP_CTRL_ON_CLASS = `${MAP_CTRL_BASE} bg-bg text-primary`;

/**
 * 컨트롤 묶음 — 한 덩어리로 둥글게 자르고 사이를 가는 흰 선으로 나눈다.
 * ⚠ **아래 두 모서리에 두지 마라**(§22.10 2-B) — 축척 바·네이버 로고·`© NAVER Corp.` 가 이미 쓴다.
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
 * 지도 안 **거리뷰 토글**. 켜진 상태를 색으로만 말하지 않는다(§2 — `aria-pressed` 와 라벨이 함께 진다).
 * ⚠ **로빙 그룹(`itemProps`)에 넣지 마라 — 키보드로 도달할 수 없게 된다.** `keyboardOrder()` 에
 *   이 버튼이 없어 **영원히 `tabIndex={-1}`** 이 된다. 지금은 평범한 탭 정지점이다.
 * ⚠ **글자 버튼이다. 정사각 44px 로 못박지 마라** — `거리`/`뷰` 두 줄로 깨진다.
 */
function StreetToggleButton({
  on,
  onToggle,
  buttonRef,
}: {
  on: boolean;
  onToggle: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      aria-pressed={on}
      aria-label={on ? "거리뷰 모드 끄기" : "거리뷰 모드 켜기"}
      title={on ? "거리뷰 모드 끄기" : "거리뷰 모드 켜기"}
      onClick={onToggle}
      className={on ? MAP_CTRL_ON_CLASS : MAP_CTRL_CLASS}
    >
      거리뷰
    </button>
  );
}

/**
 * 지도 안 확대·축소(§27.4).
 * ⚠ **지우지 마라 — 키보드로 확대할 길이 이 버튼뿐이다.** `keyboardShortcuts: false` 이고(켜면
 *   화살표 키가 마커 로빙 그룹과 충돌한다) `keyboardOrder()` 의 **첫 두 정지점이 이 버튼들**이다.
 * ⚠ **`+`·`−` 를 텍스트 문자로 쓰지 마라**(§16.12.3) — 서체마다 위치·크기가 튄다. SVG 다.
 */
function ZoomButtons({
  zoom,
  onZoom,
  itemProps,
}: {
  zoom: number | null;
  onZoom: (delta: number) => void;
  itemProps?: (id: string) => { id: string; tabIndex: number };
}) {
  return (
    <>
      <button
        type="button"
        aria-label="확대"
        title="확대"
        onClick={() => onZoom(1)}
        disabled={zoom !== null && zoom >= MAP_MAX_ZOOM}
        className={MAP_CTRL_CLASS}
        {...itemProps?.("rally-zoom-in")}
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
        disabled={zoom !== null && zoom <= MAP_MIN_ZOOM}
        className={MAP_CTRL_CLASS}
        {...itemProps?.("rally-zoom-out")}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

/** 내 위치 — 조준선. `아이콘 1개 = 뜻 1개` 를 지키려 글자를 넣지 않는다(뜻은 `aria-label`·`title`) */
function MyLocationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <circle cx="12" cy="12" r="6.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <path
        d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 크게 보기 — 네 모서리로 벌어지는 표시 */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M9 3.5H3.5V9M15 3.5h5.5V9M9 20.5H3.5V15M15 20.5h5.5V15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 처음 위치로 — 되돌리는 화살표 */
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

/**
 * `prefers-reduced-motion: reduce` — 참이면 지도 이동·확대를 **애니메이션 없이 즉시** 처리한다(§21.1.4).
 * 매 호출마다 읽는 이유: 시스템 설정은 페이지가 열려 있는 동안에도 바뀐다.
 */
function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 컨트롤 버튼 공통 클래스(§21.1.3) — §20.14.3 아웃라인 필을 **그대로 재사용**한다.
 * ⚠ `px-5` 는 폭 검산(360px 2행)의 전제다 — 넓히면 3행이 된다.
 */
const CONTROL_CLASS =
  "ease-out-soft inline-flex min-h-touch shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-2 border-primary bg-bg px-5 text-body font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:border-border-strong disabled:text-ink-muted";

/** 등급 순위 — 겹쳤을 때 **낮은 쪽을 접는다**(§21.2.3) */
const PRIORITY_RANK: Record<LabelPriority, number> = { primary: 0, secondary: 1, tertiary: 2 };

/**
 * 겹침 판정 여백(px) — **0 이다. 즉 실제로 교차할 때만 접는다.**
 * ⚠ **임계값만 올리지 마라** — 8 로 올리면 **처음 보는 화면에서 낮은 등급이 즉시 배지로 접혀
 * §21.8-107 을 위반**할 수 있다. 올리려면 **z16 에서 접히는 라벨이 생기는지를 전 뷰포트에서
 * 다시 실측**해야 한다(지금 접힘을 만드는 것은 z15 의 실교차다 — §21.8-108).
 */
const LABEL_MIN_GAP = 0;

/** `내 위치` 라벨을 박스 안으로 밀어 넣을 때 남기는 여백(px) — §22.10 2-A 의 박스 여백 하한과 같은 값 */
const MY_LOCATION_CLAMP_INSET = 4;

/**
 * 로드뷰 + 거리뷰 모드의 **상태·부수효과 한 벌**. 두 지도가 함께 쓴다(`active` = 지금 앞에 있는가 —
 * 거짓이면 정리한다. 모달 뒤 시트는 **닫을 수도 볼 수도 없다**).
 * ⚠ **두 벌로 복제하지 마라**(§27.14.4-3) · **인스턴스는 지도마다 하나다. 상태를 위로 끌어올려
 *   공유하지 마라** — `StreetLayer`·리스너·마커가 각자의 네이버 인스턴스에 붙어야 하고, 공유하면
 *   **가려진 지도에 파란 길이 깔린다.**
 */
function useRoadview(mapRef: React.RefObject<NaverMap | null>, active: boolean) {
  /** 열린 로드뷰의 **지점**(`null` = 시트 없음). `label` 은 시트 제목 — 어느 지점인지가 화면에 남아야 한다 */
  const [roadviewAt, setRoadviewAt] = useState<{
    lat: number;
    lng: number;
    label: string | null;
  } | null>(null);
  /** 거리뷰 모드 — 파란 길(`StreetLayer`) + 클릭 이동. **시트와 독립이다**(모드만 켤 수 있다) */
  const [streetMode, setStreetMode] = useState(false);
  /** 파노라마 촬영 연월 — 메타에 있을 때만 표시한다(없으면 빈 문자열. 없는 것을 지어내지 않는다) */
  const [panoDate, setPanoDate] = useState("");
  /** 지도 위 **현재 보는 위치** 마커의 좌표·시선 방향(파노라마와 양방향 동기) */
  const [spotAt, setSpotAt] = useState<{ lat: number; lng: number } | null>(null);
  const [spotPan, setSpotPan] = useState(0);
  /** 지금 실제 시야각(도). 로드뷰를 확대하면 좁아진다 — 지도 부채꼴이 이걸 그대로 그린다 */
  const [spotFov, setSpotFov] = useState(SPOT_CONE_FALLBACK_FOV);
  const [panoStatus, setPanoStatus] = useState<"idle" | "loading" | "failed">("idle");

  const panoMountRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<NaverPanorama | null>(null);
  /** 거리뷰 토글 — 시트를 닫을 때 포커스를 여기로 되돌린다.
      ⚠ 배경 `inert`·스크롤 잠금을 되살리려면 §21.3 판정(*"지도를 눌러야 위치를 옮긴다"*)부터 뒤집어라 */
  const roadviewButtonRef = useRef<HTMLButtonElement | null>(null);

  /** 지점 하나의 로드뷰를 연다. **거리뷰 모드도 함께 켠다**(파란 길이 보여야 "여기 말고 저기"가 된다).
      ⚠ **팝업 닫기는 호출부가 한다** — 팝업 상태는 지도마다 따로라 훅이 알 수 없다 */
  const openRoadview = useCallback((feature: MapFeature) => {
    const at = featureRoadviewPoint(feature);
    setRoadviewAt({ lat: at.lat, lng: at.lng, label: feature.label });
    setSpotAt({ lat: at.lat, lng: at.lng });
    setStreetMode(true);
    setPanoDate("");
  }, []);

  /** 지도 안 `거리뷰` 토글 — 시트 없이 모드만 켠다. 파란 길을 눌러 아무 지점이나 열 수 있다 */
  const toggleStreetMode = useCallback(() => {
    setStreetMode((on) => {
      if (on) {
        setRoadviewAt(null);
        setSpotAt(null);
      }
      return !on;
    });
  }, []);

  /** 시트를 닫는다. **거리뷰 모드는 함께 끈다** — 파란 길만 남으면 눌러도 열 것이 없다 */
  const closeRoadview = useCallback(() => {
    setRoadviewAt(null);
    setSpotAt(null);
    setStreetMode(false);
    setPanoDate("");
    setPanoStatus("idle");
    roadviewButtonRef.current?.focus({ preventScroll: true });
  }, []);

  /* 이 지도가 뒤로 물러나면 로드뷰를 정리한다. ⚠ **포커스는 건드리지 마라** — 앞으로 나온 쪽이
     자기 초기 포커스를 잡는 중이라 여기서 가로채면 그것을 빼앗는다 */
  useEffect(() => {
    if (!active) return;
    /* ⚠ **정리 함수로 써라** — 이펙트 본문에서 setState 하면 활성 상태에서도 매번 돌아
       불필요한 렌더를 만들고 린트(`set-state-in-effect`)에도 걸린다 */
    return () => {
      setRoadviewAt(null);
      setSpotAt(null);
      setStreetMode(false);
      setPanoDate("");
      setPanoStatus("idle");
    };
  }, [active]);

  /*
   * `Esc` 로 시트를 닫는다.
   * ⚠ **`<dialog showModal()>` 을 쓰지 마라**(배경 `inert`) — 조합원은 **뒤의 지도를 눌러 위치를
   *   옮겨야 한다.** 배경 스크롤도 잠그지 않는다(잠그면 지도까지 못 움직인다).
   * ⚠ **`preventDefault()` 를 빼지 마라** — 전체 화면에서는 이 시트가 모달 안이라
   *   **`Esc` 한 번에 시트와 모달이 같이 닫힌다.**
   */
  useEffect(() => {
    if (roadviewAt === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRoadview();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeRoadview, roadviewAt]);

  /* 파노라마는 **시트가 열려 있는 동안만** 존재한다(§21.3.1 자동 로드 금지). 위치는 정밀할 필요가 없다.
     ⚠ **`pov.pan` 을 고정하지 마라** — 지점마다 옳은 방향이 다르다(기본값 = 촬영 진행 방향).
     ⚠ **실패해도 시트를 닫지 마라** — *"눌렀는데 아무 일도 안 났다"* 가 되고 다음에 할 일을 알릴
     자리가 사라진다 */
  useEffect(() => {
    if (roadviewAt === null) return;
    const maps = window.naver?.maps;
    const node = panoMountRef.current;
    const Panorama = maps?.Panorama;
    if (maps === undefined || node === null || Panorama === undefined) {
      setPanoStatus("failed");
      return;
    }

    setPanoStatus("loading");
    const pano = new Panorama(node, {
      position: new maps.LatLng(roadviewAt.lat, roadviewAt.lng),
      pov: { tilt: 0, fov: 100 },
      logoControl: true,
      zoomControl: true,
      aroundControl: false,
      /* `flightSpot` = **주변 항공뷰 아이콘**(공식 문서 표현). 좁은 시트에서 오탭이 잦아 끈다.
         ⚠ **이동과 무관하다** — "켜면 클릭 이동이 되나" 를 검토할 때 헛다리다 */
      flightSpot: false,
      minScale: 0,
      maxScale: 4,
    });
    panoRef.current = pano;

    /*
     * ★ **컨테이너가 커지면 파노라마에 `setSize` 로 알린다** — `size` 옵션이 없으면 **초기화 시점
     * 요소 크기로 고정**되므로 CSS 만으로는 화면이 따라오지 않는다.
     * ⚠ **드래그 콜백이 아니라 `ResizeObserver` 여야 한다**(회전·주소창 접힘에도 같은 어긋남이 난다).
     * ⚠⚠ **감시 대상은 `node` 가 아니라 `node.parentElement`(파노라마 박스)다.** 네이버가 마운트 요소에
     *   **인라인 `width`/`height` 를 px 로 박아** `size-full` 을 이기므로, **박스가 커져도 마운트는
     *   그대로**이고 옵저버가 영영 울리지 않는다.
     *
     * ★ **로드뷰 안 지점 라벨** — `map: pano` 로 만든 `Marker`(좌표→화면 계산과 **시야 밖 숨김**을
     * 네이버가 해 준다). 대상은 `MAP_FEATURES` 의 `inRoadview` 가 정한다.
     *   ⚠ **`Marker({ map: pano })` 도 문서에 없는 API 다**(위 `fromOffsetToCoord` 와 같은 계열).
     *   없어지면 **남는 길은 `fromCoordToOffset` 로 우리가 직접 그리는 것**인데, 회전·줌·이동마다
     *   전부 다시 계산해야 해 **훨씬 잘 깨진다** — 그래서 지금은 쓰지 않는다. 되살릴 때의 대안이다.
     * ⚠⚠ **`init` 직후에 만들면 `left:-9999px` 에 박혀 영영 안 보인다**(`setPov` 로도 안 풀린다) —
     *   **위치가 바뀌어야**(`pano_changed`) 자리를 잡으므로 **첫 `pano_changed` 뒤 한 틱**에 만든다.
     *   `setPanoId(같은 id)` 로 흔들지 마라 — **오히려 다시 -9999 로 돌아간다.**
     * ⚠ **`pointer-events:none` 을 빼지 마라**(라벨이 탭을 가로채면 바닥 탭 이동이 죽는다) ·
     *   라벨은 전부 **지평선 한 줄**이라 대상을 늘리면 겹침이 그만큼 늘어난다.
     */
    const marks: NaverMarker[] = [];
    /** 겹치면 **뒤엣것을 접는다**. 배열 순서가 곧 우선순위다(집결위치가 맨 앞) */
    const markOrder: NaverMarker[] = [];
    let marksBuilt = false;
    const buildMarks = () => {
      if (marksBuilt) return;
      marksBuilt = true;
      let order = 0;
      MAP_FEATURES.forEach((feature, index) => {
        if (feature.inRoadview !== true) return;
        const at = featureLabelAnchor(feature);
        const color = toneColor(feature.tone);
        /*
         * 꼬리 3단(8·38·68px) — 같은 방향에 몰린 라벨이 서로를 덮지 않게 높이를 엇갈린다.
         * ⚠ **단 수를 늘리지 마라** — 3단(68px)에 라벨 높이 26px 을 더하면 기본 시트 높이에서
         *   지평선 위 여유의 대부분을 쓴다. 4단이면 위 라벨이 파노라마 바깥으로 잘린다.
         *   겹침을 더 줄이려면 단이 아니라 **대상 개수**를 줄여라.
         */
        const stem = 8 + (order % 3) * 30;
        order += 1;
        const mark = feature.symbol === undefined ? "" : symbolSvg(feature.symbol, 13);
        const marker = new maps.Marker({
            position: new maps.LatLng(at.lat, at.lng),
            map: pano,
            /* 눌러도 아무 일도 없어야 한다 — 이 라벨은 «어디인지»만 말한다 */
            clickable: false,
            /* ★ **집결위치가 맨 위**다 — 겹쳐서 하나가 가려질 때 살아남아야 하는 것은
               **조합원이 실제로 가야 하는 곳**이다(`inRoadview` 대상 중 화장실이 아닌 것) */
            zIndex: feature.symbol === undefined ? 300 : 200 + index,
            icon: {
              content: [
                `<div aria-hidden="true" style="pointer-events:none;transform:translate(-50%,-100%);white-space:nowrap;">`,
                /* 12px·padding 3/8 → 라벨 높이 약 26px. **키우지 마라** — 꼬리 단 간격 30px 과 맞물려
                   위아래 줄이 서로 닿지 않는 지점이다(위 `stem` 주석) */
                `<div data-rv-pill="1" style="display:inline-flex;align-items:center;gap:4px;background:#ffffff;`,
                `border:2px solid ${color};border-radius:9999px;padding:3px 8px;`,
                `font-size:12px;font-weight:700;line-height:1.2;color:${color};`,
                `box-shadow:0 2px 6px rgb(0 0 0 / .35);">`,
                mark,
                `<span>${circledNumber(index)} ${feature.label}</span>`,
                `</div>`,
                `<div style="width:2px;height:${stem}px;background:${color};margin:0 auto;"></div>`,
                `</div>`,
              ].join(""),
              anchor: new maps.Point(0, 0),
            },
        });
        marks.push(marker);
        /* 집결위치를 맨 앞에 — 겹치면 **조합원이 가야 하는 곳**이 살아남아야 한다 */
        if (feature.symbol === undefined) markOrder.unshift(marker);
        else markOrder.push(marker);
      });
      foldMarks();
    };

    /*
     * ★ **겹치는 라벨을 접는다**(§21.2 규칙을 로드뷰에 적용) — 방향이 가까우면 가로로 겹쳐 이름이 잘린다.
     * ⚠ **`display:none` 이 아니라 `visibility`** 다 — 자리를 유지해야 다음 판정에서 다시 잰다.
     * ⚠ 네이버가 시야 밖 마커를 `left:-9999px` 로 치워 두므로 그건 판정 대상에서 뺀다.
     */
    let foldFrame = 0;
    const foldMarks = () => {
      if (foldFrame !== 0) return;
      foldFrame = window.requestAnimationFrame(() => {
        foldFrame = 0;
        const taken: DOMRect[] = [];
        /* 파노라마 박스 — **가장자리에 걸친 라벨을 접는 기준**이다(사용자 지시 2026-08-24) */
        const view = node.getBoundingClientRect();
        for (const marker of markOrder) {
          const host = marker.getElement?.();
          const pill = host?.querySelector<HTMLElement>("[data-rv-pill]");
          if (host === null || host === undefined || pill === null || pill === undefined) continue;
          host.style.visibility = "";
          const rect = pill.getBoundingClientRect();
          /* 시야 밖(네이버가 치워 둔 것)은 접을 것도 없다 */
          if (rect.width <= 0 || rect.left < -1000) continue;
          /* ★ **한 변이라도 박스를 넘으면 접는다** — **반쯤 잘린 이름은 없는 것보다 나쁘다**(잘못 읽힌다).
             ⚠ **여유(margin)를 두지 마라** — *"얼마나 걸려야 접히나"* 가 새 판정 대상이 된다 */
          if (
            rect.left < view.left ||
            rect.right > view.right ||
            rect.top < view.top ||
            rect.bottom > view.bottom
          ) {
            host.style.visibility = "hidden";
            continue;
          }
          const hit = taken.some(
            (t) =>
              !(rect.right <= t.left || rect.left >= t.right || rect.bottom <= t.top || rect.top >= t.bottom),
          );
          if (hit) host.style.visibility = "hidden";
          else taken.push(rect);
        }
      });
    };

    /* ★ **바닥 탭 → 그 방향으로 한 칸 이동**. 설계 근거는 `bearingDeg` 위 주석에 있다.
       ⚠ **캡처 단계로 듣는다**(네이버가 전파를 끊어도 받아야 한다) · **드래그와 구분한다**
       (한 손가락 끌기는 **시선 회전**이라 §23.1.3, 오인하면 둘러보기가 망가진다).
       ⚠ **`getProjection().fromOffsetToCoord` 는 문서에 없는 API 다** — 없어지면 이 기능만 조용히
       꺼지고 네이버 화살표 이동은 남는다(죽은 버튼이 생기지 않는다) */
    let tapStart: { x: number; y: number; t: number } | null = null;
    const onTapDown = (e: PointerEvent) => {
      tapStart = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const onTapUp = (e: PointerEvent) => {
      const start = tapStart;
      tapStart = null;
      if (start === null) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > ROADVIEW_TAP_SLOP_PX) return;
      if (e.timeStamp - start.t > ROADVIEW_TAP_MS) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target !== null && target.closest(ROADVIEW_IGNORE_TAP) !== null) return;

      const projection = pano.getProjection?.();
      const toCoord = projection?.fromOffsetToCoord;
      if (projection === undefined || typeof toCoord !== "function") return;

      const box = node.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;

      /* 지평선 = 화면 한가운데에서 **올려다본 각도만큼 내려온 자리**(핀홀 근사) */
      const pov = pano.getPov?.();
      const fov = pov?.fov ?? 100;
      const horizonY = box.height / 2 + ((pov?.tilt ?? 0) / fov) * box.height;
      if (y < horizonY + ROADVIEW_HORIZON_MARGIN_PX) return;

      const from = pano.getPosition?.();
      if (from === undefined) return;
      let aim: NaverLatLng | null | undefined;
      try {
        aim = toCoord.call(projection, new maps.Point(x, y));
      } catch {
        return;
      }
      if (aim === null || aim === undefined) return;
      pano.setPosition(stepAhead(maps, from, bearingDeg(from, aim), ROADVIEW_STEP_M));
    };
    node.addEventListener("pointerdown", onTapDown, true);
    node.addEventListener("pointerup", onTapUp, true);

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
        pano.setSize?.(new maps.Size(rect.width, rect.height));
      });
    });
    if (observed !== null) observer.observe(observed);

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

    const listeners: NaverMapEventListener[] = [
      pano.addListener("init", () => {
        setPanoStatus("idle");
        syncDate();
      }),
      pano.addListener("pano_status", (payload?: unknown) => {
        const ok = maps.PanoramaStatus === undefined || payload === maps.PanoramaStatus.OK;
        if (!ok) setPanoStatus("failed");
      }),
      /* 파노라마 안에서 걸어가면(화살표) 지도 위 현재 위치 마커가 따라온다 */
      pano.addListener("pano_changed", () => {
        setPanoStatus("idle");
        syncDate();
        /* 한 틱 미룬다 — 이 시점에는 아직 배치 준비가 안 돼 `-9999` 로 박힌다(위 주석) */
        window.setTimeout(() => {
          buildMarks();
          foldMarks();
        }, 0);
        const p = pano.getPosition?.();
        if (p) setSpotAt({ lat: p.lat(), lng: p.lng() });
      }),
      /* 시선을 돌리면 지도 마커의 시야 콘도 같이 돈다 */
      pano.addListener("pov_changed", () => {
        /* 시선이 돌면 라벨 자리가 통째로 바뀐다 — 접힘을 다시 판정한다 */
        foldMarks();
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
      if (pano.getPanoId() === null) setPanoStatus("failed");
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      if (resizeFrame !== 0) window.cancelAnimationFrame(resizeFrame);
      node.removeEventListener("pointerdown", onTapDown, true);
      node.removeEventListener("pointerup", onTapUp, true);
      if (foldFrame !== 0) window.cancelAnimationFrame(foldFrame);
      for (const mark of marks) mark.setMap(null);
      marks.length = 0;
      markOrder.length = 0;
      observer.disconnect();
      for (const l of listeners) maps.Event.removeListener(l);
      pano.destroy();
      panoRef.current = null;
    };
    /* `roadviewAt` 이 바뀌면 파노라마를 새로 만든다 — 지점이 바뀌었다는 뜻이다 */
  }, [roadviewAt]);

  /* ★ **거리뷰 모드** — **파란 길**(`StreetLayer`) + **클릭으로 로드뷰 위치 이동.**
     ⚠ **모드가 켜져 있으면 지도 클릭이 로드뷰 이동으로 해석된다**(팝업을 열려면 모드를 꺼야 한다).
     ⚠ **`active` 를 의존성에서 빼지 마라** — 전체 화면 지도는 모달이 열릴 때 인스턴스가 생겨서,
     `streetMode` 만 보면 지도가 `null` 인 시점에 한 번 돌고 끝나 **파란 길이 영영 안 깔린다** */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null) return;
    if (!streetMode || maps.StreetLayer === undefined) return;

    const layer = new maps.StreetLayer();
    layer.setMap(map);

    const listener = map.addListener("click", (payload?: unknown) => {
      /* 네이버 클릭 이벤트는 `{ coord }` 를 준다 — 타입 선언에 없으므로 여기서 좁힌다 */
      const coord = (payload as { coord?: { lat(): number; lng(): number } } | undefined)?.coord;
      if (coord === undefined) return;
      const pano = panoRef.current;
      const lat = coord.lat();
      const lng = coord.lng();
      if (pano !== null) {
        /* 이미 열려 있으면 **인스턴스를 다시 만들지 않고** 위치만 옮긴다 —
           새로 만들면 시트가 깜빡이고 촬영일자가 잠깐 비는 것이 보인다 */
        pano.setPosition(new maps.LatLng(lat, lng));
      } else {
        setRoadviewAt({ lat, lng, label: null });
        setSpotAt({ lat, lng });
        setPanoDate("");
      }
    });

    return () => {
      layer.setMap(null);
      maps.Event.removeListener(listener);
    };
  }, [mapRef, streetMode, active]);

  /* 현재 보는 위치 마커 — 주황 원 + 시선 방향 콘. 모드가 꺼지면 함께 사라진다 */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || !streetMode || spotAt === null) return;

    const marker = new maps.Marker({
      map,
      position: new maps.LatLng(spotAt.lat, spotAt.lng),
      /* 라벨(1000+)보다 아래, 도형(≤25)보다 위 — **안내도 라벨을 가리지 않는다**(2-C 계열 판단) */
      zIndex: 900,
      /* ★ **`false` 를 바꾸지 마라** — 이 마커가 클릭을 먹으면 그 자리를 다시 누를 수 없어
         "현재 보는 위치 주변으로 조금 옮기기"가 막힌다. 2-C(히트 가로채기 0)의 직접 적용이다 */
      clickable: false,
      /* 시야 부채꼴 — 바깥 변이 호(arc)라야 *"이 방향으로 트인 시야"* 로 읽힌다(삼각형은 한 점을 가리킨다).
         ⚠ **각도는 «얼마나 넓게 보이는가»라는 사실 주장이다** — 임의로 바꾸지 마라(값은 실제 `fov`).
         ⚠ 좌표는 `SPOT_CONE_*` 상수에서 계산한다. **숫자를 여기 직접 적지 마라** */
      icon: {
        content:
          `<div style="width:${SPOT_BOX}px;height:${SPOT_BOX}px;position:relative;transform:rotate(${spotPan}deg)">` +
          `<svg viewBox="0 0 ${SPOT_BOX} ${SPOT_BOX}" width="${SPOT_BOX}" height="${SPOT_BOX}" ` +
          `style="position:absolute;inset:0;" aria-hidden="true" focusable="false">` +
          `<path d="${spotConePath(spotFov / 2)}" fill="rgba(242,107,29,.38)"/></svg>` +
          `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);` +
          `width:18px;height:18px;border-radius:9999px;background:#f26b1d;border:3px solid #fff;` +
          `box-shadow:0 0 0 2px #f26b1d,0 2px 8px rgba(20,22,26,.45)"></div></div>`,
        anchor: new maps.Point(SPOT_BOX / 2, SPOT_BOX / 2),
      },
    });

    return () => {
      marker.setMap(null);
    };
  }, [mapRef, spotAt, spotPan, spotFov, streetMode, active]);

  /* ★ 마커 좌표는 **상태를 만드는 쪽에서 함께 세운다**(`openRoadview`·지도 클릭·`closeRoadview`).
     이펙트로 파생시키면 한 프레임 늦게 따라와 시트가 먼저 열리고 마커가 뒤늦게 튄다. */

  return {
    roadviewAt,
    streetMode,
    panoDate,
    panoStatus,
    panoMountRef,
    roadviewButtonRef,
    openRoadview,
    toggleStreetMode,
    closeRoadview,
  };
}

/** 로드뷰 시트 높이(조합원이 드래그로 정한다) — 값은 **뷰포트 높이 대비 %**(`dvh`)다.
    ⚠ `px` 로 저장하지 마라 — 회전·기기 교체에서 엉뚱한 비율이 된다 */
const SHEET_HEIGHT_KEY = "koscomlabor:roadview-height";
/** 한 번도 안 만진 조합원이 보는 높이 */
const SHEET_DEFAULT_VH = 32;
/** 이보다 낮으면 로드뷰가 로드뷰 구실을 못 한다 */
const SHEET_MIN_PX = 120;
/**
 * ★ **시트 위에 지도가 이만큼은 남아야 한다 — 이 상수가 드래그의 상한이다.** 상한이 없으면 지도를
 * 다 덮은 순간 **로드뷰 위치를 옮길 방법이 사라진다**(파란 길 한 구간 + 마커 하나를 겨냥할 최소치).
 * ⚠ **줄이려면 실기기에서 파란 길을 눌러 보고 줄여라.**
 */
const SHEET_MAP_KEEP_PX = 180;
/** 헤더+안내문 높이를 **아직 못 쟀을 때만** 쓰는 어림값.
    ⚠ 실제 한계는 **매번 실측한 값**으로 정한다 — 상수로 박으면 글자 확대 상태에서 지도가 다 가려진다 */
const SHEET_CHROME_FALLBACK_PX = 120;
/** 키보드 한 번(↑/↓)에 움직이는 양. `PageUp/PageDown` 은 3배 */
const SHEET_KEY_STEP_VH = 4;

function readStoredSheetVh(): number {
  try {
    const raw = window.localStorage.getItem(SHEET_HEIGHT_KEY);
    const v = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(v) && v > 0 ? v : SHEET_DEFAULT_VH;
  } catch {
    return SHEET_DEFAULT_VH;
  }
}

/**
 * 로드뷰 **하단 시트** — 뷰포트 하단 고정. 높이는 조합원이 손잡이를 끌어 정한다.
 * ⚠⚠ **`<dialog showModal()>` 을 쓰지 마라**(배경 `inert`) — 시트가 열려 있는 동안 조합원은
 *   **뒤의 지도를 눌러 로드뷰 위치를 옮겨야 한다.** 같은 이유로 `SHEET_MAP_KEEP_PX` 상한도 없애지 마라.
 * ⚠ **전체 화면 지도는 이 시트를 `<dialog>` 안에 렌더해야 한다**(top layer) — **복제하지 말고 자리만 바꿔라.**
 */
function RoadviewSheet({
  at,
  panoDate,
  panoStatus,
  mountRef,
  onClose,
}: {
  at: { lat: number; lng: number; label: string | null };
  panoDate: string;
  panoStatus: "idle" | "loading" | "failed";
  mountRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const panoBoxRef = useRef<HTMLDivElement | null>(null);

  /* 여기서 `localStorage` 를 지연 초기화로 읽어도 안전하다 — 이 컴포넌트는 `roadviewAt !== null`
     일 때만 렌더돼 **서버·하이드레이션 시점에는 존재하지 않는다** */
  const [heightVh, setHeightVh] = useState(readStoredSheetVh);
  /* 드래그 중에는 렌더보다 잦게 읽고 써야 해서 최신값을 ref 로도 들고 있다 */
  const heightRef = useRef(heightVh);

  /**
   * 조절 가능한 범위로 자른다. **한계를 상수가 아니라 실측으로 정한다:**
   * `헤더+안내문` 높이를 매번 재서 빼므로 글자 크기 슬라이더로 헤더가 커지면 상한이 함께 내려간다.
   */
  const clampVh = (next: number): number => {
    const viewport = window.innerHeight;
    const sheet = sheetRef.current;
    const box = panoBoxRef.current;
    const chrome =
      sheet !== null && box !== null
        ? sheet.offsetHeight - box.offsetHeight
        : SHEET_CHROME_FALLBACK_PX;
    const maxPx = Math.max(SHEET_MIN_PX, viewport - chrome - SHEET_MAP_KEEP_PX);
    const px = Math.min(maxPx, Math.max(SHEET_MIN_PX, (next / 100) * viewport));
    /* 소수 한 자리 — `dvh` 를 그대로 넘기므로 반올림을 여기서 끝낸다 */
    return Math.round((px / viewport) * 1000) / 10;
  };

  const applyVh = (next: number): void => {
    const v = clampVh(next);
    heightRef.current = v;
    setHeightVh(v);
  };

  const persistVh = (): void => {
    try {
      window.localStorage.setItem(SHEET_HEIGHT_KEY, String(heightRef.current));
    } catch {
      /* 저장 실패해도 이번 방문에는 적용된다 */
    }
  };

  /* 포인터 드래그 — 마우스·손가락·펜을 한 벌로 받는다.
     ⚠ **`setPointerCapture` 를 빼지 마라** — 빠르게 끌면 포인터가 손잡이를 벗어나 `pointermove` 가 끊긴다.
     ⚠ **파노라마 위에는 드래그를 걸지 마라**(거기 한 손가락 끌기는 **시야 회전**이다 — §23.1.3) —
     받는 곳은 **손잡이 + 제목 줄**, 파노라마 박스 위쪽뿐이다 */
  const dragRef = useRef<{ id: number; startY: number; startVh: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    /* `×` 버튼에서 시작한 눌림은 드래그가 아니다 — 닫기를 빼앗으면 안 된다 */
    if ((e.target as HTMLElement).closest("button") !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /* ⚠ 시작값을 `heightRef` 가 아니라 **지금 화면에 보이는 박스 높이**에서 딴다 —
       `max-height` 안전망이 박스를 잘라 놨으면 상태값에서 출발할 때 시트가 튄다 */
    const box = panoBoxRef.current;
    const startVh =
      box !== null ? (box.offsetHeight / window.innerHeight) * 100 : heightRef.current;
    dragRef.current = { id: e.pointerId, startY: e.clientY, startVh };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== e.pointerId) return;
    /* 위로 끌면 커진다 — 시트가 아래에 붙어 있으니 위끝이 올라간 만큼 높아진다 */
    applyVh(drag.startVh + ((drag.startY - e.clientY) / window.innerHeight) * 100);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    persistVh();
  };

  /* 키보드 — 드래그만 있으면 이 기능이 마우스·손가락 전용이 된다.
     WAI-ARIA `separator`(window splitter) 규약: ↑/↓ 로 옮기고 `Home`/`End` 로 양 끝 */
  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    let next: number | null = null;
    if (e.key === "ArrowUp") next = heightRef.current + SHEET_KEY_STEP_VH;
    else if (e.key === "ArrowDown") next = heightRef.current - SHEET_KEY_STEP_VH;
    else if (e.key === "PageUp") next = heightRef.current + SHEET_KEY_STEP_VH * 3;
    else if (e.key === "PageDown") next = heightRef.current - SHEET_KEY_STEP_VH * 3;
    /* 0·100 은 `clampVh` 가 각각 최소·최대로 잘라 준다 — 한계를 두 곳에 적지 않는다 */
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 100;
    if (next === null) return;
    e.preventDefault();
    applyVh(next);
    persistVh();
  };

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label={at.label !== null ? `${at.label} 로드뷰` : "로드뷰"}
      /*
       * ★ **`z-[300]` 을 내리지 마라.** 네이버 지도의 `.map_copyright`·축척·로고가 **`z-index: 100`** 이라
       * 그보다 낮으면 시트 위에 그려져 **안내문과 글자가 포개진다.**
       * ⚠ 그 요소들은 `pointer-events: none` 이라 **`elementFromPoint` 로는 안 잡힌다** — 이 겹침은
       *   **기하(사각형 교차)로만** 검출된다. 히트 테스트로 "겹침 0"을 확인하면 놓친다.
       */
      className="rounded-t-panel fixed inset-x-0 bottom-0 z-[300] flex flex-col border-t-2 border-border-strong bg-bg shadow-hero"
      /*
       * ★★ **`maxHeight` 가 상한의 최종 보증이다 — 빼면 지도가 다 가려질 수 있다.** 드래그·키보드는
       * `clampVh` 가 막지만 **저장된 값으로 열 때는 아무도 안 막는다.**
       * ⚠ **레이아웃이 할 수 있는 일을 JS 로 옮기지 마라** — `max-height` + `flex` 축소는 글자 크기·
       *   회전·주소창 접힘까지 브라우저가 정확히 처리한다(`effect` 재계산은 린트가 막는다).
       */
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        maxHeight: `calc(100dvh - ${SHEET_MAP_KEEP_PX}px)`,
      }}
    >
      {/*
        드래그를 받는 영역 — **손잡이 + 제목 줄 전체**다. 막대만 잡게 하면 터치 목표가 6px 이 된다.
        ⚠ **`touch-none` 을 빼지 마라** — 세로 드래그를 브라우저가 페이지 스크롤로 가져간다.
      */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="shrink-0 cursor-ns-resize touch-none select-none"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="로드뷰 높이 조절"
          /* ⚠ **`aria-valuemin`/`aria-valuemax` 를 넣지 마라** — 참 한계는 `clampVh` 가 DOM 을 실측해
             정하는데 렌더 중 실측은 린트 위반이고 첫 렌더에는 잴 대상도 없어 **틀린 최댓값을 알린다.**
             단위가 `%` 라 규약 기본값 0~100 이 맞는 눈금이다. **틀린 한계는 없는 것만 못하다** */
          aria-valuenow={Math.round(heightVh)}
          aria-valuetext={`화면 높이의 ${Math.round(heightVh)} 퍼센트`}
          tabIndex={0}
          onKeyDown={onHandleKeyDown}
          className="flex h-6 w-full items-center justify-center focus-visible:outline-3 focus-visible:outline-primary focus-visible:-outline-offset-2"
        >
          {/* 막대는 **손잡이가 있다는 표시일 뿐**이다 — 뜻은 `role`·`aria-label` 이 진다(§2) */}
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>

        {/*
          헤더 **2단 구성** — 세로로 쌓을 것(제목 + 촬영일)과 옆에 고정할 것(`닫기`)을 나눈다.
          ⚠ **셋을 한 행에 두지 마라** — 좁은 폭에서 폭을 다투다 전부 2줄로 깨져 헤더가 부푼다.
          제목은 `min-w-0` + **`break-keep`**(없으면 낱말 중간이 잘린다) · `닫기` 는 **`×` 아이콘 44px**
          (글자 `닫기` 가 가장 큰 폭 소비자다). **뜻은 `aria-label` 이 진다**(§2).
        */}
        <div className="flex items-start gap-3 px-4 pb-3">
          <div className="min-w-0 flex-1">
            <p className="break-keep text-body font-bold leading-snug text-ink">
              {at.label !== null ? `로드뷰 — ${at.label}` : "로드뷰"}
            </p>
            {/* 촬영 연월 — **메타에 있을 때만.** 없으면 이 줄이 아예 없다(지어내지 않는다) */}
            {panoDate !== "" ? (
              <p className="mt-1 text-caption tabular-nums text-ink-muted">{panoDate}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="로드뷰 닫기"
            className="ease-out-soft flex size-[44px] shrink-0 items-center justify-center rounded-full border-2 border-primary bg-bg text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 로드뷰는 스크린리더에 무의미하다 — 텍스트 등가를 만들 수 없다(§21.3.2).
          **로드뷰에만 있는 정보를 만들지 마라** */}
      <p className="sr-only">
        로드뷰는 시각 자료입니다. 위치 안내는 페이지 본문 텍스트를 참고해 주세요.
      </p>

      {/* ⚠ **`overflow-hidden` 을 빼지 마라** — 없으면 네이버 파노라마가 그리는 큐브 면·로고·저작권·축척이
          박스 밖으로 크게 삐져나와 아래 안내문 위에 겹쳐 찍힌다.
          높이가 인라인 스타일인 것은 드래그로 정하는 값이라서다. 이 박스가 바뀌면 `useRoadview` 의
          `ResizeObserver` 가 `setSize` 를 걸어 준다 — **CSS 만 바꾸면 파노라마는 초기 크기로 그린다.** */}
      <div
        ref={panoBoxRef}
        style={{ height: `${heightVh}dvh` }}
        /* `min-h-[120px]` + 기본 `flex-shrink:1` — 시트가 `max-height` 에 닿으면 **여기가 줄어든다.**
           `SHEET_MIN_PX` 와 같은 값이다(둘 다 120). 한쪽만 바꾸지 마라 */
        className="relative min-h-[120px] overflow-hidden bg-surface"
      >
        {/* `touch-action` 을 건드리지 않는다 — 여기서는 한 손가락 회전이 설계된 동작이다(§23.1.3) */}
        <div ref={mountRef} className="size-full" />
        {panoStatus === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center bg-surface text-body font-semibold text-ink">
            로드뷰를 불러오는 중입니다.
          </p>
        ) : null}
        {panoStatus === "failed" ? (
          /* ⚠ **실패해도 시트를 닫지 마라** — *"눌렀는데 아무 일도 안 났다"* 가 된다.
             **다음에 할 일을 알려야 한다** */
          <p className="absolute inset-0 flex items-center justify-center break-keep bg-surface px-6 text-center text-body text-ink">
            이 지점 주변에는 로드뷰가 없습니다. 지도의 파란 길을 눌러 근처 촬영 지점을 골라 주세요.
          </p>
        ) : null}
      </div>

      {/*
        ⚠ **두 문장 다 지우지 마라** — 둘 다 «화면에 단서가 없는 조작»이다(§5.3).
        ⚠ **보편 조작·화면에 보이는 것을 설명하는 문장을 추가하지 마라**(§5.3) — 드래그 둘러보기,
        화살표 이동, 막대 손잡이는 그 이유로 이미 지운 것들이다.
        조판: 두 문장을 **각각 `block`** 으로 · **굵게 하는 것은 «무엇을 누르는가» 뿐이다.**
      */}
      <p className="shrink-0 break-keep px-4 py-3 text-caption leading-[1.6] text-ink">
        <span className="block">
          지도의 <b>파란 길</b>을 누르면 그 지점 로드뷰로 이동합니다(주황 원 = 지금 보는 위치).
        </span>
        <span className="block">
          로드뷰 안에서는 <b>바닥</b>을 누르면 그 방향으로 이동합니다.
        </span>
      </p>
    </div>
  );
}


/** **재노출** 임계(px) — 접기 0 / 펴기 8 로 벌려 두지 않으면 경계 줌에서 라벨이 깜빡인다(§21.9.3) */
const LABEL_REVEAL_GAP = 8;

export function RallyMap({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<MapStatus>("loading");
  const [locStatus, setLocStatus] = useState<LocationStatus>("idle");
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);

  /* `navigator.geolocation` 미지원이면 버튼을 렌더하지 않는다(죽은 버튼 금지 — §20.14.3).
     서버 스냅샷이 `false` 라 하이드레이션 불일치가 없고, effect + setState 와 달리 렌더가 한 번 더 돌지 않는다 */
  const geoSupported = useSyncExternalStore(
    subscribeNever,
    () => "geolocation" in navigator,
    () => false,
  );

  /** 현재 zoom — 컨트롤 비활성 판정과 라벨 접힘에 쓴다(§21.1.3 · §21.2) */
  const [zoom, setZoom] = useState<number | null>(null);
  /** 초기 화면에서 벗어났는가 — `처음 위치로` 비활성 판정 */
  const [moved, setMoved] = useState(false);
  /** 스크립트에 파노라마 모듈이 없으면 **버튼을 아예 렌더하지 않는다**(죽은 버튼 금지, §21.3.2) */
  const [panoSupported, setPanoSupported] = useState(false);
  /** 열린 팝업(§25.4~§25.7). **기본은 전부 닫힘 — 자동 열림을 두지 마라**(§25.2.2 · 지도 절반이 덮인 채 시작한다) */
  const [selected, setSelected] = useState<{ id: string; index: number } | null>(null);
  /** 팝업을 박스 위·아래 중 어디에 붙일지(§25.5). **가로는 계산하지 않는다 — 박스에 고정이다** */
  const [popupSide, setPopupSide] = useState<"top" | "bottom">("bottom");
  /** 키보드 그룹의 현재 항목(렌더용 — `+`/`−` 버튼의 `tabIndex` 가 이 값을 쓴다) */
  const [focusedId, setFocusedId] = useState<string>(KEYBOARD_ENTRY_ID);
  /** 전체 화면 지도(§27.6). **기본은 항상 닫힘** — 새로고침·재방문에서 열린 채 시작하지 않는다 */
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  /** 지도 조작 그룹 안에 포커스가 있는가 — 범례 행 강조에 쓴다(§27.8.4) */
  const [groupFocused, setGroupFocused] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  /** 지도 박스 — 팝업 자리 계산과 키보드 이벤트 위임의 기준 */
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** `지도 크게 보기` — 모달을 닫을 때 포커스를 여기로 되돌린다 */
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  /** 휠 확대가 지금 켜져 있는가(→ 아래 «휠 확대 게이트»). 렌더에 쓰지 않으므로 상태가 아니라 ref 다 */
  const wheelGateRef = useRef(false);

  /* 로드뷰·거리뷰 한 벌. **`active` 는 `!fullscreenOpen`** — 전체 화면 모달이 뜨면 이 시트는
     모달 뒤에 깔려 **닫을 수도 볼 수도 없는 유령**이 되므로 물러날 때 스스로 정리한다 */
  const {
    roadviewAt,
    streetMode,
    panoDate,
    panoStatus,
    panoMountRef,
    roadviewButtonRef,
    openRoadview,
    toggleStreetMode,
    closeRoadview,
  } = useRoadview(mapRef, !fullscreenOpen);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  /** 선택 강조 헤일로 — 살아 있는 값은 0개 아니면 1개다(`createHighlight`) */
  const highlightRef = useRef<NaverOverlay[]>([]);
  const myOverlaysRef = useRef<NaverOverlay[]>([]);
  const labelsRef = useRef<LabelEntry[]>([]);
  /** 겹침 때문에 접혀 있는 라벨 — 히스테리시스 판정에 쓴다(§21.9.3) */
  const foldedRef = useRef<Set<string>>(new Set());
  /** 열린 팝업의 항목 — **한 번에 하나만**(§25.7). `null` 이면 전부 닫힘(기본 상태) */
  const selectedRef = useRef<string | null>(null);
  /**
   * 키보드 그룹의 **현재 항목**(§27.8.1 roving tabindex). 그룹 안에서 `tabindex="0"` 은 하나뿐이라
   * **페이지 탭 정지점이 1개**로 유지된다. 진입 지점은 `KEYBOARD_ENTRY_ID`.
   */
  const focusedRef = useRef<string>(KEYBOARD_ENTRY_ID);
  const boundsRef = useRef<NaverLatLngBounds | null>(null);

  /** 지도 폭의 60% 를 px 로 확정해 CSS 변수로 내린다 — 0폭 앵커 안에서는 %가 해석되지 않는다 */
  const syncLabelWidth = useCallback(() => {
    const node = mountRef.current;
    if (node === null) return;
    node.style.setProperty(
      LABEL_MAX_WIDTH_VAR,
      `${Math.round(node.clientWidth * LABEL_MAX_WIDTH_RATIO)}px`,
    );
  }, []);

  /** 전 항목을 담는 초기 화면. 범위는 `MAP_FIT_BOUNDS` 가 항목 배열에서 자동 계산한다 */
  const fit = useCallback((maps: NaverMapsNamespace, map: NaverMap) => {
    const bounds =
      boundsRef.current ??
      (() => {
        const created = new maps.LatLngBounds(
          new maps.LatLng(MAP_FIT_BOUNDS.south, MAP_FIT_BOUNDS.west),
          new maps.LatLng(MAP_FIT_BOUNDS.north, MAP_FIT_BOUNDS.east),
        );
        boundsRef.current = created;
        return created;
      })();
    map.fitBounds(bounds, FIT_PADDING);
    if (map.getZoom() > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM, false);
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

    /* 조작 계약(§27.13.6 — §21.1.1 개정): "한 손가락은 페이지 스크롤이다. **단 지도 위는 예외다.**"
       **위험은 해소된 것이 아니라 감수된 것이다**(§27.13.1) — *"지도 위에서 페이지를 못 내린다"* 는 성립한다.
       **완화는 여백이 아니라 안내 문구가 진다**(§27.13.2 에서 여백안 기각 · §27.16.3 (A) 가 유일 수단).
       **되돌리는 법**: `draggable` 을 `(pointer: fine)` 분기로, `touch-action` 을 `pan-y` 로(§27.13.6).
       **발동 조건은 §27.13.8** — *"페이지가 안 내려간다"* 가 1건이라도 접수되면 리더에게 즉시 보고한다.
       ⚠ **`pointer: fine` 조건을 지우지 마라**(휠은 마우스 기기에서만) — 지우는 순간 되살아나는 것이
       §27.13 의 그 위험이다 */
    const map = new maps.Map(node, {
      mapTypeId: maps.MapTypeId.NORMAL,
      draggable: true,
      pinchZoom: true,
      /* ⚠ **기본은 꺼 둔다. 여기서 `true` 로 바꾸지 마라** — 페이지를 스크롤하다 지도가 커서 밑을
         지나가는 순간 지도가 확대된다. 켜고 끄는 규칙은 아래 «휠 확대 게이트» 이펙트에 있다 */
      scrollWheel: false,
      keyboardShortcuts: false,
      disableDoubleClickZoom: true,
      disableDoubleTapZoom: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: true,
      center: new maps.LatLng(EXIT5.lat, EXIT5.lng),
      zoom: MAP_MIN_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
    });
    mapRef.current = map;

    /* 네이버가 **마운트 노드 자신**에 `tabindex="0"` 을 붙인다 — 접근성 이름도 없는
       **빈 탭 정지점**이라 제거한다(자손이 아니라 노드 자신이다) */
    node.removeAttribute("tabindex");

    /* 그리기는 `MAP_FEATURES` 순회 1개로 끝난다 — 항목을 넣고 빼는 것이 곧 지도 수정이다.
       번호 배지는 **배열 순서(지리 순서)** 에서 자동 부여된다(§20.20.1) */
    const overlays: NaverOverlay[] = [];
    const labels: LabelEntry[] = [];
    MAP_FEATURES.forEach((feature, index) => {
      overlays.push(...drawFeature(maps, map, feature));
      const marker = createLabelMarker(maps, map, feature, index, true, map.getZoom());
      overlays.push(marker);
      labels.push({ marker, feature, index });
    });
    overlaysRef.current = overlays;
    labelsRef.current = labels;

    fit(maps, map);
    setZoom(map.getZoom());
    setStatus("ready");
  }, [fit, syncLabelWidth]);

  /**
   * 줌에 따라 라벨 텍스트를 접는다(§21.2): ① 등급 임계 ② 겹치면 **낮은 등급 쪽을 배지로** ③ `primary` 는 접지 않는다.
   * ⚠ 겹침 판정은 **렌더 후 화면 좌표 사각형 교차**로 한다 — 지리 좌표로 추정하지 마라(§20.23.5).
   * 접혀도 **번호 배지는 남고 범례가 번호를 설명**한다 — §0.4 은폐가 아니다.
   */
  const applyLabelVisibility = useCallback((currentZoom: number) => {
    paintLabels(
      {
        labels: labelsRef.current,
        folded: foldedRef.current,
        selectedId: selectedRef.current,
        focusedId: focusedRef.current,
        node: mountRef.current,
      },
      currentZoom,
    );
  }, []);

  /**
   * 팝업 열기/닫기(§25.7). **한 번에 하나만** 열린다. 같은 항목을 다시 누르면 닫힌다(토글).
   * 선택 상태를 `selectedRef` 에도 두는 이유: `applyLabelVisibility` 가 `useCallback([])` 이라
   * **state 를 클로저로 읽으면 옛 값을 본다.**
   */
  const selectFeature = useCallback(
    (id: string | null) => {
      const map = mapRef.current;
      const next =
        id === null || selectedRef.current === id
          ? null
          : (() => {
              const index = MAP_FEATURES.findIndex((f) => f.id === id);
              return index < 0 ? null : { id, index };
            })();
      selectedRef.current = next?.id ?? null;
      setSelected(next);
      if (next !== null && map !== null) {
        /*
         * 세로 자리만 정한다(§25.5): **마커가 박스 위쪽이면 팝업은 아래로.**
         * 가로는 박스에 고정이라 계산할 것이 없다 — 잘림이 계산이 아니라 **구조로** 0이다.
         * 마커 위치는 렌더된 DOM 에서 읽는다(지리 좌표 추정 금지, §20.23.5).
         */
        const node = mountRef.current;
        const el = node?.querySelector(`[data-rally-label="${next.id}"]`);
        const boxEl = node?.parentElement;
        if (el !== null && el !== undefined && boxEl != null) {
          const box = boxEl.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          setPopupSide(r.top + r.height / 2 - box.top < box.height / 2 ? "bottom" : "top");
        }
      }
      if (mapRef.current !== null) applyLabelVisibility(mapRef.current.getZoom());
    },
    [applyLabelVisibility],
  );

  /**
   * 키보드 그룹(§27.8) — 지도 안 조작을 **탭 정지점 1개** 뒤에 모은다(roving tabindex:
   * 그룹 안에서 `tabindex="0"` 은 현재 항목 하나뿐).
   * ⚠ **`role="application"` 을 쓰지 마라** — 스크린리더 브라우즈 모드가 꺼져 범례 낭독이 망가진다.
   */
  const focusItem = useCallback(
    (id: string) => {
      focusedRef.current = id;
      setFocusedId(id);
      /* ⚠ **순서가 이 함수의 전부다. `focus()` 를 위로 올리지 마라.** 먼저 포커스하면 뒤이은
         `paint()` 가 마커 아이콘을 다시 그려 **그 노드를 없애고**, 포커스가 `body` 로 떨어져
         **방향키로 다음 지점에 갈 수 없다.** → **다시 그린 뒤에 그 결과 노드를 조회해 포커스한다** */
      const map = mapRef.current;
      if (map !== null) applyLabelVisibility(map.getZoom());
      const target = id.startsWith("rally-zoom")
        ? document.getElementById(id)
        : (mountRef.current?.querySelector<HTMLElement>(`[data-rally-hit="${id}"]`) ?? null);
      target?.focus({ preventScroll: true });
    },
    [applyLabelVisibility],
  );

  useEffect(() => {
    const box = boxRef.current;
    if (box === null || status !== "ready") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const hit = target.closest<HTMLElement>("[data-rally-hit]");
      const isZoomButton = target.id === "rally-zoom-in" || target.id === "rally-zoom-out";
      if (hit === null && !isZoomButton) return;
      const order = keyboardOrder();
      const currentId = hit?.dataset.rallyHit ?? target.id;
      const index = order.indexOf(currentId);
      if (index < 0) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        focusItem(order[(index + 1) % order.length] ?? currentId);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        focusItem(order[(index - 1 + order.length) % order.length] ?? currentId);
        return;
      }
      // `+`/`−` 는 `<button>` 이라 Enter·Space 가 브라우저 기본 동작으로 눌린다 — 가로채지 않는다
      if ((e.key === "Enter" || e.key === " ") && hit !== null) {
        e.preventDefault();
        selectFeature(currentId);
      }
    };
    /* 그룹 안 포커스 여부 — 범례 해당 행을 함께 강조한다(§27.8.4).
       ⚠ **범례 행을 `<button>` 으로 만들지 마라** — 텍스트 등가가 범례에 의존하는 구조가 흔들리고
       탭 정지점도 늘어난다. 시각 강조만 준다 */
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      setGroupFocused(
        t instanceof HTMLElement &&
          (t.closest("[data-rally-hit]") !== null || t.id.startsWith("rally-zoom")),
      );
    };
    const onFocusOut = () => setGroupFocused(false);
    box.addEventListener("keydown", onKeyDown);
    box.addEventListener("focusin", onFocusIn);
    box.addEventListener("focusout", onFocusOut);
    return () => {
      box.removeEventListener("keydown", onKeyDown);
      box.removeEventListener("focusin", onFocusIn);
      box.removeEventListener("focusout", onFocusOut);
    };
  }, [focusItem, selectFeature, status]);

  /* 배지·pill 클릭 → 팝업. 지도 빈 곳 클릭 → 닫기(§25.7) */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || status !== "ready") return;
    const listeners: NaverMapEventListener[] = labelsRef.current.map((e) =>
      e.marker.addListener("click", () => selectFeature(e.feature.id)),
    );
    listeners.push(map.addListener("click", () => selectFeature(null)));
    return () => {
      for (const l of listeners) maps.Event.removeListener(l);
    };
  }, [selectFeature, status]);

  /* `Esc` 로 닫는다. ⚠ **`document` 레벨이어야 한다. 패널에만 걸지 마라**(§31.7) — 팝업 안에 포커스
     트랩이 없어 다른 곳을 클릭하면 포커스가 팝업 밖으로 나가는데 그때도 `Esc` 가 동작해야 한다 */
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* 팝업만 닫는다. **로드뷰·전체 화면 모달을 함께 닫지 마라** — `<dialog>` 는 top-layer 라
         모달이 열려 있으면 이 핸들러가 아니라 브라우저가 먼저 처리한다(§27.14.6-262) */
      const openId = selectedRef.current;
      selectFeature(null);
      if (openId !== null) focusItem(openId); // 연 마커로 포커스를 되돌린다(§27.8.2)
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusItem, selectFeature, selected]);

  /* **선택된 항목의 도형 강조**(헤일로) — 배지 링만으로는 *"눌렀는데 어느 띠인지"* 가 안 보인다.
     **매번 새로 만들고 지운다**(`setOptions` 토글이 아니다) — 그래야 **떠도는 참조가 남지 않는다.**
     ⚠ 정리 함수에서 `setMap(null)` 을 빠뜨리지 마라(네이버 오버레이는 직접 떼야 사라진다) ·
     점·핀은 `createHighlight` 가 빈 배열을 준다. **여기서 특례를 만들지 마라** */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    const clear = () => {
      for (const overlay of highlightRef.current) overlay.setMap(null);
      highlightRef.current = [];
    };
    clear();
    if (maps === undefined || map === null || selected === null) return clear;
    const feature = MAP_FEATURES[selected.index];
    if (feature === undefined) return clear;
    highlightRef.current = createHighlight(maps, map, feature);
    return clear;
  }, [selected, status]);

  /*
   * 줌·팬 중에도 팝업은 **열린 채 유지**한다(박스 고정이라 흔들리지 않는다).
   * 다만 **선택 마커가 박스 밖으로 나가면 닫는다** — 가리킬 대상이 없는 설명은 오독을 만든다(§25.7).
   */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || selected === null) return;
    const feature = MAP_FEATURES[selected.index];
    if (feature === undefined) return;
    const check = () => {
      const at = featureLabelAnchor(feature, map.getZoom());
      if (!map.getBounds().hasLatLng(new maps.LatLng(at.lat, at.lng))) selectFeature(null);
    };
    const listener = map.addListener("idle", check);
    return () => maps.Event.removeListener(listener);
  }, [selectFeature, selected]);

  /* 로드뷰가 열리면 팝업을 닫는 것은 `openRoadview` 가 직접 한다(§25.7) —
     상태 변화를 보고 뒤따라 닫으면 한 프레임 동안 둘이 겹친다 */

  /* 줌이 바뀔 때마다 라벨 접힘을 다시 계산한다 */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || status !== "ready") return;
    const onZoom = () => {
      const z = map.getZoom();
      setZoom(z);
      setMoved(true);
      applyLabelVisibility(z);
    };
    const onDrag = () => setMoved(true);
    /* `내 위치` 라벨 클램프는 **지도가 멈출 때마다 다시 계산해야 한다**(§30.16.3-1) — 핀이 지도 좌표에
       고정돼 팬·줌마다 화면 위치가 바뀌므로 한 번만 걸면 **라벨이 밀려 있거나 다시 잘린다** */
    const onIdle = () => {
      clampMyLocationLabel(mountRef.current, boxRef.current);
      /* ★ **라벨 접힘을 `idle` 에서 다시 계산한다 — 지우면 라벨이 서로를 가린 채 남는다.**
         `zoom_changed` 는 **줌 애니메이션이 시작될 때** 와서 `paintLabels` 가 **라벨이 목적지에
         도착하기 전** 사각형을 재고 "안 겹친다"로 판정한다.
         ⚠ **`zoom_changed` 쪽도 지우지 마라** — 줌 중에도 등급별 표시/숨김은 즉시 따라와야 한다*/
      applyLabelVisibility(map.getZoom());
    };
    const listeners: NaverMapEventListener[] = [
      map.addListener("zoom_changed", onZoom),
      map.addListener("dragend", onDrag),
      map.addListener("idle", onIdle),
    ];
    applyLabelVisibility(map.getZoom());
    return () => {
      for (const l of listeners) maps.Event.removeListener(l);
    };
  }, [applyLabelVisibility, status]);

  /* 조작 계약의 나머지 절반(§21.1.1) — **Ctrl/⌘ + 휠 → 확대·축소**만 붙인다.
     ⚠ **두 손가락 팬(`panBy`)을 다시 넣지 마라.** `pinchZoom` 과 **같은 2-touch 제스처를 나눠 갖지 못해**
     평행이동만 시켜도 지도가 축소된다 — **이동하려다 축척이 바뀌는 것은 조작이 아니라 사고다.**
     되살리려면 **두 제스처가 분리되는지부터 실기기에서 실측하라.**
     ⚠ **한 손가락 팬을 여는 것으로 대체하지 마라 — 그것이 원래 막으려던 사고다** */
  useEffect(() => {
    const node = mountRef.current;
    if (node === null || status !== "ready") return;

    const onWheel = (e: WheelEvent) => {
      const map = mapRef.current;
      if (map === null) return;
      /* 게이트가 켠 상태면 **네이버가 직접 처리**한다. 여기서 또 다루면 두 배로 확대된다 */
      if (wheelGateRef.current) return;
      // 터치 기기에서 **맨 휠은 페이지 스크롤이다.** Ctrl/⌘ 를 누른 경우에만 지도가 반응한다
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const next = map.getZoom() + (e.deltaY < 0 ? 1 : -1);
      const clamped = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, next));
      if (clamped !== map.getZoom()) map.setZoom(clamped, false);
    };

    // `preventDefault` 를 쓰려면 passive 가 아니어야 한다
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
    };
  }, [status]);

  /* ★ **휠 확대 게이트** — **커서를 지도 위로 «움직이면» 켜고, 페이지가 스크롤되면 끈다.**
     ⚠ **`pointerenter` 로 켜지 마라** — 커서가 가만히 있어도 **스크롤로 지도가 커서 밑에 들어오며**
     그 이벤트가 난다(= §27.13 의 그 사고). **`pointermove` 만 켜기 근거로 쓴다.**
     ⚠ **끄는 쪽을 빼지 마라** — 켜 둔 채 스크롤하면 같은 사고가 난다 */
  useEffect(() => {
    const node = mountRef.current;
    if (node === null || status !== "ready") return;

    const setGate = (on: boolean) => {
      const map = mapRef.current;
      if (map === null || wheelGateRef.current === on) return;
      wheelGateRef.current = on;
      map.setOptions({ scrollWheel: on });
    };
    const onPointerMove = () => {
      if (wheelZoomEnabled()) setGate(true);
    };
    const onLeave = () => setGate(false);
    const onScroll = () => setGate(false);

    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      wheelGateRef.current = false;
    };
  }, [status]);

  /* ⚠ **파노라마 서브모듈은 본 스크립트 `onLoad` «이후»에 도착한다** — 한 번만 확인하면 `로드뷰 보기`
     버튼이 영영 렌더되지 않는다. 시한을 넘기면 **미지원으로 확정**한다(죽은 버튼 금지) */
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
    check();
    return () => window.clearTimeout(timer);
  }, [status]);

  /** 팝업의 `로드뷰 보기` — **팝업을 함께 닫는다**(둘 다 열려 있으면 지도가 두 겹으로 덮인다, §25.7).
      ⚠ 이 닫기를 `useRoadview` 안으로 옮기지 마라 — 팝업 상태는 지도마다 따로다 */
  const handleRoadview = useCallback(
    (feature: MapFeature) => {
      openRoadview(feature);
      selectFeature(null);
    },
    [openRoadview, selectFeature],
  );

  /* 전체 화면 진입 — **페이지 지도의 팝업을 먼저 닫는다**(§27.6). 닫으면 페이지 지도는 손대지 않은 그대로다 */
  const openFullscreen = useCallback(() => {
    selectFeature(null);
    setFullscreenOpen(true);
  }, [selectFeature]);

  /* 컨트롤 행(§21.1.3) — 조작은 전부 지도 **밖** 버튼이 담당한다 */
  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (map === null) return;
    const next = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, map.getZoom() + delta));
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

  /* 인증 실패는 스크립트가 이 전역 콜백으로 알린다 — 등록하지 않으면 Client ID 가 틀렸을 때
     빈 지도가 남는다(가짜 동작 금지). 마운트 즉시 등록해 로드 경합을 피한다 */
  useEffect(() => {
    window.navermap_authFailure = () => setStatus("failed");
    return () => {
      delete window.navermap_authFailure;
    };
  }, []);

  /* 스크립트가 이미 로드된 채 마운트되면(뒤로가기 등) `onLoad` 가 안 오므로 여기서 직접 만든다.
     ⚠ **정리(destroy)를 같은 effect 에 둬라** — 분리하면 StrictMode 재마운트에서 파괴만 되고
     재생성되지 않아 빈 박스가 남는다 */
  useEffect(() => {
    if (window.naver?.maps !== undefined) build();
    return () => {
      for (const overlay of [...overlaysRef.current, ...myOverlaysRef.current]) {
        overlay.setMap(null);
      }
      overlaysRef.current = [];
      myOverlaysRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
      boundsRef.current = null;
    };
  }, [build]);

  /* 8초 타임아웃 — onError 없이 매달리는 경우까지 실패로 확정한다 */
  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("failed"), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  /* 컨테이너 폭이 바뀌면 재적합. 고정 zoom 을 쓰지 않는 대신 이 관측이 필수다 */
  useEffect(() => {
    const node = mountRef.current;
    if (node === null || status !== "ready") return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const maps = window.naver?.maps;
        const map = mapRef.current;
        if (maps === undefined || map === null) return;
        syncLabelWidth();
        fit(maps, map);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fit, status, syncLabelWidth]);

  /**
   * 내 위치 1회 조회.
   * ⚠ **버튼을 눌렀을 때만 권한을 요청한다**(§20.14.1-1) — 맥락 없이 뜨는 권한 팝업은 대부분 거부되고,
   *   **한 번 거부되면 브라우저 설정에 들어가야 되돌릴 수 있다.**
   * ⚠ 위치는 **브라우저 메모리에서만** 쓴다 — 서버 전송·localStorage·쿠키·URL 기록 전부 없다(§20.14.6).
   */
  const requestLocation = useCallback(() => {
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const maps = window.naver?.maps;
        const map = mapRef.current;
        const { latitude: lat, longitude: lng, accuracy } = position.coords;

        // 재요청 시 이전 마커·원을 먼저 지운다 — 누적되면 궤적처럼 보인다(§20.14.4)
        for (const overlay of myOverlaysRef.current) overlay.setMap(null);
        myOverlaysRef.current = [];

        const accuracyM =
          typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy > 0
            ? Math.ceil(accuracy)
            : null;

        // 기준점은 **① 5번 출구**다(§20.14.3). 대오가 아니라 조합원이 실제로 향하는 지하철 출구
        const distanceText = formatDistanceKo(haversineMeters(EXIT5, { lat, lng }));
        const bearing = bearingLabel8(EXIT5, { lat, lng });

        let inBounds = false;
        if (maps !== undefined && map !== null) {
          const pos = new maps.LatLng(lat, lng);
          /* ⚠ **`fitBounds` 를 다시 호출하지 마라**(§20.14.1-2) — 집에서 누르면 지도가 서울 전체로
             축소돼 집결지 정보가 무의미해진다. 범위 밖이면 방향·거리 텍스트로만 답한다 */
          inBounds = map.getBounds().hasLatLng(pos);
          if (inBounds) {
            /* ⚠ **정확도 원을 그리지 마라**(§20.21.1) — 지도 위 점선 원은 «범위로만 아는 것»을 뜻해서,
               여기 쓰면 같은 도형이 **근거가 다른 두 뜻**(우리의 무지 ↔ 기기 측정 오차)을 갖는다.
               **내 위치는 원이 아니라 핀**이고 정밀도 주장은 상태 문구 `약 ±{n}m` 가 전담한다 */
            myOverlaysRef.current = [
              createLabelMarker(maps, map, myLocationFeature({ lat, lng }), MAP_FEATURES.length, true),
            ];
            /* 마커 DOM 이 붙은 다음 프레임에 잰다 — 만들자마자 재면 폭이 0 이다(§30.16.3-1) */
            requestAnimationFrame(() => clampMyLocationLabel(mountRef.current, boxRef.current));
          }
        }

        setMyLocation({ lat, lng, accuracyM, distanceText, bearing, inBounds });
        setLocStatus("shown");
      },
      (error) => {
        for (const overlay of myOverlaysRef.current) overlay.setMap(null);
        myOverlaysRef.current = [];
        setMyLocation(null);
        // 거부는 **정상 사용**이다 — 오류와 다른 상태로 분리해 중립 문구를 낸다(§20.14.3)
        setLocStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      GEO_OPTIONS,
    );
  }, []);

  const accuracyText =
    myLocation?.accuracyM !== null && myLocation !== null
      ? ` (정확도 약 ±${myLocation.accuracyM}m)`
      : "";

  const locationMessage =
    locStatus === "requesting"
      ? "위치를 확인하는 중입니다…"
      : locStatus === "denied"
        ? "위치 표시를 사용하지 않습니다. 위 안내와 지도만으로도 집결 위치를 확인할 수 있습니다."
        : locStatus === "error"
          ? "위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
          : locStatus === "shown" && myLocation !== null
            ? myLocation.inBounds
              ? `내 위치를 지도에 표시했습니다. 집결 위치에서 ${myLocation.bearing} ${myLocation.distanceText}${accuracyText}`
              : `내 위치는 지도 범위 밖입니다. 집결 위치에서 ${myLocation.bearing} ${myLocation.distanceText}${accuracyText}`
            : "";

  /* 저정확도 추가줄(§20.21.1). 임계값은 **대오 밴드 폭**에서 나온다 — 오차가 밴드 폭을 넘으면
     "내가 밴드 안인가"를 판단할 수 없다. ⚠ **적색·경고 아이콘 금지** — 오류가 아니라 조건 안내다 */
  const lowAccuracy =
    locStatus === "shown" &&
    myLocation?.accuracyM !== null &&
    myLocation !== null &&
    myLocation.accuracyM > LOW_ACCURACY_THRESHOLD_M;

  const showMyLocationLegendRow = locStatus === "shown" && myLocation?.inBounds === true;

  /* 팝업 내용은 **전부 `MAP_FEATURES` 에서 파생**된다 — 새 문자열이 0이라는 뜻이다(요구 88·89) */
  const selectedIndex = selected?.index ?? -1;
  const selectedFeature = selectedIndex >= 0 ? (MAP_FEATURES[selectedIndex] ?? null) : null;

  return (
    <>
      <Script
        /* `submodules=panorama` 가 없으면 `maps.Panorama` 가 아예 없다 —
           그러면 `로드뷰 보기` 버튼이 렌더되지 않아 §21.3 이 통째로 사라진다(실측 확인) */
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=panorama`}
        strategy="afterInteractive"
        onLoad={build}
        onError={() => setStatus("failed")}
      />

      <figure className="mt-5">
        <p className="sr-only">
          {
            "아래는 집결 위치를 표시한 지도입니다. 같은 내용을 위 “코스콤지부 집결 위치” 안내에서 텍스트로 제공합니다."
          }
        </p>

        {/*
          드래그 개방의 **유일한 실효 완화 수단**(§27.16.3 (A)).
          ⚠ **지도 «위»다. 아래로 내리지 마라**(§27.15.1 · QA-247) — 지도가 화면을 덮을수록 아래 것은
          화면 밖으로 나가 **위험이 최대인 순간에 완화가 0이 된다.**
          ⚠ **문안에서 좌우를 가리키지 마라**(§27.16.2 · 좌우 여백에는 엄지가 안 들어간다) —
          실패하면 **조합원이 문구 자체를 불신한다.** `위나 아래` 둘 다 말해야 한다.
          ⚠ **이것도 사실 주장이다** · **흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라.**
        */}
        <p className="mb-2 break-keep text-caption font-semibold text-ink">
          ※ 지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 위나 아래 빈 곳을 쓸어 주세요.
        </p>

        {/*
          고정 종횡비 박스 — 실패·미로드에서도 크기가 변하지 않아 CLS 0 (§20.3.4).
          `aspect-[4/5]` 의 역할은 **축척 확보가 아니라 위·아래 pill 이 설 자리를 만드는 것**이다(§30.1.3).
          박스 폭이 고정이라 **높이만 종횡비의 소관**이고, 가로가 구속 축일 때 손댈 지렛대는 종횡비가
          아니라 `FIT_PADDING` 이다(§30.1.4 · 기각 후보는 §30.1).
          ⚠ **`px-4`(좌우 16px)를 늘리지 마라** — **이 값이 축척을 직접 결정한다**(§30.2.2).
        */}
        <div
          ref={boxRef}
          /* ⚠ **`isolate` 를 빼지 마라.** 마커 `z-index` 가 1000 대인데 `position: relative` 만으로는
             쌓임 맥락이 안 만들어져 그 값이 **문서 최상위에서 경쟁한다** — 빼면 **마커 배지가
             고정 헤더(z-200) 위로 뚫고 올라온다.** 박스 안 상대 순서는 그대로다 */
          className="rounded-card relative isolate aspect-[4/5] w-full overflow-hidden md:aspect-[16/9]"
        >
          {/* ⚠ **마운트 노드에 `aria-hidden` 을 걸지 마라** — 네이버 로고·저작권 컨트롤에 링크가 들어가고,
              숨겨진 영역 안의 포커스 가능 요소는 WCAG 2.4.3·4.1.2 위반이 된다(§20.9).
              `touchAction: "none"` 은 **한 손가락 드래그 개방의 본체**다(§27.13.6) — 되돌리려면 `pan-y` 로,
              지도 옵션의 `draggable` 을 `(pointer: fine)` 분기로 **함께** 되돌려라(둘은 한 쌍이다) */}
          <div ref={mountRef} className="size-full" style={{ touchAction: "none" }} />

          {/*
            키보드 그룹(§27.8.1). 마커는 네이버가 주입한 DOM 안이라 이 요소의 **자식이 될 수 없어**
            `aria-owns` 로 논리적 소유를 선언한다.
            ⚠ **`pointer-events-none` 을 빼지 마라** — 클릭을 가로채면 지도 조작이 죽는다.
            ⚠ **`role="application"` 을 쓰지 마라** — 스크린리더 브라우즈 모드가 꺼져 범례 낭독이 망가진다.
          */}
          {status === "ready" ? (
            <>
              <div
                role="group"
                aria-label="지도 조작"
                aria-describedby="rally-kbd-help"
                aria-owns={keyboardOrder()
                  .map((id) => (id.startsWith("rally-zoom") ? id : `rally-marker-${id}`))
                  .join(" ")}
                className="pointer-events-none absolute inset-0"
              />
              <span id="rally-kbd-help" className="sr-only">
                방향키로 이동하고 엔터로 실행합니다
              </span>
              {/*
                컨트롤은 **전부 지도 안**이다. 자리: **왼쪽 = 지도를 보는 조작**(확대·축소·복귀) ·
                **오른쪽 = 무엇을 볼지 고르는 조작**(내 위치·거리뷰·크게 보기).
                ⚠ 아래 두 모서리는 축척 바·네이버 로고가 쓴다(§22.10 2-B).
              */}
              <MapControlStack side="left">
                <ZoomButtons
                  zoom={zoom}
                  onZoom={zoomBy}
                  itemProps={(id) => ({ id, tabIndex: focusedId === id ? 0 : -1 })}
                />
                {/*
                  드래그로 길을 잃었을 때의 **유일한 복귀 경로**다(§27.4.3). **지우지 마라.**
                  ⚠ 이 버튼이 고치는 것은 "길을 잃었다"이지 **"페이지를 못 내린다"가 아니다.**
                  움직였을 때만 나타난다 — 누를 수 없는 버튼이 비싼 지도 위 자리를 상시 차지하지 않는다.
                */}
                {moved ? (
                  <button
                    type="button"
                    onClick={resetView}
                    aria-label="처음 위치로"
                    title="처음 위치로"
                    className={MAP_CTRL_CLASS}
                  >
                    <ResetIcon />
                  </button>
                ) : null}
              </MapControlStack>

              <MapControlStack side="right">
                {/* 맨 위가 `내 위치` — 당일 자기 자리에서 가장 먼저 누를 버튼이라 엄지가 닿는 첫 자리다 */}
                {geoSupported ? (
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locStatus === "requesting"}
                    aria-label={locStatus === "shown" ? "내 위치 다시 확인" : "내 위치 표시"}
                    title={locStatus === "shown" ? "내 위치 다시 확인" : "내 위치 표시"}
                    className={MAP_CTRL_CLASS}
                  >
                    <MyLocationIcon />
                  </button>
                ) : null}
                {/* ★ 거리뷰 토글 — 파노라마 모듈이 있을 때만. 없으면 눌러도 열 것이 없다 */}
                {panoSupported ? (
                  <StreetToggleButton
                    on={streetMode}
                    onToggle={toggleStreetMode}
                    buttonRef={roadviewButtonRef}
                  />
                ) : null}
                {/* 3단계-B — `STAGE3B_FULLSCREEN_MAP` 한 곳으로 켜고 끈다(§27.18) */}
                {STAGE3B_FULLSCREEN_MAP ? (
                  <button
                    type="button"
                    ref={fullscreenButtonRef}
                    onClick={openFullscreen}
                    aria-label="지도 크게 보기"
                    title="지도 크게 보기"
                    className={MAP_CTRL_CLASS}
                  >
                    <ExpandIcon />
                  </button>
                ) : null}
              </MapControlStack>
            </>
          ) : null}

          {/*
            팝업 — **박스 안 고정 패널**이다(§25.4). 말풍선이 아니다.
            ⚠ **말풍선·`InfoWindow` 로 바꾸지 마라** — 위치를 계산으로 풀면 박스 경계 클램프를 직접
            구현해야 하고 자유 드래그에서 팝업이 박스 밖으로 나간다(지금은 **구조로 잘림 0**이다).
            ⚠ **전체 화면 모달로 만들지 마라**(요구 90) — 지도와 범례가 **동시에** 보여야 대응이 성립한다.
          */}
          {selectedFeature !== null ? (
            <MapPopupPanel
              feature={selectedFeature}
              index={selectedIndex}
              side={popupSide}
              onRoadview={panoSupported ? handleRoadview : null}
              onClose={() => {
                const openId = selectedRef.current;
                selectFeature(null);
                if (openId !== null) focusItem(openId);
              }}
            />
          ) : null}

          {status !== "ready" ? (
            <div className="absolute inset-0">
              <RallyMapFallback status={status} />
            </div>
          ) : null}
        </div>

        {/*
          어포던스 문구(요구 87 · §25.2 겹1) — **지도 바로 아래 · 키 줄 위.** `<figcaption>` 밖 `<p>` 인
          이유는 `<figcaption>` 이 `<figure>` 의 마지막 자식이어야 하기 때문이다(§27.14.0).
          ⚠ 흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라.
          ⚠ **이 문장은 사실 주장이다** — 도형(원·밴드·부지)을 눌리게 만들면 **거짓이 된다**(§25.2.1).
        */}
        <p className="mt-4 break-keep text-caption font-semibold text-ink">
          ※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.
        </p>
      {/*
        지도 아래에는 **위치 요청의 답**(`role="status"`)만 남는다(실패 상태에서는 렌더하지 않는다).
        ⚠ **지도 아래 버튼 행을 다시 만들지 마라** — 세 버튼은 지도 **안**으로 옮겨졌고, 같은 기능이
        두 곳에 있으면 조합원이 어느 것이 진짜인지 묻게 된다. `min-h-touch` 도 함께 뺐다.
      */}
      <div className="mt-3">
        {status === "ready" ? (
          <>
            {/* ⚠ idle 에도 DOM 에 존재해야 한다 — 나중에 생긴 노드의 내용을 못 읽는 SR 이 있다.
                ⚠ `assertive` 를 쓰지 마라(읽던 것을 끊는다) · 거부를 `role="alert"`·적색으로 표시하지 마라
                   (정당한 선택을 오류처럼 보이게 하는 것은 압박이다 — §20.14.3).
                ⚠ 로드뷰와 내 위치가 **같은 상태 영역을 공유**한다(§21.1.3) — 영역을 늘리지 마라.
                ⚠ **지도 확대·축소·이동은 문구를 만들지 않는다** — 매 조작마다 낭독하면 소음이다. */}
            <div role="status">
              {geoSupported ? (
                <>
                  <p className="mt-2 break-keep text-body text-ink">{locationMessage}</p>
                  {lowAccuracy ? (
                    <p className="mt-1 break-keep text-body text-ink">{LOW_ACCURACY_NOTE}</p>
                  ) : null}
                </>
              ) : null}
              {panoStatus === "failed" ? (
                <p className="mt-2 break-keep text-body text-ink">
                  이 위치의 로드뷰를 불러오지 못했습니다.
                </p>
              ) : null}
            </div>

            {/*
              ⚠ **지우지 마라 — 기능 설명이 아니라 사고 예방 문구다**(§20.14.2).
              브라우저 위치 권한은 **사이트(origin)별로 따로** 부여되므로 여기서 허용해도 출석 사이트는
              다시 물어본다. 이 문장이 없으면 조합원이 "여기서 켰으니 됐다"고 믿고 **현장에서 출석에 실패한다.**
            */}
            {geoSupported ? (
              <p className="mt-2 max-w-[var(--container-prose)] break-keep text-caption text-ink-muted">
                위치는 이 브라우저 안에서만 사용하며 서버로 보내거나 저장하지 않습니다. 길찾기 보조
                기능이며 출석체크와 무관합니다 — 출석은 주최측 QR로 진행하고, 위치 권한은 사이트마다
                따로 물어봅니다.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
        {/* 범례는 지도 바로 아래 붙는다. ⚠ **접거나 `sr-only` 로 돌리지 마라**(§0.4).
            행은 `MAP_FEATURES` 에서 파생된다 — 배열에서 빠진 항목의 행은 자동으로 사라진다.
            ⚠ **`<figure>` 의 마지막 자식이어야 한다**(§27.14.0 · HTML 스펙) */}
        <figcaption className="mt-4">
          <p className="break-keep text-caption text-ink">{LEGEND_KEY}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {MAP_FEATURES.map((feature, index) => (
              /* `break-words` 보험 — 공백 없는 긴 낱말(`국회의사당역`·`여의도공원`)이 확대 200% 에서
                 줄 폭을 넘치는 것을 막는다. ⚠ **`break-keep` 을 빼지 마라** — 한글이 음절 단위로 끊겨
                 판독성이 무너진다. 둘은 함께 간다(한 낱말이 줄 폭보다 길 때만 쪼개진다) */
              <li
                key={feature.id}
                /* `-mx-1 px-1`: 강조 배경이 글자에 붙지 않게 패딩을 주되 **음수 마진으로 상쇄**한다.
                   패딩만 주면 텍스트 가용 폭이 줄어 **확대 200% 에서 ③ 행이 7px 넘친다**(실측). */
                className={`-mx-1 flex gap-2 break-keep break-words rounded-card px-1 text-caption text-ink ${
                  groupFocused && focusedId === feature.id ? "bg-primary-tint outline-2 outline-ink" : ""
                }`}
              >
                {/* ⚠ **지도 배지와 같은 그림이어야 한다** — 범례의 기호와 지도의 기호가 다르면 대응이 끊긴다.
                    `dangerouslySetInnerHTML` 대상은 **우리가 만든 상수 문자열뿐**이다(외부 입력 없음) */}
                {feature.symbol !== undefined ? (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-4 shrink-0"
                    dangerouslySetInnerHTML={{ __html: symbolSvg(feature.symbol, 16) }}
                  />
                ) : (
                  <span aria-hidden="true" className="emoji-mark">
                    {feature.glyph}
                  </span>
                )}
                <span>
                  {circledNumber(index)} {feature.legend}
                </span>
              </li>
            ))}
            {/* 내 위치 행은 **표시했을 때만** 나타나고 **번호가 없다**(§20.21.1) —
                ①~⑤ 는 안내도의 지점이고 내 위치는 사용자가 만들어 낸 동적 표식이라 성질이 다르다 */}
            {showMyLocationLegendRow
              ? (() => {
                  const pin = myLocationFeature({ lat: 0, lng: 0 });
                  return (
                    <li className="flex gap-2 break-keep break-words text-caption text-ink">
                      <span aria-hidden="true">{pin.glyph}</span>
                      <span>{pin.legend}</span>
                    </li>
                  );
                })()
              : null}
          </ul>
          {/* ⚠ **범례 각주(`LEGEND_FOOTNOTE`)를 되살리지 마라**(요구 158 · §19-3) — 각주가 말하던 것을
              지도가 직접 표시하므로 되살리면 둘이 정면으로 어긋난다. **새 각주도 만들지 마라** —
              지도에 없는 것을 밝힐 일이 생기면 **범례 행이 진다.** */}
        </figcaption>
      </figure>


      {/* 전체 화면 지도(§27.6) — 로드뷰와 같은 기반, **별도 인스턴스**라 페이지 지도의 드래그·
          `+`/`−`·키보드 그룹·팝업과 의존이 없다. 렌더는 `STAGE3B_FULLSCREEN_MAP` 하나로 끈다(§27.18) */}
      {STAGE3B_FULLSCREEN_MAP ? (
        <RallyFullscreenMap
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          openerRef={fullscreenButtonRef}
          panoSupported={panoSupported}
        />
      ) : null}

      {/* 로드뷰 하단 시트 — 정의와 근거는 `RoadviewSheet`(모듈 상단)에 있다 */}
      {roadviewAt !== null ? (
        <RoadviewSheet
          at={roadviewAt}
          panoDate={panoDate}
          panoStatus={panoStatus}
          mountRef={panoMountRef}
          onClose={closeRoadview}
        />
      ) : null}
    </>
  );
}

/**
 * 전체 화면 지도(§27.6 · §27.14.3) — `<dialog showModal()>` · `100dvh` · 배경 스크롤 잠금 ·
 * `::backdrop` 클릭 핸들러 없음(오탭 닫힘 금지). **새 패턴을 만들지 마라.**
 * ⚠ **별도 지도 인스턴스다. 페이지 지도를 옮겨 오지 마라** — 닫았을 때 초기 뷰가 보존되지 않는다.
 * ⚠ **범례 5행을 넣지 마라**(§27.14.3) — 지도가 이 모드의 목적을 잃을 만큼 줄어든다. 대신 하단 바에
 *   `LEGEND_KEY` 한 줄이 들어간다(§31.2). 판정이 뒤집히면 **접지 말고** 하단에 넣고 지도를 줄여라.
 */
function RallyFullscreenMap({
  open,
  onClose,
  openerRef,
  panoSupported,
}: {
  open: boolean;
  onClose: () => void;
  openerRef: React.RefObject<HTMLButtonElement | null>;
  /** 파노라마 모듈 유무 — **페이지 지도가 이미 판정해 뒀다.** 여기서 다시 폴링하지 않는다 */
  panoSupported: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);

  /* 로드뷰·거리뷰 한 벌 — **모달 전용 인스턴스**. `active` 는 `open` 이다:
     모달이 사라진 뒤 페이지 위에 시트만 남으면 그 시트가 가리키는 지도가 없다 */
  const {
    roadviewAt,
    streetMode,
    panoDate,
    panoStatus,
    panoMountRef,
    roadviewButtonRef,
    openRoadview,
    toggleStreetMode,
    closeRoadview,
  } = useRoadview(mapRef, open);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  /** 선택 강조 헤일로 — 살아 있는 값은 0개 아니면 1개다(`createHighlight`) */
  const highlightRef = useRef<NaverOverlay[]>([]);
  const labelsRef = useRef<LabelEntry[]>([]);
  const foldedRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<string | null>(null);
  const focusedRef = useRef<string>(KEYBOARD_ENTRY_ID);
  const scrollLockRef = useRef(0);
  /** 초기 포커스 대상 — `showModal()` 이 항상 첫 요소를 잡아 주지는 않아 **명시적으로** 옮긴다 */
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [zoom, setZoom] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  const [selected, setSelected] = useState<{ id: string; index: number } | null>(null);
  const [popupSide, setPopupSide] = useState<"top" | "bottom">("bottom");
  const [focusedId, setFocusedId] = useState<string>(KEYBOARD_ENTRY_ID);

  const paint = useCallback((currentZoom: number) => {
    paintLabels(
      {
        labels: labelsRef.current,
        folded: foldedRef.current,
        selectedId: selectedRef.current,
        focusedId: focusedRef.current,
        node: mountRef.current,
      },
      currentZoom,
    );
  }, []);

  /**
   * 라벨 최대 폭을 px 로 확정해 CSS 변수로 내린다 — **페이지 지도와 같은 것이 여기에도 있어야 한다.**
   * ⚠ **없으면 모달 pill 이 통째로 깨진다** — `labelHtml` 의 폴백 `60%` 가 걸리는데 **앵커가 0폭
   *   컨테이닝 블록이라 60% = 0** 이 되어 pill 이 min-content 로 접힌다.
   * ⚠ **페이지 쪽과 공통화하지 마라** — 두 컴포넌트가 각자의 `mountRef` 를 본다.
   */
  const syncLabelWidth = useCallback(() => {
    const node = mountRef.current;
    if (node === null) return;
    node.style.setProperty(
      LABEL_MAX_WIDTH_VAR,
      `${Math.round(node.clientWidth * LABEL_MAX_WIDTH_RATIO)}px`,
    );
  }, []);

  const fit = useCallback((maps: NaverMapsNamespace, map: NaverMap) => {
    const b = MAP_FIT_BOUNDS;
    map.fitBounds(new maps.LatLngBounds(new maps.LatLng(b.south, b.west), new maps.LatLng(b.north, b.east)), FIT_PADDING);
    if (map.getZoom() > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM, false);
    setMoved(false);
  }, []);

  const selectFeature = useCallback(
    (id: string | null) => {
      const next =
        id === null || selectedRef.current === id
          ? null
          : (() => {
              const index = MAP_FEATURES.findIndex((f) => f.id === id);
              return index < 0 ? null : { id, index };
            })();
      selectedRef.current = next?.id ?? null;
      setSelected(next);
      const node = mountRef.current;
      const box = boxRef.current;
      if (next !== null && node !== null && box !== null) {
        const el = node.querySelector(`[data-rally-label="${next.id}"]`);
        if (el !== null) {
          const br = box.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          setPopupSide(r.top + r.height / 2 - br.top < br.height / 2 ? "bottom" : "top");
        }
      }
      const map = mapRef.current;
      if (map !== null) paint(map.getZoom());
    },
    [paint],
  );

  /** 팝업의 `로드뷰 보기` — 팝업을 함께 닫는다(페이지 지도와 같은 계약) */
  const handleRoadview = useCallback(
    (feature: MapFeature) => {
      openRoadview(feature);
      selectFeature(null);
    },
    [openRoadview, selectFeature],
  );

  const focusItem = useCallback(
    (id: string) => {
      focusedRef.current = id;
      setFocusedId(id);
      /* 페이지 지도와 **같은 순서 규칙** — 다시 그린 뒤 그 결과 노드를 포커스한다(위로 올리면 죽는다) */
      const map = mapRef.current;
      if (map !== null) paint(map.getZoom());
      const target = id.startsWith("rally-zoom")
        ? (boxRef.current?.querySelector<HTMLElement>(`#${id}-fs`) ?? null)
        : (mountRef.current?.querySelector<HTMLElement>(`[data-rally-hit="${id}"]`) ?? null);
      target?.focus({ preventScroll: true });
    },
    [paint],
  );

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (map === null) return;
    const next = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, map.getZoom() + delta));
    if (next === map.getZoom()) return;
    map.setZoom(next, !prefersReducedMotion());
  }, []);

  /* 열림 ↔ 닫힘 — **React 상태가 단일 출처이고 방향은 하나다:** 모든 닫기 경로가 `onClose()` 로
     **상태를 먼저** 바꾸고 이 이펙트가 DOM 을 거기에 맞춘다.
     ⚠ **`닫기` 버튼을 `dialogRef.current?.close()` 로 되돌리지 마라** — 닫기가 DOM 에서 시작해 상태로
     거슬러 올라오면 **한 고리만 끊겨도 상태와 DOM 이 갈리고 스스로 복구되지 않는다**(증상: 모달이
     한 번만 열린다). **스크롤·포커스 복원도 `close` 이벤트에 얹지 마라**(안 오면 복원까지 사라진다) */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      dialog.showModal();
      scrollLockRef.current = lockBodyScroll();
      closeButtonRef.current?.focus({ preventScroll: true });
    } else if (!open) {
      if (dialog.open) dialog.close();
      unlockBodyScroll(scrollLockRef.current);
      openerRef.current?.focus({ preventScroll: true });
    }
  }, [open, openerRef]);

  /*
   * 브라우저가 스스로 닫으려 할 때(`Esc` · 뒤로가기 제스처)도 **상태를 거쳐 가게** 만든다 —
   * `cancel` 을 막고 우리가 상태를 내리면 위 이펙트가 `dialog.close()` 를 부른다.
   * (로드뷰 시트가 열려 있으면 `useRoadview` 의 `Esc` 핸들러가 이미 요청을 취소해 여기까지 오지 않는다.)
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    /* `close` 는 **안전망**이다 — 우리가 모르는 경로로 닫혔을 때 상태를 뒤따라 맞춘다.
       복원 작업은 여기 두지 않는다(위 이펙트가 전담한다 — 두 곳에 두면 두 번 실행된다) */
    const onDialogClose = () => onClose();
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onDialogClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onDialogClose);
    };
  }, [onClose]);

  /* 지도 인스턴스 — 열려 있는 동안만 존재한다(로드뷰와 같은 규칙) */
  useEffect(() => {
    if (!open) return;
    const maps = window.naver?.maps;
    const node = mountRef.current;
    if (maps === undefined || node === null) return;

    /* 조작 계약: 여기서는 **한 손가락 팬이 설계된 동작**이다 — 뺏을 페이지 스크롤이 없다(§27.2.1) */
    const map = new maps.Map(node, {
      mapTypeId: maps.MapTypeId.NORMAL,
      draggable: true,
      pinchZoom: true,
      /* 여기는 **조건 없이 켠다** — `showModal()` 이 뒤 문서를 잠가 **뺏을 페이지 스크롤이 없다.**
         페이지 지도만 켜고 여기를 끄면 *"작게 보면 되는데 크게 보면 안 된다"* 가 되어 결함으로 읽힌다 */
      scrollWheel: true,
      keyboardShortcuts: false,
      disableDoubleClickZoom: true,
      disableDoubleTapZoom: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: true,
      center: new maps.LatLng(EXIT5.lat, EXIT5.lng),
      zoom: MAP_MIN_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
    });
    mapRef.current = map;
    /*
     * ⚠ **`node.querySelector("[tabindex]")` 로 바꾸지 마라.** 네이버가 `tabindex="0"` 을 붙이는 것은
     * **마운트 노드 자신**이라 자손을 뒤지면 빗나가고, 대상도 불확정해진다.
     * 그러면 **빈 탭 정지점이 하나 더 생겨** §31.8-370 의 탭 순서가 깨진다.
     */
    node.removeAttribute("tabindex");

    const overlays: NaverOverlay[] = [];
    const labels: LabelEntry[] = [];
    MAP_FEATURES.forEach((feature, index) => {
      overlays.push(...drawFeature(maps, map, feature));
      const marker = createLabelMarker(maps, map, feature, index, true, map.getZoom());
      overlays.push(marker);
      labels.push({ marker, feature, index });
    });
    overlaysRef.current = overlays;
    labelsRef.current = labels;
    /* **`fit()` 보다 먼저다** — 라벨 폭이 정해진 뒤에 그려야 pill 이 접히지 않는다 */
    syncLabelWidth();
    fit(maps, map);
    setZoom(map.getZoom());
    paint(map.getZoom());

    const listeners: NaverMapEventListener[] = [
      map.addListener("zoom_changed", () => {
        const z = map.getZoom();
        setZoom(z);
        setMoved(true);
        paint(z);
      }),
      map.addListener("dragend", () => setMoved(true)),
      /* ⚠ 페이지 지도와 **같은 처방**(§27.14.4-3) — `zoom_changed` 만으로는 이동 중 좌표를 재서 겹침을 놓친다 */
      map.addListener("idle", () => paint(map.getZoom())),
      map.addListener("click", () => selectFeature(null)),
      ...labels.map((e) => e.marker.addListener("click", () => selectFeature(e.feature.id))),
    ];

    const folded = foldedRef.current;
    return () => {
      for (const l of listeners) maps.Event.removeListener(l);
      for (const o of overlays) o.setMap(null);
      overlaysRef.current = [];
      labelsRef.current = [];
      folded.clear();
      selectedRef.current = null;
      setSelected(null);
      map.destroy();
      mapRef.current = null;
    };
  }, [fit, open, paint, selectFeature, syncLabelWidth]);

  /* 컨테이너 폭이 바뀌면 라벨 폭을 다시 내리고 재적합한다(기기 회전·창 크기 변경).
     ⚠ **`syncLabelWidth()` 를 빼지 마라** — 빼면 회전 후 pill 이 옛 폭을 쓴다 */
  useEffect(() => {
    const node = mountRef.current;
    if (node === null || !open) return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const maps = window.naver?.maps;
        const map = mapRef.current;
        if (maps === undefined || map === null) return;
        syncLabelWidth();
        fit(maps, map);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fit, open, syncLabelWidth]);

  /* **선택된 항목의 도형 강조**(헤일로) — 배지 링만으로는 *"눌렀는데 어느 띠인지"* 가 안 보인다.
     **매번 새로 만들고 지운다**(`setOptions` 토글이 아니다) — 그래야 **떠도는 참조가 남지 않는다.**
     ⚠ 정리 함수에서 `setMap(null)` 을 빠뜨리지 마라(네이버 오버레이는 직접 떼야 사라진다) ·
     점·핀은 `createHighlight` 가 빈 배열을 준다. **여기서 특례를 만들지 마라** */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    const clear = () => {
      for (const overlay of highlightRef.current) overlay.setMap(null);
      highlightRef.current = [];
    };
    clear();
    if (maps === undefined || map === null || selected === null) return clear;
    const feature = MAP_FEATURES[selected.index];
    if (feature === undefined) return clear;
    highlightRef.current = createHighlight(maps, map, feature);
    return clear;
    /* `status` 를 넣지 마라 — 이 컴포넌트의 바깥 스코프 값이라 의존성으로 성립하지 않는다.
       모달은 `open` 에서 지도를 만들고 **이 효과가 소스 순서상 그 뒤**라 `mapRef` 가 이미 차 있다. */
  }, [open, selected]);

  /*
   * 팝업 마커 이탈 판정은 **`dragend` 후 1회**다(§27.7.2). 드래그 중 상시 판정하면
   * 손가락을 조금 움직일 때마다 팝업이 닫혔다 열려 **경계에서 깜빡인다.**
   */
  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (maps === undefined || map === null || selected === null) return;
    const feature = MAP_FEATURES[selected.index];
    if (feature === undefined) return;
    const check = () => {
      const at = featureLabelAnchor(feature, map.getZoom());
      if (!map.getBounds().hasLatLng(new maps.LatLng(at.lat, at.lng))) selectFeature(null);
    };
    const listener = map.addListener("idle", check);
    return () => maps.Event.removeListener(listener);
  }, [selectFeature, selected]);

  /* 키보드 그룹 — **페이지 안과 같은 방식이다**(§27.14.4). 조작법이 두 가지가 되면 학습이 두 배다 */
  useEffect(() => {
    const box = boxRef.current;
    if (box === null || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const hit = target.closest<HTMLElement>("[data-rally-hit]");
      const isZoom = target.id === "rally-zoom-in-fs" || target.id === "rally-zoom-out-fs";
      if (hit === null && !isZoom) return;
      const order = keyboardOrder();
      const currentId = hit?.dataset.rallyHit ?? target.id.replace(/-fs$/, "");
      const index = order.indexOf(currentId);
      if (index < 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        focusItem(order[(index + 1) % order.length] ?? currentId);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        focusItem(order[(index - 1 + order.length) % order.length] ?? currentId);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && hit !== null) {
        e.preventDefault();
        selectFeature(currentId);
      }
    };
    /*
     * `Esc`: **팝업이 열려 있으면 팝업만 닫는다**(§27.14.6-262).
     * `<dialog>` 의 기본 `Esc` 가 모달을 통째로 닫아 버리므로 그때는 **기본 동작을 막는다.**
     */
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || selectedRef.current === null) return;
      e.preventDefault();
      const openId = selectedRef.current;
      selectFeature(null);
      focusItem(openId);
    };
    box.addEventListener("keydown", onKeyDown);
    dialogRef.current?.addEventListener("keydown", onEsc);
    const dialog = dialogRef.current;
    return () => {
      box.removeEventListener("keydown", onKeyDown);
      dialog?.removeEventListener("keydown", onEsc);
    };
  }, [focusItem, open, selectFeature]);

  const selectedIndex = selected?.index ?? -1;
  const selectedFeature = selectedIndex >= 0 ? (MAP_FEATURES[selectedIndex] ?? null) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="결의대회 위치 지도 크게 보기"
      className="m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-bg p-0 backdrop:bg-black/80"
    >
      {/* 문안 게이트 56 **개정**(§31.9) — 키 줄이 모달에 들어왔으므로 종전
          *"전체 안내는 페이지 본문의 범례에 있습니다"* 는 더 이상 정확하지 않다. */}
      <p className="sr-only">
        지도는 시각 자료입니다. 기호의 뜻은 아래 줄에 있고, 지점 설명은 번호를 눌러 확인해 주세요.
      </p>
      {/*
        **`flex-col` 3단**(§31.4). ⚠ **컨트롤·문구를 지도 위 오버레이로 되돌리지 마라** —
        오버레이는 지도를 덮고, `flex-col` 로 나눠야 **`fitBounds` 가 실제로 지도가 쓰는 박스를 보고
        계산한다**(오버레이 아래 가려진 영역까지 지도로 치는 문제가 사라진다).
      */}
      <div ref={boxRef} className="flex h-full flex-col bg-bg">
        {/*
          상단 바 — **모달 자체를 다루는 두 컨트롤**(§31.4).
          ⚠ **DOM 순서를 바꾸지 마라** — 탭 순서가 `처음 위치로` → `닫기` → 마커 그룹 → `+`/`−` 여야
          §27.14.4(*"모달에 들어온 사람은 조작하러 온 것이므로 그룹이 바로 다음"*)가 성립한다.
          ⚠ `닫기` 는 이 화면의 **유일한 출구**다 — 상시 노출·자동 숨김 금지(§23.1.5).
        */}
        <div
          /*
           * ⚠ **`flex-wrap` 을 빼지 마라.** `CONTROL_CLASS` 의 `shrink-0 whitespace-nowrap` 때문에
           * 이 행은 **줄일 수 없는 두 버튼**을 갖는데, 텍스트 확대 200% · 360px 에서 합이 넘친다.
           * `flex-wrap` 이 그때만 두 줄로 쌓아 해소한다(100% 에서는 발동하지 않는다).
           */
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 gap-y-2 px-3 pb-2"
          style={{
            paddingTop: "max(12px, env(safe-area-inset-top))",
            paddingLeft: "max(12px, env(safe-area-inset-left))",
            paddingRight: "max(12px, env(safe-area-inset-right))",
          }}
        >
          <button
            type="button"
            onClick={() => {
              const maps = window.naver?.maps;
              const map = mapRef.current;
              if (maps !== undefined && map !== null) {
                fit(maps, map);
                setZoom(map.getZoom());
              }
            }}
            disabled={!moved}
            className={CONTROL_CLASS}
          >
            처음 위치로
          </button>
          <button
            type="button"
            ref={closeButtonRef}
            /* ⚠ `dialogRef.current?.close()` 로 되돌리지 마라 — 위 이펙트 주석의 결함이 재발한다 */
            onClick={onClose}
            className={CONTROL_CLASS}
          >
            닫기
          </button>
        </div>

        {/* 지도 — `flex-1`. **`min-h-0` 을 빼지 마라**: flex 자식의 기본 `min-height:auto` 때문에
            지도가 줄어들지 못해 하단 바를 밀어내고 `100dvh` 를 넘긴다. */}
        {/* `isolate` — 페이지 지도와 같은 이유(마커 z 가 전역으로 새는 것을 막는다) */}
        <div className="relative isolate min-h-0 flex-1 overflow-hidden">
          <div ref={mountRef} className="size-full" style={{ touchAction: "none" }} />

          {open ? (
            <>
              <div
                role="group"
                aria-label="지도 조작"
                aria-describedby="rally-kbd-help-fs"
                aria-owns={keyboardOrder()
                  .map((id) => (id.startsWith("rally-zoom") ? `${id}-fs` : `rally-marker-${id}`))
                  .join(" ")}
                className="pointer-events-none absolute inset-0"
              />
              <span id="rally-kbd-help-fs" className="sr-only">
                방향키로 이동하고 엔터로 실행합니다
              </span>
              {/*
                **자리는 페이지 안 지도와 같다**(왼쪽 확대·축소 / 오른쪽 거리뷰) — 두 지도가 다르게
                생기면 *"큰 지도에서는 버튼이 어디 갔나"* 가 된다.
                ⚠ `처음 위치로` 는 **상단 바에 이미 있다**(§31.4) — 지도 안에 또 만들지 마라.
                ⚠ `내 위치` 도 두지 마라 — 페이지 지도에서 켜면 여기에도 따라온다.
              */}
              <MapControlStack side="left">
                <ZoomButtons
                  zoom={zoom}
                  onZoom={zoomBy}
                  itemProps={(id) => ({ id: `${id}-fs`, tabIndex: focusedId === id ? 0 : -1 })}
                />
              </MapControlStack>
              {/* ★ 거리뷰 토글 — 파노라마 모듈이 있을 때만. 없으면 눌러도 열 것이 없다 */}
              {panoSupported ? (
                <MapControlStack side="right">
                  <StreetToggleButton
                    on={streetMode}
                    onToggle={toggleStreetMode}
                    buttonRef={roadviewButtonRef}
                  />
                </MapControlStack>
              ) : null}
            </>
          ) : null}

          {selectedFeature !== null ? (
            <MapPopupPanel
              feature={selectedFeature}
              index={selectedIndex}
              side={popupSide}
              onRoadview={panoSupported ? handleRoadview : null}
              /* 여기서도 로드뷰 버튼을 낸다 — 팝업은 시트가 열릴 때 닫히고, 시트는 모달이 아니라
                 이 모달의 지도가 시트 위로 남아 **파란 길을 누를 수 있다**
                 (⚠ 그래서 시트는 반드시 `<dialog>` 안이다 — 아래 `RoadviewSheet` 위치를 옮기지 마라) */
              onClose={() => {
                const openId = selectedRef.current;
                selectFeature(null);
                if (openId !== null) focusItem(openId);
              }}
            />
          ) : null}
        </div>

        {/*
          하단 바 — **오버레이가 아니라 지도 밖**이다(§31.4).
          ⚠ **`LEGEND_KEY` 전문 그대로다. 모달용 축약판을 만들지 마라**(문안 게이트 74 · 요구 49·156).
          범례 5행은 팝업으로 도달 가능한데 **`LEGEND_KEY` 만 소유 feature 가 없어 어느 팝업에도 안
          나온다** — 없으면 확신도를 말하는 문자가 이 화면에 하나도 없어 **§2 위반**이다(§31.2).
          ⚠ **범례 5행을 여기 넣지 마라** — 좁은 폭에서 지도가 이름값을 잃는다(§31.3 안 B 폐기).
          ⚠ 어포던스 문구는 **키 줄 바로 아래 `mt-1`** · **접지 마라 · 흐리지 마라 · `sr-only` 금지.**
        */}
        <div
          className="shrink-0 px-3 pt-2"
          style={{
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            paddingLeft: "max(12px, env(safe-area-inset-left))",
            paddingRight: "max(12px, env(safe-area-inset-right))",
          }}
        >
          <p className="break-keep text-caption text-ink">{LEGEND_KEY}</p>
          <p className="mt-1 break-keep text-caption font-semibold text-ink">
            ※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.
          </p>
        </div>
      </div>

      {/*
        ⚠ **로드뷰 시트는 `<dialog>` 안·`flex-col` 3단 밖이다. 옮기지 마라** —
        `<dialog>` 밖에 두면 `showModal()` 의 top layer 에 가려 **보이지 않고**, 3단 안에 두면
        뷰포트 하단 고정이 깨진다. **이 배치가 곧 구현이다.**
      */}
      {roadviewAt !== null ? (
        <RoadviewSheet
          at={roadviewAt}
          panoDate={panoDate}
          panoStatus={panoStatus}
          mountRef={panoMountRef}
          onClose={closeRoadview}
        />
      ) : null}
    </dialog>
  );
}

/**
 * 대체면 — **초기 DOM 에 존재**한다. 지도가 성공했을 때만 사라진다(§20.4.5).
 * ⚠ 스켈레톤·페이드인 등장 애니메이션 금지(§0.4 지연 노출).
 * ⚠ **로딩 상태에도 요약 3줄을 함께 내라** — JS 가 차단되면 상태가 영원히 `loading` 에 머무는데,
 *   그때 요약이 없으면 §0.4 위반이 된다.
 */
function RallyMapFallback({ status }: { status: Exclude<MapStatus, "ready"> }) {
  return (
    <div className="rounded-card flex h-full flex-col items-center justify-center bg-surface px-5 py-6 text-center">
      <p className="text-body font-semibold text-ink">
        {status === "failed" ? "지도를 불러오지 못했습니다." : "지도를 불러오는 중입니다."}
      </p>
      <p className="mt-3 break-keep text-body text-ink">집결 장소 — 국회의사당역 3번 출구 KDB산업은행 앞</p>
      {/* 검증 §19-5 확정본(요구 159).
          ⚠ 옛 문구(`코스콤지부 — 더샵아일랜드파크 앞 의사당대로`)를 되살리지 마라 — 그 자리는
          새 배치도 기준 **2구역**이고, `더샵아일랜드파크` 는 **금지어**다(요구 163-2).
          ⚠ 거리는 **범위**로 쓰고 좌표 파생 수치를 노출하지 마라(요구 151). */}
      <p className="mt-1 break-keep text-body text-ink">코스콤지부 — 집회 3구역</p>
      {/* ★ **좌표가 바뀌면 이 거리를 다시 재고 렌더 문자열과 대조하라**(요구 188 · 파생 근거는
          채택 좌표 §23-1 기준으로 `_workspace/05_verifier_final.md` 에 있다).
          지난번 거리 오류가 살아남은 원인이 **근거가 없어 대조할 대상이 없었던 것**이다. */}
      <p className="mt-1 break-keep text-body text-ink">
        국회의사당역 3번 출구에서 여의도공원 쪽으로 약 230 m
      </p>
    </div>
  );
}
