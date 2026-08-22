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
/**
 * 라벨 최대 폭 = 지도 폭의 **70%**(§30.4.5). CSS 변수로 내려 리사이즈 시 마커 재생성 없이 갱신한다.
 *
 * 0.60 → 0.70. 0.60 은 지금은 사라진 라벨을 기준으로 잡은 **바닥값이지 상한 근거가 아니었다.**
 * 320px 뷰포트에서 `0.60 × 288 = 172.8px` 라 **2줄로 깨지고 pill 높이가 34 → 약 47px 로 늘어
 * 하단 여백 계산이 무너진다.** 0.70 이면 320px 에서 201.6px, 폴더블 280px 에서도 173.6px 다.
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
 * 초기 화면 여백(px) — **§30.3 재유도**. 종전 `{48, 24, 48, 56}`(총 가로 80).
 *
 * **각 변의 값은 그 방향으로 가장 멀리 나가는 라벨에서 나온다:**
 *   top 52    ② pill 이 bbox 북단(② 원 최북점) 위로 뻗는 양 — `labelGap 14 + pill 34 + 여백 4`
 *   bottom 76 ④ pill 이 bbox 남단 아래로 뻗는 양 + **지도 크롬** — `14 + 34 + 4 + 축척 바·네이버 로고 24`
 *   left 32   **③ pill 이 서쪽으로 가장 멀리 나간다** — bbox 서단 밖 26.9px + 4 (① 배지는 11.8px 뿐)
 *   right 20  ⑤ 배지(`top`·중앙 정렬)가 bbox 동단 밖으로 나가는 반폭 — `14 + 4` (+2 여유)
 *
 * **왜 지금 패딩을 고치는가**: 지물 집합이 교체되면서 **구속 축이 세로 → 가로로 뒤집혔다**
 * (W/H 0.769 → 1.104 — ⑤ 화장실이 옛 ⑥ 보다 동쪽으로 119.8m 더 나간다). 가로는 **종횡비의 소관이 아니므로**
 * 손댈 지렛대가 패딩뿐이다(§30.1.3). 총 가로 패딩 **80 → 52**, 이 28px 이 곧
 * **뷰포트 하한을 329px → 300px 로 내린 값**이다.
 *
 * ⚠ *"QA 가 패딩 축소를 기각했다"* 는 이번에 적용되지 않는다 — 그 기각(§20.23.2)은
 *   **세로 축의 산술**이었고 지금 구속 축은 가로다.
 * ⚠ **`left 32` 는 ③ 이 `left` 배치인 것에 종속된다.** ③ 방향을 바꾸면 여기부터 다시 유도하라.
 * ⚠ **① 을 `always`(pill)로 되돌리면 left 를 재유도해야 한다** — `5번 출구` pill 은 97.7px 라
 *   bbox 서단 밖으로 81.5px 나가고 32 로는 못 담는다(§30.4.1 이 ① 을 배지로 둔 이유이기도 하다).
 */
const FIT_PADDING = { top: 52, right: 20, bottom: 76, left: 32 } as const;

/**
 * **초기 화면(`fitBounds`)의 줌 상한**(§30.2.1 · 2026-08-21 재유도).
 *
 * ⚠ **사용자 조작 상한(`MAP_MAX_ZOOM` = 19)과 다른 값이다. 합치지 마라** —
 * 이것은 *처음 보여 주는 화면*의 상한이고, 그것은 *확대 버튼으로 갈 수 있는 끝*이다.
 * 합치면 조합원이 지도를 확대할 수 없게 되고 §21.1.1 의 `minZoom 15 / maxZoom 19` 계약이 깨진다.
 * (이 상한이 16 이어도 `확대` 는 100→50→30→**20m(z19)**, `축소` 는 **300m(z15)** 까지 그대로다.)
 *
 * ★ **이 값을 지우지 마라. 도입 당시의 증상은 사라졌지만 필요는 남았다.**
 *
 * - **도입 근거였던 현상은 소멸했다**: 종전 주석은 *"⑤ 더샵 부지 제거로 bbox 남쪽 앵커가 사라져
 *   1280px 에서 z17(50m)이 걸린다"* 였다. 지물 집합이 5개로 늘어 **bbox 가 넓어졌고**,
 *   페이지 안 지도는 박스 폭이 **896px 로 상한**이라 z17 이 요구하는 세로 519px 를
 *   `16/9`(504px)가 **영영 만족하지 못한다** → 페이지 안에서는 z17 이 원천적으로 안 걸린다.
 * - **그러나 전체 화면 지도 모달(3단계-B)은 박스가 더 커서 걸린다**(1280×700 에서 z17 성립).
 *   §27.18 로 모달 렌더가 꺼져 있는 지금도 **값을 지우면 되살리는 순간 즉시 결함이 된다.**
 *
 * ⚠ **`FIT_MIN_ZOOM` 은 없다.** z15(300m)로 떨어지는 것을 막는 장치가 **코드에 없고**,
 *   현행 지물 집합에서 z16 이 유지되는 것은 **"성질"이지 계약이 아니다.**
 *
 *   **측정된 사실**(QA 30회차 · 이분 탐색 · `FIT_PADDING {52,20,76,32}` 기준):
 *     뷰포트 **308px → 300m** / **312px → 100m**
 *
 *   ★ **지물을 추가·이동하거나 `FIT_PADDING` 을 바꾸면 이 이분 탐색을 다시 돌려라.**
 *     **"여유 ○m" 같은 환산값을 믿지 마라 — 세 번 계산해 세 번 다 관측 경계와 어긋났다.**
 *     (환산이 `FIT_PADDING` 을 사이에 두고 비선형이다.)
 */
const FIT_MAX_ZOOM = 16;

