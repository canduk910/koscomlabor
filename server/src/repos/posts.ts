/**
 * 게시물 저장소 — snake_case ↔ camelCase 변환은 이 경계에서 (명세 06 §11).
 *
 * 정렬 규약 (계약 §2 — 전 분류·전 목록 공통, 서버 책임):
 *   ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC
 * - `urgent` 가 여전히 최우선이다 (긴급 공지는 수동 순서보다 위 — 기존 동작 보존)
 * - `sort_order` 가 지정된 글이 미지정 글보다 위 (NULLS LAST)
 * - 미지정 글끼리는 기존과 동일하게 게시일 역순
 * **이 상수(ORDER_BY)를 우회해 ORDER BY 를 직접 쓰지 말 것.** 한 목록만 빠지면
 * "admin 에서는 순서대로인데 메인은 다른" 부분 고장이 된다 (이 프로젝트에 실제 신고 이력 있음).
 */
import type pg from "pg";
import type { PostCategory, PostInput } from "../lib/postValidate.js";
import { thumbnailUrlForKey } from "../lib/youtubeThumbnail.js";

export interface AttachmentRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string; // /files/<id>/<filename> (API 도메인 상대 경로)
}

export interface PostSummaryRow {
  id: string;
  category: PostCategory;
  type: "link" | "article";
  title: string;
  url: string | null;
  source: string | null;
  urgent: boolean;
  deadline: string | null;
  publishedAt: string;
  attachments: AttachmentRow[];
  /** `/thumbnails/<key>` 상대 경로 | null (계약 §6). 첨부와 동일하게 프론트가 절대화한다 */
  thumbnailUrl: string | null;
}

export interface PostDetailRow extends PostSummaryRow {
  body: string | null;
}

export interface AdminPostRow extends PostDetailRow {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /**
   * 수동 지정 순서 | null (계약 §6). **admin 응답 전용** —
   * 공개 응답에는 넣지 않는다 (정렬은 서버 책임이고, 노출하면 프론트가 재정렬하려는 유혹이 생긴다).
   */
  sortOrder: number | null;
}

interface DbPostRow {
  id: string;
  category: PostCategory;
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
  sort_order: number | null; // integer → JS number
  thumbnail_key: string | null;
}

const POST_COLUMNS =
  "id, category, type, title, body, url, source, urgent, deadline::text AS deadline, published_at, created_at, updated_at, deleted_at, sort_order, thumbnail_key";

/**
 * 정렬 규칙 단일 출처 (계약 §2). 모든 목록 쿼리가 이 상수를 쓴다 —
 * `grep -n "ORDER BY" server/src` 로 전수 조사했고, 게시물 목록은 여기 외에 없다.
 */
