/** 결의대회 지도의 **단일 출처** — 좌표 · 기호 · 라벨 · 범례(§20.4 · §20.18 · §20.20).
 * 절 번호는 `_workspace/01_verifier_factcheck.md`(§n-n) 와 `02_designer_spec.md`(§n.n) 를 가리킨다.
 *
 * 기호 문법(§20.4.0): 색 = 주목도(파랑 = 조합원이 갈 곳 · 회색 = 참고 지물) · 형태 = 성질(점 = 지점 ·
 * 밴드 = 구간 · 원 = 불확실 범위 · 외곽선 = 기준 지물). **대오는 건물이 아니라 도로다.**
 *
 * 교체 규약 — 고칠 파일은 이 파일 하나다. `ZONE3_POLYGON`(+`confidence`)만 고치면 스타일·라벨 접미어·범례가
 * 따라오고, `MAP_FEATURES` 에서 항목을 지우면 도형·라벨·범례 행·팝업·정지점이 함께 사라진다. 번호는 자동이다.
 *
 * ⚠ 컴포넌트 안에 좌표 리터럴을 쓰지 마라 — 지도와 텍스트가 갈리면 조합원이 다른 장소로 간다.
 * ⚠ `id` 로 스타일을 분기하지 마라 — `confidence`·`outline` 같은 데이터 축으로만(§20.20.2).
 * ⚠ **지도 번호는 식별자가 아니다**(§30.9) — 지도·범례·팝업·`aria-label` 밖에서 인용하면 지점 추가가 파괴적 변경이 된다. */

/* ---------------------------- 1. 확인된 값 ---------------------------- */

/** 국회의사당역 5번 출구 — OSM `railway=subway_entrance` `ref=5`(§5-1, 3급 교차확인). 초기 화면 중심·무대 1 원의 기준.
 * ⚠ 지도에 출구 마커를 두지 마라 — 두 번 물어 「표시 안 한다」로 정해진 건이다. 다시 제안하지 마라 */
export const EXIT5 = { lat: 37.5282738, lng: 126.9172199 } as const;

/** 여의도공원 안 화장실 — OSM 노드(§18-9 · §20-10 이 독립 도달). **위치만 실측이고 명칭·호수·운영시간은 미확인**이라 점선 도트(근사)다.
 * ⚠ `PARK_ENTRANCE`(공원 입구)를 되살리지 마라 — 화장실을 못 찍을 때의 대안이었고 찍었다(요구 152).
 * ⚠ `2호(개나리)` 라고 부르지 마라(요구 153) — 이 노드가 2호인지 모른다. **카드의 원문 표기는 유지**한다(두 층위를 문면으로 분리, §18-9-3) */
export const PARK_TOILET = { lat: 37.525898, lng: 126.920944 } as const;

/** 여의도공원 **명칭이 확인된** 개방화장실 3개 — **좌표와 명칭의 출처가 다르다**(§39-1 · §39-2):
 * 좌표 = OSM `amenity=toilets`(위치 권위 · `PARK_TOILET` 과 동급이라 기호도 같은 `dashed`) ·
 * 명칭·호수 = 사용자 제공 네이버 지도 화면(표기 권위). 둘을 잇는 근거는 **독립 2방법 일치**다(§39-2).
 * ⚠ `PARK_TOILET` 을 이 셋 중 하나로 합치지 마라 — 별개의 실재 화장실이다(§39-3).
 * ⚠ 셋 다 `includeInBounds: false` 다 — 지우면 초기 화면이 남으로 벌어져 집결지가 작아진다 */
/** 여의도공원4호, 민들레 — OSM `node/12642237581`(`access=yes`·남녀 구분) */
export const TOILET_MINDLE = { lat: 37.526808, lng: 126.922293 } as const;
/** 여의도공원2호, 개나리 — OSM `way/1444112267`(건물 중심) */
export const TOILET_GAENARI = { lat: 37.524776, lng: 126.918950 } as const;
/** 여의도공원7호, 은방울 — OSM `way/1444112262`(건물 중심). 노드 `12642237588` 과 3m 이내로 같은 지물 */
export const TOILET_EUNBANGUL = { lat: 37.524225, lng: 126.920902 } as const;

/** 집회 3구역(코스콤지부) 폴리곤 — **§23-1 이 단일 출처**이고 **등급 상한은 `estimated`**(요구 106·179):
 * 측량된 경계가 아니라 주최측 배치도 규격 박스의 복제다(§21-4).
 * ⚠ 18·21회차의 좌표·치수를 넣지 마라 — 문서에 남아 있지만 22회차가 뒤집었다.
 * ⚠ 무대3(`STAGE3`)과 **같은 변환의 값**을 써라 — 섞으면 도형 간 상대 위치가 어긋난다.
 * ⚠ 치수를 리터럴로 적지 마라(요구 176) — 떠도는 치수는 전부 폐기된 변환 모델의 값이다. 이 좌표에서 파생하라 */
export const ZONE3_POLYGON: readonly (readonly [number, number])[] = [
  [37.526976, 126.919658], // 북동단 (무대3 쪽 · 동측)
  [37.525951, 126.920623], // 남동단 (여의도공원 경계)
  [37.525750, 126.920284], // 남서단
  [37.526775, 126.919318], // 북서단 (무대3 쪽 · 서측)
];

/** 무대3(LED) 중심 — **`ZONE3_POLYGON` 과 같은 변환**(§23-1 · 요구 179). 섞지 마라 */
export const STAGE3 = { lat: 37.527039, lng: 126.919331 } as const;

