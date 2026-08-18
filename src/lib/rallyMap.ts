/**
 * 결의대회 지도의 **단일 출처** — 좌표 · 기호 · 라벨 · 범례 (디자인 스펙 §20.4 · §20.18 · §20.20).
 *
 * 컴포넌트 안에 좌표 리터럴을 쓰지 마라 — 지도와 텍스트가 갈리는 순간 조합원이 다른 장소로 간다.
 * 각 값의 근거는 `_workspace/01_verifier_factcheck.md` 의 절 번호를 달았다.
 *
 * ## 기호 체계 정정 — **대오는 건물이 아니라 도로다** (§20.4.0) ★
 *
 * 사용자 지적(2026-08-18): *"마음대로 더샵아일랜드파크 위에 박스를 지정하면 안돼. 길 위에 박스를
 * 그려줘."* 초판은 건물 폴리곤을 대오로 칠했고, 그것은 **"건물 안으로 들어가라"로 읽힌다.**
 * 조합원이 실제로 서는 곳은 **의사당대로 위**다. 단지 부지는 이제 **위치 기준 랜드마크**일 뿐이다.
 *
 * | 축 | 규칙 |
 * |----|------|
 * | **선종 = 확신도** | 실선 = 확인된 위치 · 점선 = 근사·예정 · 테두리 없는 옅은 면 = 범위 근사 |
 * | **색 = 주목도** | 파랑 = 조합원이 갈 곳(출구·대오) · 회색 = 참고(기준 부지·무대) |
 * | 형태 = 대상의 성질 | 점 = 지점 · 면(밴드) = 구간 · 원 = 불확실 범위 · 외곽선 = 기준 지물 |
 *
 * ## 교체 규약 — **고칠 파일은 이 파일 하나다**
 *
 * - 대오 좌표가 바뀐다 → `RALLY_COLUMNS` 항목의 `polygon` 과 `source` 만 고친다.
 *   정밀도가 올라갔으면 `confidence` 도 함께 올린다 — **스타일·라벨 접미어·범례 문구가 자동으로 따라온다.**
 * - 대오를 빼려면 → `RALLY_COLUMNS` 에서 항목을 지운다. 도형·지도 라벨·범례 행이 **동시에** 사라진다.
 * - 번호(①②③…)는 **배열 순서에서 자동 부여**된다. 항목을 빼도 번호에 구멍이 생기지 않는다.
 * - **금지**: 컴포넌트에서 `id === "column-1"` 로 스타일을 분기하는 것. **`confidence` 로만 분기한다** —
 *   그래야 도면 실파일이 와서 확신도가 승격될 때 코드 수정 없이 반영된다(§20.20.2).
 */

/* ------------------------------------------------------------------ *
 * 1. 확인된 값
 * ------------------------------------------------------------------ */

/** 국회의사당역 5번 출구 — OSM `railway=subway_entrance` `ref=5` (검증 §5-1, 3급 교차확인) */
export const EXIT5 = { lat: 37.5282738, lng: 126.9172199 } as const;

/**
 * 여의도더샵아일랜드파크 **부지 폴리곤** — OSM `way 682330255` 단순화 14노드 (검증 §5-13-4).
 *
 * ⚠ **"건물"이 아니라 "부지"다.** OSM 태그가 `landuse=commercial` 이고 `building` 이 아니다 —
 * 대지 경계이며 주차장·조경·부대시설을 포함한다(부지 안에 101·102동이 따로 있다).
 * 코드·화면에서 "건물"이라고 쓰지 마라(검증 요구 35).
 *
 * ⚠ **bbox 사각형을 되살리지 마라**(검증 요구 31). 부지는 **도로와 나란한 평행사변형**이라
 * 축정렬 bbox 로 감싸면 북동 모서리가 의사당대로 쪽으로 튀어나온다 — 실측 **면적 1.8배 과대**이고
 * 그 튀어나온 부분이 **대오 2 폴리곤 20점 중 4점을 삼켰다.** 실좌표로 바꾸면 사라진다.
 *
 * ⚠ **노드를 6개 이하로 줄이지 마라**(검증 요구 32). 면적이 -9~12% 빠지면서 모서리가 잘려
 * 부지가 눈에 띄게 홀쭉해진다 — **앵커 지물의 형태가 변하면 조합원이 현장에서 대조할 때 어긋난다.**
 * 10노드(오차 3m)가 하한이고, 14노드(최대 편차 **1.0m** = 이 축척에서 1픽셀 미만)로 충분하다.
 *
 * ⚠ **밴드와 약 22m 떨어져 보이는 것이 정상이다**(검증 요구 34). 부지→차도 중심선 28m 에서
 * 밴드 남서 가장자리 6m 를 뺀 값이며 **그 22m 는 보도와 전면 공지(setback)** 다.
 * "떨어져 있으니 잘못 그렸다"고 판단해 **밴드를 부지 쪽으로 당기지 마라** — 당기는 순간
 * 대오가 보도·부지 위로 올라가고 **사용자가 지적한 원래 문제("건물 위에 박스")가 재발한다.**
 * 검증 실측: 변 교차 **0회** · 서로의 폴리곤 안에 든 점 **0개** · 최소 이격 **21.8m**.
 */
