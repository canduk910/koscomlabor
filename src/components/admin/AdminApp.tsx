"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ApiAdminPost,
  adminDeletePost,
  adminListPosts,
  adminLogin,
  adminLogout,
  adminMe,
} from "@/lib/api/admin";
import { getApiConnection } from "@/lib/api/http";
import { formatEntryDate } from "@/lib/date";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { DocumentIcon, ConstructionIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/board/EmptyState";
import { PostForm } from "@/components/admin/PostForm";
import { DeleteDialog } from "@/components/admin/DeleteDialog";
import {
  ADMIN_DANGER_BUTTON_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

type Phase = "checking" | "login" | "ready";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; posts: ApiAdminPost[] };

/** 로그인 폼 (스펙 §14.2) */
function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await adminLogin(password);
    setBusy(false);
    if (result.ok) {
      onLoggedIn();
      return;
    }
    // §14.2 에러 문구 분기
    if (result.reason === "unauthorized") setError("비밀번호가 일치하지 않습니다.");
    else if (result.reason === "rate-limited")
      setError("시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    else setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return (
    <div className="rounded-badge mx-auto mt-8 w-full max-w-96 border border-border-strong px-6 py-8">
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="admin-password" className="mb-2 block text-body font-semibold text-ink">
          관리자 비밀번호
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={`${ADMIN_FIELD_CLASS} h-12 px-3`}
        />
        <button type="submit" disabled={busy} className={`${ADMIN_PRIMARY_BUTTON_CLASS} mt-4`}>
          {busy ? "확인 중…" : "로그인"}
        </button>
        {error !== null ? (
          <p role="alert" className="mt-2 text-caption text-urgent-strong">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/**
 * admin 앱 (스펙 §14) — 세션 확인 → 로그인 → 게시물 관리(목록/등록/수정/삭제).
 * 전 API 호출은 세션 쿠키(credentials: "include") 기반 (src/lib/api/admin.ts).
 * API 미설정 시 "API 미연결" 안내만 표시 (가짜 동작 금지).
 */
export function AdminApp() {
  const configured = getApiConnection().status === "configured";
  const [phase, setPhase] = useState<Phase>("checking");
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [editing, setEditing] = useState<ApiAdminPost | "new" | null>(null);
  const [deleting, setDeleting] = useState<ApiAdminPost | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 세션 확인 (비동기 콜백 setState)
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void adminMe().then((result) => {
      if (cancelled) return;
      setPhase(result.ok ? "ready" : "login");
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  // 목록 로드 (ready 상태에서)
  useEffect(() => {
    if (phase !== "ready") return;
    let cancelled = false;
    void adminListPosts().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setList({ status: "loaded", posts: result.data });
      } else if (result.reason === "unauthorized") {
        setPhase("login"); // 세션 만료
      } else {
        setList({ status: "error", message: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, reloadToken]);

  const reload = useCallback(() => {
    setList({ status: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  if (!configured) {
    return (
      <div className="rounded-card mx-auto mt-8 max-w-96 border border-border-strong bg-surface px-4 py-8 text-center">
        <ConstructionIcon className="mx-auto size-10 text-border-strong" />
        <h2 className="mt-4 text-h2 text-ink">API 미연결</h2>
        <p className="mt-2 text-body text-ink-muted">
          NEXT_PUBLIC_API_BASE_URL이 설정되지 않아 관리 기능을 사용할 수 없습니다.
        </p>
      </div>
    );
  }

  if (phase === "checking") {
    return (
      <p role="status" className="px-4 py-12 text-center text-caption text-ink-muted">
        세션을 확인하는 중입니다…
      </p>
    );
  }

  if (phase === "login") {
    return <LoginForm onLoggedIn={() => setPhase("ready")} />;
  }

  async function handleLogout() {
    await adminLogout();
    setPhase("login");
  }

  async function confirmDelete() {
    if (deleting === null || deleteBusy) return;
    setDeleteBusy(true);
    const result = await adminDeletePost(deleting.id);
    setDeleteBusy(false);
    setDeleting(null);
    if (result.ok) {
      setNotice("게시물을 삭제했습니다.");
      reload();
    } else {
      setNotice(result.message);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 text-ink">게시물 관리</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            새 게시물
          </button>
          <button type="button" onClick={handleLogout} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            로그아웃
          </button>
        </div>
      </div>

      <p role="status" className="mt-2 text-caption text-ink">
        {notice ?? ""}
      </p>

      {editing !== null ? (
        <div className="rounded-badge mt-4 border border-border-soft p-4">
          <h3 className="text-body font-bold text-ink">
            {editing === "new" ? "새 게시물 등록" : "게시물 수정"}
          </h3>
          <PostForm
            initial={editing === "new" ? null : editing}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}

      <div className="mt-6">
        {list.status === "loading" ? (
          <p role="status" className="px-4 py-12 text-center text-caption text-ink-muted">
            게시물 목록을 불러오는 중입니다…
          </p>
        ) : null}
        {list.status === "error" ? (
          <div className="px-4 py-12 text-center">
            <p className="text-body font-semibold text-ink">{list.message}</p>
            <button type="button" onClick={reload} className={`${ADMIN_SECONDARY_BUTTON_CLASS} mt-4`}>
              다시 불러오기
            </button>
          </div>
        ) : null}
        {list.status === "loaded" ? (
          list.posts.length === 0 ? (
            <EmptyState message="등록된 게시물이 없습니다" />
          ) : (
            <ul>
              {list.posts.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border-soft py-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-ink">
                      {post.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
                      <span>{post.type === "link" ? "링크형" : "작성형"}</span>
                      <span>{post.category === "notice" ? "공지사항" : "금융노조 소식"}</span>
                      <time dateTime={post.publishedAt}>{formatEntryDate(post.publishedAt)}</time>
                      {post.urgent ? <UrgentBadge /> : null}
                      {post.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <DocumentIcon className="size-4" />
                          {post.attachments.length}
                        </span>
                      ) : null}
                      {post.deletedAt !== null ? (
                        <span className="font-semibold text-urgent-strong">삭제됨</span>
                      ) : null}
                    </span>
                  </span>
                  {post.deletedAt === null ? (
                    <span className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(post)}
                        className={ADMIN_SECONDARY_BUTTON_CLASS}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(post)}
                        className={ADMIN_DANGER_BUTTON_CLASS}
                      >
                        삭제
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {deleting !== null ? (
        <DeleteDialog
          title={deleting.title}
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
