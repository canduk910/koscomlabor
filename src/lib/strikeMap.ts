/**
 * 9/4 총파업 안내지도의 **단일 출처** — 좌표 · 기호 · 라벨 · 범례. 고칠 파일은 이 파일 하나이고,
 * 항목을 빼면 **도형·지도 pill·범례 행이 동시에** 사라진다.
 * 정본: `_workspace/00_input/strike-20260904/MAP-PLAN.md` M-1~M-21 · 검증 §53~§55 · 디자인 §54·§54.16.
 *
 * ⚠ **`src/lib/rallyMap.ts` 를 «하나도» import 하지 마라**(M-5) — 그 파일 문면이 8/28 정체성을 지녀
 *   값 하나만 가져와도 9/4 번들이 여의도 안내 문면을 들고 다닌다. 대가로 `LEGEND_KEY` 가 두 벌이다.
 * ⚠ **번호를 매기지 마라** — 9/4 는 `①`~`⑥` 기대 0(§54.16-12). 위치는 범례 문장이 말한다.
 * ⚠ **id 로 스타일을 분기하지 마라** — `confidence`·`tone`·`kind` 로만 분기한다.
 * ⚠ **2단계용 빈 슬롯·플레이스홀더·주석 처리된 코드를 «지금» 만들지 마라 — 이 줄이 그 주소의 전부다:**
 *   대오 확정 시 해당 항목에 `emphasis: true` + pill 면 반전(bg `#093389`/text `#ffffff`),
 *   **도형 스타일·레이아웃·상자 크기는 건드리지 않는다**(디자인 §54.8).
 */

/* ── 1. 어휘 — 확신도 · 색 계열 · 배치 ───────────────────────────── */

/** 좌표 확신도 — **렌더 스타일이 이 값에서만 파생된다.** `calculated` 는 9/4 미사용이지만
 *  남긴다: **등급 어휘가 8/28 과 갈리면 안 된다**(§53-5) */
export type StrikeGeoConfidence = "verified" | "calculated" | "estimated";

/** 색 계열 — **의미색을 늘리지 않는다**(§54.7 신규 색 0).
 *  ⚠ **`estimated` 를 회색으로 바꾸지 마라**(M-2) — 색은 `tone`, 확신도는 선종·`LEGEND_KEY` 가
 *  전담한다. 두 축을 섞으면 「대오(근사)」가 「참고 지물」로 읽힌다 */
export type StrikeMapTone =
  /** 파랑 `#093389` — 조합원이 갈 곳(대오·역) */
  | "go"
  /** 회색 `#4b5563` — 참고 지물(무대·화장실) */
  | "reference";

/** 라벨이 앵커에서 뻗는 방향 */
export type StrikeLabelPlacement = "right" | "left" | "top" | "bottom";

export interface StrikeLatLng {
  lat: number;
  lng: number;
}

export interface StrikeBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** 지도 조작 줌 범위(§54.16-1) — **«사용자 조작 상한»이지 «정밀도 주장 방어»가 아니다** */
export const STRIKE_MAP_MIN_ZOOM = 15;
export const STRIKE_MAP_MAX_ZOOM = 19;

/** 확신도 키 — **8/28 `rallyMap.ts` 의 `LEGEND_KEY` 와 한 글자도 같은 문자열**이다(§53-11 (3)).
 *  ⚠ **어휘를 바꾸려면 두 곳을 함께 고쳐라** — 한쪽만 고치면 두 지도가 점선을 다르게 설명한다.
 *  ★ 자리는 **지도 상자 «위»**(§54.16-1) · **화면 출현 1회**(QA-511 — 2회면 복제한 것이다) */
export const LEGEND_KEY = "점선 = 근사 · 옅은 면 = 범위 근사";

