import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { daysUntilKst, formatPostDate, toIsoDateString } from "@/lib/date";

/**
 * 콘텐츠 로더 — content/ 하위 markdown + frontmatter 파싱.
 *
 * 핵심 규약 (union-webapp-dev 스킬 §3):
 * `verified: true`가 아닌 파일은 목록에서 제외한다.
 * 이것이 "잘못된 정보를 조합원에게 전달하지 않는다" 원칙의 코드 수준 방어선이다.
 */

export type PostCategory = "notice" | "news" | "page";

/** 목록 렌더링에 필요한 게시물 요약 (클라이언트 컴포넌트로 직렬화 전달 가능한 평면 구조) */
export interface PostSummary {
  slug: string;
  title: string;
  /** ISO 날짜 (YYYY-MM-DD) — <time datetime> 용 */
  dateIso: string;
  /** 표시용 게시일 (YYYY.MM.DD, Intl 계산) */
  dateLabel: string;
  /** 정렬용 타임스탬프 (ms) */
  dateValue: number;
  category: PostCategory;
  urgent: boolean;
  deadline: string | null;
  source: string | null;
}

/** 상세 페이지용 — 요약 + 마크다운 본문 원문 (변형 없이 렌더러에 전달) */
export interface PostDetail extends PostSummary {
  body: string;
}

const CONTENT_ROOT = path.join(process.cwd(), "content");

const CATEGORY_DIRS: Record<Exclude<PostCategory, "page">, string> = {
  notice: "notices",
  news: "news",
};

/* ---------- frontmatter 필드별 명시적 검증 (any / 근거 없는 as 금지) ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/** YAML 파서는 날짜를 Date 또는 문자열로 반환할 수 있다 — 두 경우 모두 명시 처리 */
function readDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readCategory(value: unknown): PostCategory | null {
  return value === "notice" || value === "news" || value === "page"
    ? value
    : null;
}

/**
 * 파일 하나를 파싱해 검증한다.
 * - verified가 정확히 true가 아니면 null 반환 (목록 제외 — 게이트)
 * - verified인데 필수 필드가 깨져 있으면 throw (빌드 단계에서 잡아야 하는 콘텐츠 오류)
 */
function parsePostFile(filePath: string, expectedCategory: PostCategory): PostDetail | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  if (!isRecord(data)) return null;

  // verified 게이트: 정확히 true인 파일만 통과
  if (readBoolean(data.verified) !== true) return null;

  const title = readString(data.title);
  const date = readDate(data.date);
  const category = readCategory(data.category) ?? expectedCategory;
  const source = readString(data.source);

  if (!title || !date) {
    throw new Error(
      `[content] 필수 frontmatter(title, date)가 유효하지 않습니다: ${filePath}`,
    );
  }
  if (category !== expectedCategory) {
    throw new Error(
      `[content] category(${category})가 디렉토리(${expectedCategory})와 일치하지 않습니다: ${filePath}`,
    );
  }
  // 금융노조 소식은 출처 필수 (디자인 스펙 §5) — 누락 시 조용한 통과 대신 빌드 실패
  if (category === "news" && source === null) {
    throw new Error(
      `[content] news 게시물은 frontmatter source(출처)가 필수입니다: ${filePath}`,
    );
  }

  const deadline = readDate(data.deadline);

  return {
    slug: path.basename(filePath).replace(/\.(md|mdx)$/, ""),
    title,
    dateIso: toIsoDateString(date),
    dateLabel: formatPostDate(date),
    dateValue: date.getTime(),
    category,
    urgent: readBoolean(data.urgent) ?? false,
    deadline: deadline ? toIsoDateString(deadline) : null,
    source,
    body: content,
  };
}

/** 정렬: urgent 우선, 이후 게시일 내림차순 (디자인 스펙 §5) */
function sortPosts<T extends PostSummary>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return b.dateValue - a.dateValue;
  });
}

function listVerifiedPosts(category: Exclude<PostCategory, "page">): PostSummary[] {
  const dir = path.join(CONTENT_ROOT, CATEGORY_DIRS[category]);
  if (!fs.existsSync(dir)) return [];

  const posts = fs
    .readdirSync(dir)
    .filter((name) => /\.(md|mdx)$/.test(name))
    .map((name) => parsePostFile(path.join(dir, name), category))
    .filter((post): post is PostDetail => post !== null)
    // 목록은 요약만 — body를 클라이언트 직렬화 페이로드에 싣지 않는다
    .map(
      (post): PostSummary => ({
        slug: post.slug,
        title: post.title,
        dateIso: post.dateIso,
        dateLabel: post.dateLabel,
        dateValue: post.dateValue,
        category: post.category,
        urgent: post.urgent,
        deadline: post.deadline,
        source: post.source,
      }),
    );

  return sortPosts(posts);
}

/** 검증 승인(verified: true)된 공지사항 목록 — urgent 우선, 최신순 */
export function getVerifiedNotices(): PostSummary[] {
  return listVerifiedPosts("notice");
}

/** 검증 승인(verified: true)된 금융노조 소식 목록 — urgent 우선, 최신순 */
export function getVerifiedNews(): PostSummary[] {
  return listVerifiedPosts("news");
}

/** 긴급 배너용: verified 공지 중 urgent 최신 1건 (없으면 null → 배너 미렌더) */
export function getLatestUrgentNotice(): PostSummary | null {
  const urgent = getVerifiedNotices().filter((post) => post.urgent);
  return urgent[0] ?? null;
}

/**
 * 마감 스트립·날짜 배지용 (스펙 §11.5): verified 게시물 중 deadline이
 * 오늘(KST) 이후(오늘 포함)인 것 — 마감일 오름차순.
 * ※ 정적 프리렌더 특성상 "오늘"은 빌드 시점 기준 (impl 문서 §10 참조).
 */
export function getUpcomingDeadlinePosts(): PostSummary[] {
  return [...getVerifiedNotices(), ...getVerifiedNews()]
    .filter((post) => {
      if (post.deadline === null) return false;
      const days = daysUntilKst(post.deadline);
      return days !== null && days >= 0;
    })
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
}

/**
 * 상세 페이지용: slug로 verified 게시물 1건 조회 (본문 포함).
 * 미존재·미검증 slug는 null 반환 → 페이지에서 notFound() 처리.
 */
export function getVerifiedPost(
  category: Exclude<PostCategory, "page">,
  slug: string,
): PostDetail | null {
  // 경로 조작 방어: slug는 파일명 안전 문자만 허용
  if (!/^[A-Za-z0-9가-힣._-]+$/.test(slug) || slug.includes("..")) {
    return null;
  }

  const dir = path.join(CONTENT_ROOT, CATEGORY_DIRS[category]);
  for (const ext of [".md", ".mdx"]) {
    const filePath = path.join(dir, `${slug}${ext}`);
    if (fs.existsSync(filePath)) {
      return parsePostFile(filePath, category);
    }
  }
  return null;
}
