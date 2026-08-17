/**
 * YouTube 썸네일 **서버 캐싱** (계약 §4·§5, 명세 06 §20.4).
 *
 * 왜 서버가 중계하는가 (개인정보):
 *   `i.ytimg.com` 을 프론트에서 직접 <img> 로 로드하면 메인페이지를 여는 **모든 조합원의
 *   IP·User-Agent·접속 시각·Referer 가 구글로 전송**된다. 이 프로젝트는 원문 IP 를 로그에
 *   남기지 않고 방명록 IP 도 HMAC 해시 + 90일 후 NULL 처리하는 기준을 세워 두었다(07 §2.5).
 *   서버가 한 번 받아 저장하고 조합원에게는 우리 도메인에서 내려주면 **조합원 IP 는 구글에
 *   닿지 않는다.** 서버 IP 한 개만, 게시물 등록 시점에 한 번 닿는다.
 *
 * SSRF 방어 (계약 §4):
 *   1. 요청 호스트는 `i.ytimg.com` **하드코딩**. 사용자 입력은 videoId 뿐이고,
 *      `/^[A-Za-z0-9_-]{11}$/` 를 통과한 값만 URL 경로 조립에 쓴다.
 *      **사용자 URL 을 그대로 fetch 하지 않는다** (linkPreview 와 달리 임의 호스트 접속이 없다)
 *   2. 리다이렉트 **미추종** — 3xx 는 그 변형의 실패로 처리한다
 *   3. TLS 인증서 검증(기본값)이 실질적 최종 방어선이다. DNS 가 오염돼도 공격자는
 *      `i.ytimg.com` 의 유효한 인증서를 제시할 수 없다
 *   4. 그 위에 접속한 피어 IP 가 공인 IP 인지 재확인한다 (사설 대역으로의 유도 차단 — ipGuard 재사용)
 *   5. 연결 3초 / 전체 6초 타임아웃, 본문 2MB 상한
 *   6. 응답이 실제 JPEG 인지 **매직 바이트(FF D8 FF)로 검증**한다 — Content-Type 은 믿지 않는다
 *      (`lib/fileTypes.ts` 의 내용 검사 방식 계승)
 *
 * 변형 선택: `maxresdefault`(1280×720) → 실패 시 `mqdefault`(320×180). 둘 다 16:9 다.
 *   **`hqdefault` 는 쓰지 않는다** — 480×360 4:3 레터박스라 16:9 카드에 검은 띠가 생긴다.
 *   maxresdefault 는 항상 존재하지 않는다 (리더 실측: 게시된 5건 중 1건이 404) — 폴백 필수.
 *
 * 실패는 게시를 막지 않는다 (06 §13.2 링크 프리뷰와 동일 원칙). 호출부는 `key === null` 을
 * 정상 경로로 처리하고 `reason` 을 warn 로그로만 남긴다.
 */
import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { isPublicIp } from "./ipGuard.js";

/** 썸네일 변형 — 우선순위 순서. hqdefault 는 의도적으로 없다 (4:3 레터박스) */
export const THUMBNAIL_VARIANTS = ["maxresdefault", "mqdefault"] as const;
export type ThumbnailVariant = (typeof THUMBNAIL_VARIANTS)[number];

/** YouTube videoId — 정확히 11자. 이 정규식을 통과한 값만 URL·파일명에 쓴다 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * `thumbnail_key` 의 유일한 형식. `GET /thumbnails/:key` 가 이 정규식으로 엄격 검증하므로
 * 경로 구분자(`/`)·상위 참조(`..`)가 **구조적으로 표현 불가능**하다 (계약 §5).
 */
export const THUMBNAIL_KEY_PATTERN = /^[A-Za-z0-9_-]{11}-(?:maxresdefault|mqdefault)\.jpg$/;

/** {UPLOAD_DIR} 하위의 썸네일 전용 디렉토리명 — 첨부(조합원 대상 문서)와 분리한다 */
export const THUMBNAIL_SUBDIR = "thumbnails";

const THUMBNAIL_HOST = "i.ytimg.com"; // 하드코딩 — 사용자 입력이 호스트에 닿지 않는다
const CONNECT_TIMEOUT_MS = 3_000;
/** 두 변형 시도 전체에 적용되는 예산. 게시 응답을 오래 붙잡지 않기 위해 짧게 잡았다 */
const TOTAL_TIMEOUT_MS = 6_000;
const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "koscomlabor-thumbnail-cache/1.0 (+https://koscomlabor.cloud)";

/** JPEG 매직 바이트 (SOI 마커) — fileTypes.ts 의 jpg 판정과 동일 기준 */
function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/**
 * 링크 URL → videoId. 인식하지 못하면 null (= 썸네일 없음, 계약 §4).
 * 인식 형태: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
 * (m.youtube.com·www 유무·music.youtube.com 포함. 그 외 경로는 대상 아님)
 */
export function extractYouTubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    // https://youtu.be/{id}
    candidate = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
    if (segments[0] === "watch") {
      candidate = url.searchParams.get("v");
    } else if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
      candidate = segments[1] ?? null;
    }
  }

  if (candidate === null) return null;
  // 정규식 통과가 URL 조립의 유일한 관문이다 (SSRF 방어 §4-1)
  return VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

/** 서버가 만드는 유일한 키 형식 — 사용자 입력은 정규식을 통과한 videoId 뿐이다 */
export function thumbnailKeyFor(videoId: string, variant: ThumbnailVariant): string {
  return `${videoId}-${variant}.jpg`;
}

