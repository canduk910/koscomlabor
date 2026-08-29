"use client";

import { useRef, useState } from "react";

/**
 * 9/4 **거리뷰 하단 시트** — 비모달(디자인 §54.16-6 (3) · 검증 §55-5·§55-6).
 *
 * ## ★★ `<dialog showModal()>` 로 만들지 마라
 *
 * 그것은 배경을 `inert` 로 만드는데, **이 시트가 열려 있는 동안 조합원은 뒤의 지도를 눌러
 * 거리뷰 위치를 옮겨야 한다** — 그것이 이 기능의 계약이다(초기 파노라마를 우리가 고르지 않는다).
 * 모달로 열면 그 조작이 **원천 차단**된다. 기능과 표준 동작이 충돌하므로 표준을 포기하고
 * `Esc`·포커스 복귀를 직접 진다(둘 다 `StrikeMap` 쪽에 있다). **배경 스크롤도 잠그지 않는다** —
 * 잠그면 지도까지 못 움직인다.
 *
 * ## 낱말 — **「거리뷰」다. 「로드뷰」를 렌더 문자열에 쓰지 마라** (M-21 · 검증 §55-4)
 *
 * 네이버 **공식 문서 명칭이 「거리뷰」**이고, 사용자 지시도 *"거리뷰도 유사하게 구성해서"* 였다.
 * ⚠ 8/28 은 **버튼은 「거리뷰」·시트 제목은 「로드뷰」**로 한 화면에서 두 낱말을 쓴다 —
 * 조합원이 *"다른 기능인가"* 로 읽는다. **9/4 는 하나로 간다.**
 * (8/28 을 고치는 것은 이 라운드 범위 밖이다 — `FOLLOWUPS` 후보.)
 *
 * ## 세로 예산 — **문서 세로를 «0» 먹는다**
 *
 * `position: fixed` 오버레이라 `main` 높이를 바꾸지 않는다(QA-519). 토글 버튼도 지도 «안»이라 0 이다.
 * ★ 리더 우려(*«거리뷰 블록이 추가로 세로를 먹는다»*)는 **시트 패턴이면 성립하지 않는다.**
 */

/**
 * 시트 높이 — 조합원이 손잡이를 끌어 정한다. 값은 **뷰포트 높이 대비 %**(`dvh`)로 들고 있다.
 * `px` 로 저장하면 회전·기기 교체에서 엉뚱한 비율이 된다.
 *
 * ⚠⚠ **8/28 키(`koscomlabor:roadview-height`)와 공유하지 마라**(§54.16-6 (3)).
 * 두 시트는 헤더 구성도 지도 보존 높이도 다르다 — 한쪽에서 끌어 정한 값이 다른 쪽에서
 * **지도를 다 덮거나 파노라마를 못 쓰게** 만든다.
 */
const SHEET_HEIGHT_KEY = "koscomlabor:strike-streetview-height";
/** 8/28 과 같은 기본값 — 한 번도 안 만진 조합원은 두 페이지에서 같은 비율을 본다 */
const SHEET_DEFAULT_VH = 32;
/** 이보다 낮으면 거리뷰가 거리뷰 구실을 못 한다 */
const SHEET_MIN_PX = 120;
/**
 * ★ **시트 위에 지도가 이만큼은 남아야 한다 — 이 상수가 드래그의 상한이다.**
 *
 * 이 시트의 전제는 *"뒤의 지도를 눌러 위치를 옮긴다"* 이다. 상한이 없으면 조합원이 시트를 끝까지
 * 올려 지도를 다 덮고, 그 순간 **거리뷰 위치를 옮길 방법이 사라진다.**
 * ⚠ **줄이려면 실기기에서 눌러 보고 줄여라.**
 */
const SHEET_MAP_KEEP_PX = 180;
/** 헤더 높이를 **아직 못 쟀을 때만** 쓰는 어림값(첫 렌더 전용) */
const SHEET_CHROME_FALLBACK_PX = 120;
/** 키보드 한 번(↑/↓)에 움직이는 양. `PageUp`/`PageDown` 은 3배 */
const SHEET_KEY_STEP_VH = 4;

/** 시트 제목 — **`거리뷰` 그것뿐이다**(검증 §55-5) */
const SHEET_TITLE = "거리뷰";
const SHEET_TITLE_ID = "strike-streetview-title";

