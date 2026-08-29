"use client";

import { useRef, useState } from "react";

/**
 * 9/4 «거리뷰 하단 시트» — 비모달. `position: fixed` 라 문서 세로를 «0» 먹는다(QA-519).
 * 설계 `_workspace/02_designer_spec.md` §54.16-6 (3) · 검증 `_workspace/01_verifier_factcheck.md` §55.
 * ⚠⚠ `<dialog showModal()>` 로 만들지 마라 — 배경이 `inert` 가 되는데 «뒤의 지도를 눌러 거리뷰 위치를 옮기는 것»이
 *   이 기능의 계약이다(배경 스크롤도 잠그지 않는다). `Esc`·포커스 복귀는 `StrikeMap` 이 진다.
 * ⚠ 낱말은 «거리뷰» 하나다 — 「로드뷰」를 렌더 문자열에 쓰지 마라(§55-4).
 */

/** 시트 높이 — 손잡이로 정하며 값은 뷰포트 대비 %(`dvh`)다(`px` 로 저장하면 회전·기기 교체에서 엉뚱해진다).
 *  ⚠⚠ 8/28 키(`koscomlabor:roadview-height`)와 «공유하지 마라» — 두 시트는 구성이 달라 한쪽에서 정한 값이
 *    다른 쪽에서 지도를 다 덮거나 파노라마를 못 쓰게 만든다(§54.16-6 (3)) */
const SHEET_HEIGHT_KEY = "koscomlabor:strike-streetview-height";
/** 8/28 과 같은 기본값 — 한 번도 안 만진 조합원은 두 페이지에서 같은 비율을 본다 */
const SHEET_DEFAULT_VH = 32;
/** 이보다 낮으면 거리뷰가 거리뷰 구실을 못 한다 */
const SHEET_MIN_PX = 120;
/** ★ 시트 «위»에 지도가 이만큼은 남아야 한다 — 이 상수가 드래그의 «상한»이다. 없으면 지도를 다 덮어 «뒤의 지도를
 *  눌러 위치를 옮긴다»는 전제가 사라진다. ⚠ 줄이려면 실기기에서 눌러 보고 줄여라 */
const SHEET_MAP_KEEP_PX = 180;
/** 헤더 높이를 **아직 못 쟀을 때만** 쓰는 어림값(첫 렌더 전용) */
const SHEET_CHROME_FALLBACK_PX = 120;
const SHEET_KEY_STEP_VH = 4;

const SHEET_TITLE = "거리뷰";
const SHEET_TITLE_ID = "strike-streetview-title";