/** 지도 조작 완화 안내 — `touch-action: none` 의 필연적 귀결(§55-1·§55-2 확정 문면).
 *  ⚠ **`※` 를 붙이지 마라** — 이 페이지의 `※` 는 **종류 1 · 출현 2 고정**이다(§53-12 #15).
 *  ⚠ **좌우를 가리키지 마라** — 좌우 여백이 각 12px 이라 엄지가 안 들어간다(§54.16-4).
 *  ⚠ **`+`/`−` 를 넣지 마라**(§5.3). 대신 **확대 버튼을 조건부로 숨기지도 마라** — 완화가 그것에 기댄다.
 *  ★ **이것도 사실 주장이다** — 빈 곳이 44px 미만이면 문장이 아니라 종횡비를 고친다(게시 조건 19) */
export const MAP_GESTURE_NOTE =
  "지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 위나 아래 빈 곳을 쓸어 주세요.";

/** 지도 `sr-only` 안내문 — 검증 §53-11 (1) 축자.
 *  ⚠⚠ **8/28 문면을 복사하면 «거짓»이 된다** — 9/4 에는 그 텍스트 블록이 없다.
 *  텍스트 등가는 **지도 아래 범례 13행**이 진다 */
export const MAP_SR_INTRO =
  "아래는 무대·대오 위치를 표시한 지도입니다. 같은 내용을 지도 아래 범례에서 텍스트로 제공합니다.";

/** 코스콤지부 대오 한 줄 — 검증 §53-9 확정 · M-10 채택 문면.
 *  ★ **자리는 지도 `figure` «안» · 캔버스 «밖»**(§53-15 조건 11). 범례 행 금지 · 지도 밖 본문 금지.
 *  ⚠⚠ **키가 없어 지도 섹션이 사라지면 이 문장도 함께 사라진다 — «의도된 상태»다**(위험과 완화가
 *  같은 조건부 안에 있어야 한다). **«사라지는 버그»로 보고 지도 밖으로 빼지 마라.**
 *  ⚠ 초안 `코스콤지부 대오는 추후 안내합니다.` 는 죽었다(«다섯 번째 대오»). **인용하지 마라.**
 *  ⚠ 2단계에서는 **이 자리에서** 문면이 바뀐다(새 자리를 만들지 않는다) */
export const KOSCOM_COLUMN_NOTE = "코스콤지부가 어느 대오인지는 추후 안내합니다.";

/* ── 2. 좌표 — 값 · 출처 · 확신도 ────────────────────────────────── */

/**
 * 대오 밴드 동서 위치는 **«우리가 옮긴 것»** 이다 — M-9 「C 안」(§53-15 조건 5 필수 기재).
 * 원본 띠가 차도를 벗어난 **계통 오차**(원본 작도 오차 · §53-3)라 그대로 그리면 **인도에 선다** →
 * 폭(약 26 m)은 원본 그대로, **동서만 차도 중심에 맞췄다.**
 *
 * ⚠⚠ **아래 세 값을 «다» 적어 둔다 — 안 적으면 다음 사람이 원본과 대조하다 «틀렸다»고 되돌린다**(M-9).
 *
 * | 대오 | 원본 픽셀(x) | 환산 경도(A · 원본 충실) | **조정 후 경도(C · 채택)** |
 * |------|--------------|--------------------------|----------------------------|
 * | 대오 1 | **415.5 – 486.0** | 126.976712 – 126.977020 | **126.976979 – 126.977279** |
 * | 대오 2 | **419.0 – 489.0** | 126.976727 – 126.977025 | **126.976980 – 126.977278** |
 * | 대오 3 | **420.4 – 492.0** | 126.976733 – 126.977042 | **126.976977 – 126.977281** |
 * | 대오 4 | **423.2 – 497.6** | 126.976745 – 126.977061 | **126.976983 – 126.977275** |
 * | (참고) 차도 실측 | — | 126.976931 – 126.977327 (약 35 m) | — |
 *
 * ⚠ **폭 26 m 를 «치수»로 인용하지 마라**(§53-15 조건 6) — 원본에 치수 표기가 0 이다.
 * ⚠ **«우리가 옮겼다»를 화면 문장으로 만들지 마라**(M-9) — `estimated` 표현이 그 역할을 한다(§5.3).
 * ⚠ 남북(위도)은 **원본 그대로**다. 경계가 지상의 무엇인지는 원본에도 없다 — **실선으로 긋지 마라**(§53-7).
 */
