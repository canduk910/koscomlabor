"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  type ApiAdminPost,
  adminListPosts,
  adminReorderPosts,
} from "@/lib/api/admin";
import type { PostCategory } from "@/lib/api/posts";
import { POST_CATEGORY_LABELS, POST_CATEGORY_ORDER } from "@/lib/postCategories";
import { formatEntryDate } from "@/lib/date";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";
import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

/**
 * 게시물 순서 지정 패널 (스펙 §16.15 · 정렬 계약 §3·§8) — admin 신규.
 *
 * ## 저장 방식: 로컬 재배치 + 명시적 "순서 저장" (즉시 저장 아님 — §16.15.1)
 * 위/아래 이동은 본질적으로 여러 번 누르는 조작이다. 누를 때마다 네트워크 왕복이면 응답 순서
 * 역전을 막기 위해 매번 전체를 비활성화해야 하고 조작이 불가능해진다. 또 계약 §3 의 409 검사는
 * **전체 순열 1회 검사**이므로 저장을 잘게 쪼개면 충돌 창이 그만큼 늘어난다.
 * 저장 전 상태는 "저장되지 않은 순서 변경이 있습니다" 문구 + "원래 순서로" 버튼으로 가시화한다.
 *
 * ## 분류별 패널인 이유
 * 계약 §3 은 `ids` 가 **해당 분류 활성 게시물 전체의 순열**이어야 한다고 규정한다(409 조건).
 * 현행 admin 목록은 전 분류 + 삭제분이 섞여 있어 그대로는 순열을 만들 수 없다.
 * 전체 목록은 이 패널 아래에 **그대로 남아 있으므로 은폐가 아니다**(§0.4).
 * 분류 라디오의 "선택됨" 표시는 허용된다 — §15.4 의 활성 상태 금지는 조합원용 섹션
 * 바로가기에 대한 규칙이고, 여기서는 무엇을 정렬하는지 알 수 없으면 조작이 불가능하다.
 *
 * ## 조작 방식: 위/아래 이동 버튼 (리더 확정)
 * 드래그앤드롭은 키보드·스크린리더 비용이 크고, 숫자 직접 입력은 중복·누락 관리를 사용자에게
 * 떠넘긴다. 순번은 **숫자 배지로도** 보여준다(색·위치 단독 의존 금지).
 */

/** admin 목록 조회 상한 — 이 값에 도달하면 부분 목록일 수 있으므로 저장을 막는다(§16.15.4-1) */
const LIST_LIMIT = 100;

/**
 * 409 안내 문구 — **정렬 계약 §3 #4 의 문자열 그대로.**
 * 서버 message 를 그대로 쓰지 않고 상수로 고정하는 이유: 계약이 이 문구를 화면 표시 요건으로
 * 규정하므로, 프록시가 본문을 갈아치우거나 서버 문구가 바뀌어도 요건이 깨지지 않아야 한다.
 */
const CONFLICT_MESSAGE = "목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.";

/**
 * 저장 성공 문구 — **부모(`AdminApp` 의 상시 `role="status"`)가 표시한다.**
 * 이 패널의 라이브 리전에는 넣지 않는다: 두 리전이 같은 문장을 동시에 가지면 스크린리더가
 * 두 번 읽고 어느 쪽이 권위인지 알 수 없다(리더 판정 2).
 * 프로젝트 규약 = **성공 문구는 부모, 맥락 에러는 패널.**
 * (비밀번호 변경 폼에서 같은 문제를 이미 겪었다 — 성공 직후 폼이 언마운트돼 문구가 사라졌고,
 *  그래서 성공 문구를 부모의 상시 status 로 옮겼다.)
 */
const SAVED_MESSAGE = "순서를 저장했습니다.";

const RESTORED_MESSAGE = "원래 순서로 되돌렸습니다.";

const DIRTY_MESSAGE = "저장되지 않은 순서 변경이 있습니다";

const LIMIT_MESSAGE =
  "게시물이 100건을 넘어 이 화면에서는 순서를 지정할 수 없습니다.";

/**
 * 필수 안내 문구 — 계약 §2 의 정렬 규칙이 `urgent DESC` 를 `sort_order` 보다 **앞**에 두므로
 * urgent 게시물은 지정 순서와 다르게 맨 위에 나온다. 이 사실을 화면에 쓰지 않으면 관리자는
 * "순서 지정이 동작하지 않는다"고 판단한다. **삭제하지 말 것.**
 */
