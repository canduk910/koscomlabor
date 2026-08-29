/**
 * 네이버 지도 Web Dynamic Map v3 **타입 선언** — 이 프로젝트가 실제로 쓰는 API 만 적는다.
 * ⚠ `any`·근거 없는 캐스팅으로 우회하지 마라(외부 스크립트 경계면). ⚠ `window.naver` 는 스크립트
 *   로드 전에는 없다 — **optional 선언이 존재 검사를 강제하는 것**이 이 파일의 핵심이다.
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

/** `fitBounds` 여백(px) — 라벨이 지도 박스를 벗어나지 않게 하는 유일한 수단이다(§20.4.3) */
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
  /** 과축소 하한 — 라벨 겹침 문제의 **상한을 정하는 수단**이다(§21.2.1) */
  minZoom: number;
  maxZoom: number;
}

export interface NaverMap {
  fitBounds(bounds: NaverLatLngBounds, margin?: NaverBoundsPadding): void;
  getBounds(): NaverLatLngBounds;
  getZoom(): number;
  /** ⚠ 2번째 인자는 애니메이션 스위치다. `false` = 즉시(`prefers-reduced-motion` 대응) */
  setZoom(zoom: number, useEffect?: boolean): void;
  /** **현재 호출부가 없다** — 두 손가락 팬이 네이버 `pinchZoom` 과 제스처를 나눠 갖지 못해
   *  제거됐다(`RallyMap.tsx` 조작 계약 주석). ⚠ 다시 쓰려면 실기기 실측이 선행돼야 한다 */
  panBy(x: number, y: number): void;
  /** 생성 이후 옵션 변경(휠 확대 토글). 부분 객체 — 넘기지 않은 옵션은 유지된다 */
  setOptions(options: Partial<NaverMapOptions>): void;
  addListener(eventName: string, listener: (payload?: unknown) => void): NaverMapEventListener;
  destroy(): void;
}

/** `naver.maps.Event.removeListener()` 에 넘기는 핸들. 내부 구조는 쓰지 않는다 */
export type NaverMapEventListener = object;

/** 로드뷰 파노라마 — 별도 API 다(§21.3) */
export interface NaverPanoramaOptions {
  position: NaverLatLng;
  /** `pan` 은 **선택이다** — 생략하면 네이버가 촬영 진행 방향을 잡는다(지점마다 다르므로 고정값은 틀린다) */
  pov: { pan?: number; tilt: number; fov: number };
  /** **주변 항공뷰 아이콘**(공식 문서 표현) — 좁은 시트에서 오탭이 잦아 끈다. **이동 기능이 아니다** */
  flightSpot?: boolean;
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
  /** 거리뷰 모드 — 지도 클릭 지점으로 옮긴다. **가장 가까운 실제 촬영점을 스스로 찾는다** */
  setPosition(position: NaverLatLng): void;
  getPosition?(): NaverLatLng | undefined;
  getPov?(): { pan?: number; tilt?: number; fov?: number } | undefined;
  /** 촬영 메타 — `photodate` 가 **없을 수 있다.** 없으면 표시하지 않는다(지어내지 마라) */
  getLocation?(): { photodate?: string; photoDate?: string } | undefined;
  /** ★ **컨테이너 크기가 바뀌면 반드시 부른다** — 공식 문서: *"이 옵션(`size`)을 설정하지 않으면
   *  파노라마 초기화 시 파노라마 개체가 삽입된 요소의 크기로 설정합니다."* 즉 **초기화 시점
   *  크기로 고정**돼 CSS 로 높이만 바꾸면 잘리거나 빈 여백이 남는다(회전·주소창 접힘 포함).
   *  ⚠ `ResizeObserver` 의 **감시 대상은 마운트 요소가 아니라 «부모»다**(`union-webapp-dev` §7) */
  setSize?(size: NaverSize): void;
  /** 화면 좌표 ↔ 지리 좌표 변환기(클릭 이동). ⚠⚠ **공식 문서에 없다**(`FOLLOWUPS` #12 ·
   *  `union-webapp-dev` §7). **필수로 바꾸지 마라** — 선택 필드라야 없어져도 클릭 이동만 꺼진다 */
  getProjection?(): NaverPanoramaProjection | undefined;
}

