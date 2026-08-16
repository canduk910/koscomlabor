# 디자인 스펙: 메인페이지 (탭 게시판)

- 작성: frontend-designer | 작성일: 2026-08-16
- 근거: `_workspace/00_input/requirements.md`, `union-design-system` 스킬
- 범위: 메인페이지 전체 (헤더 / 긴급 공지 배너 / 탭 게시판(공지사항·금융노조 소식·방명록) / 푸터)
- 다크 모드: **범위 제외** (스킬 기준). **create-next-app 기본 `globals.css`에 있는 `@media (prefers-color-scheme: dark)` 블록은 제거할 것** — 라이트 모드 토큰만 유지한다. 도입 시 전 조합 재검사 필요.
- 주조색 `#1d4ed8` 계열은 플레이스홀더다. **공식 CI 확보 시 교체 후 본 문서의 대비 검증을 전부 재실행한다.**

---

## 1. 디자인 토큰 (Tailwind CSS v4 `@theme`)

아래 블록을 `app/globals.css`의 `@import "tailwindcss";` 바로 아래에 그대로 붙일 수 있다.
분기점(sm 640px / md 768px / lg 1024px)은 Tailwind v4 기본값과 동일하므로 재정의하지 않는다.

```css
@theme {
  /* ---- 색상 (12) ---- */
  --color-bg: #ffffff;             /* 페이지 기본 배경 */
  --color-surface: #f9fafb;        /* 탭바·푸터·카드 배경 */
  --color-ink: #1a1a1a;            /* 본문·제목 텍스트 */
  --color-ink-muted: #4b5563;      /* 보조 텍스트(날짜·출처·비선택 탭) */
  --color-primary: #1d4ed8;        /* 주조색 — UI 요소(포커스 링·아이콘)와 큰 텍스트 전용 */
  --color-primary-strong: #1e40af; /* 본문 크기 링크·선택 탭 배경·버튼 배경 */
  --color-primary-tint: #eff6ff;   /* 탭 hover 배경 */
  --color-urgent: #b91c1c;         /* 긴급 — 보더·구분선 등 UI 요소 전용 */
  --color-urgent-strong: #991b1b;  /* 긴급 텍스트·긴급 배지 배경 */
  --color-urgent-tint: #fef2f2;    /* 긴급 배너 배경 */
  --color-border-strong: #6b7280;  /* 의미 있는 UI 경계(입력 필드 등)·보조 아이콘 */
  --color-border-soft: #e5e7eb;    /* 장식용 구분선 전용 — 의미 전달 UI에 사용 금지 */

  /* ---- 타이포그래피 스케일 (5단계) ---- */
  --text-display: 2.5rem;                 /* 40px 페이지 대제목 */
  --text-display--line-height: 1.3;
  --text-display--font-weight: 700;
  --text-h1: 2rem;                        /* 32px 섹션 제목 */
  --text-h1--line-height: 1.3;
  --text-h1--font-weight: 700;
  --text-h2: 1.5rem;                      /* 24px 소제목·카드 제목 */
  --text-h2--line-height: 1.3;
  --text-h2--font-weight: 600;
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

- 신규 토큰: 전부 신규 (이전 스펙 없음. 이후 스펙은 이 토큰 체계를 기준으로 확장한다)
- `--color-primary`(#1d4ed8)는 본문 크기(18px 일반 굵기) 텍스트에 **사용 금지** — AAA 미달(6.70:1). 본문 크기 텍스트에는 반드시 `--color-primary-strong`(#1e40af, 8.72:1)을 쓴다. urgent 계열도 동일 규칙: 텍스트는 `-strong`, UI 요소는 기본 토큰.

## 2. 대비 검증 결과

전 조합을 `check-contrast.mjs`로 실제 실행해 검증했다 (2026-08-16). 아래 "채택 조합"만 스펙에 사용한다.

### 채택 조합 (18) — 전체 통과

| # | 전경 | 배경 | 비율 | 판정 | 용도 |
|---|------|------|------|------|------|
| 1 | `#1a1a1a` | `#ffffff` | 17.40 | AAA(본문) | 본문·제목·목록 제목 |
| 2 | `#1a1a1a` | `#f9fafb` | 16.65 | AAA(본문) | surface 위 텍스트(푸터 지부명 등) |
| 3 | `#1a1a1a` | `#fef2f2` | 15.91 | AAA(본문) | 긴급 배너 내 제목 |
| 4 | `#4b5563` | `#ffffff` | 7.56 | AAA(본문) | 게시일·출처 caption |
| 5 | `#4b5563` | `#f9fafb` | 7.23 | AAA(본문) | 비선택 탭 레이블·푸터 caption |
| 6 | `#1e40af` | `#ffffff` | 8.72 | AAA(본문) | 링크 텍스트·제목 hover 색 |
| 7 | `#1e40af` | `#f9fafb` | 8.35 | AAA(본문) | surface 위 링크 |
| 8 | `#1e40af` | `#eff6ff` | 8.01 | AAA(본문) | 탭 hover 상태 레이블 |
| 9 | `#ffffff` | `#1e40af` | 8.72 | AAA(본문) | 선택 탭 레이블·버튼 텍스트 |
| 10 | `#991b1b` | `#ffffff` | 8.31 | AAA(본문) | urgent 게시물 강조 텍스트 |
| 11 | `#991b1b` | `#fef2f2` | 7.60 | AAA(본문) | 긴급 배너 내 보조 텍스트·아이콘 |
| 12 | `#ffffff` | `#991b1b` | 8.31 | AAA(본문) | "긴급" 배지 텍스트 |
| 13 | `#1d4ed8` | `#ffffff` | 6.70 | UI 3:1 통과·큰텍스트 AAA | 포커스 링·아이콘 (본문 크기 텍스트 금지) |
| 14 | `#1d4ed8` | `#f9fafb` | 6.41 | UI 3:1 통과·큰텍스트 AAA | surface 위 포커스 링 |
| 15 | `#b91c1c` | `#ffffff` | 6.47 | UI 3:1 통과 | urgent 목록 아이템 좌측 보더 |
| 16 | `#b91c1c` | `#fef2f2` | 5.91 | UI 3:1 통과 | 긴급 배너 좌측 보더 |
| 17 | `#6b7280` | `#ffffff` | 4.83 | UI 3:1 통과 | 입력 필드 보더·빈 상태 아이콘 |
| 18 | `#6b7280` | `#f9fafb` | 4.63 | UI 3:1 통과 | surface 위 보더·아이콘 |

