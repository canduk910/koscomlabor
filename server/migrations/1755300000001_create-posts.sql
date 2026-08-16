-- Up Migration

-- 게시물 (공지·소식 DB 전환 — 명세 06 §10.1)
CREATE TABLE posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text NOT NULL CHECK (category IN ('notice','news')),
  type          text NOT NULL CHECK (type IN ('link','article')),
  title         varchar(300)  NOT NULL,
  body          text,                            -- 작성형 markdown 필수 / 링크형 선택(코멘트)
  url           text,                            -- 링크형 필수
  source        varchar(200),                    -- news+article 필수 (기존 출처 원칙 계승)
  urgent        boolean NOT NULL DEFAULT false,
  deadline      date,
  published_at  timestamptz NOT NULL DEFAULT now(),  -- 자동 기록·수정 불가 (리더 판정 §15-6)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT posts_link_needs_url     CHECK (type <> 'link'    OR url  IS NOT NULL),
  CONSTRAINT posts_article_needs_body CHECK (type <> 'article' OR body IS NOT NULL),
  CONSTRAINT posts_news_article_needs_source
    CHECK (NOT (category = 'news' AND type = 'article') OR source IS NOT NULL)
);

CREATE INDEX idx_posts_list ON posts (category, urgent DESC, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 첨부 (명세 06 §10.2)
CREATE TABLE post_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES posts(id),
  filename     varchar(255) NOT NULL,
  storage_key  varchar(255) NOT NULL,
  mime_type    varchar(100) NOT NULL,
  size_bytes   bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_attachments_post ON post_attachments (post_id) WHERE deleted_at IS NULL;

-- Down Migration

DROP TABLE post_attachments;
DROP TABLE posts;
