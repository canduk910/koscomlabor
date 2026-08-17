-- Up Migration

-- 게시물 세 번째 분류 'education'(노동교육) 추가 — 명세 06 §10.1 / 요건: 노동교육 요건 개정(2026-08-17).
-- 별도 education_links 테이블을 만들지 않고 기존 posts 파이프라인에 분류만 하나 더한다
-- (링크형 타입·제목·URL·출처·게시일 정렬·admin CRUD·soft delete 가 이미 전부 있다).
--
-- 제약 이름 근거: 0001 마이그레이션은 category 에 **인라인 컬럼 CHECK**(이름 미지정)를 썼고,
-- PostgreSQL 이 자동으로 posts_category_check 로 명명했다. 추측이 아니라 실제 DB 에서 확인했다:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'posts'::regclass AND contype = 'c';
--   -> posts_category_check | CHECK ((category = ANY (ARRAY['notice'::text, 'news'::text])))
-- 적용 전 프로덕션에서도 같은 쿼리로 이름을 재확인할 것 (07 문서 §10.5 ②).
--
-- DROP 에 IF EXISTS 를 쓰지 않는 것은 의도적이다. 이름이 다르면 여기서 **크게 실패**해야 한다.
-- IF EXISTS 였다면 구 제약이 남은 채 새 제약만 추가되어 education INSERT 가 계속 거부되는
-- "등록은 되는데 안 보이는" 부분 고장이 된다. 마이그레이션은 트랜잭션이므로 실패해도 무변경이다.
ALTER TABLE posts DROP CONSTRAINT posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
  CHECK (category IN ('notice','news','education'));

-- 그대로 두는 것들 (변경하지 않는 이유를 남긴다):
--
-- 1) posts_news_article_needs_source
--      CHECK (NOT (category = 'news' AND type = 'article') OR source IS NOT NULL)
--    조건절이 category = 'news' 로 한정돼 있어 education 행에는 애초에 적용되지 않는다.
--    education 에 source 를 강제하지 **않는다** (리더 판단): 노동교육 자료에는 지부가 자체 제작한
--    것이 섞일 수 있고 그때 인용할 외부 출처가 없다. 또 초기 콘텐츠는 전부 링크형인데,
--    링크형의 출처는 URL 자체다(명세 §14 게시 정책). 강제하면 자체 자료를 올릴 수 없게 된다.
--
-- 2) posts_link_needs_url / posts_article_needs_body
--    category 와 무관하게 type 만 보므로 education 에도 그대로 올바르게 적용된다 (수정 불필요).
--
-- 3) idx_posts_list (category, urgent DESC, published_at DESC, id DESC) WHERE deleted_at IS NULL
--    category 컬럼값의 도메인이 넓어질 뿐 인덱스 정의·부분 조건은 무관하다.
--    실제로 확인함 (pg_indexes) — 재생성·변경 불필요.

-- Down Migration

-- !! 경고 — 무조건 성공하지 않는다 !!
-- CHECK 제약은 soft delete 여부와 무관하게 **테이블의 모든 행**에 적용된다.
-- category = 'education' 인 행이 하나라도 남아 있으면(삭제 표시된 행 포함) 아래 ADD CONSTRAINT 가
--   ERROR: check constraint "posts_category_check" of relation "posts" is violated by some row
-- 로 실패하고, 트랜잭션이 롤백되어 down 마이그레이션 전체가 되돌아간다(DB 는 무변경으로 안전).
--
-- 되돌리기 전에 education 게시물을 먼저 정리해야 한다. 대상 확인 → 처리 순서:
--   SELECT id, title, deleted_at FROM posts WHERE category = 'education';   -- ① 대상 확인 (필수)
--   -- ② 보존이 필요하면 백업(pg_dump)을 먼저 뜬다
--   DELETE FROM posts WHERE category = 'education';                          -- ③ WHERE 절 필수
-- 첨부가 달려 있으면 post_attachments 의 FK 때문에 ③이 막힌다. 그때는 해당 첨부를 먼저 지운다:
--   DELETE FROM post_attachments WHERE post_id IN (SELECT id FROM posts WHERE category = 'education');
-- 절차 전문은 07 문서 §10.6(롤백).
ALTER TABLE posts DROP CONSTRAINT posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
  CHECK (category IN ('notice','news'));