/**
 * 상태 문면 3종 — 검증 §55-6 확정.
 *
 * ⚠ **「파란 길」이라고 쓰지 마라**(8/28 문면). **색 단독 전달**이라 색각 이상 사용자에게 안 닿는다.
 *   → **「지도에 표시된 길」**로 바꿨다. `파란` 기대 개수는 **0** 이다.
 * ⚠ **「이 지점에는」으로 좁히지 마라** — 네이버 파노라마는 **누른 좌표 «주변»에서 가장 가까운 것**을
 *   찾는다. 「주변」이 실제 동작에 더 가깝다.
 * ⚠ **실패에 원인을 쓰지 마라**(«인증»·«네트워크»는 우리 사정이다).
 */
export type StrikePanoStatus = "idle" | "loading" | "empty" | "failed";

const PANO_MESSAGE: Record<Exclude<StrikePanoStatus, "idle">, string> = {
  loading: "거리뷰를 불러오는 중입니다.",
  empty: "이 지점 주변에는 거리뷰가 없습니다. 지도에 표시된 길 위의 다른 지점을 눌러 주세요.",
  failed: "거리뷰를 열지 못했습니다. 잠시 후 다시 눌러 주세요.",
};

function readStoredSheetVh(): number {
  try {
    const raw = window.localStorage.getItem(SHEET_HEIGHT_KEY);
    const v = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(v) && v > 0 ? v : SHEET_DEFAULT_VH;
  } catch {
    /* 저장소를 못 읽어도 기본 높이로 열린다 */
    return SHEET_DEFAULT_VH;
  }
}

