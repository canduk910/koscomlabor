/**
 * 관리자 비밀번호 강제 재설정 (분실 복구용) — 서버에서 직접 실행한다.
 *
 * 동작: 새 비밀번호를 argon2id 로 해시해 admin_credentials(id=1) 을 UPSERT 하고
 *       updated_at 을 갱신(= passwordIsInitial false)한 뒤, 모든 admin_sessions 를 삭제한다.
 *       해시는 요청마다 DB 에서 읽히므로 **API 컨테이너 재기동은 필요 없다.**
 *
 * 사용법 (평문이 셸 히스토리에 남지 않게 stdin 으로만 받는다):
 *   DATABASE_URL=postgres://... node scripts/set-password.mjs        # stdin 한 줄 입력
 *   printf '%s' "$PW" | DATABASE_URL=postgres://... node scripts/set-password.mjs
 *
 * 출력: 갱신 시각과 무효화된 세션 수만. 평문·해시는 어떤 경우에도 출력하지 않는다.
 * 절차 전체는 _workspace/07_backend_impl.md §9.4 참조.
 */
import argon2 from "argon2";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (typeof databaseUrl !== "string" || databaseUrl.trim().length === 0) {
  console.error("환경변수 DATABASE_URL 이 설정되지 않았습니다.");
  process.exit(1);
}

let input = "";
process.stdin.setEncoding("utf-8");
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, "");

// 하한 12자는 API(POST /admin/password)·hash-password.mjs 와 동일 기준
if (password.length < 12) {
  console.error("비밀번호는 12자 이상이어야 합니다.");
  process.exit(1);
}
if (password.length > 200) {
  console.error("비밀번호는 200자 이하여야 합니다.");
  process.exit(1);
}

const hash = await argon2.hash(password, { type: argon2.argon2id });

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  const upserted = await pool.query(
    `INSERT INTO admin_credentials (id, password_hash, updated_at)
     VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, updated_at = now()
     RETURNING updated_at`,
    [hash],
  );

  // 의도적 전체 삭제 — 비밀번호 재설정이므로 모든 기기의 세션을 무효화한다.
  // (WHERE 절 필수 규칙의 승인된 예외: admin_sessions 는 재발급 가능한 휘발성 인증 상태이며
  //  조합 콘텐츠 데이터가 아니다. repos/sessions.ts 의 destroyAll 과 동일한 근거.)
  const revoked = await pool.query(`DELETE FROM admin_sessions`);

  const changedAt = upserted.rows[0]?.updated_at;
  console.log(
    `관리자 비밀번호를 재설정했습니다. changedAt=${changedAt instanceof Date ? changedAt.toISOString() : String(changedAt)} sessionsRevoked=${revoked.rowCount ?? 0}`,
  );
} catch (error) {
  // 원인만 출력 — 해시·평문은 싣지 않는다
  console.error("재설정 실패:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
