"use client";

import { useRef, useState } from "react";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  ATTACHMENT_MIME_TYPES,
  ATTACHMENT_ACCEPT,
  type AdminPostInput,
  type ApiAdminPost,
  adminCreatePost,
  adminDeleteAttachment,
  adminPreviewLink,
  adminUpdatePost,
  adminUploadAttachment,
} from "@/lib/api/admin";
import type { PostCategory, PostType } from "@/lib/api/posts";
import { POST_CATEGORY_LABELS, POST_CATEGORY_ORDER } from "@/lib/postCategories";
import { formatFileSize } from "@/lib/postView";
import { DocumentIcon } from "@/components/ui/icons";
import {
  ADMIN_DANGER_BUTTON_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_HINT_CLASS,
  ADMIN_LABEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from "@/components/admin/styles";

type PreviewState = "idle" | "loading" | "done" | "failed";

interface ExistingAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
}

interface PostFormProps {
  /** 수정 모드면 대상 게시물, 신규면 null */
  initial: ApiAdminPost | null;
  /**
   * 저장 성공 시 호출. 결과 문구를 인자로 넘긴다 — 이 콜백이 폼을 언마운트하므로
   * ⚠ 결과를 폼 안에 표시하지 마라. 부모의 상시 `role="status"` 영역에 띄워야 읽힌다
   * (특히 "첨부 일부 실패" 경고가 사라지면 부분 실패를 모르게 된다).
   */
  onSaved: (notice: string) => void;
  onCancel: () => void;
}