/**
 * **3단계-B 렌더 스위치** — **복원됨**(§31 · QA-260 판정 · 2026-08-21).
 *
 * 3단계는 A(즉시 배포) / B(대기)로 쪼개져 있었고, **B 를 막던 것이 QA-260**(*"전체 화면 모달 안에 범례가 없다"*)이었다.
 * **§31.2 가 판정했다: 모달에는 `LEGEND_KEY` 한 줄만 넣는다. 범례 5행은 넣지 않는다.**
 *
 * **왜 키 줄만인가** — 팝업 본문이 `feature.legend` **파생**이라(요구 88·97) **5행 전부 팝업으로 도달 가능**한데,
 * **`LEGEND_KEY` 만 소유 feature 가 없어 어느 팝업에도 나오지 않는 고아 문자열**이다.
 * 그것이 없으면 **④ 옅은 면이 "근사"를 뜻한다는 문자**와 **⑤ 점선 도트가 ① 꽉 찬 도트와 다르다는 문자**가
 * 모달 화면에 하나도 없어 **§2(색·형태 단독 의미 전달 금지) 위반**이 성립한다.
 *
 * **§0.4 은폐가 아니다**: 은폐는 *"콘텐츠에 도달할 경로가 없는 것"* 인데, 모든 행이 팝업으로 도달 가능하고
 * 그 경로를 하단 바의 어포던스 문구가 지시한다. **기본 상태가 `hidden` 인 구조가 아니다.**
 *
 * ⚠ **`false` 로 되돌릴 일이 생기면** 함께 되돌릴 것: 컨트롤 행이 4개 → 3개가 되고(§31.6),
 * 문안 게이트 55·56·74 가 무효가 된다.
 *
 * 타입을 `boolean` 으로 명시한 것은 그대로 둔다 — 리터럴로 좁히면 반대쪽 분기가 "도달 불가"로 보인다.
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
  /*
   * ★ **§30.6 개정 (2026-08-21) — 종전 `fill .08 / stroke 0 / casing false` 는 은폐였다.**
   *
   * `fillOpacity 0.08` 의 `#093389` 를 지도 타일 위에 합성해 **밴드 안쪽 ↔ 바로 옆 타일** 대비를 재면
   * **1.15 : 1**(도로 흰색 기준)이다. 폭 17.6px 짜리 띠에 그 대비면 **육안으로 없는 것과 같다.**
   * 지금까지 문제가 안 된 것은 그 밴드가 **가지 않는 남의 자리**였기 때문이고,
   * **이제는 조합원 본인이 서는 자리다** → **§0.4 은폐**에 해당한다.
   *
   * **면만으로는 3 : 1 을 못 만든다.** α 를 0.53 까지 올려야 3 : 1 인데(계산), 그 값은
   * `verified`(0.20)보다 진해져 **위계가 뒤집히고 범례 키 줄의 `옅은 면 = 범위 근사` 가 거짓이 된다.**
   * → **면은 보조 채널이고, WCAG 1.4.11(비텍스트 3 : 1)은 테두리가 진다**(`#093389` ↔ 인접 타일 8.77~11.37 : 1).
   *
   * **테두리를 없앴던 근거가 소멸한 것이 이 개정의 핵심이다.** 원 주석은
   * *"`estimated` 에 테두리를 주지 않는 것이 **두 밴드 사이 경계선 금지**(요구 26)의 구조적 해결"* 이었는데,
   * 그 근거는 **밴드가 2개 나란히 있을 때만** 성립한다. 요구 149·161·167 이 *"3구역만 그린다"* 로 확정했으므로
   * **지도 위 밴드는 영구히 1개**이고 경계선이 생길 상대가 없다.
   * ⚠ **밴드가 다시 2개 이상이 되면 이 판정으로 돌아와라.**
   *
   * ⚠ **`fillOpacity` 를 0.08 로 되돌리지 마라(은폐). 0.20 이상으로 올리지도 마라** —
   *   그 순간 `verified` 와 같아져 확신도 3단 위계가 화면에서 무너진다.
   */
  estimated: {
    fillOpacity: 0.14,
    strokeOpacity: 1,
    /*
     * `shortdot` — 점선은 지도학에서 **경계가 불확정임을 뜻하는 관습**이고 이 밴드가 정확히 그것이다(±20~30m).
     * `verified`(solid) · `calculated`(shortdash) 와 **패턴으로 구분되므로 확신도 3단이 유지된다.**
     */
    strokeStyle: "shortdot",
    strokeWeight: 3,
    /*
     * **`" (범위는 근사)"` 를 되살리지 마라**(§22.0-2 · 검증 7회차 승인 · 요구 156).
     * 접미어가 붙으면 라벨이 길어져 pill 이 인접 도형과 겹치고, 확신도는 이미 **4개 채널**이 진다:
     * 그중 **2개가 문자다** — §2 색·형태 단독 의존 금지가 이미 충족돼 있다.
     */
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
  /**
   * 키보드 그룹의 **현재 항목**인가(§27.8.1 roving tabindex).
   * 그룹 안에서 `tabindex="0"` 은 **하나뿐**이어야 페이지 탭 정지점이 1개로 유지된다.
   */
  focused: boolean;
  /**
   * **번호 배지를 앵커 위에 정확히 얹는다**(2026-08-22 · `kind: "dot"` 전용).
   * 근거는 `labelIconContent` 의 dot 분기 주석에 있다.
   */
  anchored?: boolean;
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
    focused,
    anchored = false,
  } = options;
  /*
   * 마커는 이제 **포커스 가능한 버튼**이다(§27.8.2). 2단계의 `aria-hidden` 은 **해제됐다** —
   * `aria-hidden` 을 유지한 채 포커스만 열면 **WCAG 2.4.3·4.1.2 반려선을 즉시 위반**한다.
   * **둘은 반드시 한 쌍으로 간다.**
   * `aria-label` 은 **`{번호} {이름}`** 으로 짧게 — 설명은 팝업이 진다. 길게 쓰면 그룹을 순회할 때
   * **범례 전문이 6번 반복**된다(§27.8.3).
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
    /*
     * ★ **`anchored` 는 배지를 앵커 정중앙에 얹는다**(2026-08-22 · 사용자 지시
     * *"실제 위치와 번호버튼 위치를 일치시켜버리자. 영역이 아니라 점이니까"*).
     *
     * 위 문단의 *"앵커 위에 얹지 마라"* 는 **면(밴드·외곽선)을 가진 항목의 규칙**이고
     * **점에는 적용되지 않는다.** 그 금지의 근거 셋 중 둘은 이미 사라졌다:
     *   `대오 2 밴드 외곽선 6.7%` · `부지 외곽선 12%` → **두 도형 다 제거됐다**(§20.4.0 · 요구 130)
     * 남은 하나 *"자기 도트까지 가렸다"* 는 **점에서는 결함이 아니라 목적**이다 —
     * 배지가 도트를 **대체**하므로 가릴 도트가 없다.
     *
     * ⚠ **확신도(실선/점선)를 배지가 이어받는다**(§30.7.2 를 지키는 방식이 바뀐 것이지
     * 규칙이 사라진 게 아니다). 점선 도트를 없애면서 신호를 같이 없애면
     * **① 확인 지점과 ⑤⑥⑦⑧ 근사 지점이 지도 위에서 완전히 똑같아진다.**
     *   `solid`  → 흰 테두리 **실선**(① 5번 출구 — 확인된 위치)
     *   `dashed` → 흰 테두리 **점선**(⑤⑥⑦⑧ 화장실 — 지도 데이터 기준 근사)
     * 크기는 28px 그대로다 — 링을 밖에 덧대면 시각 크기가 커져 히트 간섭이 늘어난다.
     */
    const badgeBorder = outline === "dashed" ? "2px dashed #ffffff" : "2px solid #ffffff";
    const anchorPlace = anchored ? "left:0;top:0;transform:translate(-50%,-50%);" : place;
    return [
      `<div data-rally-label="${id}" data-rally-folded="1" style="position:relative;width:0;height:0;">`,
      `<span data-rally-hit="${id}" ${a11y} style="position:absolute;${anchorPlace}width:28px;height:28px;cursor:pointer;">`,
      `<span style="position:absolute;left:-8px;top:-8px;width:44px;height:44px;"></span>`,
      `<span data-rally-badge="${id}" data-rally-number="${id}" style="position:absolute;inset:0;box-sizing:border-box;`,
      `border-radius:9999px;background:${badgeColor};border:${badgeBorder};color:#ffffff;`,
      `font-size:15px;font-weight:700;line-height:24px;text-align:center;${ring}`,
      `box-shadow:0 1px 3px rgb(0 0 0 / .35)${selected ? `,0 0 0 3px ${INK}` : ""};">${badge}</span>`,
      `</span></div>`,
    ].join("");
  }
  return [
    `<div data-rally-label="${id}" style="position:relative;width:0;height:0;">`,
    /* pill 도 눌리면 팝업이 열린다(§25.2 겹2 · §25.3.1). 조합원이 가장 먼저 보는 것이 pill 이고,
       눌러 본 경험이 ①③⑤⑥ 배지로 **전이**된다. ②④ 만 안 눌리면 마커가 두 종류로 갈린다.
       **pill 히트는 실제 크기 그대로다** — 44px 로 늘리면 ⑤ 배지 히트와 5px 겹친다(§25.8.1). */
    `<div data-rally-pill="${id}" data-rally-hit="${id}" ${a11y} style="position:absolute;${place}box-sizing:border-box;display:flex;align-items:center;gap:6px;cursor:pointer;`,
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
 * ⚠ **`dotHtml`·`dashedDotHtml` 은 제거됐다**(2026-08-22). **되살리지 마라 — 먼저 판정을 뒤집어라.**
 *
 * 점(`dot`)은 이제 **번호 배지 자체가 그 지점**이다(사용자 지시 — *"실제 위치와 번호버튼 위치를
 * 일치시켜버리자. 영역이 아니라 점이니까"*). 도트를 따로 찍으면 **한 지점에 표식이 둘**이 되고,
 * 그것이 화장실 4개를 8개처럼 보이게 만들던 원인이다.
 *
 * **없어진 것은 그림이지 규칙이 아니다.** 두 함수가 지던 **확신도 축(§30.7.2 · 요구 152)** 은
 * `labelHtml` 의 `badgeBorder` 가 그대로 이어받았다 — `solid` → 흰 실선 테두리(확인),
 * `dashed` → 흰 **점선** 테두리(근사). 이 분기를 지우면 **① 확인 지점과 ⑤⑥⑦⑧ 근사 지점이
 * 지도 위에서 완전히 똑같아진다.**
 *
 * 도트 그림이 다시 필요해지면 git 이력에 있다(둘레 62.83px 에 `3 + 3.28` 주기로 점 10개를
 * 균등 배치하던 계산도 함께 있다 — 그 숫자는 임의로 고르면 이음매에서 점선이 깨진다).
 */

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

/**
 * 선택된 항목의 **헤일로**(강조 층) — 도형 *아래*에 깔리는 별도 오버레이다(2026-08-21).
 *
 * ★ **도형 자신의 스타일을 바꾸지 않는 이유.** 밴드·원의 선굵기·채움·선종은 `confidence` 에서만
 * 파생된다(§20.20.3). 선택했다고 그 값을 흔들면 **"확신도가 올라갔다"로 읽힌다** —
 * 이 지도에서 굵기와 채움은 장식이 아니라 **뜻을 가진 축**이다.
 * 헤일로는 별개 층이라 두 축이 섞이지 않고, 선택을 풀면 원래 도형이 **손대지 않은 채** 남는다.
 *
 * **새 색을 만들지 않는다**(§2 3종 상한). 항목 자신의 `tone` 색을 그대로 쓰고 구분은
 * **굵기·불투명도**가 진다. 그리고 헤일로는 **항상 팝업과 함께** 뜨므로 색·형태만으로
 * 뜻을 전달하지 않는다(§2 — 의미는 팝업의 문자가 진다).
 *
 * **점·핀은 헤일로를 만들지 않는다.** 라벨 마커가 선택 시 이미 3px `INK` 링을 두르고(`labelIconContent`),
 * 미터 반경 원은 줌에 따라 크기가 뒤집혀 **축소하면 도트보다 작아진다.**
 * ⚠ 여기서 `zIndex` 를 casing 위로 올리지 마라 — 헤일로가 흰 casing 을 덮으면
 * **어두운 타일에서 도형 경계 대비를 만드는 두 겹 구조가 무너진다**(§20.4.2).
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
  /*
   * ★ **점(`dot`)은 도형을 따로 그리지 않는다 — 번호 배지가 곧 그 지점이다**(2026-08-22).
   *
   * 종전에는 도트를 앵커에 찍고 배지를 **26px 떨어뜨려** 놓았다. 면(밴드·원)에서는 그것이 옳다 —
   * 배지가 도형을 덮으면 안 되니까. 그런데 **점에는 덮을 면이 없고**, 떨어뜨린 배지는
   * *"이 번호가 정확히 어디를 가리키나"* 를 모호하게 만든다(사용자 지적).
   * 게다가 도트와 배지가 **한 지점에 두 표식**이라 화장실 4개가 8개처럼 보였다.
   *
   * ⚠ **`pin`(내 위치)은 그대로 둔다.** 앵커가 **핀 끝(하단 꼭짓점)** 이라 성질이 다르고,
   * 번호가 없는 동적 표식이라 배지로 대체할 것도 없다(§20.21.1).
   * ⚠ **`dotHtml`·`dashedDotHtml` 을 지우지 마라** — 확신도 도트를 되살릴 때 근거가 사라진다.
   */
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
     * 적층(§34 · §22.10 **2-C 신설** · 2026-08-21).
     *
     * **번호가 없는 라벨 = 사용자 표식(`내 위치`)** 은 **안내도 라벨 전체보다 아래**에 둔다.
     * 실측 결함: 3구역 북서단에서 `내 위치` pill 이 **⑤ 배지를 59.8% 덮고 중심 탭을 가로채
     * 팝업이 열리지 않았다**(무대3 옆에서도 34.8%). **막힌 것이 시각이 아니라 조작이다.**
     *
     * **손해의 종류가 다르다**: 시각 가림은 조합원이 지도를 움직여 스스로 해소하지만,
     * **히트 가로채기는 해소할 수 없다** — *"눌렀는데 안 열린다"* 이고 원인을 알 방법이 없다.
     * 누르는 것은 §25.2 어포던스 문구가 **약속한 동작**이라, 가로채는 순간 **그 문안이 거짓이 된다.**
     * → **2-C: 히트 영역 가로채기 0. 양보 불가.**
     *
     * ⚠ **`id === "my-location"` 로 분기하지 마라**(§20.20.2 와 같은 계열).
     * 판정의 실제 기준은 *"번호가 없는 것 = 안내도 지물이 아닌 사용자 표식"* 이므로
     * **`numbered === false` 로 분기한다** — 그래야 다음 사용자 표식이 생겨도 규칙이 따라온다.
     *
     * ⚠ **999 는 도형 z(10~50)보다 여전히 위다 — 핀이 밴드·원에 가리지 않는다. 이것이 유지돼야 한다.**
     *   더 내리지 마라(회귀 항목 387: *"핀이 도형 뒤로 사라지면 z 를 너무 낮춘 것"*).
     * ⚠ **핀과 pill 은 같은 마커다**(`labelIconContent` 가 `shape + labelHtml` 을 함께 만든다) →
     *   **핀도 함께 내려간다. 허용한 것이다** — 가려지는 최대 면적이 배지 28px 하나이고
     *   핀(24×32)·pill(58.9×34)이 그보다 크다.
     * ⚠ **`MY_LOCATION_Z`(도형 z)와 다른 축이다. 그것을 건드리지 마라.**
     *
     * **아무것도 옮기지 않는다 — 누가 위인가만 바꾼다.** 배치 규칙(§32)은 그대로다.
     */
    zIndex: feature.numbered === false ? LABEL_Z_BASE - 1 : LABEL_Z_BASE + index,
  });
}

/**
 * 키보드 그룹의 **진입 첫 지점**(§27.8.1).
 *
 * 종전에는 ④ 코스콤지부(대오 2)였다. **그 지점이 제거되면서**(검증 12회차 — 구역 근거 무효)
 * **① 국회의사당역 5번 출구**로 옮겼다. 구역이 확인되지 않은 지금 조합원이 **확실히 가야 하는 곳**은
 * 내리는 역이고, 그것이 남은 지점 중 유일한 "행동의 시작점"이다.
 * 구역 좌표가 확정돼 지점이 돌아오면 **진입 지점도 그쪽으로 되돌리는 것을 검토하라.**
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
 *
 * **모듈 함수인 이유**: 전체 화면 지도가 같은 규칙을 써야 하는데 **두 벌이면 한쪽만 고쳐진다**
 * (§27.14.4-3 이 키보드에 대해 못박은 것과 같은 위험). 상태는 인자로 받는다.
 */
