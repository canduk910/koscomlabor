-- Up Migration

-- Admin 세션 (명세 06 §10.3) — 토큰 원문은 저장하지 않는다 (SHA-256 hex 만)
CREATE TABLE admin_sessions (
  token_hash   char(64) PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE admin_sessions;