const COLUMN_1_POLYGON = [
  [37.569524, 126.976979],
  [37.569524, 126.977279],
  [37.568477, 126.977279],
  [37.568477, 126.976979],
] as const;

const COLUMN_2_POLYGON = [
  [37.568206, 126.97698],
  [37.568206, 126.977278],
  [37.56768, 126.977278],
  [37.56768, 126.97698],
] as const;

const COLUMN_3_POLYGON = [
  [37.567482, 126.976977],
  [37.567482, 126.977281],
  [37.567045, 126.977281],
  [37.567045, 126.976977],
] as const;

const COLUMN_4_POLYGON = [
  [37.566373, 126.976983],
  [37.566373, 126.977275],
  [37.564874, 126.977275],
  [37.564874, 126.976983],
] as const;

/** 무대 원의 반경(m). 오차 예산 상한이 **±25 m**(§53-6)라 25 면 여유가 0 이라 30 이다.
 *  ⚠⚠ **도트로 찍지 마라**(§53-15 조건 2) — `estimated` 좌표의 도트는 없는 정밀도를 주장한다.
 *  ⚠ **도로 횡단선으로도 긋지 마라**(§54.5-2) — 무대 위도가 대오 띠 북단과 같아
 *  «대오 경계를 실선으로 그리지 마라»(조건 3)를 **시각적으로 위반**한다 */
export const STAGE_RADIUS_M = 30;

/** 무대 4개 — **원본에 무대 «도형»이 없다.** 라벨 상자가 띠보다 넓어 **동서 위치를 말하지 않으므로**
 *  경도는 **C 안 차도 중심 하나**로 통일했다(§53-5) */
const STAGE_LNG = 126.977129;

/** 역 좌표 — **두 역만 `verified` 다**(§54-2 · M-19).
 *  ★ **광화문역은 «두 점»이다** — 원본이 「광화문역」으로 가리킨 지점이 ⑥·⑤ 두 출구다.
 *  **비대칭은 원본이 만든 것이니 대칭으로 맞추지 마라.**
 *  ⚠⚠ **⑥·⑤ 의 산술 중점을 «만들지» 마라**(§54-8 조건 14) — 중점은 세종대로 노면 한가운데이고
 *  진짜 승강장은 233 m 북쪽이라 **두 겹으로 틀린다. 두 점 «사이»에 도형·선도 긋지 마라.**
 *  ⚠ **출구 번호를 안내하지 않는다**(M-11·M-13) — 시청역은 원본에 출구 배지가 없어,
 *  한쪽만 출구를 쓰면 *"시청역은 아무 데나 나와도 되나"* 로 읽힌다 */
const GWANGHWAMUN_EXIT_6: StrikeLatLng = { lat: 37.569796, lng: 126.976615 };
const GWANGHWAMUN_EXIT_5: StrikeLatLng = { lat: 37.569823, lng: 126.977422 };
/** OSM `railway=station`(`ref 132;201`) ↔ 원본 역 점 픽셀 환산이 **1.2 m 일치**(§54-2) */
const CITYHALL_STATION: StrikeLatLng = { lat: 37.56548, lng: 126.977114 };

/* ── 3. 기호 체계 타입 ───────────────────────────────────────────── */

interface StrikeFeatureBase {
  id: string;
  /** 지도 위 이름 pill 본문. **`null` 이면 pill 을 그리지 않는다.**
   *  ★ pill 은 **10개뿐**(대오 4 · 무대 4 · 역 2) — 13개를 전부 띄우면 반드시 겹친다(§54.5-3).
   *  ⚠ **화장실 3의 pill 생략은 «은폐»가 아니다** — 범례 3행이 그대로 있다 */
  label: string | null;
  /** 범례 행 본문 — **§54.16-10 (2) 13행 축자.** 한 글자도 바꾸지 마라 */
  legend: string;
  /** 범례 앞 기호 글리프 — `aria-hidden` 장식 문자. `symbol` 이 있으면 쓰지 않는다 */
  glyph: string;
  /** 종류 픽토그램(화장실) — 있으면 **범례와 지도가 같은 SVG 를 그린다.**
   *  ⚠ **이모지를 쓰지 마라** — 기기마다 다른 그림이 나가고 글꼴이 없으면 두부(□)로 떨어진다 */
  symbol?: "toilet";
  tone: StrikeMapTone;
  placement: StrikeLabelPlacement;
  /** `top`/`bottom` 라벨의 가로 정렬 기준(기본 center) */
  labelAlign?: "west" | "center" | "east";
  /** 앵커에서 라벨까지의 간격(px). 기본 세로 14 / 가로 28. **라벨 충돌을 푸는 자유도** */
  labelGap?: number;
  /** 라벨을 다는 지점을 직접 지정한다. 없으면 `placement` 에서 자동으로 정한다 */
  labelAt?: StrikeLatLng;
}

