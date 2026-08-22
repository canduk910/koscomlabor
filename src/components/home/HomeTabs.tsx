"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";

/**
 * 메인페이지 게시판 **탭**(사용자 지시 2026-08-22 — *"페이지내 이동이 아니라 탭컴포넌트 형태로.
 * 방명록에서 스크롤 올리는게 힘들어"*).
 *
 * ## ★★ 이 프로젝트는 **탭 때문에 사고가 난 적이 있다** — 그 실패를 구조로 막는다
 *
 * `union-design-system` §0.4 에 기록된 사고: *"메인페이지가 탭 방식이었고 기본 탭이 공지사항
 * 고정인데 공지가 0건이어서, **사이트의 유일한 콘텐츠가 `hidden` 패널 뒤에 완전히 가려졌다.**
 * 관리자는 글을 올렸는데 조합원은 빈 화면을 봤다."*
 * **지금 조건이 그때와 같다** — 공지사항 0건, 콘텐츠는 금융노조 소식에만 있다.
 *
 * **그래서 두 가지 안전장치를 넣었다. 둘 중 하나라도 빼면 사고가 그대로 재현된다:**
 *
 * 1. **탭 라벨에 건수를 붙인다.** `공지사항 0` · `금융노조 소식 2` — 조합원이 **탭 줄만 보고**
 *    어디에 글이 있는지 안다. 사고의 핵심은 *"어딘가에 글이 있는데 그 사실을 알 방법이 없었다"*
 *    였고, 건수가 그 정보를 **가려지지 않는 자리**로 끌어낸다.
 * 2. **기본 탭 = 내용이 있는 첫 탭.** 빈 탭을 기본으로 두지 않는다. 전부 비면 첫 탭이다.
 *    ⚠ 기본 탭을 `items[0]` 으로 되돌리지 마라 — **그것이 사고의 직접 원인이었다.**
 *
 * ## 해시가 단일 출처다
 *
 * 상세 페이지의 *"목록으로 돌아가기"* 가 `/#notices` 로 돌아온다(`ROUTES.homeSection`).
 * 탭 상태를 `useState` 로만 두면 **그 복귀가 엉뚱한 탭에 떨어진다.**
 * 그래서 **주소의 해시를 읽어 활성 탭을 정하고**, 탭을 누르면 해시를 갱신한다.
 * 뒤로가기·딥링크·새로고침이 전부 같은 규칙 하나로 풀린다.
 *
 * `history.replaceState` 를 쓰는 이유: `location.hash = …` 는 **그 요소로 스크롤을 튕긴다.**
 * 대신 `replaceState` 는 `hashchange` 를 **발생시키지 않으므로** 직접 구독자를 깨운다(`emit`).
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
/** 서버·하이드레이션 시점 — 해시는 서버로 전송되지 않으므로 알 수 없다. 기본 탭이 그린다 */
const getServerHash = (): string => "";

