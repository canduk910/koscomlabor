"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DISTANCE_TEXT_SHORT,
  EXIT5,
  LABEL_PRIORITY_MIN_ZOOM,
  LEGEND_FOOTNOTE,
  LEGEND_KEY,
  LOW_ACCURACY_NOTE,
  LOW_ACCURACY_THRESHOLD_M,
  MAP_FEATURES,
  MAP_FIT_BOUNDS,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  circledNumber,
  featureLabelAnchor,
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
 * **이 지도는 보조다.** 같은 정보가 위 "코스콤지부 집결 위치" 블록에 항상 텍스트로 있고,
 * 여기 대체면도 **초기 DOM 에 존재**해 스크립트 차단·네트워크 실패에서도 그대로 보인다.
 * 지도가 성공했을 때만 더 풍부한 표현으로 교체된다 — 판단 순서가 반대면 §0.4 위반이다.
 *
 * **완전 비인터랙티브**(§20.0-7): 드래그·휠·핀치·더블탭·키보드 전부 off, 확대 버튼 없음.
 * 모바일에서 지도가 한 손가락 드래그를 먹으면 조합원이 페이지를 못 내린다 — 가장 흔한 사고다.
 * `logoControl`·`mapDataControl` 은 **끄지 마라**(네이버 이용약관상 출처·로고 표기 필수).
 * 위성·하이브리드 전환 UI 도 금지다 — 위성 타일 위에서는 도형 대비를 보장할 수 없다.
 *
 * **이 컴포넌트는 무엇을 그릴지 스스로 정하지 않는다.** `src/lib/rallyMap.ts` 의 `MAP_FEATURES`
 * 를 해석만 한다. 밴드 스타일은 **`confidence` 에서만** 파생된다 — `id === "column-1"` 같은
 * id 기반 분기를 넣지 마라(§20.20.2). 도면 실파일이 와서 확신도가 승격되면 데이터 한 글자만
 * 바뀌어도 채움 농도·테두리·라벨 접미어가 전부 따라와야 한다.
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
/** 라벨 최대 폭 = 지도 폭의 60%(§20.4.2). CSS 변수로 내려 리사이즈 시 마커 재생성 없이 갱신한다 */
const LABEL_MAX_WIDTH_RATIO = 0.6;
const LABEL_MAX_WIDTH_VAR = "--rally-label-max";

/** 지속 추적 금지(§20.14.1-4). `watchPosition` 을 쓰지 마라 — 배터리·프라이버시 비용이 크다 */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

/*
 * 초기 화면 여백(px). 스펙 §20.4.3 의 값은 좌우 24 였으나 **360px 실측에서 라벨이 잘렸다.**
 * 스펙이 정한 해결 수단(§20.4.2: "넘치면 fitBounds padding 을 키워 해결하고 라벨 문자열은
 * 줄이지 마라") 그대로 적용한다 — 문자열 변경 0.
 * top 은 ① 5번 출구 라벨(도트 위), bottom 은 ② 메인무대 라벨(원 아래)의 자리다.
 */
const FIT_PADDING = { top: 48, right: 24, bottom: 48, left: 56 } as const;

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
 *
 * `estimated` 에 테두리를 주지 않는 것이 "두 밴드 사이 경계선 금지"(검증 요구 26)의
 * **구조적 해결**이다 — 대오 1 쪽 변이 존재하지 않으므로 경계선이 원천적으로 생기지 않는다.
 * 동시에 "확실히 옅게"도 충족한다(0.20 → 0.08 은 육안으로 명확히 구분된다).
 * **`estimated` 를 회색으로 바꾸지 마라** — 회색은 참고 지물의 색이고 대오는 갈 곳 계열이다.
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
  estimated: {
    fillOpacity: 0.08,
    strokeOpacity: 0,
    strokeStyle: "solid",
    strokeWeight: 0,
    /*
     * **`" (범위는 근사)"` 를 되살리지 마라**(§22.0-2 · 검증 7회차 승인).
     * 접미어가 붙으면 ③ 라벨이 165.55px 이 되어 **메인무대 원의 x 범위와 겹치고**,
     * 그 때문에 ③ 의 `labelGap` 이 47px 에 묶여 ②↔③ 간격이 2px 로 떨어진다(§22.5 실측).
     * 접미어를 뺀 지금 ③ 은 82.39px 이라 원 오른쪽 3.8px 바깥에 서고, gap 41px 로 내려
     * 8.0px 를 확보한다. **확신도는 사라지지 않는다** — 테두리 없는 옅은 면(위 3개 값)과
     * 범례 ③ 행(`범위는 근사이며 실제와 다를 수 있습니다`)이 계속 말한다.
     */
    labelSuffix: "",
    casing: false,
    zIndex: 25,
  },
};