/*
 * 검증 §5-13-4 의 14점 목록에서 **닫는 점(첫 점과 동일)만 뺀 13점**이다.
 * 네이버 `Polygon` 은 링을 자동으로 닫으므로 중복 점이 필요 없다 — **단순화를 더 하지 않았다.**
 * 교체 후 자체 검산: 대오 2 폴리곤과 변 교차 **0회** · 서로의 안에 든 점 **0개** · 최소 이격 **21.7m**
 * (검증자 계산 21.8m 과 일치).
 */
export const DSHARP_POLYGON: readonly (readonly [number, number])[] = [
  [37.525018, 126.918724],
  [37.525028, 126.918673],
  [37.52507, 126.918621],
  [37.525787, 126.917925],
  [37.525831, 126.917909],
  [37.525904, 126.917953],
  [37.526253, 126.918515],
  [37.526332, 126.918644],
  [37.526351, 126.918759],
  [37.52632, 126.918888],
  [37.525648, 126.919545],
  [37.525586, 126.919562],
  [37.525496, 126.919509],
];

/**
 * 메인무대 설치 예정 범위의 반경(m).
 *
 * 무대는 **좌표가 없다**(주최측 설치 계획 — 외부 출처 부존재, 검증 §5-4·§5-12-8).
 * 5번 출구 중심 80m 원으로 그린다 — "5번 출구 앞"이라는 원문 서술의 불확실 범위이며
 * **무대의 크기가 아니다**. 점을 찍는 순간 없는 정밀도를 주장하게 되므로 반드시 범위(원)로만 그린다.
 * **LED무대는 좌표가 없어 표시하지 않는다**(검증 §5-12-8 — 도면 없이 찍으면 순수 날조다).
 */
export const STAGE_RADIUS_M = 80;

/*
 * 거리 문구는 **완성된 문자열로** 내보낸다.
 * 값만 끼워 넣으면 React 가 텍스트 노드를 쪼개 HTML 에 `약 <!-- -->320<!-- -->m` 로 나가고,
 * **게시 문안 대조(grep)가 실패**한다. 조합원 화면에는 차이가 없지만 검증 게이트에는 차이가 있다.
 *
 * ⚠ **`약 320 m` 같은 단일 수치를 되살리지 마라**(검증 요구 29). 구간의 실제 시종점은 미확인이라
 * 단일 수치는 갖고 있지 않은 정밀도다. 계산값 215~338m 를 반올림한 **범위**로만 쓴다.
 */

/** 블록 2 둘째 줄 (§20.3.3 개정 · 검증 §5-12-9) */
export const DISTANCE_TEXT_LONG =
  "국회의사당역 5번 출구에서 의사당대로를 따라 남동쪽으로 약 220~340 m (도보 약 4분)";

/** 지도 대체면 (§20.18.5) */
export const DISTANCE_TEXT_SHORT = "5번 출구에서 남동쪽으로 약 220~340 m";

/* ------------------------------------------------------------------ *
 * 2. 대오 밴드 — 확신도 기반 데이터 모델 (§20.20.2)
 * ------------------------------------------------------------------ */

