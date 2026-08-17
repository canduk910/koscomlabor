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
