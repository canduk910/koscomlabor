"use client";

import { useEffect, useRef } from "react";
import {
  ADMIN_DELETE_CONFIRM_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

interface DeleteDialogProps {
  /** 대상 게시물 제목 (본문 인용) */
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 삭제 확인 다이얼로그 (스펙 §14.5) — 네이티브 confirm() 금지.
 * - role="alertdialog" + aria-modal + labelledby/describedby
 * - 초기 포커스 = "취소" (파괴 동작 기본 포커스 금지), 포커스 트랩, Esc·오버레이 클릭 = 취소
 */
export function DeleteDialog({ title, busy, onCancel, onConfirm }: DeleteDialogProps) {
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
          게시물을 삭제할까요?
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
