/**
 * 이미 게시된 링크형 게시물에 YouTube 썸네일을 **소급 적용**한다 (계약 §7, 07 §11.6).
 *
 * 대상: `type = 'link'` AND `url IS NOT NULL` AND `thumbnail_key IS NULL` AND `deleted_at IS NULL`
 *       (노동교육 5건 + 금융노조 소식 링크형 등)
 *
 * 멱등: 이미 `thumbnail_key` 가 있는 행은 애초에 조회되지 않는다. 디스크에 파일이 남아 있으면
 *       `acquireThumbnail()` 이 네트워크 요청 없이 그 키를 재사용한다. 몇 번 실행해도 안전하다.
 *
 * 사용법:
 *   # 프로덕션 (uploads 볼륨이 마운트된 api 컨테이너에서 — 07 §11.7 ⑦)
 *   docker compose exec api node scripts/backfill-thumbnails.mjs
 *
 *   # 로컬 (먼저 npm run build — dist/ 의 컴파일 결과를 import 한다)
 *   DATABASE_URL=postgres://... UPLOAD_DIR=./uploads node scripts/backfill-thumbnails.mjs
 *
 *   # 무엇이 바뀔지만 보기 (DB 무변경)
 *   ... node scripts/backfill-thumbnails.mjs --dry-run
 *
 * ⚠ `--dry-run` 은 **DB 를 변경하지 않지만 디스크 캐시({UPLOAD_DIR}/thumbnails/)는 채운다.**
 *   어느 변형이 실제로 쓰일지 보고하려면 취득까지 해봐야 하기 때문이다. 파생 캐시이므로
 *   무해하고, 이어지는 실제 실행은 네트워크 없이 끝난다.
 *
 * 설계 메모 — **취득 로직을 여기에 다시 쓰지 않았다.** videoId 정규식·SSRF 방어·변형 폴백
 * 순서·JPEG 매직 바이트 검증은 `src/lib/youtubeThumbnail.ts` 하나에만 있고 이 스크립트는
 * 컴파일 결과(`dist/lib/youtubeThumbnail.js`)를 import 한다. 복사해 두면 한쪽만 고쳐졌을 때
 * "API 로 올린 글과 backfill 한 글의 썸네일이 다른" 부분 고장이 된다.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { acquireThumbnail } from "../dist/lib/youtubeThumbnail.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
if (typeof databaseUrl !== "string" || databaseUrl.trim().length === 0) {
  console.error("환경변수 DATABASE_URL 이 설정되지 않았습니다.");
  process.exit(1);
}
// 서버(config.ts)와 동일한 기본값. 프로덕션 api 컨테이너에는 /data/uploads 로 주입돼 있다.
const uploadDirRaw = process.env.UPLOAD_DIR ?? "./uploads";
const uploadDir = path.isAbsolute(uploadDirRaw)
  ? uploadDirRaw
  : path.resolve(scriptDir, "..", uploadDirRaw);

const dryRun = process.argv.includes("--dry-run");

console.log(`썸네일 소급 적용 시작 — UPLOAD_DIR=${uploadDir}${dryRun ? " (dry-run)" : ""}`);

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
let scanned = 0;
let filled = 0;
let skipped = 0;
let failed = 0;

try {
  const targets = await pool.query(
    `SELECT id, category, url FROM posts
      WHERE type = 'link' AND url IS NOT NULL
        AND thumbnail_key IS NULL
        AND deleted_at IS NULL
      ORDER BY category, published_at DESC, id DESC`,
  );
  console.log(`대상 후보 ${targets.rows.length}건 (thumbnail_key 가 비어 있는 활성 링크형 게시물)`);

  for (const row of targets.rows) {
    scanned += 1;
    // 건별 실패가 나머지를 막지 않는다 (계약 §7)
    let result;
    try {
      result = await acquireThumbnail(row.url, uploadDir);
    } catch (error) {
      failed += 1;
      console.error(`  [실패] ${row.id} (${row.category}) — 예외: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (result.key === null) {
      if (result.reason === "not-a-youtube-video-url") {
        skipped += 1;
        console.log(`  [건너뜀] ${row.id} (${row.category}) — YouTube 영상 URL 아님`);
      } else {
        failed += 1;
        console.error(`  [실패] ${row.id} (${row.category}) — ${result.reason}`);
      }
      continue;
    }

    if (dryRun) {
      filled += 1;
      console.log(`  [dry-run] ${row.id} (${row.category}) → ${result.key} (${result.source})`);
      continue;
    }

    // **WHERE id = $1 필수** — 대상 특정 없는 UPDATE 금지 (CLAUDE.md / 스킬 §3)
    const updated = await pool.query(
      `UPDATE posts SET thumbnail_key = $2 WHERE id = $1 AND thumbnail_key IS NULL`,
      [row.id, result.key],
    );
    if ((updated.rowCount ?? 0) === 0) {
      // 조회와 UPDATE 사이에 다른 경로가 채운 경우 — 이미 목적이 달성됐으므로 건너뜀 처리
      skipped += 1;
      console.log(`  [건너뜀] ${row.id} (${row.category}) — 사이에 이미 채워짐`);
      continue;
    }
    filled += 1;
    console.log(`  [적용] ${row.id} (${row.category}) → ${result.key} (${result.source})`);
  }
} catch (error) {
  console.error("소급 적용 중단:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}

console.log(
  `완료 — 대상 ${scanned}건 / 적용 ${filled}건 / 건너뜀 ${skipped}건 / 실패 ${failed}건${dryRun ? " (dry-run: DB 무변경)" : ""}`,
);
// 실패가 있어도 나머지는 적용됐으므로 종료 코드로만 알린다 (재실행이 멱등하므로 그대로 다시 실행 가능)
if (failed > 0) process.exitCode = 1;