/** 공개 응답용 상대 경로 (첨부 `/files/...` 와 동일 규약 — 프론트가 resolveApiUrl 로 절대화) */
export function thumbnailUrlForKey(key: string): string {
  return `/${THUMBNAIL_SUBDIR}/${key}`;
}

/** {UPLOAD_DIR}/thumbnails/{key} — key 는 THUMBNAIL_KEY_PATTERN 검증을 통과한 값이어야 한다 */
export function thumbnailFilePath(uploadDir: string, key: string): string {
  return path.join(uploadDir, THUMBNAIL_SUBDIR, key);
}

type VariantOutcome =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: string };

/**
 * `https://i.ytimg.com/vi/{videoId}/{variant}.jpg` 1회 취득.
 * 리다이렉트 미추종, 2MB 상한, 매직 바이트 검증. 던지지 않고 결과 객체를 돌려준다.
 */
function fetchVariant(videoId: string, variant: ThumbnailVariant, deadline: number): Promise<VariantOutcome> {
  return new Promise((resolve) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      resolve({ ok: false, reason: "timeout-budget-exhausted" });
      return;
    }

    let settled = false;
    const finish = (outcome: VariantOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      resolve(outcome);
    };

    const request = https.request(
      {
        host: THUMBNAIL_HOST, // 하드코딩 — 사용자 입력 없음
        port: 443,
        // videoId 는 VIDEO_ID_PATTERN 통과값, variant 는 서버 상수 → 경로 조작 불가
        path: `/vi/${videoId}/${variant}.jpg`,
        method: "GET",
        headers: {
          Host: THUMBNAIL_HOST,
          "User-Agent": USER_AGENT,
          Accept: "image/jpeg,image/*",
        },
        timeout: Math.min(CONNECT_TIMEOUT_MS, remaining),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        // 리다이렉트 미추종 (계약 §4) — 3xx 는 이 변형의 실패로 처리한다
        if (status !== 200) {
          response.destroy();
          request.destroy();
          finish({ ok: false, reason: `http-${status}` });
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_BYTES) {
            // 상한 초과분은 폐기하고 이 변형을 실패 처리 (다음 변형으로 넘어간다)
            response.destroy();
            request.destroy();
            finish({ ok: false, reason: "too-large" });
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            finish({ ok: false, reason: "empty-body" });
            return;
          }
          // Content-Type 이 아니라 **내용**을 검사한다
          if (!isJpeg(buffer)) {
            finish({ ok: false, reason: "not-jpeg" });
            return;
          }
          finish({ ok: true, buffer });
        });
        response.on("error", () => finish({ ok: false, reason: "response-error" }));
      },
    );

    const totalTimer = setTimeout(() => {
      request.destroy();
      finish({ ok: false, reason: "timeout" });
    }, remaining);

    // 접속한 피어가 공인 IP 인지 재확인 (DNS 오염으로 사설 대역에 유도되는 것 차단).
    // TLS 인증서 검증이 이미 최종 방어선이지만, 검증 실패 이전에 끊는 것이 더 저렴하다.
    request.on("socket", (socket) => {
      socket.on("connect", () => {
        const peer = socket.remoteAddress;
        if (typeof peer !== "string" || !isPublicIp(peer)) {
          request.destroy();
          finish({ ok: false, reason: "non-public-peer" });
        }
      });
    });
    request.on("timeout", () => {
      request.destroy();
      finish({ ok: false, reason: "connect-timeout" });
    });
    request.on("error", () => finish({ ok: false, reason: "request-error" }));
    request.end();
  });
}

export type ThumbnailResult =
  | { key: string; variant: ThumbnailVariant; source: "cache" | "fetch" }
  | { key: null; reason: string };

/**
 * 링크 URL 의 YouTube 썸네일을 확보하고 `thumbnail_key` 를 반환한다.
 * **던지지 않는다** — 실패는 `{ key: null, reason }` 이고 호출부는 게시를 계속 진행한다.
 *
 * 멱등: 디스크에 이미 해당 키 파일이 있으면 네트워크 요청 없이 그 키를 재사용한다
 * (키가 videoId+변형에 고정되므로 내용이 바뀔 일이 없다 — `immutable` 캐시 헤더의 근거와 동일).
 */
export async function acquireThumbnail(rawUrl: string, uploadDir: string): Promise<ThumbnailResult> {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (videoId === null) return { key: null, reason: "not-a-youtube-video-url" };

  // ① 디스크 캐시 우선 (멱등성·재취득 비용 0)
  for (const variant of THUMBNAIL_VARIANTS) {
    const key = thumbnailKeyFor(videoId, variant);
    try {
      const stat = await fs.stat(thumbnailFilePath(uploadDir, key));
      if (stat.isFile() && stat.size > 0) return { key, variant, source: "cache" };
    } catch {
      // 없음 → 다음 변형 / 네트워크 취득
    }
  }

  // ② 네트워크 취득 — maxresdefault 우선, 실패 시 mqdefault
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const failures: string[] = [];
  for (const variant of THUMBNAIL_VARIANTS) {
    const outcome = await fetchVariant(videoId, variant, deadline);
    if (!outcome.ok) {
      failures.push(`${variant}:${outcome.reason}`);
      continue;
    }
    const key = thumbnailKeyFor(videoId, variant);
    try {
      const dir = path.join(uploadDir, THUMBNAIL_SUBDIR);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(thumbnailFilePath(uploadDir, key), outcome.buffer, { mode: 0o600 });
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      return { key: null, reason: `write-failed(${cause})` };
    }
    return { key, variant, source: "fetch" };
  }

  return { key: null, reason: failures.join(",") };
}
