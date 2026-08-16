/**
 * 링크형 게시물 제목 자동 추출 (명세 06 §13.2) — SSRF 방어 내장.
 *
 * 방어선:
 * 1. http/https 스킴 + 80/443 포트만
 * 2. DNS 해석 결과의 "모든" 주소가 공인 IP 여야 함
 * 3. 검증한 IP 로 직접 연결 (DNS 리바인딩 차단 — 재해석 없음)
 * 4. 리다이렉트 최대 3회, 홉마다 1–3 재검증
 * 5. 연결 3초 / 전체 8초 타임아웃, 본문 최대 1MB, text/html 만 파싱
 */
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { isPublicIp } from "./ipGuard.js";

const MAX_REDIRECTS = 3;
const CONNECT_TIMEOUT_MS = 3_000;
const TOTAL_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 1024 * 1024;
const USER_AGENT = "koscomlabor-link-preview/1.0 (+https://koscomlabor.cloud)";

export interface LinkPreview {
  title: string;
  siteName: string | null;
}

export class LinkFetchError extends Error {}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractMeta(html: string, property: string): string | null {
  // <meta property="og:title" content="..."> — 속성 순서 양방향 지원
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1] !== undefined && match[1].trim().length > 0) return decodeEntities(match[1]);
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (match?.[1] === undefined) return null;
  const title = decodeEntities(match[1].replace(/\s+/g, " "));
  return title.length > 0 ? title : null;
}

interface ValidatedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

async function validateUrl(rawUrl: string): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new LinkFetchError("URL 형식이 올바르지 않습니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LinkFetchError("http/https URL 만 지원합니다.");
  }
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number.parseInt(url.port, 10);
  if (port !== 80 && port !== 443) {
    throw new LinkFetchError("허용되지 않는 포트입니다.");
  }
  // 호스트가 IP 리터럴이면 즉시 검증
  const literalFamily = net.isIP(url.hostname);
  if (literalFamily !== 0) {
    if (!isPublicIp(url.hostname)) throw new LinkFetchError("허용되지 않는 대상입니다.");
    return { url, address: url.hostname, family: literalFamily === 6 ? 6 : 4 };
  }
  // DNS 해석 — 모든 결과가 공인 IP 여야 통과 (하나라도 사설이면 차단)
  let records;
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new LinkFetchError("호스트를 해석할 수 없습니다.");
  }
  if (records.length === 0) throw new LinkFetchError("호스트를 해석할 수 없습니다.");
  for (const record of records) {
    if (!isPublicIp(record.address)) throw new LinkFetchError("허용되지 않는 대상입니다.");
  }
  const first = records[0];
  if (first === undefined) throw new LinkFetchError("호스트를 해석할 수 없습니다.");
  return { url, address: first.address, family: first.family === 6 ? 6 : 4 };
}

function fetchOnce(target: ValidatedTarget, deadline: number): Promise<{ status: number; location: string | null; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const { url, address, family } = target;
    const isHttps = url.protocol === "https:";
    const requestFn = isHttps ? https.request : http.request;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new LinkFetchError("응답 시간이 초과되었습니다."));
      return;
    }

    const request = requestFn({
      host: address, // 검증한 IP 로 직접 연결 (리바인딩 차단)
      family,
      port: url.port === "" ? (isHttps ? 443 : 80) : Number.parseInt(url.port, 10),
      path: url.pathname + url.search,
      method: "GET",
      // TLS 인증서 검증·SNI 는 원래 호스트명 기준
      ...(isHttps ? { servername: url.hostname } : {}),
      headers: {
        Host: url.host,
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "ko, en;q=0.8",
      },
      timeout: Math.min(CONNECT_TIMEOUT_MS, remaining),
    });

    const totalTimer = setTimeout(() => {
      request.destroy(new LinkFetchError("응답 시간이 초과되었습니다."));
    }, remaining);

    request.on("timeout", () => request.destroy(new LinkFetchError("연결 시간이 초과되었습니다.")));
    request.on("error", (error) => {
      clearTimeout(totalTimer);
      reject(error instanceof LinkFetchError ? error : new LinkFetchError("대상에 연결할 수 없습니다."));
    });
    request.on("response", (response) => {
      const status = response.statusCode ?? 0;
      const location = typeof response.headers.location === "string" ? response.headers.location : null;
      const contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : "";

      const chunks: Buffer[] = [];
      let received = 0;
      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_BODY_BYTES) {
          response.destroy();
          request.destroy();
          clearTimeout(totalTimer);
          // 1MB 까지의 내용으로 제목 추출 시도
          resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf-8") });
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        clearTimeout(totalTimer);
        resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf-8") });
      });
      response.on("error", () => {
        clearTimeout(totalTimer);
        reject(new LinkFetchError("응답을 읽지 못했습니다."));
      });
    });
    request.end();
  });
}

/** SSRF 방어 하에 URL 의 제목을 추출한다. 실패 시 LinkFetchError. */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = await validateUrl(currentUrl); // 홉마다 전체 재검증
    const result = await fetchOnce(target, deadline);

    if (result.status >= 300 && result.status < 400 && result.location !== null) {
      currentUrl = new URL(result.location, target.url).toString();
      continue;
    }
    if (result.status < 200 || result.status >= 300) {
      throw new LinkFetchError(`대상이 오류를 반환했습니다 (HTTP ${result.status}).`);
    }
    if (!result.contentType.toLowerCase().includes("text/html")) {
      throw new LinkFetchError("HTML 페이지가 아닙니다.");
    }
    const title = extractMeta(result.body, "og:title") ?? extractTitleTag(result.body);
    if (title === null) throw new LinkFetchError("제목을 찾을 수 없습니다.");
    return {
      title: title.slice(0, 300),
      siteName: extractMeta(result.body, "og:site_name"),
    };
  }
  throw new LinkFetchError("리다이렉트가 너무 많습니다.");
}