/** 대오 밴드 — 축정렬 사각 폴리곤.
 *  ⚠ **`confidence` 를 `"estimated"` 로 «타입이» 못박는다 — 승격 근거 0**(§53-6) */
export interface StrikeBandFeature extends StrikeFeatureBase {
  kind: "band";
  polygon: readonly (readonly [number, number])[];
  confidence: "estimated";
}

/** 무대 원 — 좌표가 없어 **범위로만** 아는 것 */
export interface StrikeCircleFeature extends StrikeFeatureBase {
  kind: "circle";
  center: StrikeLatLng;
  radiusMeters: number;
  confidence: "estimated";
}

/** 점 — 확정 좌표 1개인 지점(시청역 · 화장실 3) */
export interface StrikeDotFeature extends StrikeFeatureBase {
  kind: "dot";
  position: StrikeLatLng;
  confidence: StrikeGeoConfidence;
}

/** ★ **점 «여러 개» · 항목 «하나»** — 광화문역 전용(M-20 · §54.16-10 (1)).
 *  구현 조건 15: **범례 1행 · 지도 pill 1개 · 점 2개.** 쪼개면 같은 이름 둘이 구별되지 않고
 *  출구 번호를 안 쓰기로 한 M-13 이 화면에서 깨진다. ⚠ **중점 좌표를 저장하지 마라** */
export interface StrikeDotsFeature extends StrikeFeatureBase {
  kind: "dots";
  points: readonly StrikeLatLng[];
  confidence: StrikeGeoConfidence;
}

export type StrikeMapFeature =
  | StrikeBandFeature
  | StrikeCircleFeature
  | StrikeDotFeature
  | StrikeDotsFeature;

/* ── 4. 지도에 그리는 것 — **이 배열이 지도의 전부다** ──────────────── */

/**
 * 표시 항목 13개 — **배열 순서 = 범례 순서**(§54.16-10 (2)). 범례가 «양 끝이 역으로 닫힌 사슬»이라
 * 중간의 `estimated` 가 **양 끝의 `verified` 좌표에 매달린다.**
 * 여기 없는 것 — **다시 넣지 마라:**
 * - **버스 하차 2곳** — ① 원본에 앵커가 없어 좌표를 못 구한다 ② **코스콤지부는 전세버스를 운행하지
 *   않는다**(1급). ★ ②는 «좌표를 구해도 안 그린다»다 — **하나가 죽어도 판정이 유지되도록 둘 다 적는다.**
 * - **대형버스 주차 · 남산 · 청파** — 미게시(§53-10 · M-13). 기대 개수 **각 0**.
 * - **`서울특별시 본관`·`종로경찰서`·`동화면세점`** — 바탕 지도 POI 다. 범례에 쓰면 우리 저작이 되는데
 *   그 관계 하나는 **검증 불가**다(§53-8 #2).
 * - **`내 위치`** — 우리 좌표가 ±25 m 라 *«내가 대오 3인가 4인가»* 에 답할 수 없다(§53-7). **2단계에서도.**
 */