/** 겹칠 때 중요한 것이 위에 온다(§20.20.1): 랜드마크 → 예정 원 → 밴드 → 도트 → 내 위치 */
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
 * 라벨 pill HTML.
 *
 * - 텍스트는 **불투명 흰 pill 위**에만 올린다 — 타일 위에 직접 얹으면 대비를 계산할 수 없다.
 * - 라벨 텍스트 색은 전부 `#1a1a1a`(17.40)로 같다. **근사라고 글자를 흐리지 않는다**(§0.3).
 * - `word-break:keep-all` 필수. **라벨 문자열을 줄이지 마라** — 검증 조건이다(§20.4.2).
 * - 마커 DOM 전체에 `aria-hidden="true"` — 범례가 같은 내용을 문자로 제공하므로
 *   여기서 또 낭독되면 소음이다(§20.9).
 */
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
   * 팝업이 열려 있는 항목인가(§25.2 겹4). 열린 것에 **`--color-ink` 3px 링**을 상시 걸어
   * "어느 것을 눌렀는지"가 계속 보이게 한다.
   * **파랑·회색을 쓰지 마라** — 이 지도에서 그 둘은 확정도·성격 **의미색**이라(§20.20.3)
   * 상태에 쓰면 회색 참고 지물이 순간 "갈 곳"으로 읽힌다. `ink` 는 의미를 지지 않는 중립색이다.
   */
  selected: boolean;
}): string {
  /*
   * 앵커에서 라벨까지의 간격. 좌우 28px 은 실측으로 정해진 값이다 — 16px 이면 360px 에서
   * ① 5번 출구 라벨과 ④ 대오 2 라벨이 3px 겹쳤다. 4px 을 더 벌려 겹침을 0으로 만든다.
   */
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
  } = options;
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
     * 접힌 상태: 번호 원(28px)만. 타일 위 대비를 위해 흰 링 + 그림자를 준다(도트와 같은 방식).
     *
     * **배치는 pill 과 똑같이 `place` 를 쓴다 — 앵커 위에 얹지 마라.** 앵커에 겹쳐 놓았더니
     * ⑥ 배지가 **대오 2 밴드 외곽선 6.7% · 부지 외곽선 12% 를 덮었고**(360px 실측),
     * 자기 도트까지 가렸다. 라벨 배치는 "도형을 덮지 않는 방향"으로 이미 계산돼 있으므로
     * 접힌 배지도 **같은 방향·같은 간격**을 쓰는 것이 맞다. 접고 펼 때 배지가 튀지도 않는다.
     */
    /*
     * 히트 영역 **44×44px**(요구 D · §25.8). **시각 크기는 28px 그대로**이고 투명하게만 넓힌다.
     * 44 가 상한이다 — ④⑤ 히트 중심 간 dx 가 **49px** 이라 더 키우면 즉시 겹치고,
     * 그러면 조합원이 ⑤ 를 눌렀는데 ④ 가 열린다.
     * `data-rally-badge` 는 **보이는 28px 원**에 붙는다(측정 기준이 시각 크기여야 한다).
     */
    return [
      `<div aria-hidden="true" data-rally-label="${id}" data-rally-folded="1" style="position:relative;width:0;height:0;">`,
      `<span data-rally-hit="${id}" style="position:absolute;${place}width:28px;height:28px;cursor:pointer;">`,
      `<span style="position:absolute;left:-8px;top:-8px;width:44px;height:44px;"></span>`,
      `<span data-rally-badge="${id}" data-rally-number="${id}" style="position:absolute;inset:0;box-sizing:border-box;`,
      `border-radius:9999px;background:${badgeColor};border:2px solid #ffffff;color:#ffffff;`,
      `font-size:15px;font-weight:700;line-height:24px;text-align:center;${ring}`,
      `box-shadow:0 1px 3px rgb(0 0 0 / .35)${selected ? `,0 0 0 3px ${INK}` : ""};">${badge}</span>`,
      `</span></div>`,
    ].join("");
  }
  return [
    `<div aria-hidden="true" data-rally-label="${id}" style="position:relative;width:0;height:0;">`,
    /* pill 도 눌리면 팝업이 열린다(§25.2 겹2 · §25.3.1). 조합원이 가장 먼저 보는 것이 pill 이고,
       눌러 본 경험이 ①③⑤⑥ 배지로 **전이**된다. ②④ 만 안 눌리면 마커가 두 종류로 갈린다.
       **pill 히트는 실제 크기 그대로다** — 44px 로 늘리면 ⑤ 배지 히트와 5px 겹친다(§25.8.1). */
    `<div data-rally-pill="${id}" data-rally-hit="${id}" style="position:absolute;${place}box-sizing:border-box;display:flex;align-items:center;gap:6px;cursor:pointer;`,
    `background:#ffffff;${pillBorder}border-radius:9999px;padding:${pad};`,
    `box-shadow:0 1px 4px rgb(0 0 0 / .30)${selected ? `,0 0 0 3px ${INK}` : ""};font-size:15px;font-weight:600;color:${INK};`,
    /* width:max-content 가 없으면 안 된다 — 앵커가 0폭 컨테이닝 블록이라 절대배치 요소의
       shrink-to-fit 가용폭이 0 으로 계산되고, 라벨이 **min-content(글자 몇 개씩)로 접힌다.** */
    "line-height:1.3;white-space:normal;word-break:keep-all;width:max-content;",
    `max-width:var(${LABEL_MAX_WIDTH_VAR},60%);">`,
    badge === null
      ? ""
      : /* `data-rally-number` 는 **번호가 화면에 있는 것 전부**를 세는 표식이다(요구 86 검사용).
           `data-rally-badge` 는 **접힌 배지 전용**으로 남긴다 — §22·§23 실측 기준값이 그 셀렉터에 묶여 있다 */
        `<span data-rally-number="${id}" style="flex:0 0 24px;width:24px;height:24px;border-radius:9999px;background:${badgeColor};color:#ffffff;font-size:15px;font-weight:700;line-height:24px;text-align:center;">${badge}</span>`,
    "<span>",
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

/** 도트 마커 — 도트는 앵커 좌표에 중심을 맞춘다 */
function dotHtml(color: string, size: number): string {
  const half = size / 2;
  return [
    '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
    `<span style="position:absolute;left:-${half}px;top:-${half}px;width:${size}px;height:${size}px;`,
    `box-sizing:border-box;border-radius:9999px;background:${color};border:3px solid ${CASING};`,
    'box-shadow:0 1px 3px rgb(0 0 0 / .35);"></span></div>',
  ].join("");
}

/**
 * 도형 1개를 **흰 casing(아래층) + 본체(위층)** 2겹으로 만든다(§20.4.2).
 *
 * 타일 색은 예측할 수 없다. 흰 굵은 스트로크를 아래 깔면 타일이 밝든 어둡든 **두 경계 중
 * 한쪽은 반드시 대비를 만든다** — 배경을 가정하지 않고 대비를 보장하는 유일한 구조적 수단이다.
 * casing 은 fill 없이 스트로크만 그린다.
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
      /*
       * **bbox 사각형으로 그리지 마라**(검증 요구 31). 부지가 도로와 나란한 평행사변형이라
       * 축정렬 bbox 는 면적을 1.8배로 부풀리고 북동 모서리가 대오 밴드를 침범한다.
       * 실좌표 폴리곤으로 그려야 두 도형이 겹치지 않는다(최소 이격 21.8m).
       */
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
        /*
         * **채움 0** — 부지는 대오가 아니라 위치 기준 지물이다. 면을 채우면 대오 밴드와
         * 같은 위계로 읽혀 **"여기 모인다"로 오독된다**(검증 §5-13-6).
         * 선도 밴드(3px)보다 **가늘게**(2px) — 앵커는 배경이지 주역이 아니다.
         * 채움이 있는 도형은 대오 밴드뿐이며, 그 대비가 "조합원이 서는 곳"을 유일하게 칠한다.
         */
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
): string {
  const color = toneColor(feature.tone);
  const suffix = feature.kind === "band" ? BAND_STYLE[feature.confidence].labelSuffix : "";
  const shape =
    feature.kind === "dot" ? dotHtml(color, 18) : feature.kind === "pin" ? pinHtml() : "";
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
    zIndex: LABEL_Z_BASE + index,
  });
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
 * 대비: 보더·글자 11.37 / hover 면 10.45 / 비활성 보더 4.83(UI) · 글자 7.56 (§21.7 실측).
 * `px-5` 는 폭 검산(360px 2행)의 전제다 — 넓히면 3행이 된다.
 */