export function HomeTabs({ items, className }: { items: HomeTabItem[]; className?: string }) {
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /*
   * 기본 탭 = **글이 있는 첫 목록 탭**. 하나도 없으면 **첫 탭**이다.
   *
   * ⚠ **`count === null`(방명록)을 «내용 있음»으로 세지 마라** — 처음에 그렇게 짰다가
   * 전부 0건인 환경(백엔드 미연결 로컬)에서 **기본 탭이 방명록으로 떨어졌다.**
   * 방명록은 목록이 아니라 패널이라 "글이 몇 개"라는 축에 올릴 대상이 아니다.
   */
  const withPosts = items.findIndex((item) => item.count !== null && item.count > 0);
  const fallbackIndex = withPosts >= 0 ? withPosts : 0;
  const hashIndex = items.findIndex((item) => item.id === hash);
  const activeIndex = hashIndex >= 0 ? hashIndex : fallbackIndex;

  /*
   * ⚠ **딥링크 «자동 스크롤»은 넣었다가 뺐다**(2026-08-22). 다시 시도하기 전에 읽어라.
   *
   * 상세 페이지 *"목록으로 돌아가기"*(`/#notices`)로 들어오면 **탭은 올바르게 열리지만
   * 화면은 페이지 맨 위에 머문다.** 브라우저 기본 앵커 이동이 안 되는 이유는 명확하다 —
   * 서버는 해시를 모르므로 기본 탭을 그리고, 그 시점에 목표 패널은 `hidden` 이며
   * **브라우저는 숨은 요소로 스크롤하지 않는다.**
   *
   * 그래서 `useEffect` + `scrollIntoView` 로 보완하려 했고 **네 가지를 시도해 전부 실패**했다:
   *   ① `[items]` 의존 → 첫 커밋에 호출돼 대상이 아직 `hidden`
   *   ② `[activeIndex, items]` 로 그 탭이 열린 뒤에 호출
   *   ③ `behavior: "instant"`(이 사이트는 `scroll-behavior: smooth` 라 로드 직후 `smooth` 는 무동작 —
   *      **이건 실측으로 확인된 사실이다**: 수동 호출에서 `instant` 334px / `smooth` 0px)
   *   ④ `load` + `requestAnimationFrame` 뒤 호출, 대상도 항상 보이는 **탭 줄**로 변경
   * 넷 다 `scrollY` 가 0 에 머물렀다. **원인을 특정하지 못했다.**
   *
   * **확인하지 못한 코드를 남기지 않는다**는 이유로 제거했다. 지금 동작은
   * *"탭은 맞게 열리되 화면은 맨 위"* 이고, 이는 **기능적으로 문제가 없다**(조합원은 바로
   * 그 목록으로 스크롤해 내려가면 된다).
   * 다시 붙일 사람에게: **`scrollY` 가 실제로 0 이 아닌 값이 되는지 실측으로 확인한 뒤에만** 넣어라.
   */

  const select = (index: number) => {
    const item = items[index];
    if (item === undefined) return;
    window.history.replaceState(null, "", `#${item.id}`);
    for (const cb of listeners) cb();
  };

  /* ←/→ 로 탭 사이를 옮기고 Home/End 로 양 끝으로 간다(WAI-ARIA Tabs 표준 키). */
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
      {/*
        `overflow-x-auto` — 탭 4개가 좁은 화면에서 넘칠 때 **줄바꿈 대신 가로 스크롤**이다.
        줄바꿈하면 탭 줄 높이가 들쭉날쭉해져 아래 패널이 위아래로 튄다.
        ⚠ `scrollbar-width` 로 스크롤바를 숨기지 마라 — 더 있다는 단서가 사라진다.
      */}
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
              {/*
                ★ **건수 배지를 빼지 마라** — 이것이 §0.4 사고를 막는 장치다.
                `0` 도 그대로 보여 준다. *"0 이면 숨기자"* 는 **정확히 반대 방향**이다:
                조합원이 알아야 하는 것은 "여기 글이 몇 개인가"이고, 0 도 그 답이다.
              */}
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
          /*
           * `scroll-mt-[80px]` — **헤더가 `sticky` 라서 필요하다**(2026-08-22).
           * 딥링크(`/#notices` — 상세 페이지 "목록으로 돌아가기")로 들어오면 브라우저가 이 패널을
           * 뷰포트 맨 위에 붙이는데, **그 자리를 고정 헤더가 덮는다.**
           * 값은 실측 헤더 높이(75% 기준 67px)에 여유를 더한 것이고 **`px` 다** —
           * `rem` 이면 글자 크기 슬라이더를 따라 움직여 헤더 높이와 어긋난다.
           * ⚠ 헤더 패딩·로고 크기를 바꾸면 **이 값을 다시 재라.**
           */
          className="scroll-mt-[80px] pt-6 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:pt-7"
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