/** 좌표 확신도 — **렌더 스타일과 범례 문구가 이 값에서 파생된다**(§20.20.3) */
export type GeoConfidence =
  /** 3급 교차확인 좌표·폴리곤 */
  | "verified"
  /** 확인된 기하로 계산 (대오 2 — 부지 정사영 + OSM 도로 중심선) */
  | "calculated"
  /** 순수 추정 (대오 1 — 범위 근거 없음) */
  | "estimated";

export interface ColumnBand {
  id: "column-1" | "column-2";
  /** 지도 라벨 본문 — **번호 배지와 확신도 접미어는 자동으로 붙는다**(§20.20.3) */
  label: string;
  /** 범례 행 본문 — 번호는 자동. `논의 중`·`미확정` 을 넣지 마라(§20.18.6) */
  legend: string;
  confidence: GeoConfidence;
  /** 폭 40m 밴드 폴리곤. `[lat, lng]` 시계방향, 자기교차 금지 */
  polygon: readonly (readonly [number, number])[];
  /** 출처 — 검증 리포트 절 번호. **좌표 교체 시 함께 갱신할 것** */
  source: string;
}

/**
 * 대오 밴드 (검증 §5-12-5 · §5-12-7).
 *
 * **가는 선(폴리라인)으로 그리지 마라**(검증 요구 24). 선은 "정확히 여기"를 주장하는데
 * 우리에겐 그 정밀도가 없다. 검증자가 중심선 폴리라인도 함께 냈지만 **렌더에 쓰지 않는다** —
 * 폭 40m 면으로만 그린다. 40m 는 분리 차도 간격 실측 28m + 여유이며, 대오가 어느 차도에
 * 서는지 알 수 없으므로 **양쪽 차도를 모두 덮는다.**
 *
 * ⚠ **±50m 를 보증하지 않는다**(검증 §5-12-6). 도면 실파일이 없어 구간의 실제 시종점은 미확인이다.
 * 그래서 ① 점선 테두리 ② 범례에 `구간 전후로 이어질 수 있습니다` ③ 대오 1 은 테두리 없는 옅은 면 —
 * **세 장치가 모두 "이것은 근사다"를 말한다.** 어느 하나도 빼지 마라.
 */
export const RALLY_COLUMNS: readonly ColumnBand[] = [
  {
    id: "column-1",
    label: "대오 1",
    legend: "대오 1 — 주최측 배치입니다. 범위는 근사이며 실제와 다를 수 있습니다",
    /*
     * 검증자 스스로 `[근사]`·"순수 추정"으로 표기했다 — "메인무대와 대오 2 사이일 것"이라는
     * 추정이며 실제 끝점 근거가 0이다. 대오 2(확인 기하 계산)와 **근거 등급이 다르고**,
     * 그 차이가 화면에서 보이도록 `estimated` 스타일(테두리 없음 · 옅은 채움)이 적용된다.
     */
    confidence: "estimated",
    // 5번 출구에서 도로 따라 10~205m, 폭 40m — 18점
    polygon: [
      [37.528248, 126.917911],
      [37.528073, 126.918087],
      [37.527897, 126.918264],
      [37.527721, 126.918441],
      [37.52753, 126.918626],
      [37.527347, 126.91879],
      [37.527164, 126.918954],
      [37.526981, 126.919118],
      [37.526856, 126.919241],
      [37.526628, 126.91889],
      [37.526773, 126.918748],
      [37.526956, 126.918585],
      [37.527139, 126.918421],
      [37.527322, 126.918257],
      [37.527498, 126.918086],
      [37.527673, 126.91791],
      [37.527849, 126.917733],
      [37.528024, 126.917557],
    ],
    source: "01_verifier_factcheck.md §5-12-7 [근사] — 순수 추정. 도면 실파일 확보 시 재검증 대상",
  },
  {
    id: "column-2",
    label: "코스콤지부 [대오 2]",
    legend:
      "코스콤지부 [대오 2] — 더샵아일랜드파크 앞 의사당대로 구간입니다. 안내자료를 지도로 옮긴 근사 구간이라 구간 전후로 이어질 수 있습니다",
    /*
     * 도면 판독이 아니라 **확인된 기하로 계산**됐다: 의사당대로 특정(5번 출구와 더샵을 잇는
     * 도로가 이것뿐) + 더샵 부지 폴리곤(OSM way 682330255)을 도로 중심선에 정사영 → 123m 구간.
     */
    confidence: "calculated",
    // 5번 출구에서 도로 따라 215~338m, 연장 123m, 폭 40m — 20점
    polygon: [
      [37.526787, 126.919312],
      [37.526678, 126.919422],
      [37.526573, 126.919528],
      [37.526468, 126.919634],
      [37.526363, 126.91974],
      [37.526257, 126.919846],
      [37.526152, 126.919953],
      [37.526047, 126.920059],
      [37.525941, 126.920165],
      [37.52592, 126.920186],
      [37.525696, 126.919832],
      [37.525717, 126.91981],
      [37.525822, 126.919705],
      [37.525928, 126.919599],
      [37.526033, 126.919493],
      [37.526138, 126.919386],
      [37.526243, 126.91928],
      [37.526349, 126.919174],
      [37.526454, 126.919068],
      [37.526559, 126.918962],
    ],
    source: "01_verifier_factcheck.md §5-12-5 [확인] — 부지 폴리곤 정사영 + OSM 도로 중심선",
  },
];

