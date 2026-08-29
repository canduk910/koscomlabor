"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";

/**
 * 메인페이지 게시판 **탭**. 사용자 지시(2026-08-22) — *"페이지내 이동이 아니라 탭컴포넌트
 * 형태로. 방명록에서 스크롤 올리는게 힘들어"*(맨 아래 방명록에서 위로 돌아오기가 어려웠다).
 * 활성 탭의 단일 출처는 **주소 해시**다 — 딥링크(`/#notices`)·뒤로가기·
 * 새로고침이 규칙 하나로 풀린다.
 *
 * ★ **탭 사고(`union-design-system` §0.4) 재발 방지 장치 2개. 하나라도 빼면 재현된다**:
 *   ① 탭 라벨의 **건수** ② **기본 탭 = 내용이 있는 첫 탭**(⚠ `items[0]` 으로 되돌리지 마라).
 * ⚠ `location.hash = …` 를 쓰지 마라 — 그 요소로 스크롤을 튕긴다. 대신 `replaceState` 는
 *   `hashchange` 를 **발생시키지 않으므로** 직접 구독자를 깨워야 한다(`listeners`).
 */

export interface HomeTabItem {
  id: string;
  label: string;
  /** 목록 건수. **`null` 은 "목록이 아님"**(방명록) — 0 과 구분해야 배지를 안 붙인다 */
  count: number | null;
  panel: ReactNode;
}

const listeners = new Set<() => void>();

function subscribeHash(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}

const getHash = (): string => window.location.hash.slice(1);
/** 해시는 서버로 전송되지 않는다 — 서버·하이드레이션 시점에는 기본 탭이 그린다 */
const getServerHash = (): string => "";

export function HomeTabs({ items, className }: { items: HomeTabItem[]; className?: string }) {
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* ⚠ **`count === null`(방명록)을 «내용 있음»으로 세지 마라** — 전부 0건인 환경에서 기본 탭이
   * 방명록으로 떨어진다. 방명록은 목록이 아니라 패널이다. */
  const withPosts = items.findIndex((item) => item.count !== null && item.count > 0);
  const fallbackIndex = withPosts >= 0 ? withPosts : 0;
  const hashIndex = items.findIndex((item) => item.id === hash);
  const activeIndex = hashIndex >= 0 ? hashIndex : fallbackIndex;

  /* ⚠ **딥링크 «자동 스크롤»을 다시 넣지 마라** — 4가지 시도가 전부 `scrollY` 0 이었고 원인을
   * 특정하지 못했다(`_workspace/FOLLOWUPS.md` #15). 이 사이트는 `scroll-behavior: smooth` 라
   * **로드 직후 `smooth` 호출이 무동작**이다(실측 `instant` 334px / `smooth` 0px). */

  const select = (index: number) => {
    const item = items[index];
    if (item === undefined) return;
    window.history.replaceState(null, "", `#${item.id}`);
    for (const cb of listeners) cb();
  };

  /* ←/→ 로 탭 사이를 옮기고 Home/End 로 양 끝으로 간다(WAI-ARIA Tabs 표준 키).
   * ⚠ `02_designer_spec.md` §4(탭 스펙)는 **폐기 표기**라 이 키 규정의 정본은 여기다. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = items.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = activeIndex === last ? 0 : activeIndex + 1;
    else if (e.key === "ArrowLeft") next = activeIndex === 0 ? last : activeIndex - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={className}>
      {/* `overflow-x-auto` — 줄바꿈하면 탭 줄 높이가 변해 아래 패널이 튄다.
          ⚠ 스크롤바를 숨기지 마라 — 더 있다는 단서가 사라진다 */}
      <div
        role="tablist"
        aria-label="게시판"
        onKeyDown={onKeyDown}
        className="border-border-soft flex scroll-mt-[80px] gap-1 overflow-x-auto border-b"
      >
        {items.map((item, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${item.id}-tab`}
              aria-selected={selected}
              aria-controls={item.id}
              /* 로빙 tabindex — 탭 줄 전체가 **탭 정지점 하나**여야 한다(WAI-ARIA) */
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              className={`ease-out-soft -mb-px inline-flex min-h-touch shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-body font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-4 ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
              {/* ★ **건수 배지를 빼지 마라** — §0.4 사고를 막는 장치다. **`0` 도 그대로 보여 준다** */}
              {item.count !== null ? (
                <span
                  className={`rounded-full px-1.5 text-caption tabular-nums ${
                    selected ? "bg-primary-tint text-primary" : "bg-surface text-ink-muted"
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          /* `id` 는 **딥링크 앵커**이자 `aria-controls` 대상이다. 바꾸면 상세 페이지 복귀가 깨진다 */
          id={item.id}
          role="tabpanel"
          aria-labelledby={`${item.id}-tab`}
          /* 패널 자신이 포커스를 받는다 — 탭에서 Tab 키를 누르면 내용으로 들어간다(WAI-ARIA) */
          tabIndex={0}
          hidden={index !== activeIndex}
          /* `scroll-mt-[80px]` — 딥링크로 들어온 패널의 맨 위를 `sticky` 헤더가 덮는다.
           * 값 = **실측 헤더 높이(글자크기 75% 기준 67px) + 여유**. **`px` 다**
           * (`rem` 이면 글자 크기 슬라이더를 따라 움직인다). ⚠ 헤더 크기를 바꾸면 다시 재라 */
          className="scroll-mt-[80px] pt-6 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:pt-7"
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