### 검증 후 탈락·제한 조합 — 스펙에 텍스트로 사용 금지

| 전경 | 배경 | 비율 | 처리 |
|------|------|------|------|
| `#9ca3af` | `#ffffff` | 2.54 | UI 3:1 미달 — 전면 사용 금지 |
| `#595959` | `#f9fafb` | 6.70 | AAA 미달 — 보조 텍스트는 `#4b5563`으로 통일 |
| `#4b5563` | `#eff6ff` | 6.94 | AAA 미달 — tint 배경 위 caption 금지, `#1e40af` 또는 `#1a1a1a` 사용 |
| `#e5e7eb` | `#ffffff` | 1.24 | 장식용 구분선 전용 허용. 의미 전달 UI(선택 표시·필드 경계) 사용 금지 |
| `#1d4ed8` | `#ffffff` | 6.70 | (재기재) 본문 크기 텍스트로는 AAA 미달 — 텍스트는 `#1e40af` 사용 |

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
- 로고 이미지는 CI 미확보 상태이므로 넣지 않는다(추측 CI 금지). 텍스트 로고만.

### 3.2 긴급 공지 배너 (조건부)

- 노출 조건: verified 공지 중 frontmatter `urgent: true`인 게시물이 1건 이상일 때만 렌더. 없으면 DOM에서 제외(빈 자리 없음). 여러 건이면 최신 1건만 배너, 나머지는 목록 상단 정렬.
- 구조: `<section role="region" aria-label="긴급 공지">`, 헤더 바로 아래 전폭. 내부 콘텐츠는 공통 컨테이너 정렬.
- 스타일: 배경 `--color-urgent-tint`, 좌측 보더 `4px solid --color-urgent`, 세로 패딩 `1rem`.
- 내부 구성 (색+아이콘+레이블 3중 병행 — 색만으로 의미 전달 금지):
  1. 경고 아이콘: 삼각형 느낌표 SVG `20px`, `currentColor`, 색 `--color-urgent-strong`, `aria-hidden="true"`
  2. "긴급" 배지: 배경 `--color-urgent-strong`, 텍스트 `#ffffff` 15px/700, 패딩 `2px 8px`, radius `4px`
  3. 제목: `--text-body`(18px)/700/`--color-ink`, 상세로 가는 링크(밑줄, 링크 전체 `min-height: var(--spacing-touch)`)
  4. 게시일: `--text-caption`/`--color-urgent-strong`
