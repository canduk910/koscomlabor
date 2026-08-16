/**
 * 라우트 상수 — 링크 경로 하드코딩 금지 (union-webapp-dev 스킬 §4).
 * 모든 <Link>/<a> 내부 경로는 이 모듈의 상수를 사용한다.
 */

export const TAB_IDS = ["notices", "news", "guestbook"] as const;

export type TabId = (typeof TAB_IDS)[number];

export function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

/** 탭 전환 시 동기화하는 URL 쿼리 파라미터 키 (?tab=notices|news|guestbook) */
export const TAB_QUERY_PARAM = "tab";

export const ROUTES = {
  home: "/",
  /** 메인페이지의 특정 탭으로 이동 (기본 탭인 공지사항은 쿼리 없이 홈) */
  homeTab: (tab: TabId): string =>
    tab === "notices" ? "/" : `/?${TAB_QUERY_PARAM}=${tab}`,
  /** 공지사항 상세 */
  notice: (slug: string): string => `/notices/${encodeURIComponent(slug)}`,
  /** 금융노조 소식 상세 */
  news: (slug: string): string => `/news/${encodeURIComponent(slug)}`,
} as const;
