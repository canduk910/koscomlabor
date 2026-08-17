/**
 * Admin 자격 증명 저장소 (단일 행 id = 1) — 명세 06 §10.4.
 *
 * 비밀번호 해시의 **권위 저장소**. 환경변수 ADMIN_PASSWORD_HASH 는 최초 부팅 시드 전용이며,
 * 행이 한 번 생성된 뒤에는 무시된다 (명세 §12.3). 기동 시 1회만 읽던 기존 방식과 달리
 * 매 인증마다 DB 를 읽으므로 런타임 비밀번호 변경이 즉시 반영된다.
 *
 * 해시 문자열은 반환값으로만 다루고 로그·에러 메시지에 절대 싣지 않는다.
 * snake_case 컬럼 ↔ camelCase 변환은 이 경계에서 수행한다 (명세 6절).
 */
import type pg from "pg";

export interface AdminCredentials {
  /** argon2id 해시 — 로깅·직렬화 금지 */
  passwordHash: string;
  /** null = 시드 이후 한 번도 변경되지 않음 (= passwordIsInitial true) */
  updatedAt: Date | null;
}

interface CredentialsRow {
  password_hash: string;
  updated_at: Date | null;
}

export class AdminCredentialsRepository {
  constructor(private readonly pool: pg.Pool) {}

  /**
   * 최초 부팅 시드. 행이 이미 있으면 아무 것도 하지 않는다 (env 값 무시 — DB 가 권위).
   * 실패는 삼키지 않고 던진다: 호출부(app.ts)가 기동을 거부한다.
   */
  async ensureSeeded(envHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_credentials (id, password_hash)
       VALUES (1, $1)
       ON CONFLICT (id) DO NOTHING`,
      [envHash],
    );
  }

  /**
   * 활성 자격 증명. 행이 없으면 `null` 을 반환하고, 폴백은 호출부가 결정한다
   * (routes/admin.ts 가 env 시드 해시로 폴백 — 행 부재로 로그인이 깨지지 않게 하는 방어선).
   */
  async getActive(): Promise<AdminCredentials | null> {
    const result = await this.pool.query<CredentialsRow>(
      `SELECT password_hash, updated_at FROM admin_credentials WHERE id = 1`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return { passwordHash: row.password_hash, updatedAt: row.updated_at };
  }

  /**
   * 비밀번호 교체 — `updated_at = now()` 로 갱신되어 이후 passwordIsInitial 은 영구히 false.
   * 반환값: 갱신된 `updated_at` (API 의 changedAt).
   *
   * UPSERT 인 이유: `getActive()` 가 행 부재 시 env 해시로 폴백하므로 "행이 없는데 로그인은
   * 되는" 구간이 존재한다(예: 행을 지우고 아직 재기동하지 않은 상태). 여기가 순수 UPDATE 면
   * 그 구간에서 변경만 0행 → 500 으로 실패해 폴백이 절반만 동작한다. UPSERT 로 자가 치유시킨다
   * (복구 스크립트 scripts/set-password.mjs 와 동일한 문장).
   *
   * 대상 특정 필수 규칙 준수: 단일 행(id = 1)만 겨냥한다.
   */
  async update(newHash: string): Promise<Date> {
    const result = await this.pool.query<{ updated_at: Date }>(
      `INSERT INTO admin_credentials (id, password_hash, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, updated_at = now()
       RETURNING updated_at`,
      [newHash],
    );
    const row = result.rows[0];
    if (row === undefined) {
      // RETURNING 이 있는 UPSERT 는 항상 1행을 반환한다 — 도달하면 스키마 이상이다.
      throw new Error("admin_credentials(id=1) 갱신이 행을 반환하지 않았습니다. 스키마 상태를 확인하세요.");
    }
    return row.updated_at;
  }
}
