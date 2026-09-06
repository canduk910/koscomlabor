-- Up Migration

-- 사이트 노출 설정 (사용자 지시 2026-09-06) — 단일 행 테이블.
-- `admin_credentials`(1755300000003)와 같은 «id=1 고정» 패턴이다: 행이 하나뿐임을 DB 가 보증한다.
--
-- 왜 필요했나: 마이그레이션이 43건을 전부 'undone'(미달성)으로 넣으므로, API 를 올리는 순간
-- 메인에 「공약 43건 중 0건 달성」이 **공개로** 뜬다. 관리자가 값을 채울 시간을 확보하려면
-- «데이터 투입»과 «조합원에게 보이기»가 갈려 있어야 한다.
CREATE TABLE site_settings (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- ★ **기본값은 `false`(비공개)다.** 배포 직후에는 조합원에게 아무것도 안 보인다.
  -- ⛔ 기본값을 `true` 로 바꾸지 마라 — 이 컬럼이 존재하는 이유가 그것이다.
  pledges_published boolean NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 행을 «지금» 만든다. 없어도 서버가 기본값(비공개)으로 읽도록 방어해 두었지만(repos/settings.ts),
-- 행이 있어야 관리자가 켠 값이 저장될 자리가 생긴다.
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Down Migration

-- !! 데이터 소멸 경고 !!
-- 되돌리면 **공개 여부 설정이 사라진다.** 다시 up 하면 «비공개»로 돌아가므로,
-- 이미 공개 중이던 상황판이 조합원 화면에서 사라진다(데이터는 pledges 에 그대로 남는다).
DROP TABLE site_settings;