const URGENT_NOTE =
  "긴급으로 표시된 게시물은 공개 목록에서 지정 순서와 무관하게 맨 위에 표시됩니다.";

type Direction = "up" | "down";

interface MoveButtonRefs {
  up: HTMLButtonElement | null;
  down: HTMLButtonElement | null;
}

type PanelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** baseline = 로드 시점의 id 순서. dirty 판정과 "원래 순서로" 의 정본 */
  | { status: "loaded"; posts: ApiAdminPost[]; baseline: readonly string[] };

/**
 * 패널 표시 순서 (§16.15.4-1): `sortOrder` 오름차순(미지정은 맨 뒤) → `publishedAt` 내림차순
 * → `id` 내림차순.
 * **`urgent` 를 정렬 키로 쓰지 않는다** — 이 패널은 "지정 순서"를 보여주는 화면이고,
 * urgent 우선은 공개 목록의 렌더 규칙이다(그 사실은 URGENT_NOTE 가 알린다).
 */
function comparePanelOrder(a: ApiAdminPost, b: ApiAdminPost): number {
  const left = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const right = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (left !== right) return left - right;
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

const MOVE_BUTTON_CLASS =
  "size-touch inline-flex items-center justify-center rounded-lg border border-border-strong bg-bg " +
  "text-primary hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-primary " +
  "focus-visible:outline-offset-2 disabled:border-border-soft disabled:text-border-strong " +
  "disabled:hover:bg-bg";

const CATEGORY_CHIP_CLASS =
  "inline-flex min-h-touch cursor-pointer items-center rounded-full border border-border-strong " +
  "bg-bg px-4 text-body font-semibold text-primary peer-checked:border-primary " +
  "peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-3 " +
  "peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2";

interface SortPanelProps {
  /** 저장 성공 시 — 부모가 결과 문구를 표시하고 전체 목록을 재조회한다(§16.15.4-5) */
  onSaved: (notice: string) => void;
  onClose: () => void;
  onSessionExpired: () => void;
}

export function SortPanel({ onSaved, onClose, onSessionExpired }: SortPanelProps) {
  const [category, setCategory] = useState<PostCategory>(POST_CATEGORY_ORDER[0]);
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const buttonRefs = useRef(new Map<string, MoveButtonRefs>());

  // 프롭 콜백을 ref 로 잡아 로드 효과의 의존성에서 제외한다 — 부모가 매 렌더마다 새 함수를
  // 만들면(AdminApp 의 인라인 핸들러) 의존성에 넣는 순간 무한 재조회가 된다.
  const sessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    sessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  // 목록 로드. status: "loading" 전환은 이 효과를 트리거한 핸들러가 직접 수행한다
  // (초기 상태가 이미 "loading" 이므로 효과 안에서 setState 를 반복하지 않는다).
  useEffect(() => {
    let cancelled = false;
    void adminListPosts({ category, limit: LIST_LIMIT }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.reason === "unauthorized") {
          sessionExpiredRef.current();
          return;
        }
        setState({ status: "error", message: result.message });
        return;
      }
      // 계약 §3 의 순열 조건은 `deleted_at IS NULL` 기준 — 삭제분은 표시하지 않는다
      const posts = result.data
        .filter((post) => post.deletedAt === null)
        .sort(comparePanelOrder);
      buttonRefs.current.clear();
      setState({ status: "loaded", posts, baseline: posts.map((post) => post.id) });
    });
    return () => {
      cancelled = true;
    };
  }, [category, reloadToken]);

  function registerButton(
    id: string,
    direction: Direction,
    node: HTMLButtonElement | null,
  ) {
    const map = buttonRefs.current;
    const current = map.get(id) ?? { up: null, down: null };
    const next: MoveButtonRefs = { up: current.up, down: current.down };
    if (direction === "up") next.up = node;
    else next.down = node;
    map.set(id, next);
  }

  /** 재조회 — alertMessage 는 **지우지 않는다**(409 문구가 사라지면 저장됐다고 오해한다) */
  function reloadPanel() {
    setState({ status: "loading" });
    setReloadToken((token) => token + 1);
  }

  function handleCategoryChange(next: PostCategory) {
    if (next === category || saving) return;
    setCategory(next);
    setState({ status: "loading" });
    setStatusMessage("");
    setAlertMessage("");
  }

  function handleMove(id: string, direction: Direction) {
    if (state.status !== "loaded" || saving) return;
    const index = state.posts.findIndex((post) => post.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= state.posts.length) return;

    const posts = state.posts.slice();
    const moved = posts[index];
    const displaced = posts[target];
    posts[index] = displaced;
    posts[target] = moved;

    /*
     * §16.15.4-3 포커스 유지 (필수): 행은 key={post.id} 로 렌더하므로 DOM 노드가 이동해
     * 포커스는 자동 유지된다. 단 **이동으로 그 버튼이 disabled 가 되면**(첫/마지막 행에 도달)
     * 브라우저가 포커스를 잃는다 → 같은 게시물의 반대 방향 버튼으로 옮긴다.
     * flushSync 로 커밋을 동기 완료시킨 뒤 포커스를 옮긴다 — 효과 안에서 setState 를 다시
     * 호출하는 방식(연쇄 렌더)을 피한다. 이벤트 핸들러 안이라 flushSync 사용이 안전하다.
     */
    flushSync(() => {
      setState({ status: "loaded", posts, baseline: state.baseline });
      setAlertMessage("");
      setStatusMessage(
        `${moved.title} — ${target + 1}번째로 이동했습니다 (총 ${posts.length}건)`,
      );
    });

    const refs = buttonRefs.current.get(id);
    if (refs === undefined) return;
    const becomesDisabled =
      direction === "up" ? target === 0 : target === posts.length - 1;
    const focusDirection: Direction = becomesDisabled
      ? direction === "up"
        ? "down"
        : "up"
      : direction;
    const focusTarget = focusDirection === "up" ? refs.up : refs.down;
    focusTarget?.focus();
  }

  function handleRestore() {
    if (state.status !== "loaded" || saving) return;
    const byId = new Map(state.posts.map((post) => [post.id, post]));
    const restored: ApiAdminPost[] = [];
    for (const id of state.baseline) {
      const post = byId.get(id);
      if (post !== undefined) restored.push(post);
    }
    setState({ status: "loaded", posts: restored, baseline: state.baseline });
    setAlertMessage("");
    setStatusMessage(RESTORED_MESSAGE);
  }

  async function handleSave() {
    if (state.status !== "loaded" || saving) return;
    setSaving(true);
    setAlertMessage("");
    const result = await adminReorderPosts(
      category,
      state.posts.map((post) => post.id),
    );
    setSaving(false);

    if (result.ok) {
      // 성공 문구는 부모만 표시한다(리더 판정 2 — 이중 낭독 제거). 패널의 라이브 리전은
      // 비운다: 직전 이동 안내("n번째로 이동했습니다")가 남으면 저장 후 상태를 오해하게 된다.
      setStatusMessage("");
      reloadPanel(); // 패널 목록 재조회(sortOrder 반영) → dirty 해제
      onSaved(SAVED_MESSAGE); // 부모가 notice 표시 + 전체 목록 재조회
      return;
    }
    if (result.reason === "unauthorized") {
      onSessionExpired();
      return;
    }
    if (result.reason === "conflict") {
      // 계약 §8: 낡은 순서로 재시도하게 두지 않는다 — 즉시 재조회 + 로컬 순서 폐기
      setStatusMessage("");
      setAlertMessage(CONFLICT_MESSAGE);
      reloadPanel();
      return;
    }
    // validation·network·rate-limited: 서버 문구를 표시하고 **로컬 순서는 유지**(재시도 가능)
    setAlertMessage(result.message);
  }

  const posts = state.status === "loaded" ? state.posts : [];
  const dirty =
    state.status === "loaded" &&
    state.posts.some((post, index) => post.id !== state.baseline[index]);
  const limitReached = posts.length >= LIST_LIMIT;
  const lastIndex = posts.length - 1;

  return (
    <div className="rounded-badge mt-4 border border-border-soft p-4">
      <h3 className="text-body font-bold text-ink">게시물 순서 지정</h3>

      <fieldset className="mt-4">
        <legend className="text-caption font-semibold text-ink">분류</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {POST_CATEGORY_ORDER.map((value) => (
            <label key={value}>
              {/* 실제 <input type="radio"> — 화살표 키 이동·스크린리더 그룹 안내가 네이티브로 동작 */}
              <input
                type="radio"
                name="sort-category"
                value={value}
                checked={category === value}
                onChange={() => handleCategoryChange(value)}
                className="peer sr-only"
              />
              <span className={CATEGORY_CHIP_CLASS}>
                {POST_CATEGORY_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-2 text-caption text-ink-muted">{URGENT_NOTE}</p>

      {limitReached ? (
        <p role="alert" className="mt-2 text-caption text-urgent-strong">
          {LIMIT_MESSAGE}
        </p>
      ) : null}

      {state.status === "loading" ? (
        <p role="status" className="mt-4 text-caption text-ink-muted">
          게시물 목록을 불러오는 중입니다…
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4">
          <p className="text-body font-semibold text-ink">{state.message}</p>
          <button
            type="button"
            onClick={reloadPanel}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} mt-3`}
          >
            다시 불러오기
          </button>
        </div>
      ) : null}

      {state.status === "loaded" ? (
        posts.length === 0 ? (
          <p className="mt-4 text-body text-ink-muted">
            이 분류에 순서를 지정할 게시물이 없습니다.
          </p>
        ) : (
          <ul className="mt-4">
            {posts.map((post, index) => (
              <li
                key={post.id}
                className="flex items-center gap-3 border-b border-border-soft py-3"
              >
                {/* 순번 배지 32×32 — bg-primary-soft + text-primary 9.23 AAA */}
                <span className="rounded-badge bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center text-caption font-bold">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {/* 360px 검산: 가용 152px → 1줄 truncate 가 유일한 선택 */}
                  <span className="block truncate text-body font-semibold text-ink">
                    {post.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
                    <time dateTime={post.publishedAt}>
                      {formatEntryDate(post.publishedAt)}
                    </time>
                    {post.urgent ? <UrgentBadge /> : null}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {/* 아이콘만이므로 aria-label 필수 — 제목 + 방향 + 현재 순번 */}
                  <button
                    type="button"
                    ref={(node) => registerButton(post.id, "up", node)}
                    disabled={index === 0 || saving}
                    onClick={() => handleMove(post.id, "up")}
                    aria-label={`${post.title} — 위로 이동 (현재 ${index + 1}번째)`}
                    className={MOVE_BUTTON_CLASS}
                  >
                    <ArrowUpIcon className="size-5" />
                  </button>
                  <button
                    type="button"
                    ref={(node) => registerButton(post.id, "down", node)}
                    disabled={index === lastIndex || saving}
                    onClick={() => handleMove(post.id, "down")}
                    aria-label={`${post.title} — 아래로 이동 (현재 ${index + 1}번째)`}
                    className={MOVE_BUTTON_CLASS}
                  >
                    <ArrowDownIcon className="size-5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {/* 저장 전 상태의 가시화 (§16.15.1) — 라이브 리전이 아니다(이동 안내와 중복 낭독 방지) */}
      {dirty ? (
        <p className="mt-3 text-caption font-semibold text-ink">{DIRTY_MESSAGE}</p>
      ) : null}

      {/*
        이동·복원 안내. 스크린리더 전용으로 숨기지 않는다 — 마우스 사용자도 결과 확인이 필요하다.
        **저장 성공 문구는 여기 넣지 않는다**(부모의 상시 status 담당 — 리더 판정 2).
      */}
      <p role="status" className="mt-3 text-caption text-ink">
        {statusMessage}
      </p>
      {/*
        실패·409 문구는 **패널이 담당한다**: 어느 패널에서 실패했는지가 맥락이고, 패널이 닫히지
        않으므로 사라지지 않는다. 409 문구는 재조회 후에도 지우지 않는다 — 사라지면 관리자가
        자기 작업이 저장됐다고 오해한다(§16.15.4-5).
      */}
      <p role="alert" className="mt-1 text-caption text-urgent-strong">
        {alertMessage}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving || limitReached}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          {saving ? "저장 중…" : "순서 저장"}
        </button>
        <button
          type="button"
          onClick={handleRestore}
          disabled={!dirty || saving}
          className={ADMIN_SECONDARY_BUTTON_CLASS}
        >
          원래 순서로
        </button>
        <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON_CLASS}>
          {/* 확인 다이얼로그를 만들지 않는다 — 문구가 결과를 명시하고, 잃는 것은 아직 저장되지
              않은 순서뿐이다(§16.15.4-7) */}
          {dirty ? "저장하지 않고 닫기" : "닫기"}
        </button>
      </div>
    </div>
  );
}
