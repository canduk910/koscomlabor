"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createGuestbookEntry,
  getGuestbookConnection,
  listGuestbookEntries,
  type GuestbookEntry,
} from "@/lib/api/guestbook";
import { formatEntryDate } from "@/lib/date";
import { ConstructionIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/board/EmptyState";

/** 백엔드 한도와 동일 수치 (06 명세 §4.2 — trim 후 코드포인트 기준) */
const AUTHOR_MAX_LENGTH = 20;
const BODY_MAX_LENGTH = 500;

/**
 * 방명록 준비 중 카드 (스펙 §7.1 · 표면 §16.9.8).
 * 비활성 폼을 보여주는 방식 금지 — 폼 자체를 렌더하지 않는다.
 * 표면은 L2 면(rounded-panel + bg-surface) 단독 — 테두리 제거(§16.5 2중 적용 시정).
 */
function PreparingCard() {
  return (
    <div className="rounded-panel bg-surface px-6 py-12 text-center">
      <ConstructionIcon className="mx-auto size-10 text-border-strong" />
      {/* §15.9.1: 방명록 섹션 h2 아래에 놓이므로 h3 (text-h2 토큰 유지 — 시각 변화 0) */}
      <h3 className="mt-4 text-h2 text-ink">방명록 준비 중입니다</h3>
      <p className="mt-2 text-body font-normal text-ink-muted">
        방명록 기능을 준비하고 있습니다. 준비가 끝나면 이곳에서 글을 남길 수
        있습니다.
      </p>
    </div>
  );
}

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; entries: GuestbookEntry[] };

interface Feedback {
  kind: "success" | "error";
  message: string;
}

/*
 * §16.13.1: 입력 필드 radius 16px(rounded-card — 필드 높이 56px 과 균형), 버튼은 rounded-full.
 * 필드 보더 색 border-strong(4.83 UI)은 **변경 0** — 컨트롤은 테두리가 의미다(§16.5 "컨트롤" 층).
 * 컨트롤에는 그림자를 주지 않는다.
 */
const FIELD_CLASS =
  "rounded-card w-full border border-border-strong bg-bg text-body text-ink focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2";

/* h-14(56px)은 입력 필드 높이와 같은 값 — 44px 최소 터치 대상을 상회한다(§16.17) */
const BUTTON_CLASS =
  "ease-out-soft h-14 rounded-full bg-primary-strong px-8 text-body font-bold text-white transition-transform duration-200 hover:outline-2 hover:outline-primary-strong hover:outline-offset-2 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5";

/** 작성 폼 + 글 목록 (스펙 §7.2 — 백엔드 연결 시) */
function GuestbookBoard() {
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // 목록 로드 — setState는 비동기 콜백에서만 (초기 상태가 이미 "loading")
  useEffect(() => {
    let cancelled = false;
    void listGuestbookEntries().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setListState({ status: "loaded", entries: result.data });
      } else {
        setListState({ status: "error", message: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reloadEntries = useCallback(() => {
    setListState({ status: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedAuthor = author.trim();
    const trimmedBody = body.trim();
    if (trimmedAuthor.length === 0 || trimmedBody.length === 0) {
      setFeedback({
        kind: "error",
        message: "닉네임과 내용을 모두 입력해 주세요.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const result = await createGuestbookEntry({
      author: trimmedAuthor,
      body: trimmedBody,
    });
    setSubmitting(false);

    if (result.ok) {
      setAuthor("");
      setBody("");
      setFeedback({ kind: "success", message: "방명록에 글을 등록했습니다." });
      if (listState.status === "loaded") {
        setListState({
          status: "loaded",
          entries: [result.data, ...listState.entries],
        });
      } else {
        // 목록이 로딩/에러 상태였다면 등록 성공을 계기로 전체 재조회
        reloadEntries();
      }
    } else {
      // rate-limited / validation / network — 서버의 한국어 안내를 그대로 표시
      setFeedback({ kind: "error", message: result.message });
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label
            htmlFor="guestbook-author"
            className="mb-2 block text-body font-semibold text-ink"
          >
            닉네임
          </label>
          <input
            id="guestbook-author"
            name="author"
            type="text"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            maxLength={AUTHOR_MAX_LENGTH}
            required
            className={`${FIELD_CLASS} h-14 px-4`}
          />
        </div>

        <div className="mt-6">
          <label
            htmlFor="guestbook-body"
            className="mb-2 block text-body font-semibold text-ink"
          >
            내용
          </label>
          <textarea
            id="guestbook-body"
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={BODY_MAX_LENGTH}
            required
            className={`${FIELD_CLASS} min-h-40 p-4`}
          />
          <p className="mt-2 text-caption text-ink-muted">
            {body.length}/{BODY_MAX_LENGTH}자
          </p>
        </div>

        <button type="submit" disabled={submitting} className={`${BUTTON_CLASS} mt-6`}>
          {submitting ? "등록 중…" : "등록"}
        </button>

        <p
          role="status"
          className={`mt-2 text-caption ${
            feedback?.kind === "error" ? "text-urgent-strong" : "text-ink"
          }`}
        >
          {feedback?.message ?? ""}
        </p>
      </form>

      <div className="mt-10">
        {listState.status === "loading" ? (
          <p role="status" className="px-4 py-12 text-center text-caption text-ink-muted">
            방명록을 불러오는 중입니다…
          </p>
        ) : null}

        {listState.status === "error" ? (
          <div className="px-4 py-12 text-center">
            <p className="text-body font-semibold text-ink">{listState.message}</p>
            <button type="button" onClick={reloadEntries} className={`${BUTTON_CLASS} mt-4`}>
              다시 불러오기
            </button>
          </div>
        ) : null}

        {listState.status === "loaded" ? (
          listState.entries.length === 0 ? (
            <EmptyState message="아직 남겨진 글이 없습니다" />
          ) : (
            /* §16.13.2: 구분선 의존 목록을 폐기하고 L1 카드 스택으로 교체(게시물 목록과 같은
               언어). 카드의 분리 수단은 shadow-card 하나뿐이다 — 테두리를 더하지 말 것 */
            <ul className="flex flex-col gap-3">
              {listState.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-card bg-bg shadow-card p-5"
                >
                  {/* §5 패턴 재사용 — 링크 없음, 제목 대신 내용 첫 줄 (스펙 §7.2) */}
                  <p className="line-clamp-2 text-body font-semibold text-ink">
                    {entry.body.split("\n")[0]}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
                    <span>{entry.author}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={entry.createdAt}>
                      {formatEntryDate(entry.createdAt)}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}

/**
 * 방명록 탭 패널.
 * - NEXT_PUBLIC_API_BASE_URL 미설정: 준비 중 카드만 렌더 (스펙 §7.1, 가짜 동작 금지)
 * - 설정: 작성 폼 + 글 목록 (스펙 §7.2, 06 백엔드 명세 연동)
 */
export function GuestbookPanel() {
  const connection = getGuestbookConnection();

  if (connection.status === "unconfigured") {
    return <PreparingCard />;
  }

  return <GuestbookBoard />;
}