/** 상태 문면 3종 — §55-6 확정.
 *  ⚠ 「파란 길」이라고 쓰지 마라 — «색 단독 전달»이라 색각 이상 사용자에게 안 닿는다(「지도에 표시된 길」이다).
 *  ⚠ 「이 지점에는」으로 좁히지 마라 — 파노라마는 누른 좌표 «주변»에서 가장 가까운 것을 찾는다.
 *  ⚠ 실패에 원인을 쓰지 마라 — «인증»·«네트워크»는 우리 사정이다 */
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

  /* 지연 초기화로 `localStorage` 를 읽어도 안전하다 — 이 컴포넌트는 시트가 열렸을 때만 렌더돼 하이드레이션 불일치가 없다 */
  const [heightVh, setHeightVh] = useState(readStoredSheetVh);
  const heightRef = useRef(heightVh);

  /** 한계를 상수가 아니라 «실측»으로 정한다 — 헤더를 매번 재서 빼므로 글자 크기 슬라이더로 헤더가 커지면 상한이 함께 내려간다 */
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

  /* 포인터 드래그 — ★ `setPointerCapture` 를 빼지 마라(빠르게 끌면 포인터가 손잡이를 벗어나 `pointermove` 가 끊긴다) ·
     ★ 파노라마 «위»에는 드래그를 걸지 않는다(그 안 한 손가락 끌기는 «시야 회전»이다) */
  const dragRef = useRef<{ id: number; startY: number; startVh: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    /* `×` 버튼에서 시작한 눌림은 드래그가 아니다 — 닫기를 빼앗으면 안 된다 */
    if ((e.target as HTMLElement).closest("button") !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /* 시작값을 상태가 아니라 «지금 화면에 보이는 박스 높이»에서 딴다 — `max-height` 안전망이 박스를 잘라 놨을 수 있다 */
    const box = panoBoxRef.current;
    const startVh =
      box !== null ? (box.offsetHeight / window.innerHeight) * 100 : heightRef.current;
    dragRef.current = { id: e.pointerId, startY: e.clientY, startVh };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== e.pointerId) return;
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

  /* 키보드 — 드래그만 있으면 이 기능은 마우스·손가락 전용이 된다. WAI-ARIA `separator`(window splitter) 규약을 따른다 */
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
      /* ★ `aria-label` 로 이름을 만들지 마라 — 화면에 제목이 있으면 `aria-labelledby` 로 가리킨다(`union-webapp-dev` §8).
         제목을 `<h2>` 로 두지 않은 이유: 지도 `<section>` 안이라 페이지 헤딩 차례에 「거리뷰」가 끼어든다 */
      aria-labelledby={SHEET_TITLE_ID}
      aria-modal={false}
      /* ★ `z-[300]` 이다. 낮추지 마라 — 네이버의 `.map_copyright`·축척·로고가 `z-index: 100` 이라 그보다 낮은 시트
         «위»에 그려져 글자가 포개진다. ⚠ 그 겹침은 `pointer-events: none` 이라 «기하»로만 검출된다 */
      className="rounded-t-panel fixed inset-x-0 bottom-0 z-[300] flex flex-col border-t-2 border-border-strong bg-bg shadow-hero"
      /* ★★ `maxHeight` 가 상한의 «최종 보증»이다 — 드래그·키보드는 `clampVh` 가 막지만 «저장된 값으로 열 때»는 아무도 안 막는다 */
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        maxHeight: `calc(100dvh - ${SHEET_MAP_KEEP_PX}px)`,
      }}
    >
      {/* 드래그를 받는 영역은 «손잡이 + 제목 줄 전체»다 — 손잡이 막대만 잡게 하면 터치 목표가 6px 가 된다(기준 44px).
          `touch-none` 이 없으면 세로 드래그를 브라우저가 페이지 스크롤로 가져간다 */}
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
          /* ⚠ `aria-valuemin`/`aria-valuemax` 를 쓰지 않는다 — 참 한계는 `clampVh` 가 DOM 을 «실측»해 정하는데
             첫 렌더에는 잴 대상이 없어 «틀린 최댓값»을 알린다. 단위가 `%` 라 생략 시 규약 기본값 0~100 이 맞는 눈금이다 */
          aria-valuenow={Math.round(heightVh)}
          aria-valuetext={`화면 높이의 ${Math.round(heightVh)} 퍼센트`}
          tabIndex={0}
          onKeyDown={onHandleKeyDown}
          className="flex h-6 w-full items-center justify-center focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-start gap-3 px-4 pb-3">
          <div className="min-w-0 flex-1">
            {/* ⚠ `거리뷰 — 세종대로` 류를 만들지 마라(§55-5) — 누른 점이 세종대로 위라는 보장이 없다.
                역지오코딩으로 이름을 만들지도 마라(새 API 의존 + 검증 안 된 문자열) */}
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
            /* ⭕ 아이콘만 있는 버튼의 `aria-label` 은 이름을 «덮는» 것이 아니라 «유일한 이름»이다(`union-webapp-dev` §8 밖이다) */
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

      {/* ★ 8/28 문면(«페이지 본문 텍스트를 참고»)을 그대로 옮기면 «또» 거짓이 된다 — 9/4 에는 그 본문이 없다(§55-5).
          거리뷰는 텍스트 등가가 없는 순수 시각 보조이고 정보는 지도와 범례 13행이 전부 진다 */}
      <p className="sr-only">
        거리뷰는 시각 자료입니다. 위치 안내는 지도 아래 범례를 참고해 주세요.
      </p>

      {/* ★ `overflow-hidden` 을 빼지 마라 — 없으면 파노라마가 그리는 큐브 면·로고·저작권·축척이 박스 밖으로 넘친다.
          ★ 높이가 «인라인»인 이유: 드래그로 정하는 값이다. 이 박스가 바뀌면 `StrikeMap` 의 `ResizeObserver` 가 `setSize` 를 건다 */}
      <div
        ref={panoBoxRef}
        style={{ height: `${heightVh}dvh` }}
        /* `min-h-[120px]` 은 `SHEET_MIN_PX` 와 같은 값이다 — 한쪽만 바꾸지 마라 */
        className="relative min-h-[120px] overflow-hidden bg-surface"
      >
        {/* `touch-action` 을 건드리지 않는다 — 여기서는 한 손가락 회전이 설계된 동작이다 */}
        <div ref={mountRef} className="size-full" />
        {/* 상태 안내는 `role="status"` 1곳이다(§54.16-6 (3)). ⚠ `assertive`·적색·`role="alert"` 금지 — 조합원
            잘못이 아니고 오류도 아니다. ⚠ 실패해도 시트를 닫지 마라 — «다음에 할 일»을 알려야 한다.
            `idle` 일 때도 DOM 에 남는다 — 라이브 영역은 «미리 있어야» 변경이 낭독된다 */}
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
