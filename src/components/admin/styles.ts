/**
 * admin 공통 스타일 상수 (스펙 §14 — 신규 색 조합 0건, 전부 기존 채택 조합).
 * admin은 기능 화면: 히어로·그림자·Gmarket 미사용, 전부 Pretendard (§14 설계 원칙).
 */

/** 폼 라벨 (§14.4·§14.8.4 공용) — 흰 배경 위 #1a1a1a 17.40:1 (#1) */
export const ADMIN_LABEL_CLASS = "mb-2 block text-body font-semibold text-ink";

/** 필드 힌트 caption (§14.8.4) — 흰 배경 위 #4b5563 7.56:1 (#6) */
export const ADMIN_HINT_CLASS = "mt-1 text-caption text-ink-muted";

/** 필드 인라인 에러 (§14.8.5) — 흰 배경 위 #9c0d14 8.46:1 (#12). role="alert"와 함께 사용 */
export const ADMIN_FIELD_ERROR_CLASS = "mt-1 text-caption text-urgent-strong";

/** 입력 필드 (§7.2 스타일 계승 — v2 radius 12px) */
export const ADMIN_FIELD_CLASS =
  "rounded-badge w-full border border-border-strong bg-bg text-body text-ink focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/** 주 버튼 (§7.2 등록 버튼 스타일) */
export const ADMIN_PRIMARY_BUTTON_CLASS =
  "min-h-touch rounded-full bg-primary-strong px-6 text-body font-bold text-white hover:outline-2 hover:outline-primary-strong hover:outline-offset-2 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/** 보조 버튼 (§14.3 — 수정 등): bg / primary 텍스트 / border-strong */
export const ADMIN_SECONDARY_BUTTON_CLASS =
  "min-h-touch rounded-lg border border-border-strong bg-bg px-4 text-body font-semibold text-primary hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/** 위험 버튼 (§14.3 — 삭제): 동일 프레임, urgent-strong 텍스트 */
export const ADMIN_DANGER_BUTTON_CLASS =
  "min-h-touch rounded-lg border border-border-strong bg-bg px-4 text-body font-semibold text-urgent-strong hover:bg-urgent-tint focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/** 삭제 확정 버튼 (§14.5): urgent-strong 배경 + 흰 텍스트 */
export const ADMIN_DELETE_CONFIRM_BUTTON_CLASS =
  "min-h-touch rounded-lg bg-urgent-strong px-6 text-body font-bold text-white focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";