const ORDER_BY = "ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC";

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
      thumbnailUrl: row.thumbnail_key === null ? null : thumbnailUrlForKey(row.thumbnail_key),
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
      sortOrder: row.sort_order,
    };
  }

  async listPublic(
    category: PostCategory,
    urgentOnly: boolean,
    limit: number,
    offset: number,
  ): Promise<{ posts: PostSummaryRow[]; total: number }> {
    const urgentFilter = urgentOnly ? "AND urgent = true" : "";
    const [listResult, countResult] = await Promise.all([
      this.pool.query<DbPostRow>(
        `SELECT ${POST_COLUMNS} FROM posts
          WHERE deleted_at IS NULL AND category = $1 ${urgentFilter}
          ${ORDER_BY}
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
    category: PostCategory | null, // null = 전 분류
    limit: number,
    offset: number,
  ): Promise<{ posts: AdminPostRow[]; total: number }> {
    const filter = category === null ? "" : "WHERE category = $3";
    const params: unknown[] = [limit, offset];
    if (category !== null) params.push(category);
    const [listResult, countResult] = await Promise.all([
      this.pool.query<DbPostRow>(
        // admin 목록도 공개 목록과 **동일한 정렬 규칙**을 쓴다 (계약 §2).
        // 이전에는 `published_at DESC, id DESC` 였다 — 규칙이 갈리면 "admin 에서는 순서대로인데
        // 메인은 다른" 상태가 되어 관리자가 순서를 확인할 수 없다.
        // 주의: 분류 미지정(전 분류) 조회에서는 sort_order 가 분류별 1..n 이므로 분류가 교차한다.
        // 순서 조작은 분류를 지정한 화면에서 하는 것이 전제다 (06 §20.2 단서).
        `SELECT ${POST_COLUMNS} FROM posts ${filter}
          ${ORDER_BY} LIMIT $1 OFFSET $2`,
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

  /**
   * 생성. `sort_order` 는 지정하지 않는다(NULL) — 새 글은 수동 지정 글들 **아래**,
   * 미지정 글들 중에서는 최신이므로 맨 위에 온다. 이것이 07 §10.9 의 문제("글을 추가하면
   * 맨 위로 올라가 학습 순서가 깨진다")를 구조적으로 해소한다: 순서를 지정해 둔 노동교육 5건은
   * 새 글이 들어와도 위쪽 순서를 유지한다.
   */
  async create(input: PostInput, thumbnailKey: string | null): Promise<AdminPostRow> {
    const result = await this.pool.query<DbPostRow>(
      `INSERT INTO posts (category, type, title, body, url, source, urgent, deadline, thumbnail_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${POST_COLUMNS}`,
      [
        input.category,
        input.type,
        input.title,
        input.body,
        input.url,
        input.source,
        input.urgent,
        input.deadline,
        thumbnailKey,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("INSERT 가 행을 반환하지 않았습니다.");
    return this.toAdmin(row, []);
  }

  /** 수정. `sort_order` 는 **건드리지 않는다** — 내용 수정으로 지정한 순서가 날아가면 안 된다 */
  async update(id: string, input: PostInput, thumbnailKey: string | null): Promise<AdminPostRow | null> {
    const result = await this.pool.query<DbPostRow>(
      `UPDATE posts SET category=$2, type=$3, title=$4, body=$5, url=$6, source=$7,
              urgent=$8, deadline=$9, thumbnail_key=$10, updated_at=now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${POST_COLUMNS}`,
      [
        id,
        input.category,
        input.type,
        input.title,
        input.body,
        input.url,
        input.source,
        input.urgent,
        input.deadline,
        thumbnailKey,
      ],
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

  /**
   * 수동 정렬 적용 (계약 §3). `ids` 순서대로 `sort_order` 를 1..n 으로 지정한다.
   *
   * **낙관적 동시성 제어 (#4 순열 검증)** — 이 엔드포인트의 핵심 안전장치다.
   * 해당 분류의 활성 게시물 id 집합과 `ids` 가 완전 일치(같은 원소·같은 개수)하지 않으면
   * `{ ok: false, reason: "conflict" }` 를 돌려주고 **아무것도 쓰지 않는다.**
   * 다른 창에서 글이 추가·삭제된 뒤 낡은 목록으로 덮어써 순서가 누락·중복되는 것을 막는다.
   *
   * **원자성** — 조회·검증·갱신 전체가 하나의 트랜잭션이다. `FOR UPDATE` 로 대상 행을 잠가
   * 검증과 갱신 사이에 다른 트랜잭션이 같은 행을 바꾸지 못하게 한다. 갱신은 건별
   * `WHERE id = $1` 로 대상을 특정한다 (분류 전체를 무조건 UPDATE 하지 않는다 — 스킬 §3).
   *
   * `updated_at` 은 **갱신하지 않는다**: sort_order 는 내용이 아니라 표시 메타데이터이고,
   * 순서 한 번 바꿀 때마다 분류 전체의 "최근 수정"이 갱신되면 그 값이 무의미해진다.
   */
  async reorder(
    category: PostCategory,
    ids: string[],
  ): Promise<{ ok: true; updated: number } | { ok: false; reason: "conflict" }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const activeResult = await client.query<{ id: string }>(
        `SELECT id FROM posts
          WHERE category = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [category],
      );
      const activeIds = new Set(activeResult.rows.map((row) => row.id));

      // 완전 일치 검증: 개수가 같고 모든 원소가 활성 집합에 있으면 순열이다
      // (호출부가 중복 없음을 이미 보장한다 — 계약 §3 검증 #3)
      const isPermutation =
        activeIds.size === ids.length && ids.every((id) => activeIds.has(id));
      if (!isPermutation) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "conflict" };
      }

      let updated = 0;
      for (const [index, id] of ids.entries()) {
        const result = await client.query(
          `UPDATE posts SET sort_order = $2
            WHERE id = $1 AND category = $3 AND deleted_at IS NULL`,
          [id, index + 1, category],
        );
        updated += result.rowCount ?? 0;
      }
      // 잠근 행만 갱신했으므로 여기 도달하면 updated === ids.length 이다.
      // 어긋나면 잠금 가정이 깨진 것이므로 커밋하지 않는다 (부분 적용 방지).
      if (updated !== ids.length) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "conflict" };
      }
      await client.query("COMMIT");
      return { ok: true, updated };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