/* ------------------------------------------------------------------ *
 * 3. 기호 체계 타입
 * ------------------------------------------------------------------ */

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
  /** 범례 앞 기호 글리프 — `aria-hidden`. 의미는 문자가 전달한다(§2) */
  glyph: string;
  placement: LabelPlacement;
  /**
   * `top`/`bottom` 라벨의 **가로 정렬 기준**(기본 center).
   * 세로 위치는 항상 폴리곤의 극점에서 나오므로 이 값을 바꿔도 **도형을 덮지 않는 보장은 유지된다** —
   * 라벨끼리의 충돌을 푸는 자유도로만 쓴다.
   */
  labelAlign?: "west" | "center" | "east";
  /** 앵커에서 라벨까지의 간격(px). 기본 세로 14 / 가로 28. 라벨 충돌을 푸는 자유도 */
  labelGap?: number;
  tone: MapTone;
  /** 라벨 pill 테두리 — 도형의 선종과 짝을 이룬다 */
  outline: "solid" | "dashed";
  /**
   * 번호를 매기지 않는 항목은 `false`(§20.21.1).
   * ①~⑤ 는 **안내도의 지점**이라 범례에 고정 행을 갖는다. 내 위치는 **사용자가 만들어 낸
   * 동적 표식**이라 성질이 다르다 — 번호를 주면 안내도의 6번째 지점으로 읽힌다.
   */
  numbered?: boolean;
  /**
   * `fitBounds` 계산에 넣지 않을 항목은 `false`(§20.21.1).
   * **내 위치를 포함시키면 §20.14 판단 2("지도 범위를 바꾸지 않는다")가 깨진다** —
   * 집에서 누르면 지도가 서울 전체로 축소돼 집결지 정보가 통째로 무의미해진다.
   */
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

/**
 * 외곽선 — **채움 0**. 위치 기준 지물(랜드마크).
 * 면을 채우면 대오 밴드와 같은 위계로 읽혀 **"여기 모인다"로 오독된다**(검증 §5-13-6).
 * 선도 밴드보다 가늘고 낮은 채도로 — 앵커는 배경이지 주역이 아니다.
 */
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

/**
 * 핀 — **기기가 보고한 내 위치**. 동적으로 추가·제거되는 사용자 표식이다(§20.21.1).
 *
 * **원을 쓰지 않는 이유**: 원은 "이 반경 안에 있다"는 **기하적 주장**이고, 그 주장을 할 근거가
 * 매번 다르다. 정확도가 좋으면 도트에 가려 안 보이고, 나쁘면 ② 예정 원과 크기·모양이 비슷해져
 * **충돌이 최악이 되는 순간에만 등장**한다. 게다가 ±120m 원은 폭 40m 대오 밴드를 통째로 덮어
 * "내가 밴드 안인가"를 판독 불가로 만든다.
 * **핀은 "여기를 가리킨다"일 뿐 크기를 주장하지 않는다** — 정밀도 주장은 텍스트 `약 ±{n}m`
 * 하나가 전담한다. 형태 하나에 뜻 하나(§20.21.1 기호 문법).
 */
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

