-- Up Migration

-- 게시물 수동 정렬(sort_order) + YouTube 썸네일 캐시 키(thumbnail_key) 추가.
-- 계약: _workspace/00_input/contract-sort-thumbnail.md §1 / 명세 06 §20.
--
-- 발단: 노동교육 5건을 게시할 때 정렬 수단이 `published_at DESC` 뿐이어서 학습 순서를 맞추려고
-- **역순 등록**이라는 우회를 썼고, "admin 에서 글을 추가하면 맨 위로 올라가 순서가 깨진다"는
-- 한계를 그대로 안고 있었다 (07 §10.9). 그 근본 해결이다.
--
-- 두 컬럼 모두 **nullable** 이다. 기존 행은 전부 NULL 이 되므로 하위 호환이 보장된다 —
-- 구버전 API/프론트는 이 컬럼을 읽지 않고, 신규 API 는 NULL 을 "지정 없음"으로 해석한다.
ALTER TABLE posts ADD COLUMN sort_order    integer;   -- NULL = 수동 지정 없음
ALTER TABLE posts ADD COLUMN thumbnail_key text;      -- NULL = 썸네일 없음

-- sort_order 에 CHECK 제약을 **의도적으로 걸지 않았다.** 계약 §1 이 컬럼 정의를 문자 단위로
-- 고정했고, 값 범위(1..n 연속)는 `POST /admin/posts/reorder` 가 하나의 트랜잭션으로 보장한다.
-- DB 제약을 추가하면 계약 밖 실패 모드(500)가 생기고, 소급 데이터 보정 시 되레 방해가 된다.

-- 목록 인덱스 재생성 — 새 정렬 규칙(계약 §2)과 컬럼 순서를 일치시킨다.
--   ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC
-- PostgreSQL 은 ASC 의 기본 NULL 순서가 NULLS LAST 이므로 `ASC NULLS LAST` 는 기본값과 동일하다.
-- 그래도 **명시**한다: ORDER BY 절과 문자 단위로 같아야 "인덱스가 정렬을 제공하는가"를
-- 읽는 사람이 즉시 확인할 수 있고, 나중에 누가 DESC 로 바꿀 때 NULL 순서가 뒤집히는 것을
-- 눈에 보이게 한다.
--
-- 쿼리 플랜 확인 (로컬 전용 DB, 07 §11.5 ②에 원문 기록):
--   SET enable_seqscan = off;
--   EXPLAIN SELECT ... FROM posts WHERE deleted_at IS NULL AND category = 'education'
--     ORDER BY urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC LIMIT 50;
--   -> Limit -> Index Scan using idx_posts_list on posts   (**Sort 노드 없음** = 인덱스가 정렬 제공)
-- 실데이터 규모(수십 행)에서는 플래너가 Seq Scan + Sort 를 고르는 것이 정상이다.
-- 인덱스의 목적은 게시물이 늘어난 뒤에도 정렬 비용이 선형으로 커지지 않게 하는 것이다.
--
-- CONCURRENTLY 를 쓰지 않는 이유: node-pg-migrate 는 마이그레이션을 트랜잭션으로 감싸고
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 내에서 실행할 수 없다. posts 는 소규모라 짧은
-- 테이블 락(수 ms)으로 끝나며, 실패 시 트랜잭션 롤백으로 인덱스가 유실되지 않는 편이 안전하다.
DROP INDEX idx_posts_list;
CREATE INDEX idx_posts_list
  ON posts (category, urgent DESC, sort_order ASC NULLS LAST, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Down Migration

-- !! 데이터 소멸 경고 !!
-- 아래 DROP COLUMN 은 **관리자가 지정한 표시 순서(sort_order)와 취득한 썸네일 키(thumbnail_key)를
-- 영구히 소멸시킨다.** 되돌린 뒤 다시 up 하면 두 컬럼은 전부 NULL 로 되살아나고,
--   - 노동교육의 학습 순서는 다시 `published_at DESC` 우연에 맡겨지며(= 07 §10.9 의 그 문제로 회귀),
--   - 썸네일은 `scripts/backfill-thumbnails.mjs` 로 재취득해야 한다
--     (디스크의 {UPLOAD_DIR}/thumbnails/*.jpg 파일 자체는 남으므로 재취득은 네트워크 없이 끝난다).
-- 순서를 보존해야 한다면 down 전에 백업을 뜰 것:
--   SELECT id, category, sort_order, thumbnail_key FROM posts WHERE sort_order IS NOT NULL
--      OR thumbnail_key IS NOT NULL;
--
-- 컬럼을 지우면 그 컬럼을 참조하는 인덱스도 함께 사라지지만, 원본 정의로 **명시 재생성**해
-- up→down 왕복 후 스키마가 0001 상태와 완전히 동일해지게 한다.
DROP INDEX idx_posts_list;
ALTER TABLE posts DROP COLUMN thumbnail_key;
ALTER TABLE posts DROP COLUMN sort_order;
CREATE INDEX idx_posts_list ON posts (category, urgent DESC, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;
