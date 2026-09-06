/**
 * 사이트 노출 설정 저장소 — 단일 행(id=1).
 *
 * ★ **행이 없어도 «비공개»로 읽는다.** 마이그레이션이 아직 안 돈 서버, 또는 행이 지워진
 *   상황에서 «공개»로 떨어지면 관리자가 준비 중인 화면이 조합원에게 새어 나간다.
 *   안전한 쪽으로 기울인다 — 못 읽으면 안 보여준다.
 * ⚠ 반대로 `set` 은 행이 없으면 만든다(UPSERT). 관리자가 켰는데 저장될 자리가 없어
 *   조용히 실패하는 것을 막는다.
 */
import type pg from "pg";

export interface SiteSettings {
  pledgesPublished: boolean;
  /** ISO 8601 UTC | null (행이 없어 기본값을 쓴 경우) */
  updatedAt: string | null;
}

interface DbRow {
  pledges_published: boolean;
  updated_at: Date;
}

/** 행을 읽지 못했을 때의 값 — **비공개**. 위 머리 주석의 근거를 읽고 바꿔라 */
const SAFE_DEFAULT: SiteSettings = { pledgesPublished: false, updatedAt: null };

export class SettingsRepository {
  constructor(private readonly pool: pg.Pool) {}

  async get(): Promise<SiteSettings> {
    const result = await this.pool.query<DbRow>(
      `SELECT pledges_published, updated_at FROM site_settings WHERE id = 1`,
    );
    const row = result.rows[0];
    if (row === undefined) return SAFE_DEFAULT;
    return { pledgesPublished: row.pledges_published, updatedAt: row.updated_at.toISOString() };
  }

  async setPledgesPublished(published: boolean): Promise<SiteSettings> {
    const result = await this.pool.query<DbRow>(
      `INSERT INTO site_settings (id, pledges_published, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET pledges_published = EXCLUDED.pledges_published,
                                      updated_at = now()
       RETURNING pledges_published, updated_at`,
      [published],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("UPSERT 가 행을 반환하지 않았습니다.");
    return { pledgesPublished: row.pledges_published, updatedAt: row.updated_at.toISOString() };
  }
}