/* ------------------------------------------------------------------ *
 * 4. 지도에 그리는 것 — **이 배열이 지도의 전부다**
 * ------------------------------------------------------------------ */

/** `RALLY_COLUMNS` 항목 → 지도 밴드. 배열에서 빠지면 도형·라벨·범례가 함께 사라진다 */
function toBandFeature(column: ColumnBand): BandFeature {
  return {
    kind: "band",
    id: column.id,
    label: column.label,
    legend: column.legend,
    glyph: "▨",
    /*
     * 밴드 라벨은 150px 이 넘어 좌우 여백(127/111px)에 들어가지 않는다 — 위아래로만 뺄 수 있다.
     *
     * **대오 1 은 위, 대오 2 는 아래.** 두 밴드가 북서–남동으로 이어져 있으므로
     * 대오 1 의 최북단보다 위 / 대오 2 의 최남단보다 아래는 **두 밴드 어디에도 걸리지 않는다** —
     * 이 배치가 "라벨이 밴드를 덮지 않는다"를 구조적으로 보장한다(QA 지적 시정).
     * 동시에 화면상 **위쪽이 대오 1, 아래쪽이 대오 2** 라 지리 순서와 일치한다.
     * (이전에는 반대로 두어 라벨이 서로의 밴드를 덮고 순서도 뒤집혀 보였다.)
     */
    // 기본은 **수직 배치**(위/아래) — 세로형 박스에서 늘어난 것이 세로 여유다(§20.23.4).
    // 수평(좌/우)은 수직으로 놓을 자리가 없을 때만 쓴다
    placement: column.id === "column-1" ? "top" : "bottom",
    /*
     * 가로 정렬: ③ 대오 1 은 **동쪽 끝** — 가운데면 ① 5번 출구 라벨과 겹친다.
     * ④ 대오 2 는 **가운데** — 동쪽 끝으로 밀면 세로형 박스에서 **오른쪽이 24px 잘린다**
     * (360px 실측: 우측 여백이 58px 뿐이다). 세로 위치는 극점에서 나오므로 가로만 옮기는 것은
     * "밴드를 덮지 않는다"는 보장을 깨지 않는다.
     *
     * 세로 간격: 대오 1 은 **46px** — 14px 로 두면 라벨 아래변이 **메인무대 원의 북동 호를
     * 덮는다**(옛 박스에서 둘레 16% 실측). 46px 로 올리면 원 최북단보다 위로 완전히 빠져
     * 덮임이 0 이 된다. 세로형 박스가 만들어 준 여유를 여기에 쓴다. 대오 2 는 **42px** —
     * 부지 외곽선이 대오 2 남단 바로 아래에 걸쳐 있어 작은 값이면 라벨이 부지를 덮는다
     * (옛 박스에서 41~46% 실측된 그 문제다). 42px 면 **부지 아래로 2px 빠지면서**, 그 아래
     * ⑤ 라벨과 지도 하단 경계까지의 여유도 남긴다 — 768px 아래쪽 여백이 81px 뿐이라
     * ④⑤ 두 라벨(68px)을 넣으면 슬랙이 13px 이고, 그것을 2/4/7 로 나눈 값이다.
     */
    // ④ 는 **서쪽 끝 정렬** — 가운데면 360px 에서 오른쪽 경계까지 4px 밖에 안 남는다(실측).
    // 서쪽으로 밀면 33px 로 늘고, 부지 덮임은 세로 간격이 이미 해결해 영향이 없다
    labelAlign: column.id === "column-1" ? "east" : "west",
    labelGap: column.id === "column-1" ? 47 : 42,
    // 대오는 "조합원이 서는 곳" 계열이므로 근사여도 파랑을 유지한다.
    // **회색으로 바꾸지 마라** — 회색은 이 지도에서 참고 지물의 색이다(§20.20.3).
    tone: "go",
    outline: "dashed",
    confidence: column.confidence,
    polygon: column.polygon,
  };
}

