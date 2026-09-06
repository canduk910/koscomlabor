"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ApiAdminPledge,
  type PledgeStatus,
  PLEDGE_NOTE_MAX,
  adminDeletePledge,
  adminListPledges,
  adminUpdatePledge,
} from "@/lib/api/pledges";
import {
  PLEDGE_CATEGORY_LABELS,
  PLEDGE_CATEGORY_ORDER,
  PLEDGE_HIGHLIGHT_LABEL,
  PLEDGE_STATUS_META,
  PLEDGE_STATUS_ORDER,
  tallyPledges,
} from "@/lib/pledges";
import { PledgeStatusBadge } from "@/components/pledges/PledgeStatusBadge";
import { PledgeForm } from "@/components/admin/PledgeForm";
import { DeleteDialog } from "@/components/admin/DeleteDialog";
import {
  ADMIN_DANGER_BUTTON_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; pledges: ApiAdminPledge[] };

/**
 * 목록 한 행 — **상태·비고를 여기서 바로 고친다**(주 경로).
 *
 * ★ 값이 바뀌기 전에는 「저장」이 뜨지 않는다. 자동 저장(blur 저장)을 쓰지 않는 이유:
 *   43행이 한 화면에 있어 **지나가다 포커스만 스쳐도 저장되는** 사고가 난다.
 *   저장은 항상 «누른» 결과여야 한다.
 */
