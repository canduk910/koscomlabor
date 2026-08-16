/**
 * 에러 응답 형식 통일: { error: { code, message } }
 * code 는 프론트가 분기할 수 있는 안정 계약이다 (명세 2.4절).
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
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
