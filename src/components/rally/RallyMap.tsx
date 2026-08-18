"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DISTANCE_TEXT_SHORT,
  EXIT5,
  LEGEND_FOOTNOTE,
  LEGEND_KEY,
  LOW_ACCURACY_NOTE,
  LOW_ACCURACY_THRESHOLD_M,
  MAP_FEATURES,
  MAP_FIT_BOUNDS,
  circledNumber,
  featureLabelAnchor,
  myLocationFeature,
} from "@/lib/rallyMap";
import type { GeoConfidence, LabelPlacement, MapFeature, MapTone } from "@/lib/rallyMap";
import { bearingLabel8, formatDistanceKo, haversineMeters } from "@/lib/geo";
import type {
  NaverLatLngBounds,
  NaverMap,
  NaverMapsNamespace,
  NaverOverlay,
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
/** 과확대 방지 상한 — 328px 와 896px 에 같은 zoom 을 고정하면 한쪽이 반드시 망가진다(§20.4.3) */
const MAX_ZOOM = 17;
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

/** 앵커–라벨 기본 간격(px). 항목이 `labelGap` 을 주면 그것이 이긴다 */
const LABEL_GAP_VERTICAL = 14;
const LABEL_GAP_HORIZONTAL = 28;

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
    labelSuffix: " (범위는 근사)",
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
}): string {
  /*
   * 앵커에서 라벨까지의 간격. 좌우 28px 은 실측으로 정해진 값이다 — 16px 이면 360px 에서
   * ① 5번 출구 라벨과 ④ 대오 2 라벨이 3px 겹쳤다. 4px 을 더 벌려 겹침을 0으로 만든다.
   */
  const { badge, text, placement, gap, badgeColor, outline, outlineColor } = options;
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
  return [
    '<div aria-hidden="true" style="position:relative;width:0;height:0;">',
    `<div style="position:absolute;${place}box-sizing:border-box;display:flex;align-items:center;gap:6px;`,
    `background:#ffffff;${pillBorder}border-radius:9999px;padding:${pad};`,
    `box-shadow:0 1px 4px rgb(0 0 0 / .30);font-size:15px;font-weight:600;color:${INK};`,
    /* width:max-content 가 없으면 안 된다 — 앵커가 0폭 컨테이닝 블록이라 절대배치 요소의
       shrink-to-fit 가용폭이 0 으로 계산되고, 라벨이 **min-content(글자 몇 개씩)로 접힌다.** */
    "line-height:1.3;white-space:normal;word-break:keep-all;width:max-content;",
    `max-width:var(${LABEL_MAX_WIDTH_VAR},60%);">`,
    badge === null
      ? ""
      : `<span style="flex:0 0 24px;width:24px;height:24px;border-radius:9999px;background:${badgeColor};color:#ffffff;font-size:15px;font-weight:700;line-height:24px;text-align:center;">${badge}</span>`,
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
function createLabelMarker(
  maps: NaverMapsNamespace,
  map: NaverMap,
  feature: MapFeature,
  index: number,
): NaverOverlay {
  const color = toneColor(feature.tone);
  const suffix = feature.kind === "band" ? BAND_STYLE[feature.confidence].labelSuffix : "";
  const anchor = featureLabelAnchor(feature);
  const shape =
    feature.kind === "dot" ? dotHtml(color, 18) : feature.kind === "pin" ? pinHtml() : "";
  const content =
    shape +
    labelHtml({
      badge: feature.numbered === false ? null : circledNumber(index),
      text: `${feature.label}${suffix}`,
      placement: feature.placement,
      gap:
        feature.labelGap ??
        (feature.placement === "top" || feature.placement === "bottom"
          ? LABEL_GAP_VERTICAL
          : LABEL_GAP_HORIZONTAL),
      badgeColor: color,
      outline: feature.outline,
      outlineColor: color,
    });
  return new maps.Marker({
    map,
    position: new maps.LatLng(anchor.lat, anchor.lng),
    icon: { content, anchor: new maps.Point(0, 0) },
    clickable: false,
    zIndex: LABEL_Z_BASE + index,
  });
}

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

  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);
  const myOverlaysRef = useRef<NaverOverlay[]>([]);
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
    if (map.getZoom() > MAX_ZOOM) map.setZoom(MAX_ZOOM);
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

    const map = new maps.Map(node, {
      mapTypeId: maps.MapTypeId.NORMAL,
      draggable: false,
      pinchZoom: false,
      scrollWheel: false,
      keyboardShortcuts: false,
      disableDoubleClickZoom: true,
      disableDoubleTapZoom: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: true,
      center: new maps.LatLng(EXIT5.lat, EXIT5.lng),
      zoom: 15,
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
    MAP_FEATURES.forEach((feature, index) => {
      overlays.push(...drawFeature(maps, map, feature));
      overlays.push(createLabelMarker(maps, map, feature, index));
    });
    overlaysRef.current = overlays;

    fit(maps, map);
    setStatus("ready");
  }, [fit, syncLabelWidth]);

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
              createLabelMarker(maps, map, myLocationFeature({ lat, lng }), MAP_FEATURES.length),
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

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`}
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
              숨겨진 영역 안의 포커스 가능 요소는 WCAG 2.4.3·4.1.2 위반이 된다(§20.9) */}
          <div ref={mountRef} className="size-full" />
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
          <p className="break-keep text-caption text-ink">{LEGEND_KEY}</p>
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
        내 위치 — 버튼은 **지도 박스 밖**에 둔다. 지도 안에 컨트롤을 넣으면 비인터랙티브 계약이
        깨진다(§20.14.3). 지도가 실패한 상태에서는 표시할 지도가 없으므로 버튼도 렌더하지 않는다.
        컨테이너 최소 높이를 미리 잡아 미지원 판정에 따른 레이아웃 시프트를 막는다.
      */}
      <div className="mt-3 min-h-touch">
        {geoSupported && status === "ready" ? (
          <>
            <button
              type="button"
              onClick={requestLocation}
              disabled={locStatus === "requesting"}
              className="ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full border-2 border-primary bg-bg px-6 text-body font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:border-border-strong disabled:text-ink-muted"
            >
              {locStatus === "shown" ? "다시 확인" : "내 위치 표시"}
            </button>

            {/* idle 에도 DOM 에 존재해야 한다 — 나중에 생긴 노드의 내용을 못 읽는 SR 이 있다.
                `assertive` 를 쓰지 마라(읽던 것을 끊는다). 거부를 role="alert"·적색으로
                표시하지 마라 — 정당한 선택을 오류처럼 보이게 하는 것은 압박이다(§20.14.3) */}
            <div role="status">
              <p className="mt-2 break-keep text-body text-ink">{locationMessage}</p>
              {lowAccuracy ? (
                <p className="mt-1 break-keep text-body text-ink">{LOW_ACCURACY_NOTE}</p>
              ) : null}
            </div>

            {/*
              이 문단은 기능 설명이 아니라 **사고 예방 문구**다(§20.14.2).
              브라우저 위치 권한은 **사이트(origin)별로 따로** 부여되므로, 여기서 허용해도
              출석 사이트는 다시 물어본다. 이 문장이 없으면 조합원이 "여기서 켰으니 됐다"고
              믿고 **현장에서 출석에 실패한다.** 지우지 마라.
            */}
            <p className="mt-2 max-w-[var(--container-prose)] break-keep text-caption text-ink-muted">
              위치는 이 브라우저 안에서만 사용하며 서버로 보내거나 저장하지 않습니다. 길찾기 보조
              기능이며 출석체크와 무관합니다 — 출석은 주최측 QR로 진행하고, 위치 권한은 사이트마다
              따로 물어봅니다.
            </p>
          </>
        ) : null}
      </div>
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
      <p className="mt-1 break-keep text-body text-ink">
        코스콤지부 — 더샵아일랜드파크 앞 의사당대로 [대오 2]
      </p>
      <p className="mt-1 text-caption text-ink-muted">{DISTANCE_TEXT_SHORT}</p>
    </div>
  );
}
