import type { PostCategory } from "@/lib/api/posts";
import type { HomeSectionId } from "@/lib/homeSections";

/* 라우트 상수 — 링크 경로 하드코딩 금지(union-webapp-dev §4). 내부 경로는 전부 이 모듈에서 가져온다.
   ⚠ **`?tab=` 하위호환 리다이렉트를 만들지 마라**(§15.9.2 판정) — 탭 인프라는 제거됐고(메인은 섹션 나열)
     쿼리가 무시돼도 콘텐츠는 어차피 보인다 */

/* 외부 링크 — 내부 라우트(ROUTES)와 구분. 반드시 target="_blank" rel="noopener noreferrer" 와 함께 쓴다 */
export const EXTERNAL_LINKS = {
  /** 디지털온누리 사용 가이드 (리더 유효성 확인 완료 2026-08-16) */
  onnuriGuide: "https://onnuri.koscomlabor.cloud/",
  /**
   * 주최측 출석체크 페이지(사용자 제공 · 응답 실측으로 대상 확인).
   * ⚠ 호스트가 `mycafe24.com` 이라 «공식»으로 안 보여도 도메인은 화면에 노출한다(§14.1 3중 병행).
   * ⚠ 8/28 전에 주최측에 URL 유효성을 한 번 더 확인하라(요구 78).
   */
  unionAttendance: "https://prpage153.mycafe24.com/bank703/index.php",
  /**
   * 네이버 길찾기 — **도착지 = 국회의사당역 3번 출구**(사용자 지시). 좌표부는 base62 로
   * `round(좌표 × 1e7) + 2_000_000_000` 이고 이 값은 `126.9186104, 37.5278498` 이다.
   * ⚠ **KDB산업은행 좌표(`3zfgXq,2AKonz`)로 되돌리지 마라** — 지도상 더 가까운데도 네이버가 엉뚱한
   *   지점을 찍었다(상호는 지점명이 여러 곳에 걸린다). 지하철 출구는 단일하게 확정되는 지물이다.
   * ⚠ **안내 문구를 이 링크에 맞춰 되돌리지 마라** — 집결 안내는 `3번 출구 → … KDB산업은행 앞` 그대로다.
   *   다만 길찾기 카드의 `도착지는 …입니다` 는 **이 링크가 어디로 데려가는지의 설명**이라 반드시 같아야 한다.
   * ⚠ **소수 좌표 형식으로 바꾸지 마라** — HTTP 200 을 주면서 마포구 성산동을 보여준다.
   * ⚠ **`index.nhn`·`route.nhn` 레거시와 `nmap://` 앱 스킴 금지** — 앱 미설치 조합원에게 죽은 링크다.
   * ⚠ **HTTP 200 을 동작 근거로 삼지 마라**(SPA 라 없는 경로에도 200) — 이 값을 고치는 사람은
   *   **실기기에서 도착 핀을 눈으로 확인한다.**
   */
  naverDirections:
    "https://map.naver.com/p/directions/-/3zfaE8,2AKqrw,%EA%B5%AD%ED%9A%8C%EC%9D%98%EC%82%AC%EB%8B%B9%EC%97%AD%203%EB%B2%88%20%EC%B6%9C%EA%B5%AC,,/-/transit?c=3zfaE8,2AKqrw,17,0,0,0,dh",
  /**
   * 참석 예비조사 폼(사용자 제공 · §45-1 도착지 재확인 — 리다이렉트 0 이라 «대상이 바뀔» 위험이 없다).
   * ⚠ `WebFetch` 의 «설명문 없음» 을 «없다» 로 읽지 마라(§45-13) — 마크다운 변환기가 스크립트 안
   *   문자를 통째로 버린다. 폼·위젯은 **원본 HTML** 을 봐야 한다.
   * ⚠ 8/28 직전에 한 번 더 열어 보라 — 마감되면 배너가 «닫힌 폼»으로 조합원을 보낸다.
   */
  preSurvey:
    "https://docs.google.com/forms/d/e/1FAIpQLScWKY74TnGSHJGLjfdt5k7lkP_EMHaYQAVJnchfW9WdAm4KhA/viewform",
} as const;

/**
 * 온누리 카드에 **표시**하는 도메인(§20.12.6). 아래 DISPLAY_HOST 셋은 전부 `href` 에서 파생한다 —
 * 리터럴을 따로 적으면 링크와 표시가 갈려 «클릭 전에 목적지를 알려준다»는 목적을 정면으로 배신한다.
 * ⚠ 호스트가 더 긴 도메인으로 바뀌면 §20.12.1 의 폭 예산을 **다시 실측**하라.
 */