/** 유형/카테고리 라디오 — §4.2 탭 시각 스타일 (시맨틱은 radio, ARIA tabs 아님 — §14.4) */
function RadioPill({
  name,
  value,
  checked,
  label,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`min-h-touch inline-flex cursor-pointer items-center rounded-full px-4 text-body has-focus-visible:outline-3 has-focus-visible:outline-primary has-focus-visible:outline-offset-2 ${
        checked ? "bg-primary-strong font-bold text-white" : "font-medium text-ink-muted"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

/**
 * admin 게시물 등록/수정 폼 (§14.4).
 * - 유형을 바꿔도 입력값은 유지한다(실수 방지). 자동 제목은 3상태이고 제목은 항상 편집 가능하다.
 * - 파일은 클라이언트에서 선검증한 뒤 저장 시 순차 업로드한다.
 * - publishedAt 은 서버가 자동 기록하므로 폼에 없다.
 */
export function PostForm({ initial, onSaved, onCancel }: PostFormProps) {
  const [type, setType] = useState<PostType>(initial?.type ?? "article");
  const [category, setCategory] = useState<PostCategory>(initial?.category ?? "notice");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [urgent, setUrgent] = useState(initial?.urgent ?? false);
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");

  const [preview, setPreview] = useState<PreviewState>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<ExistingAttachment[]>(
    initial?.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sourceRequired = category === "news" && type === "article";

  async function fetchPreview() {
    if (url.trim().length === 0) {
      setFeedback({ kind: "error", message: "URL을 먼저 입력해 주세요." });
      return;
    }
    setPreview("loading");
    const result = await adminPreviewLink(url.trim());
    if (result.ok) {
      setTitle(result.data.title);
      setPreview("done");
    } else {
      setPreview("failed");
      titleRef.current?.focus(); // 수동 입력 폴백 (§14.4)
    }
  }

  function addFiles(picked: FileList | null) {
    if (picked === null) return;
    const next = [...files];
    const errors: string[] = [];
    for (const file of Array.from(picked)) {
      if (existing.length + next.length >= ATTACHMENT_MAX_FILES) {
        errors.push(`첨부는 게시물당 ${ATTACHMENT_MAX_FILES}개까지입니다.`);
        break;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        errors.push(`${file.name}: 파일당 최대 10MB를 초과합니다.`);
        continue;
      }
      if (!ATTACHMENT_MIME_TYPES.includes(file.type)) {
        errors.push(`${file.name}: 허용되지 않는 형식입니다 (PDF·PNG·JPG·WEBP).`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    setFeedback(errors.length > 0 ? { kind: "error", message: errors.join(" ") } : null);
    if (fileInputRef.current !== null) fileInputRef.current.value = "";
  }

  async function removeExisting(id: string) {
    const result = await adminDeleteAttachment(id);
    if (result.ok) {
      setExisting((current) => current.filter((a) => a.id !== id));
      setFeedback({ kind: "success", message: "첨부를 삭제했습니다." });
    } else {
      setFeedback({ kind: "error", message: result.message });
    }
  }

  function validate(): string | null {
    if (title.trim().length === 0) return "제목을 입력해 주세요.";
    if (type === "link" && url.trim().length === 0) return "링크형은 URL이 필수입니다.";
    if (type === "article" && body.trim().length === 0) return "작성형은 본문이 필수입니다.";
    if (sourceRequired && source.trim().length === 0) return "소식(작성형)은 출처가 필수입니다.";
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const error = validate();
    if (error !== null) {
      setFeedback({ kind: "error", message: error });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const input: AdminPostInput = {
      category,
      type,
      title: title.trim(),
      body: body.trim().length > 0 ? body.trim() : undefined,
      url: type === "link" ? url.trim() : undefined,
      // 빈 입력 정규화: 수정 모드는 명시적 null(= 기존 출처 삭제), 신규는 키 생략.
      // ⚠ undefined 로만 보내지 마라 — PATCH 병합에서 키가 빠져, 출처를 비우고 저장했는데
      // 카드에 그대로 표시되는 조용한 실패가 된다.
      source: source.trim().length > 0 ? source.trim() : initial !== null ? null : undefined,
      urgent,
      deadline: deadline.length > 0 ? deadline : initial !== null ? null : undefined,
    };

    const saved =
      initial === null
        ? await adminCreatePost(input)
        : await adminUpdatePost(initial.id, input);

    if (!saved.ok) {
      setSaving(false);
      setFeedback({ kind: "error", message: saved.message });
      return;
    }

    // 첨부 순차 업로드 — 실패 파일은 개별 보고하고 게시물 저장 자체는 유지한다
    const uploadErrors: string[] = [];
    for (const file of files) {
      setFeedback({ kind: "success", message: `파일 업로드 중: ${file.name}…` });
      const uploaded = await adminUploadAttachment(saved.data.id, file);
      if (!uploaded.ok) uploadErrors.push(uploaded.message);
    }

    setSaving(false);
    // 문구는 부모의 상시 status 영역에 남긴다 — onSaved 가 폼을 언마운트한다
    const notice =
      uploadErrors.length > 0
        ? `게시물은 저장했지만 일부 첨부 업로드에 실패했습니다: ${uploadErrors.join(" ")}`
        : "게시물을 저장했습니다.";
    onSaved(notice);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4">
      <fieldset>
        <legend className={ADMIN_LABEL_CLASS}>글 유형</legend>
        <div className="inline-flex gap-1 rounded-full bg-surface p-1">
          <RadioPill
            name="post-type"
            value="link"
            checked={type === "link"}
            label="링크형"
            onChange={() => setType("link")}
          />
          <RadioPill
            name="post-type"
            value="article"
            checked={type === "article"}
            label="직접 작성형"
            onChange={() => setType("article")}
          />
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className={ADMIN_LABEL_CLASS}>카테고리</legend>
        {/* ⚠ 선택지를 하드코딩하지 마라 — POST_CATEGORY_ORDER 파생이라야 새 분류를 등록할 수 있다.
            flex-wrap 은 3선택지 합이 360px 콘텐츠 폭을 넘기 때문이다 */}
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-surface p-1">
          {POST_CATEGORY_ORDER.map((option) => (
            <RadioPill
              key={option}
              name="post-category"
              value={option}
              checked={category === option}
              label={POST_CATEGORY_LABELS[option]}
              onChange={() => setCategory(option)}
            />
          ))}
        </div>
      </fieldset>

      {type === "link" ? (
        <div className="mt-4">
          <label htmlFor="post-url" className={ADMIN_LABEL_CLASS}>
            URL (필수)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="post-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={`${ADMIN_FIELD_CLASS} h-12 flex-1 px-3`}
            />
            <button
              type="button"
              onClick={fetchPreview}
              disabled={preview === "loading"}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              정보 가져오기
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <label htmlFor="post-title" className={ADMIN_LABEL_CLASS}>
          제목 (필수)
        </label>
        <input
          id="post-title"
          ref={titleRef}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={300}
          className={`${ADMIN_FIELD_CLASS} h-12 px-3`}
        />
        <p
          role="status"
          className={`mt-1 text-caption ${
            preview === "failed" ? "text-urgent-strong" : "text-ink-muted"
          }`}
        >
          {preview === "loading" ? "제목을 가져오는 중…" : ""}
          {preview === "done" ? "가져온 제목입니다. 수정할 수 있습니다." : ""}
          {preview === "failed" ? "제목을 가져오지 못했습니다. 직접 입력해 주세요." : ""}
        </p>
      </div>

      {type === "article" ? (
        <div className="mt-4">
          <label htmlFor="post-body" className={ADMIN_LABEL_CLASS}>
            본문 (필수)
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${ADMIN_FIELD_CLASS} min-h-60 px-3 py-2`}
          />
          <p className={ADMIN_HINT_CLASS}>
            마크다운 형식으로 작성할 수 있습니다 (제목 ##, 목록 -, 링크 등)
          </p>
        </div>
      ) : null}

      {/* 출처는 **유형 공통** 필드다(§14.4) — 링크형 카드도 채널명을 렌더하고, 그 표기가
          fact-verifier 게이트 조건의 이행 수단이라 입력 수단이 없으면 값을 유지할 수 없다.
          ⚠ 필수 여부를 확장하지 마라 — 출처 필수는 소식+작성형만이다(의도된 비대칭) */}
      <div className="mt-4">
        <label htmlFor="post-source" className={ADMIN_LABEL_CLASS}>
          출처{sourceRequired ? " (필수)" : ""}
        </label>
        <input
          id="post-source"
          type="text"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          maxLength={200}
          className={`${ADMIN_FIELD_CLASS} h-12 px-3`}
        />
        {type === "link" ? (
          <p className={ADMIN_HINT_CLASS}>
            채널명·발행처를 적습니다. 목록 카드에 표시되어 조합원이 자료의 출처를 구분할 수
            있습니다.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label className="flex min-h-touch cursor-pointer items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(event) => setUrgent(event.target.checked)}
            className="size-6 accent-primary-strong"
          />
          긴급 공지로 표시 — 메인 히어로에 노출됩니다
        </label>
      </div>

      <div className="mt-4">
        <label htmlFor="post-deadline" className={ADMIN_LABEL_CLASS}>
          마감일
        </label>
        <input
          id="post-deadline"
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className={`${ADMIN_FIELD_CLASS} h-12 px-3`}
        />
      </div>

      <div className="mt-4">
        <span className={ADMIN_LABEL_CLASS}>파일 첨부</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          onChange={(event) => addFiles(event.target.files)}
          className="sr-only"
          id="post-files"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={ADMIN_SECONDARY_BUTTON_CLASS}
        >
          파일 선택
        </button>
        <p className="mt-1 text-caption text-ink-muted">
          PDF·PNG·JPG·WEBP, 파일당 최대 10MB, 게시물당 {ATTACHMENT_MAX_FILES}개
        </p>
        {existing.length > 0 || files.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {existing.map((attachment) => (
              <li key={attachment.id} className="flex items-center gap-3">
                <DocumentIcon className="size-5 shrink-0 text-border-strong" />
                <span className="min-w-0 flex-1 truncate text-caption text-ink">
                  {attachment.filename}{" "}
                  <span className="text-ink-muted">({formatFileSize(attachment.sizeBytes)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeExisting(attachment.id)}
                  className={ADMIN_DANGER_BUTTON_CLASS}
                >
                  제거
                </button>
              </li>
            ))}
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3">
                <DocumentIcon className="size-5 shrink-0 text-border-strong" />
                <span className="min-w-0 flex-1 truncate text-caption text-ink">
                  {file.name}{" "}
                  <span className="text-ink-muted">({formatFileSize(file.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  className={ADMIN_DANGER_BUTTON_CLASS}
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={ADMIN_PRIMARY_BUTTON_CLASS}>
          {saving ? "저장 중…" : initial === null ? "등록" : "수정 저장"}
        </button>
        <button type="button" onClick={onCancel} className={ADMIN_SECONDARY_BUTTON_CLASS}>
          취소
        </button>
      </div>
      <p
        role="status"
        className={`mt-2 text-caption ${
          feedback?.kind === "error" ? "text-urgent-strong" : "text-ink"
        }`}
      >
        {feedback?.message ?? ""}
      </p>
    </form>
  );
}
