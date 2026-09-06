"use client";

import { useState } from "react";
import {
  type ApiAdminPledge,
  type PledgeCategory,
  type PledgeInput,
  type PledgeStatus,
  PLEDGE_DETAIL_MAX,
  PLEDGE_NOTE_MAX,
  PLEDGE_TITLE_MAX,
  adminCreatePledge,
  adminUpdatePledge,
} from "@/lib/api/pledges";
import {
  PLEDGE_CATEGORY_LABELS,
  PLEDGE_CATEGORY_ORDER,
  PLEDGE_STATUS_META,
  PLEDGE_STATUS_ORDER,
} from "@/lib/pledges";
import {
  ADMIN_FIELD_CLASS,
  ADMIN_FIELD_ERROR_CLASS,
  ADMIN_HINT_CLASS,
  ADMIN_LABEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

/**
 * 공약 등록·수정 폼.
 *
 * ⚠ **상태·비고는 여기 «말고» 목록 행에서도 바꿀 수 있다**(PledgeAdminPanel 의 인라인 저장).
 *   그쪽이 주 경로이고 이 폼은 «공약 자체»(분류·이름·세부·핵심 여부)를 손볼 때 쓴다.
 *   두 경로가 같은 PATCH 를 쓰므로 한쪽만 고치면 저장 규칙이 갈린다 — 함께 본다.
 */
export function PledgeForm({
  initial,
  onSaved,
  onCancel,
  onSessionExpired,
}: {
  /** null = 새 공약 */
  initial: ApiAdminPledge | null;
  onSaved: (notice: string) => void;
  onCancel: () => void;
  onSessionExpired: () => void;
}) {
  const [category, setCategory] = useState<PledgeCategory>(initial?.category ?? "strong");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [status, setStatus] = useState<PledgeStatus>(initial?.status ?? "undone");
  const [note, setNote] = useState(initial?.note ?? "");
  const [highlight, setHighlight] = useState(initial?.highlight ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = initial === null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (title.trim().length === 0) {
      setError("공약명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);

    const input: PledgeInput = {
      category,
      title: title.trim(),
      // 빈 문자열은 «지움»이다 — null 로 보내야 서버가 컬럼을 비운다(생략은 «변경 없음»)
      detail: detail.trim().length === 0 ? null : detail,
      status,
      note: note.trim().length === 0 ? null : note,
      highlight,
    };
    const result = isNew ? await adminCreatePledge(input) : await adminUpdatePledge(initial.id, input);
    setBusy(false);

    if (result.ok) {
      onSaved(isNew ? "공약을 등록했습니다." : "공약을 수정했습니다.");
      return;
    }
    if (result.reason === "unauthorized") {
      onSessionExpired();
      return;
    }
    setError(result.message);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4">
      {/* ⚠ `grid-cols-1` 을 빼지 마라 — 열 정의가 없으면 암시적 트랙이 `auto` 가 되어
          트랙 폭이 내용의 min-content 로 잡힌다(PledgeBoard 의 목록 그리드에 실측치) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="pledge-category" className={ADMIN_LABEL_CLASS}>
            분류
          </label>
          <select
            id="pledge-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as PledgeCategory)}
            className={`${ADMIN_FIELD_CLASS} min-h-touch px-3`}
          >
            {PLEDGE_CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {PLEDGE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pledge-status" className={ADMIN_LABEL_CLASS}>
            이행 상태
          </label>
          <select
            id="pledge-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as PledgeStatus)}
            className={`${ADMIN_FIELD_CLASS} min-h-touch px-3`}
          >
            {PLEDGE_STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {PLEDGE_STATUS_META[value].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="pledge-title" className={ADMIN_LABEL_CLASS}>
          공약명
        </label>
        <input
          id="pledge-title"
          type="text"
          value={title}
          maxLength={PLEDGE_TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
          className={`${ADMIN_FIELD_CLASS} h-12 px-3`}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="pledge-detail" className={ADMIN_LABEL_CLASS}>
          세부 내용
        </label>
        <textarea
          id="pledge-detail"
          rows={4}
          value={detail}
          maxLength={PLEDGE_DETAIL_MAX}
          onChange={(event) => setDetail(event.target.value)}
          className={`${ADMIN_FIELD_CLASS} p-3`}
        />
        <p className={ADMIN_HINT_CLASS}>한 줄에 한 항목씩 적습니다. 빈 줄은 저장할 때 정리됩니다.</p>
      </div>

      <div className="mt-4">
        <label htmlFor="pledge-note" className={ADMIN_LABEL_CLASS}>
          비고
        </label>
        <textarea
          id="pledge-note"
          rows={2}
          value={note}
          maxLength={PLEDGE_NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          className={`${ADMIN_FIELD_CLASS} p-3`}
        />
        <p className={ADMIN_HINT_CLASS}>조합원 화면에 그대로 표시됩니다.</p>
      </div>

      <div className="mt-4">
        <label className="flex min-h-touch items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(event) => setHighlight(event.target.checked)}
            className="size-5 accent-[#093389]"
          />
          핵심공약 (공약집 2쪽 수록)
        </label>
      </div>

      {error !== null ? (
        <p role="alert" className={ADMIN_FIELD_ERROR_CLASS}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={ADMIN_PRIMARY_BUTTON_CLASS}>
          {busy ? "저장 중…" : isNew ? "등록" : "저장"}
        </button>
        <button type="button" onClick={onCancel} className={ADMIN_SECONDARY_BUTTON_CLASS}>
          취소
        </button>
      </div>
    </form>
  );
}