export const STRIKE_MAP_FEATURES: readonly StrikeMapFeature[] = [
  {
    kind: "circle",
    id: "main-stage",
    label: "메인무대",
    /* 개정본이다 — 「세종대로 북쪽 끝」은 위험하다: **세종대로는 훨씬 북쪽까지 간다**(§54-4 (2)) */
    legend: "메인무대 — 대오 1 북쪽 끝입니다",
    glyph: "○",
    tone: "reference",
    confidence: "estimated",
    center: { lat: 37.569524, lng: STAGE_LNG },
    radiusMeters: STAGE_RADIUS_M,
    placement: "left",
  },
  {
    kind: "band",
    id: "column-1",
    label: "대오 1",
    legend: "대오 1 — 메인무대 남쪽 구간입니다",
    glyph: "▨",
    tone: "go",
    confidence: "estimated",
    polygon: COLUMN_1_POLYGON,
    placement: "right",
  },
  {
    kind: "circle",
    id: "stage-2",
    label: "무대 2",
    legend: "무대 2 — 대오 1 남쪽 끝입니다",
    glyph: "○",
    tone: "reference",
    confidence: "estimated",
    center: { lat: 37.568206, lng: STAGE_LNG },
    radiusMeters: STAGE_RADIUS_M,
    placement: "left",
  },
  {
    kind: "band",
    id: "column-2",
    label: "대오 2",
    legend: "대오 2 — 무대 2 남쪽 구간입니다",
    glyph: "▨",
    tone: "go",
    confidence: "estimated",
    polygon: COLUMN_2_POLYGON,
    placement: "right",
  },
  {
    kind: "circle",
    id: "stage-3",
    label: "무대 3",
    legend: "무대 3 — 대오 2 남쪽 끝입니다",
    glyph: "○",
    tone: "reference",
    confidence: "estimated",
    center: { lat: 37.567482, lng: STAGE_LNG },
    radiusMeters: STAGE_RADIUS_M,
    placement: "left",
  },
  {
    kind: "band",
    id: "column-3",
    label: "대오 3",
    legend: "대오 3 — 무대 3 남쪽 구간입니다",
    glyph: "▨",
    tone: "go",
    confidence: "estimated",
    polygon: COLUMN_3_POLYGON,
    placement: "right",
  },
  {
    kind: "circle",
    id: "stage-4",
    label: "무대 4",
    /* ⚠⚠ **여기에 «끝» 을 넣지 마라**(§53-15 조건 12) — 대오 3 남단 ↔ 무대 4 가 다른 무대보다 멀어
       «바로 남쪽»이라고 말할 수 없다. **한 글자가 사실 주장이다.** */
    legend: "무대 4 — 대오 3 남쪽입니다",
    glyph: "○",
    tone: "reference",
    confidence: "estimated",
    center: { lat: 37.566373, lng: STAGE_LNG },
    radiusMeters: STAGE_RADIUS_M,
    placement: "left",
  },
  {
    kind: "band",
    id: "column-4",
    label: "대오 4",
    /* 개정본이다 — 종전 문면은 신규 13행과 중복이었다(§54-4 (2)) */
    legend: "대오 4 — 무대 4 남쪽 구간입니다",
    glyph: "▨",
    tone: "go",
    confidence: "estimated",
    polygon: COLUMN_4_POLYGON,
    placement: "right",
    /* ★ pill 을 «북단 + 1/5» 에 둔다(§54.16-3) — 중심이면 시청역 pill 과 겹친다. **좌표 주장이 아니다.**
       값 = 북단 37.566373 − (밴드 높이 0.001499 / 5) · 경도는 밴드 동단 */
    labelAt: { lat: 37.5660732, lng: 126.977275 },
  },
  {
    kind: "dot",
    id: "toilet-north",
    label: null,
    legend: "간이화장실 — 대오 1 서쪽입니다",
    glyph: "",
    symbol: "toilet",
    tone: "reference",
    /* 원본 픽토그램 쌍 중심 환산이 **유일한 근거**다 — 임시 시설이라 **승격 경로가 없다**(§53-5) */
    confidence: "estimated",
    position: { lat: 37.569125, lng: 126.976389 },
    placement: "left",
  },
  {
    kind: "dot",
    id: "toilet-south",
    label: null,
    /* ★ **전사본의 «대오 3 서쪽» 은 틀렸다**(§53-14) — 원본 픽셀 실측으로는 «대오 3 남단 남쪽»이고
       경도는 띠 «안»이다. 그대로 옮겼으면 **화장실을 서쪽으로 잘못 안내했다. 되돌리지 마라.** */
    legend: "간이화장실 — 대오 3 남쪽 끝 부근입니다",
    glyph: "",
    symbol: "toilet",
    tone: "reference",
    confidence: "estimated",
    position: { lat: 37.566855, lng: 126.976825 },
    placement: "left",
  },
  {
    kind: "dot",
    id: "cityhall-toilet",
    label: null,
    /* ★★ **개정본이다. 종전 `대오 4 남쪽 끝, 시청역입니다` 는 «거짓»이었다**(§54-4 (2)) —
       이 화장실은 대오 4 거의 한가운데다. **되돌리지 마라.** 위치는 신규 13행(시청역)이 진다 */
    legend: "시청역 화장실 — 시청역 안 화장실입니다",
    glyph: "",
    symbol: "toilet",
    tone: "reference",
    confidence: "estimated",
    /* ⚠⚠ **이 점은 대오 4 밴드 «안»이다 — 동쪽 테두리에서 0.35 m**(§54.16-11 (1)).
       **좌표를 옮겨 풀지 마라.** 배치·층·기호로 푼다(흰 링이 «얹힌 층»을 만든다) */
    position: { lat: 37.565673, lng: 126.977271 },
    placement: "left",
  },
  {
    kind: "dots",
    id: "gwanghwamun",
    label: "광화문역(5호선)",
    /* 「(5호선)」은 원본 근거가 있고(원본이 「⑤ 광화문」으로 노선을 말한다),
       **어느 노선으로 갈지가 조합원 행동을 가른다**(§5.3 통과) */
    legend: "광화문역(5호선) — 메인무대 북쪽입니다",
    glyph: "◉",
    tone: "go",
    confidence: "verified",
    points: [GWANGHWAMUN_EXIT_6, GWANGHWAMUN_EXIT_5],
    /* pill 1개를 두 점 «위» 중앙에 둔다(구현 조건 15). 근거는 `anchorAtExtreme` 주석에 있다 */
    placement: "top",
    labelAlign: "center",
  },
  {
    kind: "dot",
    id: "cityhall",
    label: "시청역(1·2호선)",
    /* ⚠ **`대오 4 남쪽 «끝»입니다` 로 쓰지 마라** — 시청역은 대오 4 **«안»** 이다.
       「구간」인 것이 그 이행이다(§54.16-11 (3) C) */
    legend: "시청역(1·2호선) — 대오 4 남쪽 구간입니다",
    glyph: "◉",
    tone: "go",
    confidence: "verified",
    position: CITYHALL_STATION,
    /* ★ **pill 을 밴드 «밖»에 둔다**(§54.16-11 (3) B) — 이 점이 밴드 한가운데라 얹으면 밴드를 덮는다.
       ⚠ **좌표를 옮겨 풀지 마라** — 그 순간 `verified` 가 `estimated` 가 된다 */
    placement: "right",
    labelGap: 20,
  },
];

