"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { POST_CATEGORY_LABELS } from "@/lib/postCategories";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { DocumentIcon, ConstructionIcon, WarningIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/board/EmptyState";
import { PostForm } from "@/components/admin/PostForm";
import { PasswordChangeForm } from "@/components/admin/PasswordChangeForm";
import { DeleteDialog } from "@/components/admin/DeleteDialog";
import { SortPanel } from "@/components/admin/SortPanel";
import {
  ADMIN_DANGER_BUTTON_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_LABEL_CLASS,
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
        <label htmlFor="admin-password" className={ADMIN_LABEL_CLASS}>
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
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  /** 순서 지정 패널 (§16.15) — PostForm·비밀번호 패널과 같은 슬롯이므로 상호 배타로 관리한다 */
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  /** GET /admin/me 의 passwordIsInitial (계약 §1) — 초기 비밀번호 경고 배너 노출 조건 */
  const [passwordIsInitial, setPasswordIsInitial] = useState(false);
  const [meToken, setMeToken] = useState(0);
  const passwordButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);

  // 세션 확인 + 초기 비밀번호 여부 조회 (비동기 콜백 setState).
  // 로그인 직후에도 meToken 을 올려 재조회한다 — 최초 진입에서 세션이 없으면
  // 이 효과의 결과가 "login"이라 passwordIsInitial 을 아직 알 수 없기 때문.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void adminMe().then((result) => {
      if (cancelled) return;
      if (result.ok) setPasswordIsInitial(result.data.passwordIsInitial);
      // phase 는 최초 진입에서만 이 조회가 결정한다. 로그인 직후 재조회(meToken > 0)에서
      // 일시적 통신 실패를 이유로 로그인 화면으로 되돌리지 않는다 —
      // 세션이 실제로 무효라면 이어지는 목록 조회가 로그인 화면으로 전환한다.
      if (meToken === 0) setPhase(result.ok ? "ready" : "login");
    });
    return () => {
      cancelled = true;
    };
  }, [configured, meToken]);

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
    return (
      <LoginForm
        onLoggedIn={() => {
          setPhase("ready");
          setMeToken((token) => token + 1); // passwordIsInitial 재조회 (배너 판정)
        }}
      />
    );
  }

  async function handleLogout() {
    await adminLogout();
    setPasswordPanelOpen(false);
    setSortPanelOpen(false);
    setPhase("login");
  }

  /**
   * 비밀번호 패널·PostForm·순서 지정 패널은 같은 슬롯을 공유하므로 동시에 열지 않는다
   * (§14.8.3 · §16.15.2 — 열려 있는 패널은 항상 1개다).
   */
  function openPasswordPanel() {
    setEditing(null);
    setSortPanelOpen(false);
    setPasswordPanelOpen(true);
  }

  function openPostForm(target: ApiAdminPost | "new") {
    setPasswordPanelOpen(false);
    setSortPanelOpen(false);
    setEditing(target);
  }

  function openSortPanel() {
    setEditing(null);
    setPasswordPanelOpen(false);
    setSortPanelOpen(true);
  }

  /** 닫을 때 포커스는 진입점("순서 지정" 버튼)으로 복귀 — passwordButtonRef 패턴 계승 */
  function closeSortPanel() {
    setSortPanelOpen(false);
    sortButtonRef.current?.focus();
  }

  function handleSortSaved(savedNotice: string) {
    setNotice(savedNotice);
    reload(); // 전체 목록도 새 순서로 재조회 (§16.15.4-5)
  }

  function handleSortSessionExpired() {
    setSortPanelOpen(false);
    setPhase("login");
  }

  /** 취소·성공 모두 포커스 복귀 대상은 헤더 버튼으로 고정 (배너 CTA는 성공 후 사라짐 — §14.8.6) */
  function closePasswordPanel() {
    setPasswordPanelOpen(false);
    passwordButtonRef.current?.focus();
  }

  function handlePasswordChanged(sessionsRevoked: number) {
    setPasswordPanelOpen(false);
    // 계약 §2: 한 번 변경하면 passwordIsInitial 은 영구 false —
    // /admin/me 재호출 없이 로컬 갱신으로 배너를 즉시 제거한다 (§14.8.2)
    setPasswordIsInitial(false);
    setNotice(
      sessionsRevoked > 0
        ? `비밀번호를 변경했습니다. 다른 기기의 로그인 ${sessionsRevoked}건이 해제되었습니다.`
        : "비밀번호를 변경했습니다. 이 브라우저의 로그인은 유지됩니다.",
    );
    passwordButtonRef.current?.focus();
  }

  /** reason "unauthorized" = 인증 수단 자체가 무효 → 세션 만료 처리 (계약 §3) */
  function handlePasswordSessionExpired() {
    setPasswordPanelOpen(false);
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
      {/*
        초기 비밀번호 경고 배너 (§14.8.2) — ready 뷰 최상단 첫 자식, 닫기 버튼 없음.
        라이브 리전(role="status"/"alert")을 붙이지 않는다: 최초 렌더에 포함되어 나타나므로
        중복·과잉 안내가 된다. <section aria-labelledby> 랜드마크로 건너뛰기·되찾기를 지원.
        색은 urgent(적색)가 아니라 accent(오렌지) — 오류가 아닌 상시 주의 환기 (§14.8.1).
      */}
      {passwordIsInitial ? (
        <section
          aria-labelledby="initial-password-title"
          className="rounded-badge mb-4 border-l-4 border-accent-strong bg-accent-tint p-4 md:px-5"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex flex-1 items-start gap-3">
              <WarningIcon className="mt-1 size-6 shrink-0 text-accent-strong" />
              <div className="min-w-0">
                <h2 id="initial-password-title" className="text-body font-bold text-accent-strong">
                  주의 — 초기 비밀번호를 사용 중입니다
                </h2>
                <p className="mt-1 text-caption text-ink">
                  배포할 때 발급된 초기 비밀번호를 아직 한 번도 바꾸지 않았습니다. 지금 변경해
                  주세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openPasswordPanel}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} w-full md:w-auto md:shrink-0`}
            >
              비밀번호 변경
            </button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 text-ink">게시물 관리</h2>
        {/* flex-wrap: 360px 에서 버튼 합이 콘텐츠 폭(328px)을 넘는다 — §16.15.2 로 4버튼이 되어
            2행으로 래핑된다(기존 flex-wrap 이 그대로 흡수) */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openPostForm("new")}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            새 게시물
          </button>
          <button
            type="button"
            ref={sortButtonRef}
            onClick={openSortPanel}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            순서 지정
          </button>
          <button
            type="button"
            ref={passwordButtonRef}
            onClick={openPasswordPanel}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            비밀번호 변경
          </button>
          <button type="button" onClick={handleLogout} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            로그아웃
          </button>
        </div>
      </div>

      <p role="status" className="mt-2 text-caption text-ink">
        {notice ?? ""}
      </p>

      {passwordPanelOpen ? (
        <div className="rounded-badge mt-4 border border-border-soft p-4">
          <h3 className="text-body font-bold text-ink">비밀번호 변경</h3>
          <PasswordChangeForm
            onChanged={handlePasswordChanged}
            onCancel={closePasswordPanel}
            onSessionExpired={handlePasswordSessionExpired}
          />
        </div>
      ) : null}

      {/* 순서 지정 패널은 자체 래퍼(rounded-badge + border-border-soft)를 렌더한다 — §16.15.2 */}
      {sortPanelOpen ? (
        <SortPanel
          onSaved={handleSortSaved}
          onClose={closeSortPanel}
          onSessionExpired={handleSortSessionExpired}
        />
      ) : null}

      {editing !== null ? (
        <div className="rounded-badge mt-4 border border-border-soft p-4">
          <h3 className="text-body font-bold text-ink">
            {editing === "new" ? "새 게시물 등록" : "게시물 수정"}
          </h3>
          <PostForm
            initial={editing === "new" ? null : editing}
            onSaved={(savedNotice) => {
              setNotice(savedNotice); // 폼이 사라지므로 결과 문구는 여기서 표시한다
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
                      <span>{POST_CATEGORY_LABELS[post.category]}</span>
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
                        onClick={() => openPostForm(post)}
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
