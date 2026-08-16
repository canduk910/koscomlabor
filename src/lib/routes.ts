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

/**
 * 외부 링크 상수 — 내부 라우트(ROUTES)와 구분.
 * 외부 링크는 반드시 target="_blank" rel="noopener noreferrer"와 함께 사용한다.
 */
export const EXTERNAL_LINKS = {
  /** 디지털온누리 사용 가이드 (리더 유효성 확인 완료 2026-08-16) */
  onnuriGuide: "https://onnuri.koscomlabor.cloud/",
} as const;

export const ROUTES = {
  home: "/",
  /** 메인페이지의 특정 탭으로 이동 (기본 탭인 공지사항은 쿼리 없이 홈) */
  homeTab: (tab: TabId): string =>
    tab === "notices" ? "/" : `/?${TAB_QUERY_PARAM}=${tab}`,
  /** 공지사항 상세 (DB 전환 — id는 uuid, §15-7) */
  notice: (id: string): string => `/notices/${encodeURIComponent(id)}`,
  /** 금융노조 소식 상세 (DB 전환 — id는 uuid, §15-7) */
  news: (id: string): string => `/news/${encodeURIComponent(id)}`,
  /** 관리자 화면 */
  admin: "/admin",
} as const;
