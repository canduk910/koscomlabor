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
  /**
   * 네이버 길찾기 — **도착지 = 국회의사당역 5번 출구**(§24.6 · 검증 10회차 요구 74·75·78).
   *
   * ⚠ **좌표부 `3zf71R,2AKrxU` 는 네이버 내부 인코딩이다.** 사람이 읽을 수 없고,
   * 형식이 바뀌면 **에러 없이 엉뚱한 지도가 뜬다** — 조용히 깨지는 값이라 아래를 반드시 지켜라.
   *
   * - **직접 만들지 마라.** 네이버가 생성해 준 값이고 검증 10회차가 **실호출로 2회 재현**했다.
   * - **소수 좌표 형식으로 바꾸지 마라.** `/p/directions/-/126.9172199,37.5282738,…` 는
   *   **HTTP 200 을 주면서 마포구 성산동을 보여준다**(실측). 가장 위험한 오답이다.
   * - **`index.nhn`·`route.nhn` 레거시 형식과 `nmap://` 앱 스킴 금지** — 앱 미설치 조합원에게 죽은 링크가 된다.
   * - **HTTP 200 을 동작 근거로 삼지 마라.** `map.naver.com` 은 SPA 라 없는 경로에도 200 을 준다.
   *   이 값을 손대는 사람은 **렌더 결과를 눈으로 확인**해야 한다(도착 핀이 5번 출구에 꽂히는지).
   * - **정기 점검**: 게시 후 **8/28 전 1회 재확인**(요구 78). 모바일 UA 로 호출해
   *   `appLink.naver?elng=126.9172199&elat=37.5282738` 로 좌표가 복원되는지 본다.
   */
  naverDirections:
    "https://map.naver.com/p/directions/-/3zf71R,2AKrxU,%EA%B5%AD%ED%9A%8C%EC%9D%98%EC%82%AC%EB%8B%B9%EC%97%AD%205%EB%B2%88%20%EC%B6%9C%EA%B5%AC,,/-/transit?c=3zf71R,2AKrxU,17,0,0,0,dh",
} as const;

/**
 * 온누리 카드에 **표시**하는 도메인 (스펙 §20.12.6).
 *
 * `href` 와 화면 문자열이 갈리면 "클릭 전에 목적지를 알려준다"는 목적을 정면으로 배신하므로
 * 리터럴을 따로 적지 않고 `EXTERNAL_LINKS.onnuriGuide` 에서 파생한다.
 * `host` 는 서브도메인 포함·프로토콜 제외·끝 슬래시 제외 — 채택 표기와 정확히 일치한다.
 * 전체 URL 은 360px 카드 안에서 28px 넘친다(§20.12.1 실측) — 도메인만 쓰는 이유다.
 * 호스트가 더 긴 도메인으로 바뀌면 §20.12.1 의 197px 예산을 **다시 실측**해야 한다.
 */
export const ONNURI_GUIDE_DISPLAY_HOST = new URL(EXTERNAL_LINKS.onnuriGuide).host;

/**
 * 길찾기 링크에 **표시**하는 도메인(§24.5.4 · §14.1).
 * **URL 전체를 화면에 노출하지 마라** — 네이버 내부 인코딩 문자열이라 소음이고 판독 가치가 0이다.
 * `href` 에서 파생해 링크와 표시가 갈리지 않게 한다(온누리 카드와 같은 규칙).
 */
export const NAVER_DIRECTIONS_DISPLAY_HOST = new URL(EXTERNAL_LINKS.naverDirections).host;

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
  /**
   * 8/28 결의대회 참석 안내 (§20.1).
   * `/bargaining-2026` 의 하위 경로로 두지 않는 이유는 상위 페이지가 폐기돼도
   * 공유된 링크가 살아 있어야 하기 때문이다(§20.0-4).
   */
  rally0828: "/rally-2026-08-28",
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
