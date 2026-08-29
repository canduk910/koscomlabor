"use client";

import { useEffect, useRef, useState } from "react";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  adminChangePassword,
} from "@/lib/api/admin";
import {
  ADMIN_FIELD_CLASS,
  ADMIN_FIELD_ERROR_CLASS,
  ADMIN_HINT_CLASS,
  ADMIN_LABEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

type FieldName = "current" | "next" | "confirm";

interface Values {
  current: string;
  next: string;
  confirm: string;
}

type FieldErrors = Record<FieldName, string | null>;

const EMPTY_VALUES: Values = { current: "", next: "", confirm: "" };
const NO_ERRORS: FieldErrors = { current: null, next: null, confirm: null };

/** 검사 순서 = 계약 §2 검증 순서(현재 → 12자 → 동일 → 불일치)와 동일 (§14.8.5) */
const FIELD_ORDER: readonly FieldName[] = ["current", "next", "confirm"];

/** 12자/동일 문구는 계약 §2 #2·#3 의 서버 message 와 문자 단위 동일 (§14.8.5) */
const MSG_CURRENT_REQUIRED = "현재 비밀번호를 입력해 주세요.";
const MSG_TOO_SHORT = `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
const MSG_SAME_AS_CURRENT = "새 비밀번호가 현재 비밀번호와 같습니다.";
const MSG_MISMATCH = "새 비밀번호가 일치하지 않습니다.";
const MSG_RATE_LIMITED = "시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.";
const MSG_NETWORK = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/** submit 시점 전체 검증. 클라이언트 검증은 UX 보조일 뿐이다 — 같은 규칙을 서버가 다시 검증한다 */
function validateAll(values: Values): FieldErrors {
  return {
    current: values.current.length === 0 ? MSG_CURRENT_REQUIRED : null,
    next:
      values.next.length < PASSWORD_MIN_LENGTH
        ? MSG_TOO_SHORT
        : values.next === values.current
          ? MSG_SAME_AS_CURRENT
          : null,
    confirm: values.confirm !== values.next ? MSG_MISMATCH : null,
  };
}

/** blur·타이핑 시점 규칙: 빈 값은 "아직 안 채운 것"이므로 질책하지 않는다 (§14.8.5) */
function validateLive(values: Values): FieldErrors {
  const all = validateAll(values);
  return {
    current: null,
    next: values.next.length === 0 ? null : all.next,
    confirm: values.confirm.length === 0 ? null : all.confirm,
  };
}

function describedBy(hintId: string | null, errorId: string | null): string | undefined {
  // 존재하는 id 만 참조한다 (§14.8.5)
  const ids = [hintId, errorId].filter((id): id is string => id !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint: string | null;
  error: string | null;
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onValueChange: (value: string) => void;
  onBlur: () => void;
}

/** 필드 3개 공통 마크업 (§14.8.4) — 라벨·힌트·에러·aria 연결을 한 곳에서 보장 */
function PasswordField({
  id,
  label,
  autoComplete,
  hint,
  error,
  value,
  inputRef,
  onValueChange,
  onBlur,
}: PasswordFieldProps) {
  const hintId = hint === null ? null : `${id}-hint`;
  const errorId = error === null ? null : `${id}-error`;

  return (
    <div className="mt-4">
      <label htmlFor={id} className={ADMIN_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="password"
        autoComplete={autoComplete}
        value={value}
        maxLength={PASSWORD_MAX_LENGTH}
        aria-invalid={error !== null ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onBlur}
        className={`${ADMIN_FIELD_CLASS} h-12 px-3`}
      />
      {hintId !== null ? (
        <p id={hintId} className={ADMIN_HINT_CLASS}>
          {hint}
        </p>
      ) : null}
      {errorId !== null ? (
        <p id={errorId} role="alert" className={ADMIN_FIELD_ERROR_CLASS}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface PasswordChangeFormProps {
  /** 변경 성공 — sessionsRevoked 로 상위 알림 문구가 갈린다 (§14.8.6) */
  onChanged: (sessionsRevoked: number) => void;
  onCancel: () => void;
  /** 세션 만료(reason "unauthorized") — 로그인 화면 전환은 상위가 담당 (계약 §3) */
  onSessionExpired: () => void;
}

/**
 * 관리자 비밀번호 변경 폼 (§14.8.3~§14.8.6 · 계약 §2·§3). 모달이 아닌 인라인 패널이다.
 * - 에러는 blur·submit 에서만 나타난다 — ⚠ 타이핑 중에 새 에러를 띄우지 마라.
 * - ⚠ 제출 버튼을 입력 미완성으로 잠그지 마라 — 누르면 검증하고 첫 오류 필드로 데려간다.
 * - ⚠ 평문 비밀번호를 로컬 state 밖으로 내보내지 마라(로그·URL·스토리지 전부).
 */
export function PasswordChangeForm({
  onChanged,
  onCancel,
  onSessionExpired,
}: PasswordChangeFormProps) {
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const currentRef = useRef<HTMLInputElement | null>(null);
  const nextRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLInputElement | null>(null);
  const fieldRefs: Record<FieldName, React.RefObject<HTMLInputElement | null>> = {
    current: currentRef,
    next: nextRef,
    confirm: confirmRef,
  };

  // 열릴 때 현재 비밀번호 필드로 포커스 (§14.8.6 — autoFocus 미사용: 스크롤 점프 제어)
  useEffect(() => {
    currentRef.current?.focus();
    formRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  function handleChange(nextValues: Values) {
    setValues(nextValues);
    const live = validateLive(nextValues);
    // 이미 표시 중인 에러만 갱신·해제한다 — 타이핑 중에 새 에러를 띄우지 않는다 (§14.8.5)
    setErrors((prev) => ({
      current: prev.current === null ? null : live.current,
      next: prev.next === null ? null : live.next,
      confirm: prev.confirm === null ? null : live.confirm,
    }));
  }

  function handleBlur(field: FieldName) {
    const live = validateLive(values);
    setErrors((prev) => {
      if (field === "next") return { ...prev, next: live.next };
      if (field === "confirm") return { ...prev, confirm: live.confirm };
      // current 의 빈 값은 submit 에서만 질책한다. 다만 "동일" 규칙은 두 필드가 다 채워져야
      // 성립하므로 현재 비밀번호 blur 에서도 새 비밀번호 필드에 반영한다.
      if (live.next === MSG_SAME_AS_CURRENT) return { ...prev, next: MSG_SAME_AS_CURRENT };
      if (prev.next === MSG_SAME_AS_CURRENT) return { ...prev, next: null };
      return prev;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const validation = validateAll(values);
    const firstInvalid = FIELD_ORDER.find((field) => validation[field] !== null);
    if (firstInvalid !== undefined) {
      setErrors(validation);
      setFormError(null);
      fieldRefs[firstInvalid].current?.focus();
      return; // 서버 요청을 보내지 않는다 (§14.8.5)
    }

    setErrors(NO_ERRORS);
    setFormError(null);
    setBusy(true);
    const result = await adminChangePassword(values.current, values.next);
    setBusy(false);

    if (result.ok) {
      onChanged(result.data.sessionsRevoked);
      return;
    }

    // 계약 §3 에러 → UI 매핑
    switch (result.reason) {
      case "invalid-credentials":
        // 인증은 유효하고 본문의 현재 비밀번호만 틀린 경우 — 원인 필드가 100% 확정된다
        setErrors({ ...NO_ERRORS, current: result.message });
        currentRef.current?.focus();
        return;
      case "unauthorized":
        // 인증 수단 자체가 무효 = 세션 만료 → 폼 에러가 아니라 로그인 화면으로
        onSessionExpired();
        return;
      case "validation":
        setFormError(result.message);
        return;
      case "rate-limited":
        setFormError(MSG_RATE_LIMITED);
        return;
      default:
        setFormError(MSG_NETWORK);
        return;
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={busy}
      className="mt-4 max-w-96"
    >
      <PasswordField
        id="admin-current-password"
        label="현재 비밀번호 (필수)"
        autoComplete="current-password"
        hint="본인 확인을 위해 현재 비밀번호를 다시 입력합니다."
        error={errors.current}
        value={values.current}
        inputRef={currentRef}
        onValueChange={(value) => handleChange({ ...values, current: value })}
        onBlur={() => handleBlur("current")}
      />
      <PasswordField
        id="admin-new-password"
        label="새 비밀번호 (필수)"
        autoComplete="new-password"
        hint={`${PASSWORD_MIN_LENGTH}자 이상 ${PASSWORD_MAX_LENGTH}자 이하, 현재 비밀번호와 다르게 입력해 주세요.`}
        error={errors.next}
        value={values.next}
        inputRef={nextRef}
        onValueChange={(value) => handleChange({ ...values, next: value })}
        onBlur={() => handleBlur("next")}
      />
      <PasswordField
        id="admin-new-password-confirm"
        label="새 비밀번호 확인 (필수)"
        autoComplete="new-password"
        hint={null}
        error={errors.confirm}
        value={values.confirm}
        inputRef={confirmRef}
        onValueChange={(value) => handleChange({ ...values, confirm: value })}
        onBlur={() => handleBlur("confirm")}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* ⚠ disabled 시각 처리(opacity·회색)를 넣지 마라 — 흰 텍스트의 대비가 무너진다.
            처리 중 표현은 라벨 텍스트 + form aria-busy 가 진다 */}
        <button
          type="submit"
          disabled={busy}
          className={`${ADMIN_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed`}
        >
          {busy ? "변경 중…" : "비밀번호 변경"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={`${ADMIN_SECONDARY_BUTTON_CLASS} disabled:cursor-not-allowed`}
        >
          취소
        </button>
      </div>

      {formError !== null ? (
        <p role="alert" className="mt-2 text-caption text-urgent-strong">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