const CONTROL_CLASS =
  "ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full border-2 border-primary bg-bg px-5 text-body font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:border-border-strong disabled:text-ink-muted";

/** 등급 순위 — 겹쳤을 때 **낮은 쪽을 접는다**(§21.2.3) */
const PRIORITY_RANK: Record<LabelPriority, number> = { primary: 0, secondary: 1, tertiary: 2 };

/**
 * 겹침 판정 여백(px) — **0 이다. 즉 실제로 교차할 때만 접는다.**
 *
 * §21.2.3 은 "8px 미만이면 겹침으로 본다"고 썼지만, **현행 초기 화면(z16)의 라벨 사이 실측 간격이
 * 1px** 다(360px 실측: ② 바닥 y49 ↔ ③ 머리 y50, ④ 바닥 y359 ↔ ⑤ 머리 y360).
 * 8px 를 적용하면 **처음 보는 화면에서 ③⑤ 가 즉시 배지로 접혀 §21.8-107 을 위반**한다.
 * 라벨 배치는 §26·§27 에서 밴드·부지 가림 0% 를 맞추느라 픽셀 단위로 확정된 것이라
 * 여백을 벌리려면 그 결과를 다시 흔들어야 한다(리더 지시: **초기 뷰는 지금과 같아야 한다**).
 *
 * 0 으로 두어도 §21.8-108 은 성립한다 — z15 에서는 지물 간 화면 거리가 절반이 되어
 * ②③ · ④⑤ 가 **실제로 교차**하므로 낮은 등급이 접힌다(아래 실측 기록 참조).
 * **8px 예산을 되살리려면 라벨 배치부터 다시 설계해야 한다 — 임계값만 올리지 마라.**
 */
const LABEL_MIN_GAP = 0;

/**
 * **재노출** 임계(px) — 접힌 라벨이 다시 펴지려면 이만큼 떨어져야 한다(§21.9.3 히스테리시스).
 * 접기 0 / 펴기 8 로 벌려 두지 않으면 경계 줌에서 라벨이 깜빡인다.
 */
const LABEL_REVEAL_GAP = 8;