function PledgeRow({
  pledge,
  onEdit,
  onDelete,
  onSaved,
  onSessionExpired,
}: {
  pledge: ApiAdminPledge;
  onEdit: () => void;
  onDelete: () => void;
  onSaved: (updated: ApiAdminPledge, notice: string) => void;
  onSessionExpired: () => void;
}) {
  const [status, setStatus] = useState<PledgeStatus>(pledge.status);
  const [note, setNote] = useState(pledge.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = status !== pledge.status || note !== (pledge.note ?? "");
  const statusId = `pledge-status-${pledge.id}`;
  const noteId = `pledge-note-${pledge.id}`;

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    const result = await adminUpdatePledge(pledge.id, {
      status,
      note: note.trim().length === 0 ? null : note,
    });
    setBusy(false);
    if (result.ok) {
      onSaved(result.data, `「${pledge.title}」 상태를 저장했습니다.`);
      return;
    }
    if (result.reason === "unauthorized") {
      onSessionExpired();
      return;
    }
    setError(result.message);
  }

  return (
    <li className="border-b border-border-soft py-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          {/* ★ 제목은 «블록»이고 배지는 그 안을 흐르는 인라인이다 — flex 로 되돌리지 마라.
              글자가 flex 아이템이 되면 `break-words` 가 폭을 못 줄인다(§0.8.1 · PledgeBoard 에 실측치). */}
          <span className="block break-keep break-words text-body font-semibold text-ink">
            {pledge.highlight ? (
              <span className="rounded-badge mr-2 inline-block bg-primary-soft px-2 py-0.5 align-middle text-caption font-bold text-primary">
                {PLEDGE_HIGHLIGHT_LABEL}
              </span>
            ) : null}
            {pledge.title}
          </span>
          {pledge.detail !== null ? (
            <span className="mt-1 block whitespace-pre-line break-keep break-words text-caption text-ink-muted">
              {pledge.detail}
            </span>
          ) : null}
        </span>
        <PledgeStatusBadge status={pledge.status} size="sm" className="mt-0.5" />
      </div>

      {/* ⚠ 모바일 1열 · md 부터만 다열 — 좁은 폭·200% 확대에서 트랙이 내용 폭을 그대로 잡는
          것을 피한다(union-design-system §0.8.1). 되돌려 grid 한 줄로 만들지 마라 */}
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <span className="flex items-center gap-2">
          <label htmlFor={statusId} className="shrink-0 text-caption font-semibold text-ink">
            상태
          </label>
          <select
            id={statusId}
            value={status}
            onChange={(event) => setStatus(event.target.value as PledgeStatus)}
            className={`${ADMIN_FIELD_CLASS} min-h-touch w-32 px-2 text-caption`}
          >
            {PLEDGE_STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {PLEDGE_STATUS_META[value].label}
              </option>
            ))}
          </select>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <label htmlFor={noteId} className="shrink-0 text-caption font-semibold text-ink">
            비고
          </label>
          <input
            id={noteId}
            type="text"
            value={note}
            maxLength={PLEDGE_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            className={`${ADMIN_FIELD_CLASS} min-h-touch w-full min-w-0 px-2 text-caption`}
          />
        </span>
        <span className="flex shrink-0 flex-wrap gap-2">
          {dirty ? (
            <button type="button" onClick={save} disabled={busy} className={ADMIN_PRIMARY_BUTTON_CLASS}>
              {busy ? "저장 중…" : "저장"}
            </button>
          ) : null}
          <button type="button" onClick={onEdit} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            수정
          </button>
          <button type="button" onClick={onDelete} className={ADMIN_DANGER_BUTTON_CLASS}>
            삭제
          </button>
        </span>
      </div>

      {error !== null ? (
        <p role="alert" className="mt-2 text-caption text-urgent-strong">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * 공약 이행 관리 — 게시물 관리 아래의 **독립 섹션**.
 *
 * ★ **기본은 접혀 있고, 접힌 상태에서도 «건수와 상태 집계»가 보인다.**
 *   union-design-system §0.4 는 접기 패턴이 콘텐츠를 은폐한 사고를 근거로 «도입 시 접힌
 *   개수를 명시할 것»을 요구한다. 43행을 게시물 목록 아래에 늘 펼쳐 두면 관리 화면이
 *   쓰기 어려워지므로, 그 요구를 지키는 형태(요약을 머리에 노출)로 접는다.
 *   ⛔ 요약 줄을 지우고 접기만 남기지 마라 — 그러면 §0.4 가 금지한 그 패턴이 된다.
 */
export function PledgeAdminPanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [editing, setEditing] = useState<ApiAdminPledge | "new" | null>(null);
  const [deleting, setDeleting] = useState<ApiAdminPledge | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void adminListPledges().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setList({ status: "loaded", pledges: result.data });
      } else if (result.reason === "unauthorized") {
        onSessionExpired();
      } else {
        setList({ status: "error", message: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, onSessionExpired]);

  const reload = useCallback(() => {
    setList({ status: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * 행 하나를 갈아 끼운다 — **인라인 저장에는 `reload()` 를 쓰지 마라.**
   * `reload()` 는 `status:"loading"` 으로 되돌리고, 그러면 `pledges` 가 `[]` 가 되어
   * **43행이 전부 언마운트된다.** 관리자가 여러 행의 비고를 적어 둔 뒤 한 행을 저장하면
   * 나머지 행의 미저장 입력이 **아무 안내 없이 사라진다**(「저장했습니다」만 떠서 알아채지도 못한다).
   * 서버가 돌려준 행으로 그 자리만 바꾸면 다른 행의 편집 상태가 보존된다.
   * ⚠ 등록·삭제는 «집합»이 바뀌므로 그쪽은 `reload()` 가 맞다.
   */
  const replaceRow = useCallback((updated: ApiAdminPledge) => {
    setList((prev) =>
      prev.status === "loaded"
        ? {
            status: "loaded",
            pledges: prev.pledges.map((p) => (p.id === updated.id ? updated : p)),
          }
        : prev,
    );
  }, []);

  async function confirmDelete() {
    if (deleting === null || deleteBusy) return;
    setDeleteBusy(true);
    const result = await adminDeletePledge(deleting.id);
    setDeleteBusy(false);
    setDeleting(null);
    if (result.ok) {
      setNotice("공약을 삭제했습니다.");
      reload();
    } else if (result.reason === "unauthorized") {
      onSessionExpired();
    } else {
      setNotice(result.message);
    }
  }

  const pledges = list.status === "loaded" ? list.pledges : [];
  const tally = tallyPledges(pledges.map((pledge) => pledge.status));

  return (
    <section aria-labelledby="pledge-admin-title" className="mt-10 border-t border-border-soft pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pledge-admin-title" className="text-h2 text-ink">
          공약 이행 관리
        </h2>
        <div className="flex flex-wrap gap-2">
          {open ? (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              새 공약
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="pledge-admin-body"
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            {open ? "접기" : "펼치기"}
          </button>
        </div>
      </div>

      {/* ★ 접힌 상태에서도 보이는 요약 — §0.4 의 «접힌 개수 명시» 요구를 지는 줄이다 */}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink">
        {list.status === "loading" ? (
          <span role="status">공약을 불러오는 중입니다…</span>
        ) : list.status === "error" ? (
          <span className="font-semibold text-urgent-strong">{list.message}</span>
        ) : (
          <>
            <span>
              전체 <b className="font-bold tabular-nums">{tally.total}</b>건
            </span>
            {PLEDGE_STATUS_ORDER.map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full ${PLEDGE_STATUS_META[status].dotClass}`}
                />
                {PLEDGE_STATUS_META[status].label}
                <b className="font-bold tabular-nums">
                  {status === "done" ? tally.done : status === "talking" ? tally.talking : tally.undone}
                </b>
              </span>
            ))}
          </>
        )}
      </p>

      {/* ★★ **「다시 불러오기」는 접힘 컨테이너 «밖»이다 — 안으로 옮기지 마라.**
          조회가 실패하면 위 요약 줄에 오류 문면이 뜨는데, 패널 기본값은 «접힘»이다(open=false).
          복구 버튼을 `#pledge-admin-body` 안에 두면 **오류는 보이는데 그것을 푸는 수단이
          `hidden` 뒤에 있다** — union-design-system §0.4 가 사고 기록을 근거로 금지한 그 형태다.
          (실제로 그렇게 만들었다가 검토에서 잡혔다.) */}
      {list.status === "error" ? (
        <button type="button" onClick={reload} className={`${ADMIN_SECONDARY_BUTTON_CLASS} mt-3`}>
          다시 불러오기
        </button>
      ) : null}

      <p role="status" className="mt-2 text-caption text-ink">
        {notice ?? ""}
      </p>

      <div id="pledge-admin-body" hidden={!open}>
        {editing !== null ? (
          <div className="rounded-badge mt-4 border border-border-soft p-4">
            <h3 className="text-body font-bold text-ink">
              {editing === "new" ? "새 공약 등록" : "공약 수정"}
            </h3>
            <PledgeForm
              /* ★★ **`key` 를 지우지 마라 — 지우면 «다른 공약이 덮어써진다».**
                 폼은 목록 «위»에 뜨고 43행은 그 아래에 그대로 남아, 폼을 연 채 다른 행의
                 「수정」을 누를 수 있다. 그때 `editing` 만 A→B 로 바뀌는데 key 가 없으면
                 React 가 같은 인스턴스를 재사용하고, PledgeForm 의 필드는 전부
                 `useState(initial?.x)` 라 **마운트 때 한 번만** 초기화된다 →
                 화면에는 A 의 값이 남고 `initial.id` 만 B 가 되어 「저장」이
                 **B 를 A 의 내용으로 통째로 덮는다**(되돌릴 수 없다).
                 아래 `PledgeRow` 가 같은 이유로 key 에 `updatedAt` 을 섞는다. */
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              onSaved={(savedNotice) => {
                setNotice(savedNotice);
                setEditing(null);
                reload();
              }}
              onCancel={() => setEditing(null)}
              onSessionExpired={onSessionExpired}
            />
          </div>
        ) : null}

        {PLEDGE_CATEGORY_ORDER.map((category) => {
          const rows = pledges.filter((pledge) => pledge.category === category);
          if (rows.length === 0) return null;
          return (
            <div key={category} className="mt-6">
              <h3 className="text-body font-bold text-ink">
                {PLEDGE_CATEGORY_LABELS[category]}
                <span className="ml-2 font-normal text-ink-muted">{rows.length}건</span>
              </h3>
              <ul className="mt-2">
                {rows.map((pledge) => (
                  <PledgeRow
                    // ⚠ key 에 상태를 섞어라 — 저장 성공 후 새 값이 «행의 초기값»이 되어야
                    //   「저장」 버튼이 사라진다. id 만 쓰면 useState 초기값이 낡은 채 남는다
                    key={`${pledge.id}:${pledge.updatedAt}`}
                    pledge={pledge}
                    onEdit={() => setEditing(pledge)}
                    onDelete={() => setDeleting(pledge)}
                    onSaved={(updated, savedNotice) => {
                      setNotice(savedNotice);
                      // ⚠ `reload()` 를 부르지 마라 — 다른 행의 미저장 입력이 날아간다(replaceRow 주석)
                      replaceRow(updated);
                    }}
                    onSessionExpired={onSessionExpired}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {deleting !== null ? (
        <DeleteDialog
          title={deleting.title}
          // ⚠ 넘기지 않으면 「게시물을 삭제할까요?」가 뜬다(기본값). 실측에서 잡힌 결함이다
          noun="공약"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}
