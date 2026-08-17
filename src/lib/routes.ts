import type { PostCategory } from "@/lib/api/posts";
import type { HomeSectionId } from "@/lib/homeSections";

/**
 * 라우트 상수 — 링크 경로 하드코딩 금지 (union-webapp-dev 스킬 §4).
 * 모든 <Link>/<a> 내부 경로는 이 모듈의 상수를 사용한다.
 *
 * 2026-08-17 (§15): 탭 인프라(`TAB_IDS`·`TabId`·`isTabId`·`TAB_QUERY_PARAM`·`homeTab`)를
 * 제거했다. 메인페이지는 섹션 나열이며 활성 탭 개념이 존재하지 않는다.
 * `?tab=` 하위호환 리다이렉트도 만들지 않는다 — 쿼리는 무시되고 콘텐츠는 어차피 보인다(§15.9.2).
 */

/**
 * 외부 링크 상수 — 내부 라우트(ROUTES)와 구분.
 * 외부 링크는 반드시 target="_blank" rel="noopener noreferrer"와 함께 사용한다.
 */
export const EXTERNAL_LINKS = {
  /** 디지털온누리 사용 가이드 (리더 유효성 확인 완료 2026-08-16) */
  onnuriGuide: "https://onnuri.koscomlabor.cloud/",
} as const;

/* 상세 경로 빌더 — 개별 상수(ROUTES.notice 등)와 분류 매핑(ROUTES.post)이 같은 함수를 공유한다 */
function noticePath(id: string): string {
  return `/notices/${encodeURIComponent(id)}`;
}

function newsPath(id: string): string {
  return `/news/${encodeURIComponent(id)}`;
}

function educationPath(id: string): string {
  return `/education/${encodeURIComponent(id)}`;
}

/**
 * 분류별 상세 경로 — 분류가 늘어도 이 한 곳만 고친다 (§15.6R-G).
 * 호출부에서 삼항 연산자로 분기하지 말 것 — 분기 누락이 곧 잘못된 링크(404)다.
 * `Record<PostCategory, ...>` 이므로 분류 추가 시 컴파일 에러로 누락이 잡힌다.
 */
const POST_DETAIL_PATHS: Record<PostCategory, (id: string) => string> = {
  notice: noticePath,
  news: newsPath,
  education: educationPath,
};

export const ROUTES = {
  home: "/",
  /**
   * 26년 임단협 투쟁 안내 (§17) — 게시물 분류가 아니라 정적 페이지다.
   * 8페이지 구조 문서이고 투쟁 종료 후 폐기·보존 판단이 별도로 필요해 코드로 관리한다.
   */
  bargaining: "/bargaining-2026",
  /** 메인페이지의 특정 섹션 앵커 (§15.9.2 — 상세 페이지 "목록으로 돌아가기" 복귀 지점) */
  homeSection: (id: HomeSectionId): string => `/#${id}`,
  /** 공지사항 상세 (DB 전환 — id는 uuid, §15-7) */
  notice: noticePath,
  /** 금융노조 소식 상세 (DB 전환 — id는 uuid, §15-7) */
  news: newsPath,
  /** 노동교육 상세 (§15.6R-G — 링크형은 외부로 직행하므로 상세는 폴백 경로다) */
  education: educationPath,
  /** 분류 → 상세 경로 (§15.6R-G) */
  post: (category: PostCategory, id: string): string => POST_DETAIL_PATHS[category](id),
  /** 관리자 화면 */
  admin: "/admin",
} as const;
