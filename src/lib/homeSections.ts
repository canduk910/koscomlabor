import { POST_CATEGORY_LABELS } from "@/lib/postCategories";

/**
 * 메인페이지 섹션 정의 (스펙 §15.2·§15.11) — **섹션 라벨의 단일 출처**.
 *
 * 불변식(§15.11): 바로가기 칩 라벨(`SectionNav`)과 섹션 `h2` 제목(`HomeSection`)은
 * 반드시 이 배열에서 파생한다. 두 곳에 문자열을 적으면 어긋난다.
 * 게시물 분류 3종의 라벨은 `POST_CATEGORY_LABELS`(admin 과 공용)에서 가져오므로
 * 같은 문구가 코드에 두 번 존재하지 않는다.
 *
 * 배열 순서 = 화면 순서 (리더 확정 1: ① 공지사항 ② 금융노조 소식 ③ 노동교육 ④ 방명록).
 * `id` 는 앵커 id 이며 상세 페이지 복귀 지점(`ROUTES.homeSection`)과 동일 값이다(§15.9.2).
 */
export const HOME_SECTIONS = [
  { id: "notices", label: POST_CATEGORY_LABELS.notice },
  { id: "news", label: POST_CATEGORY_LABELS.news },
  { id: "education", label: POST_CATEGORY_LABELS.education },
  { id: "guestbook", label: "방명록" },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]["id"];