/**
 * 지도 표시 항목 — **번호는 이 배열 순서(지리 순서: 북서 → 남동)에서 자동 부여**된다(§20.20.1).
 *
 * 조합원은 번호를 **무대에서의 순서**로 읽고, 그것이 실제로 필요한 정보다
 * ("내 자리가 무대에서 얼마나 뒤인가"). 랜드마크(더샵)를 마지막에 둔 이유는
 * **경로상의 지점이 아니라 대조용 기준**이기 때문이다.
 *
 * 여기 없는 것과 그 이유:
 * - **LED무대**: 이미지 4(기타 토의)에만 나오고 좌표 근거 0 → 범례 각주로만 존재를 밝힌다
 * - **화장실**: 좌표 검증 불가 → 지도 핀 금지(검증 §7-7). 텍스트 안내로만
 * - **도로 하이라이트·도로명 라벨**: 지도 위에 도로명을 쓰지 않는다(§20.4.1-4)
 */
export const MAP_FEATURES: readonly MapFeature[] = [
  {
    kind: "dot",
    id: "exit5",
    label: "5번 출구",
    legend: "국회의사당역 5번 출구 — 확인된 위치",
    glyph: "●",
    // 무대 원과 중심이 같아 라벨이 겹친다 → **출구와 무대를 서로 다른 방향으로 떼어 놓는다**(§20.20.1).
    // 출구 라벨은 짧아(98px) 왼쪽 여백에 들어가고, 무대 라벨은 길어 위쪽 여백에만 들어간다 — 실측 근거.
    // 간격 26px: 세로형 박스(§20.23)에서 **수평 여유가 224 → 134px 로 줄어** 38px 이면
    // 라벨 왼쪽이 4px 잘린다(360px 실측). 26px 이면 좌측 경계까지 8px 여유가 남고, ③ 라벨과는
    // 37px 떨어진다. 더 벌리면 잘리고 더 좁히면 원을 더 가린다 — 두 제약 사이의 값이다
    placement: "left",
    labelGap: 26,
    tone: "go",
    outline: "solid",
    position: EXIT5,
  },
  {
    kind: "circle",
    id: "stage",
    label: "메인무대(설치 예정)",
    legend:
      "메인무대 — 주최측 설치 예정. 정확한 지점이 확정되지 않아 대략 범위만 원으로 표시했으며, 당일 변경될 수 있습니다",
    glyph: "○",
    // `(설치 예정)` 문자는 **필수** — 확정도를 색·모양 단독으로 전달하면 안 된다(검증 §5-4-2).
    // 원의 북쪽 위로 띄운다: 아래쪽은 대오 밴드가 차지해 라벨이 밴드를 덮는다(360px 실측).
    // 간격 42px: 세로형 박스(§20.23)로 상단 여백이 88px 로 늘어난 덕에 ② 를 더 위로 올릴 수 있고,
    // 그 자리를 비워 ③ 대오 1 라벨이 **메인무대 원을 전혀 덮지 않게** 된다(아래 ③ 주석 참조).
    // 옛 4:3 박스에서는 여백이 부족해 29px 이 한계였고 ③ 가 원의 북동 호를 덮었다
    placement: "top",
    /*
     * 39px. **가장 빡빡한 뷰포트(768px, 16:9, 704×396)가 기준이다** — 그 상단 여백이 81px 뿐이고
     * ②③ 두 라벨(각 34px)이 거기 들어가야 해서 슬랙이 13px 이다. 그 13px 을
     * **② 상단 8 / ②③ 사이 2 / ③–원 사이 3** 으로 나눈 값이 이 39 와 아래 ③ 의 47 이다.
     * (여백 하한 8px — QA 18회차 권고. `FIT_PADDING` 을 늘리는 방식은 **상하가 제로섬**이라
     * 하단을 벌리면 상단이 그만큼 줄어 ② 가 5px 로 악화된다. 실측으로 확인하고 버렸다.)
     */
    labelGap: 39,
    tone: "reference",
    outline: "dashed",
    center: EXIT5,
    radiusMeters: STAGE_RADIUS_M,
  },
  ...RALLY_COLUMNS.map(toBandFeature),
  {
    kind: "outline",
    id: "dsharp",
    label: "여의도더샵아일랜드파크",
    // "건물"이 아니라 **부지**다(검증 §5-13-2 · 요구 35 · 리더 지시 2026-08-18)
    legend: "여의도더샵아일랜드파크 — 위치 기준 단지 부지",
    glyph: "▭",
    /*
     * 189px — 가장 긴 라벨이라 가로 중앙 정렬(위/아래)만 가능하다.
     * 앵커는 부지의 **남쪽 변**이고 라벨은 거기서 아래로 뻗는다.
     * 검증 §5-13-6 은 "라벨을 부지 안쪽에"라고 했고 그 이유는 **도로 쪽(북동)에 두면 대오 밴드
     * 라벨과 충돌**하기 때문이다. 남쪽은 도로 반대편이라 그 조건을 만족한다.
     * 중심에 앵커해 보니 **라벨이 부지 외곽선을 덮어 앵커 지물이 보이지 않았다**(실측) —
     * 앵커는 눈으로 대조하는 용도이므로 형태가 보이는 쪽이 목적에 맞는다.
     */
    /*
     * 38px. 768px 하단 여백 81px 를 **④ 34 / 사이 2 / ⑤ 34 / 하단 여백 9** 로 나눈 값이다.
     * 46 이면 하단 여백이 **1px** 까지 줄어 폰트 렌더링이 몇 px 만 달라져도 잘린다(실측).
     */
    placement: "bottom",
    labelGap: 38,
    tone: "reference",
    outline: "solid",
    polygon: DSHARP_POLYGON,
  },
];

