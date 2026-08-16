# 디자인 스펙: 메인페이지 (탭 게시판)

- 작성: frontend-designer | 작성일: 2026-08-16
- 근거: `_workspace/00_input/requirements.md`, `union-design-system` 스킬
- 범위: 메인페이지 전체 (헤더 / 긴급 공지 배너 / 탭 게시판(공지사항·금융노조 소식·방명록) / 푸터)
- 다크 모드: **범위 제외** (스킬 기준). **create-next-app 기본 `globals.css`에 있는 `@media (prefers-color-scheme: dark)` 블록은 제거할 것** — 라이트 모드 토큰만 유지한다. 도입 시 전 조합 재검사 필요.
- 팔레트: **실제 CI 픽셀 실측 기반** (2026-08-16 2차 개정 — 추출·개정 근거는 §10). 1차 플레이스홀더 파랑(#1d4ed8 계열)·적색(#b91c1c 계열)은 전부 폐기. 대비 검증은 전 조합 재실행 완료(§2).

---

## 1. 디자인 토큰 (Tailwind CSS v4 `@theme`)

아래 블록을 `app/globals.css`의 `@import "tailwindcss";` 바로 아래에 그대로 붙일 수 있다.
분기점(sm 640px / md 768px / lg 1024px)은 Tailwind v4 기본값과 동일하므로 재정의하지 않는다.

```css
@theme {
  /* ---- 색상 (15) — 2026-08-16 CI 실측 개정 ---- */
  --color-bg: #ffffff;             /* 페이지 기본 배경 */
  --color-surface: #f9fafb;        /* 탭바·푸터·카드 배경 */
  --color-ink: #1a1a1a;            /* 본문·제목 텍스트 */
  --color-ink-muted: #4b5563;      /* 보조 텍스트(날짜·출처·비선택 탭) */
  --color-primary: #093389;        /* 주조색 — KFIU 깃발 파랑 원색(실측). 텍스트·UI 겸용(11.37:1) */
  --color-primary-strong: #093389; /* primary와 동일 값 — 토큰명 유지 목적(§10). 기존 사용처 그대로 유효 */
  --color-primary-tint: #eff6ff;   /* 탭 hover 배경 (1차 값 유지) */
  --color-urgent: #d0101b;         /* KFIU 깃발 빨강 원색(실측) — 보더 등 UI 전용, 텍스트 금지 */
  --color-urgent-strong: #9c0d14;  /* KFIU 빨강 동일 색상군 파생 — 긴급 텍스트·긴급 배지 배경 */
  --color-urgent-tint: #fef2f2;    /* 긴급 배너 배경 (1차 값 유지) */
  --color-accent: #ec6d1e;         /* 코스콤 오렌지 원색(실측) — 로고·장식 전용, 텍스트/의미 UI 금지 */
  --color-accent-strong: #7a3806;  /* 오렌지 동일 색상군 파생 — accent 텍스트·아이콘 */
  --color-accent-tint: #fdf0e7;    /* 온누리 가이드 카드(§9) 배경 */
  --color-border-strong: #6b7280;  /* 의미 있는 UI 경계(입력 필드 등)·보조 아이콘 */
  --color-border-soft: #e5e7eb;    /* 장식용 구분선 전용 — 의미 전달 UI에 사용 금지 */

  /* ---- v2 모던 개편 추가 (2026-08-16 3차 — §11) ---- */
  --color-primary-soft: #d9e9ff;   /* 라이트블루 서피스(레퍼런스 실측) — 날짜 배지 기본형·마감 스트립 배경 */
  --color-primary-bright: #2e7df7; /* 밝은 블루(레퍼런스 실측) — 장식 도형·아이콘 배경 전용(3.89:1), 텍스트 조합 전면 금지 */

  --font-sans: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif;

  --text-hero: 2.5rem;             /* 40px 히어로 대형 타이포 (모바일) */
  --text-hero--line-height: 1.2;
  --text-hero--font-weight: 800;
  --text-hero--letter-spacing: -0.02em;
  --text-hero-lg: 3.5rem;          /* 56px 히어로 (md+, md:text-hero-lg) */
  --text-hero-lg--line-height: 1.15;
  --text-hero-lg--font-weight: 800;
  --text-hero-lg--letter-spacing: -0.02em;
  --tracking-heading: -0.01em;     /* display·h1·h2 한글 자간 보정 — 위 --text-*--letter-spacing 모디파이어로 내장됨. 이 토큰은 스케일 밖 커스텀 대형 텍스트용 보조 (본문·caption은 0 유지) */

  --radius-card: 1.5rem;           /* 24px 카드·히어로(모바일)·온누리 카드 */
  --radius-panel: 2rem;            /* 32px 히어로 패널 (md+) */
  --radius-badge: 0.75rem;         /* 12px 날짜 배지·입력 필드(v2) */

  --shadow-card: 0 4px 20px rgb(9 51 137 / 0.08);
  --shadow-card-hover: 0 8px 28px rgb(9 51 137 / 0.12);

  /* ---- 타이포그래피 스케일 (5단계) ---- */
  --text-display: 2.5rem;                 /* 40px 페이지 대제목 */
  --text-display--line-height: 1.3;
  --text-display--font-weight: 700;
  --text-display--letter-spacing: -0.01em; /* v2: heading 자간 토큰 내장 (2026-08-16 확정) */
  --text-h1: 2rem;                        /* 32px 섹션 제목 */
  --text-h1--line-height: 1.3;
  --text-h1--font-weight: 700;
  --text-h1--letter-spacing: -0.01em;     /* v2 */
  --text-h2: 1.5rem;                      /* 24px 소제목·카드 제목 */
  --text-h2--line-height: 1.3;
  --text-h2--font-weight: 600;
  --text-h2--letter-spacing: -0.01em;     /* v2 */
  --text-body: 1.125rem;                  /* 18px 본문 기본 */
  --text-body--line-height: 1.7;
  --text-caption: 0.9375rem;              /* 15px 보조 정보 — 이보다 작은 텍스트 금지 */
  --text-caption--line-height: 1.5;

  /* ---- 간격·레이아웃 (3) ---- */
  --spacing-touch: 2.75rem;   /* 44px 최소 터치 대상 (min-h-touch / min-w-touch) */
  --container-prose: 42rem;   /* 672px 본문 줄 길이 상한 (한글 35~40자) */
  --container-page: 48rem;    /* 768px 페이지 콘텐츠 컨테이너 상한 */
}

html {
  font-size: 100%;
  color: var(--color-ink);
  background: var(--color-bg);
}
```

- 2차 개정(2026-08-16): 값 변경 4건(`primary`, `primary-strong`, `urgent`, `urgent-strong`), 신규 3건(`accent`, `accent-strong`, `accent-tint`), 나머지 8건 유지. **토큰 이름은 전부 유지 — 개발자는 globals.css의 값 교체 + accent 3줄 추가만 하면 된다.**
- 사용 규칙: KFIU 파랑 원색(#093389)은 AAA 통과로 텍스트·UI 겸용 — `primary`/`primary-strong` 구분은 소멸했으나 토큰명 유지를 위해 동일 값을 둔다. **`--color-urgent`(#d0101b)와 `--color-accent`(#ec6d1e)는 텍스트 사용 금지** — 긴급 텍스트·배지는 `--color-urgent-strong`(#9c0d14), 오렌지 텍스트·아이콘은 `--color-accent-strong`(#7a3806)을 쓴다.
- 3차 개정(v2 모던 개편, 2026-08-16): **기존 토큰 값 변경 0건**, 추가만 — 색 2(`primary-soft`·`primary-bright`), 폰트 1(`font-sans` — Pretendard, §11.2), 타이포 2단계(hero·hero-lg, 자간 포함), tracking 1, radius 3, shadow 2. `--color-primary-bright`(3.89:1)는 장식 도형·아이콘 배경 전용으로 텍스트 조합 전면 금지(§2 v2 표).

## 2. 대비 검증 결과

전 조합을 `check-contrast.mjs`로 실제 실행해 검증했다. **2026-08-16 CI 실측 개정에 따라 표 전면 갱신** — 1차 플레이스홀더 팔레트(#1d4ed8·#1e40af·#b91c1c·#991b1b) 조합은 전부 폐기했고, 아래 표의 수치는 개정 시점에 전 조합 재실행한 실측값이다. 아래 "채택 조합"만 스펙에 사용한다.

### 채택 조합 (21) — 전체 통과

| # | 전경 | 배경 | 비율 | 판정 | 용도 |
|---|------|------|------|------|------|
| 1 | `#1a1a1a` | `#ffffff` | 17.40 | AAA(본문) | 본문·제목·목록 제목 |
| 2 | `#1a1a1a` | `#f9fafb` | 16.65 | AAA(본문) | surface 위 텍스트(푸터 지부명 등) |
| 3 | `#1a1a1a` | `#fef2f2` | 15.91 | AAA(본문) | 긴급 배너 내 제목 |
| 4 | `#1a1a1a` | `#eff6ff` | 15.99 | AAA(본문) | primary-tint 위 텍스트 |
| 5 | `#1a1a1a` | `#fdf0e7` | 15.58 | AAA(본문) | 가이드 카드(§9) 설명 텍스트 |
| 6 | `#4b5563` | `#ffffff` | 7.56 | AAA(본문) | 게시일·출처 caption |
| 7 | `#4b5563` | `#f9fafb` | 7.23 | AAA(본문) | 비선택 탭 레이블·푸터 caption |
| 8 | `#093389` | `#ffffff` | 11.37 | AAA(본문)·UI 통과 | 링크·제목 hover·포커스 링(텍스트/UI 겸용) |
| 9 | `#093389` | `#f9fafb` | 10.88 | AAA(본문)·UI 통과 | surface 위 링크·포커스 링 |
| 10 | `#093389` | `#eff6ff` | 10.45 | AAA(본문) | 탭 hover 상태 레이블 |
| 11 | `#ffffff` | `#093389` | 11.37 | AAA(본문) | 선택 탭 레이블·버튼 텍스트 |
| 12 | `#9c0d14` | `#ffffff` | 8.46 | AAA(본문) | urgent 게시물 강조 텍스트 |
| 13 | `#9c0d14` | `#fef2f2` | 7.74 | AAA(본문) | 긴급 배너 내 보조 텍스트·아이콘·포커스 링 |
| 14 | `#ffffff` | `#9c0d14` | 8.46 | AAA(본문) | "긴급" 배지 텍스트 |
| 15 | `#d0101b` | `#ffffff` | 5.57 | UI 3:1 통과·큰텍스트 AAA | urgent 목록 아이템 좌측 보더 (텍스트 금지) |
| 16 | `#d0101b` | `#fef2f2` | 5.09 | UI 3:1 통과 | 긴급 배너 좌측 보더 (텍스트 금지) |
| 17 | `#7a3806` | `#ffffff` | 8.77 | AAA(본문) | accent 텍스트(흰 배경)·카드 hover 아웃라인 |
| 18 | `#7a3806` | `#fdf0e7` | 7.84 | AAA(본문) | 가이드 카드(§9) 제목·아이콘 |
| 19 | `#ec6d1e` | `#ffffff` | 3.10 | UI 3:1 통과(여유 없음) | 흰 배경 인접 장식 보더·로고 셰브런 전용 |
| 20 | `#6b7280` | `#ffffff` | 4.83 | UI 3:1 통과 | 입력 필드 보더·빈 상태 아이콘 |
| 21 | `#6b7280` | `#f9fafb` | 4.63 | UI 3:1 통과 | surface 위 보더·아이콘 |

### v2 추가 조합 (2026-08-16 3차) — 전체 통과

| # | 전경 | 배경 | 비율 | 판정 | 용도 |
|---|------|------|------|------|------|
| 22 | `#093389` | `#d9e9ff` | 9.23 | AAA(본문) | 날짜 배지(기본형) 텍스트·마감 스트립 텍스트 |
| 23 | `#d9e9ff` | `#093389` | 9.23 | AAA(본문) | 히어로 아이브로우·게시일·푸터 저작권 |
| 24 | `#1a1a1a` | `#d9e9ff` | 14.13 | AAA(본문) | soft 서피스 위 본문(예비) |
| 25 | `#ffffff` | `#2e7df7` | 3.89 | UI·큰텍스트 AA | 장식 도형 위 아이콘 전용 (텍스트 금지) |
| 26 | `#2e7df7` | `#ffffff` | 3.89 | UI·큰텍스트 AA | 흰 배경 위 장식 도형·아이콘 (텍스트 금지) |

### 검증 후 탈락·제한 조합 — 스펙에 텍스트로 사용 금지

| 전경 | 배경 | 비율 | 처리 |
|------|------|------|------|
| `#ec6d1e` | (모든 배경) | ≤3.10 | 텍스트 전면 금지 — 오렌지 텍스트는 `#7a3806` |
| `#ec6d1e` | `#fdf0e7` | 2.78 | tint 위 UI 3:1 미달 — 의미 전달 UI 불가, 장식 전용(§9.2 보더 규정 참조) |
| `#d0101b` | `#ffffff` | 5.57 | (재기재) 본문 AAA 미달 — 긴급 텍스트는 `#9c0d14` |
| `#ffffff` | `#d0101b` | 5.57 | 배지 배경으로 부적합 — 배지 배경은 `#9c0d14`(8.46) |
| `#5a5657` | `#f9fafb` | 6.92 | 코스콤 워드마크 그레이 — surface 위 AAA 미달로 토큰 미채택, 로고 이미지 전용 (흰 배경 위 7.23은 통과) |
| `#9ca3af` | `#ffffff` | 2.54 | UI 3:1 미달 — 전면 사용 금지 |
| `#e5e7eb` | `#ffffff` | 1.24 | 장식용 구분선 전용 허용. 의미 전달 UI(선택 표시·필드 경계) 사용 금지 |
| `#4b5563` | `#eff6ff` | 6.94 | AAA 미달 — tint 배경 위 caption 금지, `#093389` 또는 `#1a1a1a` 사용 |
| `#595959` | `#f9fafb` | 6.70 | (1차 검증분) 보조 텍스트는 `#4b5563`으로 통일 |
| `#9c0d14` | `#d9e9ff` | 6.87 | (v2) AAA 미달 — 마감 스트립 임박 항목은 red 칩(흰 텍스트 on #9c0d14, 8.46) 방식 사용 |
| `#d0101b` | `#d9e9ff` | 4.52 | (v2) 레퍼런스의 "라이트블루 위 빨강 텍스트" 스타일 — AAA 미달로 미채택 |
| `#4b5563` | `#d9e9ff` | 6.14 | (v2) soft 서피스 위 muted 금지 — `#093389` 또는 `#1a1a1a` 사용 |
| `#7fb0f0` | `#093389` | 5.08 | (v2) 히어로 위 장식 도형 전용(UI 3:1 통과) — 텍스트 금지 |
| `#d9e9ff` | `#9c0d14` | 6.87 | (v2) 미채택 — red 칩 위 텍스트는 `#ffffff`(8.46) |

## 3. 페이지 레이아웃 스펙

```
┌──────────────────────────────┐
│ 헤더 (지부명)                  │
├──────────────────────────────┤
│ [조건부] 긴급 공지 배너         │
├──────────────────────────────┤
│ 탭 게시판                      │
│  ├ 탭리스트 (3탭)              │
│  └ 탭패널 (목록/폼)            │
├──────────────────────────────┤
│ 푸터                          │
└──────────────────────────────┘
```

공통 컨테이너: `max-width: var(--container-page)` (48rem), 중앙 정렬, 좌우 패딩 모바일 `1rem` / md+ `1.5rem`. 전 구간 단일 컬럼(목록형 페이지이므로 lg에서도 컬럼 분할 없음 — 줄 길이 유지 목적).

### 3.1 헤더

- `<header>` 요소. 배경 `--color-bg`, 하단 구분선 `1px solid --color-border-soft`(장식).
- 세로 패딩: 모바일 `0.75rem`, md+ `1rem`.
- 지부명은 2행 구성. 전체가 홈(`/`) 링크 1개 (터치 대상: 링크 블록 `min-height: var(--spacing-touch)`):
  - 1행 — 상위 조직명 "전국금융산업노동조합": `--text-caption`(15px) / 400 / `--color-ink-muted`
  - 2행 — "코스콤지부": 모바일 `--text-h2`(24px) / 700 / `--color-ink`, md+ `--text-h1`(32px) / 700
- 로고 (2026-08-16 CI 확보로 추가): 지부명 텍스트 좌측에 KFIU 깃발 마크(`/brand/kfiu-mark.png` — 자산 스펙 §10.3). 높이 모바일 `40px` / md+ `48px`(원본비 1.284:1 → 폭 ≈51/62px), 텍스트와 gap `0.75rem`, `alt=""` + `aria-hidden="true"`(인접 지부명 텍스트가 의미 전달), 홈 링크 블록에 포함. 헤더 배경이 `#ffffff`이므로 흰 배경 JPG 유래 자산 배치 조건 충족(§10.3). 로딩: 첫 화면 고정 요소이므로 지연 로딩 금지(next/image `priority` — lazy 플래시 방지, 구현 확인 후 공식화).

### 3.2 긴급 공지 배너 (조건부) — ※ v2에서 히어로 패널(§11.4)로 대체

> **v2 개정(2026-08-16 3차)**: 아래 배너는 §11.4 히어로 패널이 역할을 승계하며 v2 적용과 동시에 제거한다(중복 노출 금지). 본 절은 v2 이전 상태의 기록으로 유지.

- 노출 조건: verified 공지 중 frontmatter `urgent: true`인 게시물이 1건 이상일 때만 렌더. 없으면 DOM에서 제외(빈 자리 없음). 여러 건이면 최신 1건만 배너, 나머지는 목록 상단 정렬.
- 구조: `<section role="region" aria-label="긴급 공지">`, 헤더 바로 아래 전폭. 내부 콘텐츠는 공통 컨테이너 정렬.
- 스타일: 배경 `--color-urgent-tint`, 좌측 보더 `4px solid --color-urgent`, 세로 패딩 `1rem`.
- 내부 구성 (색+아이콘+레이블 3중 병행 — 색만으로 의미 전달 금지):
  1. 경고 아이콘: 삼각형 느낌표 SVG `20px`, `currentColor`, 색 `--color-urgent-strong`, `aria-hidden="true"`
  2. "긴급" 배지: 배경 `--color-urgent-strong`, 텍스트 `#ffffff` 15px/700, 패딩 `2px 8px`, radius `4px`
  3. 제목: `--text-body`(18px)/700/`--color-ink`, 상세로 가는 링크(밑줄, 링크 전체 `min-height: var(--spacing-touch)`)
  4. 게시일: `--text-caption`/`--color-urgent-strong`
- focus-visible(배너 내 링크): `outline: 3px solid --color-urgent-strong; outline-offset: 2px` (7.74:1)

### 3.3 탭 게시판 영역

- `<main>` 내부. 배너(또는 헤더)와의 상단 여백 `2rem`, 탭리스트와 패널 사이 `1rem` (섹션 위 여백 ≥ 아래 여백 2배 원칙).
- 상세 스펙은 §4(탭), §5(목록), §6(빈 상태), §7(방명록).

### 3.4 푸터

- `<footer>`. 배경 `--color-surface`, 상단 구분선 `1px solid --color-border-soft`, 세로 패딩 `2rem`, 본문과의 상단 여백 `4rem`.
- 내용: 지부명 전체 표기 `--text-caption`/600/`--color-ink`, 그 아래 연락처·주소 자리 `--text-caption`/400/`--color-ink-muted`. 실 연락처 확보 전에는 항목 자체를 렌더하지 않는다(플레이스홀더 연락처 금지).
- 저작권 표기: `© 2026 전국금융산업노동조합 코스콤지부` `--text-caption`/`--color-ink-muted`.
- 로고 행 (2026-08-16 CI 확보로 추가): 지부명 아래에 KFIU 마크 + 코스콤 기본형 로고를 각 높이 `24px`로 나란히 배치 — 상세(흰 칩 처리·alt·근거)는 §10.3. 세로 여백: 지부명↓로고 행 `0.75rem`, 로고 행↓저작권 `0.75rem` (구현 확인 후 공식화).

### 3.5 반응형 요약

| 구간 | 동작 |
|------|------|
| 기본(~639px) | 단일 컬럼, 좌우 패딩 1rem, 탭 3등분 전폭, 지부명 24px |
| sm(640px~) | 컨테이너 중앙 정렬 시작(max-w 48rem), 그 외 동일 |
| md(768px~) | 좌우 패딩 1.5rem, 지부명 32px, 탭은 콘텐츠 폭 좌측 정렬(각 탭 min-width 8rem) |
| lg(1024px~) | 추가 변화 없음(줄 길이 유지를 위해 컨테이너 고정) |

## 4. 탭 컴포넌트 스펙

### 4.1 구조·ARIA (필수)

```html
<div role="tablist" aria-label="게시판">
  <button role="tab" id="tab-notices"   aria-selected="true"  aria-controls="panel-notices" tabindex="0">공지사항</button>
  <button role="tab" id="tab-news"      aria-selected="false" aria-controls="panel-news"    tabindex="-1">금융노조 소식</button>
  <button role="tab" id="tab-guestbook" aria-selected="false" aria-controls="panel-guestbook" tabindex="-1">방명록</button>
</div>
<div role="tabpanel" id="panel-notices" aria-labelledby="tab-notices" tabindex="0">…</div>
<!-- 비선택 패널은 hidden -->
```

- 로빙 탭인덱스: 선택 탭만 `tabindex="0"`, 나머지 `-1`.
- 키보드: `←`/`→` 인접 탭 이동(양끝 순환), `Home`/`End` 처음/끝. 이동 즉시 활성화(automatic activation — 패널이 로컬 콘텐츠라 비용 없음).
- 각 `tabpanel`에 `tabindex="0"`(패널 내 첫 포커스 대상이 없을 수 있으므로).
- 기본 선택 탭: **공지사항**. 탭 전환 시 URL 쿼리 `?tab=notices|news|guestbook` 동기화 권장(공유·새로고침 유지) — 구현 재량.

### 4.2 시각 스타일 (세그먼티드 컨트롤형)

- 탭리스트 컨테이너: 배경 `--color-surface`, radius `12px`, 내부 패딩 `4px`, 탭 간 gap `4px`. 모바일: 3탭 `flex: 1` 균등 분할. md+: 콘텐츠 폭 좌측 정렬, 각 탭 `min-width: 8rem`.
- 탭 공통: `min-height: var(--spacing-touch)`(44px), radius `8px`, 줄바꿈 금지. 패딩·폰트는 분기별 확정값(QA 1회차 S1 반영, 2026-08-16 개정):
  - **md 미만 (3탭 균등분할 구간)**: 좌우 패딩 `0.25rem`(4px), 폰트 `1rem`(16px) / 행간 1.5. 확정 사유: 375px 뷰포트에서 탭당 가용 폭 ≈109px(375 − 컨테이너 패딩 32 − 탭리스트 패딩 8 − gap 8 = 327 ÷ 3)이므로 기존 "18px + 좌우 1rem"(필요 폭 ≈136px)은 물리적으로 양립 불가. 16px 텍스트("금융노조 소식" ≈101px) + 4px×2 패딩 ≈ 109px로 수용됨. 15px 미만 금지 준수.
  - **md 이상**: 좌우 패딩 `1rem`, 폰트 `--text-body`(18px).
  - 분기점을 sm이 아닌 md로 두는 이유: 균등분할 레이아웃 자체가 md까지 유지되므로(§3.5) 스타일 분기를 레이아웃 분기와 일치시킨다. sm~md 구간은 공간이 충분하지만 분기를 하나 더 두는 이득이 없다.
  - 터치 대상 검증: 높이는 전 구간 `min-height` 44px 보장, 폭은 최소 뷰포트 375px에서도 탭당 ≈109px ≥ 44px — 패딩 축소와 무관하게 44×44px 유지.

| 상태 | 배경 | 텍스트 | 굵기 | 검증 |
|------|------|--------|------|------|
| 비선택 | transparent (`--color-surface` 노출) | `--color-ink-muted` | 500 | 7.23:1 |
| 비선택 hover | `--color-primary-tint` | `--color-primary-strong` | 500 | 10.45:1 |
| 선택 | `--color-primary-strong` | `#ffffff` | 700 | 11.37:1 |
| 선택 hover | 변화 없음 (선택 상태 유지) | — | — | — |
| focus-visible (공통) | `outline: 3px solid --color-primary; outline-offset: 2px` | — | — | 10.88:1 (≥3:1) |

- 선택 상태는 배경색+텍스트색+굵기 3요소로 구분(색 단독 의존 금지). `aria-selected`가 기계적 구분을 보장.
- `:focus`(마우스 클릭)에는 아웃라인 미표시, `:focus-visible`에만 표시.

## 5. 게시글 목록 아이템 스펙 (공지사항·금융노조 소식 공용)

- 구조: `<ul>` > `<li>` > `<a>`(블록 링크, 아이템 전체가 터치 대상). 아이템 세로 패딩 `1rem`(합계 높이 ≥ 72px > 44px), 아이템 간 구분선 `1px solid --color-border-soft`(장식 — 정보 구분은 간격이 담당).
- 정렬: urgent 우선, 이후 게시일 내림차순.

구성 요소:

| 요소 | 토큰/값 |
|------|---------|
| 제목 | `--text-body`(18px) / 600 / `--color-ink`, 최대 2줄 말줄임(`line-clamp: 2`) |
| 제목 hover | 색 `--color-primary-strong` + 밑줄 (11.37:1) |
| 메타 행 | 제목 아래 `0.375rem`, `--text-caption`(15px) / `--color-ink-muted` (7.56:1) |
| 게시일 | `YYYY.MM.DD` 형식, `<time datetime="...">` |
| 출처 | 게시일 뒤 구분점 `·`(aria-hidden) 후 표기. 예: `[예시 출처입니다]`. 금융노조 소식 탭은 출처 필수 표기 |
| focus-visible | `outline: 3px solid --color-primary; outline-offset: -3px` (내향 — 목록 폭 초과 방지), 11.37:1 |

### urgent 게시물 구분 (색+아이콘+레이블 병행)

1. 좌측 보더 `4px solid --color-urgent` + 좌측 패딩 `0.75rem` (5.57:1 UI 통과)
2. 제목 앞 "긴급" 배지: 배경 `--color-urgent-strong` / 텍스트 `#ffffff` 15px/700 / 패딩 `2px 8px` / radius `4px` (8.46:1)
3. 배지 내 경고 아이콘 SVG `14px` `currentColor`(흰색), `aria-hidden` — 스크린리더에는 배지 텍스트 "긴급"이 전달됨
- 제목 텍스트 색은 `--color-ink` 유지(판독성 우선 — 빨간 제목 금지).

## 6. 빈 상태(empty state) 스펙

공지사항·금융노조 소식 탭에서 verified 게시물이 0건일 때 목록 대신 표시. **가짜 예시 게시물로 채우지 않는다.**

- 컨테이너: 중앙 정렬, 세로 패딩 `3rem`, 좌우 패딩 `1rem`.
- 아이콘: 문서 SVG `40px`, `--color-border-strong` (4.83:1 UI 통과), `aria-hidden`.
- 주 메시지: `--text-body`(18px) / 600 / `--color-ink`, 아이콘 아래 `1rem`:
  - 공지사항 탭: "등록된 공지사항이 없습니다"
  - 금융노조 소식 탭: "등록된 소식이 없습니다"
- 보조 메시지: `--text-caption`(15px) / `--color-ink-muted`, 주 메시지 아래 `0.5rem`: "새 글이 등록되면 이곳에 표시됩니다"
- 컨테이너에 `role="status"` 부여 금지(정적 상태 — 라이브 리전 불필요). 일반 `<p>`로 충분.

## 7. 방명록 탭 스펙

### 7.1 백엔드(NCP) 미연결 시 — "준비 중" 상태 (현재 기본 상태)

API 추상화 계층이 미연결을 반환하면 **폼을 렌더하지 않는다**. 비활성 폼을 보여주는 방식 금지(동작할 것 같은 가짜 UI). 대신:

- 준비 중 카드: 배경 `--color-surface`, 보더 `1px solid --color-border-strong`(의미 있는 경계 — 4.63:1), radius `12px`, 패딩 `2rem 1rem`, 중앙 정렬.
- 공사 아이콘 SVG `40px` / `--color-border-strong` / `aria-hidden`.
- 제목: "방명록 준비 중입니다" — `--text-h2`(24px) / 600 / `--color-ink`.
- 본문: `--text-body`(18px) / 400 / `--color-ink-muted` (7.23:1): "방명록 기능을 준비하고 있습니다. 준비가 끝나면 이곳에서 글을 남길 수 있습니다."
- 컨테이너 `role="status"` 불필요(진입 시점 정적 표시). 단, 런타임에 연결 시도 → 실패로 전환되는 흐름이라면 전환 시점에만 `role="status"` 적용.

### 7.2 백엔드 연결 시 — 작성 폼 + 글 목록 (구현 예비 스펙)

단일 컬럼: 작성 폼(상단) → 글 목록(하단), 폼-목록 간격 `2rem`.

작성 폼:
- 모든 필드에 **가시 레이블** `<label>` 필수(placeholder 단독 금지): 레이블 `--text-body`/600/`--color-ink`, 필드 위 `0.5rem`.
- 이름 input: 높이 `48px`, 보더 `1px solid --color-border-strong`(4.83:1), radius `8px`, 내부 패딩 `0 0.75rem`, 입력 텍스트 `--text-body`/`--color-ink`.
- 내용 textarea: `min-height: 120px`, 세로 패딩 `0.5rem`(여러 줄 가독 — 2026-08-16 구현 확인 후 공식화), 그 외 동일. 글자수 안내 `--text-caption`/`--color-ink-muted`.
- 필드 focus-visible: `outline: 3px solid --color-primary; outline-offset: 2px` (11.37:1).
- 등록 버튼: 배경 `--color-primary-strong` / 텍스트 `#ffffff`(11.37:1) / `--text-body` 700 / `min-height: var(--spacing-touch)` / 좌우 패딩 `1.5rem` / radius `8px`. hover: 배경 유지, `outline 2px --color-primary-strong offset 2px` 또는 미세 스케일 (CI 개정으로 primary=primary-strong 동일 값 — 1차의 "primary 배경 금지" 주의는 소멸). 전송 중: 버튼 `disabled` + 레이블 "등록 중…".
- 전송 결과는 `role="status"` 영역(항상 렌더, 내용만 갱신 — SR 감지 보장)에 텍스트로 안내. 피드백 색 (2026-08-16 확정):
  - **등록 실패**: `--text-caption` / `--color-urgent-strong`(#9c0d14 on #ffffff 8.46:1 — 채택 #12). 사용자의 직전 행동에 대한 부정 피드백이므로 적색으로 주의 환기 — 의미는 메시지 텍스트가 전달하고 색은 보조(색 단독 의존 아님). §8의 적색 용법 ②에 해당
  - **등록 성공**: `--text-caption` / `--color-ink`. 녹색(완료 의미색) 도입은 의미색 3종 상한(§8) 초과라 금지 — 텍스트로 충분
- 상태별 표시 (2026-08-16 확정):
  - **목록 로딩**: 중앙 정렬, 세로 패딩 `3rem`, "방명록을 불러오는 중입니다…" `--text-caption`/`--color-ink-muted`(7.56:1 — 채택 #6), `role="status"`
  - **목록 조회 실패**: 중앙 정렬, 실패 메시지 `--text-body`/600/`--color-ink` + 아래 `1rem` "다시 불러오기" 버튼(등록 버튼과 동일 스타일). 시스템 상태 안내이므로 적색 미사용 — 등록 실패(직전 행동 피드백)와 구분하며, 행동 유도는 재시도 버튼이 담당
  - **등록 성공 시 목록 갱신**: 재조회 없이 성공 엔트리를 목록 최상단에 즉시 삽입(입력 결과의 즉각 시각 확인). 목록이 로딩/실패 상태였다면 전체 재조회

글 목록: §5 목록 아이템 패턴 재사용(링크 없음 — 제목 대신 내용 첫 줄, 2줄 말줄임). 메타 행: 작성자명 · 작성일(`YYYY.MM.DD` — 작성 시각은 실제 타임스탬프이므로 **Asia/Seoul 기준** Intl 변환, 게시물의 날짜 전용 값과 구분). 0건이면 §6 패턴: "아직 남겨진 글이 없습니다".

## 8. 정보 위계 (이 페이지의 1~4순위)

| 순위 | 정보 | 시각적 구분 |
|------|------|-------------|
| 1 | 긴급 공지 (행동 필요·기한 있음) | (v2) 히어로 패널 §11.4 — 딥블루 패널 + "긴급" 배지 + 히어로 대형 타이포. 마감 임박은 스트립의 red 칩(§11.5). 적색은 **콘텐츠 위계에서 긴급 표시에만** 사용 |
| 2 | 공지사항 (알아야 할 변화) | 기본 선택 탭 — 첫 진입 시 즉시 노출. urgent 게시물은 목록 최상단 + 배지 |
| 3 | 금융노조 소식·방명록 (일반 소식·참여) | 탭 전환으로 접근. 목록 아이템 동일 패턴, 강조색 미사용 |
| 4 | 상시 정보 (지부명·연락처·저작권) | 헤더 텍스트 로고, 푸터 caption(15px) — 항상 접근 가능하되 시각적 후순위 |

- 의미색은 3종 사용(KFIU 파랑 `#093389`=주조·선택·링크, KFIU 빨강 계열=긴급, 코스콤 오렌지 계열=온누리 가이드 포인트·로고) — **3종 상한을 정확히 채운 상태이므로 추가 의미색 도입 금지.**
- 적색(urgent 계열)의 허용 용법 2가지 (2026-08-16 확정 — 이 외 적색 사용 금지):
  - **① 콘텐츠 위계**: 긴급 배너·urgent 게시물 표시 — 콘텐츠 영역에서의 유일성을 유지해 희소성(=긴급의 신호 가치)을 보존한다
  - **② 인터랙션 피드백**: 폼 등록 실패 텍스트(`--color-urgent-strong`, §7.2) — 사용자의 직전 행동에 대한 일시적 부정 피드백. 콘텐츠 위계와 다른 레이어(탭 내부·이벤트 시에만 표시)라 ①의 희소성을 훼손하지 않으며, 에러를 적색 외 색으로 표시하는 것이 오히려 관례 이탈로 오독을 유발한다. 색 단독 의존 금지는 메시지 텍스트가 담보
- 모든 게시물에 게시일·출처 caption 명시(신뢰성의 시각적 표현).
- 디지털온누리 가이드 링크(§9): 성격상 4순위(상시 정보)이나 접근 빈도가 높은 실용 가이드이므로 **긴급 배너 아래·탭리스트 위**에 상시 카드로 배치해 가시성을 확보한다. 단 1순위(긴급·적색)를 침범하지 않도록 코스콤 오렌지 계열(accent — 코스콤 구성원 정체성 표현, §10) + 배너보다 낮은 시각 강도(배지 없음, 전폭 아님, 컨테이너 폭 내)로 제한한다.

## 9. 디지털온누리 가이드 링크 카드 (신규 — 2026-08-16)

외부 페이지 `https://onnuri.koscomlabor.cloud/` 로 이동하는 상시 노출 링크. 요구: 눈에 띄는 배치, 조합원이 자주 찾는 실용 가이드.

### 9.1 배치 위치와 근거

- 위치: `<main>` 내부, **긴급 공지 배너(§3.2) 아래 · 탭리스트(§4) 위**. 공통 컨테이너(48rem) 폭 내. 배너 미노출 시에는 헤더 아래 첫 요소.
- 간격: 상단 `2rem`(§3.3의 main 상단 여백을 이 카드가 이어받음), 카드-탭리스트 사이 `2rem`.
- 근거: 첫 화면(모바일 375px 포함)에서 스크롤 없이 항상 보이는 위치이면서, 1순위인 긴급 배너(전폭·적색·배지)의 시각 우위를 유지한다 — 이 카드는 컨테이너 폭·코스콤 오렌지 계열(accent)·배지 없음으로 강도를 한 단계 낮춘다. 오렌지 채택 근거: 온누리 가이드는 "코스콤 조합원" 대상 실용 서비스이므로 코스콤 CI 색이 정체성을 표현하며, 노조 콘텐츠(파랑·빨강)와 시각적으로 구분된다(§10). 탭 목록(2순위 콘텐츠)의 진입도 가리지 않는다(§8 위계 노트 참조).

### 9.2 컴포넌트 스펙

- 구조: 단일 `<a>` 블록 카드. `href="https://onnuri.koscomlabor.cloud/"`, `target="_blank"`, `rel="noopener noreferrer"`. 카드 전체가 터치 대상.
- 컨테이너: 배경 `--color-accent-tint`(#fdf0e7), radius `12px`, 좌측 보더 `4px solid --color-accent`(#ec6d1e — **장식 전용**: 흰 페이지 배경 인접면 3.10:1이나 tint 인접면 2.78:1로 UI 미달이므로 의미 전달 UI로 분류하지 않는다. 카드의 의미는 아이콘+문구+배경 차이가 전달 — §2 제한표), 패딩 모바일 `1rem` / md+ `1rem 1.5rem`. `min-height: var(--spacing-touch)`(44px — 실제 2행 구성으로 ≈80px).
- 내부 가로 배치(모바일·md+ 동일, 단일 행 flex): 좌측 가이드 아이콘 — 중앙 텍스트 블록(flex:1) — 우측 외부 링크 아이콘.
  - 가이드 아이콘: 책/문서 SVG `24px`, `currentColor`, 색 `--color-accent-strong`(7.84:1 — 채택 #18), `aria-hidden="true"`
  - 외부 링크 아이콘: ↗(화살표+사각형) SVG `20px`, `currentColor`, 색 `--color-accent-strong`, `aria-hidden="true"`
- 텍스트 블록:
  - 제목: "디지털온누리 사용 가이드" — `--text-body`(18px) / 700 / `--color-accent-strong` (7.84:1 AAA — 채택 #18)
  - 설명(제목 아래 `0.25rem`): "코스콤 조합원 대상 안내 · 외부 페이지가 새 창에서 열립니다" — `--text-caption`(15px) / 400 / `--color-ink` (15.58:1 — 채택 #5). tint 배경 위이므로 `--color-ink-muted` 금지(§2 제한표 참조)
- 외부 이동 표시는 3중 병행(색 단독 의존 금지): ① ↗ 아이콘 ② 설명 문구의 "외부 페이지가 새 창에서 열립니다" ③ 링크 접근성 이름에 새 창 정보 포함(설명이 `<a>` 내부 텍스트이므로 자동 충족 — 별도 sr-only 불필요)
- 상태:

| 상태 | 스타일 | 검증 |
|------|--------|------|
| 기본 | 위 스펙 | #5, #18, #19 |
| hover | 제목에 밑줄 + 카드 `outline: 2px solid --color-accent-strong`(페이지 배경 #ffffff 위 8.77:1 — 채택 #17). 배경색 변화 없음 | #17 |
| focus-visible | `outline: 3px solid --color-primary; outline-offset: 2px` (흰 배경 위 11.37:1 ≥ 3:1 — 채택 #8. 포커스 링은 사이트 전역 파랑으로 통일 — 키보드 사용자 일관성) | #8 |

- 반응형: 전 구간 단일 행 유지. 모바일에서 설명이 2줄로 흘러도 허용(말줄임 금지 — 새 창 안내 문구가 잘리면 안 됨). md+에서 좌우 패딩만 `1.5rem`으로 확대.
- 주의: 이 카드에 적색(urgent 계열)·"긴급" 배지·전폭 배경을 쓰지 않는다 — 긴급 배너와의 위계 구분이 무너진다.

## 10. CI 개정 기록·로고 사용 스펙 (신규 — 2026-08-16 2차)

### 10.1 색상 실측 기록 (추측 아님 — 픽셀 샘플링)

- 방법: python3 + Pillow로 원본 픽셀을 영역 샘플링 후 **최빈값(mode)** 추출. 채도/명도 필터로 안티앨리어싱·JPEG 노이즈 픽셀 배제.

| 색 | 실측 hex | 출처·근거 |
|----|----------|-----------|
| KFIU 파랑 | `#093389` | `/kfiu_mark_jpg.jpg` 깃발 바탕 — mode 50,319 샘플 (2위 이하 ≤297, 압도적) |
| KFIU 빨강 | `#d0101b` | 같은 파일 우측 밴드 — mode 14,614 샘플 |
| 코스콤 오렌지 | `#ec6d1e` | `/Koscom_CI.jpg` 기본형 셰브런(mode 572)과 오렌지 배경 컬럼(mode 64,206)이 **동일값으로 교차 일치** |
| 코스콤 다크그레이 | `#5a5657` | 같은 파일 기본형 워드마크 — mode 6,915 샘플 |
| (참고) 그레이형 셰브런 / 검정 배경 | `#a0a0a0` / `#231816` | 변형 규정용 — 본 스펙 미사용 |

### 10.2 팔레트 역할 분담 결정과 근거

- **KFIU 파랑 `#093389` = 주조색(primary·primary-strong)**: 지부의 상위 소속(금융노조)이 사이트 전체 정체성. 원색이 11.37:1(AAA)로 텍스트·UI 겸용 가능 — 파생 없이 원색 채택, 두 토큰 동일 값(토큰명 유지 목적).
- **KFIU 빨강과 "적색=긴급" 규칙의 충돌 검토 → 충돌 아님, 수렴**: 기존 의미색 규칙과 같은 적색 계열이므로 긴급 계열을 KFIU 빨강 색상군으로 통일한다. 원색 `#d0101b`(5.57:1)는 본문 AAA 미달 → **UI(보더) 전용**, 텍스트·배지는 동일 색상군 파생 `#9c0d14`(8.46:1 AAA). 단 깃발 마크 자체(파랑+빨강 이미지)가 긴급으로 오독되지 않도록 헤더/푸터 고정 위치·소형으로만 사용한다.
- **코스콤 오렌지 `#ec6d1e` = accent**: 조합원의 소속사 정체성·실용 서비스(온누리 가이드 카드 §9) 포인트. 원색 3.10:1 → 텍스트 불가·흰 배경 인접 장식/로고 전용, 텍스트·아이콘은 동일 색상군 파생 `#7a3806`(8.77/7.84:1 AAA).
- **코스콤 다크그레이 `#5a5657`**: surface 위 6.92:1로 AAA 미달 → 토큰 미채택, 로고 이미지 전용. `--color-ink-muted`는 검증 완료된 `#4b5563` 유지.
- 의미색 상한: 파랑·빨강·오렌지 = 정확히 3종. 추가 의미색 도입 금지(§8).
- tint 3종(`#eff6ff`/`#fef2f2`/`#fdf0e7`)·중립색은 1차 값 유지 — 개정 조합 전부 §2에서 재실측 통과.

### 10.3 로고 자산·사용 스펙

**KFIU 깃발 마크**
- 원본: `/Users/canduk/IdeaProjects/koscomlabor/kfiu_mark_jpg.jpg` (1066×830, 167KB, **흰 배경 포함 JPG**)
- 목표 자산: `public/brand/kfiu-mark.png` — 높이 `192px`로 리샘플(최대 표시 48px의 4배, 레티나 대응), PNG(재압축 아티팩트 방지)
- 배치 규칙: **배경 `#ffffff` 위 전용.** 원본에 흰 배경이 구워져 있어 비백색 배경(surface 등) 위에서는 흰 박스가 드러난다 — 비백색 배경에 놓아야 할 경우 반드시 흰 칩(아래 푸터 방식)으로 감쌀 것. 배경 투명화(흰색 제거)는 외곽선 헤일로 위험이 있어 금지.
- 사용처: 헤더(§3.1 — 40/48px, alt=""), 푸터 로고 행(24px)

**코스콤 기본형 로고**
- 원본: `/Users/canduk/IdeaProjects/koscomlabor/Koscom_CI.jpg` 가이드 시트(9425×6112)
- 크롭: **기본형(흰 배경: 오렌지 셰브런 + 다크그레이 워드마크)** — 크롭 박스 `left 1030, top 820, right 2560, bottom 1200` → 1530×380. 4변 경계 스트립이 순수 흰색(255)임을 픽셀 실측으로 확인 완료(가이드 시트의 적색 점선·타 변형 미포함).
- 목표 자산: `public/brand/koscom-logo.png` — 높이 `96px`로 리샘플(표시 24px의 4배), PNG
- 가이드 시트 규정 준수: 흰 배경에서는 기본형 사용. 푸터 배경 위 로고 행 전체를 **흰색 칩(배경은 `--color-bg` 토큰으로 지정 — 하드코딩 #fff 금지, radius `12px`(`--radius-badge`) — v2 radius 스케일 12/24/32 정합을 위해 8px에서 개정(2026-08-16 QA 6회차 리더 판정), 패딩 `8px 12px`)** 안에 배치해 기본형 규정을 충족한다(칩 보더는 v2 딥블루 푸터에서 제거 — §11.6). 그레이/검정/오렌지 배경 변형은 본 사이트 범위에서 사용하지 않는다.
- 사용 수위: 코스콤은 조합원의 소속 "회사" CI이므로 노조 공식페이지 위계상 **푸터 소속 표기로 한정** (헤더 금지). 푸터 로고 행: KFIU 마크(24px) + 코스콤 로고(24px), gap `1rem`, 각 `alt="전국금융산업노동조합"` / `alt="코스콤"`(푸터에는 인접 설명 텍스트가 없으므로 유의미 alt), 링크 아님.

### 10.4 컴포넌트 변경 목록 (개발자용 — 본 개정으로 코드는 아직 미변경)

| 대상 | 변경 | 코드 영향 |
|------|------|-----------|
| `globals.css` `@theme` | `primary`·`primary-strong`·`urgent`·`urgent-strong` 값 교체 + `accent`·`accent-strong`·`accent-tint` 3줄 추가 | 필수 수정 |
| 탭 선택/hover/포커스, 긴급 배너, urgent 목록, 링크·버튼·포커스 링 | 토큰 참조 그대로 → **값 교체만으로 자동 반영** | 클래스 변경 없음 |
| 온누리 가이드 카드(§9) | primary 계열 → accent 계열 클래스 교체 (`bg-primary-tint`→`bg-accent-tint`, 제목/아이콘/hover 아웃라인 `primary-strong`→`accent-strong`, 보더 `primary`→`accent`). 포커스 링만 `primary` 유지 | **유일한 클래스 수정 지점** |
| 헤더(§3.1) | KFIU 마크 `<img>` 추가 | 신규 |
| 푸터(§3.4) | 흰 칩 로고 행 추가 | 신규 |
| `public/brand/` | `kfiu-mark.png`·`koscom-logo.png` 2종 생성 (§10.3 크롭·리샘플 값) | 신규 자산 |

## 11. 디자인 v2 — 모던 전면 개편 (2026-08-16 3차, 사용자 피드백 반영)

사용자 피드백 "구식·촌스러운 폰트"에 대한 개편. 레퍼런스 홍보물 2종(`~/.claude/uploads/.../99ad6e52-IMG_6270.png` 히어로형, `84a788e4-IMG_6269.png` 카드형)의 디자인 언어를 실측·추출했다. **§3~§9의 구조·접근성 규칙(ARIA·터치 44px·빈 상태·정보 위계)은 전부 유지**하고, 시각 레이어(폰트·라운드·색 운용·히어로)만 개편한다.

### 11.1 디자인 언어 추출 (레퍼런스 픽셀 실측)

- **레퍼런스 실측 색이 CI 토큰과 정확히 일치**: 딥블루 `(9,51,137)`=`#093389`, 레드 `(208,16,27)`=`#d0101b` — 기존 팔레트 그대로 연속. 신규 실측 2색만 추가: 라이트블루 서피스 `#d9e9ff`(타임라인 바), 밝은 블루 `#2e7df7`(날짜 배지).
- 채택 요소: ① 딥블루 대형 라운드 패널 + 초대형 볼드 타이포(히어로) ② 라운드 카드 + 부드러운 그림자 ③ 날짜 배지(라운드 사각, 색 변형) ④ 하단 날짜|이벤트 타임라인 바 ⑤ 딥블루 푸터 밴드
- 미채택 요소와 사유: ① 빨강 아웃라인 타이포(웹 text-stroke는 소형·저해상도에서 가독 저하 — 흰 타이포+배지로 대체) ② 우측 원형 아이콘 사이드바(탭리스트와 기능 중복, 모바일 공간 부족) ③ 사선 밴드+번호(연속 홍보물 넘버링 맥락 전용) ④ 라이트블루 배지 위 흰 텍스트(3.89:1 — AAA 위반, §2 v2 표) ⑤ 라이트블루 바 위 빨강 텍스트(4.52:1 — 미달, red 칩으로 대체)
- **레퍼런스 이미지의 투쟁 문구·일정(교섭·투표·대회·파업 날짜 등)은 디자인 목업의 미검증 콘텐츠다. 어떤 형태로도 실제 페이지에 복사 금지.**

### 11.2 폰트 스펙 — Pretendard Variable (촌스러움의 주범 교체)

- 채택: **Pretendard Variable** (SIL OFL 무료, 셀프호스팅 — 외부 CDN 미사용).
- 도입 방식 (권장 A): `npm i pretendard` 후 패키지의 다이나믹 서브셋을 정적 서빙 —
  `node_modules/pretendard/dist/web/variable/` 의 `pretendardvariable-dynamic-subset.css` + `woff2-dynamic-subset/` 디렉토리를 `public/fonts/pretendard/` 로 복사(빌드 스크립트 또는 postinstall), `layout.tsx`에서 `<link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css">`. 사용 글리프의 서브셋만 로드되어 초기 전송량이 작다. `font-display: swap` 내장.
- 대안 B: `next/font/local`로 단일 `PretendardVariable.woff2`(약 2MB)를 `src/fonts/`에 복사해 로드 — 설정은 단순하나 초기 전송량 큼. A 우선, A가 빌드 파이프라인상 곤란하면 B.
- `--font-sans` 토큰은 §1에 정의(Pretendard → 시스템 한글 폰트 폴백 스택). Tailwind v4에서 `font-sans`가 자동 적용되므로 **컴포넌트 클래스 변경 없이 전면 교체**된다.
- 웨이트 운용 (Variable 1파일로 전부): 400 본문 / 600 소제목·레이블·비선택 탭 / 700 제목·선택 탭·버튼 / **800 히어로·날짜 배지 숫자** (기존 스펙의 500 지정 위치는 600으로 승격 — Pretendard 500은 한글에서 400과 구분이 약함).
- 자간: 히어로 `-0.02em`(§1 hero 토큰 내장), display·h1·h2 `-0.01em` — **§1 `--text-*--letter-spacing` 토큰 모디파이어로 내장** (2026-08-16 구현 확인 후 공식화: 컴포넌트 클래스 무변경 전면 적용, `--tracking-heading`은 스케일 밖 커스텀 요소용 보조), 본문·caption `0`(음수 자간은 대형 타이포 전용 — 소형 한글에 적용 금지).

### 11.3 토큰 v2

- 정의는 §1 `@theme`의 "v2 모던 개편 추가" 블록에 통합했다(단일 소스 유지). 요약: 색 2(soft/bright), 폰트 스택 1, hero 타이포 2단계(자간 내장), tracking 1, radius 3단계(12/24/32px), shadow 2. **기존 토큰 값 변경 0건** — 1·2차 대비 검증 전부 유효.
- 그림자는 딥블루 기반 저투명(8%/12%) — 회색 그림자보다 팔레트와 일관되고, 대비 요건과 무관한 순수 장식.

### 11.4 히어로 패널 (§3.2 긴급 배너 대체)

- 위치: 헤더 아래, 공통 컨테이너(48rem) 내 첫 요소. 상단 여백 `1.5rem`, 아래 요소와 `2rem`(마감 스트립 존재 시 스트립과 `0.75rem`).
- 컨테이너: 배경 `--color-primary`(#093389), radius 모바일 `--radius-card`(24px) / md+ `--radius-panel`(32px), 패딩 모바일 `1.5rem` / md+ `2.5rem`, `--shadow-card`.
- 장식(선택): 우하단 `--color-primary-bright` 원형 도형(`aria-hidden`, 텍스트 겹침 금지 — #25 장식 허용). `#7fb0f0` 도형도 허용(제한표 — 장식 전용).
- **모드 1 — urgent 공지 바인딩** (verified+urgent 최신 1건 존재 시):
  1. 상단 행: "긴급" 배지(배경 `--color-urgent-strong` / 흰 텍스트 15px/700 / 경고 아이콘 — §3.2와 동일 3중 병행, 8.46:1) + 게시일 `--text-caption`/`--color-primary-soft`(9.23:1 — #23)
  2. 제목: `text-hero` / md+ `text-hero-lg`, `#ffffff`(11.37:1 — #11), 최대 3줄 말줄임, 아래 흰색 액센트 바 `4rem×4px`(장식 — 레퍼런스의 빨강 언더바는 딥블루 위 시인성 부족으로 흰색 변경)
  3. CTA: "자세히 보기" 필 버튼 — 배경 `#ffffff`/텍스트 `#093389` 18px/700(11.37:1), radius `9999px`, `min-height: var(--spacing-touch)`, 좌우 패딩 `1.5rem`, 우측 → 아이콘(currentColor). hover: 배경 `--color-primary-soft`(텍스트 그대로 9.23:1). focus-visible: `outline 3px solid #ffffff, offset 2px`(패널 위 11.37 ≥3:1). 상세 페이지 링크
  - 여러 urgent 시 최신 1건만 히어로, 나머지는 목록 상단(§5 규칙 유지)
- **모드 2 — 폴백** (urgent 0건, 현재 기본): 아이브로우 "전국금융산업노동조합" caption/600/`--color-primary-soft` → 제목 "코스콤지부" hero 스케일/`#ffffff` → 부문구 "코스콤 조합원을 위한 공식 소식 공간"(사이트의 사실 서술 — 안전) 18px/400/`--color-primary-soft`(9.23:1). CTA·배지·액센트 바 없음(모드 1 전용 요소 — 2026-08-16 확정). **레퍼런스의 투쟁 문구·일정 복사 금지(§11.1). 지부 고유 슬로건으로 교체하려면 리더·fact-verifier 승인 필수.**
- 마크업: `<section aria-label="주요 소식">`, 제목은 `<h2>`(페이지 h1은 헤더 지부명 유지 — 폴백 모드의 "코스콤지부" 중복은 h 위계상 문제없으나 `aria-label`로 구분).

### 11.5 마감 스트립 + 날짜 배지 컴포넌트

**마감 스트립** (레퍼런스1 하단 타임라인 바)
- 노출 조건: verified 게시물 중 `deadline`(frontmatter)이 오늘 이후인 것 1건 이상. 0건이면 미렌더.
- 히어로 바로 아래, 배경 `--color-primary-soft`, radius `--radius-badge`(12px), 패딩 `0.75rem 1rem`, 모바일 가로 스크롤(`overflow-x: auto`, 페이지 가로 스크롤 금지).
- 항목(각각 해당 게시물 링크, `min-height: var(--spacing-touch)`): "M/D 제목" 15px/700/`#093389`(9.23:1 — #22), 항목 간 세로 구분선 `1×16px` `--color-primary`(장식, `aria-hidden` — 2026-08-16 확정. soft 배경 위 9.23:1로 시인 충분).
- **마감 D-7 이내 항목**: 항목 전체를 red 칩으로 — 배경 `--color-urgent-strong`, 텍스트 `#ffffff`(8.46:1 — #14), radius `8px`, 패딩 `4px 12px`, 텍스트 앞 "D-n" 표기(색+텍스트 병행 — 색만으로 임박을 전달하지 않음). ※ soft 배경 위 빨강 텍스트는 4.52~6.87로 미달이라 금지(§2 제한표).
- focus-visible: `outline 3px solid #093389, offset 2px`(soft 위 9.23 ≥3:1).

**날짜 배지** (deadline 있는 게시물의 목록 아이템 좌측, md+에서만 — 모바일은 제목 아래 D-n 텍스트로 대체)
- 크기 `56×56px`, radius `--radius-badge`, 세로 스택: "M/D" 18px/800 + 아래 **"D-n" 15px/600** (요일 대신 D-n 확정 — 마감 맥락에서 행동 유도 정보가 요일보다 우선, 2026-08-16).
- 모바일 D-n 텍스트(제목 아래 메타 행 선두): 15px/700, 기본 `--color-primary`(흰 카드 위 11.37:1 — #8) / 임박(D-7 이내) `--color-urgent-strong`(8.46:1 — #12) — 배지 변형과 동일 의미론. D-n 숫자 자체가 임박도를 전달하므로 색은 보조(색 단독 의존 아님).
- **경과 마감(D-n 음수)은 배지·모바일 D-n·마감 스트립 모두 미표시** (경과 정보는 행동 유도 가치 없음, 2026-08-16 확정). D-0(당일)은 임박 취급.
- 운영 전제: D-n과 스트립 노출 조건은 **빌드 시점(KST) 기준** — 정적 사이트 특성상 날짜 경과를 반영하려면 일일 재빌드(또는 콘텐츠 갱신 시 재빌드) 운영이 필요하다. 재빌드 주기는 리더 확정 사항.
- 변형: **기본** 배경 `--color-primary-soft`/텍스트 `#093389`(9.23:1) · **임박(D-7 이내)** 배경 `--color-urgent-strong`/`#ffffff`(8.46:1) · **강조** 배경 `--color-primary`/`#ffffff`(11.37:1 — 예약, 현 범위 미사용). 레퍼런스의 밝은 블루 배지(#2e7df7+흰 텍스트)는 3.89:1로 미채택.

### 11.6 기존 컴포넌트 라운드 카드화

| 컴포넌트 | v2 변경 (색·구조·ARIA는 기존 § 그대로) |
|----------|------------------------------------------|
| 탭리스트(§4.2) | 컨테이너·탭 radius `9999px`(필 형태). 크기·상태·색·키보드 규칙 불변 |
| 목록 아이템(§5) | 구분선 리스트 → **카드 리스트**: 각 아이템 배경 `#ffffff`, radius `1rem`(16px), `--shadow-card`, 패딩 `1rem 1.25rem`, 아이템 간 gap `0.75rem`. hover: `--shadow-card-hover` + 제목 색 기존 규칙. urgent 좌측 보더 4px `--color-urgent` 유지(카드 좌변). focus 내향 아웃라인 유지. §5의 `divide` 구분선 규정은 v2에서 대체됨 |
| 온누리 카드(§9) | radius `--radius-card`(24px) + `--shadow-card`. 색 체계(accent) 불변 |
| 방명록(§7) | 입력 필드 radius `--radius-badge`(12px), 등록·재시도 버튼 radius `9999px`, 준비 중 카드 radius `--radius-card`. 그 외 불변 |
| 헤더(§3.1) | 구조 불변 — Pretendard 적용과 `--tracking-heading`만 반영 |
| 푸터(§3.4) | **딥블루 밴드**(레퍼런스2 하단): 배경 `--color-primary`, 상단 보더 제거. 지부명 `#ffffff`/700(11.37:1 — #11), 저작권 `--color-primary-soft`(9.23:1 — #23). 로고 흰 칩(`--color-bg` 배경)은 그대로 — 딥블루 위에서도 "흰 배경 위 로고" 규정 계속 충족. 칩 보더는 제거(딥블루 대비로 불필요) |

### 11.7 개발자 변경 목록 (v2)

| 대상 | 변경 | 구분 |
|------|------|------|
| `globals.css` `@theme` | v2 토큰 추가(§1 — 기존 값 변경 0건) | 필수 |
| 폰트 | `npm i pretendard` + 서브셋 정적 서빙(§11.2 방식 A) — 클래스 변경 없이 전면 적용 | 필수 |
| `HeroPanel` | 신규 — `UrgentBanner` 제거·대체(§11.4). urgent 바인딩+폴백 2모드 | 신규 |
| `DeadlineStrip` | 신규 — 조건부(§11.5) | 신규 |
| `DateBadge` | 신규 — 3변형(§11.5) | 신규 |
| `PostList` | 카드화(§11.6) | 수정 |
| `BoardTabs` | radius 필 형태(§11.6) | 수정 |
| `OnnuriGuideCard` | radius·shadow(§11.6) | 수정 |
| `GuestbookPanel` | 필드·버튼 radius(§11.6) | 수정 |
| `SiteFooter` | 딥블루 밴드(§11.6) | 수정 |
| `SiteHeader` | 변경 없음(폰트 자동 적용) | — |

규모: 신규 컴포넌트 3, 수정 5, 제거 1(UrgentBanner), 토큰 추가 약 20줄, 폰트 도입 1식. 색 토큰 값 변경이 없으므로 기존 대비 검증은 전부 유효하고, v2 신규 조합은 §2 v2 표로 검증 완료.

---

## 구현 참고 (web-developer용 체크리스트)

1. `globals.css`: 위 `@theme` 블록 적용 + create-next-app 기본 다크모드 미디어쿼리 제거
2. (2026-08-16 개정) `#d0101b`(urgent)·`#ec6d1e`(accent)는 텍스트 금지 — 긴급 텍스트·배지는 `#9c0d14`, 오렌지 텍스트·아이콘은 `#7a3806`. `#ec6d1e`는 tint 위 의미 UI로도 금지(장식·로고 전용). KFIU 파랑 `#093389`는 텍스트·UI 겸용
3. `#e5e7eb`는 장식 구분선만, `#9ca3af`는 전면 금지, `#5a5657`은 로고 이미지 전용(토큰 아님)
4. 탭: 로빙 탭인덱스 + 화살표 키 필수, 방명록 미연결 시 폼 미렌더
5. CI 개정 구현 시 §10.4 변경 목록 순서대로 — 로고 자산은 §10.3의 크롭 좌표·리샘플 크기 준수
6. 스펙 모호 시 frontend-designer에게 질의 (임의 값 결정 금지)