/** 무대3 원의 반경(m) — **§18-1 총오차 상한 ±20~30m 의 상한**을 쓴다(불확실성을 과소 표현하지 않는다).
 * ⚠ 30 을 넘기지 마라 — 그 순간 원이 3구역 도형을 덮기 시작한다(중심↔3구역 최근접 23m) */
export const STAGE3_RADIUS_M = 30;

/* ⚠ `DSHARP_POLYGON`(더샵아일랜드파크 부지)은 제거됐다(요구 130). 되살리지 마라 — 소스에 남기면 언젠가 다시 쓰인다.
 * 근거가 무효가 된 게 아니라 역할이 사라진 것이라 구역 확정 후 **새 구역 기준으로** 앵커 재검토는 가능하다. 값: git 이력 · §5-13-4 */

/** 무대 1 원의 반경(m) — 5번 출구 중심. **무대의 크기가 아니다**(점을 찍으면 없는 정밀도를 주장하게 되므로 범위로만 그린다). 값은 사용자 지시로 `STAGE3_RADIUS_M` 과 같다 */
export const STAGE_RADIUS_M = 30;

/* ⚠ 거리 문구는 **완성된 문자열로** 내보낸다 — 값만 끼워 넣으면 React 가 텍스트 노드를 쪼개 `약 <!-- -->320<!-- -->m` 로 나가 **문안 대조(grep)가 실패한다.**
 * ⚠ `약 320 m` 같은 단일 수치를 되살리지 마라(요구 29) — 구간 시종점이 미확인이라 갖고 있지 않은 정밀도다.
 * ⚠ 거리 문구 2건(`약 220~340 m` · 화장실까지 `약 80 m`)은 제거됐다(요구 101) — "코스콤지부 = 더샵 앞 구간"이라는 무효가 된 전제에서 계산됐다.
 * ⚠ 구역이 확인되기 전에는 **범위조차 쓰지 마라**(요구 29 도 함께 철회됐다). */

/* ------------- 2. 대오 밴드 — 확신도 기반 데이터 모델 (§20.20.2) ------------- */

/** 좌표 확신도 — **렌더 스타일과 범례 문구가 이 값에서 파생된다**(§20.20.3) */
export type GeoConfidence =
  /** 3급 교차확인 좌표·폴리곤 */
  | "verified"
  /** 확인된 기하로 계산 (지물 정사영 + OSM 도로 중심선) */
  | "calculated"
  /** 순수 추정 (범위 근거 없음) */
  | "estimated";

/* ⚠ `ColumnBand` 타입과 `RALLY_COLUMNS` 좌표(대오 1·2)는 제거됐다(요구 98) — 새 배치도로 체계가 `대오 1·2` → `1·2·3구역` 으로 교체됐다.
 * ⚠ **옛 좌표를 되살려 3구역에 붙이지 마라 — 그것이 §12-4 가 말한 날조다.** 필요하면 원본 배치도로 처음부터 산출하고, 그때도 `estimated` 가 상한이다(요구 106).
 * 옛 값: git 이력 · §5-12-7. **여기에 복사해 두지 마라.** */

