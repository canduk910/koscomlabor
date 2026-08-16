import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { formatPostDate, toIsoDateString } from "@/lib/date";

/**
 * 파일 기반 콘텐츠 로더 — **page 카테고리(상시 정보: 소개·규약 등) 전용**.
 *
 * 2026-08-16 DB 전환(06 명세 Part 2 §16): notice/news는 API(GET /posts)로 이관되어
 * 이 모듈에서 제거됨 (이관 시점 content/notices·news는 0건 — 데이터 이관 없음).
 * verified 게이트는 파일 기반(AI 경유) 게시 경로에만 존속한다 (06 명세 §14 게시 정책):
 * `verified: true`가 아닌 파일은 목록에서 제외한다.
 */

export interface PageContent {
  slug: string;
  title: string;
  /** ISO 날짜 (YYYY-MM-DD) */
  dateIso: string;
  /** YYYY.MM.DD (Intl 계산) */
  dateLabel: string;
  body: string;
}

const PAGES_DIR = path.join(process.cwd(), "content", "pages");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

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

/**
 * 파일 하나를 파싱·검증한다.
 * - verified가 정확히 true가 아니면 null (게이트)
 * - verified인데 필수 필드가 깨져 있으면 throw (빌드 단계에서 잡는 콘텐츠 오류)
 */
function parsePageFile(filePath: string): PageContent | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  if (!isRecord(data)) return null;
  if (readBoolean(data.verified) !== true) return null;

  const title = readString(data.title);
  const date = readDate(data.date);
  if (!title || !date) {
    throw new Error(`[content] 필수 frontmatter(title, date)가 유효하지 않습니다: ${filePath}`);
  }

  return {
    slug: path.basename(filePath).replace(/\.(md|mdx)$/, ""),
    title,
    dateIso: toIsoDateString(date),
    dateLabel: formatPostDate(date),
    body: content,
  };
}

/** 검증 승인(verified: true)된 상시 정보 페이지 목록 */
export function getVerifiedPages(): PageContent[] {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs
    .readdirSync(PAGES_DIR)
    .filter((name) => /\.(md|mdx)$/.test(name))
    .map((name) => parsePageFile(path.join(PAGES_DIR, name)))
    .filter((page): page is PageContent => page !== null);
}

/** slug로 verified 페이지 1건 조회 (미존재·미검증은 null) */
export function getVerifiedPage(slug: string): PageContent | null {
  if (!/^[A-Za-z0-9가-힣._-]+$/.test(slug) || slug.includes("..")) return null;
  for (const ext of [".md", ".mdx"]) {
    const filePath = path.join(PAGES_DIR, `${slug}${ext}`);
    if (fs.existsSync(filePath)) {
      return parsePageFile(filePath);
    }
  }
  return null;
}