export const ONNURI_GUIDE_DISPLAY_HOST = new URL(EXTERNAL_LINKS.onnuriGuide).host;

/** 출석체크 카드에 **표시**하는 도메인 — `href` 에서 파생해 링크와 표시가 갈리지 않게 한다 */
export const UNION_ATTENDANCE_DISPLAY_HOST = new URL(EXTERNAL_LINKS.unionAttendance).host;

/** 참석 예비조사 배너에 **표시**하는 도메인(§45-11 조건 3 — 배너 이름과 도착 페이지 제목이 글자가 다르다).
 *  ⚠ 리터럴 `docs.google.com` 을 적지 마라 — `href` 파생이 게시 조건이다. */
export const PRE_SURVEY_DISPLAY_HOST = new URL(EXTERNAL_LINKS.preSurvey).host;

/**
 * 오시는 길 — **노선·역·출구·URL 은 한 객체다. 하나만 고치지 마라**(§29.5 · 요구 137).
 * ⚠ **요구 112 — 3구역 좌표가 확정되면 최근접역이 `여의도역` 으로 바뀔 수 있다.** 그때 ① `url` 도 함께
 *   바꾸고 새 URL 은 검증을 다시 받는다(§24.6) ② ★ **`급행은 …에 서지 않습니다` 문장을 지운다** —
 *   여의도역은 급행 정차역이라 역 이름만 치환하면 1급 근거로 확정한 문장이 **1급 거짓**이 된다
 *   ③ 블록 2 산문·지도 대체면의 `국회의사당역` 표기도 함께 본다.
 */
export const WAYFINDING = {
  line: "9호선",
  station: "국회의사당역",
  exit: "3번 출구",
  /** **급행 미정차역일 때만 `true`.** 주석만 두면 다음 사람이 안 읽어서 의존을 코드에 드러냈다.
   *  ⚠ 지금은 `true` 이고 그 문장은 필수다(요구 107·138). **플래그를 이유로 문장을 빼지 마라.** */
  expressSkipsStation: true,
  url: EXTERNAL_LINKS.naverDirections,
} as const;

/** 길찾기 링크에 **표시**하는 도메인(§24.5.4 · §14.1).
 *  ⚠ **URL 전체를 화면에 노출하지 마라** — 네이버 내부 인코딩 문자열이라 판독 가치가 0이다. */
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

/** 분류별 상세 경로 — 분류가 늘어도 이 한 곳만 고친다(§15.6R-G · 누락은 컴파일 에러로 잡힌다).
 *  ⚠ 호출부에서 삼항 연산자로 분기하지 마라 — 분기 누락이 곧 잘못된 링크(404)다. */
const POST_DETAIL_PATHS: Record<PostCategory, (id: string) => string> = {
  notice: noticePath,
  news: newsPath,
  education: educationPath,
};

export const ROUTES = {
  home: "/",
  /** 26년 임단협 투쟁 안내(§17) — 게시물 분류가 아니라 정적 페이지. 투쟁 종료 후 폐기·보존 판단이
   *  별도로 필요해 코드로 관리한다. */
  bargaining: "/bargaining-2026",
  /**
   * 8/28 결의대회 참석 안내(§20.1). 사이트 안 도달 경로는 `/bargaining-2026` 「남은 일정」 8/28 카드의
   * `지난 안내 보기` 하나다(홈 배너는 없다).
   * ⚠⚠ **이 라우트를 지우지 마라 — 카톡·문자로 뿌려진 URL 이 그대로 열려야 한다**(§20.0-4). 도달 경로가
   *   다시 0 이 되어도 남긴다. «이제 안 쓰네» 로 지우면 다음 사람이 그 삭제를 근거로 페이지까지 지우고
   *   조합원이 받은 링크가 404 가 된다. («나오는 길»은 `SiteHeader` + 상·하단 복귀 링크 2개.)
   */
  rally0828: "/rally-2026-08-28",
  /** 9/4 총파업 참석 안내(§52.0-1). `rally0828` 과 같은 이유로 최상위 라우트다(§20.0-4).
   *  ⚠ **`rally0828` 을 지우지 마라** — 근거는 그 상수의 주석에 있다. 지우기 전에 반드시 읽어라. */
  strike0904: "/strike-2026-09-04",
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