export function RallyMap({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<MapStatus>("loading");
  const [locStatus, setLocStatus] = useState<LocationStatus>("idle");
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);

  /*
   * `navigator.geolocation` 미지원이면 버튼을 렌더하지 않는다(죽은 버튼 금지 — §20.14.3).
   * 서버 스냅샷은 `false` 이므로 **하이드레이션 불일치가 없다.** effect + setState 로 하면
   * 렌더가 한 번 더 도는데(cascading render), 이 판정은 변하지 않는 외부 상태라 구독이 맞다.
   * 컨테이너에 최소 높이를 잡아 판정 전후의 레이아웃 시프트를 막는다.
   */
  const geoSupported = useSyncExternalStore(
    subscribeNever,
    () => "geolocation" in navigator,
    () => false,
  );

  /** 현재 zoom — 컨트롤 비활성 판정과 라벨 접힘에 쓴다(§21.1.3 · §21.2) */
  const [zoom, setZoom] = useState<number | null>(null);
  /** 초기 화면에서 벗어났는가 — `처음 위치로` 비활성 판정 */
  const [moved, setMoved] = useState(false);
  /**
   * 로드뷰 모달이 열려 있는가. **기본은 항상 닫힘이다**(§21.3.1 — "마지막 상태 기억"으로 바꾸지 마라).
   * 로드뷰는 §23.1 로 **전체 화면 모달**이 됐다 — 지도 박스를 덮지 않으므로 **지도는 페이지에 그대로 있다.**
   */
  const [roadviewOpen, setRoadviewOpen] = useState(false);
  const [panoStatus, setPanoStatus] = useState<"idle" | "loading" | "failed">("idle");
  /** 스크립트에 파노라마 모듈이 없으면 **버튼을 아예 렌더하지 않는다**(죽은 버튼 금지, §21.3.2) */
  const [panoSupported, setPanoSupported] = useState(false);
  /**
   * 열린 팝업(§25.4~§25.7). **기본은 전부 닫힘** — 자동 열림을 두지 마라(§25.2.2):
   * 초기 뷰가 바뀌고 지도 절반이 덮인 채 시작한다. 로드뷰의 "기본 상태는 항상 지도"와 같은 규칙이다.
   */
  const [selected, setSelected] = useState<{ id: string; index: number } | null>(null);
  /** 팝업을 박스 위·아래 중 어디에 붙일지(§25.5). **가로는 계산하지 않는다 — 박스에 고정이다** */
  const [popupSide, setPopupSide] = useState<"top" | "bottom">("bottom");

  const mountRef = useRef<HTMLDivElement | null>(null);
  const panoMountRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  /** 모달을 연 버튼 — 닫을 때 포커스를 여기로 되돌린다(§23.1.5) */
  const roadviewButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 모달을 열 때의 스크롤 위치. 닫으면 **±0px 로** 되돌린다 */
  const scrollLockRef = useRef(0);
  const mapRef = useRef<NaverMap | null>(null);
  const panoRef = useRef<NaverPanorama | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  const myOverlaysRef = useRef<NaverOverlay[]>([]);
  const labelsRef = useRef<LabelEntry[]>([]);
  /** 겹침 때문에 접혀 있는 라벨 — 히스테리시스 판정에 쓴다(§21.9.3) */
  const foldedRef = useRef<Set<string>>(new Set());
  /** 열린 팝업의 항목 — **한 번에 하나만**(§25.7). `null` 이면 전부 닫힘(기본 상태) */
  const selectedRef = useRef<string | null>(null);
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
    if (map.getZoom() > MAP_MAX_ZOOM) map.setZoom(MAP_MAX_ZOOM, false);
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
     * 조작 계약(§21.1.1). **한 손가락은 언제나 페이지 스크롤이다 — 예외 없음.**
     * 초판이 막은 사고("스크롤하다 손가락이 지도에 닿으면 페이지가 멈춘다")는 §20.23 으로
     * 모바일 지도가 410px 이 되면서 **오히려 위험이 커졌다.** 조작은 두 손가락과 지도 밖 버튼으로만 연다.
     *
     * - `draggable` 은 **마우스가 있을 때만**(`pointer: fine`) — 터치에서 켜면 한 손가락 팬이 열린다
     * - `scrollWheel: false` + 직접 리스너에서 **Ctrl/⌘ + 휠만** 확대·축소(맨 휠은 페이지 스크롤)
     * - `disableDoubleTapZoom` — 스크롤 중 오탭이 확대를 일으키면 조합원이 길을 잃는다
     * - `keyboardShortcuts: false` — 조작은 지도 **밖** 버튼이 담당한다(§21.1.3)
     */
    const finePointer =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;

    const map = new maps.Map(node, {
      mapTypeId: maps.MapTypeId.NORMAL,
      draggable: finePointer,
      pinchZoom: true,
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

    /*
     * 네이버가 마운트 노드에 `tabindex="0"` 을 붙인다. 이 지도는 **조작 컨트롤이 0개**라
     * 포커스가 들어와도 할 일이 없는 **빈 탭 정지점**이 된다. 접근성 이름도 없어 제거가 맞다.
     * 지도 안에 남는 정지점은 네이버 로고·저작권 링크뿐이며, 그 포커스 표시는 덮어쓰지 않는다.
     */
    node.removeAttribute("tabindex");

    /*
     * 그리기는 `MAP_FEATURES` 순회 1개로 끝난다 — 항목을 넣고 빼는 것이 곧 지도 수정이다.
     * 번호 배지는 **배열 순서(지리 순서)** 에서 자동 부여된다(§20.20.1).
     */
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
   * 줌에 따라 라벨 텍스트를 접는다(§21.2).
   *
   * 1) **등급 임계**: `secondary` 는 z≥16, `tertiary` 는 z≥17 에서만 텍스트 pill 을 낸다.
   * 2) **겹침 회피**: 그러고도 pill 이 겹치면(여백 8px 미만) **낮은 등급 쪽을 배지로 접는다.**
   *    판정은 **렌더 후 화면 좌표 사각형 교차**로 한다 — 지리 좌표로 추정하지 마라(§20.23.5).
   * 3) `primary` 끼리 겹치면 **접지 않는다.** 둘 다 접히면 이 지도가 아무 말도 하지 않게 된다.
   *
   * 접혀도 **번호 배지는 남고 범례가 번호를 설명**한다 — §0.4 은폐가 아니다.
   */
  const applyLabelVisibility = useCallback((currentZoom: number) => {
    const entries = labelsRef.current;
    if (entries.length === 0) return;

    /*
     * 텍스트 pill 노출 = **`textMode === "always"` 인 항목만**(§25.1).
     * `popup` 항목은 **줌이 올라가도 텍스트를 띄우지 않는다** — 이름은 클릭 팝업이 진다
     * (⑤⑥ 가 z17 에서 펼쳐지던 동작은 폐기됐다, §25.11).
     * `always` 항목 안에서는 종전 등급 임계가 그대로 적용된다(② 는 z15 에서 배지가 된다).
     */
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
            selectedRef.current === e.feature.id,
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
    };
    paint();

    // 그린 뒤 실제 사각형으로 겹침을 판정하고, 낮은 등급을 접는다
    const node = mountRef.current;
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
        /*
         * **히스테리시스**(§21.9.3): 접는 기준과 펴는 기준이 다르다.
         * - 지금 펼쳐져 있는 라벨 → **실제로 교차할 때만** 접는다(여백 0)
         * - 이미 접혀 있던 라벨 → **8px 이상 떨어져야** 다시 편다
         * 한 값으로 양방향을 판정하면 경계에서 접힘/펴짐이 번갈아 일어나 **라벨이 깜빡인다.**
         * 줌을 천천히 조작할 때 이 차이가 눈에 보인다 — 임계값을 하나로 합치지 마라.
         */
        const margin = foldedRef.current.has(cand.id) ? LABEL_REVEAL_GAP : LABEL_MIN_GAP;
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
      foldedRef.current = foldedNow;
      if (changed) paint();
    });
  }, []);

  /**
   * 팝업 열기/닫기(§25.7). **한 번에 하나만** 열린다 — 그것이 "라벨 6개가 동시에 있던 포화"를
   * 구조적으로 없앤 지점이다. 같은 항목을 다시 누르면 닫힌다(토글).
   *
   * 선택 상태는 `selectedRef` 에도 둔다: 아이콘을 다시 그리는 `applyLabelVisibility` 는
   * `useCallback([])` 이라 **state 를 클로저로 읽으면 옛 값을 본다.**
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

  /*
   * `Esc` 로 닫는다. **`document` 레벨**이라 팝업에 포커스가 없어도 동작한다 —
   * 팝업은 `aria-hidden` 이고 포커스 가능 요소를 두지 않기 때문이다(§25.9).
   */
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectFeature(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectFeature, selected]);

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

  /* 로드뷰가 열리면 팝업을 닫는다(§25.7) */
  useEffect(() => {
    if (roadviewOpen) selectFeature(null);
  }, [roadviewOpen, selectFeature]);

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
    const listeners: NaverMapEventListener[] = [
      map.addListener("zoom_changed", onZoom),
      map.addListener("dragend", onDrag),
    ];
    applyLabelVisibility(map.getZoom());
    return () => {
      for (const l of listeners) maps.Event.removeListener(l);
    };
  }, [applyLabelVisibility, status]);

  /*
   * 조작 계약의 나머지 절반 — **브라우저 기본 동작 쪽**(§21.1.1).
   * `touch-action: pan-y` 는 마크업에 있고, 여기서는 **Ctrl/⌘ + 휠 → 확대·축소**만 붙인다
   * (그때만 `preventDefault`). **맨 휠과 한 손가락은 건드리지 않는다 — 페이지 스크롤이 우선이다.**
   *
   * ⚠ **두 손가락 팬(`panBy`)은 제거했다. 다시 넣지 마라 — 실측 근거가 있다.**
   * QA 19회차 실측: 두 손가락 **간격을 100px 로 고정한 채 평행이동**시켰는데도 축척이
   * 100m → **300m(줌 2단)** 로 떨어졌다. 네이버 지도의 `pinchZoom` 과 우리 `panBy` 가
   * **같은 2-touch 제스처를 나눠 갖지 못한다** — 브라우저가 주는 두 손가락 이동을
   * 지도는 핀치로도 읽고 우리는 팬으로도 읽어, 이동하려던 조작이 축소로 끝난다.
   * **이동하려다 축척이 바뀌는 것은 조작이 아니라 사고다** — 조합원이 대오를 보려고 옮기는 순간
   * 지도가 3배 축소되면 얻는 것보다 잃는 것이 크다. §21.1.1 이 예견해 둔 fallback 이며,
   * **핀치(확대·축소) + `처음 위치로`(복귀)** 만으로 "정적이라 답답하다"는 원래 요구는 충족된다.
   * 되살리려면 **핀치와 팬 제스처가 실제로 분리되는지부터 실기기에서 실측**하라.
   * **한 손가락 팬을 여는 것으로 대체하지 마라 — 그것이 원래 막으려던 사고다.**
   */
  useEffect(() => {
    const node = mountRef.current;
    if (node === null || status !== "ready") return;

    const onWheel = (e: WheelEvent) => {
      const map = mapRef.current;
      if (map === null) return;
      // **맨 휠은 페이지 스크롤이다.** Ctrl/⌘ 를 누른 경우에만 지도가 반응한다
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

  /*
   * 파노라마 서브모듈은 **본 스크립트 `onLoad` 이후에 도착**한다(실측: `onLoad` 시점 `undefined`,
   * 1.5초 뒤 `function`). 한 번만 확인하면 `로드뷰 보기` 버튼이 영영 렌더되지 않는다.
   * 그래서 도착할 때까지 짧게 재확인하고, 시한을 넘기면 **미지원으로 확정**한다(죽은 버튼 금지).
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
    check();
    return () => window.clearTimeout(timer);
  }, [status]);

  /**
   * 로드뷰 모달 열기/닫기 (§23.1.5).
   *
   * **`showModal()` 로만 연다** — 그래야 브라우저가 **포커스 트랩 · `Esc` · 배경 `inert` · top-layer** 를
   * 전부 제공한다. 직접 구현하지 마라(표준 동작이 우리 구현보다 안전하다).
   * `::backdrop` 탭으로는 닫지 않는다 — **회전 중 오탭으로 닫히면 안 된다**(핸들러를 붙이지 않는 것이 곧 구현이다).
   *
   * 배경 스크롤은 **`showModal()` 과 별도로** 잠근다: 브라우저마다 처리가 달라 가정할 수 없다.
   * `position:fixed; top:-scrollY` 로 고정하고 닫을 때 정확히 되돌린다 — **닫으면 `scrollY` 가 ±0px** 이어야 한다.
   */
  const openRoadview = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    scrollLockRef.current = window.scrollY;
    setRoadviewOpen(true);
    dialog.showModal();
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollLockRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
  }, []);

  const closeRoadview = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && dialog.open) dialog.close();
  }, []);

  /* `Esc`·`닫기` 어느 쪽으로 닫혔든 **한 곳에서** 뒷정리한다 — 경로가 갈리면 하나가 빠진다 */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const onClose = () => {
      const body = document.body;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.overflow = "";
      setRoadviewOpen(false);
      /*
       * **`preventScroll: true` 를 빼지 마라.** 기본 `focus()` 는 대상을 보이게 하려고 스크롤을
       * 다시 움직여서, 복원한 위치가 그 자리에서 어긋난다(실측 818px 이탈).
       * 포커스를 먼저 되돌리고 **그다음에** 위치를 복원한다 — 순서가 바뀌면 같은 증상이 난다.
       */
      roadviewButtonRef.current?.focus({ preventScroll: true });
      /*
       * 위치 복원은 **두 가지를 동시에 처리해야** ±0px 가 된다(둘 중 하나만 빠져도 어긋난다):
       * ① **레이아웃 강제 반영** — `position:fixed` 를 막 푼 시점에는 문서 높이가 아직
       *    뷰포트 높이(800)로 잡혀 있어 `scrollTo` 가 **0 으로 잘린다**(실측).
       * ② **`behavior: "instant"`** — 이 사이트는 `html { scroll-behavior: smooth }` 라
       *    기본값으로 부르면 **애니메이션 도중 브라우저 자체 복원과 경합**해 엉뚱한 곳에 선다
       *    (실측: 목표 3355 → 3247).
       */
      void document.body.offsetHeight;
      window.scrollTo({ top: scrollLockRef.current, left: 0, behavior: "instant" });
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  /*
   * 파노라마 인스턴스는 **모달이 열려 있는 동안만** 존재한다(§21.3.1 자동 로드 금지 유지).
   * 실패하면 **모달을 닫고** 지도 옆 상태 문구를 낸다 — **빈 검은 화면에 조합원을 두지 마라**(§23.1.5).
   * 마운트 노드의 `touch-action` 을 건드리지 않는다: **모달 안에서는 한 손가락 회전이 정상 동작**이고
   * (§23.1.3), 뺏을 페이지 스크롤이 없으므로 §21.1.0 원칙과 충돌하지 않는다.
   */
  useEffect(() => {
    if (!roadviewOpen) return;
    const maps = window.naver?.maps;
    const node = panoMountRef.current;
    const Panorama = maps?.Panorama;
    if (maps === undefined || node === null || Panorama === undefined) {
      setPanoStatus("failed");
      closeRoadview();
      return;
    }

    setPanoStatus("loading");
    const pano = new Panorama(node, {
      position: new maps.LatLng(EXIT5.lat, EXIT5.lng),
      // 5번 출구에서 **의사당대로 남동쪽**(대오 방향)을 먼저 보여준다
      pov: { pan: 130, tilt: 0, fov: 100 },
      logoControl: true,
      zoomControl: false,
      aroundControl: false,
      minScale: 0,
      maxScale: 4,
    });
    panoRef.current = pano;

    const fail = () => {
      setPanoStatus("failed");
      closeRoadview();
    };
    const listeners: NaverMapEventListener[] = [
      pano.addListener("init", () => setPanoStatus("idle")),
      pano.addListener("pano_status", (payload?: unknown) => {
        const ok = maps.PanoramaStatus === undefined || payload === maps.PanoramaStatus.OK;
        if (!ok) fail();
      }),
    ];
    /* 파노라마가 없는 지점은 이벤트를 하나도 주지 않는 경우가 있어 시한을 함께 건다 */
    const timer = window.setTimeout(() => {
      if (pano.getPanoId() === null) fail();
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      for (const l of listeners) maps.Event.removeListener(l);
      pano.destroy();
      panoRef.current = null;
    };
  }, [closeRoadview, roadviewOpen]);

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

  /*
   * 스크립트가 이미 로드된 상태로 마운트되는 경우(뒤로가기 등) onLoad 가 오지 않으므로
   * 여기서 직접 만든다. **정리(destroy)를 같은 effect 에 두는 것이 중요하다** —
   * 분리하면 StrictMode 의 재마운트에서 파괴만 되고 재생성되지 않아 빈 박스가 남는다.
   */
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
   *
   * **버튼을 눌렀을 때만 권한을 요청한다**(§20.14.1-1). 맥락 없이 뜨는 권한 팝업은 대부분
   * 거부되고, **한 번 거부되면 브라우저 설정에 들어가야 되돌릴 수 있다.**
   * 위치는 **브라우저 메모리에서만** 쓴다 — 서버 전송·localStorage·쿠키·URL 기록 전부 없다(§20.14.6).
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
          /*
           * **`fitBounds` 를 다시 호출하지 마라**(§20.14.1-2). 집에서 누르면 지도가
           * 서울 전체로 축소돼 집결지 정보가 통째로 무의미해진다.
           * 범위 밖이면 도형을 아예 만들지 않고 방향·거리 텍스트로만 답한다.
           */
          inBounds = map.getBounds().hasLatLng(pos);
          if (inBounds) {
            /*
             * **정확도 원을 그리지 않는다**(§20.21.1). 같은 점선 원이 ② 메인무대(우리의 무지)와
             * 측정 오차(기기 보고)라는 **근거가 다른 두 뜻**을 갖게 되기 때문이다.
             * 정밀도 주장은 상태 문구의 `약 ±{n}m` 하나가 전담한다.
             * 지도 위 원은 ② 하나뿐이어야 한다 — 이것이 QA 검사 항목이다(§20.21.6-87).
             */
            myOverlaysRef.current = [
              createLabelMarker(maps, map, myLocationFeature({ lat, lng }), MAP_FEATURES.length, true),
            ];
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

  /*
   * 저정확도 추가줄(§20.21.1). 임계값 40m 은 **대오 밴드 폭**에서 나온 값이다 —
   * 오차가 밴드 폭을 넘으면 "내가 밴드 안인가"를 판단할 수 없다.
   * **적색·경고 아이콘 금지** — 오류가 아니라 조건 안내다.
   */
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
          고정 종횡비 박스 — 실패·미로드에서도 크기가 변하지 않아 CLS 0 (§20.3.4).

          모바일이 **`4/5` 세로형**인 이유(§20.23): 이 지도의 지물은 의사당대로를 따라
          **북서–남동 대각선**이라 도형 묶음이 세로로 길다(194×246px). 가로로 긴 4:3 박스(328×246)를
          씌우면 zoom 16 이 요구하는 세로 246px 가 **패딩 0 으로도 안 들어가** zoom 15 로 떨어지고,
          축척이 300m 가 되어 **대오 밴드가 30~40px 로 뭉개진다.**
          `FIT_PADDING` 을 줄이는 것으로는 해결되지 않는다(QA 런타임 실측으로 기각) —
          **박스를 콘텐츠의 축에 맞추는 것이 유일한 구조적 해법이다.**
          `md:aspect-[16/9]` 는 불변이며, 이 변경으로 모바일과 md 가 **같은 100m 축척**을 쓴다.
        */}
        <div className="rounded-card relative aspect-[4/5] w-full overflow-hidden md:aspect-[16/9]">
          {/* 마운트 노드에 aria-hidden 을 걸지 마라 — 네이버 로고·저작권 컨트롤에 링크가 들어가고,
              숨겨진 영역 안의 포커스 가능 요소는 WCAG 2.4.3·4.1.2 위반이 된다(§20.9).

              `touchAction: "pan-y"` 가 **한 손가락 = 페이지 스크롤 계약의 본체**다(§21.1.1).
              이것을 지우면 지도가 세로 스와이프를 먹어 조합원이 페이지를 못 내린다 —
              초판이 비인터랙티브를 택하면서까지 막았던 바로 그 사고다. **지우지 마라.**

              로드뷰는 이제 이 박스를 **덮지 않는다**(§23.1). 전체 화면 모달로 열리므로
              **지도는 페이지에서 사라지지 않는다** — §21.3.1 이 스스로 인정했던 탭 패턴과의
              유사성(§0.4 위험)이 여기서 완전히 사라진다. `inert` 는 `<dialog showModal()>` 이
              배경 전체에 자동으로 걸어 주므로 직접 걸지 않는다. */}
          <div ref={mountRef} className="size-full" style={{ touchAction: "pan-y" }} />

          {/*
            팝업 — **박스 안 고정 패널**이다(§25.4). 말풍선이 아니다.

            네이버 `InfoWindow` 와 자체 말풍선을 둘 다 버린 이유: 둘 다 **위치를 계산으로 푼다.**
            그러면 박스 경계 클램프를 우리가 구현해야 하고, **3단계 자유 드래그에서 팝업이 마커를 따라
            박스 밖으로 나간다.** 여기서는 **가로가 박스에 고정**이라 좌우 잘림이 계산이 아니라 **구조로 0**이고,
            지도가 어떻게 움직여도 팝업이 흔들리지 않는다. 세로만 마커 반대편으로 붙인다.

            **전체 화면 모달로 만들지 마라**(요구 90) — 지도와 범례가 **동시에** 보여야
            지점↔설명 대응이 성립한다. 팝업은 박스 밖(범례)을 전혀 가리지 않는다.

            `aria-hidden`: 본문이 **범례와 같은 문자열**이라 노출하면 스크린리더가 같은 내용을 두 번 읽는다.
            텍스트 등가는 범례가 100% 진다 — **범례를 줄이면 이 판단이 즉시 무너진다**(§25.9.1).
            그래서 `닫기` 도 `tabindex={-1}` 이다: **`aria-hidden` 안에 포커스 가능 요소를 만들지 마라**(WCAG 2.4.3·4.1.2).
          */}
          {selectedFeature !== null ? (
            <div
              aria-hidden="true"
              className={`rounded-card shadow-card absolute inset-x-4 z-20 mx-auto max-w-[480px] border-2 border-border-strong bg-bg p-3.5 ${
                popupSide === "top" ? "top-4" : "bottom-4"
              }`}
            >
              <p className="flex items-start gap-2 text-[17px] font-bold text-ink">
                {/* 팝업↔지도 대응의 절반을 이 배지가 진다 — 빼지 마라(§25.6.2) */}
                <span
                  className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-bg"
                  style={{ background: toneColor(selectedFeature.tone) }}
                >
                  {circledNumber(selectedIndex)}
                </span>
                <span className="break-keep break-words">{selectedFeature.label}</span>
              </p>
              {/* 본문은 **범례에서 파생**한다. 별도 문자열 상수를 만들지 마라 —
                  따로 두면 언젠가 한쪽만 고쳐진다(요구 88) */}
              <p className="mt-2 break-keep break-words text-caption leading-[1.6] text-ink">
                {selectedFeature.legend}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => selectFeature(null)}
                  className={CONTROL_CLASS}
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}

          {status !== "ready" ? (
            <div className="absolute inset-0">
              <RallyMapFallback status={status} />
            </div>
          ) : null}
        </div>

        {/* 범례는 지도 바로 아래 붙는다. 접거나 sr-only 로 돌리지 마라(§0.4).
            기호 글리프는 aria-hidden — 스크린리더에는 번호·확신도가 **문자**로 전달된다.
            행은 `MAP_FEATURES` 에서 파생된다 — 배열에서 빠진 항목의 행은 자동으로 사라진다 */}
        <figcaption className="mt-4">
          {/*
            어포던스 문구(요구 87 · §25.2 겹1). **이번 설계의 실질 위험은 여기 하나다** —
            누를 수 있다는 걸 모르면 ①③⑤⑥ 의 이름은 **사라진 것과 같다.**
            `ink-muted` 로 흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라.

            ⚠ **이 문장은 사실 주장이다.** `번호를 누르면` 이라고 썼으므로 **번호(배지·pill)는 반드시 눌려야 하고**,
            도형(원·밴드·부지)을 눌리게 만들면 **이 문안이 거짓이 된다**(§25.2.1).
            문구보다 넓게 눌리는 것은 허용, 좁은 것은 금지다.
          */}
          <p className="break-keep text-caption font-semibold text-ink">
            ※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.
          </p>
          <p className="mt-1 break-keep text-caption text-ink">{LEGEND_KEY}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {MAP_FEATURES.map((feature, index) => (
              /* 범례 ⑤ `여의도더샵아일랜드파크` 는 공백이 없어 확대 200% 에서 327px 로 296px 를 넘친다.
                 `break-keep`(어절 유지)은 그대로 두고 `break-words` 만 더한다 — 한 낱말이 줄 폭보다
                 길 때에만 쪼개진다. **`break-keep` 을 빼지 마라**: 한글이 음절 단위로 끊겨 판독성이 무너진다 */
              <li key={feature.id} className="flex gap-2 break-keep break-words text-caption text-ink">
                <span aria-hidden="true">{feature.glyph}</span>
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
          <p className="mt-3 max-w-[var(--container-prose)] break-keep text-caption text-ink-muted">
            {LEGEND_FOOTNOTE}
          </p>
        </figcaption>
      </figure>

      {/*
        컨트롤 행(§21.1.3) — **전부 지도 박스 밖**이다. 지도 안 포커스 정지점은 네이버 로고·저작권뿐이라는
        §20.9 설계가 인터랙티브 전환 이후에도 그대로 유지된다.
        지도가 실패한 상태에서는 조작할 지도가 없으므로 행 전체를 렌더하지 않는다(죽은 버튼 금지).
        컨테이너 최소 높이를 미리 잡아 미지원 판정에 따른 레이아웃 시프트를 막는다.
      */}
      <div className="mt-3 min-h-touch">
        {status === "ready" ? (
          <>
            {/* 컨트롤 행은 **상태와 무관하게 항상 같은 5개**다(§23.0-4).
                로드뷰가 모달로 나가면서 `지도로 돌아가기` 가 모달 안 `닫기` 로 이동했고,
                버튼이 상황에 따라 바뀌지 않으므로 §21.1.3 의 폭 검산(2행)이 그대로 유효하다. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => zoomBy(-1)}
                disabled={zoom !== null && zoom <= MAP_MIN_ZOOM}
                className={CONTROL_CLASS}
              >
                축소
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1)}
                disabled={zoom !== null && zoom >= MAP_MAX_ZOOM}
                className={CONTROL_CLASS}
              >
                확대
              </button>
              {/* 핀치로 화면이 틀어졌을 때의 **유일한 복귀 경로**다(§23 — 두 손가락 팬 제거 후에도 유지).
                  지우지 마라. */}
              <button type="button" onClick={resetView} disabled={!moved} className={CONTROL_CLASS}>
                처음 위치로
              </button>
              {geoSupported ? (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locStatus === "requesting"}
                  className={CONTROL_CLASS}
                >
                  {locStatus === "shown" ? "다시 확인" : "내 위치 표시"}
                </button>
              ) : null}
              {panoSupported ? (
                <button
                  type="button"
                  ref={roadviewButtonRef}
                  onClick={openRoadview}
                  className={CONTROL_CLASS}
                >
                  로드뷰 보기
                </button>
              ) : null}
            </div>

            {panoSupported ? (
              <p className="mt-2 break-keep text-caption text-ink-muted">
                국회의사당역 5번 출구 주변을 볼 수 있습니다.
              </p>
            ) : null}

            {/* idle 에도 DOM 에 존재해야 한다 — 나중에 생긴 노드의 내용을 못 읽는 SR 이 있다.
                `assertive` 를 쓰지 마라(읽던 것을 끊는다). 거부를 role="alert"·적색으로
                표시하지 마라 — 정당한 선택을 오류처럼 보이게 하는 것은 압박이다(§20.14.3).
                로드뷰와 내 위치가 **같은 상태 영역을 공유**한다(§21.1.3) — 영역이 늘어나면
                스크린리더 사용자가 어디서 답이 오는지 매번 다시 찾아야 한다.
                **지도 확대·축소·이동은 문구를 만들지 않는다** — 매 조작마다 낭독하면 소음이다. */}
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
              이 문단은 기능 설명이 아니라 **사고 예방 문구**다(§20.14.2).
              브라우저 위치 권한은 **사이트(origin)별로 따로** 부여되므로, 여기서 허용해도
              출석 사이트는 다시 물어본다. 이 문장이 없으면 조합원이 "여기서 켰으니 됐다"고
              믿고 **현장에서 출석에 실패한다.** 지우지 마라.
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

      {/*
        로드뷰 — **전체 화면 모달**(§23.1). 지도 박스를 덮지 않는다.

        왜 모달인가: 페이지 안 박스에 파노라마가 있으면 **"한 손가락 = 페이지 스크롤"** 과
        **파노라마 회전**이 같은 제스처를 두고 싸운다. 네이버 뷰어는 중첩 div 3겹이 전부
        `touch-action: auto` 이고 한 손가락 드래그를 스스로 `preventDefault` 한다 —
        `pan-y !important` 로 이기려 들면 **로드뷰를 회전할 수 없어 기능이 목적을 잃고**,
        네이버가 내부 DOM 을 바꾸면 조용히 깨진다. **불안정한 것 위에 최우선 원칙을 세우지 않는다.**
        모달에는 **뺏을 페이지 스크롤이 없으므로 충돌 자체가 존재하지 않는다** —
        절충이 아니라 소멸이다. 모달 안에서 한 손가락이 파노라마를 돌리는 것은 **정상 동작**이다.

        `showModal()` 로만 연다(→ 포커스 트랩·`Esc`·배경 `inert`·top-layer 표준 제공).
        `::backdrop` 클릭 핸들러를 **붙이지 않는 것이 곧 구현**이다 — 회전 중 오탭으로 닫히면 안 된다.
        높이는 **`100dvh`** 다. `100vh` 를 쓰지 마라 — 모바일 URL 바 때문에 파노라마 아래가 잘린다.
      */}
      <dialog
        ref={dialogRef}
        aria-label="국회의사당역 5번 출구 로드뷰"
        className="m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-black p-0 backdrop:bg-black/80"
      >
        {/* 로드뷰는 스크린리더에 완전히 무의미하다 — 텍스트 등가를 만들 수 없다(§21.3.2).
            **로드뷰에만 있는 정보를 만들지 마라** — 모달이 커졌다고 안내 문구를 옮기지 않는다 */}
        <p className="sr-only">
          로드뷰는 시각 자료입니다. 위치 안내는 페이지 본문 텍스트를 참고해 주세요.
        </p>

        {/*
          `닫기` 는 **이 화면의 유일한 출구**다 — 자동 숨김 금지, 상시 노출.
          상단 우측인 이유: 하단은 **회전 드래그 구역**이라 오탭이 난다.
          사진 위에 반투명 버튼을 얹지 마라 — 배경이 매 프레임 바뀌어 대비를 보장할 수 없다.
          불투명 아웃라인 필(§20.14.3, 11.37)을 그대로 쓴다.
        */}
        <button
          type="button"
          autoFocus
          onClick={closeRoadview}
          className={`${CONTROL_CLASS} absolute z-10`}
          style={{
            top: "max(12px, env(safe-area-inset-top))",
            right: "max(12px, env(safe-area-inset-right))",
          }}
        >
          닫기
        </button>

        {/* `touch-action` 을 건드리지 않는다 — 여기서는 한 손가락 회전이 설계된 동작이다(§23.1.3) */}
        {roadviewOpen ? <div ref={panoMountRef} className="size-full" /> : null}

        {panoStatus === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center bg-surface text-body font-semibold text-ink">
            로드뷰를 불러오는 중입니다.
          </p>
        ) : null}
      </dialog>
    </>
  );
}

/**
 * 대체면 — **초기 DOM 에 존재**한다. 지도가 성공했을 때만 사라진다(§20.4.5).
 * 스켈레톤·페이드인 등장 애니메이션 금지(§0.4 지연 노출).
 *
 * 로딩 상태에도 요약 3줄을 함께 낸다: **JS 가 차단되면 상태가 영원히 `loading` 에 머문다.**
 * 그때 요약이 없으면 §0.4 위반이 된다.
 */
function RallyMapFallback({ status }: { status: Exclude<MapStatus, "ready"> }) {
  return (
    <div className="rounded-card flex h-full flex-col items-center justify-center bg-surface px-5 py-6 text-center">
      <p className="text-body font-semibold text-ink">
        {status === "failed" ? "지도를 불러오지 못했습니다." : "지도를 불러오는 중입니다."}
      </p>
      <p className="mt-3 break-keep text-body text-ink">집결 장소 — 국회의사당역 5번 출구</p>
      {/* 대체면은 지도를 못 보는 사람이 읽는 **산문**이라 여기서도 대오 식별자를 뺀다(§21.6.2) */}
      <p className="mt-1 break-keep text-body text-ink">
        코스콤지부 — 더샵아일랜드파크 앞 의사당대로
      </p>
      <p className="mt-1 text-caption text-ink-muted">{DISTANCE_TEXT_SHORT}</p>
    </div>
  );
}
