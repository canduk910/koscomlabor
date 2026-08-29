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

/** 지도 위 이름 pill(10개) — 글자는 «불투명 흰 pill 위»에만 올린다(타일 위에 직접 얹으면 대비를 계산할 수 없다).
 *  마커 DOM 전체가 `aria-hidden` 이고 뜻은 범례 13행이 진다(§54.12). ⚠ `width:max-content` 를 빼지 마라 —
 *  앵커가 «0폭 컨테이닝 블록»이라 라벨이 min-content 로 접힌다. ⚠⚠ 폰트를 `rem` 으로 바꾸지 마라 — pill 은 «좌표에
 *  묶인 위치 요소»라 확대를 따르면 가리키는 대상을 덮는다(캔버스 «밖»은 전부 `rem` · §54.6-4 · 디자인 §0.8.2) */
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

/** 역 점 배지 — 지름 12px 채움 + 흰 링 3px + 흰 중심점(§54.16-11). 흰 링은 시청역 점이 대오 4 밴드 «안»에 들어갈 때
 *  «얹힌 층»으로 읽히게 하고, 흰 중심점(`◉`)은 «역 입구»를 말한다. ⚠ 좌표를 옮겨 겹침을 풀지 마라 — `verified` 가
 *  `estimated` 가 된다(M-19). ⚠ 종전의 «점 지름 12 → 10px» 처방은 죽었다(대체 처방 전부 기각) — 남는 가림은
 *  «초기 뷰 한 배율의 성질»이라 «확대»에 위임하며, 그래서 확대 버튼을 조건부로 숨기면 안 된다(§54.17-3) */
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

/** 화장실 배지 — 픽토그램만. 이름 pill 을 붙이지 않는다(§54.5-3 · 범례 3행이 남으므로 은폐가 아니다).
 *  테두리 `dashed` 는 «확신도»다 — 역 배지의 `solid` 와 갈리는 축은 «선종»이지 색이 아니다 */
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

/** 항목 1개 — 도형(흰 casing 2겹) + 점 배지 + 이름 pill. 타일 색은 예측할 수 없으므로 흰 굵은 스트로크를
 *  아래 깔아 배경을 가정하지 않고 대비를 만든다(§54.7 · casing 가시성은 9/4 타일에서 실측한다) */
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

  /* 점 배지 — `dots`(광화문역)는 «같은 기호를 두 번» 그린다(§54.16-10 · 범례 1행 · pill 1개 · 점 2개).
     ⚠ 두 점 사이에 선·도형을 긋지 마라 — «역이 도로를 가로지른다»가 된다 */
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

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 대체면 — 두 문장뿐이다. 세 번째 줄을 만들지 마라. ⚠⚠ 8/28 `RallyMapFallback` 3줄을 복제하면 «여의도»를
 *  안내한다(§53-12 #13). 9/4 는 범례 13행이 캔버스 «밖»에서 정적 데이터로 렌더돼 위치를 말할 필요가 없다 */
function StrikeMapFallback({ status }: { status: Exclude<MapStatus, "ready"> }) {
  return (
    <div className="rounded-card flex h-full flex-col items-center justify-center bg-surface px-5 py-6 text-center">
      <p className="break-keep break-words text-body font-semibold text-ink">
        {status === "failed" ? "지도를 불러오지 못했습니다." : "지도를 불러오는 중입니다."}
      </p>
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
  const [panoDate, setPanoDate] = useState("");
  const [panoStatus, setPanoStatus] = useState<StrikePanoStatus>("idle");
  const [spotAt, setSpotAt] = useState<{ lat: number; lng: number } | null>(null);
  const [spotPan, setSpotPan] = useState(0);
  const [spotFov, setSpotFov] = useState(SPOT_CONE_FALLBACK_FOV);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
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
     우리 CSS 가 아니라 위젯 소관이므로 마운트 노드에 걸면 «영영 울리지 않는다»(§54.14 #505 · `union-webapp-dev` §7) */
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

  /* 거리뷰 모드 — 길 레이어를 깔고 «클릭으로 위치를 정한다»(`StreetLayer` 는 타일 오버레이라 지도 클릭을 가로채지 않는다).
     ⚠ `maps.StreetLayer` 가 없어도 클릭 이동은 남아야 하니 레이어와 클릭 리스너를 한 조건으로 묶지 마라(QA-516).
     ⚠ `status` 를 의존성에서 빼지 마라(길이 안 깔린다) */
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

  /* 파노라마 인스턴스는 «시트가 열려 있는 동안만» 존재한다.
     ★ 문서에 없는 API 를 «하나도» 쓰지 않는다 — `fromOffsetToCoord`(바닥 탭 이동)와 `Marker({ map: panorama })`
     (파노라마 안 라벨)를 둘 다 안 가져온다(§54.16-6 (1) · `union-webapp-dev` §7). ★ 실패해도 시트를 닫지 마라 */
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
    /* `streetAt` 이 바뀌면 새로 만든다(«처음 열렸다»는 뜻) — 이미 열린 뒤의 이동은 위 클릭 리스너가 `setPosition` 으로 처리한다 */
  }, [streetAt]);

  /* 지도 위 «지금 보는 위치» 표식 — 점 + 시선 부채꼴. 모드가 꺼지면 함께 사라진다.
     ⚠ 색은 `#1a1a1a`(ink)다 — §54.7 이 «신규 색 0»을 못박았고 `#093389`·`#4b5563` 은 이미 뜻을 진 의미색이라
     여기 쓰면 «갈 곳»·«참고 지물»로 읽힌다. ⚠ `clickable: false` 를 바꾸지 마라 — 그 자리를 다시 못 누른다 */
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
            ⚠ 흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라 · `※` 를 붙이지 마라 */}
        <p className="mb-2 max-w-[var(--container-prose)] break-keep break-words text-caption font-semibold text-ink">
          {MAP_GESTURE_NOTE}
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

          {status !== "ready" ? <StrikeMapFallback status={status} /> : null}
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
          mountRef={panoMountRef}
          onClose={closeStreetView}
        />
      ) : null}
    </>
  );
}
