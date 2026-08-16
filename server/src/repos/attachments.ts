/**
 * 첨부 저장소. 파일시스템 경로는 storage_key(uuid.ext)로만 구성 —
 * 사용자 입력(원본 파일명)은 DB 컬럼에만 존재한다 (경로 조작 원천 차단).
 */
import type pg from "pg";

export interface AttachmentRecord {
  id: string;
  postId: string;
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

interface DbRow {
  id: string;
  post_id: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  size_bytes: string;
}

function toRecord(row: DbRow): AttachmentRecord {
  return {
    id: row.id,
    postId: row.post_id,
    filename: row.filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: Number.parseInt(row.size_bytes, 10),
  };
}

const COLUMNS = "id, post_id, filename, storage_key, mime_type, size_bytes::text AS size_bytes";

export class AttachmentsRepository {
  constructor(private readonly pool: pg.Pool) {}

  async countActive(postId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM post_attachments WHERE post_id = $1 AND deleted_at IS NULL`,
      [postId],
    );
    return Number.parseInt(result.rows[0]?.count ?? "0", 10);
  }

  async insert(
    postId: string,
    filename: string,
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<AttachmentRecord> {
    const result = await this.pool.query<DbRow>(
      `INSERT INTO post_attachments (post_id, filename, storage_key, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5) RETURNING ${COLUMNS}`,
      [postId, filename, storageKey, mimeType, sizeBytes],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("INSERT 가 행을 반환하지 않았습니다.");
    return toRecord(row);
  }

  /** 공개 서빙용 — 삭제된 첨부·삭제된 게시물의 첨부는 제외 */
  async getForServe(id: string): Promise<AttachmentRecord | null> {
    const result = await this.pool.query<DbRow>(
      `SELECT a.id, a.post_id, a.filename, a.storage_key, a.mime_type, a.size_bytes::text AS size_bytes
         FROM post_attachments a
         JOIN posts p ON p.id = a.post_id
        WHERE a.id = $1 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE post_attachments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