/* --------------------------- 3. 기호 체계 타입 --------------------------- */

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface BoundsLiteral {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** 라벨이 앵커에서 뻗는 방향. **지도 중앙 쪽으로** 붙인다(§20.4.2) */
export type LabelPlacement = "right" | "left" | "top" | "bottom";

/** 라벨 우선순위(§21.2.2) — 축소하면 낮은 등급부터 텍스트가 접히고 번호 배지만 남는다(`primary` 전 구간 · `secondary` z≥16 · `tertiary` z≥17).
 * **초기 화면이 z16 이라 처음 보는 화면에서는 접힘이 없다** — 사용자가 의도적으로 축소했을 때만 일어난다 */
export type LabelPriority = "primary" | "secondary" | "tertiary";

/** 등급별 텍스트 pill 노출 최소 zoom (§21.2.2) */
export const LABEL_PRIORITY_MIN_ZOOM: Record<LabelPriority, number> = {
  primary: 0,
  secondary: 16,
  tertiary: 17,
};

/** 지도 조작 줌 범위(§21.1.1). 과축소를 막는 것이 라벨 겹침 문제의 **상한을 정하는 수단**이다 */
export const MAP_MIN_ZOOM = 15;
export const MAP_MAX_ZOOM = 19;

/** 색 계열 — **의미색을 늘리지 않는다**(§2 3종 상한) */
export type MapTone =
  /** 파랑 #093389 — 조합원이 갈 곳(출구·대오) */
  | "go"
  /** 회색 #4b5563 — 참고 지물(기준 부지·무대·내 위치) */
  | "reference";

interface MapFeatureBase {
  id: string;
  /** 라벨 pill 본문. 번호 배지는 배열 순서에서 자동 부여된다 */
  label: string;
  /** 범례 행 본문. 번호는 자동 */
  legend: string;
  /** ★ 로드뷰 안에도 라벨을 띄운다. 대상은 **눈으로 봐서는 알 수 없는 지점**(집결위치·화장실)뿐이다 — 무대는 촬영 시점에 없어 빈 도로를 가리키고, 라벨이 지평선에 몰려 겹친다.
   * ⚠ 켜면 지도와 **같은 번호·같은 이름**이 로드뷰에도 나간다. 한쪽만 고치지 마라 */
  inRoadview?: true;
  /** ★ 팝업에만 나가는 보탬 — 범례는 훑는 목록이라 이 수치는 그 지점을 고른 사람에게만 필요하다(§25.1 · §5.3).
   * ⚠ **여기 값은 그 지점에 대해 실제로 잰 것이어야 한다** — 잰 화장실은 ④(`park-toilet`) 하나뿐이라 ⑤⑥⑦ 에 복사하면 재본 적 없는 거리를 사실로 진술하게 된다 */
  popupNote?: {
    /** 첫 줄 — **무엇을 잰 것인지 확정한다. 줄이거나 흐리게 하지 마라**(요구 186·187): 없으면 거리가 바로 위 `2호(개나리) 이용` 을 수식하는 것으로 읽힌다 */
    readonly lead: string;
    /** 각 줄은 **선택지**이지 범위가 아니다(조합원이 "내가 어느 끝에 서는가"를 고른다).
     * ⚠ 한 줄로 잇거나 가운뎃점으로 묶지 마라 — `30~170` 이라는 단일 범위로 되읽힌다.
     * ⚠ `label` 을 줄이지 마라 — 조건 없이 수치만 눈에 들어오면 그게 오류의 재발이다 */
    readonly rows: readonly { readonly label: string; readonly value: string }[];
  };
  /** 범례 앞 기호 글리프 — `aria-hidden`. 의미는 문자가 전달한다(§2) */
  glyph: string;
  /** ★ 배지에 번호와 함께 붙는 종류 기호. **번호를 대체하지 않는다** — 번호가 없으면 범례 네 행이 같은 기호로 시작해 "민들레인가 은방울인가"를 답할 수 없다(§2).
   * ⚠ **이모지가 아니라 SVG 다**(도형은 `RallyMap` 의 `symbolSvg`) — 이모지는 기기마다 다른 그림이 나가고 글꼴이 없으면 두부(□)로 떨어진다.
   * ⚠ 값이 있으면 배지가 **알약 + 흰 배경**이 된다 — 컬러 픽토그램은 짙은 남색 위에서 제 색이 죽는다 */
  symbol?: "toilet";
  placement: LabelPlacement;
  /** `top`/`bottom` 라벨의 **가로 정렬 기준**(기본 center). 세로 위치는 항상 폴리곤 극점에서 나오므로 이 값을 바꿔도 **도형을 덮지 않는 보장은 유지된다** */
  labelAlign?: "west" | "center" | "east";
  /** 앵커에서 라벨까지의 간격(px). 기본 세로 14 / 가로 28. 라벨 충돌을 푸는 자유도 */
  labelGap?: number;
  tone: MapTone;
  /** 라벨 pill 테두리 — 도형의 선종과 짝을 이룬다 */
  outline: "solid" | "dashed";
  /** 지도 위에 **이름을 상시 띄울 것인가**(§25.1). `"popup"` 은 배지만 두고 이름을 클릭 팝업에 넣는다(줌이 올라가도 텍스트를 안 띄운다).
   * ⚠ ④ 3구역을 `popup` 으로 밀어 넣지 마라(§25.1) — **어포던스 실패 시의 방어선**이라, 누를 수 있다는 걸 모르는 조합원도 자기 대오 위치는 봐야 한다.
   * ⚠ `labelPriority` 와 **다른 축**이다 — `popup` 항목의 `labelPriority` 는 무시되지만 **지우지 마라**(되살릴 때 근거가 사라진다) */
  textMode: "always" | "popup";
  /** 줌에 따라 텍스트 pill 을 접는 기준(§21.2.2). **등급의 근거는 "조합원의 행동"이다.**
   * 접혀도 번호 배지는 남고 범례가 번호를 설명하므로 정보 손실 0 — §0.4 은폐가 아니다 */
  labelPriority: LabelPriority;
  /** 번호를 매기지 않는 항목은 `false`(§20.21.1) — 내 위치는 사용자가 만들어 낸 동적 표식이라 번호를 주면 안내도의 6번째 지점으로 읽힌다 */
  numbered?: boolean;
  /** **`z === MAP_MIN_ZOOM` 에서만** 적용되는 배치 재정의(§23.2.3). z15 는 `축소` 버튼이 멈추는 곳이라 축소한 조합원 전원이 같은 화면 하나를 본다 — 설계 대상이다.
   * 필요해지는 이유는 기하다: **앵커 간 거리는 축척에 비례해 줄지만 `labelGap` 은 픽셀 고정이라 안 줄어든다.**
   * ⚠ 탐색·재계산이 아니다 — 팬·줌마다 최적 위치를 찾는 동적 배치는 §21.9.4 가 기각했다 */
  minZoomOverride?: { placement?: LabelPlacement; labelGap?: number };
  /** `fitBounds` 계산에 넣지 않을 항목은 `false`(§20.21.1).
   * ⚠ 내 위치를 포함시키면 §20.14 판단 2("지도 범위를 바꾸지 않는다")가 깨진다 — 집에서 누르면 지도가 서울 전체로 축소된다 */
  includeInBounds?: boolean;
}

/** 점 — 확정 좌표 1개인 지점 */
export interface DotFeature extends MapFeatureBase {
  kind: "dot";
  position: LatLngLiteral;
}

/** 원 — 좌표가 없어 범위로만 아는 것 */
export interface CircleFeature extends MapFeatureBase {
  kind: "circle";
  center: LatLngLiteral;
  radiusMeters: number;
  labelAt?: LatLngLiteral;
}

/** 외곽선 — **채움 0**. 위치 기준 지물(랜드마크).
 * ⚠ 면을 채우면 대오 밴드와 같은 위계로 읽혀 "여기 모인다"로 오독된다(§5-13-6) */
export interface OutlineFeature extends MapFeatureBase {
  kind: "outline";
  polygon: readonly (readonly [number, number])[];
  labelAt?: LatLngLiteral;
}

/** 밴드 — 도로 위 구간. 스타일은 `confidence` 에서만 파생된다(§20.20.3) */
export interface BandFeature extends MapFeatureBase {
  kind: "band";
  polygon: readonly (readonly [number, number])[];
  confidence: GeoConfidence;
  labelAt?: LatLngLiteral;
}

/** 핀 — **기기가 보고한 내 위치**. 동적으로 추가·제거되는 사용자 표식이다(§20.21.1).
 * ⚠ 원을 쓰지 마라 — ±120m 원은 폭 40m 밴드를 통째로 덮어 "내가 밴드 안인가"를 판독 불가로 만든다. 정밀도 주장은 텍스트 `약 ±{n}m` 하나가 전담한다 */
export interface PinFeature extends MapFeatureBase {
  kind: "pin";
  position: LatLngLiteral;
}

export type MapFeature =
  | DotFeature
  | CircleFeature
  | OutlineFeature
  | BandFeature
  | PinFeature;

/* ---------------- 4. 지도에 그리는 것 — 이 배열이 지도의 전부다 ---------------- */

/* ⚠ `toBandFeature`(옛 대오 밴드 생성기)를 되살리지 마라 — `calculated` 확신도 스타일이 딸려 오는데 3구역 좌표의 상한은 `estimated` 다(요구 106) */

/** 지도 표시 항목 — **번호는 이 배열 순서(지리 순서: 북서 → 남동)에서 자동 부여**된다(§20.20.1). 조합원은 번호를 **역에서 내려 걸어가는 순서**로 읽는다:
 * ① 5번 출구 → ② 무대 1 → ③ 무대3 → ④ 코스콤지부 3구역, 그다음이 **화장실 묶음** ⑤~⑧ 이다.
 * 화장실은 가는 순서가 아니라 **현장에서 고르는 선택지 목록**이라 최근접을 앞에 두고 나머지를 북 → 남으로 놓는다.
 * **텍스트 pill 은 z16 에서 3개가 상한**(②③④ · §30.5) — 6번째 지점의 기본값은 `tertiary`(배지)이고, pill 로 올리려면 ②③ 중 하나를 강등해 자리를 비운다.
 * 여기 없는 것: **1구역·2구역·무대2**(§19-4 — 구분은 라벨·팝업·블록 2 산문의 방위 단서가 진다) ·
 * **화장실 명칭**(지도 라벨은 `공원 화장실`, `2호(개나리)` 는 카드에만 — 요구 153) · **도로명 라벨**(§20.4.1).
 * ⚠ 거리를 문구로 쓰지 마라(§5.3) — 지도가 원근을 보여 준다 */
export const MAP_FEATURES: readonly MapFeature[] = [
  {
    kind: "circle",
    id: "stage1",
    label: "무대 1",
    /* `메인무대` 는 무대가 하나라는 전제의 이름이고 새 배치도로 그 전제가 깨졌다 — 원문과의 연결은 이 행이 진다(§18-8) */
    legend:
      "무대 1 — 안내자료의 “무대 1”이며 원 안내문의 “메인무대”입니다",
    glyph: "○",
    labelPriority: "secondary",
    /* **상시 노출 유지**(요구 84) — 이름이 지도에서 사라지면 어느 무대인지 알 수 없다 */
    textMode: "always",
    // 원의 북쪽 위 — 아래는 대오 밴드가 차지해 라벨이 밴드를 덮는다. 방향·간격은 §30.4.0 표
    placement: "top",
    labelGap: 14,
    tone: "reference",
    outline: "dashed",
    center: EXIT5,
    radiusMeters: STAGE_RADIUS_M,
  },
  {
    kind: "circle",
    id: "stage3",
    /* ③ **무대3(LED)** — §18-7 표시 승인. §12-9 위험("무대를 찾아 5번 출구 쪽으로 되돌아간다")이 이것으로 해소된다.
     * **도트가 아니라 원인 이유**: `estimated` 좌표(±20~30m)에 도트를 찍으면 없는 정밀도를 주장한다 — 원 = 범위로만 아는 것(§20.21.1).
     * ⚠ 불변은 "확인 좌표에는 원을 쓰지 않는다"이고 **원 2개는 허용된다**(§30.8.1) */
    label: "무대3",
    /* **띄어쓰기 없는 `무대3`** 이 배치도 원문이다 — ② 의 `무대 1` 과 다른 것이 원문 그대로다(게이트 62) */
    legend:
      "무대3(LED) — 코스콤지부가 배정된 3구역 앞 무대입니다",
    glyph: "○",
    labelPriority: "secondary",
    /* **`always` — 이 지물을 넣는 목적 자체가 문자에 있다.** 배지만 뜨면 §12-9 위험이 남는다(배지는 범례를 봐야 뜻이 생기는데 범례는 지도 아래다) */
    textMode: "always",
    /* `left` — 4방향을 전부 계산하고 남은 하나다(§30.4.3 에 기각 기록).
     * ⚠ 방향을 바꾸면 `FIT_PADDING.left`(32)를 다시 유도하라 — 그 값이 이 배치에 종속된다(§30.3) */
    placement: "left",
    labelGap: 28,
    /* `reference`(회색) — **무대는 바라보는 곳이지 가는 곳이 아니다.** 파랑(`go`)은 가는 곳에만(§20.20.3) */
    tone: "reference",
    outline: "dashed",
    center: STAGE3,
    radiusMeters: STAGE3_RADIUS_M,
  },
  {
    kind: "band",
    id: "zone3",
    /* ④ **집회 3구역(코스콤지부)** — §23-1 좌표. **이 페이지의 존재 이유다**(§20.19.6 위계 1순위).
     * ⚠ 옛 대오 밴드(`RALLY_COLUMNS`)를 되살려 붙이지 마라 — 그 자리는 새 배치도 기준 **2구역, 다른 지부 대오**다(§12-4 날조).
     * ⚠ 1구역·2구역·무대2 는 그리지 않는다(§19-4). 구분은 라벨·팝업 문안이 진다 */
    /* 문안은 사용자가 지정한 그대로다. 임의로 바꾸지 마라 */
    label: "코스콤 집결위치",
    legend:
      "코스콤지부 3구역 — 주최측 배치도의 “집회 3구역”입니다",
    glyph: "▨",
    /* ★ **`secondary` 다. `primary` 로 올리지 마라**(§30.16.2-2 · §30.17.1 확정) — 초기 뷰가 z16 이라 처음 보는 화면에서 차이가 0 이고,
     * 차이는 z15 하나뿐인데 거기서 pill 이 도형보다 몇 배 커져 지도를 덮는다(배지가 남고 범례가 뜻을 말하므로 §0.4 은폐가 아니다).
     * **규칙**: 접힘 불가 pill 은 `my-location` 하나 — 안내도 지물의 최고 등급은 `secondary` 이고 `primary` 는 동적·사용자 표식의 등급이다.
     * ⚠ `textMode` 는 다른 축이다 — `always` 는 그대로 유지한다(§25.1) */
    labelPriority: "secondary",
    textMode: "always",
    /* ★ 라벨을 밴드 옆으로 옮겼다(사용자 지시 — 첨부 화면의 붉은 화살표). `labelAt` 은 극점 규칙을 건너뛰고 좌표를 직접 지정한다.
     * 값은 **북동 긴 변의 북쪽 35% 지점에서 바깥으로 22m**(밴드 폭 37.4m 의 0.6배) — 중점(50%)에서는 pill 이 **⑥ 민들레 히트 영역을 19.6% 침범**해(실측) 북서로 당겼다.
     * ⚠ `labelAt` 은 "도형을 덮지 않는다"는 극점 보장을 포기한 것이다(→ `featureLabelAnchor`) — **좌표를 바꾸면 겹침을 다시 실측하라**(밴드 자신 · ② 원 · ③ pill · ⑥ 히트).
     * ⚠ `labelAlign` 은 `labelAt` 이 있으면 무시된다. 되살리려면 `labelAt` 부터 지워라 */
    labelAt: { lat: 37.526738, lng: 126.920200 },
    placement: "top",
    labelGap: 14,
    inRoadview: true,
    tone: "go",
    outline: "dashed",
    confidence: "estimated",
    polygon: ZONE3_POLYGON,
  },
  {
    kind: "dot",
    id: "park-toilet",
    /* ⑤ **공원 화장실** — §18-9 가 6회차 판정(개별 핀 금지)을 전환해 1개 표시 승인. §20-10 이 독립 도달.
     * ⚠ `id` 로 `park-entrance` 를 재사용하지 마라 — 대상이 바뀌었다(옛 id 가 남으면 주석과 데이터가 어긋난 채로 읽힌다).
     * ⚠ 라벨·범례에 `2호(개나리)` 를 쓰지 마라(요구 153 · 게이트 64) — 이 노드가 2호인지 모른다. 카드의 원문 표기는 유지한다 */
    label: "공원 화장실",
    legend:
      "공원 화장실 — 여의도공원 안 화장실입니다. 코스콤지부 구역에서 가장 가깝습니다",
    /* ★ 거리 — 25회차 확정 문안(요구 186·187). 카드에 있던 문구 그대로다. **다시 쓰지 마라.**
     * ⚠ 종전 `코스콤지부 구역에서 약 30~100 m` 로 되돌리지 마라 — 상한과 거리의 대상이 **둘 다 틀렸다.**
     * ⚠ 거리는 코드로 계산하지 않고 완성된 문자열로 둔다 — **좌표가 바뀌면 전수 재검산하라**(최종 게이트가 이 주석 ↔ 렌더 값을 대조한다).
     * ⚠ `남동쪽 끝` 이 아니라 `무대3 쪽 끝` 이다 — **현장에 나침반이 없다.** 모두가 아는 기준은 무대이고 ② 범례가 "앞 = 무대"를 이미 선언했다.
     * ⚠ 이 값을 ⑤⑥⑦ 에 복사하지 마라 — 그 셋까지의 거리는 잰 적이 없다 */
    popupNote: {
      lead: "지도에 표시한 공원 화장실까지",
      rows: [
        { label: "구역 뒤쪽 끝에서", value: "약 30~60 m" },
        { label: "무대3 쪽 끝에서는", value: "약 170 m" },
      ],
    },
    /** ⚠ 화장실 행은 이 값을 렌더하지 않는다 — `symbol` 이 있으면 범례도 지도 배지와 같은 SVG 를 그린다(둘이 다르면 범례↔지도 대응이 끊긴다).
     * 이 문자열은 SVG 를 쓸 수 없는 자리의 **텍스트 대체값**이다. 근사라는 뜻은 점선 테두리와 범례 키 줄이 이미 지므로 글리프는 **종류**를 말한다 */
    glyph: "🚻",
    symbol: "toilet",
    labelPriority: "tertiary",
    // 현장 편의 지점 — 배지만 두고 팝업이 설명한다(§25.1)
    textMode: "popup",
    /* `top` gap 26 — ⑤ 는 bbox 동단이라 `right` 는 배지가 잘리고 `left`·`bottom` 은 ④ 밴드·지도 크롬에 걸린다. 26 은 ① 과 같은 값이다(§22.9) */
    placement: "top",
    labelGap: 26,
    inRoadview: true,
    // 조합원이 **가는 곳** 계열이라 파랑을 유지한다(회색은 참고 지물의 색이다, §20.20.3)
    tone: "go",
    /* ⚠ **`dashed` 가 렌더를 가른다**(§30.7.2) — 도트의 확신도 축이다(`solid` = 꽉 찬 도트/확인 · `dashed` = 속 빈 도트 + 점선 링/근사).
     * 없으면 ⑤ 는 `textMode: "popup"` 이라 pill 이 영영 안 떠 **① 확인 도트와 똑같이 보인다**(요구 152 의 "점선 도트"가 사라진다).
     * ⚠ `id === "park-toilet"` 로 분기하지 마라(§20.20.2) */
    outline: "dashed",
    position: PARK_TOILET,
  },
  {
    kind: "dot",
    id: "toilet-mindle",
    /* 여의도공원 4호(민들레) — 화장실 묶음 중 **최북단**. 좌표 = OSM · 명칭 = 첨부 네이버 지도 화면(근거는 `TOILET_MINDLE` 주석).
     * ⑤ 와 **같은 증거 등급**이라 기호도 같다(`dashed` = 근사) */
    label: "4호 민들레 화장실",
    /* 범례는 **첨부 원문 표기 그대로** — 조합원이 네이버 지도에서 같은 이름을 찾을 수 있어야 한다.
     * ⚠ `지도 데이터 기준 위치라…` 같은 단서를 붙이지 마라(§5.3) — 점선 기호 + 범례 키 줄이 이미 말한다(네 행에 반복하면 범례가 벽이 된다) */
    legend: "여의도공원4호, 민들레 개방화장실",
    /** 종류 기호 — 근거는 ④(`park-toilet`) 주석. **넷이 같은 값이어야 한다** */
    glyph: "🚻",
    symbol: "toilet",
    labelPriority: "tertiary",
    // 배지만 두고 팝업이 설명한다(§25.1). pill 상한(z16 에서 3개)을 잠식하지 않는다
    textMode: "popup",
    placement: "top",
    labelGap: 26,
    inRoadview: true,
    tone: "go",
    outline: "dashed",
    /* ★ **`includeInBounds: false` 를 지우지 마라** — 셋 다 ⑤ 보다 남·동이라 bbox 에 넣으면 초기 화면이 남으로 벌어져 ①~④ 가 작아진다(화장실은 현장에서 찾는 부가 정보다) */
    includeInBounds: false,
    position: TOILET_MINDLE,
  },
  {
    kind: "dot",
    id: "toilet-gaenari",
    /* 여의도공원 2호(개나리) — **최서단**. 출처·등급·범례·배치 근거는 `TOILET_GAENARI` 주석과 위 민들레 항목과 같다 */
    label: "2호 개나리 화장실",
    legend: "여의도공원2호, 개나리 개방화장실",
    glyph: "🚻",
    symbol: "toilet",
    labelPriority: "tertiary",
    textMode: "popup",
    placement: "top",
    labelGap: 26,
    inRoadview: true,
    tone: "go",
    outline: "dashed",
    includeInBounds: false,
    position: TOILET_GAENARI,
  },
  {
    kind: "dot",
    id: "toilet-eunbangul",
    /* 여의도공원 7호(은방울) — **최남단**. 출처·등급·범례·배치 근거는 `TOILET_EUNBANGUL` 주석과 위 민들레 항목과 같다 */
    label: "7호 은방울 화장실",
    legend: "여의도공원7호, 은방울 개방화장실",
    glyph: "🚻",
    symbol: "toilet",
    labelPriority: "tertiary",
    textMode: "popup",
    placement: "top",
    labelGap: 26,
    inRoadview: true,
    tone: "go",
    outline: "dashed",
    includeInBounds: false,
    position: TOILET_EUNBANGUL,
  },
];

/** 구역 배정 문안 — 블록 2 산문이 여기서 나온다.
 * ⚠ `pending`·`pendingOnMap` 을 되살리지 마라(요구 157 · 163-1) — "위치는 확인 중"이었고 좌표가 나와 **남기면 거짓이다.**
 *   대체 문장도 안 된다: `assignment` 와 같은 문장이 두 곳에서 출력된다(§20-9) */
export const ZONE_STATUS = {
  /** 배정 사실. 블록 2 는 앞에 `주최측 안내에 따르면` 을 붙여 출처를 밝힌다 */
  assignment: "코스콤지부는 집회 3구역입니다.",
  /** 방위 단서 — **블록 2 산문의 경로 문장 다음·무대 문장 앞**(§30.17.5 · 요구 163). **지도가 이 답을 갖고 있지 않다**:
   * 띠를 하나만 그리는데 현장에는 나란한 두 대오가 있어, GPS 없이 판단하려면 눈에 보이는 지물이 필요하고 그것이 KDB산업은행이다(3구역 60m ↔ 2구역 116m · §28.1).
   * ⚠ `쪽` 을 `앞` 으로 고치지 마라(게이트 69) — 산업은행까지 60m 이고 **도로를 건너야 한다.**
   * ⚠ `여의도공원 쪽/방향` 으로 대체하지 마라(요구 163-2) — 공원 경계는 2구역 남동단에서도 1m 라 두 구역을 못 가른다. **조합원을 2구역으로 보낸다.**
   * ⚠ 지도 위 상태 패널에 넣지 마라 — 이 문장은 "거기까지 어떻게 가는가" 다음에만 뜻이 있다 */
  bearing: "3구역은 나란한 두 구역 중 북동쪽 — KDB산업은행 쪽입니다.",
} as const;

/** 무대3 문장 — **블록 2 산문과 무대 카드가 이 하나를 공유한다**(요구 88 · 182). 두 곳에 나오는 것은 의도된 것이다(블록 2 = 경로 설명 · 카드 = 시설 목록. **카드만 보는 조합원이 있다**).
 * ⚠ 두 곳에 문자열을 따로 적지 마라 — 한쪽만 고쳐지는 사고가 이 프로젝트에서 반복됐다. 카드본은 **주어만 붙여 이 문장에서 파생**시킨다 */
export const STAGE3_SENTENCE = "3구역 앞에는 무대3(LED)이 있습니다.";

/** 무대 카드본(요구 182) — **주어를 붙인 것 말고는 위와 같은 문장이다.** 따로 적지 마라 */
export const STAGE3_SENTENCE_CARD = `코스콤지부 ${STAGE3_SENTENCE}`;

/** 범례 첫 줄 — 확신도 3단을 **문자로** 선언한다. 색·선종 단독 의존 금지(§2 · §20.20.5) */
export const LEGEND_KEY = "점선 = 근사 · 옅은 면 = 범위 근사";

/* ⚠ `LEGEND_FOOTNOTE` 는 제거됐다(요구 158 · §19-3). 되살리지 마라 — 두 문장 다 상태가 끝났고(무대3 도 3구역도 실제로 표시했다) 남기면 지도와 각주가 정면으로 어긋난다.
 * ⚠ 빈 `<p>` 를 남기지 말고 DOM 에서 빼라. 새 각주도 만들지 마라 — 지도에 없는 것은 **범례 행이 진다.** */

/** 원문자 번호 — 배열 순서로 부여한다. 항목이 늘면 여기에 이어 붙인다 */
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"] as const;

export function circledNumber(index: number): string {
  return CIRCLED[index] ?? `(${index + 1})`;
}

/** 내 위치 항목 — **번호 없음 · `fitBounds` 제외**(§20.21.1). 표시했을 때만 지도·범례에 나타나고, 위치는 브라우저 메모리에서만 쓰이며 저장·전송하지 않는다 */
export function myLocationFeature(position: LatLngLiteral): PinFeature {
  return {
    kind: "pin",
    id: "my-location",
    label: "내 위치",
    legend: "내 위치 — 기기가 알려준 대략 위치입니다 (표시했을 때만 나타납니다)",
    glyph: "📍",
    placement: "right",
    tone: "reference",
    outline: "solid",
    numbered: false,
    includeInBounds: false,
    // 사용자가 방금 요청해서 표시한 것이라 접지 않는다
    labelPriority: "primary",
    // 방금 누른 결과라 이름이 바로 보여야 한다 — 팝업 대상이 아니다(번호도 없다)
    textMode: "always",
    position,
  };
}

/** 저정확도 경고 임계값(m). **임의 숫자가 아니라 대오 밴드 폭(40m)에서 나온 값이다**(§20.18.1) — 오차가 밴드 폭을 넘으면 "내가 밴드 안인가"를 판단할 수 없다.
 * ⚠ 밴드 폭이 바뀌면 이 값도 같이 바뀐다 */
export const LOW_ACCURACY_THRESHOLD_M = 40;

/** 저정확도 추가줄 — 문안 게이트 #29. **적색·경고 아이콘 금지**(오류가 아니라 조건 안내다) */
export const LOW_ACCURACY_NOTE =
  "위치 정확도가 낮아 지도 위 표시가 실제와 다를 수 있습니다.";

/* --------- 5. 파생값 — 라벨 앵커 · 초기 화면 범위 (손으로 적지 않는다) --------- */

/** 지오데식 상수(위도 1도 ≈ 111,320m). 반경(m)을 위경도 델타로 환산할 때만 쓴다 — 경도는 위도가 올라갈수록 좁아지므로 `cos(lat)` 으로 보정한다 */
const LAT_DEGREE_METERS = 111_320;

function circleBounds(center: LatLngLiteral, radiusMeters: number): BoundsLiteral {
  const dLat = radiusMeters / LAT_DEGREE_METERS;
  const dLng = radiusMeters / (LAT_DEGREE_METERS * Math.cos((center.lat * Math.PI) / 180));
  return {
    south: center.lat - dLat,
    west: center.lng - dLng,
    north: center.lat + dLat,
    east: center.lng + dLng,
  };
}

/** 폴리곤 꼭짓점들의 **극값**(최남·최서·최북·최동). 라벨 앵커와 `fitBounds` 계산의 재료다.
 * ⚠ 도형을 사각형으로 근사하는 용도가 아니다 — 부지를 bbox 로 그렸다가 실제의 1.8배가 된 사고(§25)를 반복하지 마라. 그리기는 항상 폴리곤 원본으로 한다 */
function polygonExtremes(points: readonly (readonly [number, number])[]): BoundsLiteral {
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

/** 항목이 차지하는 범위 — `fitBounds` 가 이것들의 합집합을 담는다 */
export function featureBounds(feature: MapFeature): BoundsLiteral {
  switch (feature.kind) {
    case "pin":
    case "dot":
      return {
        south: feature.position.lat,
        west: feature.position.lng,
        north: feature.position.lat,
        east: feature.position.lng,
      };
    case "outline":
      return polygonExtremes(feature.polygon);
    case "circle":
      return circleBounds(feature.center, feature.radiusMeters);
    case "band":
      return polygonExtremes(feature.polygon);
  }
}

/** 라벨 앵커 — **도형의 극점**에서 뽑는다(라벨이 그 도형을 덮지 않게 만드는 핵심). 인자는 폴리곤 꼭짓점들의 극값(`polygonExtremes`)이라 `north` 는 실제 최북단 위도이고, 그래서 `top` 라벨은 폴리곤 전체보다 위에 놓인다.
 * ⚠ **bbox 변의 중점을 쓰지 마라** — 축정렬 도형에는 맞지만 대각선 폴리곤에서는 중점이 **밴드 옆 허공**에 잡히고, 거기서 띄운 라벨이 다른 밴드 위에 얹힌다 */
function anchorAtExtreme(
  b: BoundsLiteral,
  placement: LabelPlacement,
  align: "west" | "center" | "east" = "center",
): LatLngLiteral {
  const lng = align === "west" ? b.west : align === "east" ? b.east : (b.west + b.east) / 2;
  switch (placement) {
    case "top":
      return { lat: b.north, lng };
    case "bottom":
      return { lat: b.south, lng };
    case "left":
      return { lat: (b.south + b.north) / 2, lng: b.west };
    case "right":
      return { lat: (b.south + b.north) / 2, lng: b.east };
  }
}

/** 라벨을 다는 지점. 명시값(`labelAt`)이 있으면 그것을, 없으면 배치 방향에서 자동으로 정한다 — 항목을 추가할 때 앵커를 따로 계산해 적을 필요가 없게 하기 위해서다 */
export function featureLabelAnchor(feature: MapFeature, zoom?: number): LatLngLiteral {
  if (feature.kind === "dot" || feature.kind === "pin") return feature.position;
  if (feature.labelAt !== undefined) return feature.labelAt;
  const { placement } = labelPlacementAt(feature, zoom);
  switch (feature.kind) {
    case "outline":
      return anchorAtExtreme(polygonExtremes(feature.polygon), placement, feature.labelAlign);
    case "circle":
      return anchorAtExtreme(
        circleBounds(feature.center, feature.radiusMeters),
        placement,
        feature.labelAlign,
      );
    case "band":
      return anchorAtExtreme(polygonExtremes(feature.polygon), placement, feature.labelAlign);
  }
}

/** **로드뷰를 열 지점**(지점 팝업의 `로드뷰 보기`). `band` 는 폴리곤 꼭짓점 평균 — 긴 띠에서 가운데 도로 위가 나온다(파노라마가 가장 가까운 실제 촬영점을 스스로 찾으므로 정밀할 필요는 없다).
 * ⚠ `featureLabelAnchor` 를 쓰지 마라 — 그것은 도형의 **극점**을 돌려주므로 로드뷰가 구역 끝 모서리를 본다 */
export function featureRoadviewPoint(feature: MapFeature): LatLngLiteral {
  switch (feature.kind) {
    case "dot":
    case "pin":
      return feature.position;
    case "circle":
      return feature.center;
    case "outline":
    case "band": {
      const n = feature.polygon.length;
      let lat = 0;
      let lng = 0;
      for (const [a, b] of feature.polygon) {
        lat += a;
        lng += b;
      }
      return { lat: lat / n, lng: lng / n };
    }
  }
}

/** 라벨 기본 간격(px) — 세로/가로. 항목이 `labelGap` 을 주면 그것이 이긴다 */
const DEFAULT_LABEL_GAP_VERTICAL = 14;
const DEFAULT_LABEL_GAP_HORIZONTAL = 28;

/** 이 줌에서 라벨이 **어느 방향으로 얼마나 떨어져** 놓이는가. `minZoomOverride` 는 `z === MAP_MIN_ZOOM` 에서만 적용된다(§23.2.3) — 줌을 모르면 기본값을 쓴다.
 * ⚠ 여기 말고 다른 곳에서 방향을 분기하지 마라 */
export function labelPlacementAt(
  feature: MapFeature,
  zoom?: number,
): { placement: LabelPlacement; gap: number } {
  const override = zoom === MAP_MIN_ZOOM ? feature.minZoomOverride : undefined;
  const placement = override?.placement ?? feature.placement;
  const gap =
    override?.labelGap ??
    (override?.placement !== undefined
      ? // 방향만 바뀌었으면 그 방향의 기본 간격을 쓴다 — 세로 값을 가로에 그대로 쓰면 안 된다
        placement === "top" || placement === "bottom"
        ? DEFAULT_LABEL_GAP_VERTICAL
        : DEFAULT_LABEL_GAP_HORIZONTAL
      : (feature.labelGap ??
        (placement === "top" || placement === "bottom"
          ? DEFAULT_LABEL_GAP_VERTICAL
          : DEFAULT_LABEL_GAP_HORIZONTAL)));
  return { placement, gap };
}

/** 초기 화면이 담아야 할 범위 — `MAP_FEATURES` 에서 **자동 계산**한다(손으로 적은 bbox 가 남아 실제 표시와 어긋나는 사고를 막는다).
 * 항목이 0건이면 `Infinity` 가 나가 지도가 깨지므로 5번 출구 주변 200m 로 떨어뜨린다 — 교체 중 항목을 잠시 주석 처리하는 일이 실제로 생긴다 */
const BOUNDED_FEATURES = MAP_FEATURES.filter((f) => f.includeInBounds !== false);

export const MAP_FIT_BOUNDS: BoundsLiteral =
  BOUNDED_FEATURES.length === 0
    ? circleBounds(EXIT5, 200)
    : BOUNDED_FEATURES.map(featureBounds).reduce((acc, b) => ({
        south: Math.min(acc.south, b.south),
        west: Math.min(acc.west, b.west),
        north: Math.max(acc.north, b.north),
        east: Math.max(acc.east, b.east),
      }));
