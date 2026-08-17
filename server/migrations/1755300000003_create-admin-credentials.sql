-- Up Migration

-- Admin 자격 증명 (명세 06 §10.4) — 비밀번호 해시의 권위 저장소.
-- 환경변수 ADMIN_PASSWORD_HASH 는 최초 부팅 시드 전용이며, 이 행이 생긴 뒤에는 무시된다.
-- updated_at IS NULL = 시드된 초기 비밀번호를 아직 한 번도 바꾸지 않은 상태 (passwordIsInitial).
CREATE TABLE admin_credentials (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  seeded_at     timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz            -- NULL = 초기(시드) 비밀번호 그대로
);

-- Down Migration

DROP TABLE admin_credentials;