/* ── 5. 파생값 — 라벨 앵커 · 초기 범위 (손으로 적지 않는다) ───────────── */

/** 지오데식 상수(위도 1도 ≈ 111,320 m). 반경(m)을 위경도 델타로 환산할 때만 쓴다 */
const LAT_DEGREE_METERS = 111_320;

function circleBounds(center: StrikeLatLng, radiusMeters: number): StrikeBounds {
  const dLat = radiusMeters / LAT_DEGREE_METERS;
  const dLng = radiusMeters / (LAT_DEGREE_METERS * Math.cos((center.lat * Math.PI) / 180));
  return {
    south: center.lat - dLat,
    west: center.lng - dLng,
    north: center.lat + dLat,
    east: center.lng + dLng,
  };
}

/** 꼭짓점들의 **극값**(최남·최서·최북·최동).
 *  ⚠ **도형을 사각형으로 근사하는 용도가 아니다** — 그리기는 항상 원본 좌표로 한다 */
function extremesOf(points: readonly StrikeLatLng[]): StrikeBounds {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

function polygonPoints(polygon: readonly (readonly [number, number])[]): StrikeLatLng[] {
  return polygon.map(([lat, lng]) => ({ lat, lng }));
}

/** 항목이 차지하는 범위 — `fitBounds` 가 이것들의 합집합을 담는다 */
export function featureBounds(feature: StrikeMapFeature): StrikeBounds {
  switch (feature.kind) {
    case "dot":
      return {
        south: feature.position.lat,
        west: feature.position.lng,
        north: feature.position.lat,
        east: feature.position.lng,
      };
    /* ⚠ 두 점이 «각각» bounds 에 들어가는 것은 정상이다. 중점을 만드는 것이 아니다 */
    case "dots":
      return extremesOf(feature.points);
    case "circle":
      return circleBounds(feature.center, feature.radiusMeters);
    case "band":
      return extremesOf(polygonPoints(feature.polygon));
  }
}

/** 라벨 앵커 — **도형의 극점**에서 뽑는다. `top`/`bottom` 은 최북/최남단 바깥이라
 *  **자기 도형을 절대 덮지 않는다.**
 *  ⚠⚠ **`align: "center"` 의 `(b.west + b.east) / 2` 는 «중점 금지»(조건 14) 위반이 아니라 정당한
 *  출현이다** — 나오는 값이 **라벨을 놓을 화면 자리**일 뿐 데이터 저장·도형·범례로 나가지 않는다
 *  (§54.16-10 (1) · `_workspace/04_qa_report.md` 「526 중점 금지」).
 *  ⚠ **두 점 사이에 선·도형을 긋지 않는 것**이 이 판정과 한 쌍이다. 그 금지를 풀지 마라 */
function anchorAtExtreme(
  b: StrikeBounds,
  placement: StrikeLabelPlacement,
  align: "west" | "center" | "east" = "center",
): StrikeLatLng {
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

/** 라벨(pill)을 다는 지점. 명시값(`labelAt`)이 있으면 그것이 이긴다 */
export function featureLabelAnchor(feature: StrikeMapFeature): StrikeLatLng {
  if (feature.labelAt !== undefined) return feature.labelAt;
  if (feature.kind === "dot") return feature.position;
  return anchorAtExtreme(featureBounds(feature), feature.placement, feature.labelAlign);
}

/** 점 배지를 찍을 좌표들 — `dots` 만 2개이고 나머지 점은 1개다 */
export function featurePoints(feature: StrikeMapFeature): readonly StrikeLatLng[] {
  if (feature.kind === "dot") return [feature.position];
  if (feature.kind === "dots") return feature.points;
  return [];
}

/** 라벨 기본 간격(px) — 세로/가로. 항목이 `labelGap` 을 주면 그것이 이긴다 */
const DEFAULT_LABEL_GAP_VERTICAL = 14;
const DEFAULT_LABEL_GAP_HORIZONTAL = 28;

export function labelGapOf(feature: StrikeMapFeature): number {
  if (feature.labelGap !== undefined) return feature.labelGap;
  return feature.placement === "top" || feature.placement === "bottom"
    ? DEFAULT_LABEL_GAP_VERTICAL
    : DEFAULT_LABEL_GAP_HORIZONTAL;
}

/** 초기 화면 범위 — `STRIKE_MAP_FEATURES` 에서 **자동 계산**. ⚠ **하드코딩 중심·줌 금지**(§54.4-3).
 *  항목이 0건이면 `Infinity` 가 나가 지도가 깨지므로 시청역 주변 300 m 로 떨어뜨린다 —
 *  **죽은 분기가 아니다**: 교체 작업 중 항목을 잠시 주석 처리하는 일이 실제로 생긴다 */
export const STRIKE_MAP_FIT_BOUNDS: StrikeBounds =
  STRIKE_MAP_FEATURES.length === 0
    ? circleBounds(CITYHALL_STATION, 300)
    : STRIKE_MAP_FEATURES.map(featureBounds).reduce((acc, b) => ({
        south: Math.min(acc.south, b.south),
        west: Math.min(acc.west, b.west),
        north: Math.max(acc.north, b.north),
        east: Math.max(acc.east, b.east),
      }));
