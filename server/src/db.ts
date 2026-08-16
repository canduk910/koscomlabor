/**
 * PostgreSQL 커넥션 풀 + 방명록 저장소.
 * snake_case 컬럼 ↔ camelCase API 필드 변환은 이 경계에서 수행한다 (명세 6절).
 */
import pg from "pg";

export interface GuestbookEntryRow {
  id: string;
  author: string;
  body: string;
  /** ISO 8601 UTC */
  createdAt: string;
}

interface DbRow {
  id: string;
  author: string;
  body: string;
  created_at: Date;
}

function toApiShape(row: DbRow): GuestbookEntryRow {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

export class GuestbookRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(limit: number, offset: number): Promise<{ entries: GuestbookEntryRow[]; total: number }> {
    const [listResult, countResult] = await Promise.all([
      this.pool.query<DbRow>(
        `SELECT id, author, body, created_at
           FROM guestbook_entries
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC, id DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM guestbook_entries WHERE deleted_at IS NULL`,
      ),
    ]);
    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);
    return { entries: listResult.rows.map(toApiShape), total };
  }

  async create(author: string, body: string, ipHash: string): Promise<GuestbookEntryRow> {
    const result = await this.pool.query<DbRow>(
      `INSERT INTO guestbook_entries (author, body, ip_hash)
       VALUES ($1, $2, $3)
       RETURNING id, author, body, created_at`,
      [author, body, ipHash],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("INSERT 가 행을 반환하지 않았습니다.");
    return toApiShape(row);
  }

  /** 동일 IP(해시)가 동일 본문을 24시간 내 등록했는지 (명세 4.3절 중복 내용 제한) */
  async hasRecentDuplicate(ipHash: string, body: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
         FROM guestbook_entries
        WHERE ip_hash = $1
          AND body = $2
          AND created_at > now() - interval '24 hours'
          AND deleted_at IS NULL
        LIMIT 1`,
      [ipHash, body],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /** soft delete. 반환값: 실제로 삭제됐으면 true, 없거나 이미 삭제면 false */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE guestbook_entries
          SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}