export function StrikeRoadviewSheet({
  panoDate,
  panoStatus,
  mountRef,
  onClose,
}: {
  /** 촬영 연월 — **메타에 있을 때만.** 빈 문자열이면 줄 자체가 없다(지어내지 않는다) */
  panoDate: string;
  panoStatus: StrikePanoStatus;
  mountRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const panoBoxRef = useRef<HTMLDivElement | null>(null);

  /*
   * ⚠ 여기서 `localStorage` 를 지연 초기화로 읽는 것은 안전하다 — 이 컴포넌트는 시트가 열렸을 때만
   * 렌더되고 **서버·하이드레이션 시점에는 존재하지 않는다.** 불일치가 생길 수 없다.
   */
  const [heightVh, setHeightVh] = useState(readStoredSheetVh);
  const heightRef = useRef(heightVh);

  /**
   * 조절 가능한 범위로 자른다. **한계를 상수가 아니라 실측으로 정한다** —
   * 헤더 높이를 매번 재서 빼므로 글자 크기 슬라이더로 헤더가 커지면 상한이 함께 내려간다.
   */
  const clampVh = (next: number): number => {
    const viewport = window.innerHeight;
    const sheet = sheetRef.current;
    const box = panoBoxRef.current;
    const chrome =
      sheet !== null && box !== null
        ? sheet.offsetHeight - box.offsetHeight
        : SHEET_CHROME_FALLBACK_PX;
    const maxPx = Math.max(SHEET_MIN_PX, viewport - chrome - SHEET_MAP_KEEP_PX);
    const px = Math.min(maxPx, Math.max(SHEET_MIN_PX, (next / 100) * viewport));
    return Math.round((px / viewport) * 1000) / 10;
  };

  const applyVh = (next: number): void => {
    const v = clampVh(next);
    heightRef.current = v;
    setHeightVh(v);
  };

  const persistVh = (): void => {
    try {
      window.localStorage.setItem(SHEET_HEIGHT_KEY, String(heightRef.current));
    } catch {
      /* 저장 실패해도 이번 방문에는 적용된다 */
    }
  };

  /*
   * 포인터 드래그 — 마우스·손가락·펜을 한 벌로 받는다.
   * ★ **`setPointerCapture` 가 핵심이다.** 없으면 빠르게 끌었을 때 포인터가 손잡이를 벗어나
   * `pointermove` 가 끊긴다.
   * ★ **파노라마 위에서는 드래그를 걸지 않는다** — 파노라마 안 한 손가락 끌기는 **시야 회전**이다.
   */
  const dragRef = useRef<{ id: number; startY: number; startVh: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    /* `×` 버튼에서 시작한 눌림은 드래그가 아니다 — 닫기를 빼앗으면 안 된다 */
    if ((e.target as HTMLElement).closest("button") !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /* 시작값을 상태가 아니라 **지금 화면에 보이는 박스 높이**에서 딴다 —
       `max-height` 안전망이 박스를 잘라 놨을 수 있고, 그때 상태값에서 출발하면 시트가 튄다 */
    const box = panoBoxRef.current;
    const startVh =
      box !== null ? (box.offsetHeight / window.innerHeight) * 100 : heightRef.current;
    dragRef.current = { id: e.pointerId, startY: e.clientY, startVh };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== e.pointerId) return;
    /* 위로 끌면 커진다 — 시트가 아래에 붙어 있으니 위끝이 올라간 만큼 높아진다 */
    applyVh(drag.startVh + ((drag.startY - e.clientY) / window.innerHeight) * 100);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    persistVh();
  };

  /*
   * 키보드 — **드래그만 있으면 이 기능은 마우스·손가락 전용이 된다.**
   * WAI-ARIA `separator`(window splitter) 규약: ↑/↓ 로 옮기고 `Home`/`End` 로 양 끝.
   */
  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    let next: number | null = null;
    if (e.key === "ArrowUp") next = heightRef.current + SHEET_KEY_STEP_VH;
    else if (e.key === "ArrowDown") next = heightRef.current - SHEET_KEY_STEP_VH;
    else if (e.key === "PageUp") next = heightRef.current + SHEET_KEY_STEP_VH * 3;
    else if (e.key === "PageDown") next = heightRef.current - SHEET_KEY_STEP_VH * 3;
    /* 0·100 은 `clampVh` 가 각각 최소·최대로 잘라 준다 — 한계를 두 곳에 적지 않는다 */
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 100;
    if (next === null) return;
    e.preventDefault();
    applyVh(next);
    persistVh();
  };

  const message = panoStatus === "idle" ? null : PANO_MESSAGE[panoStatus];

  return (
    <div
      ref={sheetRef}
      role="dialog"
      /*
       * ★ **`aria-label` 로 이름을 만들지 마라**(`union-webapp-dev` §8) — 화면에 제목이 있으면
       * `aria-labelledby` 로 그것을 가리킨다. 이 저장소의 이미 선 규칙이다(11:5).
       * ⚠ 제목을 `<h2>` 로 두지 않은 이유: 이 시트는 지도 `<section>` 안에 렌더되므로
       *   `<h2>` 를 쓰면 **페이지 헤딩 차례에 「거리뷰」가 끼어든다**(범례 뒤·식순 앞).
       *   `aria-labelledby` 는 헤딩이 아니어도 성립하고, 시트 자체가 `role="dialog"` 로 경계를 진다.
       */
      aria-labelledby={SHEET_TITLE_ID}
      aria-modal={false}
      /*
       * ★ **`z-[300]` 이다. 낮추지 마라.** 네이버 지도가 만드는 `.map_copyright`·축척·로고는
       * **`z-index: 100`** 이라 그보다 낮은 시트 «위»에 그려져 글자가 포개진다(8/28 실측).
       * ⚠ 그 겹침은 `pointer-events: none` 이라 히트 테스트로는 안 잡힌다 — **기하로만** 검출된다.
       */
      className="rounded-t-panel fixed inset-x-0 bottom-0 z-[300] flex flex-col border-t-2 border-border-strong bg-bg shadow-hero"
      /*
       * ★★ **`maxHeight` 가 상한의 최종 보증이다.** 드래그·키보드는 `clampVh` 가 막지만
       * **저장된 값으로 열 때는 아무도 안 막는다**(8/28 실측: 글자 크기 130% 에서 지도가 80px 만 남았다).
       * 레이아웃이 할 수 있는 일을 JS 로 옮기지 않는다 — 브라우저가 매 렌더 정확히 자른다.
       */
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        maxHeight: `calc(100dvh - ${SHEET_MAP_KEEP_PX}px)`,
      }}
    >
      {/* 드래그를 받는 영역 — **손잡이 + 제목 줄 전체**다. 손잡이 막대만 잡게 하면
          터치 목표가 6px 짜리가 된다(이 프로젝트 기준 44px).
          `touch-none`: 없으면 세로 드래그를 브라우저가 페이지 스크롤로 가져간다 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="shrink-0 cursor-ns-resize touch-none select-none"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="거리뷰 높이 조절"
          /* ⚠ `aria-valuemin`/`aria-valuemax` 를 쓰지 않는다 — 참 한계는 `clampVh` 가 **DOM 을
             실측해서** 정하는데 첫 렌더에는 잴 대상이 없어 **틀린 최댓값을 알린다.**
             단위가 `%` 라 **생략 시 규약 기본값 0~100 이 그대로 맞는 눈금**이다 */
          aria-valuenow={Math.round(heightVh)}
          aria-valuetext={`화면 높이의 ${Math.round(heightVh)} 퍼센트`}
          tabIndex={0}
          onKeyDown={onHandleKeyDown}
          className="flex h-6 w-full items-center justify-center focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          {/* 막대는 **손잡이가 있다는 표시일 뿐**이다 — 뜻은 `role`·`aria-label` 이 진다(§2) */}
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-start gap-3 px-4 pb-3">
          <div className="min-w-0 flex-1">
            {/* ⚠ **`거리뷰 — 세종대로` 류를 만들지 마라**(§55-5) — **누른 점이 세종대로 위라는
                보장이 없다.** 거리뷰가 깔린 길은 주변 도로에도 있다.
                역지오코딩으로 이름을 만들지도 마라(새 API 의존 + 검증 안 된 문자열). */}
            <p
              id={SHEET_TITLE_ID}
              className="break-keep break-words text-body font-bold leading-snug text-ink"
            >
              {SHEET_TITLE}
            </p>
            {panoDate !== "" ? (
              <p className="mt-1 text-caption tabular-nums text-ink-muted">{panoDate}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            /* ⭕ 아이콘만 있는 버튼의 `aria-label` 은 **이름을 «덮는» 것이 아니라 유일한 이름**이다 —
               §8 이 막는 것은 «내부 텍스트가 있는데 덮는 것»이다 */
            aria-label="거리뷰 닫기"
            className="ease-out-soft flex size-[44px] shrink-0 items-center justify-center rounded-full border-2 border-primary bg-bg text-primary transition-colors duration-150 hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
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
      </div>

      {/* ★ **8/28 문면을 그대로 옮기면 «또» 거짓이 된다**(§55-5) — 그쪽은 *«페이지 본문 텍스트를
          참고»* 인데 **9/4 에는 그 본문이 없다.** 지도 `sr-only` 에서 잡은 같은 함정의 두 번째 사례다.
          거리뷰는 **텍스트 등가가 없는 순수 시각 보조**이고 정보는 지도와 범례 13행이 전부 진다 */}
      <p className="sr-only">
        거리뷰는 시각 자료입니다. 위치 안내는 지도 아래 범례를 참고해 주세요.
      </p>

      {/* ★ **`overflow-hidden` 을 빼지 마라** — 없으면 네이버 파노라마가 내부에 그리는 큐브 면·로고·
          저작권·축척이 박스 밖으로 넘쳐 아래 요소 위에 겹쳐 찍힌다(8/28 실측).
          ★ 높이가 **인라인 스타일**인 이유: 드래그로 정하는 값이라 클래스로 못 적는다.
          이 박스가 바뀌면 `StrikeMap` 의 `ResizeObserver` 가 파노라마에 `setSize` 를 걸어 준다 —
          **CSS 만 바꾸면 파노라마는 초기 크기 그대로 그린다.** */}
      <div
        ref={panoBoxRef}
        style={{ height: `${heightVh}dvh` }}
        /* `min-h-[120px]` + 기본 `flex-shrink:1` — 시트가 `max-height` 에 닿으면 **여기가 줄어든다.**
           `SHEET_MIN_PX` 와 같은 값이다. 한쪽만 바꾸지 마라 */
        className="relative min-h-[120px] overflow-hidden bg-surface"
      >
        {/* `touch-action` 을 건드리지 않는다 — 여기서는 한 손가락 회전이 설계된 동작이다 */}
        <div ref={mountRef} className="size-full" />
        {/*
          상태 안내는 **`role="status"` 1곳**이다(§54.16-6 (3)).
          ⚠ **`assertive` 금지 · 적색 금지 · `role="alert"` 금지** — 조합원 잘못이 아니고 오류도 아니다.
          ⚠ **실패해도 시트를 닫지 마라** — 닫으면 *"눌렀는데 아무 일도 안 났다"* 로 읽힌다.
             다음에 할 일(«지도에 표시된 길 위의 다른 지점»)을 알려야 한다.
          상태가 `idle` 일 때도 이 영역은 DOM 에 남는다 — 라이브 영역은 **미리 있어야** 변경이 낭독된다.
        */}
        <p
          role="status"
          aria-live="polite"
          className={
            message === null
              ? "sr-only"
              : "absolute inset-0 flex items-center justify-center break-keep break-words bg-surface px-6 text-center text-body text-ink"
          }
        >
          {message}
        </p>
      </div>
    </div>
  );
}