/** 파노라마 투영기 — 문서에 없는 API(위 `getProjection` 참조).
 *  ⚠ `fromOffsetToCoord` 는 **가로 오프셋만 반영**하고 거리가 늘 일정하다(실측 ≈226m) — *바라보는
 *  방향*이지 *바닥에 닿는 지점*이 아니다. **방향(방위각)을 얻는 데만 써라** */
export interface NaverPanoramaProjection {
  fromOffsetToCoord?(offset: NaverPoint): NaverLatLng | null | undefined;
}

/** `new maps.Size(w, h)` — `setSize` 인자. 리터럴 `{width,height}` 도 받지만 생성자가 명확하다 */
export interface NaverSize {
  readonly width: number;
  readonly height: number;
}

/** 사각형·원·폴리곤의 공통 부분 — 생성 후 제거만 한다 */
export interface NaverOverlay {
  setMap(map: NaverMap | null): void;
}

export interface NaverMarker extends NaverOverlay {
  /** 마커는 줌에 따라 아이콘(라벨)을 갈아끼운다(§21.2) */
  setIcon(icon: NaverMarkerIcon): void;
  /** 마커가 실제로 그려진 DOM. 로드뷰 라벨 겹침 판정이 **픽셀 실측**이라 필요하다(§21.2 와 같은 이유) */
  getElement?(): HTMLElement | null | undefined;
  setPosition(position: NaverLatLng): void;
  /** 배지·pill 클릭 → 팝업(§25.4). ⚠ `clickable: true` 인 마커에서만 발생한다 */
  addListener(eventName: string, listener: (payload?: unknown) => void): NaverMapEventListener;
}

export interface NaverMarkerIcon {
  content: string;
  /** `minZoomOverride` 로 라벨 방향이 바뀌면 앵커 좌표도 함께 옮긴다(§23.2.3) */
  anchor: NaverPoint;
}

export interface NaverMarkerOptions {
  position: NaverLatLng;
  /** ⚠ **파노라마도 받는다** — 실측이다(공식 문서에는 `Map` 만 있다 · `FOLLOWUPS` #12) */
  map: NaverMap | NaverPanorama;
  icon: NaverMarkerIcon;
  clickable: boolean;
  zIndex: number;
}

/** 도형 공통 스타일 — 흰 casing(아래층)과 본체(위층)가 같은 옵션 집합을 쓴다(§20.4.2) */
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
  Size: new (width: number, height: number) => NaverSize;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverLatLngBounds;
  Map: new (element: HTMLElement, options: NaverMapOptions) => NaverMap;
  Marker: new (options: NaverMarkerOptions) => NaverMarker;
  Rectangle: new (options: NaverRectangleOptions) => NaverOverlay;
  Circle: new (options: NaverCircleOptions) => NaverOverlay;
  Polygon: new (options: NaverPolygonOptions) => NaverOverlay;
  /** 로드뷰(§21.3). **선택 필드다** — 서브모듈 구성에 따라 없고, **죽은 버튼 금지**라
   *  버튼을 안 그리려면 타입이 그 사실을 말해야 한다 */
  Panorama?: new (element: HTMLElement, options: NaverPanoramaOptions) => NaverPanorama;
  /** 거리뷰 커버리지(파란 길) — «어디를 누를 수 있는지»의 유일한 수단. 같은 서브모듈이라 선택 필드다 */
  StreetLayer?: new () => NaverOverlay;
  Event: { removeListener(listener: NaverMapEventListener): void };
  /** `PanoramaStatus.OK` 비교용 — 로드뷰 로드 성공 판정(§21.3.2) */
  PanoramaStatus?: { readonly OK: string };
  MapTypeId: { readonly NORMAL: string };
}

declare global {
  interface Window {
    naver?: { maps?: NaverMapsNamespace };
    /** 인증 실패 시 네이버 스크립트가 **직접 호출**하는 전역 콜백. 등록하지 않으면 Client ID 가
     *  틀렸을 때 **빈 지도**로 남는다 — 가짜 동작 금지 */
    navermap_authFailure?: () => void;
  }
}

export {};
