/**
 * 네이버 지도 Web Dynamic Map v3 의 **타입 선언** — 이 프로젝트가 실제로 쓰는 API 만 적는다.
 *
 * 공식 `@types` 패키지를 의존성에 넣지 않으므로 직접 선언한다. `any` 나 근거 없는 캐스팅으로
 * 우회하지 않는다 — 외부 스크립트 경계면은 런타임 버그가 가장 잘 생기는 자리다.
 * 값은 없고 타입만 있는 모듈이므로 번들에 남는 코드는 0이다.
 *
 * 런타임에 `window.naver` 는 **스크립트 로드 전에는 없다.** 그래서 optional 로 선언한다 —
 * 존재 검사를 강제하는 것이 이 선언의 핵심이다.
 */

export interface NaverPoint {
  readonly x: number;
  readonly y: number;
}

export interface NaverLatLng {
  lat(): number;
  lng(): number;
}

export interface NaverLatLngBounds {
  extend(latlng: NaverLatLng): NaverLatLngBounds;
  /** 내 위치가 초기 화면 범위 안인지 판정 — 밖이면 마커를 만들지 않는다(§20.14.4) */
  hasLatLng(latlng: NaverLatLng): boolean;
}

/** `fitBounds` 의 여백(px) — 라벨이 지도 박스를 벗어나지 않게 하는 유일한 수단이다(§20.4.3) */
export interface NaverBoundsPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface NaverMapOptions {
  mapTypeId: string;
  draggable: boolean;
  pinchZoom: boolean;
  scrollWheel: boolean;
  keyboardShortcuts: boolean;
  disableDoubleClickZoom: boolean;
  disableDoubleTapZoom: boolean;
  zoomControl: boolean;
  mapTypeControl: boolean;
  scaleControl: boolean;
  center: NaverLatLng;
  zoom: number;
}

export interface NaverMap {
  fitBounds(bounds: NaverLatLngBounds, margin?: NaverBoundsPadding): void;
  getBounds(): NaverLatLngBounds;
  getZoom(): number;
  setZoom(zoom: number, useEffect?: boolean): void;
  destroy(): void;
}

/** 마커·사각형·원의 공통 부분 — 이 프로젝트는 생성 후 제거만 한다 */
export interface NaverOverlay {
  setMap(map: NaverMap | null): void;
}

export interface NaverMarkerIcon {
  content: string;
  anchor: NaverPoint;
}

export interface NaverMarkerOptions {
  position: NaverLatLng;
  map: NaverMap;
  icon: NaverMarkerIcon;
  clickable: boolean;
  zIndex: number;
}

/** 도형 공통 스타일 — 흰 casing(아래층) 과 본체(위층) 가 같은 옵션 집합을 쓴다(§20.4.2) */
export interface NaverShapeStyle {
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  strokeStyle?: string;
  fillColor: string;
  fillOpacity: number;
  clickable: boolean;
  zIndex: number;
}

export type NaverRectangleOptions = NaverShapeStyle & {
  map: NaverMap;
  bounds: NaverLatLngBounds;
};

export type NaverCircleOptions = NaverShapeStyle & {
  map: NaverMap;
  center: NaverLatLng;
  radius: number;
};

/** 도로 위 구간(대오) 밴드 — 폭 40m 면. **가는 선(Polyline)으로 그리지 않는다**(검증 요구 24) */
export type NaverPolygonOptions = NaverShapeStyle & {
  map: NaverMap;
  /** 외곽 링 1개. 좌표는 시계방향, 자기교차 금지 */
  paths: NaverLatLng[][];
};

export interface NaverMapsNamespace {
  Point: new (x: number, y: number) => NaverPoint;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverLatLngBounds;
  Map: new (element: HTMLElement, options: NaverMapOptions) => NaverMap;
  Marker: new (options: NaverMarkerOptions) => NaverOverlay;
  Rectangle: new (options: NaverRectangleOptions) => NaverOverlay;
  Circle: new (options: NaverCircleOptions) => NaverOverlay;
  Polygon: new (options: NaverPolygonOptions) => NaverOverlay;
  MapTypeId: { readonly NORMAL: string };
}

declare global {
  interface Window {
    naver?: { maps?: NaverMapsNamespace };
    /**
     * 인증 실패 시 네이버 스크립트가 **직접 호출**하는 전역 콜백.
     * 이것을 등록하지 않으면 Client ID 가 틀렸을 때 화면이 빈 지도로 남는다 —
     * 가짜 동작 금지 규약상 반드시 실패 상태로 넘겨야 한다.
     */
    navermap_authFailure?: () => void;
  }
}

export {};
