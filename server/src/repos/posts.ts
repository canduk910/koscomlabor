/**
 * 게시물 저장소 — snake_case ↔ camelCase 변환은 이 경계에서 (명세 06 §11).
 * 정렬 규약: urgent DESC → published_at DESC → id DESC (서버 책임).
 */
import type pg from "pg";
import type { PostInput } from "../lib/postValidate.js";

export interface AttachmentRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string; // /files/<id>/<filename> (API 도메인 상대 경로)
}

export interface PostSummaryRow {
  id: string;
  category: "notice" | "news";
  type: "link" | "article";
  title: string;
  url: string | null;
  source: string | null;
  urgent: boolean;
  deadline: string | null;
  publishedAt: string;
  attachments: AttachmentRow[];
}

export interface PostDetailRow extends PostSummaryRow {
  body: string | null;
}

export interface AdminPostRow extends PostDetailRow {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface DbPostRow {
  id: string;
  category: "notice" | "news";
  type: "link" | "article";
  title: string;
  body: string | null;
  url: string | null;
  source: string | null;
  urgent: boolean;
  deadline: string | null; // ::text 캐스팅으로 YYYY-MM-DD
  published_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const POST_COLUMNS =
  "id, category, type, title, body, url, source, urgent, deadline::text AS deadline, published_at, created_at, updated_at, deleted_at";

function attachmentUrl(id: string, filename: string): string {
  return `/files/${id}/${encodeURIComponent(filename)}`;
}

export class PostsRepository {
  constructor(private readonly pool: pg.Pool) {}

  private async attachmentsFor(postIds: string[]): Promise<Map<string, AttachmentRow[]>> {
    const map = new Map<string, AttachmentRow[]>();
    if (postIds.length === 0) return map;
    const result = await this.pool.query<{
      id: string;
      post_id: string;
      filename: string;
      mime_type: string;
      size_bytes: string;
    }>(
      `SELECT id, post_id, filename, mime_type, size_bytes::text AS size_bytes
         FROM post_attachments
        WHERE post_id = ANY($1) AND deleted_at IS NULL
        ORDER BY created_at ASC`,
      [postIds],
    );
    for (const row of result.rows) {
      const list = map.get(row.post_id) ?? [];
      list.push({
        id: row.id,
        filename: row.filename,
        mimeType: row.mime_type,
        sizeBytes: Number.parseInt(row.size_bytes, 10),
        url: attachmentUrl(row.id, row.filename),
      });
      map.set(row.post_id, list);
    }
    return map;
  }

  private toSummary(row: DbPostRow, attachments: AttachmentRow[]): PostSummaryRow {
    return {
      id: row.id,
      category: row.category,
      type: row.type,
      title: row.title,
      url: row.url,
      source: row.source,
      urgent: row.urgent,
      deadline: row.deadline,
      publishedAt: row.published_at.toISOString(),
      attachments,
    };
  }

  private toDetail(row: DbPostRow, attachments: AttachmentRow[]): PostDetailRow {
    return { ...this.toSummary(row, attachments), body: row.body };
  }

  private toAdmin(row: DbPostRow, attachments: AttachmentRow[]): AdminPostRow {
    return {
      ...this.toDetail(row, attachments),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      deletedAt: row.deleted_at === null ? null : row.deleted_at.toISOString(),
    };
  }

  async listPublic(
    category: "notice" | "news",
    urgentOnly: boolean,
    limit: number,
    offset: number,
  ): Promise<{ posts: PostSummaryRow[]; total: number }> {
    const urgentFilter = urgentOnly ? "AND urgent = true" : "";
    const [listResult, countResult] = await Promise.all([
      this.pool.query<DbPostRow>(
        `SELECT ${POST_COLUMNS} FROM posts
          WHERE deleted_at IS NULL AND category = $1 ${urgentFilter}
          ORDER BY urgent DESC, published_at DESC, id DESC
          LIMIT $2 OFFSET $3`,
        [category, limit, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM posts
          WHERE deleted_at IS NULL AND category = $1 ${urgentFilter}`,
        [category],
      ),
    ]);
    const attachments = await this.attachmentsFor(listResult.rows.map((row) => row.id));
    return {
      posts: listResult.rows.map((row) => this.toSummary(row, attachments.get(row.id) ?? [])),
      total: Number.parseInt(countResult.rows[0]?.count ?? "0", 10),
    };
  }

  async getPublic(id: string): Promise<PostDetailRow | null> {
    const result = await this.pool.query<DbPostRow>(
      `SELECT ${POST_COLUMNS} FROM posts WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const attachments = await this.attachmentsFor([row.id]);
    return this.toDetail(row, attachments.get(row.id) ?? []);
  }

  async listAdmin(
    category: "notice" | "news" | null,
    limit: number,
    offset: number,
  ): Promise<{ posts: AdminPostRow[]; total: number }> {
    const filter = category === null ? "" : "WHERE category = $3";
    const params: unknown[] = [limit, offset];
    if (category !== null) params.push(category);
    const [listResult, countResult] = await Promise.all([
      this.pool.query<DbPostRow>(
        `SELECT ${POST_COLUMNS} FROM posts ${filter}
          ORDER BY published_at DESC, id DESC LIMIT $1 OFFSET $2`,
        params,
      ),
      this.pool.query<{ count: string }>(
        category === null
          ? `SELECT count(*)::text AS count FROM posts`
          : `SELECT count(*)::text AS count FROM posts WHERE category = $1`,
        category === null ? [] : [category],
      ),
    ]);
    const attachments = await this.attachmentsFor(listResult.rows.map((row) => row.id));
    return {
      posts: listResult.rows.map((row) => this.toAdmin(row, attachments.get(row.id) ?? [])),
      total: Number.parseInt(countResult.rows[0]?.count ?? "0", 10),
    };
  }

  async getRaw(id: string): Promise<DbPostRow | null> {
    const result = await this.pool.query<DbPostRow>(`SELECT ${POST_COLUMNS} FROM posts WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async create(input: PostInput): Promise<AdminPostRow> {
    const result = await this.pool.query<DbPostRow>(
      `INSERT INTO posts (category, type, title, body, url, source, urgent, deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${POST_COLUMNS}`,
      [input.category, input.type, input.title, input.body, input.url, input.source, input.urgent, input.deadline],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("INSERT 가 행을 반환하지 않았습니다.");
    return this.toAdmin(row, []);
  }

  async update(id: string, input: PostInput): Promise<AdminPostRow | null> {
    const result = await this.pool.query<DbPostRow>(
      `UPDATE posts SET category=$2, type=$3, title=$4, body=$5, url=$6, source=$7,
              urgent=$8, deadline=$9, updated_at=now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${POST_COLUMNS}`,
      [id, input.category, input.type, input.title, input.body, input.url, input.source, input.urgent, input.deadline],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const attachments = await this.attachmentsFor([row.id]);
    return this.toAdmin(row, attachments.get(row.id) ?? []);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE posts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