/** 범례 첫 줄 — 확신도 3단을 **문자로** 선언한다. 색·선종 단독 의존 금지(§2 · §20.20.5) */
export const LEGEND_KEY = "실선 = 확인된 위치 · 점선 = 근사 · 옅은 면 = 범위 근사";

/** 범례 각주 — 지도에 없는 것을 밝힌다. 삭제가 아니라 각주로 남기는 것이 §0.4 이행이다 */
export const LEGEND_FOOTNOTE =
  "LED무대는 주최측 안내자료의 “기타 토의” 항목에만 나오고 배치가 논의 중이라 지도에 표시하지 않았습니다. 화장실은 좌표가 확인되지 않아 지도에 표시하지 않았습니다 — 위 화장실 안내를 참고해 주세요.";

/** 원문자 번호 — 배열 순서로 부여한다. 항목이 늘면 여기에 이어 붙인다 */
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"] as const;

export function circledNumber(index: number): string {
  return CIRCLED[index] ?? `(${index + 1})`;
}

/**
 * 내 위치 항목 — **번호 없음 · `fitBounds` 제외**(§20.21.1).
 * 표시했을 때만 지도·범례에 나타난다. 위치는 브라우저 메모리에서만 쓰이며 저장·전송하지 않는다.
 */
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
    position,
  };
}

/**
 * 저정확도 경고 임계값(m). **임의 숫자가 아니라 화면 위 도형에서 나온 값이다** —
 * 대오 밴드 폭이 40m 이므로, 오차가 그것을 넘으면 "내가 밴드 안인가"를 판단할 수 없다.
 * 그 판단이 불가능해지는 지점이 곧 경고 지점이다(§20.21.1).
 */
export const LOW_ACCURACY_THRESHOLD_M = 40;

/** 저정확도 추가줄 — 문안 게이트 #29. **적색·경고 아이콘 금지**(오류가 아니라 조건 안내다) */
export const LOW_ACCURACY_NOTE =
  "위치 정확도가 낮아 지도 위 표시가 실제와 다를 수 있습니다.";

/* ------------------------------------------------------------------ *
 * 5. 파생값 — 라벨 앵커 · 초기 화면 범위 (손으로 적지 않는다)
 * ------------------------------------------------------------------ */