function paintLabels(ctx: LabelPaintContext, currentZoom: number): void {
  const { labels: entries, folded, selectedId, focusedId, node } = ctx;
  if (entries.length === 0) return;

  /*
   * 텍스트 pill 노출 = **`textMode === "always"` 인 항목만**(§25.1).
   * `popup` 항목은 **줌이 올라가도 텍스트를 띄우지 않는다** — 이름은 클릭 팝업이 진다.
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
    /*
     * 아이콘 교체는 DOM 을 갈아치우므로 **포커스가 날아간다** — 키보드 사용자가 그 순간 길을 잃는다.
     * 그려진 직후 현재 항목에 포커스를 되돌린다(§27.8.1 roving tabindex 유지).
     *
     * ⚠ **이미 그룹 안에 포커스가 있을 때만** 되돌린다. 조건 없이 부르면 모달이 열릴 때
     * `닫기` 로 보내 둔 초기 포커스를 지도가 **빼앗는다**(실측으로 잡았다).
     */
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
      /*
       * **히스테리시스**(§21.9.3): 접는 기준과 펴는 기준이 다르다.
       * 지금 펼쳐진 라벨은 **실제로 교차할 때만** 접고(여백 0), 이미 접힌 라벨은 **8px 이상**
       * 떨어져야 다시 편다. 한 값으로 양방향을 판정하면 경계에서 **라벨이 깜빡인다.**
       */
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
 * `내 위치` 라벨의 **박스 경계 x 클램프**(§30.16.3-1 · §30.17.1 — **필수**).
 *
 * **왜 필요한가**: `my-location` 은 `placement: "right"` 라 **동쪽으로 라벨을 뻗는데
 * 3구역이 지도의 동쪽 끝에 있다.** 8/28 당일 조합원이 **자기 자리에 서서 `내 위치 표시` 를 누르면**
 * pill 이 박스 밖으로 나간다(360px·z16 실측 계산: 3구역 남동단에서 **박스 밖 13.9px**).
 * **가장 흔한 상황에서 잘린다.**
 *
 * **고정 방향으로는 못 푼다** — 4방향 전부 계산했고 두 시나리오(5번 출구 / 3구역 안)를
 * 동시에 만족하는 방향이 없다: `left` 는 ① 배지와 겹치고, `top` 은 자기 핀과,
 * `bottom` 은 ④ pill·② 원과 겹친다.
 *
 * ⚠ **스펙 숫자로 계산하지 마라 — 이 pill 만 모델과 어긋난다.**
 * §30.16.3·§30.17.3 은 `내 위치` pill 폭을 **58.9px** 로 잡았는데 **실측 68.5px**(**모델 대비 +9.6px**)다.
 * 그래서 3구역 남동단 이탈도 스펙 예측 13.9px 이 아니라 **실측 23.5px** 이다(판정·방향은 같다).
 * 원인으로 보이는 것: **`내 위치` 는 내용이 런타임에 정해지는 유일한 라벨**이라
 * (상태 문구의 `약 ±{n}m` 처럼 가변분이 붙는다) 모델이 그 폭을 못 잡았다.
 * 고정 라벨 ①~⑤ 는 §30.17.3 모델과 **±4px 안**이다 — **어긋나는 것은 이것 하나다.**
 *
 * ⚠ **§21.9.4 가 기각한 "동적 배치"가 아니다.** 그것은 *팬·줌마다 최적 위치를 탐색*하는 것이고,
 * 이것은 **§22.10 2-A(박스 밖 잘림 0)를 지키는 결정적 클램프**다 — 입력이 같으면 출력이 같아
 * **실측으로 검증할 수 있다.**
 *
 * ⚠ **적용 대상은 `my-location` 하나뿐이다.** 지도에서 **좌표가 런타임에 정해지는 유일한 항목**이고,
 * 나머지(①~⑤)는 스펙이 계산으로 자리를 확정했다. **고정 항목에 걸지 마라.**
 *
 * ⚠ **y 는 건드리지 않는다** — 핀과의 수직 관계(`transform: translateY(-50%)`)가 깨진다.
 * 그래서 `transform` 이 아니라 **`margin-left`** 로 민다.
 *
 * **남는 겹침은 허용한다**(§30.16.3-2): 클램프해도 ⑤ 배지·④ pill 과 겹칠 수 있는데,
 * **`내 위치` 는 사용자가 방금 만든 일시적 표식이라 겹칠 때 위에 온다.**
 * **안내도 라벨을 `내 위치` 때문에 옮기지 마라** — 누르지 않은 조합원 전원이 비용을 낸다.
 * 가려지는 ⑤ 배지·④ pill 은 **범례가 같은 내용을 문자로 갖고 있어** §0.4 은폐가 아니다.
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

/**
 * 모달 배경 스크롤 잠금(§23.1.5). `showModal()` 과 **별도로** 잠근다 — 브라우저마다 처리가 달라
 * 가정할 수 없다. 잠글 때의 `scrollY` 를 돌려주고, 푸는 쪽이 그 값을 그대로 복원한다.
 */
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
 * 잠금 해제 + 위치 복원. **세 가지가 모두 필요하다 — 하나만 빠져도 어긋난다(실측):**
 * ① **레이아웃 강제 반영** — `position:fixed` 를 막 푼 시점에는 문서 높이가 뷰포트 높이라
 *    `scrollTo` 가 **0 으로 잘린다** ② **`behavior:"instant"`** — 이 사이트는
 *    `html { scroll-behavior: smooth }` 라 기본값이면 브라우저 자체 복원과 경합해 어긋난다(3355 → 3247)
 * ③ 호출부의 **`focus({ preventScroll: true })`** — 기본 `focus()` 는 대상을 보이려고 스크롤을 옮긴다(818px 이탈).
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
 * 지점 팝업 — **박스 안 고정 패널**(§25.4~§25.6). 페이지 지도와 전체 화면 지도가 **이 한 벌을 공유한다.**
 *
 * 가로는 박스에 고정(좌우 16px · `max-width:480px`)이고 세로만 마커 반대편에 붙는다 —
 * **좌우 잘림이 계산이 아니라 구조로 0**이고, 드래그로 지도가 아무리 움직여도 팝업은 흔들리지 않는다.
 *
 * 3단계에서 `aria-hidden` 을 **해제**했다(§27.8.2): 팝업은 **열렸을 때만 렌더**되므로 낭독되는 것은
 * **사용자가 연 것에 대한 응답**이지 중복이 아니다. `닫기` 의 `tabIndex={-1}` 도 함께 제거했다 —
 * **둘 중 하나만 바꾸면 `aria-hidden` 안에 포커스 가능 요소가 생겨 즉시 반려선 위반**이 된다.
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

  /*
   * 열리면 **팝업으로 포커스를 옮긴다**(§27.8.2). 닫을 때 마커로 되돌리는 것은 호출부가 한다.
   *
   * 이유: 팝업은 **사용자가 연 것에 대한 응답**이라 스크린리더가 그 자리에서 읽어야 하고,
   * 옮기지 않으면 포커스가 `body` 로 떨어져 **Tab 이 페이지 처음부터 순회**한다
   * (마커 아이콘이 다시 그려지며 방금 포커스한 노드가 사라지기 때문이다).
   * `tabIndex={-1}` 은 **프로그램 포커스만** 허용한다 — 탭 정지점은 늘지 않는다.
   * 의존성이 `feature.id` 인 이유: 다른 지점으로 **교체**될 때도 새 내용으로 다시 읽혀야 한다.
   */
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
      {/* 본문은 **범례에서 파생**한다. 별도 문자열 상수를 만들지 마라 —
          따로 두면 언젠가 한쪽만 고쳐진다(요구 88) */}
      <p className="mt-1.5 break-keep break-words text-caption leading-[1.55] text-ink">
        {feature.legend}
      </p>
      {/*
        ★ **로드뷰 진입점이 여기다**(사용자 지시 2026-08-21).
        종전에는 컨트롤 행에 `로드뷰 보기` 버튼 하나가 있었고 **위치가 5번 출구로 고정**이었다 —
        어느 지점의 로드뷰인지 고를 수 없었다. 이제 **각 지점 팝업이 자기 로드뷰를 연다.**

        ⚠ **`닫기` 보다 앞에 둔다.** 팝업을 연 다음 행동이 "더 보기"이고 `닫기` 는 마지막이다.
        ⚠ **`onRoadview` 가 `null` 이면 렌더하지 않는다** — 파노라마 모듈이 없을 때
        누르면 아무 일도 안 하는 버튼을 두지 않는다(§0.4 인접 — 죽은 어포던스).
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

/** 지도 안 컨트롤 공통 — **반투명 금지**(지도 배경이 매 프레임 바뀌어 대비를 보장할 수 없다, §27.4.2) */
/** 지도 안 버튼의 **공통 외형** — 크기는 포함하지 않는다(아이콘 버튼과 글자 버튼의 폭이 다르다) */
/**
 * 팝업 안 버튼 — `CONTROL_CLASS` 의 **좁은 면 판**(사용자 지시 2026-08-22 *"팝업이 불필요하게 너무 커"*).
 *
 * 지도 위 팝업은 폭이 박스에 묶여 있어 컨트롤 행과 예산이 다르다. 줄인 것은 **글자(18→15px)와
 * 좌우 여백(px-5→px-4)** 뿐이다.
 * ⚠ **`min-h-touch`(44px)를 줄이지 마라** — 터치 대상 하한이고, 팝업 버튼은 장갑 낀 손으로
 * 야외에서 눌린다. 더 작아 보이게 하려면 **높이가 아니라 글자·여백**을 건드려라.
 */
const POPUP_BUTTON_CLASS =
  "ease-out-soft inline-flex min-h-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-primary bg-bg px-4 text-caption font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

const MAP_BUTTON_BASE =
  "flex items-center justify-center border-2 border-border-strong bg-bg text-primary disabled:text-ink-muted";
/** 아이콘 1글자 버튼(`+`·`−`·`↺`) — 정사각 44px */
const MAP_BUTTON_CLASS = `${MAP_BUTTON_BASE} size-11`;

/**
 * 지도 안 **거리뷰 토글**(사용자 지시 2026-08-21 · 디지털온누리 가이드 선례).
 *
 * `+`/`−` **아래**에 둔다 — 확대·축소는 지도를 보는 조작이고 이것은 **모드를 바꾸는** 조작이라
 * 성격이 다르다. 같은 열에 두되 카드를 나눠 그 차이를 표면으로 드러낸다.
 *
 * **켜진 상태를 색으로만 말하지 않는다**(§2) — `aria-pressed` 와 라벨이 함께 진다.
 *
 * ★ **로빙 그룹(`itemProps`)에 넣지 마라 — 넣었다가 키보드 도달 불가가 됐다**(2026-08-22 정정).
 * `itemProps` 는 `tabIndex: focusedId === id ? 0 : -1` 을 주는데, `focusedId` 는
 * **`keyboardOrder()` 가 내놓는 값만** 되고 그 목록에는 `+`/`−` 와 **지점 id 뿐**이라
 * 이 버튼은 **영원히 `tabIndex={-1}`** 이었다. 지금은 평범한 탭 정지점이다.
 * 로빙에 넣으려면 `keyboardOrder()` 와 `focusItem()` 의 DOM 조회 분기(`rally-zoom` 접두사)를
 * **함께** 고쳐야 한다 — 한쪽만 고치면 같은 결함이 되돌아온다.
 */
function MapStreetToggle({
  on,
  onToggle,
  buttonRef,
}: {
  on: boolean;
  onToggle: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <div className="rounded-card shadow-card absolute right-3 top-28 z-10 overflow-hidden">
      <button
        type="button"
        ref={buttonRef}
        aria-pressed={on}
        aria-label={on ? "거리뷰 모드 끄기" : "거리뷰 모드 켜기"}
        onClick={onToggle}
        /*
         * ⚠ **`MAP_BUTTON_CLASS`(정사각 `size-11`)를 쓰지 마라** — 2026-08-21 실측 결함.
         * 폭이 44px 로 못박혀 테두리·패딩을 뺀 **가용 폭이 24px** 이 되고,
         * 13px `거리뷰`(약 39px)가 **`거리`/`뷰` 두 줄로 깨진다.**
         * 높이 44px(터치 타깃)는 `h-11` 이 지키고, 폭은 글자가 정한다(`min-w-11` 이 하한).
         * `whitespace-nowrap` 은 폰트가 바뀌어도 줄바꿈이 재발하지 않게 하는 보험이다.
         */
        className={`${MAP_BUTTON_BASE} ${
          on ? "bg-primary text-white" : ""
        } h-11 min-w-11 whitespace-nowrap px-3 text-[13px] font-bold`}
      >
        거리뷰
      </button>
    </div>
  );
}

/**
 * 지도 안 확대·축소(§27.4).
 *
 * §21.1.3 은 *"컨트롤은 전부 지도 밖"* 이었고 그 유일한 근거는 **"지도 안 포커스 정지점이 생긴다"** 였다.
 * §26.3.1 이 §20.9 를 개정해 **정지점을 개수가 아니라 구조로** 규율하면서 그 근거가 사라졌다 —
 * `+/−` 는 마커와 함께 **`role="group"` 하나 뒤**에 들어가므로 정지점이 늘지 않는다(§27.8).
 *
 * **`+`·`−` 를 텍스트 문자로 쓰지 마라**(§16.12.3 선례) — 서체마다 위치·크기가 튄다. SVG 다.
 * 자리는 **우측 상단**이다: 우측 하단은 축척 바·네이버 로고·⑥ 배지가 이미 쓰고 있어
 * §22.10 **2-B(지도 크롬 가림 0%)** 가 즉시 깨진다.
 */
function MapZoomButtons({
  zoom,
  onZoom,
  itemProps,
  topOffset = "top-3",
}: {
  zoom: number | null;
  onZoom: (delta: number) => void;
  itemProps?: (id: string) => { id: string; tabIndex: number };
  /**
   * 지도 영역 안 세로 위치. **현재 두 호출부 모두 기본값(`top-3`)을 쓴다.**
   *
   * ⚠ 종전 주석은 *"전체 화면에서는 `닫기` 버튼 아래로 내린다"* 였고 모달이 `top-20` 을 넘겼는데,
   * §31.4 로 **`닫기` 가 지도 밖 상단 바로 나가면서** 피할 대상이 사라졌다.
   * **인자가 지금은 쓰이지 않는다** — 지우지 않은 이유는 지도 영역 안에 다른 오버레이가 생기면
   * 다시 필요해지기 때문이고, 지운다면 그것은 별도 정리 작업이다.
   */
  topOffset?: string;
}) {
  return (
    <div className={`rounded-card shadow-card absolute right-3 z-10 overflow-hidden ${topOffset}`}>
      <button
        type="button"
        aria-label="확대"
        onClick={() => onZoom(1)}
        disabled={zoom !== null && zoom >= MAP_MAX_ZOOM}
        className={MAP_BUTTON_CLASS}
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
        onClick={() => onZoom(-1)}
        disabled={zoom !== null && zoom <= MAP_MIN_ZOOM}
        className={`${MAP_BUTTON_CLASS} -mt-0.5`}
        {...itemProps?.("rally-zoom-out")}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
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
 * 대비: 보더·글자 11.37 / hover 면 10.45 / 비활성 보더 4.83(UI) · 글자 7.56 (§21.7 실측).
 * `px-5` 는 폭 검산(360px 2행)의 전제다 — 넓히면 3행이 된다.
 */
const CONTROL_CLASS =
  "ease-out-soft inline-flex min-h-touch shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-2 border-primary bg-bg px-5 text-body font-semibold text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:border-border-strong disabled:text-ink-muted";

/** 등급 순위 — 겹쳤을 때 **낮은 쪽을 접는다**(§21.2.3) */
const PRIORITY_RANK: Record<LabelPriority, number> = { primary: 0, secondary: 1, tertiary: 2 };

/**
 * 겹침 판정 여백(px) — **0 이다. 즉 실제로 교차할 때만 접는다.**
 *
 * ⚠ **주석 갱신 2026-08-21(QA-347).** 종전 근거였던 *"현행 z16 라벨 간격이 1px"* 은
 * **`column-2`·`dsharp` 등 지금 없는 지물의 실측값**이었다. 지물 집합이 교체돼 **그 수치는 죽었다.**
 * 인용하지 마라.
 *
 * **값이 0 인 이유는 그대로다** — §21.2.3 의 `8px` 예산은 **라벨 배치가 여유로울 때만** 쓸 수 있다.
 * 8px 를 임계로 쓰면 **처음 보는 화면에서 낮은 등급이 즉시 배지로 접혀 §21.8-107 을 위반**할 수 있고,
 * 라벨 배치는 도형 가림 0% 를 맞추느라 픽셀 단위로 확정된 것이라 여백을 벌리려면 그 결과를 다시 흔들어야 한다.
 *
 * **현행 집합(①②③④⑤)에서는 여유가 실제로 있다** — z16 라벨 쌍 간 최소 **41.5px**(①↔③, §30.17.3).
 * **그래도 임계값만 올리지 마라**: 지금 접힘을 만드는 것은 z15 의 **실교차**이고,
 * 임계를 8 로 올리면 **z16 에서 접히는 라벨이 생기는지를 전 뷰포트에서 다시 실측해야 한다.**
 * 지금 값으로 §21.8-108 이 성립한다 — z15 에서는 지물 간 화면 거리가 절반이 되어 실제로 교차한다.
 */
const LABEL_MIN_GAP = 0;

/** `내 위치` 라벨을 박스 안으로 밀어 넣을 때 남기는 여백(px) — §22.10 2-A 의 박스 여백 하한과 같은 값 */
const MY_LOCATION_CLAMP_INSET = 4;

/**
 * 로드뷰 + 거리뷰 모드의 **상태·부수효과 한 벌**(2026-08-22 추출).
 *
 * ★ **훅으로 뽑은 이유**: 전체 화면 지도에도 같은 기능이 필요해졌는데(사용자 지시
 * *"전체화면 지도에서도 팝업에 로드뷰 버튼 넣어줘"*), **두 벌로 복제하면 한쪽만 고쳐진다** —
 * `paintLabels` 를 모듈 함수로 둔 것과 **같은 이유이고 같은 처방**이다(§27.14.4-3).
 *
 * ★ **인스턴스는 지도마다 하나다.** 상태를 위로 끌어올려 공유하지 않는다:
 * 두 지도는 **별개의 네이버 인스턴스**라 `StreetLayer`·클릭 리스너·현재위치 마커가
 * 각자의 지도에 붙어야 하고, 공유 상태로 만들면 **뒤에 가려진 지도에 파란 길이 깔린다.**
 *
 * `active` = **이 지도가 지금 앞에 있는가.** 거짓이 되면 로드뷰를 정리한다 —
 * 페이지 지도 위에 전체 화면 모달이 뜨면 페이지 쪽 시트는 모달 뒤에 깔려
 * **닫을 수도 볼 수도 없는 유령**이 되기 때문이다.
 */
function useRoadview(mapRef: React.RefObject<NaverMap | null>, active: boolean) {
  /**
   * 열린 로드뷰의 **지점**. `null` 이면 시트가 없다.
   *
   * ★ **종전 `roadviewOpen: boolean` 에서 바뀌었다.** 그때는 위치가 `EXIT5` 로 **고정**이라
   * 어느 지점의 로드뷰인지 고를 수 없었다. 이제 **지점 팝업이 자기 좌표를 넘긴다.**
   * `label` 은 시트 제목에 붙는다 — 어느 지점을 보고 있는지가 화면에 남아야 한다.
   */
  const [roadviewAt, setRoadviewAt] = useState<{
    lat: number;
    lng: number;
    label: string | null;
  } | null>(null);
  /**
   * 거리뷰 모드 — 지도에 **파란 길(`StreetLayer`)** 을 깔고 **클릭으로 위치를 옮길 수 있는** 상태.
   * 로드뷰 시트와 **독립이다**: 모드만 켜고 아직 아무 지점도 안 열 수 있다(지도 안 토글 버튼).
   */
  const [streetMode, setStreetMode] = useState(false);
  /** 파노라마 촬영 연월 — 메타에 있을 때만 표시한다(없으면 빈 문자열. 없는 것을 지어내지 않는다) */
  const [panoDate, setPanoDate] = useState("");
  /** 지도 위 **현재 보는 위치** 마커의 좌표·시선 방향(파노라마와 양방향 동기) */
  const [spotAt, setSpotAt] = useState<{ lat: number; lng: number } | null>(null);
  const [spotPan, setSpotPan] = useState(0);
  const [panoStatus, setPanoStatus] = useState<"idle" | "loading" | "failed">("idle");

  const panoMountRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<NaverPanorama | null>(null);
  /**
   * 거리뷰 토글 — 시트를 닫을 때 포커스를 여기로 되돌린다.
   * ★ **`dialogRef`·`scrollLockRef` 는 제거됐다**(2026-08-21) — 로드뷰가 `<dialog showModal()>`
   * 에서 **비모달 하단 시트**로 바뀌면서 배경 `inert`·스크롤 잠금이 둘 다 사라졌다.
   * 되살리려면 그 판정(§21.3 재판정 — 지도를 눌러야 위치를 옮긴다)부터 뒤집어야 한다.
   */
  const roadviewButtonRef = useRef<HTMLButtonElement | null>(null);

  /**
   * 지점 하나의 로드뷰를 연다. **거리뷰 모드도 함께 켠다** — 열자마자 파란 길이 보여야
   * "여기 말고 저기"가 가능하다.
   * ⚠ **팝업 닫기는 호출부가 한다** — 팝업 상태는 지도마다 따로라 훅이 알 수 없다.
   */
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

  /**
   * 시트를 닫는다. **거리뷰 모드는 함께 끈다** — 파란 길만 남으면 눌러도 열 것이 없다.
   * 종전에는 `<dialog>` 를 닫는 일이었는데, **시트는 모달이 아니다**(지도를 눌러야 하므로).
   */
  const closeRoadview = useCallback(() => {
    setRoadviewAt(null);
    setSpotAt(null);
    setStreetMode(false);
    setPanoDate("");
    setPanoStatus("idle");
    roadviewButtonRef.current?.focus({ preventScroll: true });
  }, []);

  /*
   * 이 지도가 뒤로 물러나면 로드뷰를 **정리한다**(포커스는 건드리지 않는다 — 앞으로 나온
   * 쪽이 자기 초기 포커스를 잡는 중이라 여기서 가로채면 그것을 빼앗는다).
   */
  useEffect(() => {
    if (!active) return;
    /* **정리 함수로 쓴다** — 이펙트 본문에서 곧바로 setState 하면 활성 상태에서도 매번 돌아
       불필요한 렌더를 만들고 린트(`set-state-in-effect`)에도 걸린다.
       정리 함수는 **앞→뒤로 물러나는 그 순간에만** 한 번 돈다. */
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
   *
   * ★ **`<dialog showModal()>` 을 쓰지 않는다**(2026-08-21). 그것은 배경을 `inert` 로 만드는데,
   * **이 시트가 열려 있는 동안 조합원은 뒤의 지도를 눌러 로드뷰 위치를 옮겨야 한다.**
   * 모달로 열면 그 조작이 원천 차단된다 — 기능과 표준 동작이 충돌하므로 표준을 포기한다.
   * 대신 `Esc`·포커스 복귀·`aria-modal={false}` 를 직접 지고, **배경 스크롤도 잠그지 않는다**
   * (잠그면 지도까지 못 움직인다).
   *
   * ★ **`preventDefault()` 를 빼지 마라**(2026-08-22). 전체 화면 지도에서는 이 시트가
   * `<dialog showModal()>` **안에** 있어서, 막지 않으면 브라우저의 닫기 요청이 그대로 진행돼
   * **`Esc` 한 번에 시트와 모달이 같이 닫힌다.** 조합원은 로드뷰만 닫으려 한 것이다.
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

  /*
   * 파노라마 인스턴스는 **시트가 열려 있는 동안만** 존재한다(§21.3.1 자동 로드 금지 유지).
   *
   * ★ **위치가 `roadviewAt` 에서 온다**(2026-08-21). 종전에는 `EXIT5` 고정이었다.
   * 파노라마는 준 좌표에서 **가장 가까운 실제 촬영점**을 스스로 찾으므로 정밀할 필요가 없다.
   *
   * ★ **`pov.pan` 을 고정하지 않는다.** 종전 `130`(의사당대로 남동쪽)은 5번 출구 전용 값이라
   * 다른 지점에서는 엉뚱한 방향을 본다. **네이버 기본값에 맡긴다** — 촬영 진행 방향을 보여준다.
   *
   * 실패하면 **시트를 닫지 않고** 안내 문구를 남긴다 — 종전에는 닫아 버려서 조합원이
   * *"눌렀는데 아무 일도 안 났다"* 로 읽었다. **파란 길을 눌러 근처 지점을 고를 수 있다**는
   * 것을 알려야 하고, 그러려면 시트가 열려 있어야 한다.
   */
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
      /* `flightSpot` 은 하늘로 날아가는 이동 지점 — 좁은 시트에서 오탭이 잦아 끈다 */
      flightSpot: false,
      minScale: 0,
      maxScale: 4,
    });
    panoRef.current = pano;

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
        const p = pano.getPosition?.();
        if (p) setSpotAt({ lat: p.lat(), lng: p.lng() });
      }),
      /* 시선을 돌리면 지도 마커의 시야 콘도 같이 돈다 */
      pano.addListener("pov_changed", () => {
        const pov = pano.getPov?.();
        if (pov) setSpotPan(pov.pan ?? 0);
      }),
    ];
    /* 파노라마가 없는 지점은 이벤트를 하나도 주지 않는 경우가 있어 시한을 함께 건다 */
    const timer = window.setTimeout(() => {
      if (pano.getPanoId() === null) setPanoStatus("failed");
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      for (const l of listeners) maps.Event.removeListener(l);
      pano.destroy();
      panoRef.current = null;
    };
    /* `roadviewAt` 이 바뀌면 파노라마를 새로 만든다 — 지점이 바뀌었다는 뜻이다 */
  }, [roadviewAt]);

  /*
   * ★ **거리뷰 모드** — 지도에 **파란 길**을 깔고 **클릭으로 로드뷰 위치를 옮긴다**
   * (사용자 지시 2026-08-21 · 디지털온누리 가이드의 검증된 흐름을 그대로 따른다).
   *
   * 세 가지가 한 벌로 움직인다:
   *   `StreetLayer`  촬영된 도로를 파랗게 — **어디를 누를 수 있는지**를 보여준다
   *   지도 클릭      파노라마가 있으면 `setPosition`(가장 가까운 촬영점을 스스로 찾는다),
   *                  없으면 그 자리에서 새로 연다
   *   현재 위치 마커  주황 원 + 시야 콘. **파노라마와 양방향** — 걸어가면 따라오고, 돌아보면 콘이 돈다
   *
   * ⚠ **`StreetLayer` 는 지도 클릭을 가로채지 않는다**(타일 오버레이라 히트 대상이 아니다) —
   * 2-C(마커 히트 가로채기 0)에 저촉되지 않는다. 다만 **모드가 켜져 있으면 지도 클릭이
   * 로드뷰 이동으로 해석**되므로, 마커 팝업을 열려면 모드를 꺼야 한다. 그것이 이 모드의 계약이다.
   *
   * ⚠ **`mapReady` 를 의존성에서 빼지 마라**(2026-08-22). 전체 화면 지도는 모달이 열릴 때
   * **비로소 인스턴스가 생기므로**, `streetMode` 만 보면 지도가 아직 `null` 인 시점에 한 번 돌고
   * 끝나서 **파란 길이 영영 안 깔린다.** 페이지 지도에서는 이미 준비돼 있어 드러나지 않는다.
   */
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
      icon: {
        content:
          `<div style="width:44px;height:44px;position:relative;transform:rotate(${spotPan}deg)">` +
          `<div style="position:absolute;left:50%;bottom:50%;transform:translateX(-50%);width:0;height:0;` +
          `border-left:15px solid transparent;border-right:15px solid transparent;` +
          `border-top:22px solid rgba(242,107,29,.38)"></div>` +
          `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);` +
          `width:18px;height:18px;border-radius:9999px;background:#f26b1d;border:3px solid #fff;` +
          `box-shadow:0 0 0 2px #f26b1d,0 2px 8px rgba(20,22,26,.45)"></div></div>`,
        anchor: new maps.Point(22, 22),
      },
    });

    return () => {
      marker.setMap(null);
    };
  }, [mapRef, spotAt, spotPan, streetMode, active]);

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

