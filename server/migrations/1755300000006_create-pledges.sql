-- Up Migration

-- 공약 이행 상황판 (design/공약집_최종.pdf 기반 · 사용자 지시 2026-09-06).
--
-- posts 와 **별도 테이블**이다. 공약은 게시물이 아니다 —
--   · 게시일·긴급·첨부·링크가 없고, 대신 «상태»와 «비고»가 있다
--   · 목록이 닫혀 있다(43건에서 시작해 드물게 는다). 게시물처럼 계속 쌓이지 않는다
--   · 조회 방식이 다르다: 게시물은 분류별 페이징, 공약은 «전건 한 번에»(집계를 내야 한다)
-- posts 에 컬럼을 얹었다면 위 넷이 전부 NULL 인 행이 43개 생기고, 게시물 목록·정렬·
-- 마감 스트립이 전부 "공약은 제외"라는 분기를 갖게 된다. 그것이 이 테이블을 나눈 이유다.
CREATE TABLE pledges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 카테고리 4종 = 공약집이 스스로 붙인 표제다 (든든한/행복한/공정한/꿈꾸는 코스콤).
  -- 한국어 라벨은 DB 에 두지 않는다 — 화면 문면의 단일 출처는 프론트(src/lib/pledges.ts)다.
  category    text NOT NULL CHECK (category IN ('strong','happy','fair','dream')),
  title       varchar(200) NOT NULL,
  detail      text,          -- 세부 항목. 줄바꿈(\n) 구분 · NULL = 세부 없음
  -- 신호등 3단계. 화면 라벨은 달성 / 협의중 / 미달성 (사용자 확정 2026-09-06).
  -- ⛔ 4번째 상태를 늘리지 마라 — 신호등은 «세 칸»이라는 것이 이 화면의 전부다.
  status      text NOT NULL DEFAULT 'undone' CHECK (status IN ('done','talking','undone')),
  note        text,          -- 비고 · NULL = 없음
  -- 공약집 2쪽 「핵심공약」에 실린 건 (43건 중 20건).
  highlight   boolean NOT NULL DEFAULT false,
  -- **카테고리 «안»의 순서다**(1..n). 전체 통순번이 아니다 —
  -- 카테고리 간 순서는 화면이 정한다(PLEDGE_CATEGORY_ORDER). 두 곳에 적으면 어긋난다.
  sort_order  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- 목록 인덱스 — 쿼리의 ORDER BY 와 문자 단위로 같게 유지한다
-- (repos/pledges.ts 의 ORDER_BY 상수. 어긋나면 인덱스가 정렬을 제공하지 못한다).
CREATE INDEX idx_pledges_list ON pledges (category, sort_order ASC, id ASC)
  WHERE deleted_at IS NULL;

-- Down Migration

-- !! 데이터 소멸 경고 !!
-- 관리자가 기입한 **이행 상태(status)와 비고(note)가 영구히 사라진다.**
-- 되돌린 뒤 다시 up 하면 43건이 전부 'undone'(미달성) · 비고 없음으로 되살아난다.
-- 보존이 필요하면 down 전에:
--   SELECT category, title, status, note FROM pledges WHERE deleted_at IS NULL ORDER BY category, sort_order;
DROP TABLE pledges;