/**
 * 지오데식 상수(위도 1도 ≈ 111,320m). 반경(m)을 위경도 델타로 환산할 때만 쓴다.
 * 경도는 위도가 올라갈수록 좁아지므로 `cos(lat)` 으로 보정한다.
 * **새 좌표를 만드는 것이 아니라 기존 좌표에서 파생하는 계산이다.**
 */
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

/**
 * 폴리곤 꼭짓점들의 **극값**(최남·최서·최북·최동). 라벨 앵커와 `fitBounds` 계산의 재료다.
 * **도형을 사각형으로 근사하는 용도가 아니다** — 부지를 bbox 로 그렸다가 실제의 1.8배가 됐던
 * 사고(§25)를 반복하지 마라. 그리기는 항상 폴리곤 원본으로 한다.
 */
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

/**
 * 라벨 앵커 — **도형의 극점**(최북단/최남단/최서단/최동단 좌표)에서 뽑는다.
 * 라벨이 그 도형을 덮지 않게 만드는 핵심이다.
 *
 * ⚠ 인자로 받는 `BoundsLiteral` 은 **폴리곤 꼭짓점들의 극값**이다(`polygonExtremes`).
 * `north` 는 폴리곤의 **실제 최북단 위도**이지 "bbox 북쪽 변"이라는 별개 도형이 아니다 —
 * 그래서 `top` 라벨은 폴리곤 전체보다 반드시 위에 놓인다. 이름을 `anchorAtExtreme` 으로 둔 것도
 * 호출부만 보고 "bbox 변 중점"으로 오독되지 않게 하기 위해서다.
 *
 * ⚠ **bbox 변의 중점을 쓰지 마라.** 축정렬 도형에는 맞지만 **대각선 폴리곤에는 맞지 않는다** —
 * 대각선 밴드의 bbox 변 중점은 **밴드 위가 아니라 옆 허공**에 잡히고, 그 지점에서 라벨을 띄우면
 * 라벨이 **다른 밴드 위에 얹힌다.** (부지 bbox 가 실제보다 1.8배 컸던 것과 같은 성질의 문제다.)
 *
 * 극점을 쓰면 보장이 생긴다: `top` 은 도형의 **최북단**보다 위, `bottom` 은 **최남단**보다 아래에
 * 라벨이 놓이므로 **자기 도형을 절대 덮지 않는다.** 두 대오가 남북으로 이어져 있으므로
 * 대오 1 을 `top`, 대오 2 를 `bottom` 으로 두면 **두 밴드 어느 쪽도 덮지 않는다.**
 * 가로 위치(`labelAlign`)는 이 보장과 무관하게 자유롭게 고를 수 있다.
 */
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

/**
 * 라벨을 다는 지점.
 * 명시값(`labelAt`)이 있으면 그것을 쓰고, 없으면 **배치 방향에서 자동으로** 정한다 —
 * 항목을 추가할 때 앵커를 따로 계산해 적을 필요가 없게 하기 위해서다.
 */
export function featureLabelAnchor(feature: MapFeature): LatLngLiteral {
  if (feature.kind === "dot" || feature.kind === "pin") return feature.position;
  if (feature.labelAt !== undefined) return feature.labelAt;
  switch (feature.kind) {
    case "outline":
      return anchorAtExtreme(polygonExtremes(feature.polygon), feature.placement, feature.labelAlign);
    case "circle":
      return anchorAtExtreme(
        circleBounds(feature.center, feature.radiusMeters),
        feature.placement,
        feature.labelAlign,
      );
    case "band":
      return anchorAtExtreme(polygonExtremes(feature.polygon), feature.placement, feature.labelAlign);
  }
}

/**
 * 초기 화면이 담아야 할 범위 — `MAP_FEATURES` 에서 **자동 계산**한다.
 * 항목을 넣고 빼면 여기가 따라온다. 손으로 적은 bbox 가 남아 실제 표시와 어긋나는 사고를 막는다.
 *
 * 항목이 0건이면 `Infinity` 가 나가 지도가 깨지므로 5번 출구 주변 200m 로 떨어뜨린다.
 * 교체 작업 중 항목을 잠시 주석 처리하는 일이 실제로 생긴다 — 그때 크래시하지 않게 한다.
 */
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
