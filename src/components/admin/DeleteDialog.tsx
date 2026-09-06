"use client";

import { useEffect, useRef } from "react";
import {
  ADMIN_DELETE_CONFIRM_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

interface DeleteDialogProps {
  /** 대상 제목 (본문 인용) */
  title: string;
  /**
   * 무엇을 지우는지 — 표제 「{noun}을 삭제할까요?」에 들어간다.
   * ⚠ 기본값 `게시물` 은 **기존 호출부(게시물 삭제)를 안 건드리려는 것**이지
   *   «아무 대상에나 맞는 말»이 아니다. 새 호출부는 **반드시 자기 이름을 넘긴다** —
   *   공약 삭제인데 「게시물을 삭제할까요?」가 뜨는 것을 실제로 만들었고 실측에서 잡혔다.
   * ⚠ 조사 「을」이 표제에 붙어 있다 — 받침 없는 낱말을 넘길 거면 표제부터 고쳐라.
   */
  noun?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 삭제 확인 다이얼로그 (스펙 §14.5) — 네이티브 confirm() 금지.
 * - role="alertdialog" + aria-modal + labelledby/describedby
 * - 초기 포커스 = "취소" (파괴 동작 기본 포커스 금지), 포커스 트랩, Esc·오버레이 클릭 = 취소
 */
export function DeleteDialog({ title, noun = "게시물", busy, onCancel, onConfirm }: DeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "Tab") {
      // 포커스 트랩: 다이얼로그 내 포커스 가능한 요소 사이 순환
      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>("button:not([disabled])"),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-body"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="rounded-card w-full max-w-96 bg-bg p-6"
      >
        <h2 id="delete-dialog-title" className="text-h2 text-ink">
          {noun}을 삭제할까요?
        </h2>
        <p id="delete-dialog-body" className="mt-3 text-body text-ink">
          “{title}” — 삭제하면 되돌릴 수 없습니다.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={ADMIN_DELETE_CONFIRM_BUTTON_CLASS}
          >
            {busy ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
