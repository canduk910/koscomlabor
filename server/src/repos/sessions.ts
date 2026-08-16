/**
 * Admin 세션 저장소 — 토큰 원문은 저장·로깅하지 않는다 (SHA-256 hex 만).
 */
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12시간 (명세 §12.1)

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SessionsRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** 새 세션 발급 — 반환된 token 은 쿠키로만 나가고 서버에는 해시만 남는다 */
  async create(): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.pool.query(
      `INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)`,
      [hashToken(token), expiresAt],
    );
    return { token, expiresAt };
  }

  /** 유효 세션이면 last_used_at 갱신 후 만료 시각 반환, 아니면 null */
  async validate(token: string): Promise<{ expiresAt: Date } | null> {
    const result = await this.pool.query<{ expires_at: Date }>(
      `UPDATE admin_sessions SET last_used_at = now()
        WHERE token_hash = $1 AND expires_at > now()
        RETURNING expires_at`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    return row === undefined ? null : { expiresAt: row.expires_at };
  }

  async destroy(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [hashToken(token)]);
  }

  /** 만료 세션 정리 (로그인 시 배치 호출) */
  async pruneExpired(): Promise<void> {
    await this.pool.query(`DELETE FROM admin_sessions WHERE expires_at <= now()`);
  }
}