- focus-visible(배너 내 링크): `outline: 3px solid --color-urgent-strong; outline-offset: 2px` (7.60:1)

### 3.3 탭 게시판 영역

- `<main>` 내부. 배너(또는 헤더)와의 상단 여백 `2rem`, 탭리스트와 패널 사이 `1rem` (섹션 위 여백 ≥ 아래 여백 2배 원칙).
- 상세 스펙은 §4(탭), §5(목록), §6(빈 상태), §7(방명록).

### 3.4 푸터

- `<footer>`. 배경 `--color-surface`, 상단 구분선 `1px solid --color-border-soft`, 세로 패딩 `2rem`, 본문과의 상단 여백 `4rem`.
- 내용: 지부명 전체 표기 `--text-caption`/600/`--color-ink`, 그 아래 연락처·주소 자리 `--text-caption`/400/`--color-ink-muted`. 실 연락처 확보 전에는 항목 자체를 렌더하지 않는다(플레이스홀더 연락처 금지).
- 저작권 표기: `© 2026 전국금융산업노동조합 코스콤지부` `--text-caption`/`--color-ink-muted`.

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
| 비선택 hover | `--color-primary-tint` | `--color-primary-strong` | 500 | 8.01:1 |
| 선택 | `--color-primary-strong` | `#ffffff` | 700 | 8.72:1 |
| 선택 hover | 변화 없음 (선택 상태 유지) | — | — | — |
| focus-visible (공통) | `outline: 3px solid --color-primary; outline-offset: 2px` | — | — | 6.41:1 (≥3:1) |

- 선택 상태는 배경색+텍스트색+굵기 3요소로 구분(색 단독 의존 금지). `aria-selected`가 기계적 구분을 보장.
- `:focus`(마우스 클릭)에는 아웃라인 미표시, `:focus-visible`에만 표시.

## 5. 게시글 목록 아이템 스펙 (공지사항·금융노조 소식 공용)

- 구조: `<ul>` > `<li>` > `<a>`(블록 링크, 아이템 전체가 터치 대상). 아이템 세로 패딩 `1rem`(합계 높이 ≥ 72px > 44px), 아이템 간 구분선 `1px solid --color-border-soft`(장식 — 정보 구분은 간격이 담당).
- 정렬: urgent 우선, 이후 게시일 내림차순.

구성 요소:

