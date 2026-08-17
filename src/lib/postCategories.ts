import type { PostCategory } from "@/lib/api/posts";

/**
 * 게시물 분류의 한국어 라벨 — **전 화면 단일 출처**.
 * - 메인페이지 섹션 제목·바로가기 칩: `HOME_SECTIONS`(src/lib/homeSections.ts)가 이 표를 참조한다
 * - admin: 분류 선택지(PostForm)·목록 배지(AdminApp)가 이 표를 참조한다
 *
 * `Record<PostCategory, string>` 이므로 분류가 늘면 **컴파일 에러로 누락이 잡힌다**
 * (06 명세 §19.4 "분류 리터럴 단일 출처화"의 프론트 대응).
 */
export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  notice: "공지사항",
  news: "금융노조 소식",
  education: "노동교육",
};

/**
 * 표시 순서 — 메인페이지 섹션 순서(리더 확정 1: 공지 → 소식 → 노동교육)와 동일하게 유지한다.
 * admin 분류 선택지 순서도 이 배열을 따른다(사용자가 두 화면에서 같은 순서를 본다).
 */
export const POST_CATEGORY_ORDER = [
  "notice",
  "news",
  "education",
] as const satisfies readonly PostCategory[];