/**
 * ★ **로드뷰 하단 시트**(사용자 지시 2026-08-21 — *"네이버지도의 로드뷰처럼 부분 팝업 형태"*).
 * 디지털온누리 가이드의 검증된 형태를 그대로 따른다.
 *
 * ★★ **`<dialog showModal()>` 을 쓰지 않는다.** 그것은 배경을 `inert` 로 만드는데,
 * **이 시트가 열려 있는 동안 조합원은 뒤의 지도를 눌러 로드뷰 위치를 옮겨야 한다.**
 *
 * **화면을 덮지 않는다**: 뷰포트 하단 고정 · 파노라마 높이 `32dvh` ·
 * 위에 지도가 보인 채로 **파란 길을 다시 누를 수 있어야** 이동이 성립한다.
 * 높이를 키우지 마라 — 지도가 가려지면 이 기능의 전제가 무너진다.
 *
 * ★ **컴포넌트로 뽑았다**(2026-08-22). 전체 화면 지도는 이 시트를 **`<dialog>` 안에** 렌더해야 한다 —
 * `showModal()` 은 top layer 라 바깥의 `fixed z-40` 은 **모달 뒤로 숨는다.**
 * 두 벌로 복제하지 않고 자리만 바꿔 끼운다(`useRoadview` 와 같은 이유).
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
  return (
    <div
      role="dialog"
      aria-label={at.label !== null ? `${at.label} 로드뷰` : "로드뷰"}
      /*
       * ★ **`z-40` 에서 올렸다 — 이게 사용자가 본 "글자 겹침"의 원인이었다**(2026-08-22 실측).
       * 네이버 지도가 만드는 `.map_copyright`(`© NAVER Corp.`)와 축척·로고는 **`z-index: 100`** 이라
       * `z-40` 시트 **위에** 그려져 안내문과 글자가 포개졌다.
       *
       * ⚠ **`pointer-events: none` 이라 `elementFromPoint` 로는 안 잡힌다.** 이 겹침은
       * **기하(사각형 교차)로만** 검출된다 — 히트 테스트로 "겹침 0"을 확인하고 넘어가면 놓친다.
       * (실제로 한 번 그렇게 잘못 판정했다.)
       *
       * 값은 네이버 컨트롤(100)보다 확실히 위인 300. **40 으로 되돌리지 마라.**
       * 저작권 표기는 사라지지 않는다 — 시트 안 파노라마가 자기 로고·저작권을 직접 그린다.
       */
      className="rounded-t-panel fixed inset-x-0 bottom-0 z-[300] border-t-2 border-border-strong bg-bg shadow-hero"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/*
        헤더 **2단 구성**(2026-08-22 · 사용자 지적 *"모바일에서 텍스트 배치가 보기 좋지 않다"*).

        ★ **종전에는 제목·촬영일·`닫기` 가 한 행에서 서로를 밀었다.** 390px 실측:
        셋 다 `flex-shrink:1` · `word-break:normal` 이라 **전부 2줄로 깨졌다** —
        `로드뷰 — 2호 개나리 화장`/`실` · `촬영`/`2025.04` · `닫`/`기`.
        헤더가 89px 로 부풀어 시트가 뷰포트 **54%**(설계 48%)를 먹었다.

        **고친 방식**: 세로로 쌓을 것(제목 + 촬영일)과 옆에 고정할 것(`닫기`)을 나눈다.
        - 제목: `min-w-0` + **`break-keep`**(어절 유지 — 이것이 없어서 낱말 중간이 잘렸다)
        - 촬영일: 제목 **아래 줄**로 내린다. 같은 행에 두면 셋이 폭을 다툰다
        - `닫기`: **`×` 아이콘 44px**. 글자 `닫기` 는 `text-body`(18px 하한) + `px-5` 라
          좁은 헤더에서 가장 큰 폭 소비자였다. 사용자가 제시한 온누리 화면도 `×` 다.
          **`aria-label` 이 뜻을 진다**(§2 — 형태만으로 전달하지 않는다).
      */}
      <div className="flex items-start gap-3 px-4 py-3">
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
          className="ease-out-soft flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-bg text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
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

      {/* 로드뷰는 스크린리더에 무의미하다 — 텍스트 등가를 만들 수 없다(§21.3.2).
          **로드뷰에만 있는 정보를 만들지 마라** */}
      <p className="sr-only">
        로드뷰는 시각 자료입니다. 위치 안내는 페이지 본문 텍스트를 참고해 주세요.
      </p>

      {/* ★ **`overflow-hidden` 을 빼지 마라**(2026-08-22 실측). 없으면 네이버 파노라마가
          내부에 그리는 큐브 면·로고·저작권·축척이 박스 밖으로 **1150px 넘게 삐져나와**
          아래 안내문 위에 겹쳐 찍힌다(첨부 화면에서 `©NAVER Corp`·`100m` 가 문장 위에 있었다). */}
      <div className="relative h-[32dvh] overflow-hidden bg-surface">
        {/* `touch-action` 을 건드리지 않는다 — 여기서는 한 손가락 회전이 설계된 동작이다(§23.1.3) */}
        <div ref={mountRef} className="size-full" />
        {panoStatus === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center bg-surface text-body font-semibold text-ink">
            로드뷰를 불러오는 중입니다.
          </p>
        ) : null}
        {panoStatus === "failed" ? (
          /* ★ **시트를 닫지 마라.** 종전에는 실패 시 모달을 닫아 버려서 조합원이
             *"눌렀는데 아무 일도 안 났다"* 로 읽었다. **다음에 할 일을 알려야 한다** */
          <p className="absolute inset-0 flex items-center justify-center break-keep bg-surface px-6 text-center text-body text-ink">
            이 지점 주변에는 로드뷰가 없습니다. 지도의 파란 길을 눌러 근처 촬영 지점을 골라 주세요.
          </p>
        ) : null}
      </div>

      {/*
        ★ **둘째 문장을 지웠다**(§5.3 · 2026-08-22). 종전 *"로드뷰 안에서는 드래그로 둘러보고,
        화살표로 길을 따라 걸을 수 있습니다"* 는 **로드뷰의 보편 조작**이고 화살표는 화면에 보인다 —
        판정 기준(*"이 문장이 없으면 조합원이 다르게 행동하는가"*)에 걸리지 않는다.
        390px 실측 **4줄 → 2줄**.

        ⚠ **첫 문장은 지우지 마라.** 지도를 눌러 위치를 옮기는 것은 **화면에 단서가 없어
        발견 자체가 불가능**하다. 파란 길이 무엇인지도 여기서만 말한다.
      */}
      <p className="break-keep px-4 py-3 text-caption leading-[1.6] text-ink">
        지도의 <b>파란 길</b>을 누르면 그 지점 로드뷰로 이동합니다(주황 원 = 지금 보는 위치).
      </p>
    </div>
  );
}


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
  /** 스크립트에 파노라마 모듈이 없으면 **버튼을 아예 렌더하지 않는다**(죽은 버튼 금지, §21.3.2) */
  const [panoSupported, setPanoSupported] = useState(false);
  /**
   * 열린 팝업(§25.4~§25.7). **기본은 전부 닫힘** — 자동 열림을 두지 마라(§25.2.2):
   * 초기 뷰가 바뀌고 지도 절반이 덮인 채 시작한다. 로드뷰의 "기본 상태는 항상 지도"와 같은 규칙이다.
   */
  const [selected, setSelected] = useState<{ id: string; index: number } | null>(null);
  /** 팝업을 박스 위·아래 중 어디에 붙일지(§25.5). **가로는 계산하지 않는다 — 박스에 고정이다** */
  const [popupSide, setPopupSide] = useState<"top" | "bottom">("bottom");
  /** 키보드 그룹의 현재 항목(렌더용 — `+`/`−` 버튼의 `tabIndex` 가 이 값을 쓴다) */
  const [focusedId, setFocusedId] = useState<string>(KEYBOARD_ENTRY_ID);
  /**
   * 전체 화면 지도(§27.6). **기본은 항상 닫힘** — 새로고침·재방문에서 열린 채 시작하지 않는다.
   * 페이지 안에서도 드래그가 되므로 이 모드가 파는 값은 **크기**와 **탈출구**다(§27.14.1).
   */
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  /** 지도 조작 그룹 안에 포커스가 있는가 — 범례 행 강조에 쓴다(§27.8.4) */
  const [groupFocused, setGroupFocused] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  /** 지도 박스 — 팝업 자리 계산과 키보드 이벤트 위임의 기준 */
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** `지도 크게 보기` — 모달을 닫을 때 포커스를 여기로 되돌린다 */
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);

  /*
   * 로드뷰·거리뷰 한 벌(`useRoadview`). **`active` 는 `!fullscreenOpen`** —
   * 전체 화면 모달이 뜨면 이 시트는 모달 뒤에 깔려 **닫을 수도 볼 수도 없는 유령**이 되므로
   * 물러날 때 스스로 정리한다. 모달 쪽은 자기 인스턴스를 따로 갖는다.
   */
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
   * **페이지 탭 정지점이 1개**로 유지된다. 진입 첫 지점은 **④ 코스콤지부** — 조합원이 이 페이지에 온 이유다.
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

    /*
     * 조작 계약(§27.13.6 — **§21.1.1 을 개정한다**).
     *
     * ⚠ **원칙이 여기서 예외를 갖는다.** §21.1.0 은 *"한 손가락은 언제나 페이지 스크롤이다. 예외 없음"* 이었고,
     * 지금은 **"한 손가락은 페이지 스크롤이다. 단 지도 위는 사용자 결정으로 예외다"** 다.
     *
     * **왜 이렇게 위험한 것을 했는가 — 다음 사람에게 남긴다:**
     * 리더가 위험을 명시적으로 고지했다("지도 위에서 페이지를 못 내리는 사고가 발생하고 회피 수단이 없다").
     * 그 상태에서 사용자(지부 담당자)가 **"원래 지도처럼"** 조작되기를 택했다.
     * **위험은 해소되지 않았다. 감수된 것이다**(§27.13.1). 몰라서 한 결정이 아니다 —
     * 360×640 에서 지도가 엄지 영역의 **99.7%** 를 차지한다는 실측까지 나온 상태의 결정이다.
     *
     * **완화는 물리적 여백이 아니라 안내 문구가 진다**(§27.13.2 — "지도 상하 24px 여백"은 실측으로 기각됐다.
     * 좌우 여백 16px 은 엄지가 들어가지 않고, 지도가 하단에 붙으면 아래 여백은 화면 밖이다).
     * 그래서 `※ 지도는 손가락 하나로…` 를 **지도 박스 바로 위**에 상시 둔다(§27.15.1 · QA-247).
     * **지도 아래가 아니다** — 지도가 화면을 덮을수록 아래에 있는 것은 화면 밖으로 나가,
     * 위험이 최대인 순간에 완화가 0이 된다. **완화 수단은 이 문구 하나뿐이다**(§27.16.3 (A)).
     * `지도 크게 보기` 는 **"조작 공간이 좁다"에 대한 대응이지 이 위험의 완화가 아니고**(§27.16.3 (B)),
     * 지금은 **3단계-B 로 미뤄져 렌더되지 않는다**(§27.18 · `STAGE3B_FULLSCREEN_MAP`).
     *
     * **되돌리는 법**(§27.13.6): `draggable` 을 `(pointer: fine)` 분기로 되돌리고 `touch-action` 을 `pan-y` 로.
     * ⚠ 종전 주석은 *"전체 화면 모드가 남아 있으므로 되돌려도 조작 수단이 0이 되지 않는다"* 였으나,
     * **3단계-B 가 빠진 지금 그 근거는 성립하지 않는다** — 되돌리면 모바일 조작 수단은 지도 안 `+`/`−` 만 남는다.
     * **발동 조건은 §27.13.8** — *"페이지가 안 내려간다"* 가 1건이라도 접수되면 리더에게 즉시 보고한다.
     *
     * 유지되는 것: `scrollWheel: false` + **Ctrl/⌘ + 휠만** 확대(맨 휠은 페이지 스크롤 — **이것까지 뺏지 마라**),
     * `disableDoubleTapZoom`(오탭 확대 금지), `keyboardShortcuts: false`(키보드는 §27.8 그룹이 담당).
     */
    const map = new maps.Map(node, {
      mapTypeId: maps.MapTypeId.NORMAL,
      draggable: true,
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

  /**
   * 키보드 그룹(§27.8 — **§26.1.4 부채 상환**).
   *
   * 지도 안 조작(`+`·`−` + 지점 6개 = 8개)을 **탭 정지점 1개** 뒤에 모은다:
   * 그룹 안에서 `tabindex="0"` 은 **현재 항목 하나뿐**이고 나머지는 `-1` 이다(roving tabindex).
   * 페이지 전체로 보면 컨트롤 행이 5→4로 줄고 그룹이 +1 이라 **정지점 순증 0**이다.
   *
   * **`role="application"` 을 쓰지 마라** — 스크린리더의 브라우즈 모드를 꺼서 범례 낭독이 망가진다.
   */
  const focusItem = useCallback(
    (id: string) => {
      focusedRef.current = id;
      setFocusedId(id);
      /*
       * ⚠ **순서가 이 함수의 전부다**(QA 22회차 실패 1 · 2026-08-21).
       * 종전에는 `focus()` 를 먼저 부르고 `applyLabelVisibility()` 를 나중에 불렀는데,
       * 그 안의 `paint()` 가 **마커 아이콘을 통째로 다시 그려 방금 포커스한 DOM 노드를 없앤다.**
       * 그러면 포커스가 `body` 로 떨어져 **방향키로 다음 지점에 갈 수 없다.**
       * `paint()` 의 복원 가드는 `activeElement` 가 그룹 안인지 보는데 **그때는 이미 `body`** 라 안 걸린다.
       *
       * → **다시 그린 뒤에 그 결과 노드를 조회해 포커스한다.**
       * (rAF 겹침 판정으로 한 번 더 그려질 수 있는데, 그때는 포커스가 마커에 있으므로
       *  `paint()` 의 복원 가드가 정상 작동한다 — 두 장치가 한 쌍이다.)
       * **`focus()` 를 위로 올리지 마라.**
       */
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
       **범례 행을 `<button>` 으로 만들지 마라**: 텍스트 등가가 범례에 의존하는 구조가 흔들리고
       정지점도 늘어난다. 시각 강조만 준다 — 키보드+시각 사용자에게 비용 0으로 가치를 준다. */
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

  /*
   * `Esc` 로 닫는다. **`document` 레벨**이라 팝업에 포커스가 없어도 동작한다.
   *
   * ⚠ **근거 교체**(§31.7 · 2026-08-21). 종전 근거는 *"팝업은 `aria-hidden` 이고 포커스 가능 요소를
   * 두지 않기 때문"* 이었는데 **3단계에서 그 둘이 다 해제됐다** — 팝업의 `aria-hidden` 이 풀렸고
   * 마커가 포커스 가능해졌다(§27.8.2). **거짓 근거를 믿고 팝업 구조를 바꾸면 판단이 어긋난다.**
   *
   * **새 근거**: **팝업 안에 포커스 트랩이 없고 포커스가 마커에 남아 있으므로 `document` 레벨이 옳다.**
   * 팝업에 포커스를 옮겨도(§27.8.2) 사용자가 그 뒤 다른 곳을 클릭하면 포커스가 팝업 밖으로 나가는데,
   * 그때도 `Esc` 가 동작해야 한다. **패널에만 핸들러를 걸지 마라.**
   */
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

  /*
   * **선택된 항목의 도형을 강조한다**(2026-08-21 · 요구 "지도 위의 배너나 번호를 누를 때
   * 해당 구역이 하이라이트되게").
   *
   * 종전에는 선택이 **라벨 배지의 링**만 바꿨다 — 배지는 도형 밖에 떠 있어서
   * *"④ 를 눌렀는데 어느 띠가 ④ 인지"* 가 여전히 안 보였다. 헤일로가 그 연결을 만든다.
   *
   * **매번 새로 만들고 지운다**(도형을 미리 저장해 두고 `setOptions` 로 토글하지 않는다):
   * 선택은 한 번에 **하나뿐**이라 살아 있는 오버레이가 0개 아니면 1개이고,
   * 그래야 언마운트·재생성 경로에서 **떠도는 참조가 남지 않는다.**
   * ⚠ 정리 함수에서 `setMap(null)` 을 빠뜨리지 마라 — 네이버 오버레이는 지도에서 직접 떼야 사라진다.
   * ⚠ 점·핀은 `createHighlight` 가 빈 배열을 준다(근거는 그 주석). **여기서 특례를 만들지 마라.**
   */
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
    /*
     * `내 위치` 라벨 클램프는 **지도가 멈출 때마다 다시 계산해야 한다**(§30.16.3-1).
     * 핀은 지도 좌표에 고정돼 팬·줌마다 화면 위치가 바뀌므로, 한 번만 걸면
     * **드래그한 뒤 라벨이 엉뚱하게 밀려 있거나 다시 잘린다.**
     * `idle` 이 팬·줌·리사이즈를 모두 덮는다. 마커가 없으면 함수가 즉시 반환한다.
     */
    const onIdle = () => {
      clampMyLocationLabel(mountRef.current, boxRef.current);
      /*
       * ★ **라벨 접힘을 여기서 다시 계산한다**(2026-08-22 · 사용자 지적
       * *"특정 맵 줌 상태에서 ④ 라벨이 ③ 을 가려버릴 때가 있어"*).
       *
       * **원인**: 종전에는 접힘 판정이 `zoom_changed` 에서만 돌았다. 그런데 그 이벤트는
       * **줌 애니메이션이 시작될 때** 오고, `paintLabels` 는 그 직후 `requestAnimationFrame`
       * 한 번에서 사각형을 잰다 — **라벨이 아직 목적지에 도착하기 전**이다.
       * 그래서 *"안 겹친다"* 로 판정하고 **다시 재지 않아** 애니메이션이 끝난 뒤 겹친 채로 남았다.
       * 매번 재현되지 않은 것도 이것으로 설명된다(애니메이션 타이밍에 좌우된다).
       *
       * `idle` 은 **팬·줌·리사이즈가 모두 끝난 뒤** 온다 — 바로 위 클램프가 `idle` 을 쓰는 것과
       * 같은 이유다. 팬만 했을 때는 라벨들이 **함께** 움직여 상대 기하가 그대로이므로
       * 접힘 상태가 바뀌지 않고(`changed === false`), 아이콘 한 번 다시 그리는 비용만 든다.
       * ⚠ **`zoom_changed` 쪽을 지우지 마라** — 줌 중에도 등급별 표시/숨김은 즉시 따라와야 한다.
       */
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
   * 팝업의 `로드뷰 보기` — **팝업을 함께 닫는다.** 시트가 열리면 팝업은 역할이 끝났고,
   * 둘 다 열려 있으면 지도가 두 겹으로 덮인다(§25.7).
   * ⚠ 이 닫기를 `useRoadview` 안으로 옮기지 마라 — 팝업 상태는 지도마다 따로다.
   */
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
             * **정확도 원을 그리지 않는다**(§20.21.1). 같은 점선 원이 ② 무대 1(우리의 무지)과
             * 측정 오차(기기 보고)라는 **근거가 다른 두 뜻**을 갖게 되기 때문이다.
             * 정밀도 주장은 상태 문구의 `약 ±{n}m` 하나가 전담한다.
             * (지도 위 근사 원은 ②③ 두 개다 — §30.8.1 이 *"원은 ② 하나뿐"* 을 개정했다.
             *  유지되는 불변은 **"원 = 범위로만 아는 것. 확인 좌표에는 쓰지 않는다"** 이고,
             *  **내 위치는 기기 보고 좌표라 원이 아니라 핀**이다.)
             */
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
          드래그 개방의 **유일한 실효 완화 수단**(§27.16.3 (A) — 표에 이것 하나만 있다).

          ★ **지도 "위"다. 아래로 내리지 마라**(§27.15.1 판정 · QA-247).
          지도 아래에 두면 **위험이 최대인 순간에 완화가 0이 된다** — 지도가 화면 하단을 덮을수록
          점유율이 오르고, 그때 지도 아래에 있는 것은 **전부 화면 밖**이기 때문이다. 우연이 아니라 기하다.
          실측(360×800): 지도 **아래**면 문구가 안 보이는 구간의 최대 점유 **85.4%**(최악 구간 그 자체),
          지도 **위**면 최악 구간에서 **보인다**(문구가 안 보이는 구간은 점유 25.8% 이하 —
          그때는 지도 아래로 356px 가 비어 스크롤이 쉽다). **위험과 가시성이 같은 방향으로 움직인다.**
          부수 이득: 문구가 지도 밖 위쪽에 있다는 사실 자체가 **"지도 밖"이 어디인지 가리킨다.**

          ★ **문안에서 좌우를 가리키지 마라**(§27.16.2). 종전 `지도 밖을` 은 좌우를 포함하는 것처럼 들리는데
          **좌우 여백은 각 16px 이라 엄지가 들어가지 않는다.** 시도하면 반드시 실패하고,
          실패하면 **조합원이 문구 자체를 불신해** 다음에 위쪽을 시도할 이유가 사라진다.
          **행동을 지시하는 문구는 "할 수 있는 것"을 말해야 한다.**
          `위나 아래` 를 **둘 다** 말하는 이유: 지도가 화면 하단을 덮으면 위가 비고, 상단을 덮으면 아래가 빈다 —
          한쪽만 말하면 나머지 상황에서 틀린다.

          ⚠ **이것도 사실 주장이다** — 한 손가락으로 지도가 움직이고 **지도 위·아래 빈 곳에서 페이지가
          실제로 스크롤돼야** 참이다. 물리적 여백으로는 못 푼다(§27.13.2 실측: 360×640 에서 지도가
          엄지 영역의 99.7% 를 차지한다). **알리는 것이 유일하게 실효 있는 완화다.**
          **흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라.**
        */}
        <p className="mb-2 break-keep text-caption font-semibold text-ink">
          ※ 지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 위나 아래 빈 곳을 쓸어 주세요.
        </p>

        {/*
          고정 종횡비 박스 — 실패·미로드에서도 크기가 변하지 않아 CLS 0 (§20.3.4).

          ★ **§30.1.3 재유도 (2026-08-21) — 값은 변경 0 이지만 근거가 바뀌었다.**

          종전 근거는 *"지물이 북서–남동 대각선이라 도형 묶음이 세로로 길다(194×246px)"* 였는데,
          새 지물 집합(①②③④⑤)에서 **콘텐츠의 축이 뒤집혔다**: W/H **0.769 → 1.104**.
          ⑤ 공원 화장실이 옛 ⑥ 공원 입구보다 **동쪽으로 119.8m** 더 나가 bbox 동단을 밀었다.

          **그런데도 종횡비를 바꾸지 않는다**(§30.1.4 규칙):
          박스 **폭은 페이지 폭 − 32px 로 고정**이라 종횡비로 바꿀 수 없고, **높이만 종횡비의 소관**이다.
          구속 축이 가로로 넘어갔으므로 **이번에 손댈 지렛대는 종횡비가 아니라 `FIT_PADDING`** 이다.
          → **`aspect-[4/5]` 의 역할이 바뀌었다**: 이제 그것은 *축척을 확보하는 값*이 아니라
          **② 와 ④ 의 pill 이 도형 위·아래에 설 자리를 만드는 값**이다(상 95.3 / 하 119.3px).

          계산으로 기각한 후보: `4/3`·`9/8`(**z15 = 300m 붕괴**) · `1/1`(하단 여유 2.3px — 모델 오차에 노출) ·
          `9/10`(성립하지만 이득이 스크롤 45.6px 뿐이고 비용은 전 뷰포트 재실측).
          `md:aspect-[16/9]` 도 유지 — 768px 에서 704×396, 상·하 여백 88.3 / 112.3px 로 같은 여유 구조다.

          ⚠ **`px-4`(좌우 16px)를 늘리지 마라** — 박스 폭 = 뷰포트 − 32 이고 **이 값이 축척을 직접 결정한다**(§30.2.2).
        */}
        <div
          ref={boxRef}
          className="rounded-card relative aspect-[4/5] w-full overflow-hidden md:aspect-[16/9]"
        >
          {/* 마운트 노드에 aria-hidden 을 걸지 마라 — 네이버 로고·저작권 컨트롤에 링크가 들어가고,
              숨겨진 영역 안의 포커스 가능 요소는 WCAG 2.4.3·4.1.2 위반이 된다(§20.9).

              `touchAction: "none"` 은 **사용자 결정으로 열린 한 손가락 드래그의 본체**다(§27.13.6).
              `pan-y` 였던 값을 바꾼 것이며, 이 한 줄이 "지도 위에서는 페이지가 안 내려간다"는
              **알려진 제약**을 만든다. 되돌리려면 이 값을 `pan-y` 로, 지도 옵션의 `draggable` 을
              `(pointer: fine)` 분기로 함께 되돌린다 — **둘은 한 쌍이다.**

              로드뷰는 이제 이 박스를 **덮지 않는다**(§23.1). 전체 화면 모달로 열리므로
              **지도는 페이지에서 사라지지 않는다** — §21.3.1 이 스스로 인정했던 탭 패턴과의
              유사성(§0.4 위험)이 여기서 완전히 사라진다. `inert` 는 `<dialog showModal()>` 이
              배경 전체에 자동으로 걸어 주므로 직접 걸지 않는다. */}
          <div ref={mountRef} className="size-full" style={{ touchAction: "none" }} />

          {/*
            키보드 그룹(§27.8.1). 마커는 네이버가 주입한 DOM 안에 있어 이 요소의 **자식이 될 수 없다** —
            그래서 `aria-owns` 로 논리적 소유를 선언한다. 시각적으로는 아무 것도 그리지 않는다
            (`pointer-events-none` — 클릭을 가로채면 지도 조작이 죽는다).
            **`role="application"` 을 쓰지 마라**: 스크린리더 브라우즈 모드가 꺼져 범례 낭독이 망가진다.
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
              <MapZoomButtons
                zoom={zoom}
                onZoom={zoomBy}
                itemProps={(id) => ({ id, tabIndex: focusedId === id ? 0 : -1 })}
              />
              {/* ★ 거리뷰 토글 — 파노라마 모듈이 있을 때만. 없으면 눌러도 열 것이 없다 */}
              {panoSupported ? (
                <MapStreetToggle
                  on={streetMode}
                  onToggle={toggleStreetMode}
                  buttonRef={roadviewButtonRef}
                />
              ) : null}
            </>
          ) : null}

          {/*
            팝업 — **박스 안 고정 패널**이다(§25.4). 말풍선이 아니다.

            네이버 `InfoWindow` 와 자체 말풍선을 둘 다 버린 이유: 둘 다 **위치를 계산으로 푼다.**
            그러면 박스 경계 클램프를 우리가 구현해야 하고, **3단계 자유 드래그에서 팝업이 마커를 따라
            박스 밖으로 나간다.** 여기서는 **가로가 박스에 고정**이라 좌우 잘림이 계산이 아니라 **구조로 0**이고,
            지도가 어떻게 움직여도 팝업이 흔들리지 않는다. 세로만 마커 반대편으로 붙인다.

            **전체 화면 모달로 만들지 마라**(요구 90) — 지도와 범례가 **동시에** 보여야
            지점↔설명 대응이 성립한다. 팝업은 박스 밖(범례)을 전혀 가리지 않는다.

            ⚠ **주석 갱신**(§31.7 · 2026-08-21). 2단계에는 팝업에 `aria-hidden` 이 걸려 있었고
            *"그래서 `닫기` 도 `tabindex={-1}` 이다"* 라고 적혀 있었는데 **둘 다 3단계에서 해제됐다.**
            **현행**: 팝업에 `aria-hidden` **없음** · `닫기` 는 **정상 포커스 가능**(`tabindex` 미지정) ·
            팝업이 열리면 패널로 포커스가 이동한다(`tabIndex={-1}` 은 **패널 자신**에만 있다).
            **마커를 포커스 가능하게 만든 이상 `aria-hidden` 유지는 WCAG 2.4.3·4.1.2 즉시 위반이라
            둘은 반드시 한 쌍으로 움직인다**(§27.8.2). 되돌리려면 둘을 함께 되돌려라.
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
          어포던스 문구(요구 87 · §25.2 겹1). **`<figcaption>` 밖 `<p>` 로 뺐다**(§27.14.0) —
          컨트롤 행이 범례 **위**로 올라오면서 `<figcaption>` 이 `<figure>` 의 마지막 자식이어야
          HTML 스펙을 지킨다. 문구는 여전히 **지도 바로 아래 · 키 줄 위**라 요구 87 이 만족된다.
          `ink-muted` 로 흐리지 마라 · 접지 마라 · `sr-only` 로 돌리지 마라.

          ⚠ **이 문장은 사실 주장이다.** `번호를 누르면` 이라고 썼으므로 **번호(배지·pill)는 반드시 눌려야 하고**,
          도형(원·밴드·부지)을 눌리게 만들면 **이 문안이 거짓이 된다**(§25.2.1).
        */}
        <p className="mt-4 break-keep text-caption font-semibold text-ink">
          ※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.
        </p>
      {/*
        컨트롤 행 — **범례 위로 올렸다**(§27.14.0). 드래그를 열자 새 문제가 생겼기 때문이다:
        길을 잃은 조합원이 `처음 위치로` 를 찾으려면 아래로 스크롤해야 하는데 **지도 위에서는 스크롤이 안 된다.**
        범례 6행 뒤(약 290px)에 있던 버튼을 지도 바로 아래(약 80px)로 당겨 두 문제가 겹치는 것을 푼다.
        지도가 실패한 상태에서는 조작할 지도가 없으므로 행 전체를 렌더하지 않는다(죽은 버튼 금지).
      */}
      <div className="mt-3 min-h-touch">
        {status === "ready" ? (
          <>
            {/* 컨트롤 행은 **상태와 무관하게 버튼 구성이 바뀌지 않는다**(§23.0-4).
                로드뷰가 모달로 나가면서 `지도로 돌아가기` 가 모달 안 `닫기` 로 이동했다. */}
            {/* `축소`·`확대` 는 **지도 안 `+/−` 로 옮겼다**(§27.4.3) — 같은 기능이 두 곳에 있으면
                조합원이 어느 것이 진짜인지 묻게 된다.

                ⚠ **3단계-A 만 배포하는 지금 이 행은 3개다**(`처음 위치로`·`내 위치 표시`·`로드뷰 보기`) —
                `지도 크게 보기` 가 3단계-B 로 미뤄졌기 때문이다(§27.18.3).
                **§27.4.3 의 4개 기준 폭 검산(1행 280.0 / 2행 264.4)은 무효다.**
                3단계-B 가 되살아나면 4개로 돌아가고 그 검산이 다시 기준이 된다 —
                그때 `지도 크게 보기` 와 `로드뷰 보기` 를 **같은 행에 나란히 두지 마라**(§27.14.2):
                둘 다 화면을 덮어 혼동되므로 행을 갈라야 한다. */}
            <div className="flex flex-wrap gap-2">
              {/* 3단계-B — **QA-260(모달 안 범례 부재) 판정 대기**(§27.18).
                  코드를 지우지 마라. `STAGE3B_FULLSCREEN_MAP` 한 곳만 `true` 로 되돌리면 복구된다. */}
              {STAGE3B_FULLSCREEN_MAP ? (
                <button
                  type="button"
                  ref={fullscreenButtonRef}
                  onClick={openFullscreen}
                  className={CONTROL_CLASS}
                >
                  지도 크게 보기
                </button>
              ) : null}
              {/* 드래그로 길을 잃었을 때의 **유일한 복귀 경로**다. 3단계로 팬이 더 열려
                  중요도가 올라갔다(§27.4.3). **지우지 마라.**
                  ⚠ 이 버튼이 고치는 것은 "길을 잃었다"이지 **"페이지를 못 내린다"가 아니다** — 혼동하지 마라. */}
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
              {/*
                ★ **`로드뷰 보기` 버튼은 여기서 삭제됐다**(사용자 지시 2026-08-21). 되살리지 마라.
                그 버튼은 **위치가 5번 출구로 고정**이라 어느 지점의 로드뷰인지 고를 수 없었고,
                안내 문구도 `국회의사당역 5번 출구 주변을 볼 수 있습니다` 로 그 한계를 적고 있었다.

                **로드뷰 진입점은 이제 둘이다:**
                  ① **지점 팝업의 `로드뷰 보기`** — 그 지점의 로드뷰가 열린다
                  ② **지도 안 `거리뷰` 토글** — 파란 길을 눌러 아무 지점이나 연다
                둘 다 지도 **안**이나 지도에서 파생한 UI 라, 컨트롤 행에 다시 만들 이유가 없다.
              */}
            </div>

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
        {/* 범례는 지도 바로 아래 붙는다. 접거나 sr-only 로 돌리지 마라(§0.4).
            기호 글리프는 aria-hidden — 스크린리더에는 번호·확신도가 **문자**로 전달된다.
            행은 `MAP_FEATURES` 에서 파생된다 — 배열에서 빠진 항목의 행은 자동으로 사라진다.
            **`<figure>` 의 마지막 자식이어야 한다**(§27.14.0 · HTML 스펙) */}
        <figcaption className="mt-4">
          <p className="break-keep text-caption text-ink">{LEGEND_KEY}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {MAP_FEATURES.map((feature, index) => (
              /* `break-words` 보험 — 공백 없는 긴 낱말이 확대 200% 에서 줄 폭을 넘치는 것을 막는다
                 (도입 계기는 지금은 사라진 `여의도더샵아일랜드파크` 였고, 현행 행에도 `국회의사당역`·
                 `여의도공원` 같은 무공백 토큰이 있어 **보험은 그대로 필요하다**).
                 `break-keep`(어절 유지)은 그대로 두고 `break-words` 만 더한다 — 한 낱말이 줄 폭보다
                 길 때에만 쪼개진다. **`break-keep` 을 빼지 마라**: 한글이 음절 단위로 끊겨 판독성이 무너진다 */
              <li
                key={feature.id}
                /* `-mx-1 px-1`: 강조 배경이 글자에 붙지 않게 패딩을 주되 **음수 마진으로 상쇄**한다.
                   패딩만 주면 텍스트 가용 폭이 줄어 **확대 200% 에서 ③ 행이 7px 넘친다**(실측). */
                className={`-mx-1 flex gap-2 break-keep break-words rounded-card px-1 text-caption text-ink ${
                  groupFocused && focusedId === feature.id ? "bg-primary-tint outline-2 outline-ink" : ""
                }`}
              >
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
          {/* ⚠ **범례 각주(`LEGEND_FOOTNOTE`)는 제거됐다**(요구 158 · §19-3). **빈 `<p>` 를 남기지 마라.**
              두 문장 다 상태가 끝났다 — LED무대는 ③ 으로, 지부별 집회구역은 ④ 로 **지도에 표시했다.**
              남기면 지도가 말하는 것과 각주가 말하는 것이 정면으로 어긋난다.
              **새 각주를 만들지 마라** — 지도에 없는 것을 밝힐 일이 생기면 **범례 행이 진다**. */}
        </figcaption>
      </figure>


      {/* 전체 화면 지도(§27.6) — 로드뷰와 같은 기반, **별도 인스턴스**.
          3단계-B 로 미뤄져 **지금은 렌더되지 않는다**(§27.18 · `STAGE3B_FULLSCREEN_MAP`).
          별도 인스턴스라 A 의 드래그·`+`/`−`·키보드 그룹·팝업과 **의존이 없다** — 렌더만 꺼도 분리가 성립한다.
          `RallyFullscreenMap` 정의(아래)와 `FIT_MAX_ZOOM` 적용도 그대로 남겨 둔다: 렌더되지 않으므로 무해하고,
          되살릴 때 다시 만들 것이 없어야 한다. */}
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
 * 전체 화면 지도(§27.6 · §27.14.3) — **로드뷰 모달의 기반을 그대로 재사용한다. 새 패턴 0.**
 *
 * `<dialog>` + `showModal()`(포커스 트랩·`Esc`·배경 `inert`·top-layer) · `100dvh` ·
 * 배경 스크롤 잠금·복원 3중 장치 · `::backdrop` 클릭 핸들러 없음(오탭 닫힘 금지).
 *
 * ⚠ **별도 지도 인스턴스다. 페이지 지도를 옮기지 마라** — 옮기면 닫았을 때 초기 뷰가 보존되지 않는다.
 * 열 때 만들고 닫을 때 파괴하며, 진입 시 `fitBounds` 를 **다시** 실행한다(종횡비가 다르다).
 *
 * ⚠ **범례를 넣지 않았다.** 근거는 §27.14.3: ① 요구 90 이 막은 것은 팝업이 지점을 덮는 것이고
 * 여기서는 지도와 팝업이 함께 있다 ② 대응 경로가 `번호 → 범례` 에서 `번호 → 팝업` 으로 바뀔 뿐
 * **도달하는 문자열이 같다**(팝업 본문 = 범례 문장) ③ ②④ 는 pill 로 이름이 계속 보인다
 * ④ 일시적이고 명시적으로 연 것이며 닫으면 범례가 있는 페이지로 돌아온다 ⑤ 범례를 넣으면
 * 지도가 540px 수준으로 줄어 이 모드의 목적을 스스로 훼손한다.
 * **그러나 이것은 §0.4 판정이고 검증 소관이다 — QA-260 이 "판정 전 배포 금지"를 걸어 뒀다.**
 * 판정이 "범례 필수"로 나오면 **접지 말고** 하단에 넣고 지도를 그만큼 줄인다.
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

  /*
   * 로드뷰·거리뷰 한 벌 — **모달 전용 인스턴스**(2026-08-22).
   * `active` 는 `open` 이다: 모달이 닫히면 시트도 함께 정리돼야 한다
   * (모달이 사라진 뒤 페이지 위에 시트만 남으면, 그 시트가 가리키는 지도가 없다).
   */
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
   * 라벨 최대 폭을 px 로 확정해 CSS 변수로 내린다 — **페이지 지도(`:1175`)와 같은 것을 여기에도 둔다**
   * (2026-08-21 정정 · §N-3 결함 1).
   *
   * ⚠ **없으면 모달 pill 이 통째로 깨진다.** `labelHtml` 의 `max-width:var(--rally-label-max,60%)` 에서
   * **폴백 `60%` 가 걸리는데 앵커가 0폭 컨테이닝 블록이라 60% = 0** 이 된다 →
   * pill 이 min-content 로 접혀 **폭 16px · 2~3줄**이 됐다(실측). 페이지는 240px · 1줄이었다.
   * **"크게 보기"가 페이지보다 라벨을 못 읽게 만드는 상태였다.**
   *
   * ⚠ **페이지 쪽과 공통화하지 마라** — 두 컴포넌트가 각자의 `mountRef` 를 본다.
   * 공통화는 별도 정리 작업이고, 지금 필요한 것은 **동등성 복원**이다.
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
      /* 페이지 지도와 **같은 순서 규칙**이다 — 다시 그린 뒤 그 결과 노드를 포커스한다.
         `focus()` 를 위로 올리면 방향키 이동이 죽는다(위 주석 참조). */
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

  /*
   * 열림 ↔ 닫힘 — **React 상태가 단일 출처다**(2026-08-22 재구성).
   *
   * ★ **고친 결함: 모달이 한 번만 열렸다.** 프로덕션에서 재현했다 —
   * `지도 크게 보기` → `닫기` → 다시 `지도 크게 보기` 를 누르면 **아무 일도 일어나지 않는다.**
   * 닫은 뒤 DOM 은 닫혔는데 **React 의 `open` 은 `true` 로 남아**(실측: 닫힌 뒤에도
   * `{open ? … }` 안의 `#rally-zoom-in-fs` 가 DOM 에 존재), 그러면 이 이펙트는
   * **`open` 이 안 바뀌었으니 다시 돌지 않고** `showModal()` 도 다시 불리지 않는다.
   *
   * 종전 구조는 **닫기가 DOM 에서 시작해 상태로 거슬러 올라왔다**:
   *   `닫기` 클릭 → `dialog.close()` → `close` 이벤트 → `onClose()` → `setFullscreenOpen(false)`
   * 그 사슬은 **한 고리만 끊겨도 상태와 DOM 이 갈리고, 갈리면 스스로 복구되지 않는다.**
   * (끊긴 지점을 특정하지 못했다 — `close` 이벤트 관측은 확장 격리 환경에서 신뢰할 수 없었다.
   *  갓 만든 대조군 `<dialog>` 에서도 이벤트가 안 잡혔다. **그래서 기제가 아니라 구조를 고쳤다.**)
   *
   * **지금은 방향이 하나다**: 모든 닫기 경로가 `onClose()` 를 불러 **상태를 먼저** 바꾸고,
   * 이 이펙트가 DOM 을 거기에 맞춘다. 스크롤·포커스 복원도 여기서 한다 —
   * `close` 이벤트에 얹어 두면 그 이벤트가 안 오는 순간 **복원까지 같이 사라진다.**
   *
   * ⚠ **`닫기` 버튼을 `dialogRef.current?.close()` 로 되돌리지 마라** — 그것이 위 사슬의 시작이다.
   */
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
   * 브라우저가 스스로 닫으려 할 때(`Esc` · 뒤로가기 제스처)도 **상태를 거쳐 가게** 만든다.
   *
   * `cancel` 은 닫기 요청 시점에 온다. **막고 우리가 상태를 내린다** — 그러면 위 이펙트가
   * `dialog.close()` 를 부르므로 결과는 같고, **상태와 DOM 이 갈릴 여지가 사라진다.**
   * ⚠ 로드뷰 시트가 열려 있으면 `useRoadview` 의 `Esc` 핸들러가 **이미 `preventDefault()` 로
   * 닫기 요청 자체를 취소**하므로 여기까지 오지 않는다 — 시트만 닫히는 동작이 그렇게 나온다.
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
     * ⚠ **`node.querySelector("[tabindex]")` 이 아니다**(2026-08-21 정정 · §N-3 결함 2).
     * **네이버가 `tabindex="0"` 을 붙이는 것은 마운트 노드 *자신*** 이라 자손을 뒤지면 **빗나간다** —
     * 실측: 모달 마운트 div 가 `tabindex="0"`(페이지는 `null`)이라 **빈 탭 정지점이 하나 더 생기고**
     * §31.8-370 의 탭 순서(`처음 위치로` → `닫기` → 마커 그룹 → `+`/`−`)가 깨졌다.
     * 게다가 종전 코드는 **자손 중 첫 `[tabindex]` 를 지워** 대상이 불확정했다.
     * **페이지 지도(`:1263`)와 같은 코드여야 한다.**
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
      /* 페이지 지도와 **같은 처방**(§27.14.4-3) — 줌 애니메이션이 끝난 뒤 접힘을 다시 잰다.
         `zoom_changed` 만으로는 이동 중 좌표를 재서 겹침을 놓친다. */
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

  /*
   * 컨테이너 폭이 바뀌면 라벨 폭을 다시 내리고 재적합한다 — **페이지 지도와 같은 관측**이다.
   * 모달에서도 필요하다: 기기 회전·창 크기 변경이 열려 있는 동안 일어난다.
   * **`syncLabelWidth()` 를 빼지 마라** — 빼면 회전 후 pill 이 옛 폭을 쓴다.
   */
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

  /*
   * **선택된 항목의 도형을 강조한다**(2026-08-21 · 요구 "지도 위의 배너나 번호를 누를 때
   * 해당 구역이 하이라이트되게").
   *
   * 종전에는 선택이 **라벨 배지의 링**만 바꿨다 — 배지는 도형 밖에 떠 있어서
   * *"④ 를 눌렀는데 어느 띠가 ④ 인지"* 가 여전히 안 보였다. 헤일로가 그 연결을 만든다.
   *
   * **매번 새로 만들고 지운다**(도형을 미리 저장해 두고 `setOptions` 로 토글하지 않는다):
   * 선택은 한 번에 **하나뿐**이라 살아 있는 오버레이가 0개 아니면 1개이고,
   * 그래야 언마운트·재생성 경로에서 **떠도는 참조가 남지 않는다.**
   * ⚠ 정리 함수에서 `setMap(null)` 을 빠뜨리지 마라 — 네이버 오버레이는 지도에서 직접 떼야 사라진다.
   * ⚠ 점·핀은 `createHighlight` 가 빈 배열을 준다(근거는 그 주석). **여기서 특례를 만들지 마라.**
   */
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
        ★ **`flex-col` 3단**(§31.4 — §27.14.3 개정 2건). 종전에는 전체가 `relative size-full` 이고
        컨트롤·문구가 **지도 위 오버레이**였다.

        **오버레이를 되살리지 마라**: 오버레이는 지도를 덮는다. **§30.6 에서 `estimated` 밴드가
        대비 1.15:1 로 안 보이는 문제를 방금 고쳤는데**, 그 위에 반투명 패널을 얹을 이유가 없다.
        그리고 `flex-col` 로 나누면 **`fitBounds` 가 실제로 지도가 쓰는 박스를 보고 계산**한다 —
        오버레이 아래 가려진 영역까지 지도로 치는 문제가 사라진다.
      */}
      <div ref={boxRef} className="flex h-full flex-col bg-bg">
        {/*
          상단 바 — **모달 자체를 다루는 두 컨트롤**이 한 행에 모인다(§31.4 추가 3 개정).
          `처음 위치로` 가 종전 하단 좌측에서 여기로 올라왔다: 하단이 문자 바가 됐기 때문이다.

          **DOM 순서를 바꾸지 마라** — 탭 순서가 `처음 위치로` → `닫기` → 마커 그룹 → `+`/`−` 여야 한다.
          바가 지도보다 앞에 있으므로 §27.14.4(*"모달에 들어온 사람은 조작하러 온 것이므로
          그룹이 바로 다음"*)가 그대로 성립한다.
          `닫기` 는 이 화면의 **유일한 출구**다 — 상시 노출·자동 숨김 금지(§23.1.5).
        */}
        <div
          /*
           * ★ **`flex-wrap` 을 빼지 마라**(2026-08-22 실측 회귀 대응).
           * `CONTROL_CLASS` 에 `shrink-0 whitespace-nowrap` 을 넣으면서(라벨이 `닫`/`기` 로
           * 세로로 깨지던 것을 막으려고) 이 행이 **줄일 수 없는 두 버튼**을 갖게 됐다.
           * 텍스트 확대 200% · 360px 실측: `처음 위치로` 247 + `닫기` 146 + gap 8 + 패딩 24
           * = **421px 로 61px 넘쳤다.** `flex-wrap` 이 그때 두 줄로 쌓아 해소한다.
           * (100% 에서는 231px 라 발동하지 않는다 — 평상시 배치는 그대로다.)
           * `gap-y-2` 는 쌓였을 때 버튼이 붙지 않게 한다.
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
        <div className="relative min-h-0 flex-1 overflow-hidden">
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
              {/* 상단 바가 지도 밖으로 나갔으므로 `+`/`−` 는 **지도 영역 우상단**이다 —
                  페이지 안 지도와 같은 `top-3`. 종전 `top-20` 은 `닫기` 오버레이를 피하던 값이라 무효다. */}
              <MapZoomButtons
                zoom={zoom}
                onZoom={zoomBy}
                itemProps={(id) => ({ id: `${id}-fs`, tabIndex: focusedId === id ? 0 : -1 })}
              />
              {/* ★ 거리뷰 토글 — 파노라마 모듈이 있을 때만. 없으면 눌러도 열 것이 없다 */}
              {panoSupported ? (
                <MapStreetToggle on={streetMode} onToggle={toggleStreetMode} buttonRef={roadviewButtonRef} />
              ) : null}
            </>
          ) : null}

          {selectedFeature !== null ? (
            <MapPopupPanel
              feature={selectedFeature}
              index={selectedIndex}
              side={popupSide}
              onRoadview={panoSupported ? handleRoadview : null}
              /*
               * ★ **종전 `onRoadview={null}` 을 뒤집었다**(사용자 지시 2026-08-22 —
               * *"전체화면 지도에서도 팝업에 로드뷰 버튼 넣어줘"*).
               *
               * 그때 막았던 근거 두 가지는 **둘 다 해소됐다**:
               *   *"표면이 3겹"*  → 팝업은 시트가 열릴 때 **닫힌다**(`handleRoadview`). 2겹이다.
               *   *"모달을 닫아야 지도를 누를 수 있다"* → **아니다.** 시트는 모달이 아니고
               *     (`showModal()` 을 쓰지 않는다) 이 모달의 지도는 시트 위로 그대로 남아
               *     **파란 길을 누를 수 있다** — 거리뷰 모드의 계약이 여기서도 성립한다.
               *
               * ⚠ **시트는 반드시 `<dialog>` 안에 렌더해야 한다** — `showModal()` 은 top layer 라
               * 바깥의 `fixed z-40` 은 **모달 뒤로 숨는다.** 이 파일 아래쪽 `RoadviewSheet` 위치를 옮기지 마라.
               */
              onClose={() => {
                const openId = selectedRef.current;
                selectFeature(null);
                if (openId !== null) focusItem(openId);
              }}
            />
          ) : null}
        </div>

        {/*
          하단 바 — **오버레이가 아니라 지도 밖**이다(§31.4 추가 5 개정).

          ★ **`LEGEND_KEY` 전문 그대로**(문안 게이트 74 · 요구 49·156). **모달용 축약판을 만들지 마라.**
          **왜 이 한 줄만인가**(§31.2): 팝업 본문은 `feature.legend` **파생**이라 범례 5행 전부가
          팝업으로 도달 가능한데, **`LEGEND_KEY` 만 소유 feature 가 없어 어느 팝업에도 나오지 않는다.**
          그것이 없으면 **④ 옅은 면 = 근사**와 **⑤ 점선 도트 ≠ ① 꽉 찬 도트**를 말하는 문자가
          이 화면에 하나도 없어 **§2 위반**이 된다.
          ⚠ **범례 5행을 여기 넣지 마라** — 360px 에서 약 575px 이라 지도가 이름값을 잃는다(§31.3 안 B 폐기).

          어포던스 문구는 **키 줄 바로 아래**에 `mt-1` 로 붙인다 — **두 줄을 한 덩어리로 읽게 한다.**
          그 문구가 *"5행은 번호를 눌러 본다"* 는 경로를 지시하므로 §0.4 은폐가 성립하지 않는다.
          **접지 마라 · 흐리게 하지 마라 · `sr-only` 로 돌리지 마라.**
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
        ★ **로드뷰 시트는 `<dialog>` 안이다**(2026-08-22). 밖에 두면 `showModal()` 의 top layer 에
        가려 **보이지 않는다** — 이 배치가 곧 구현이다. 정의는 모듈 상단 `RoadviewSheet`.
        `flex-col` 3단 **밖**에 둔다: 시트는 뷰포트 하단 고정이라 3단 레이아웃의 자식이 아니다.
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
      <p className="mt-3 break-keep text-body text-ink">집결 장소 — 국회의사당역 3번 출구 KDB산업은행 앞</p>
      {/* 검증 19회차 §19-5 확정본(요구 159). `(위치 확인 중)` 은 **상태가 끝나 삭제**했고
          ⚠ 옛 문구(`코스콤지부 — 더샵아일랜드파크 앞 의사당대로` + `약 220~340 m`)를 되살리지 마라 —
          그 자리는 새 배치도 기준 **2구역**이다. `더샵아일랜드파크` 는 **금지어**다(요구 163-2).
          ⚠ 거리는 **범위**로만 쓴다(요구 151). 단일 수치(`약 327 m`)·좌표 노출 금지. */}
      <p className="mt-1 break-keep text-body text-ink">코스콤지부 — 집회 3구역</p>
      {/*
          파생 근거(요구 188) — 채택 좌표 §23-1 기준
          5번 출구 ↔ 3구역 : 폴리곤 최근접 249 m ~ 최원 꼭짓점 396 m
          (앞쪽 변 중점 253 m · 중심 322 m · 뒤쪽 변 중점 392 m)
          ★ 좌표가 바뀌면 이 값을 다시 재고 렌더 문자열과 대조하라.
            `약 30~100 m` 오류가 살아남은 원인이 **근거가 없어 대조할 대상이 없었던 것**이다.
      */}
      <p className="mt-1 break-keep text-body text-ink">
        국회의사당역 3번 출구에서 여의도공원 쪽으로 약 230 m
      </p>
    </div>
  );
}
