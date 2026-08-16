"use client";

import { useRef, useSyncExternalStore } from "react";
import type { PostListItem } from "@/lib/postView";
import { isTabId, ROUTES, TAB_QUERY_PARAM, type TabId } from "@/lib/routes";
import { PostList, type PostListStatus } from "@/components/board/PostList";
import { GuestbookPanel } from "@/components/board/GuestbookPanel";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "notices", label: "공지사항" },
  { id: "news", label: "금융노조 소식" },
  { id: "guestbook", label: "방명록" },
];

const DEFAULT_TAB: TabId = "notices";

/* URL 쿼리(?tab=)를 활성 탭의 단일 소스로 사용 — 공유·새로고침·뒤로가기 유지.
 * 서버 스냅샷은 기본 탭(공지사항)이므로 정적 렌더·하이드레이션이 안전하다. */
function subscribeToUrl(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function readTabFromUrl(): TabId {
  const requested = new URLSearchParams(window.location.search).get(
    TAB_QUERY_PARAM,
  );
  return requested !== null && isTabId(requested) ? requested : DEFAULT_TAB;
}

function readServerTab(): TabId {
  return DEFAULT_TAB;
}

interface BoardTabsProps {
  notices: PostListItem[];
  news: PostListItem[];
  noticesStatus: PostListStatus;
  newsStatus: PostListStatus;
}

/**
 * 탭 게시판 (스펙 §4) — ARIA tabs 패턴.
 * - 로빙 탭인덱스: 선택 탭만 tabindex=0
 * - ←/→ 인접 이동(양끝 순환), Home/End, 이동 즉시 활성화(automatic activation)
 * - 탭 전환 시 URL 쿼리 ?tab= 동기화 (replaceState — 정적 렌더 유지 목적)
 * - 목록 데이터는 서버에서 로드되어 props로 전달된다
 */
export function BoardTabs({ notices, news, noticesStatus, newsStatus }: BoardTabsProps) {
  const activeTab = useSyncExternalStore(
    subscribeToUrl,
    readTabFromUrl,
    readServerTab,
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(id: TabId) {
    // replaceState(얕은 URL 갱신 — 서버 왕복 없음) 후 popstate를 발생시켜
    // useSyncExternalStore 구독자에게 재렌더를 알린다.
    window.history.replaceState(null, "", ROUTES.homeTab(id));
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = TABS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    selectTab(nextTab.id); // 이동 즉시 활성화 (automatic activation)
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="게시판"
        onKeyDown={handleKeyDown}
        className="flex w-full gap-1 rounded-full bg-surface p-1 md:inline-flex md:w-auto"
      >
        {TABS.map((tab, index) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => selectTab(tab.id)}
              className={`min-h-touch flex-1 rounded-full px-1 text-[1rem]/[1.5] whitespace-nowrap transition-colors focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:min-w-32 md:flex-none md:px-4 md:text-body ${
                selected
                  ? "bg-primary-strong font-bold text-white"
                  : "font-medium text-ink-muted hover:bg-primary-tint hover:text-primary-strong"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="panel-notices"
        aria-labelledby="tab-notices"
        tabIndex={0}
        hidden={activeTab !== "notices"}
        className="mt-4"
      >
        <PostList posts={notices} kind="notice" status={noticesStatus} />
      </div>
      <div
        role="tabpanel"
        id="panel-news"
        aria-labelledby="tab-news"
        tabIndex={0}
        hidden={activeTab !== "news"}
        className="mt-4"
      >
        <PostList posts={news} kind="news" status={newsStatus} />
      </div>
      <div
        role="tabpanel"
        id="panel-guestbook"
        aria-labelledby="tab-guestbook"
        tabIndex={0}
        hidden={activeTab !== "guestbook"}
        className="mt-4"
      >
        <GuestbookPanel />
      </div>
    </div>
  );
}