| 요소 | 토큰/값 |
|------|---------|
| 제목 | `--text-body`(18px) / 600 / `--color-ink`, 최대 2줄 말줄임(`line-clamp: 2`) |
| 제목 hover | 색 `--color-primary-strong` + 밑줄 (8.72:1) |
| 메타 행 | 제목 아래 `0.375rem`, `--text-caption`(15px) / `--color-ink-muted` (7.56:1) |
| 게시일 | `YYYY.MM.DD` 형식, `<time datetime="...">` |
| 출처 | 게시일 뒤 구분점 `·`(aria-hidden) 후 표기. 예: `[예시 출처입니다]`. 금융노조 소식 탭은 출처 필수 표기 |
| focus-visible | `outline: 3px solid --color-primary; outline-offset: -3px` (내향 — 목록 폭 초과 방지), 6.70:1 |

### urgent 게시물 구분 (색+아이콘+레이블 병행)

1. 좌측 보더 `4px solid --color-urgent` + 좌측 패딩 `0.75rem` (6.47:1 UI 통과)
2. 제목 앞 "긴급" 배지: 배경 `--color-urgent-strong` / 텍스트 `#ffffff` 15px/700 / 패딩 `2px 8px` / radius `4px` (8.31:1)
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
- 내용 textarea: `min-height: 120px`, 그 외 동일. 글자수 안내 `--text-caption`/`--color-ink-muted`.
- 필드 focus-visible: `outline: 3px solid --color-primary; outline-offset: 2px` (6.70:1).
- 등록 버튼: 배경 `--color-primary-strong` / 텍스트 `#ffffff`(8.72:1) / `--text-body` 700 / `min-height: var(--spacing-touch)` / 좌우 패딩 `1.5rem` / radius `8px`. hover: 배경 `--color-primary` 금지(텍스트 대비 하락) — 배경 유지 + 밝기 변화 대신 `outline 2px --color-primary-strong offset 2px` 또는 미세 스케일. 전송 중: 버튼 `disabled` + 레이블 "등록 중…".
- 전송 결과는 `role="status"` 영역에 텍스트로 안내.

글 목록: §5 목록 아이템 패턴 재사용(링크 없음 — 제목 대신 내용 첫 줄). 메타 행: 작성자명 · 작성일(`YYYY.MM.DD`). 0건이면 §6 패턴: "아직 남겨진 글이 없습니다".

## 8. 정보 위계 (이 페이지의 1~4순위)

| 순위 | 정보 | 시각적 구분 |
|------|------|-------------|
| 1 | 긴급 공지 (행동 필요·기한 있음) | 최상단 전폭 배너 — urgent-tint 배경 + 4px 적색 보더 + 아이콘 + "긴급" 배지 + 18px/700 제목. 페이지 유일의 적색 사용 영역 |
| 2 | 공지사항 (알아야 할 변화) | 기본 선택 탭 — 첫 진입 시 즉시 노출. urgent 게시물은 목록 최상단 + 배지 |
| 3 | 금융노조 소식·방명록 (일반 소식·참여) | 탭 전환으로 접근. 목록 아이템 동일 패턴, 강조색 미사용 |
| 4 | 상시 정보 (지부명·연락처·저작권) | 헤더 텍스트 로고, 푸터 caption(15px) — 항상 접근 가능하되 시각적 후순위 |

- 의미색은 2종만 사용(주조 파랑=선택·링크, 적색=긴급). 3종 상한 이내.
- 모든 게시물에 게시일·출처 caption 명시(신뢰성의 시각적 표현).

---

## 구현 참고 (web-developer용 체크리스트)

1. `globals.css`: 위 `@theme` 블록 적용 + create-next-app 기본 다크모드 미디어쿼리 제거
2. `#1d4ed8`은 텍스트 금지·UI 전용 / 텍스트는 `#1e40af`·`#991b1b` — 토큰 주석대로 준수
3. `#e5e7eb`는 장식 구분선만, `#9ca3af`는 전면 금지
4. 탭: 로빙 탭인덱스 + 화살표 키 필수, 방명록 미연결 시 폼 미렌더
5. 스펙 모호 시 frontend-designer에게 질의 (임의 값 결정 금지)
