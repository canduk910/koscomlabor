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
  /** 과축소 하한 — 라벨 겹침 문제의 상한을 정하는 수단이다(§21.2.1) */
  minZoom: number;
  maxZoom: number;
}

export interface NaverMap {
  fitBounds(bounds: NaverLatLngBounds, margin?: NaverBoundsPadding): void;
  getBounds(): NaverLatLngBounds;
  getZoom(): number;
  /** `useEffect: false` 로 애니메이션을 끈다 — `prefers-reduced-motion` 대응(§21.1.4) */
  setZoom(zoom: number, useEffect?: boolean): void;
  /*
   * 화면 픽셀 단위 이동. **현재 호출부가 없다** — 두 손가락 팬은 핀치와 제스처가 분리되지 않아
   * 제거됐다(`RallyMap.tsx` 의 조작 계약 주석 참조). 선언만 남겨 두는 이유는 팬을 재검토할 때
   * 타입부터 다시 만들지 않게 하기 위해서다. **쓰기 전에 실기기 실측이 선행돼야 한다.**
   */
  panBy(x: number, y: number): void;
  addListener(eventName: string, listener: (payload?: unknown) => void): NaverMapEventListener;
  destroy(): void;
}

/** `naver.maps.Event.removeListener()` 에 넘기는 핸들. 내부 구조는 쓰지 않는다 */
export type NaverMapEventListener = object;

/** 로드뷰 파노라마 — 별도 API 다(§21.3) */
export interface NaverPanoramaOptions {
  position: NaverLatLng;
  pov: { pan: number; tilt: number; fov: number };
  /** 지도와 같은 조작 규칙: 컨트롤 0, 한 손가락은 페이지 스크롤 */
  logoControl: boolean;
  zoomControl: boolean;
  aroundControl: boolean;
  minScale: number;
  maxScale: number;
}

export interface NaverPanorama {
  addListener(eventName: string, listener: (payload?: unknown) => void): NaverMapEventListener;
  getPanoId(): string | null;
  destroy(): void;
}

/** 사각형·원·폴리곤의 공통 부분 — 생성 후 제거만 한다 */
export interface NaverOverlay {
  setMap(map: NaverMap | null): void;
}

/** 마커는 줌에 따라 아이콘(라벨)을 갈아끼운다(§21.2) */
export interface NaverMarker extends NaverOverlay {
  setIcon(icon: NaverMarkerIcon): void;
  /** `minZoomOverride` 로 라벨 방향이 바뀌면 앵커 좌표도 함께 옮긴다(§23.2.3) */
  setPosition(position: NaverLatLng): void;
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
  Marker: new (options: NaverMarkerOptions) => NaverMarker;
  Rectangle: new (options: NaverRectangleOptions) => NaverOverlay;
  Circle: new (options: NaverCircleOptions) => NaverOverlay;
  Polygon: new (options: NaverPolygonOptions) => NaverOverlay;
  /**
   * 로드뷰(§21.3). **선택 필드다** — 스크립트 버전·서브모듈 구성에 따라 없을 수 있고,
   * 없을 때 `로드뷰 보기` 버튼을 아예 렌더하지 않으려면(죽은 버튼 금지) 타입이 그 사실을 말해야 한다.
   */
  Panorama?: new (element: HTMLElement, options: NaverPanoramaOptions) => NaverPanorama;
  Event: { removeListener(listener: NaverMapEventListener): void };
  /** `PanoramaStatus.OK` 비교용 — 로드뷰 로드 성공 판정(§21.3.2) */
  PanoramaStatus?: { readonly OK: string };
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
