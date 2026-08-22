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

/*
 * ⚠ **`SectionNav`·`HomeSection` 은 제거됐다**(2026-08-22 · 탭 전환). 되살리기 전에 읽어라.
 *
 * 메인페이지가 **앵커 칩 + 세로 스택** 에서 **탭**(`HomeTabs`)으로 바뀌면서 사용처가 0 이 됐다.
 * 사용자 사유: *"방명록에서 스크롤 올리는게 힘들어"*.
 *
 * ★ `union-design-system` §0.4 는 **세로 길이 문제를 비파괴적 수단(앵커·바로가기)으로 풀라**고
 * 적고 있다 — 그 규칙이 나온 것이 바로 **이 페이지의 탭 사고**(빈 기본 탭이 유일한 콘텐츠를
 * 가림) 때문이다. 이번 전환은 그 규칙을 뒤집은 것이 아니라, **사고의 원인을 구조로 제거한 뒤**
 * 사용자 지시를 따른 것이다(건수 배지 · 내용 있는 탭을 기본으로 — `HomeTabs` 주석).
 * **두 장치 중 하나라도 빠지면 §0.4 로 되돌아가야 한다.**
 *
 * 옛 컴포넌트가 필요하면 git 이력에 있다. **여기에 복사해 두지 마라.**
 */
