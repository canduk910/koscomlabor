-- Up Migration

-- 방명록 테이블 (명세: _workspace/06_backend_api_spec.md 6절)
-- PostgreSQL 13+: gen_random_uuid() 내장
CREATE TABLE guestbook_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author      varchar(80)   NOT NULL,  -- 20 코드포인트 검증은 앱 계층. 80은 UTF-8 여유 상한
  body        varchar(2000) NOT NULL,  -- 500 코드포인트 검증은 앱 계층
  ip_hash     char(64),                -- HMAC-SHA-256 hex. 리더 승인(2026-08-16): 90일 보존 후 NULL 처리
  created_at  timestamptz   NOT NULL DEFAULT now(),
  deleted_at  timestamptz               -- soft delete. NULL = 표시 대상
);

-- 목록 조회: 미삭제 글 최신순
CREATE INDEX idx_guestbook_list
  ON guestbook_entries (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 스팸 방지(중복 내용 제한) 조회용
CREATE INDEX idx_guestbook_ip_hash
  ON guestbook_entries (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

-- Down Migration

DROP TABLE guestbook_entries;
