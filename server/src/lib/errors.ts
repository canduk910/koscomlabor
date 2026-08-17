/**
 * 에러 응답 형식 통일: { error: { code, message } }
 * code 는 프론트가 분기할 수 있는 안정 계약이다 (명세 2.4절).
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  /** 인증 수단(세션 쿠키/Bearer) 자체가 무효 — 프론트는 로그인 화면으로 전환 */
  | "UNAUTHORIZED"
  /**
   * 인증은 유효하나 본문으로 재확인한 자격 증명이 불일치.
   * 현재 `POST /admin/password` 의 currentPassword 전용 (명세 §12.4, 계약 개정 1).
   * UNAUTHORIZED 와 분리한 이유: 프론트가 "세션 만료"와 "비밀번호 틀림"에 서로 다른
   * UI 로 대응해야 하는데 같은 code 면 구분할 수 없다.
   */
  | "INVALID_CREDENTIALS"
  | "NOT_FOUND"
  /**
   * 요청이 형식상 유효하지만 **서버의 현재 상태와 충돌**해 적용할 수 없음 (HTTP 409).
   * 현재 `POST /admin/posts/reorder` 전용 — 보낸 `ids` 가 해당 분류의 활성 게시물 집합과
   * 일치하지 않는 경우(다른 창에서 글이 추가·삭제된 뒤 낡은 목록으로 덮어쓰기 시도).
   * VALIDATION_ERROR 와 분리한 이유: 입력이 틀린 것이 아니라 **목록이 낡은 것**이므로
   * 프론트의 대응이 다르다 — 필드 인라인 에러가 아니라 "목록 재조회 후 재시도"다.
   *
   * ⚠ 프론트 `src/lib/api/http.ts` 의 `CODE_TO_REASON` 에 `CONFLICT: "conflict"` 를
   *   등록하지 않으면 `?? "network"` 폴백으로 **연결 실패로 오분류**된다 (07 §11.8).
   */
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "LINK_FETCH_FAILED"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}
