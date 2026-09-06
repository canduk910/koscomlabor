/**
 * 공약 저장소 — snake_case ↔ camelCase 변환은 이 경계에서 (posts.ts 와 동일 규약).
 *
 * 정렬: `ORDER BY category, sort_order ASC, id ASC`.
 * ★ **카테고리 «간» 순서는 여기서 정하지 않는다.** SQL 의 `category` 는 알파벳순
 *   (dream → fair → happy → strong) 이라 화면 순서(든든한 → 행복한 → 공정한 → 꿈꾸는)와
 *   무관하다. 화면 순서는 프론트의 `PLEDGE_CATEGORY_ORDER` 가 갖는다 —
 *   한국어 라벨이 거기 있으니 순서도 거기 있어야 한 곳만 고치면 된다.
 *   여기서 CASE 로 순서를 흉내 내면 **같은 사실이 두 곳에 생기고 한쪽만 고쳐진다.**
 *   서버가 보증하는 것은 «카테고리 안의 순서»뿐이고, 프론트는 카테고리로 «묶기»만 한다.
 */
import type pg from "pg";
import type { PledgeCategory, PledgeInput, PledgeStatus } from "../lib/pledgeValidate.js";

export interface PledgeRow {
  id: string;
  category: PledgeCategory;
  title: string;
  detail: string | null;
  status: PledgeStatus;
  note: string | null;
  highlight: boolean;
  sortOrder: number;
}

export interface AdminPledgeRow extends PledgeRow {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface DbPledgeRow {
  id: string;
  category: PledgeCategory;
  title: string;
  detail: string | null;
  status: PledgeStatus;
  note: string | null;
  highlight: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const COLUMNS =
  "id, category, title, detail, status, note, highlight, sort_order, created_at, updated_at, deleted_at";

/** 정렬 단일 출처. 마이그레이션 1755300000006 의 idx_pledges_list 와 문자 단위로 같게 유지한다 */
const ORDER_BY = "ORDER BY category, sort_order ASC, id ASC";

function toPublic(row: DbPledgeRow): PledgeRow {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    detail: row.detail,
    status: row.status,
    note: row.note,
    highlight: row.highlight,
    sortOrder: row.sort_order,
  };
}

function toAdmin(row: DbPledgeRow): AdminPledgeRow {
  return {
    ...toPublic(row),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at === null ? null : row.deleted_at.toISOString(),
  };
}

export class PledgesRepository {
  constructor(private readonly pool: pg.Pool) {}

  /**
   * 공개 목록 — **페이징이 없다.** 화면이 집계(달성 n / 전체 n)를 내야 하므로 «전건»이
   * 한 번에 와야 한다. 부분만 오면 진행률이 조용히 틀린 값이 된다.
   * 43건 규모이고 관리자가 드물게 늘리는 목록이라 전건 조회가 문제되지 않는다.
   */
  async listPublic(): Promise<PledgeRow[]> {
    const result = await this.pool.query<DbPledgeRow>(
      `SELECT ${COLUMNS} FROM pledges WHERE deleted_at IS NULL ${ORDER_BY}`,
    );
    return result.rows.map(toPublic);
  }

  /** admin 목록 — 공개와 같은 집합(삭제분 제외)이되 타임스탬프를 함께 준다 */
  async listAdmin(): Promise<AdminPledgeRow[]> {
    const result = await this.pool.query<DbPledgeRow>(
      `SELECT ${COLUMNS} FROM pledges WHERE deleted_at IS NULL ${ORDER_BY}`,
    );
    return result.rows.map(toAdmin);
  }

  async getRaw(id: string): Promise<DbPledgeRow | null> {
    const result = await this.pool.query<DbPledgeRow>(
      `SELECT ${COLUMNS} FROM pledges WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  /**
   * 생성. `sort_order` 는 **해당 카테고리 말미**(max+1)에 붙인다.
   * ⚠ 서브쿼리로 한 문장에 계산한다 — 별도 SELECT 로 최댓값을 읽고 INSERT 하면 두 관리자가
   *   동시에 추가할 때 같은 순번이 나온다. 순번이 겹쳐도 `id ASC` 가 순서를 확정하므로
   *   화면이 깨지지는 않지만, 같은 값이 둘이면 나중에 순서를 손볼 때 근거가 사라진다.
   */
  async create(input: PledgeInput): Promise<AdminPledgeRow> {
    const result = await this.pool.query<DbPledgeRow>(
      `INSERT INTO pledges (category, title, detail, status, note, highlight, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,
               (SELECT coalesce(max(sort_order), 0) + 1 FROM pledges WHERE category = $1))
       RETURNING ${COLUMNS}`,
      [input.category, input.title, input.detail, input.status, input.note, input.highlight],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("INSERT 가 행을 반환하지 않았습니다.");
    return toAdmin(row);
  }

  /**
   * 수정. `sort_order` 는 **건드리지 않는다** — 내용을 고쳤다고 자리가 바뀌면 안 된다.
   * ⚠ 카테고리를 옮겨도 순번은 그대로다. 옮긴 카테고리 안에서 순번이 겹칠 수 있으나
   *   `id ASC` 가 순서를 확정하므로 목록이 흔들리지는 않는다.
   */
  async update(id: string, input: PledgeInput): Promise<AdminPledgeRow | null> {
    const result = await this.pool.query<DbPledgeRow>(
      `UPDATE pledges
          SET category=$2, title=$3, detail=$4, status=$5, note=$6, highlight=$7, updated_at=now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${COLUMNS}`,
      [id, input.category, input.title, input.detail, input.status, input.note, input.highlight],
    );
    return result.rows[0] === undefined ? null : toAdmin(result.rows[0]);
  }

  /** soft delete (posts 와 동일 — 실수 삭제를 DB 에서 되살릴 수 있다) */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE pledges SET deleted_at = now(), updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
