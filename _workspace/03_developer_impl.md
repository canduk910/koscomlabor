# 구현 요약: 메인페이지 (탭 게시판)

- 작성: web-developer | 작성일: 2026-08-16 | 최종 수정: 2026-08-16 (QA 1회차 반영)
- 근거: `_workspace/00_input/requirements.md`, `_workspace/02_designer_spec.md`, `union-webapp-dev` 스킬, `_workspace/04_qa_report.md`

## 1. 구현 범위

| 항목 | 상태 |
|------|------|
| 디자인 토큰 (`@theme`) 적용 + 다크모드 미디어쿼리 제거 | 완료 |
| 콘텐츠 로더 (verified 게이트 포함) | 완료 |
| 라우트 상수 (`src/lib/routes.ts`) | 완료 |
| 메인페이지 (헤더/조건부 긴급 배너/탭 게시판/푸터) | 완료 |
| 탭 컴포넌트 (ARIA tabs, 로빙 탭인덱스, 화살표 키 automatic activation) | 완료 |
| 게시글 목록 + 빈 상태 | 완료 |
| 방명록 탭 (API 추상화 + 준비 중 카드) | 완료 (§7.1 상태) |
| 날짜 표기 (Intl 계산) | 완료 |

## 2. 파일 목록

### 신규
- `src/lib/routes.ts` — 라우트 상수, `TabId` 타입, `?tab=` 쿼리 파라미터 키
- `src/lib/date.ts` — `Intl.DateTimeFormat` 기반 `YYYY.MM.DD` 표기 / ISO 날짜 변환 (수동 계산 없음)
- `src/lib/content.ts` — markdown frontmatter 파싱·검증 로더 (`server-only`)
- `src/lib/api/guestbook.ts` — 방명록 API 추상화 계층 (타입 + 함수 시그니처 + unconfigured 상태)
- `src/components/ui/icons.tsx` — 경고/문서/공사 인라인 SVG (전부 `aria-hidden`, `currentColor`)
- `src/components/ui/UrgentBadge.tsx` — "긴급" 배지 (목록용 14px 아이콘 옵션)
- `src/components/layout/SiteHeader.tsx` — 2행 텍스트 로고 (전체 홈 링크 1개, 로고 이미지 없음)
- `src/components/layout/SiteFooter.tsx` — 지부명 + 저작권 (연락처 미확보 → 항목 미렌더)
- `src/components/notice/UrgentBanner.tsx` — 조건부 긴급 배너 (스펙 §3.2)
- `src/components/board/BoardTabs.tsx` — 탭 게시판 클라이언트 컴포넌트 (스펙 §4)
- `src/components/board/PostList.tsx` — 목록 아이템 (스펙 §5, 공지·소식 공용)
- `src/components/board/EmptyState.tsx` — 빈 상태 (스펙 §6)
- `src/components/board/GuestbookPanel.tsx` — 방명록 준비 중 카드 (스펙 §7.1)

### 수정
- `src/app/globals.css` — 스펙 §1 `@theme` 블록 그대로 적용, create-next-app 기본 다크모드 미디어쿼리·기본 토큰 제거
- `src/app/layout.tsx` — `lang="ko"`, 사이트 메타데이터, Geist 폰트 제거(라틴 전용 — 아래 결정 4)
- `src/app/page.tsx` — 메인페이지 조립 (서버 컴포넌트)

### 의존성 추가
- `gray-matter` (frontmatter 파싱), `server-only` (콘텐츠 로더의 클라이언트 번들 유입 차단)

## 3. 기술적 결정 (왜 이렇게 했는지)

1. **verified 게이트는 로더 내부 고정** — `parsePostFile`이 `verified === true`(boolean 정확 일치)가 아니면 `null`을 반환해 목록에서 제외. verified인데 필수 필드(title/date)가 깨진 파일은 **빌드 실패**시킨다(잘못된 콘텐츠를 조용히 누락하는 것보다 빌드에서 잡는 편이 안전).
2. **탭 상태 = URL 단일 소스 (`useSyncExternalStore`)** — 처음에는 `useEffect`+`setState`로 URL 복원을 구현했으나 `react-hooks/set-state-in-effect` 린트 위반. `?tab=` 쿼리를 단일 소스로 삼고 `popstate` 구독으로 재렌더하는 구조로 전환. 서버 스냅샷은 기본 탭(공지사항)이라 하이드레이션이 안전하고, 페이지가 **정적 프리렌더 유지**(빌드 결과 `○ Static` — 정적 내보내기 가능성 보존, 스킬 §1). 서버 `searchParams`를 읽지 않은 것도 동적 렌더 전환을 피하기 위함.
3. **탭 전환은 `history.replaceState`** — 서버 왕복 없는 얕은 URL 갱신. `replaceState`는 `popstate`를 발생시키지 않으므로 수동으로 `PopStateEvent`를 디스패치해 스토어 구독자에 알림.
4. **Geist 폰트 제거** — create-next-app 기본 Geist는 라틴 서브셋 전용이라 한글이 시스템 폰트로 폴백됨. 스펙에 폰트 토큰이 없으므로 Tailwind 기본 sans 스택(시스템 폰트)으로 통일. 폰트 지정이 필요하면 디자이너에게 토큰 추가 요청 예정.
5. **날짜는 UTC 고정 Intl 포맷** — frontmatter의 날짜 전용 값(`2026-08-16`)은 YAML 파서가 UTC 자정 `Date`로 반환. 표기·ISO 변환 모두 `Intl.DateTimeFormat`(timeZone: UTC)으로 계산해 타임존에 따른 하루 밀림을 차단. `YYYY-MM-DD` 조립은 `en-CA` 로케일 사용(ISO 형식 산출).
6. **방명록 API 계층** — `GuestbookResult<T>` 판별 유니온(`ok: true/false` + `reason: unconfigured|network|invalid-response`)으로 미설정 상태를 명확히 반환. 응답 파싱은 `parseGuestbookEntry(unknown)`에서 필드별 typeof 검증(any/근거 없는 as 없음). `NEXT_PUBLIC_API_BASE_URL`이므로 서버·클라이언트 동일 판별.
7. **타입 직렬화 경계** — 클라이언트 탭 컴포넌트로 넘기는 `PostSummary`는 평면 직렬화 가능 구조(날짜는 사전 포맷된 문자열 + 정렬용 number). `content.ts`의 타입만 `import type`으로 가져오므로 `server-only` 가드와 충돌하지 않음.
8. **`<time>` 속성 표기** — React 19 SSR이 `dateTime` 카멜케이스 그대로 출력하지만 HTML 속성은 대소문자 무구분이므로 표준 `datetime`으로 유효 동작(스모크 테스트로 확인).

## 4. 스펙 해석·경미한 이탈 (frontend-designer 확인 요망)

1. **모바일 탭 폰트 16px + 좌우 패딩 축소(1rem→0.25rem)** — 스펙 §4.2는 탭 좌우 패딩 1rem·18px을 기본으로 하되 "잘리면 모바일 한정 16px까지 축소 허용". 계산상 375px 뷰포트에서 3탭 균등분할 시 탭당 가용 폭 ~109px인데 "금융노조 소식"은 18px에서 ~117px(+패딩 32px)이 필요해 물리적으로 잘림. 16px로 축소해도 패딩 1rem 유지 시 초과라서 **모바일 한정 px-1(4px)**로 줄임. md+는 스펙대로 px-4·18px·min-w-32. 스펙이 명시하지 않은 조합 충돌의 최소 해석 — 디자이너 확인 필요.
2. **긴급 배너 내부 배치** — 스펙 §3.2는 구성 요소 4개(아이콘·배지·제목·게시일)의 순서만 정의하고 행 배치는 미정의. [아이콘+배지] 행 → 제목 링크 → 게시일 3단 세로 배치로 구현.
3. **저작권 연도** — 스펙 문구 그대로 `© 2026` 고정 표기 (동적 연도 아님).
4. **목록 아이템 링크 대상** — ~~상세 라우트는 이번 범위 외~~ → **QA 1회차 실패 #1로 지목되어 리더 판단으로 구현 확정, 반영 완료** (§6 참조).

## 5. 미구현 항목과 사유

| 항목 | 사유 |
|------|------|
| 방명록 작성 폼·글 목록 (스펙 §7.2) | NCP 백엔드 미구축. API 계층(`src/lib/api/guestbook.ts`)에 연결 시 사용할 타입·함수(`listGuestbookEntries`/`createGuestbookEntry`) 정의 완료. 환경변수가 설정되어도 백엔드 실구축 전에는 준비 중 카드를 유지(가짜 동작 금지) |
| ~~게시글 상세 페이지~~ | QA 1회차에서 구현 완료 (§6 참조) |
| 개발 모드 "미검증" 배지 표시 | 스킬 §3의 선택 사항. 게이트를 단순·엄격하게 유지하기 위해 프로덕션·개발 동일하게 제외 처리 |

## 6. QA 1회차 반영 (2026-08-16, 리더 지시)

QA 리포트(`_workspace/04_qa_report.md`) 실패 2건 수정.

### 실패 #1 — 상세 라우트 구현 (리더 판단: 지금 구현으로 확정)

- 신규: `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`, `src/components/board/PostArticle.tsx` (상세 본문 공용 컴포넌트)
- 로더 확장 (`src/lib/content.ts`): `PostDetail`(요약 + 마크다운 본문 원문) 타입과 `getVerifiedPost(category, slug)` 추가. 미존재·미검증 slug는 null → 페이지에서 `notFound()`. slug는 파일명 안전 문자만 허용(경로 조작 방어). 목록 함수는 body를 제외한 `PostSummary`만 반환해 클라이언트 직렬화 페이로드에 본문을 싣지 않음.
- **정적 생성**: `generateStaticParams`(verified 게시물 slug 목록) + `dynamicParams = false` — 미등록 slug는 빌드 산출물에 없으므로 즉시 404, 전 라우트 SSG 유지(빌드 결과 `● SSG` 확인).
- **마크다운 렌더러: `react-markdown` 선택.** 사유: (1) `dangerouslySetInnerHTML` 없이 React 엘리먼트로 렌더, (2) 기본 설정에서 원문 내 raw HTML을 실행하지 않고 텍스트로 표시(XSS 안전 기본값 — 스모크 테스트에서 `<script>` 미실행 실측), (3) RSC(서버 컴포넌트)에서 동작, (4) 원문 텍스트 무변형(형식 변환만 — 스킬 §3). GFM 확장(테이블 등)은 현재 콘텐츠 요건에 없어 미도입 — 필요 시 `remark-gfm` 추가.
- 상세 페이지 구성: 긴급 배지(urgent일 때) → 제목 h1(`text-h2 md:text-h1` — 헤더 지부명과 동일한 반응형 패턴) → 게시일·출처 caption(`YYYY.MM.DD` + `·` 구분, 15px/ink-muted) → 본문(`max-w-prose` 42rem 줄 길이, 토큰 유틸리티만 사용) → "목록으로 돌아가기" 링크(`ROUTES.homeTab` — 공지는 `/`, 소식은 `/?tab=news`).
- 제목 위계: 상세 페이지에서는 게시물 제목이 h1이어야 하므로 `SiteHeader`에 `asHeading` prop 추가 — 상세에서는 로고를 `<p>`로 렌더(h1 중복 방지, 페이지당 h1 1개 실측). 본문 마크다운의 h1/h2는 문서 위계상 h2로 매핑.
- 메타데이터: `generateMetadata`로 게시물 제목을 문서 title에 반영.
- 의존성 추가: `react-markdown`

### 실패 #2 — news 출처 필수 강제

- `src/lib/content.ts` `parsePostFile`: category가 `news`인데 `source`가 없으면 title/date 누락과 동일하게 **throw(빌드 실패)** — 출처 없는 소식의 조용한 게시 차단 (스펙 §5 "금융노조 소식 탭은 출처 필수 표기").
- 스모크 테스트: source 없는 verified news 임시 파일로 빌드 실패 실측 확인 후 삭제.

### QA 반영 후 자가 검증 (2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0, 경고 0)
npm run build      → 통과 (/ ○ Static, /notices/[slug]·/news/[slug] ● SSG)
```

추가 스모크 테스트 (명백한 플레이스홀더 임시 파일, 검증 후 전부 삭제·클린 재빌드 확인):
- source 없는 verified news → 빌드 실패 (강제 동작 확인)
- verified notice/news 상세 HTML 정적 생성: 제목 h1·본문 문단·h2 매핑·목록·긴급 배지·게시일·출처·돌아가기 링크 전부 렌더 실측, raw HTML(`<script>`) 미실행 확인, 페이지당 h1 1개 확인

## 7. 신규 과업: 디지털온누리 가이드 링크 카드 (2026-08-16, 리더 지시 — 스펙 §9)

### 변경 파일

- 신규: `src/components/home/OnnuriGuideCard.tsx` — 외부 링크 카드 (스펙 §9.2 그대로)
- 수정: `src/lib/routes.ts` — `EXTERNAL_LINKS` 상수 추가 (내부 `ROUTES`와 구분되는 별도 객체, `onnuriGuide: "https://onnuri.koscomlabor.cloud/"`)
- 수정: `src/components/ui/icons.tsx` — `BookIcon`(가이드 24px), `ExternalLinkIcon`(↗ 20px) 추가 (currentColor·aria-hidden)
- 수정: `src/app/page.tsx` — main 내부, 긴급 배너 아래·탭리스트 위 배치. main 상단 2rem을 카드가 이어받고 카드-탭리스트 간격 2rem (스펙 §9.1). 배너 미노출 시(현재) 헤더 아래 첫 요소가 됨 — 조건 분기 불필요(배너가 main 밖 상단에 조건부 렌더되는 기존 구조 그대로)

### 스펙 준수 포인트 (디자이너 명시 주의점 반영)

1. **tint 배경 위 ink-muted 금지** — 설명 텍스트는 `--color-ink`(#1a1a1a on #eff6ff, 15.99:1 — 검증 #19). `text-ink-muted` 미사용
2. **설명 말줄임 금지** — line-clamp/truncate 미적용, 모바일 2줄 흘림 허용 (`min-w-0 flex-1`로 flex 수축만 보장)
3. **#1d4ed8은 보더 전용** — 좌측 보더 `border-primary`(4px, 6.16:1 — 검증 #20)만 사용. 제목·아이콘 텍스트 색은 전부 `primary-strong`(#1e40af, 8.01:1 — 채택 #8)
4. **외부 이동 3중 표시** — ↗ 아이콘(aria-hidden) + "외부 페이지가 새 창에서 열립니다" 문구 + 접근성 이름(설명이 `<a>` 내부 텍스트라 자동 포함 — 스펙 §9.2 ③, 별도 sr-only 없음)
5. `target="_blank" rel="noopener noreferrer"`, 카드 전체 단일 `<a>` 블록·`min-h-touch`
6. hover: 제목 밑줄(group-hover) + 카드 `outline-2 outline-primary-strong`(배경 변화 없음), focus-visible: `outline-3 outline-primary offset-2` — 상태표 그대로
7. 적색·"긴급" 배지·전폭 배경 미사용 (긴급 배너 위계 보존 — §8 갱신 노트)

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0, 경고 0)
npm run build      → 통과 (/ ○ Static 유지)
```

빌드 HTML 실측: 외부 URL href·target=_blank·rel=noopener noreferrer·제목·새 창 안내 문구 렌더, 카드가 탭리스트보다 앞 위치, 설명에 말줄임 클래스 없음 — 전부 확인.

## 8. 방명록 백엔드 연동 (2026-08-16, 리더 지시 — 06 백엔드 명세, 승인된 계약 변경 A·C)

### 변경 파일

- `src/lib/api/guestbook.ts` — 계약 확장:
  - **A(페이지네이션)**: `listGuestbookEntries(options?: { limit?: number; offset?: number })` — 지정 시에만 쿼리스트링 부착(미지정 시 서버 기본값 최신 50건, 06 명세 §5). 응답 shape 불변(최상위 배열)
  - **C(에러 code 분기)**: `readErrorResult()` 추가 — `!response.ok`일 때 body `{ error: { code, message } }`를 명시적 파싱(`parseErrorBody`, 필드별 typeof 검증). `RATE_LIMITED`→`reason: "rate-limited"`, `VALIDATION_ERROR`→`"validation"`, 그 외 code→`"network"`. 서버의 한국어 message 우선, body가 명세 형식이 아니면 HTTP 상태(429/400) 기반 2차 분기 후 폴백 문구. 일괄 "network" 처리 제거
  - `GuestbookErrorReason` 유니온 타입 신설 (`unconfigured | network | invalid-response | rate-limited | validation`)
- `src/components/board/GuestbookPanel.tsx` — 실동작 전환: `NEXT_PUBLIC_API_BASE_URL` 설정 시 작성 폼+목록(`GuestbookBoard`), 미설정 시 기존 준비 중 카드 유지 (분기 로직 불변)
- `src/lib/date.ts` — `formatEntryDate()` 추가: 방명록 작성 시각(ISO 8601 UTC 타임스탬프)을 Asia/Seoul 기준 `YYYY.MM.DD`로 Intl 변환 (게시물 날짜는 날짜 전용 값이라 UTC 고정인 것과 구분)
- `tsconfig.json` / `eslint.config.mjs` — **backend `server/` 디렉토리를 프론트 검증 경계에서 제외** (server/는 자체 package.json·tsconfig 보유 별도 패키지. 루트 tsconfig의 `**/*.ts` include가 server 소스를 끌어들여 tsc가 실패하던 것을 차단. server/ 파일 자체는 미수정 — 리더 지시 준수)

### 스펙 §7.2 구현 내용

- 가시 레이블 `<label>` (닉네임/내용, placeholder 단독 금지), input 높이 48px(`h-12`)·보더 `border-strong`·radius 8px·내부 패딩 `px-3`, textarea `min-h-30`(120px), 글자수 안내 caption(`{n}/500자`)
- maxLength: 닉네임 20자 / 본문 500자 — **백엔드 검증 한도(06 명세 §4.2)와 동일 수치**. 제출 시 trim 후 전송(서버도 trim 후 검증)
- 등록 버튼: `primary-strong` 배경/흰 텍스트/700/44px, hover는 배경 유지+`outline 2px primary-strong`(스펙의 배경 밝기 변화 금지 준수), 전송 중 `disabled`+"등록 중…"
- 전송 결과는 `role="status"` 영역 텍스트 안내 (항상 렌더해 두고 내용만 갱신 — SR 감지 보장)
- 글 목록: §5 패턴 재사용(링크 없음), 제목 자리에 **내용 첫 줄**(2줄 말줄임), 메타 행 `작성자명 · 작성일(YYYY.MM.DD)`, 0건 시 §6 패턴 "아직 남겨진 글이 없습니다"(`EmptyState` 재사용), 폼-목록 간격 2rem
- 실명 입력 유도 문구 없음 — 필드명 "닉네임" (06 명세 §4.1 개인정보 최소 수집 반영)
- admin 삭제 엔드포인트 미구현 (프론트 범위 아님 — 리더 지시)

### 스펙 미정의 구간의 최소 해석 (frontend-designer 추후 확인 요망)

1. **로딩 상태** — §7에 정의 없음: caption/ink-muted 중앙 정렬 "방명록을 불러오는 중입니다…" + `role="status"`
2. **목록 조회 실패 상태** — 메시지(text-body/ink) + "다시 불러오기" 버튼(등록 버튼과 동일 스타일). 재시도는 이벤트 핸들러에서만 상태 변경
3. **등록 실패 피드백 색** — `text-urgent-strong`(#991b1b on #ffffff 8.31:1, 채택 #10). §8 "적색은 긴급 배너 유일" 원칙과 긴장 관계 — 에러 텍스트도 적색 의미론에 포함된다고 해석했으나 디자이너 판단 필요. 성공 피드백은 `text-ink`
4. **textarea 세로 패딩** — 스펙은 input `0 0.75rem`만 정의. 여러 줄 입력 가독을 위해 `py-2`(0.5rem) 추가
5. **작성일 타임존** — 작성 시각은 실제 timestamp이므로 KST(Asia/Seoul) 기준 날짜로 표기 (Intl 계산)
6. **등록 성공 시 목록 갱신** — 재조회 없이 성공 응답의 엔트리를 목록 앞에 삽입(서버 왕복 절약). 목록이 로딩/에러 상태였다면 전체 재조회

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)  ※ server/ 제외 후
npm run lint       → 통과 (오류 0, 경고 0)
npm run build      → 통과 (/ ○ Static, 상세 ● SSG 유지)
```

빌드 HTML 실측 (양쪽 상태 라운드트립, 최종은 미설정 클린 빌드로 복원):
- **미설정**: 준비 중 카드 유지, `<form>` 0건 — 기존 동작 무회귀
- **설정**(`NEXT_PUBLIC_API_BASE_URL` 지정 빌드): 폼 렌더(레이블·maxLength 20/500·글자수 안내·등록 버튼·`role="status"`), 준비 중 카드 미렌더, 목록 로딩 상태 렌더

### 미검증 (통합 QA 대상)

- **백엔드 실통신 전 구간** — 로컬 서버 미가동으로 실제 fetch 성공/실패 경로, 429/400 에러 body 분기, 목록 렌더, 등록→목록 반영은 미검증. 통합 QA에서 06 명세 §7 경계값 케이스와 함께 수행 필요

## 9. 실제 CI 반영 (2026-08-16, 리더 지시 — 스펙 §2 개정·§10 신설)

### 변경 파일·생성 자산

- `src/app/globals.css` — 토큰 값 교체 4건(`primary`·`primary-strong` → #093389 동일값, `urgent` → #d0101b, `urgent-strong` → #9c0d14) + accent 3줄 신설(`accent` #ec6d1e / `accent-strong` #7a3806 / `accent-tint` #fdf0e7). 토큰명 전부 유지 — 탭/배너/urgent 목록/링크/버튼/포커스 링은 클래스 변경 없이 값 교체만으로 자동 반영 (§10.4)
- `src/components/home/OnnuriGuideCard.tsx` — §10.4의 유일한 클래스 수정 지점: `bg-primary-tint`→`bg-accent-tint`, 보더 `border-primary`→`border-accent`(#ec6d1e — tint 인접면 UI 미달로 **장식 전용** 분류, 의미는 아이콘+문구+배경이 전달), 제목/아이콘/hover 아웃라인 `primary-strong`→`accent-strong`. 포커스 링만 전역 파랑 `primary` 유지(§9.2 키보드 일관성)
- `src/components/layout/SiteHeader.tsx` — KFIU 마크 추가: next/image, 높이 40px/md+ 48px(`h-10 md:h-12 w-auto`), 텍스트와 gap 0.75rem, `alt=""`+`aria-hidden`(인접 지부명이 의미 전달), 홈 링크 블록 포함, `priority`(첫 화면 로고 — lazy 플래시 방지)
- `src/components/layout/SiteFooter.tsx` — 흰 칩 로고 행: `bg-bg`(#ffffff) 칩(radius 8px, 패딩 8px 12px, `border-soft` 장식 보더)에 KFIU 마크+코스콤 로고 각 24px, gap 1rem, 링크 아님, 유의미 alt("전국금융산업노동조합"/"코스콤")
- `public/brand/kfiu-mark.png` — **247×192px PNG, 18KB**. 원본 `../design/kfiu_mark_jpg.jpg`(1066×830) 무크롭, 높이 192px LANCZOS 리샘플 (§10.3)
- `public/brand/koscom-logo.png` — **387×96px PNG, 17KB**. `../design/Koscom_CI.jpg`(9425×6112)에서 §10.3 지정 크롭 박스 (1030, 820, 2560, 1200) → 1530×380 그대로 크롭(좌표 임의 조정 없음), 높이 96px LANCZOS 리샘플. 생성 시 4변 2px 경계 스트립 전 픽셀 순수 흰색(255)임을 재실측 확인. 크롭 결과 육안 검증: 오렌지 셰브런+다크그레이 워드마크 기본형, 타 변형·점선 미포함
- 원본 CI 이미지 2종은 저장소 루트에 그대로 보존 (이동·수정 없음)

### 스펙 해석 (최소 해석 — frontend-designer 확인 요망)

1. **푸터 로고 행 상하 여백** — §3.4는 "지부명 아래" 위치만 정의: 지부명↓로고 행 `0.75rem`(mt-3), 로고 행↓저작권 `0.75rem`(mt-3)로 배치
2. **헤더 마크 로딩** — next/image `priority` 부여 (스펙 미정의 — 첫 화면 고정 요소의 lazy 로딩 플래시 방지 목적)
3. 흰 칩 배경은 하드코딩 #fff 대신 `bg-bg` 토큰(#ffffff 동일값) 사용 — 토큰 준수 원칙

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0, 경고 0)
npm run build      → 통과 (/ ○ Static, 상세 ● SSG 유지)
```

빌드 산출물 실측 (스크립트 검증 17항목 전부 OK):
- CSS: 신 팔레트 6값(#093389/#d0101b/#9c0d14/#ec6d1e/#7a3806/#fdf0e7) 존재, **구 플레이스홀더 4값(#1d4ed8/#1e40af/#b91c1c/#991b1b) 잔존 0건**
- HTML: kfiu-mark 2회 렌더(헤더 aria-hidden+빈 alt / 푸터 유의미 alt), koscom-logo 푸터 렌더(alt="코스콤"), 가이드 카드 accent 클래스 교체·포커스 링 primary 유지 확인

## 10. 디자인 v2 모던 전면 개편 (2026-08-16, 리더 지시 — 스펙 §11 신설·§1/§2/§3.2/§8 개정)

### 변경 파일

**폰트 (스펙 §11.2 방식 A — 다이나믹 서브셋 정적 서빙, 외부 CDN 미사용)**
- `package.json` — `pretendard` 의존성 추가 + `postinstall: node scripts/sync-pretendard.mjs`
- `scripts/sync-pretendard.mjs` (신규) — 패키지의 `pretendardvariable-dynamic-subset.css` + woff2 서브셋 92개(총 3.0MB, unicode-range로 사용 글리프 분만 온디맨드 로드)를 `public/fonts/pretendard/`로 복사
- `.gitignore` — `/public/fonts/pretendard/` 추가 (생성물 — postinstall이 클론 직후 보장)
- `src/app/layout.tsx` — `<link rel="stylesheet">` (React 19가 head로 호이스팅, `precedence`). `@next/next/no-css-tags` 라인 예외: 서브셋 CSS는 92개 폰트를 상대경로 참조하는 정적 자산으로 번들 import 부적합 — 스펙 지정 방식이 정적 서빙(사유 주석 병기)
- `--font-sans` 토큰 연결로 컴포넌트 클래스 변경 없이 전면 적용 (`font-display: swap` 내장)

**토큰 v2 (`src/app/globals.css`)** — 기존 토큰 값 변경 0건, 추가만: 색 2(`primary-soft` #d9e9ff / `primary-bright` #2e7df7 장식 전용), `--font-sans`, hero/hero-lg(자간 -0.02em 내장), `--tracking-heading`, radius 3(12/24/32px), shadow 2(딥블루 8%/12%)

**신규 컴포넌트 3**
- `src/components/home/HeroPanel.tsx` — §11.4 2모드. 모드 1: urgent 최신 1건(배지+게시일 / hero 제목 h2, 3줄 클램프 / 흰 액센트 바 4rem×4px / "자세히 보기" 필 CTA → 상세 링크, hover bg-primary-soft, 포커스 흰 링). 모드 2 폴백: **스펙 지정 문구 그대로**(아이브로우 "전국금융산업노동조합" / "코스콤지부" / "코스콤 조합원을 위한 공식 소식 공간") — 레퍼런스 홍보물 문구·일정 복사 0건. 우하단 primary-bright 장식 원형은 aria-hidden·pointer-events-none·코너 밖 3/4 배치로 텍스트 겹침 방지
- `src/components/home/DeadlineStrip.tsx` — §11.5. deadline이 오늘(KST) 이후인 verified 게시물(로더 `getUpcomingDeadlinePosts`, 마감 오름차순). 항목 "M/D 제목" 15px/700/#093389 링크(min-h-touch), D-7 이내는 red 칩(urgent-strong+흰 텍스트+D-n 텍스트 병행), overflow-x-auto(페이지 가로 스크롤 없음), 항목 간 1px 장식 구분선
- `src/components/home/DateBadge.tsx` — §11.5 3변형(default soft/primary·imminent urgent-strong/white·emphasis 예약). 56×56, M/D 18px/800 + D-n 15px/600. 밝은 블루 배지(#2e7df7+흰 텍스트)는 스펙 미채택 — 미도입

**수정 5 + 제거 1**
- `PostList.tsx` — 카드화(§11.6): 흰 카드 radius 16px + shadow-card(hover 시 hover 그림자), 패딩 1rem 1.25rem, gap 0.75rem, divide 구분선 제거. urgent 좌측 보더·focus 내향 아웃라인 유지. deadline 게시물: md+ 좌측 DateBadge, 모바일 제목 아래 D-n 텍스트
- `BoardTabs.tsx` — 컨테이너·탭 radius 9999px(필형)만 변경, 크기·상태·색·키보드 불변
- `OnnuriGuideCard.tsx` — radius-card(24px)+shadow-card만 추가, accent 체계 불변
- `GuestbookPanel.tsx` — 필드 radius 12px, 버튼 rounded-full, 준비 중 카드 radius-card. 그 외 불변
- `SiteFooter.tsx` — 딥블루 밴드: bg-primary, 상단 보더 제거, 지부명 흰색/700, 저작권 primary-soft, 로고 흰 칩 유지(보더 제거)
- `UrgentBanner.tsx` **삭제** — HeroPanel 모드 1이 승계. 소스 전체 grep 잔존 참조 0건
- `SiteHeader.tsx` 무변경 (폰트·자간 자동 적용)

**로더·유틸**
- `src/lib/content.ts` — `getUpcomingDeadlinePosts()` 추가
- `src/lib/date.ts` — `formatMonthDaySlash()`(M/D), `daysUntilKst()`(KST 달력 기준 D-n — Intl로 달력 날짜 추출 후 UTC 자정 차분, 수동 요일/타임존 계산 없음)

### 해석·기술 결정 (frontend-designer/QA 참고)

1. **heading 자간 구현 방식** — §11.2 "display·h1·h2 자간 -0.01em"을 `--text-display/h1/h2--letter-spacing` 토큰 모디파이어로 내장 → 컴포넌트 클래스 무변경 전면 적용(§11.2 취지). 스펙 §1 블록에는 별도 줄이 없어 구현 방식 차이만 존재(값 동일)
2. **D-n의 정적 프리렌더 한계** — "오늘"은 빌드 시점 KST 기준. 정적 사이트 특성상 날짜 경과 시 재빌드 전까지 D-n·스트립 노출 조건이 갱신되지 않음 → 운영상 콘텐츠 갱신/일일 재빌드 필요 (리더 판단 사항)
3. **마감 스트립 구분선 색** — 스펙 "1px 장식"만 규정: `bg-primary` 1×16px로 구현
4. **날짜 배지 하단 표기** — 스펙 "D-n 또는 요일" 중 D-n 채택(마감 맥락에서 행동 유도 정보가 요일보다 우선)
5. **모바일 D-n 텍스트 색** — 스펙 미규정: default `text-primary`(11.37:1)/임박 `text-urgent-strong`(8.46:1) — 배지 변형과 동일 의미론
6. **지난 deadline** — D-n 음수는 배지·스트립 모두 미표시 (경과 마감 정보는 무의미)
7. **모드 2 액센트 바 미포함** — 스펙 §11.4 모드 2 구성(아이브로우/제목/부문구)에 없어 도입하지 않음

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0, 경고 0 — no-css-tags 라인 예외는 사유 주석 병기)
npm run build      → 통과 (/ ○ Static, 상세 ● SSG 유지)
```

빌드 실측:
- **폰트 실서빙**: `next start` 후 curl — CSS 200(55.8KB)·woff2 서브셋 200(34.6KB), 페이지 head에 링크 포함. `public/fonts/pretendard/` 92개 서브셋(3.0MB, 온디맨드 로드)
- **히어로 모드 2**(현재 기본): 지정 폴백 문구 3종 렌더, CTA·스트립 없음, 장식 원형 aria-hidden — 8+6항목 OK
- **히어로 모드 1**(임시 플레이스홀더 urgent+deadline 2건, 검증 후 삭제·클린 복원): 배지·hero h2 제목·필 CTA·마감 스트립(D-4 red 칩 / D-45 기본, 8/20·9/30 M/D)·목록 카드화·md 날짜 배지 — 10항목 OK
- **UrgentBanner**: 파일 삭제, `aria-label="긴급 공지"` DOM 부재, 소스 잔존 참조 0건

### 미검증 (통합 QA 대상)

- 실브라우저 폰트 렌더 품질(Pretendard 적용 시각 확인), 375px 히어로 타이포 줄바꿈, 스트립 가로 스크롤 실조작, 방명록 실통신(§8 기존 항목 유지)

## 11. 지마켓산스 페어링 (2026-08-16, 리더 지시 — 스펙 §12)

### 변경 파일·산출물

- `scripts/build-gmarket-fonts.py` / `.sh` (신규) — OTF→woff2 변환 + KS X 1001 한글 서브셋. 서브셋 판정: EUC-KR 2바이트 인코딩 여부로 완성형 2,350자 식별(CPython euc_kr 코덱이 비완성형 음절을 8바이트 조합형으로 인코딩하는 함정을 회피 — 초기 실행에서 11,172자 전부 통과하는 버그 발견·수정). 총 2,465 코드포인트(한글 2,350 + ASCII + 기본 문장부호·낫표·화살괄호). 라이선스·저작권 name 레코드 보존(OFL 준수). 셸 래퍼는 임시 venv 부트스트랩(fonttools+brotli, PEP 668 회피) — 재현 가능
- `public/fonts/gmarket/GmarketSansMedium.woff2` — **143KB** (원본 OTF 848KB), `GmarketSansBold.woff2` — **137KB** (원본 869KB), 각 2,585 glyphs. **Light는 §12.2 규정대로 미변환·미서빙** (design/에 원본 3종 보존)
- **QA 7회차 수정 (2026-08-16)**: 초기 산출물이 시그니처 OTTO(비압축 OTF)로 저장되던 결함 수정 — `Options.flavor`는 subset CLI 경로 전용이라 `TTFont.save()`가 무시하므로 save 전 `font.flavor = "woff2"` 직접 설정. 재생성 후 시그니처 `wOF2`(xxd 앞 4바이트)·크기 255→143KB/250→137KB·`next start` 200 서빙 실측 확인
- `public/fonts/gmarket/LICENSE.txt` — SIL OFL 1.1 전문 + 출처(corp.gmarket.com/fonts)·변환/서브셋 고지 (§12.1 준수 조건). 4.9KB
- `src/app/globals.css` — `@font-face` 2종(Medium 500/Bold 700, `font-display: swap`) + `--font-display` 토큰(폴백: Gmarket Sans → Pretendard Variable → 시스템 한글). `--font-sans` 불변. 추가: `@source not` 2건(_workspace/server) — 스펙 문서의 클래스 예시 문자열(`tracking-[값]`)이 Tailwind 소스 스캔에 걸려 죽은 유틸리티가 생성되던 것 발견·차단
- 클래스 적용 4파일(§12.2 배분표 그대로, 배분표 외 적용 0건):
  - `HeroPanel.tsx` — 제목(모드 1·2) `font-display font-bold tracking-[-0.03em]`(hero 토큰의 800은 Gmarket 미보유 웨이트라 Bold 700으로 명시 대체 — faux-bold 방지), CTA `font-display font-medium tracking-[-0.01em]`
  - `SiteHeader.tsx` — 로고타입 "코스콤지부" `font-display font-bold tracking-[-0.02em]` (상위 조직명 1행은 Pretendard 유지)
  - `DateBadge.tsx` — M/D `font-display font-bold tracking-[-0.01em]`, D-n `font-display font-medium`(자간 0)
  - `PostList.tsx` — 모바일 D-n `font-display font-medium`(자간 0, 기존 임의 font-bold를 스펙 값으로 정정)

### 배포 방식 결정

**산출물 커밋 방식** 채택(리더 제시안 확인): woff2가 public/에 커밋되어 Docker 빌드 이미지에 자동 포함, 빌드 파이프라인에서 파이썬/변환 재실행 불필요. 변환은 원본 OTF 변경 시에만 `scripts/build-gmarket-fonts.sh` 수동 재실행(재현 스크립트 저장소 보존). Pretendard(postinstall 재생성·gitignore)와 방식이 다른 이유: Pretendard는 npm 패키지가 원천이라 install이 곧 재생성이지만, 지마켓산스는 저장소 내 OTF가 원천이고 변환에 파이썬 툴체인이 필요해 커밋이 더 단순·견고.

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0, 경고 0)
npm run build      → 통과 (/ ○ Static, 상세 ● SSG 유지)
```

실서빙(`next start`) 실측:
- woff2 2종·LICENSE.txt 모두 200 (260,692B / 255,900B / 4,872B)
- 빌드 CSS: `@font-face` Medium `font-weight:500`·Bold `font-weight:700`·`font-display:swap`, `.font-display{font-family:var(--font-display)}` 유틸 생성, tracking -0.01/-0.02/-0.03em 존재
- HTML: 헤더 로고타입·히어로 폴백 제목에 `font-display` + 지정 자간 클래스 적용 실측 (CTA·날짜 배지·모바일 D-n은 모드 1/deadline 콘텐츠 시에만 DOM 출현 — 클래스는 코드 확인)
- **외부 요청 0건**: 페이지 HTML+CSS 내 외부 URL은 온누리 가이드 카드의 콘텐츠 링크뿐, 폰트·자산 외부 로드 없음

### 미검증 (통합 QA 대상)

- 실브라우저에서 지마켓산스 렌더 품질·Pretendard 폴백 스왑 시 레이아웃 이동, 히어로 모드 1 제목의 Gmarket 적용 시각 확인(이번 회차는 클래스 실측까지)

## 12. 자수 아이덴티티 헤더 v3 (2026-08-16, 리더 지시 — 스펙 §13)

### 변경 내용 (`SiteHeader.tsx` 단일 파일 — 신규 폰트·토큰·자산 0건)

- 풀폭 네이비 밴드: `bg-primary`(#093389 — 자수 네이비를 KFIU 파랑의 직물 표현으로 해석, 신규 색 0건), 하단 보더 제거, 세로 패딩 기존 유지(0.75rem/md 1rem)
- KFIU 마크: 기존 자산 그대로 `rounded-lg`(8px) — 흰 배경 사각이 자수 원형("흰 사각+깃발")을 재현, §10.3 흰 배경 규정 충족. 높이 40/48px·`alt=""`+aria-hidden·priority 유지
- 텍스트 2줄 전부 `#ffffff`(11.37:1 — 채택 #11):
  - 1줄 "전국금융산업노동조합" — 15px/600 Pretendard (소형이라 §12.2 원칙상 지마켓 미적용)
  - 2줄 **"코스콤(한국증권전산)지부"** (자수 원문 그대로 — "(한국증권전산)" 포함) — Gmarket Bold 700 / 자간 -0.02em / 모바일 `text-[1.25rem]/[1.3]`(20px, 스케일 밖 커스텀 — §13.2가 375px 수용 계산과 함께 명시한 값) / md+ `text-h1`(32px) / `whitespace-nowrap`(명칭 분절 방지)
- **focus-visible 흰 링 3px** (`outline-white`, offset 2px) — 네이비 위 기존 파랑 링 시인 불가(§13.3 연쇄 영향). 헤더 내 `outline-primary` 잔존 0건
- h1 위계 로직(asHeading) 불변

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit / npm run lint / npm run build → 전부 통과 (오류·경고 0)
```

빌드 HTML 실측 10항목 OK: 밴드·보더 제거·2줄 명칭(자수 원문)·흰색 클래스·Gmarket Bold/자간/nowrap·20px→md 32px·마크 rounded-lg·흰 포커스 링·헤더 내 파랑 링 0건·메인 h1 유지. 상세 페이지 회귀(임시 파일 스모크 후 삭제·클린 복원): h1 1개=게시물 제목, 헤더 로고 p 강등, 상세에도 네이비 밴드 정상.

### QA 참고

- 375px 실뷰포트에서 2줄 명칭(13자×20px) 잘림 여부 실측 권장 — §13.2 계산상 경계(≈344px vs 가용 343px)로 매우 타이트
- 헤더·히어로 네이비 중복은 §13.3 판정(형태 대비+1.5rem 여백)대로 조정 없음 — 시각 확인은 통합 QA

## 13. 헤더 v4 — 상하 파란 띠 + 등폭 록업 (2026-08-16, 리더 지시 — 스펙 §13.5 + §11.4 6차 개정)

### 변경 파일 (2파일 — 신규 폰트·토큰·자산·색 0건)

- `SiteHeader.tsx` (v4):
  - 흰 배경(`bg-bg`) + 상하 `6px solid --color-primary` 띠(`border-y-[6px]`, 풀폭) — 네이비 밴드 폐기, 하단 띠가 히어로와의 경계 담당
  - 명칭 2줄 **등폭 록업** (§13.5.2 확정 계산값 고정 지정): 1줄 "전국금융산업노동조합" 모바일 `23.7px`/md+ `37.9px`, 2줄 "코스콤(한국증권전산)지부" 모바일 `20px`/md+ `32px` — 두 줄 모두 Gmarket Bold 700·자간 -0.02em·행간 1.15·`text-primary`·nowrap (1줄도 Gmarket Bold 승격 — 스펙 명시)
  - 마크 radius 제거(흰 배경 위 직접 배치 — 원본 흰 바탕 동화), focus-visible 표준 파랑 링 복원
- `HeroPanel.tsx` 모드 2 (§11.4 6차 개정):
  - 제목을 등폭 록업 h2(2줄)로 개정 — 모바일 `30.8px`/`26px`, md+ `66.2px`/`3.5rem`(56px), 두 줄 모두 Gmarket Bold 700·-0.02em·행간 1.15·흰색·nowrap. 기존 아이브로우 caption 제거(록업 1줄이 승계)
  - 부문구 교체: **"코스콤 조합원을 위한 정보 공유"** (개정 문구 문자 단위 그대로), 18px/400/primary-soft, 록업 아래 1rem
  - CTA·배지·액센트 바 없음 유지, 레퍼런스 홍보물 문구 복사 0건

### 자가 검증 (2026-08-16)

```
npx tsc --noEmit / npm run lint / npm run build → 전부 통과 (오류·경고 0)
```

빌드 HTML 실측 16항목 전부 OK: 띠 구조(`border-y-[6px]`+`bg-bg`, 헤더 `bg-primary` 잔존 0)·파란 텍스트·록업 크기 4종(23.7/37.9·20/32)·히어로 록업 크기 4종(30.8/66.2·26/56)·부문구 문자 단위 일치·구 문구("공식 소식 공간") 제거·마크 radius 제거·파랑 포커스 링 복원(흰 링 0건)·메인 h1=헤더 록업. 상세 페이지 회귀(임시 파일 스모크 후 삭제·클린 복원): h1 1개=게시물 제목·헤더 p 강등·v4 띠 구조 정상.

### QA 참고

- **등폭 실측(±2px)은 QA 검증 항목** — 계산은 hmtx 메트릭 기반(§13.5.2), 실렌더 폭은 브라우저 측정 필요
- 히어로 md+ 1줄 66.2px는 콘텐츠 폭 내 검산 완료값이나 실브라우저에서 3.5rem hero 스케일과의 시각 균형 확인 권장

### QA 9회차 수정 (2026-08-16)

- `HeroPanel.tsx`: 장식 원형(primary-bright)을 **모드 1 전용으로 조건 분기** (§11.4 개정 확정 — 모드 2 록업과의 겹침 방지, 디자이너 판정). 실측: 모드 2 원형 부재·록업/부문구 유지, 모드 1(임시 파일 스모크) 원형·배지·CTA 존재, 클린 복원 확인. tsc/lint/build 3종 통과

## 14. 파비콘 교체 — KFIU CI 마크 (2026-08-16, 리더 지시)

- 소스 `design/kfiu_mark_jpg.jpg`(1066×830) → 정사각 캔버스(흰 배경 §10.3, 마크 중앙, 폭 86%) Pillow 합성
- 생성(App Router 컨벤션 — 자동 서빙, 링크 태그 불필요): `src/app/icon.png`(512×512, 31.6KB), `src/app/apple-icon.png`(180×180, 9.4KB), `src/app/favicon.ico`(16/32/48 멀티사이즈, 4.3KB — 기존 create-next-app 기본 파일 교체)
- 이슈: Pillow 기본 RGB ICO를 Next 빌드의 ico 파서가 거부("PNG is not in RGBA format") → RGBA(불투명 알파)로 재생성해 해결
- 검증: tsc/lint/build 3종 통과, `next start`에서 /icon.png·/apple-icon.png·/favicon.ico 전부 200, head에 자동 링크 3종 확인, 서빙 응답 512×512 PNG 실측. server/ 미접촉

## 15. 공지·소식 DB 전환 + admin 화면 (2026-08-17, 리더 지시 — 06 명세 Part 2·스펙 §14·07 §7.2)

### 렌더 전략 결정

**서버 컴포넌트 fetch + ISR revalidate 60초 채택** (리더 권장안). 컨테이너가 next server이므로 정적 프리렌더를 포기하고 ISR로 전환 — `/` ○(revalidate 1m), `/notices/[id]`·`/news/[id]` ƒ(dynamic + fetch revalidate). **D-n·마감 스트립·히어로 바인딩이 요청 시점(최대 60초 지연) 계산으로 전환되어 기존 "빌드 시점 고정" 한계 해소**(§10 기록 항목). API 미설정/실패 시 목록은 빈 상태 + 정직한 안내, admin은 "API 미연결" 카드 (가짜 동작 금지).

### 변경 파일

**API 계층 (신규 3)** — 06 명세가 계약의 출처, 필드 단위 일치·명시 검증:
- `src/lib/api/http.ts` — 공용: `ApiResult`/`ApiFailureReason`(방명록 방식 계승 + unauthorized/not-found/link-fetch-failed/payload-too-large 추가), 에러 body code 분기 + 상태 코드 폴백, `getApiConnection`/`resolveApiUrl`. 방명록(guestbook.ts)은 커밋 안정성을 위해 자체 구현 유지 — 통합 리팩토링은 별도 과업
- `src/lib/api/posts.ts` — 공개: `listPosts`(§11.1 최상위 배열)·`getPost`(§11.2), `ApiPostSummary/Detail/Attachment` 파서(필드별 typeof, null 가능 필드 명시 처리)
- `src/lib/api/admin.ts` — **전 요청 `credentials: "include"`**(07 §7.2): login/logout/me(§12), CRUD·adminListPosts(deletedAt 노출)(§13.1), preview-link(§13.2), 첨부 업로드/삭제(§13.3). 클라이언트 선검증 상수(5개/10MB/pdf·png·jpg·webp — 백엔드 한도 동일 수치). publishedAt은 입력에 없음(§15-6 서버 자동 기록)

**뷰·데이터 (2)**:
- `src/lib/postView.ts` — API 정본→표시 파생(`PostListItem`/`PostDetailView`): KST 날짜 표기, 링크형 도메인 추출(호스트만 — 전체 URL 노출 금지), 파일 크기 표기(≥1MB 소수1자리/미만 KB), 첨부 절대 URL, 마감 필터
- `src/lib/content.ts` — **page 카테고리 전용으로 축소**: notice/news 로더 전부 제거(§16 — 이관 시점 콘텐츠 0건, 데이터 이관 없음), verified 게이트는 파일 기반(AI 경유) 경로에 존속(06 §14 게시 정책)

**공개 화면 (7 수정 + 라우트 이동)**:
- `page.tsx` — API 기반 재작성. 히어로 urgent 바인딩은 공지 목록 첫 항목 파생(서버가 urgent 우선 정렬 보장 — 별도 `urgent=true` 쿼리 생략, 요청 수 절약. §11.1의 전용 쿼리와 결과 동일)
- `notices/[slug]`→`notices/[id]`, `news/[slug]`→`news/[id]` (§15-7 승인) — generateStaticParams/dynamicParams 제거, API getPost + 404, **카테고리 불일치 id도 404**(공지 id를 소식 경로로 열람 차단)
- `PostList.tsx` — 링크형 카드(§14.1: 카드 전체 외부 링크 새 창, ↗ 16px + 메타 "외부 링크(새 창) · 도메인" 3중 병행) / 첨부 존재 표시(문서 아이콘 + "첨부 n") / status 3상(ok·error·unconfigured)별 빈 상태
- `PostArticle.tsx` — 첨부 블록(§14.1: surface 행 카드·파일명 15px/600·크기 caption·행 전체 다운로드 링크·hover primary+밑줄), 링크형 상세는 "원문 보기" 외부 링크 행, body null 허용
- `HeroPanel`/`DeadlineStrip`/`BoardTabs`/`EmptyState` — `PostListItem` 타입 전환(slug→id, publishedAt), status props, subMessage prop
- `routes.ts` — notice/news(id), `ROUTES.admin` 추가

**admin 화면 (신규 5)** — §14, 신규 색 조합 0건·전부 Pretendard:
- `src/app/admin/page.tsx` — **noindex**(robots 메타 실측 확인), 공개 헤더·푸터 + "관리자" 배지(h1)
- `src/components/admin/AdminApp.tsx` — 세션 확인(adminMe)→로그인→목록/등록/수정/삭제. 로그인 에러 3분기(§14.2 문구 그대로), 목록 unauthorized 시 로그인 화면 복귀(세션 만료), 삭제된 글은 "삭제됨" 표시+액션 숨김
- `src/components/admin/PostForm.tsx` — 유형·카테고리 라디오(§4.2 탭 시각·시맨틱 radio, 전환 시 입력값 유지), preview-link 3상태(로딩/성공/실패 — 실패 시 제목 포커스, 제목 항상 편집 가능), 소식+작성형 출처 "(필수)" 동적, urgent 체크박스 24px, deadline date 필드, 파일 선검증 + 저장 후 순차 업로드(부분 실패 개별 보고)
- `src/components/admin/DeleteDialog.tsx` — alertdialog + aria-modal + labelledby/describedby, 초기 포커스 취소·포커스 트랩·Esc·오버레이 클릭(§14.5)
- `src/components/admin/styles.ts` — 보조/위험/삭제확정 버튼 등 §14.3 스타일 상수

**지부명 규칙**: 상세 metadata 접미사 2곳 + admin 문구 전부 "코스콤(한국증권전산)지부" — `grep "코스콤지부"` 중 짧은 표기 0건 확인 (리더 적용분 SiteFooter/layout 보존)

### 해석 지점 (QA·디자이너 참고)

1. 히어로 urgent 바인딩을 목록 파생으로 구현 (전용 쿼리 대비 요청 1회 절약 — 서버 정렬 규약 의존)
2. 링크형 상세 페이지(§14 미정의): 제목+메타+"원문 보기" 외부 링크 행+선택 코멘트(body) 렌더 — 목록에서는 진입 경로 없음(카드가 외부 직행), 직접 URL 접근 대비
3. 카테고리 라디오는 링크형에도 노출 (API가 링크형에도 category 필수 — §14.4는 작성형 항목에만 기술)
4. urgent·deadline 필드는 유형 공통 노출 (§14.1 "기존 규칙 그대로 적용 가능" 근거)
5. 링크형 body(한줄 코멘트) 입력 필드는 §14.4 폼 스펙에 없어 미노출 (API는 허용 — 필요 시 디자이너 추가)
6. admin 목록 페이지네이션 UI 미구현 (기본 50건 — 방명록 제안 A와 동일하게 초과 시점에)

### 자가 검증 (2026-08-17)

```
npx tsc --noEmit / npm run lint / npm run build → 전부 통과 (오류·경고 0)
빌드: / ○ ISR(1m) · /admin ○(noindex) · 상세 2라우트 ƒ dynamic
```

**실통신 스모크 (로컬 백엔드: server/ 무수정 — ADMIN_PASSWORD_HASH만 셸 env 오버라이드 기동, PostgreSQL 로컬)**:
- 로그인(세션 쿠키 발급) → 작성형 공지(urgent+deadline+출처) 등록 201 → 링크형 소식 등록 201 → preview-link(example.com) 200 제목 추출
- 프론트(API 연결 빌드 + next start) HTML 실측: 히어로 모드1 바인딩·CTA `/notices/<uuid>`·마감 스트립(D-4·8/20)·목록 카드·링크형 외부 링크(target=_blank·도메인 표기)·상세(h1·마크다운 h2 매핑·출처·긴급 배지) 전부 렌더
- 첨부: PDF 업로드 201 → 상세 첨부 행(파일명·크기·API 절대 URL)·목록 "첨부 1" 렌더, **ISR 60초 재생성 실측**(캐시 스테일 → 재생성 후 반영)
- 삭제: soft delete 200 → 공개 상세 404·목록 0건 → 로그아웃 200
- 정리: 스모크 게시물 2건 DB hard delete·업로드 파일 제거·API 미설정 클린 재빌드(준비 중 안내·히어로 폴백·잔존 0건 확인)

### 미검증 (통합 QA 대상)

- **admin UI 브라우저 실조작** — 스모크는 API 계약(curl)+공개 렌더 실측까지. 폼 상호작용(라디오 전환·preview 3상태·파일 선검증·다이얼로그 포커스 트랩)·세션 쿠키의 실브라우저 CORS credentials 동작은 QA 브라우저 테스트 필요
- 프로덕션 도메인 CORS(허용 Origin 목록)에서의 쿠키 전송 — 로컬은 localhost:3000 origin 케이스만 구성상 확인

## 16. 자가 검증 결과 (최초 구현, 2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0)
npm run build      → 통과 (/ 정적 프리렌더 ○ Static)
```

추가 스모크 테스트 (명백한 플레이스홀더 임시 파일로 라운드트립 후 즉시 삭제 — content/는 현재 비어 있음):
- verified+urgent 파일 존재 시: 긴급 배너 렌더(`aria-label="긴급 공지"`), 배지·`YYYY.MM.DD` 표기·목록 노출 확인
- `verified: false` 파일: 목록에서 제외됨 확인 (게이트 동작)
- 콘텐츠 0건 복원 후: 배너 미렌더·빈 상태 표시 확인

---

## 17. 관리자 비밀번호 변경 — 프론트엔드 (2026-08-17, 리더 지시)

근거: `_workspace/00_input/requirements-password-change.md`, `_workspace/00_input/contract-password-change.md`(확정 계약 + 개정 1), 스펙 `_workspace/02_designer_spec.md` §14.8.
백엔드(`server/`)는 병렬 구현 — 본 절은 프론트 변경분만 다룬다(`server/`·06·07 문서 무수정).

### 변경 파일

| 파일 | 구분 | 내용 |
|------|------|------|
| `src/lib/api/http.ts` | 수정 | `ApiFailureReason` 에 `"invalid-credentials"`, `CODE_TO_REASON` 에 `INVALID_CREDENTIALS` 등록 (계약 개정 1) |
| `src/lib/api/admin.ts` | 수정 | `AdminMe`·`PasswordChangeResult` 인터페이스, `adminMe()` 반환 타입 변경, `adminChangePassword()` 신설, `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH` 상수 |
| `src/components/admin/styles.ts` | 수정 | `ADMIN_LABEL_CLASS`·`ADMIN_HINT_CLASS`·`ADMIN_FIELD_ERROR_CLASS` 3건 추가 (§14.8.7 문자열 그대로) |
| `src/components/admin/PasswordChangeForm.tsx` | **신규** | 인라인 비밀번호 변경 패널 (§14.8.3~§14.8.6) |
| `src/components/admin/AdminApp.tsx` | 수정 | 초기 비밀번호 경고 배너, 헤더 진입점, 패널 슬롯 공유·상호 배타, 성공/취소/세션만료 처리 |
| `src/components/admin/PostForm.tsx` | 수정 | 로컬 `LABEL_CLASS` → 공유 `ADMIN_LABEL_CLASS` import (문자열 동일 — 시각 회귀 0) |

신규 색 토큰·`globals.css` 변경 0건. 신규 버튼 상수 0건(배너 CTA·제출 = `ADMIN_PRIMARY_BUTTON_CLASS`, 취소·헤더 진입점 = `ADMIN_SECONDARY_BUTTON_CLASS`).

### 계약 준수 (문자 단위)

- 엔드포인트 `POST /admin/password`, 본문 `{ currentPassword, newPassword }`, 기존 `requestJson`(=`credentials: "include"`) 경유.
- `adminMe` 하위 호환 방어: `passwordIsInitial` 비boolean → `false`(배너 미표시가 안전한 기본값), `method` 비`session`/`bearer` → `"session"`, `expiresAt` 비문자열 → `null`. **`invalidResponse` 로 올리지 않는다** — 구버전 API 와 공존 가능해야 하고, 여기서 실패하면 세션 확인 전체가 무너진다.
- `adminChangePassword`: `ok !== true` 또는 `changedAt` 비문자열 → `invalidResponse("비밀번호 변경 응답 형식이 올바르지 않습니다.")`. `sessionsRevoked` 비정수 → `0`.
- 에러 → UI 매핑(계약 §3 표): `invalid-credentials`=현재 비밀번호 필드 인라인 에러+포커스 / `unauthorized`=세션 만료 → 로그인 화면 / `validation`=서버 message 를 폼 하단에 / `rate-limited`·그 외=지정 문구.
- 클라 검증 문구는 계약 §2 #2·#3 의 서버 message 와 문자 단위 동일(`새 비밀번호는 12자 이상이어야 합니다.` / `새 비밀번호가 현재 비밀번호와 같습니다.`). 12·200 은 `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH` 상수에서 문자열을 조립하므로 `maxLength`·검증·문구가 항상 같은 값을 가리킨다.

### 스펙 준수 포인트 (§14.8)

- 배너: `<section aria-labelledby>` + `<h2>`, **라이브 리전 미사용**(최초 렌더 포함 → 중복 안내), 닫기 버튼 없음, accent(오렌지) 계열 — 클래스 문자열은 §14.8.2 골격 그대로.
- 패널: 모달 아님. `PostForm` 과 **같은 슬롯**(`rounded-badge mt-4 border border-border-soft p-4` + `<h3>`)에서 **상호 배타** — `openPasswordPanel()`은 `editing=null`, `openPostForm()`은 패널을 닫는다.
- 제출 버튼은 `busy` 일 때만 `disabled`. **`opacity` 처리 없음** — 흰 텍스트 on `#093389` 대비가 무너지기 때문. 처리 중 표현은 라벨(`변경 중…`) + `<form aria-busy>`. `disabled:cursor-not-allowed`만 추가(§14.8.6 허용 범위).
- 에러 표시 시점: 타이핑 중 신규 에러 없음 → 표시 중인 에러만 갱신·해제. blur 는 값이 비어있지 않을 때만. "현재 비밀번호 빈 값"은 submit 전용. "새 비밀번호=현재 비밀번호"는 두 필드가 모두 채워진 상태에서 현재/새 어느 쪽 blur 에도 새 비밀번호 필드에 표시.
- submit 검증 순서 = 계약 §2 순서(현재 → 12자 → 동일 → 불일치), 위반 시 서버 요청 없이 첫 위반 필드로 포커스.
- `aria-describedby` 는 존재하는 id 만 공백 결합(`[hintId, errorId].filter(...)`), 에러가 떠도 힌트는 유지.
- 성공: 패널 닫기(언마운트 → 평문 폐기) → 배너 제거 → **기존 상위 `role="status"` 알림 줄**에 문구(토스트 신설 없음) → 포커스는 **헤더 "비밀번호 변경" 버튼**으로 고정 복귀. 문구는 `sessionsRevoked > 0` 2갈래.
- 헤더: `새 게시물` → `비밀번호 변경` → `로그아웃` 순, 컨테이너 `flex gap-2` → `flex flex-wrap gap-2`(360px 3버튼 줄바꿈).

### 기술적 결정

1. **`passwordIsInitial` 재조회 트리거(`meToken`)** — 기존 `adminMe()` 효과는 마운트 1회만 돌았다. 최초 진입에 세션이 없으면 `phase="login"` 이 되고, 로그인 성공 후에는 `/admin/me` 를 다시 부르지 않아 **배너가 가장 필요한 신규 로그인 직후에 배너를 못 띄운다.** 그래서 `onLoggedIn` 에서 `meToken` 을 올려 같은 효과를 재실행한다. 단 **재실행분은 `phase` 를 바꾸지 않는다**(`if (meToken === 0)`) — 로그인 직후의 일시적 통신 실패로 로그인 화면으로 되돌리면 회귀다. 세션이 실제로 무효라면 이어지는 목록 조회가 기존 로직대로 로그인 화면으로 전환한다.
2. **성공 후 `/admin/me` 재호출 대신 로컬 `setPasswordIsInitial(false)`** — 계약 §1 상 한 번 변경하면 영구 `false` 이므로 서버 왕복이 새 정보를 주지 않는다. 배너가 즉시 사라지는 것이 성공의 2차 확인 신호이기도 하다(§14.8.6).
3. **`PasswordField` 내부 서브컴포넌트** — 라벨·힌트·에러·`aria-invalid`·`aria-describedby` 연결을 한 곳에서 보장한다. `ref` 는 `inputRef` **일반 prop** 으로 전달해 `forwardRef` 없이 타입 안전을 유지했다.
4. **평문 취급** — 세 값 전부 `PasswordChangeForm` 로컬 state 에만 존재한다. 상위(`AdminApp`)로 올리지 않고, 로그·URL·스토리지 어디에도 쓰지 않는다. 패널을 닫으면 언마운트로 폐기된다.
5. **`LoginForm` 라벨도 `ADMIN_LABEL_CLASS` 로 교체**(요청 범위 외 1줄) — 인라인 문자열이 새 공유 상수와 **완전히 동일**(`mb-2 block text-body font-semibold text-ink`)해 렌더 결과가 바뀌지 않고, 같은 디렉터리에 중복 리터럴을 남기지 않기 위함. 시각 회귀 0.
6. `any`·`as` 캐스팅·`@ts-ignore` 0건. `sessionsRevoked` 는 `typeof === "number" && Number.isInteger` 로 좁혀 캐스팅 없이 처리.

### 스펙과의 차이 1건 (리더·디자이너 확인 요망 — 계약 우선 적용)

- 스펙 §14.8.5 "서버 에러 매핑" 표는 `unauthorized` 를 **현재 비밀번호 필드 에러**로 규정하고, 같은 절 말미에 "세션 만료와 구분되지 않는다"는 경계면 주의를 달고 있다. 이는 **계약 개정 1 이전 상태**의 기술이다. 개정 1이 `INVALID_CREDENTIALS` 를 분리했으므로 구현은 **계약 §3 표**를 따랐다: `invalid-credentials` → 필드 에러+포커스, `unauthorized` → 로그인 화면 전환. 리더 지시서와도 일치한다. 스펙 §14.8.5 표 본문은 개정 반영이 필요하다(문서 수정 권한 밖이라 미수정).
  - **후속 (리더, 2026-08-17):** 스펙 §14.8.5 를 리더가 갱신 완료했다 — 에러 매핑 표를
    `invalid-credentials`(필드 에러+포커스) / `unauthorized`(로그인 화면 전환) 2행으로 분리하고,
    말미의 "구분 불가" 경계면 주의는 "개정 1 로 해소됨" 기록으로 대체했다. 이 항목은 종결.

### 자가 검증 (2026-08-17)

```
npx next typegen                    → 통과
npx tsc --noEmit                    → 통과 (오류 0)
npm run lint                        → 통과 (오류·경고 0)
NEXT_PUBLIC_API_BASE_URL=<더미> npm run build → 통과 (/admin ○ 정적, 라우트 구성 변화 없음)
```

- 빌드 CSS 실측: `.border-accent-strong` / `.bg-accent-tint` / `.text-accent-strong` / `.md:px-5` / `.md:shrink-0` / `.disabled:cursor-not-allowed:disabled` 전부 생성 확인(배너에서 처음 쓰는 `border-accent-strong` 포함).
- 검증 함수 로직 표 대조(6케이스: 빈 폼 / 12자 미만 / 현재와 동일 / 확인 불일치 / 현재만 빈값 / 정상) — submit 에러 집합·첫 포커스 필드, live(blur·타이핑) 에러 집합이 §14.8.5 규정과 일치.

### 미검증 (QA 대상)

- **서버 실통신 0건** — 백엔드가 병렬 구현 중이라 `POST /admin/password` 라운드트립을 못 돌렸다. `invalid-credentials`/`unauthorized`/`validation`/`rate-limited` 4분기, `sessionsRevoked` 0 vs n 문구, 배너 소멸은 통합 QA에서 실응답으로 확인 필요.
- 브라우저 실조작: 포커스 이동(첫 오류 필드·성공/취소 후 헤더 버튼 복귀), 스크린리더의 `role="alert"` 발화, 비밀번호 관리자 자동완성(`current-password`/`new-password`) 동작.
- 360px 실측: 배너 2줄 제목·`w-full` CTA, 헤더 3버튼 줄바꿈.

---

## 18. 메인페이지 탭 → 섹션 나열 전환 + 노동교육(education) 분류 (2026-08-17, 리더 지시 — 스펙 §15 / §15.6R)

근거 입력: `02_designer_spec.md` §15 전문(§15.6R 최신 확정판, **§15.6.1~15.6.5 는 폐기분으로 미구현**),
`00_input/requirements-home-sections.md`, `00_input/decision-education-content.md`,
`06_backend_api_spec.md` §19(프로덕션 배포 완료). 이 작업의 판정 기준은 §15.1 **은폐 금지**다.

### 18.1 파일 단위 변경

**신규 (6)**

| 파일 | 내용 |
|------|------|
| `src/lib/homeSections.ts` | `HOME_SECTIONS` 단일 배열(§15.11 불변식) + `HomeSectionId`. 칩 라벨과 섹션 `h2` 제목이 **모두 이 배열에서 파생**된다 |
| `src/lib/postCategories.ts` | `POST_CATEGORY_LABELS`(Record<PostCategory,string>) + `POST_CATEGORY_ORDER`. 분류 라벨의 전 화면 단일 출처(메인 섹션 + admin 폼/목록) |
| `src/components/home/HomeSection.tsx` | 섹션 프레임(§15.3): 액센트 바 + `h2` + `aria-labelledby` + `scroll-mt-6 md:scroll-mt-8`. 서버 컴포넌트. **상단 여백 기본값 없음**(`className` 필수 prop) |
| `src/components/home/SectionNav.tsx` | 섹션 바로가기 내비(§15.4). `"use client"` 없음·JS 0·순수 `<a href="#id">`·활성 상태 없음·비sticky. `CHIP_CLASS` 문자열은 스펙 그대로 |
| `src/app/education/[id]/page.tsx` | 노동교육 상세(§15.6R-G). `notices/[id]` 와 동일 구조, `backHref = ROUTES.homeSection("education")` |
| `ArrowDownIcon` (`src/components/ui/icons.tsx` 내 함수) | §15.11 규격 그대로(path `M12 5v14` / `m19 12-7 7-7-7`) |

**수정 (13)**

| 파일 | 내용 |
|------|------|
| `src/lib/api/posts.ts` | `POST_CATEGORIES = ["notice","news","education"]` 단일 출처 + `PostCategory` 파생 + `isPostCategory()`. **런타임 파서 가드(구 L85)를 `!isPostCategory(category)` 로 교체** — §15.6R-H #2 |
| `src/lib/postView.ts` | `PostListItem.category: PostCategory` 재사용(리터럴 재기술 제거). `isVideo` 파생 **미도입**(§15.6R-D 판정 1) |
| `src/lib/routes.ts` | `TAB_IDS`·`TabId`·`isTabId`·`TAB_QUERY_PARAM`·`homeTab` **제거**. `homeSection(id)`·`education(id)`·`post(category,id)` 추가. `?tab=` 리다이렉트·하위호환 코드 **미작성**(§15.9.2) |
| `src/components/board/PostList.tsx` | `kind: PostCategory` / `EMPTY_MESSAGES.education = "등록된 교육 자료가 없습니다"` / 상세 링크 = `ROUTES.post(...)` / **메타 블록 2행 재설계 + 링크형 `source` 렌더**(§15.6R-D) |
| `src/app/page.tsx` | `BoardTabs` 제거 → `SectionNav` + `HomeSection` 4개. `loadCategory("education")` 추가, unconfigured 폴백 2→3 |
| `src/app/notices/[id]/page.tsx` · `src/app/news/[id]/page.tsx` | `backHref` → `ROUTES.homeSection("notices")` / `ROUTES.homeSection("news")` |
| `src/components/home/HeroPanel.tsx` | 모드 2 록업 `<h2>` → `<p>` (§15.9.1) — 클래스 동일, 시각 변화 0 |
| `src/components/board/GuestbookPanel.tsx` | `PreparingCard` `<h2>` → `<h3>` (§15.9.1) — `text-h2` 유지, 시각 변화 0 |
| `src/components/home/DeadlineStrip.tsx` | 분류→경로 삼항 → `ROUTES.post(post.category, post.id)` (아래 18.4-1 참조) |
| `src/components/admin/PostForm.tsx` | 분류 라디오를 `POST_CATEGORY_ORDER` 파생으로 교체(**노동교육 선택지 추가**) + 컨테이너 `flex-wrap` |
| `src/components/admin/AdminApp.tsx` | 목록 분류 라벨 `POST_CATEGORY_LABELS[post.category]` (education 이 "금융노조 소식"으로 오표기되던 것 수정) |

**삭제 (1)**: `src/components/board/BoardTabs.tsx` — 이 사이트에서 ARIA tabs 패턴이 전면 소멸했다.

**미작성(지시대로 만들지 않은 것)**: `EducationLinkList`, `src/lib/educationLinks.ts`, `영상` 토큰·`isVideo`
파생·호스트 판정식, `description` 필드, `?tab=` 리다이렉트, `<section tabindex="-1">`, 노동교육 게시물 데이터.
`globals.css`·신규 색·신규 토큰 **변경 0건**.

### 18.2 `"notice"` 하드코딩 전수 조사 (`grep -rn '"notice"' src/` 외 4패턴)

| 위치 | 판정 |
|------|------|
| `page.tsx` `loadCategory` 호출 3회(notice·news·education) · `kind` 3회 | **의도적** — 섹션마다 데이터 소스가 다르다. 누락은 `Record<HomeSectionId, ReactNode>` 가 컴파일 타임에 막는다 |
| `notices/[id]`·`news/[id]`·`education/[id]` 의 `category !== "..."` | **의도적** — 교차 분류 접근은 404 여야 한다(실측 확인) |
| `PostForm.tsx:88` `useState<PostCategory>(initial?.category ?? "notice")` | 기본 선택값 — 분류를 좁히는 코드가 아니다 |
| `PostForm.tsx:112` `category === "news" && type === "article"` (출처 필수) | **의도적 비대칭** — 06 명세 §19.2: 출처 강제는 news 에만 남는다. education 에 확대하면 자체 제작 자료를 올릴 수 없다 |
| `homeSections.ts`·`postCategories.ts`·`api/posts.ts` | 단일 출처 정의 지점(각 1곳) |
| **`DeadlineStrip.tsx:28`(발견·수정)** | 리더 지시 목록에 없던 5번째 지점. 아래 18.4-1 |
| **`AdminApp.tsx:359`(발견·수정)** | 리더 지시 목록에 없던 6번째 지점. education 을 "금융노조 소식"으로 표시 |
| 탭 인프라 잔존(`homeTab`/`TAB_`/`isTabId`/`BoardTabs`/`role="tab"`) | **0건** (주석 내 언급 2건만) |

### 18.3 기술적 결정

1. **분류 리터럴 단일 출처 (`POST_CATEGORIES`)** — 스펙은 "`| "education"` 추가"만 요구했으나,
   같은 리터럴이 4파일에 흩어져 이번 사고를 만든 구조 자체를 없앴다. 06 명세 §19.4(서버측 단일 출처화)의
   프론트 대응이며, 다음 분류 추가 시 프론트에서 고칠 곳은 이 배열 하나다. 파서 가드는 이 배열에서 파생한다.
2. **경로 매핑 `ROUTES.post`** — `Record<PostCategory, (id)=>string>` 이므로 분류 추가 시 **컴파일 에러**로
   누락이 잡힌다. 삼항 분기는 새 분류를 조용히 잘못된 경로(404)로 보낸다.
3. **`Record<...>` 강제 3곳** (`EMPTY_MESSAGES`·`POST_CATEGORY_LABELS`·`POST_DETAIL_PATHS`) +
   `Record<HomeSectionId, ReactNode>`(page.tsx `sectionContent`) — "분류·섹션을 늘리면 컴파일이 깨진다"를
   설계로 보장한다. 런타임에 조용히 사라지는 실패를 타입 에러로 앞당기는 것이 §15.6R-H 의 취지다.
4. **라벨 중복 0** — `HOME_SECTIONS` 의 게시물 3분류 라벨은 `POST_CATEGORY_LABELS` 를 참조한다. 같은 한국어
   문구가 코드에 두 번 존재하지 않으므로 메인·admin 표기가 어긋날 수 없다("방명록"만 분류가 없어 지역 상수).
5. **메타 블록 = 토큰 배열 + 구분점 끼워넣기**(§15.6R-D 판정 4 권장안 그대로) — `MetaTokens` 가
   `index > 0` 일 때만 `·` 을 렌더하고, `·` 을 **뒤 토큰과 같은 `inline-flex` nowrap 래퍼**에 담아
   줄바꿈 시 행 끝에 매달리지 않게 했다. 빈 값 방어는 `hasText()`(null + 공백 문자열)로 통일.
   - **D-n(모바일)만 토큰 배열 밖**에 둔다. `md:hidden` 으로 **CSS 로 사라지는 요소**라 구분점을 붙이면
     md+ 에서 행이 `·` 로 시작해 판정 4를 위반한다. 현행과 동일하게 구분점 없이 행 선두에 온다.
   - 간격 실측: 기존 `[· ][토큰]`(형제 flex 아이템, `gap-x-1`) → 신규 `[[·][토큰]]`(래퍼 `gap-x-1`).
     구분점 좌우 여백 4px/4px 동일 → **시각 결과 동일, DOM 은 span 1단계 깊어짐**.
6. **섹션 렌더는 `HOME_SECTIONS.map` + `sectionContent[id]`** — 라벨을 두 곳에 적지 않기 위한 구조.
   첫 섹션 여백은 `index === 0 ? "mt-8 md:mt-10" : "mt-16 md:mt-20"` 한 곳에서만 결정된다
   (`HomeSection` 에 기본값 없음 — `className` 은 필수 prop).
7. **히어로 urgent 공지를 목록에서 빼지 않았다**(§15.1-6). 실측: urgent 공지 1건일 때 `/notices/n1` 링크가
   히어로 CTA·마감 스트립·공지 카드 **3곳**에 존재한다.
8. `any`·`as` 캐스팅·`@ts-ignore` **0건**. `isPostCategory` 는 `POST_CATEGORIES.some(c => c === value)` 로
   구현해 `as readonly string[]` 캐스팅도 쓰지 않았다.

### 18.4 스펙과의 차이 3건 (전부 기록·보고 대상)

1. **`DeadlineStrip.tsx` 1행 수정** — 스펙 §15.11 "변경 0(손대지 말 것)" 목록에 있는 컴포넌트다.
   그러나 `post.category === "news" ? ROUTES.news : ROUTES.notice` 삼항이 남아 있어, **마감일이 설정된
   education 게시물이 스트립에 오면 `/notices/<id>` → 404** 가 된다. 링크가 404 가 되는 것은 §15.1 이 금지한
   은폐의 변형이므로 `ROUTES.post` 매핑으로 교체했다. notice/news 동작·시각은 완전히 동일(경로 문자열 동일).
   ※ 현재 `page.tsx` 는 스트립에 notice+news 만 넘긴다(도입 블록 현행 유지) — **education 을 스트립에
   포함할지는 디자이너 판단 사항으로 남긴다**(§15.6R-A "urgent·deadline 은 분류 공통" vs §15.11 "도입 블록
   현행 유지"의 해석 차). 확정 콘텐츠 5건은 전부 `deadline: null` 이라 현재 렌더 차이는 0.
2. **admin 2파일 수정** — 스펙 §15.11 은 `admin/*` 를 "변경 0"으로 두었으나, 리더 지시서가 이 작업에
   **포함**으로 명시했다. ① `PostForm` 분류 선택지에 노동교육(없으면 사용자가 등록·분류 변경 불가)
   ② `AdminApp` 목록 라벨(education 이 "금융노조 소식"으로 **오표기**됨 — 정보 정확성 문제).
   신규 색·토큰 0건. `PostForm` 분류 컨테이너에 `flex-wrap` 1개 추가: 선택지 3개 합 ≈353px 이
   360px 화면 콘텐츠 폭(328px)을 넘어 가로 스크롤이 생긴다(§14.8.7 의 같은 판단 계승).
3. **`hidden` 문자열 0건 판정의 예외 1건(프레임워크)** — 프리렌더 HTML `<body>` 첫 자식에
   `<div hidden=""><!--$--><!--/$--></div>` 가 있다. Next.js App Router 셸이 넣는 **빈 서스펜스 경계**이며
   `/_not-found` 페이지에도 동일하게 존재한다(우리 코드 아님, 콘텐츠 0). §15.12-1 검사 시
   `role="tab"`·`role="tabpanel"` 은 0건, 콘텐츠 컨테이너 `hidden` 도 0건이다.
   그 외 `hidden` 은 `md:hidden`(모바일 D-n)·`hidden md:flex`(DateBadge)·`overflow-hidden` 유틸리티 클래스다.

### 18.5 자가 검증 (2026-08-17)

```
npx next typegen  → 통과      npx tsc --noEmit → 통과(오류 0)
npm run lint      → 통과(0)   npm run build    → 통과 (/education/[id] ƒ 신규, / ○ 정적 유지)
```

**목 API(06 명세 §11.1 형태) 프리렌더 실측** — 프론트 렌더 검증 전용, 게시 데이터 아님:

| 케이스 | 1행 | 2행 | 판정 |
|--------|-----|-----|------|
| 작성형 + 출처 + 첨부 + 마감 + urgent | `D-3 2026.08.17 · 지부 사무국 · 첨부 1` | (없음) | 현행과 동일 — 회귀 0 |
| 작성형 + 출처 없음 | `2026.08.17` | (없음) | 구분점 없음 |
| 링크형 + 출처 없음(기존 kfiu 소식) | `2026.08.17` | `외부 링크(새 창) · www.kfiu.org` | 정보 손실 0 |
| 링크형 + 출처 有 + URL 파싱 실패(도메인 null) | `2026.08.17 · 출처있음` | `외부 링크(새 창)` | 행 말미 `·` 없음 |
| **education 링크형(유튜브)** | `2026.08.17 · 금융노조 교육문화본부` | `외부 링크(새 창) · www.youtube.com` | **채널명 렌더 확인 — 게이트 조건 이행** |
| education 작성형 | `2026.08.17 · 지부 교육부` | (없음) | 카드 링크 `/education/e2` |

- `· ·`·행 선두 `·`·행 말미 `·`: **전 케이스 0건**.
- **education 게시물이 목록에 실제로 렌더된다**(파서 가드 수정 확인 — 수정 전이라면 0건이 되는 케이스).
- 라우팅 실측: `/education/e2` 200(`backHref="/#education"`, `<title>` 정상) · `/education/e1` 200 ·
  `/notices/e2` **404** · `/education/n1` **404** · `/?tab=news` 200(리다이렉트 없음, 소식이 그대로 보인다).
- 헤딩 아웃라인: (urgent 有) `h1 지부명 → h2 공지제목(히어로 모드 1) → h2×4 섹션` /
  (urgent 無·API 미설정) `h1 → h2×4 → h3 방명록 준비 중입니다`. **h2 에 지부명 없음** ✓
- 랜드마크: `region 주요 소식` → `navigation 마감 예정 일정` → `navigation 페이지 섹션 바로가기` →
  `region ×4`(전부 `aria-labelledby`) — §15.9.1 구성과 일치.
- 빈 상태(ok+0건) 3분류 실측: `등록된 공지사항이 없습니다` / `등록된 소식이 없습니다` /
  **`등록된 교육 자료가 없습니다`** + 공통 보조 문구 `새 글이 등록되면 이곳에 표시됩니다`.
- 빌드 CSS 생성 확인: `scroll-mt-6`·`md:scroll-mt-8`·`mt-12`·`mt-16`·`md:mt-20`·`md:mt-10`·`gap-1.5`·
  `md:text-h1`·`hover:border-primary`·`hover:bg-primary-tint`·`focus-visible:outline-3`·
  `focus-visible:outline-offset-2`·`h-1`·`w-16` 전부 존재.

### 18.6 미해결·QA 인계

1. **링크형 게시물의 `source`(채널명)를 admin UI 에서 입력·수정할 수 없다.** 출처 필드는 §14.4 규정대로
   `type === "article"` 일 때만 렌더된다. 그런데 §15.6R-D 로 **링크형 카드가 `source` 를 표시**하게 되었고
   그 표시가 fact-verifier 게이트 조건의 이행 수단이다. 즉 지금은 API 로만 채널명을 넣을 수 있다.
   - 데이터 손실은 없다(수정 폼의 `source` state 가 기존 값을 보존해 그대로 재전송된다 — 실측 확인).
   - 판단 필요: 링크형에도 출처 필드를 노출할지(스펙 §14.4 개정 사항이므로 **디자이너·리더 판정 요청**).
     사용자가 "나중에 수정"하려면 채널명 수정 수단이 필요하다.
2. **노동교육 표시 순서** — §15.6R-D3 대로 이번 범위 밖. 역순 등록(5→4→3→2→1)이 유일한 수단이며
   새 글 추가 시 순서가 깨진다. 코드에 정렬 로직을 넣지 않았다(서버 정렬 그대로).
3. **마감일 있는 education 게시물의 마감 스트립 포함 여부** — 18.4-1 참조(디자이너 판정 대기).
4. **브라우저 실측 미수행**: 360px 칩 2행 래핑·터치 44px·가로 스크롤 0, 앵커 이동 시 `scroll-mt` 여백,
   칩 hover/focus 링, 키보드 Tab 순서(§15.12-5·7·8·9). 서버 렌더 HTML·CSS 존재까지만 확인했다.
5. **실서버 education 왕복 미수행**(§15.12-12) — 목 API 로만 검증했다. 프로덕션 등록 후 메인페이지 노출
   확인이 필요하다.

### 18.7 리더 판정 2건 반영 (2026-08-17, 18.6 미해결 항목 종결)

18.6 에 올린 미해결 2건을 리더가 판정했다. 아래대로 구현·검증했으며 **두 항목 모두 종결**한다.

#### 판정 1 — 링크형에도 `출처(source)` 입력 칸 노출 (**§14.4 개정** — 스펙 반영은 리더 담당)

리더 판정 근거: 사용자 요구 원문이 *"게시물을 수정가능한 형태로 하면 나중에 수정할게"* 인데,
§15.6R-D 로 **링크형 카드가 `source`(채널명)를 표시**하고 그 표시가 **fact-verifier 게이트 조건의
이행 수단**인데도 그 값을 admin 에서 입력·수정할 수 없었다 — 사용자가 편집할 수 없는 값이 카드 표면에서
신뢰성 판단을 담당하는 상태이므로 요구사항 미충족이자 게이트 조건이 운영 단계에서 유지될 수 없는 상태.

| 항목 | 구현 |
|------|------|
| 노출 조건 | 출처 필드를 `type === "article"` 블록 **밖으로** 이동 → **유형 공통**. 작성형의 필드 위치(본문 다음)·라벨·`maxLength=200`·스타일 **전부 그대로** |
| 필수 여부 | **확장하지 않음.** `sourceRequired = category === "news" && type === "article"` 유지(06 명세 §19.2 의 의도적 비대칭). 서버(`postValidate.ts`) **무변경** |
| 라벨 | "출처" 유지(+ 필수일 때만 " (필수)" — 기존 동작) |
| 힌트(링크형에서만) | `채널명·발행처를 적습니다. 목록 카드에 표시되어 조합원이 자료의 출처를 구분할 수 있습니다.` — `ADMIN_HINT_CLASS` 재사용. ① 무엇을 적는지(채널·발행처) ② 카드 노출 사실 ③ 기존 힌트 톤("~합니다/~습니다") 충족. **작성형에는 힌트를 붙이지 않았다**(기존 동작 유지 지시) |
| 신규 스타일 | **0건** — 기존 `ADMIN_*` 상수만 사용. 신규 색 조합·버튼 상수 0 |
| 곁가지 정리 1건 | 본문 힌트의 인라인 문자열 `"mt-1 text-caption text-ink-muted"` → `ADMIN_HINT_CLASS`(문자 단위 동일, 렌더 결과 불변) |

**빈 입력 정규화 (리더 요구 — "없던 문제를 만들지 마라")**

```ts
// PostForm.tsx handleSubmit — deadline 과 동일 패턴
source: source.trim().length > 0 ? source.trim() : initial !== null ? null : undefined,
```

- **수정 모드에서 비우면 `null`** 을 명시 전송해 기존 출처를 삭제한다. `undefined` 만 보내면
  `JSON.stringify` 에서 키가 사라지고 서버 PATCH 병합이 `if (key in patch)` 이므로 **기존 값이 남는다** —
  사용자가 출처를 비우고 저장했는데 카드에 그대로 표시되는 조용한 실패가 된다.
- **신규 모드에서 비우면 키 생략** → 서버 기본값 `null`.
- **빈 문자열(`""`)은 전송하지 않는다.** (서버 `optionalTrimmed` 가 `""` 도 `null` 로 정규화하지만,
  의도를 값으로 표현한다.) `AdminPostInput.source` 타입을 `string | null` 로 확장(`deadline` 과 동일).

#### 판정 2 — 마감 스트립에 education 포함

`page.tsx`: `selectUpcomingDeadlines([...notices.posts, ...news.posts, ...education.posts])`.
근거(리더): 마감일은 §14.6-4 대로 **분류·유형 공통 속성**이고 교육은 신청·수강 기한이 실재한다.
분류에 따라 마감일이 어떤 때만 스트립에 뜨면 "관리자가 마감일을 넣었는데 조합원에게 안 보인다" =
이번 작업이 제거하는 실패 모드 그대로다. 확정 콘텐츠 5건은 전부 `deadline: null` 이라 **현재 화면 변화 0**
(회귀 위험이 낮은 지금 닫는다). 항목 링크는 이미 `ROUTES.post` 매핑이라 경로가 안전하다.

#### 자가 검증 (추가 실측)

```
npx next typegen → 통과   npx tsc --noEmit → 통과(0)   npm run lint → 통과(0)   npm run build → 통과
```

**(가) 출처 payload 정규화 — 실제 서버 구현으로 검증.** `server/dist/lib/postValidate.js`(프로덕션과
동일 코드)를 그대로 import 하고, PATCH 병합 2행(`server/src/routes/admin.ts`: `if (key in patch)`)을
재현해 프론트가 만드는 payload 를 통과시켰다. **9/9 PASS**:

| 케이스 | 전송 | 서버 결과 |
|--------|------|-----------|
| 신규(링크형) 출처 `"  지부 교육부 "` | `"지부 교육부"` | `"지부 교육부"` (trim) |
| 신규(링크형) 출처 비움 | 키 생략 | `null` |
| 수정(링크형) 출처 변경 | `"마이크임팩트"` | `"마이크임팩트"` |
| 수정(링크형) 출처 비움 | `null` | `null` — **기존 값 삭제됨** |
| 수정(링크형) 공백만 입력 | `null` | `null` |
| 수정 payload 에 source 키 없음 | (없음) | `"금융노조 교육문화본부"` **보존** |
| (참고) `""` 를 그대로 보낼 경우 | `""` | `null` — **빈 문자열이 저장되는 경로 없음** |
| 소식+작성형 출처 없음 | `null` | **400 거부**(기존 규칙 유지) |
| 노동교육+링크형 출처 없음 | 키 생략 | `null` 통과(§19.2 비대칭 유지) |

**(나) 폼 렌더 — 임시 검증 페이지로 SSR 마크업 실측**(확인 후 **삭제 완료**, 리포지토리에 잔존 0):

| 폼 | 결과 |
|----|------|
| 링크형 수정 폼 | URL 필드 O · 본문 필드 X · **출처 필드 O**(라벨 "출처", 기존 값 `금융노조 교육문화본부` 채워짐) · **힌트 O**(`mt-1 text-caption text-ink-muted`) |
| 작성형 수정 폼 | URL 필드 X · 본문 필드 O · **출처 필드 O** · **힌트 없음**(기존 동작 유지) |
| 분류 선택지 | `공지사항 / 금융노조 소식 / 노동교육` 3개, 컨테이너 `inline-flex flex-wrap gap-1 rounded-full bg-surface p-1` |

**(다) 마감 스트립 + education — 목 API 프리렌더 실측**: 마감일(`2026-08-19`) 있는 education 게시물이

- 마감 스트립에 **표시됨**: `D-2 8/19 교육 신청 마감 있는 교육 게시물`, `href="/education/e9"`
  (`/notices/e9` 아님 — `ROUTES.post` 매핑 확인)
- 동시에 **노동교육 섹션 목록에도 그대로 남아 있음**(§15.1-6 중복 허용), 카드 1행에 `D-2` + 게시일 + 채널명.

#### 미수행 (QA 인계 — 18.6 목록에서 갱신)

- **브라우저 실조작 불가**: 이 실행 환경의 Chrome 이 샌드박스에서 띄운 로컬 서버에 도달하지 못한다
  (외부 사이트는 정상, `127.0.0.1`·LAN IP 모두 error page). 따라서 **admin 에서 실제로 타이핑→저장→재수정**
  하는 클릭 경로, 360px 레이아웃, 앵커 스크롤, hover/focus 링, Tab 순서는 **QA 가 실브라우저로 확인**해야 한다.
  위 (가)는 서버 계약, (나)는 SSR 마크업까지만 보증한다.
- 프로덕션 실서버 education 왕복(§15.12-12)·실데이터 5건 렌더 대조(§15.12-10·11)도 QA 범위로 남는다.

---

## 19. 디자인 v3 전면 교체 + 썸네일 + 정렬 UI (2026-08-17, 리더 지시 — 스펙 §16 / 계약 `contract-sort-thumbnail.md`)

작업 순서는 §16.19 의 5단계를 그대로 따랐다: **토큰 → 데이터 계층 → 공통 컴포넌트 → 목록·상세·방명록 → admin 정렬 UI.**
`--radius-card` 의 의미가 24 → 16px 로 바뀌므로 **토큰 교체와 컴포넌트 클래스 교체를 같은 커밋 범위에서** 처리했다
(히어로·온누리는 `rounded-panel`/`rounded-panel-lg` 로 올려 픽셀 결과를 유지했다 — 아래 19.2).

### 19.1 변경 파일 (신규 1 · 수정 21 · 삭제 0)

**1단계 — 토큰**

| 파일 | 변경 |
|------|------|
| `src/app/globals.css` | `@theme` 이하를 §16.8 전문으로 교체. `@import`·`@source not`·`@font-face`(Gmarket) 블록은 **그대로 유지**. 신규 토큰 8(`--text-title`·`--text-lead`·`--radius-panel-lg`·`--shadow-hero`·`--ease-out-soft`·`--spacing-section`·`--spacing-section-lg`·`--container-admin`), 값 변경 9, **색 값 변경 0 · 색 토큰 17종 전부 보존** |
| `src/app/admin/page.tsx` | `max-w-page` → **`max-w-admin`** (1줄 + 사유 주석). §16.14-1 의 유일한 admin 필수 수정 |

**2단계 — 데이터 계층**

| 파일 | 변경 |
|------|------|
| `src/lib/api/http.ts` | `ApiFailureReason` 에 **`"conflict"`**, `CODE_TO_REASON` 에 **`CONFLICT: "conflict"`**, `STATUS_TO_REASON` 에 **`409: "conflict"`** 추가 |
| `src/lib/api/posts.ts` | `ApiPostSummary.thumbnailUrl: string \| null` 추가. 관용 파서 `readOptionalString()` 신설 — 없거나 타입이 달라도 `null` 로 낮추고 `invalidResponse` 로 올리지 않는다 |
| `src/lib/postView.ts` | `PostListItem.thumbnailUrl` 추가, `toPostListItem` 에서 `resolveApiUrl()` 절대화(미설정 시 `null`) |
| `src/lib/api/admin.ts` | `ApiAdminPost.sortOrder: number \| null`(정수 아니면 `null`) + **`adminReorderPosts(category, ids)`** 신설(계약 §8 시그니처 그대로) |

**3단계 — 공통 컴포넌트**

| 파일 | 변경 |
|------|------|
| `SiteHeader.tsx` | `border-y-4` → `border-t-2`, `py-3.5 md:py-5`, `md:px-8`. **록업 크기·문구·마크 크기 변경 0** |
| `SiteFooter.tsx` | `rounded-t-panel-lg`, `mt-20 md:mt-section-lg`, `py-12 md:py-16`, `md:px-8`, 지부명 18/700, 로고 칩 `rounded-card px-4 py-3`·로고 28px, 간격 `mt-5` |
| `HeroPanel.tsx` | 장식 원형·`relative overflow-hidden`·`z-10` 래퍼·흰 액센트 바 **제거**. `shadow-hero`, `p-5 md:p-12`, `md:rounded-panel-lg`, 모드 1 제목 `md:text-hero-lg`·CTA `px-7`. **모드 2 = 단문 1줄**(리더 확정안 — 대안 A′ 미사용) |
| `HomeSection.tsx` | 액센트 바 `<div>` **삭제**, 제목 `text-h2 md:text-h1`, 콘텐츠 `mt-6 md:mt-7` |
| `SectionNav.tsx` | 칩 `px-4 md:px-5`·`gap-2`, 리스트 `gap-2.5`, `duration-150 ease-out-soft`. 활성 상태·sticky·세그먼티드 금지 규칙 **유지** |
| `DeadlineStrip.tsx` | `rounded-card px-5 py-3.5`, **세로 구분선 삭제**, 항목 `gap-4`, 임박 칩 `rounded-full` |
| `OnnuriGuideCard.tsx` | `shadow-card`·좌측 4px accent 보더 **삭제**(3중 위반 시정), `rounded-panel`, `p-5 md:p-6`, `gap-4`, 제목 `md:text-lead`, hover 2px 상승 |
| `UrgentBadge.tsx` | radius `rounded` → `rounded-badge`. 색·문구·아이콘·aria **변경 0** |
| `EmptyState.tsx` | `rounded-panel bg-surface px-6 py-14`(L2 면) |
| `ui/icons.tsx` | **`ArrowUpIcon` 추가**(§16.15.5 — `ArrowDownIcon` 과 동일 규격, path 2개) |

**4단계 — 목록·상세·방명록**

| 파일 | 변경 |
|------|------|
| `PostList.tsx` | `<li>` `rounded-card`+`overflow-hidden`+`transition-[box-shadow,transform] duration-200 ease-out-soft`+`motion-safe:hover:-translate-y-0.5`. **urgent 좌측 보더 삭제.** 링크에 `md:flex md:items-start md:gap-6 md:p-6`. **썸네일 슬롯 신규**(`md:order-2 md:w-48`). 텍스트 블록 `p-5 md:order-1 md:min-w-0 md:flex-1 md:p-0`. 제목 `md:text-lead`. 메타 1행 `mt-2`. 항목 gap `md:gap-4`. **`MetaTokens`·`hasText`·메타 2행 구조·`source` 렌더·구분점 안전 규칙은 한 글자도 건드리지 않았다** |
| `PostArticle.tsx` | 상단 복귀 링크 추가, 제목 `text-title md:text-display`, 메타 `mt-4`, **링크형 썸네일 블록**(eager), 원문 보기 필 버튼화, 마크다운 매핑 갱신, **"첨부파일" h2 추가**, 첨부 행 L1 카드·파일명 18px·`ArrowDownIcon`, 컨테이너 `md:mt-14 md:px-8`, **`max-w-prose` → `max-w-[var(--container-prose)]`**(19.3-③) |
| `GuestbookPanel.tsx` | 필드 `rounded-card h-14 px-4` / 텍스트영역 `min-h-40 p-4` / 버튼 `h-14 rounded-full px-8` + hover 상승 / 간격 `mt-6` · 목록 구분선 → `gap-3` + L1 카드 · 준비 중 카드 테두리 제거 + `rounded-panel` |
| `app/page.tsx` | 컨테이너 `mt-6 md:mt-10 px-4 md:px-8`, 간격 §16.7.2 표 적용(`mt-3 md:mt-4` / `mt-8 md:mt-10` / `mt-14 md:mt-18` / `mt-10 md:mt-14` / `mt-section md:mt-section-lg`). **구조·데이터 로딩·`HOME_SECTIONS` 순회 변경 0** |
| 상세 라우트 3종 | **변경 0** — `PostArticle` 이 전부 흡수 |

**5단계 — admin 정렬 UI**

| 파일 | 변경 |
|------|------|
| **`src/components/admin/SortPanel.tsx`** (신규) | §16.15.2~16.15.4 전문 구현. 자체 래퍼(`rounded-badge border border-border-soft p-4`) + h3 |
| `AdminApp.tsx` | "순서 지정" 보조 버튼(+`sortButtonRef`), `sortPanelOpen` 상태, 3패널 상호 배타, 닫을 때 포커스 복귀, 저장 성공 시 `setNotice` + `reload()`, 로그아웃 시 패널 닫기 |
| `admin/styles.ts` | **변경 0**(§16.14-6) |

**손대지 않은 파일 확인**: `DateBadge` · `homeSections.ts` · `postCategories.ts` · `routes.ts` · `date.ts` · `PostForm` · `DeleteDialog` · `PasswordChangeForm` · `layout.tsx` · `public/fonts/**` · `server/**`.

### 19.2 `--radius-card` 의미 변경(24→16px) 대응 — 픽셀 동일성 확인

| 요소 | 종전 클래스(값) | §16 클래스(값) | 결과 |
|------|----------------|---------------|------|
| 히어로(모바일) | `rounded-card`(24) | `rounded-panel`(24) | **픽셀 동일** ✓ 실측 24px |
| 히어로(md+) | `md:rounded-panel`(32) | `md:rounded-panel-lg`(32) | **픽셀 동일** ✓ 실측 32px |
| 온누리 카드 | `rounded-card`(24) | `rounded-panel`(24) | **픽셀 동일** ✓ |
| 준비 중 카드 | `rounded-card`(24) | `rounded-panel`(24) | **픽셀 동일** ✓ |
| 목록 카드 | `rounded-2xl`(하드코딩 16) | `rounded-card`(16) | **픽셀 동일 + 토큰화** ✓ |
| admin "API 미연결" 카드 | `rounded-card`(24) | `rounded-card`(16) | 의도된 상속(§16.14-3) — 실측 16px |

### 19.3 §16 대비 차이 3건 (전부 기록·근거)

**① `PostArticle` 제목의 비-urgent 상단 여백 — 스펙 미규정 구간을 채웠다**
§16.12.1 골격은 `<p class="mt-4"><UrgentBadge/></p>` → `<h1 class="mt-3">` 만 제시하고, **긴급 배지가 없을 때의 h1 여백을 규정하지 않았다.** 배지가 없으면 h1 이 상단 복귀 링크 바로 아래에 `mt-3`(12px)으로 붙는다. 배지가 있을 때와 "복귀 링크 → 첫 요소" 간격을 같게 맞추기 위해 **비-urgent 시 `mt-4`(16px)** 를 적용했다(`post.urgent ? "mt-3" : "mt-4"`). 스펙 값과 충돌하지 않는 보간이지만 임의 값이므로 **디자이너 확인 요청 항목**이다.

**② `DeadlineStrip` 비임박 항목의 `px-2` 제거**
종전 항목은 1px 세로 구분선과의 간격 확보를 위해 `px-2` 를 갖고 있었다. §16.9.5 가 구분선을 폐기하고 분리 수단을 `gap-4`(16px)로 지정했으므로, `px-2` 를 남기면 실제 간격이 32px 이 되어 스펙 값과 어긋난다. 제거해 **정확히 16px** 로 맞췄다. 임박 칩의 `px-3 py-1`(칩 내부 패딩)은 유지했다.

**③ `max-w-prose` → `max-w-[var(--container-prose)]` — §16 이전부터의 결함 시정**
Tailwind v4 의 **`max-w-prose` 는 내장 정적 유틸리티(`max-width: 65ch`)** 이며 `--container-prose` 테마 변수로 덮이지 않는다. 실측 결과 상세 본문 폭이 **620px(≈34자)** 로, §16.3.3 이 검산한 **672px(37.3자)** 및 스킬 §1 의 35~40자 범위와 어긋났고 서체 메트릭에 따라 값이 흔들렸다. 토큰을 직접 참조하도록 바꿔 **실측 672px** 을 확보했다. §16.19 의 변경 목록에는 없는 항목이므로 **리더·디자이너 확인 요청**(되돌리려면 이 1개 클래스만 원복하면 된다).

### 19.4 정렬 UI 구현 결정 3건

1. **포커스 이전을 `useEffect` 대신 `flushSync` 로 구현했다.** §16.15.4-3 이 "`useEffect`(또는 `flushSync` 후)"를 모두 허용한다. `useEffect` 안에서 `setPendingFocus(null)` 을 호출하는 형태는 프로젝트 ESLint(`react-hooks/set-state-in-effect`)가 **error 로 차단**한다. `handleMove` 안에서 `flushSync(() => setState(...))` 로 커밋을 동기 완료시킨 뒤 반대 방향 버튼에 `focus()` 한다 — 이벤트 핸들러 내부이므로 `flushSync` 사용이 안전하고, pendingFocus 상태·연쇄 렌더가 사라진다.
2. **버튼 ref 는 `Map<postId, { up, down }>`**(§16.15.4-3 지정 형태). 목록 로드 시 `buttonRefs.current.clear()` 로 이전 분류의 노드를 정리한다.
3. **409 문구는 서버 message 를 쓰지 않고 상수(`CONFLICT_MESSAGE`)로 고정**했다. 계약 §3 #4 가 이 문자열을 **화면 표시 요건**으로 규정하므로, 프록시가 본문을 갈아치우거나 서버 문구가 바뀌어도 요건이 깨지지 않아야 한다. 그 외 실패(`validation`·`network`·`rate-limited`)는 서버 문구를 그대로 표시한다.
4. **"저장되지 않은 순서 변경이 있습니다"는 별도 `<p>`** 로 렌더한다(라이브 리전 아님). `role="status"` 한 줄에 넣으면 이동 안내 문구가 덮어써 사라진다. 100건 가드 문구도 조건이 지속되므로 별도 `role="alert"` 로 분리했다.
5. **분류 라디오 선택 상태에 `peer-checked:border-primary` 를 추가**했다. §16.15.2 는 `bg-primary text-white` 만 지정했으나 보더가 `border-strong`(#6b7280) 로 남으면 파란 채움 위에 회색 링이 보인다. `border-primary` 는 `bg-primary` 와 **같은 색**이므로 신규 색 조합이 아니다.

### 19.5 자가 검증 결과

**빌드 체인 — 전부 통과**

```
npx next typegen  → ✓ Types generated successfully
npx tsc --noEmit  → 오류 0 (any·as·@ts-ignore 0건)
npm run lint      → 오류 0 · 경고 0
npm run build     → ✓ Compiled successfully / 7 페이지 생성
```

**신규 Tailwind 클래스 생성 확인 (빌드 산출 CSS 실측)** — `rounded-t-panel-lg` 를 포함해 **전부 생성됨. `rounded-t-[2rem]` 대체는 불필요했다.**

| 클래스 | 생성 | 클래스 | 생성 |
|--------|------|--------|------|
| `rounded-t-panel-lg` | ✓ | `md:rounded-panel-lg` | ✓ |
| `mt-section` / `md:mt-section-lg` | ✓ | `md:mt-18` | ✓ |
| `max-w-admin` | ✓ | `max-w-[var(--container-prose)]` | ✓ |
| `ease-out-soft` | ✓ | `shadow-hero` | ✓ |
| `text-title` / `md:text-lead` / `md:text-display` / `md:text-h1` | ✓ | `size-touch` | ✓ |
| `md:w-48` / `md:order-2` / `aspect-video` | ✓ | `motion-safe:hover:-translate-y-0.5` | ✓ |
| `motion-safe:group-hover:scale-[1.03]` | ✓ | `peer-checked:bg-primary` / `sr-only` | ✓ |

`globals.css` 에 `--color-*` **17종이 값 변경 없이 존재**하고 `--color-urgent`·`--color-accent`·`--color-primary-bright` 정의가 보존됨. 참고: Tailwind v4 는 **사용처가 0인 테마 변수를 빌드 산출물에서 제거**하므로 `--color-accent` 는 컴파일된 CSS 에 나타나지 않는다 — 이는 §16.2 의 의도(정의는 소스에 보존, 새 UI 에서 미사용)와 일치한다.

**대비 재실측** — §16.18 표 22개 조합을 `check-contrast.mjs` 로 재실행해 **전건 수치 일치**(17.40 / 7.56 / 11.37 / 8.46 / 8.77 / 4.83 / 11.37 / 9.23 / 9.23 / 14.13 / 8.46 / 10.45 / 15.99 / 7.84 / 15.58 / 10.18 / 16.65 / 7.23 / 10.88 / 4.63 / 7.74 / 15.91). 신규 색 조합 0건.

**소스 전수 grep**

| 검사 | 결과 |
|------|------|
| `shadow-card` + 테두리 유틸 동시 보유 요소 | **0건** |
| `border-l-4` | **1건 — admin 초기 비밀번호 배너만**(§14.8.1, §16.14 로 재설계 대상 아님. 19.7-① 참조) |
| `border-urgent` / 하드코딩 `rounded-2xl`·`rounded-xl` | **0건** |
| `transition-` 대상 | `colors` · `transform` · `[box-shadow,transform]` 뿐. `width/height/margin/top/left` 전환 **0건** |
| `<iframe>` | **0건** |
| `next/image` | 헤더·푸터 로고 2곳만(썸네일은 `<img>` — 사유는 코드 주석) |
| `rounded-lg` | admin `styles.ts` 3건(미변경) + `SortPanel` 이동 버튼(§16.15.3 지정) |

**목 API 실측 (헤드리스 Chrome 실조작 — 계약 §6 응답 필드 포함 목 서버)**

목 데이터: 공지 2건(전건 작성형·썸네일 없음, 1건 urgent+마감) / 소식 3건(**작성형 1 + 썸네일 정상 1 + 썸네일 404 키 1 = 혼재**) / 교육 5건(전건 링크형·썸네일). reorder 는 **1회차 409 → 2회차 200** 으로 두 경로를 한 세션에서 실측.

| 항목 | 실측 결과 |
|------|-----------|
| **혼재 목록 제목 좌측 x좌표(md+)** | 썸네일 유/무 3장 전부 **216px 동일** ✓ (§16.10.2 채택안의 목적 달성) |
| md+ 썸네일 크기·위치 | **192×108px**, x=872 (카드 192~1088 의 우측) ✓ |
| 360px 썸네일 | **328×184.5px**, x=16 (상단 풀블리드) ✓ |
| 플레이스홀더 박스 | **0건** ✓ |
| **CLS** | 썸네일 요청을 전면 차단한 렌더와 정상 렌더의 **제목 Y 좌표가 5건 전부 동일**(1932·2104·2276·2448·2620), 섹션 높이 915px 동일, 이미지 박스 높이 108px 고정 ✓ |
| 404 썸네일 | `naturalWidth 0`, 래퍼 `#f9fafb` 박스 유지(높이 108px), 3배 확대 캡처에서 **깨진 아이콘·대체 텍스트 0** ✓ |
| 접근성 | 썸네일 7개 전부 AX 트리에서 `presentation`(이미지 노드 아님). 카드 링크 접근성 이름 = 제목 + 메타(채널명·"외부 링크(새 창)"·도메인) ✓ |
| 섹션 간격 | 모바일 **72 / 72 / 72px**, md+ **120 / 120 / 120px** ✓ |
| 헤더 | 상단 보더 **2px** / 하단 **0px**, 총높이 89px(md+) ✓ |
| 히어로 모드 1 | 제목 md+ 64px, radius 24/32px, `shadow-hero` = `rgba(9,51,137,0.35) 0 24px 56px -20px` ✓ |
| **히어로 모드 2** | `<p class="font-display text-hero text-white md:text-hero-lg">코스콤 조합원을 위한 정보 공유</p>` — 40px/700/Gmarket/자간 -1.2px, md+ 64px. **360px 클리핑 0**(패널 scrollWidth 328 = clientWidth 328), 장식 원형 0건, 록업 문자열 0건 ✓ |
| 헤딩 아웃라인 | 모드 2: `h1`×1(헤더 지부명) + `h2`×4(섹션). 모드 1: 히어로 게시물 제목 `h2` 가 더해져 5개 — §16.11.1 이 모드 1 의 `h2` 유지를 명시하므로 정상 |
| 가로 스크롤 | 360 / 1280px 전부 **0** ✓ |
| 360px 메인 총높이 | **4,945px** (§16.10.5 재검토 트리거 5,120px 미달 → 복귀 수단 미도입 유지) |
| reduced-motion | `transition-duration: 1e-05s`, `scroll-behavior: auto`, 카드·이미지 transform `none` ✓ |
| 상세 3라우트 | `/notices/n1`·`/news/s2`·`/education/e1` 전부 제목 28px/700(360px), 복귀 링크 2개, 복귀 경로 `/#notices`·`/#news`·`/#education` 정확, 가로 스크롤 0 ✓ |
| 상세 썸네일 | `loading="eager"`, `alt=""`, 래퍼 24px radius, 작성형에는 미렌더 ✓ |
| 첨부 블록 | "첨부파일" `h2` 렌더, 행이 L1 카드(그림자 O·테두리 0), 파일명 **18px** ✓ |
| 방명록 | 필드 56px/16px radius/1px 보더/그림자 0, 텍스트영역 160px·p-4, 등록 버튼 56px 필, 빈 상태 L2 면 ✓ |
| **API 미설정** | 썸네일 `<img>` 0건(`resolveApiUrl` null 관용 처리), 빈 상태 3개 + 준비 중 카드 1개 전부 L2 면, 히어로 모드 2 폴백, 마감 스트립 미렌더, admin "API 미연결" 카드 radius 16px, admin 폭 768px ✓ |
| 콘솔 | 에러·예외·하이드레이션 경고 **0건**(Next dev HMR 로그만) |

**정렬 UI 실조작 (admin, 노동교육 5건)**

| 항목 | 실측 결과 |
|------|-----------|
| 진입 | 헤더 버튼 4개 `새 게시물 / 순서 지정 / 비밀번호 변경 / 로그아웃` ✓ |
| 패널 | h3 "게시물 순서 지정", 분류 라디오 3개(선택 칩 `rgb(9,51,137)`), **긴급 안내 문구 렌더** ✓ |
| 순번 배지 | **1,2,3,4,5 연속** ✓ |
| 이동 버튼 | **44×44px**, `aria-label` = `노조가 필요한 이유 — 아래로 이동 (현재 1번째)` ✓ |
| disabled | 첫 행 "위로" / 마지막 행 "아래로" 만 `disabled` ✓ |
| `role="status"` | `노조가 필요한 이유 — 4번째로 이동했습니다 (총 5건)` — 형식 일치 ✓ |
| **포커스 이전** | 마지막 행에서 "위로" 4회 → 1번째 도달 시 포커스가 **같은 게시물의 "아래로" 버튼**(`… — 아래로 이동 (현재 1번째)`)으로 이전됨. 포커스 소실 0 ✓ |
| dirty 가시화 | "저장되지 않은 순서 변경이 있습니다" 표시 + 닫기 버튼 문구 **"저장하지 않고 닫기"** 로 전환 ✓ |
| **409** | `role="alert"` = **"목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요."**, 목록 재조회로 원래 순서 복귀, dirty 해제, **저장 버튼 비활성**, alert 문구 유지 ✓ |
| 200 | `role="status"` = "순서를 저장했습니다.", alert 비움, dirty 해제, 부모 `notice` 표시(= 전체 목록 `reload()`) ✓ |
| "원래 순서로" | 로드 시점 배열로 복원 + "원래 순서로 되돌렸습니다." ✓ |
| 상호 배타 | "새 게시물" 클릭 시 순서 패널이 닫히고 PostForm 만 남음 ✓ |
| **공개 목록 반영** | 저장 후 메인 노동교육 섹션 순서가 패널 지정 순서와 **문자 단위 일치** ✓ |

### 19.6 회귀 확인

게시물 목록·상세 3라우트·첨부 다운로드 링크·마감 스트립 링크(`ROUTES.post` 매핑)·admin 로그인/목록/수정·삭제 다이얼로그·**비밀번호 변경 패널**(상호 배타에 순서 패널을 추가했을 뿐 기존 동작 불변)·방명록 폼/목록/빈 상태·API 미설정 폴백 — 전부 정상. `PostForm`·`DeleteDialog`·`PasswordChangeForm`·`styles.ts`·`routes.ts`·`DateBadge`·`homeSections.ts` 는 **파일 자체를 열지 않았다.**

### 19.7 미해결 · QA 인계 항목

1. **`border-l-4` 1건 잔존 — admin 초기 비밀번호 경고 배너(`AdminApp.tsx:280`).** §16.20-1 은 "`border-l-4` 0건"을 요구하지만, §16.14 는 admin 을 재설계 대상에서 제외하고 §16.19 는 `AdminApp` 변경을 "순서 지정 버튼 + 패널 상태"로 한정한다. 조합원이 보는 화면에는 0건이다. **판정을 리더에게 요청한다**(§14.8.1 이 이 배너의 accent 좌측 보더를 명시적으로 규정했으므로 임의로 지우지 않았다).
2. **저장 성공 문구가 두 라이브 리전에서 동시에 낭독된다.** §16.15.4-5 가 패널 `role="status"` 표시와 `onSaved → reload()`(부모가 `notice` 를 `role="status"` 로 표시)를 **둘 다** 규정하므로 스펙 그대로 구현했다. 실측에서 "순서를 저장했습니다."가 두 리전에 동시에 존재한다. 스크린리더 중복 낭독이 문제라면 부모 `onSaved` 를 문구 없는 `reload()` 전용으로 바꾸는 것이 최소 수정이다 — **디자이너 판정 필요**.
3. **19.3 의 차이 3건**(비-urgent 제목 여백 / `DeadlineStrip` px-2 / `max-w-prose` 시정)에 대한 승인.
4. **`mqdefault`(320px) 전용 항목의 모바일 화질**은 §16.10.3 이 수용하기로 한 한계다. 목 데이터로는 판정 불가 — 실서버 백필 후 QA 가 육안 확인.
5. **백엔드 미배포 상태에서의 배포 순서**: 07 §11.7 대로 **API → 프론트**. 프론트를 먼저 올리면 `순서 지정` 저장이 404(→ `not-found`)로 실패한다. 썸네일·정렬 없이도 목록·상세는 현행과 동일하게 동작함을 API 미설정 실측으로 확인했다.
6. **실서버 왕복 미수행**: 목 API 로만 검증했다. 실 데이터(교육 5건 실 YouTube 썸네일·소식 혼재)·`Cache-Control: immutable` 응답·`/thumbnails/:key` rate limit 하의 동작은 QA·배포 검증 범위다.
7. `_workspace/02_designer_spec.md` 가 git 상 **미커밋 상태(§16 1,117행 추가분)** 다. 이 문서는 읽기만 했고 수정하지 않았다 — 커밋 여부는 리더 판단.

### 19.8 리더 판정 4건 반영 (2026-08-17, 19.7 후속)

| 판정 | 내용 | 처리 |
|------|------|------|
| **1** | `border-l-4` 잔존(admin 초기 비밀번호 배너 `AdminApp.tsx:280`) — **그대로 둔다** | 코드 변경 0. §16.20-1 의 "border-l-4 0건" 체크는 **조합원이 보는 화면에 한정**되는 항목으로 리더가 확정. §16.14·§16.19 가 admin 을 전면 재설계 범위 밖으로 명시하고, 이 보더는 §14.8.1 이 별도 규정한 요소다. 실질 영향도 없다 — 사용자가 이미 비밀번호를 변경했으므로 `passwordIsInitial = false` 이고 배너 자체가 렌더되지 않는다 |
| **2** | 저장 성공 문구 **이중 낭독은 결함 → 고쳐라** | **수정 완료** (아래 상세) |
| **3** | `max-w-prose` → `max-w-[var(--container-prose)]` — **승인** | 유지. 함정 기록은 19.3-③ + 코드 주석(`PostArticle.tsx`)에 남겼다 |
| **4** | 비-urgent 제목 여백 `mt-4` · `DeadlineStrip` `px-2` 제거 · `peer-checked:border-primary` — **승인** | 유지. 근거는 19.3-①② · 19.4-5 |

#### 판정 2 수정 — 라이브 리전 역할 분리

**프로젝트 규약으로 확정: 성공 문구는 부모(`AdminApp` 의 상시 `role="status"`), 맥락 에러는 패널.**
근거는 비밀번호 변경 폼에서 이미 겪은 문제다 — `setFeedback` 직후 폼이 언마운트돼 문구가 사라졌고, 그래서 성공 문구를 부모의 상시 status 로 옮겼다(§17). 순서 저장도 같은 구조다.

`src/components/admin/SortPanel.tsx` 변경 (1개 지점 + 주석 3곳):

- `handleSave()` 성공 분기에서 `setStatusMessage(SAVED_MESSAGE)` → **`setStatusMessage("")`**.
  단순 제거가 아니라 **비우는 것**이 중요하다: 직전 이동 안내("n번째로 이동했습니다")가 남으면 저장 후 상태를 오해하게 된다.
- `onSaved(SAVED_MESSAGE)` 경로는 그대로 — 부모 `handleSortSaved` 가 `setNotice()` + `reload()` 를 수행한다.
- **에러·409 문구는 패널에 그대로 둔다**: 어느 패널에서 실패했는지가 맥락이고, 패널이 닫히지 않으므로 사라지지 않는다. 409 문구는 재조회 후에도 지우지 않는다(§16.15.4-5).
- **이동 안내·"원래 순서로 되돌렸습니다"는 패널 담당 유지** — 로컬 조작의 결과이므로 부모가 말할 것이 없다.
- `SAVED_MESSAGE` 상수 선언부에 규약과 근거를 주석으로 명시했다(다음 사람이 다시 패널에 넣지 않도록).

**목 API 재검증 (헤드리스 Chrome 실조작 — 화면의 전 `[role=status]`·`[role=alert]` 를 열거해 문구별 보유 리전 수를 셈)**

| 시점 | 라이브 리전 실측 | 판정 |
|------|------------------|------|
| 이동 직후 | `SortPanel role=status` 1곳: `노조가 필요한 이유 — 4번째로 이동했습니다 (총 5건)` | ✓ 이동 안내 정상 동작·1곳 |
| 저장 409 | `SortPanel role=alert` 1곳: `목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.` / 이동 안내 비워짐 / 로컬 순서 폐기 + 저장 비활성 + 원래 순서 복귀 | ✓ 에러는 패널 담당 유지 |
| **저장 200** | **`AdminApp role=status` 1곳만**: `순서를 저장했습니다.` — **패널 status 는 빈 문자열**, alert 비움, dirty 해제, 닫기 문구 "닫기" 복귀 | ✓ **이중 낭독 해소** |
| "원래 순서로" | `SortPanel role=status` 1곳: `원래 순서로 되돌렸습니다.` | ✓ 패널 담당 유지 |

콘솔 에러 0건. 재검증: `npx next typegen && npx tsc --noEmit && npm run lint && npm run build` **전부 재통과**(오류 0·경고 0).

### 19.9 프로덕션 실서버 대조 (백엔드 배포 완료 후, 읽기 전용)

리더가 백엔드를 프로덕션(`https://union-api.koscomlabor.cloud`)에 배포했으므로 **목 API 와 실서버의 계약 일치를 실측 대조**했다. 공개 GET 만 호출했다 — `POST /admin/posts/reorder` 등 변경 계열은 **프로덕션 데이터를 바꾸므로 호출하지 않았다**(admin 정렬 저장의 실서버 왕복은 QA·리더 범위).

**API 응답 (계약 §6 대조)**

| 검사 | 실측 | 판정 |
|------|------|------|
| `GET /posts?category=education` | 5건, 전건 `thumbnailUrl` 존재. 4건 `maxresdefault` + **오바마 건만 `mqdefault`** (리더 보고와 일치) | ✓ |
| `GET /posts?category=news` | 1건(링크형, 비YouTube 성명) → **`thumbnailUrl: null`** | ✓ 실데이터에 혼재 존재 |
| `GET /posts?category=notice` | **0건** | ✓ |
| 공개 응답 키집합 | `attachments·category·deadline·id·publishedAt·source·thumbnailUrl·title·type·urgent·url` — **`sortOrder` 없음** | ✓ 계약 §6("공개 응답에 넣지 마라") 준수 |
| `GET /posts/:id` | 위 + `body`. `thumbnailUrl` 존재, `sortOrder` 없음 | ✓ |
| `GET /thumbnails/<key>` 정상 | `200` · `content-type: image/jpeg` · **`cache-control: public, max-age=31536000, immutable`** · 73,512 bytes | ✓ |
| 잘못된 키(`notavalidkey.jpg`) | `400` | ✓ |
| 경로 조작(`../package.json`, `--path-as-is`) | `404` | ✓ |
| 없는 키(`AAAAAAAAAAA-mqdefault.jpg`) | `404` | ✓ |

**프론트 ↔ 실서버 렌더 실측** (`NEXT_PUBLIC_API_BASE_URL=https://union-api.koscomlabor.cloud` 로 기동)

| 항목 | 실측 결과 |
|------|-----------|
| 노동교육 5건 | **전건 실 썸네일 로드 성공** — 원본 `1280×720`×4 + `320×180`×1, **박스는 전부 192×108** ✓ |
| `mqdefault` 폴백 항목 | 오바마 건: 원본 320×180 → 192×108 박스에 정상 표시(§16.10.3 이 수용한 화질 한계 범위) |
| 금융노조 소식(비YouTube 링크형) | **썸네일 슬롯 미렌더** — `thumbnailUrl: null` 관용 처리 ✓ |
| **혼재 정렬** | 썸네일 있는 교육 카드 5장 + 없는 소식 카드 1장의 **제목 좌측 x = 216px 전부 동일** ✓ (§16.10.2 채택안의 실데이터 검증) |
| 채널명(`source`) | 전 카드 메타 1행에 렌더(`금융노조 교육문화본부`·`금융노조`·`하종강의 노동과 꿈`·`마이크임팩트`) ✓ fact-verifier 게이트 조건 유지 |
| 공지 0건 | 빈 상태 L2 면 `등록된 공지사항이 없습니다 / 새 글이 등록되면 이곳에 표시됩니다` ✓ |
| 히어로 | urgent 0건 → **모드 2 단문 "코스콤 조합원을 위한 정보 공유"**. `h2` 4개(섹션만) ✓ |
| 마감 스트립 | 마감일 있는 게시물 0건 → 미렌더 ✓ |
| 360px | 썸네일 **328×184.5** 풀블리드, 가로 스크롤 0, 총높이 **4,030px**(트리거 5,120px 미달) ✓ |
| 1280px | 가로 스크롤 0, 총높이 3,594px, 콘솔 에러 0건 ✓ |

**목 API 와 실서버가 어긋나는 부분: 없다.** 필드명·타입·상대 경로 형식·`sortOrder` 부재·캐시 헤더·400/404 분기까지 일치했다.

**디자이너 참고 관찰 1건 (결함 아님, 스펙 위반 아님)**: 노동교육 2번째 항목(`산별노동조합이란`)의 실 썸네일이 **거의 흰 배경**이라 흰 카드(L1) 위에서 이미지 경계가 보이지 않고 "일러스트가 떠 있는" 모양으로 읽힌다. 콘텐츠 의존 현상이며, 테두리를 두르면 §16.5 표면 규칙(카드는 그림자 단독) 위반이라 **손대지 않았다.** 판단이 필요하면 디자이너가 결정할 사안이다(예: 썸네일 래퍼에 아주 연한 인셋 링을 허용할지 — 신규 색 조합 검토 필요).

**배포 순서 요건 해소**: 백엔드가 이미 프로덕션에 있으므로 07 §11.7 의 "API → 프론트" 순서 조건은 **충족된 상태**다. 프론트를 배포하면 즉시 실데이터로 동작한다(위 실측이 그 상태를 그대로 재현한 것이다).

---

## §20 투쟁 안내 페이지 + 히어로 진입점 (2026-08-17 · 리더 직접 구현)

> **구현 주체 고지**: web-developer 에이전트에 발주했으나 **Anthropic API 529(Overloaded)로 실패**했다.
> 같은 시각 frontend-designer 2회·fact-verifier 2회도 동일 오류로 실패해 서브에이전트 경로가
> 전면 막힌 상태였다. 사용자가 배포까지 승인한 작업이라 **리더가 직접 구현**했다.
> 설계 원본은 `02_designer_spec.md` §17(리더 작성), 문안 근거는 `01_verifier_factcheck.md` 2·3회차.

### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/routes.ts` | `bargaining: "/bargaining-2026"` 추가 |
| `src/components/home/HeroPanel.tsx` | 모드 2 문구 교체 + CTA 필 버튼 |
| `src/app/bargaining-2026/page.tsx` | **신규** (§17.2 블록 1~6) |
| `public/docs/2026-imdantu-struggle-plan.pdf` | **신규** — 원본 PDF 정적 제공 |

`_workspace` 는 배포 rsync 에서 제외되므로 `00_input/bargaining-2026/` 경로를 직접 링크하면
프로덕션 404 다. `public/docs/` 로 복사하고 **파일명을 ASCII 로** 바꿨다(URL 인코딩 회피).

### 스펙 대비 차이

없음. §17 의 규정을 그대로 구현했다. `[리더 확정]` 문안 자리는 전부 확정 문안으로 채웠다.

### D-n 을 하드코딩하지 않은 이유와 구현

`daysUntilKst(isoDate)` 로 **렌더 시점 계산**. `revalidate = 60` 이므로 최대 1분 지연으로
갱신된다. `days < 0` 이면 배지 라벨이 `종료` 로, 제목 옆에 중립 **완료 배지**가 붙는다 —
**8/28 이 지나도 페이지가 스스로 "예정"이라 말하지 않는다.** 취소선은 쓰지 않았다
("취소된 일정"으로 오독된다 — 검증자 지적).

### 리더 검증 실측 (로컬 standalone 서버, 프로덕션과 동일 빌드)

`next start` 를 쓰지 않았다 — `output: "standalone"` 과 충돌해 CSS 청크가 프루닝되고
스타일 없는 페이지를 측정하게 된다(QA 13회차 유의사항). `node .next/standalone/server.js` +
`static`/`public` 수동 복사로 구동했다.

| 검사 | 결과 |
|------|------|
| 라우트 | `/bargaining-2026` 200 (34,880 bytes), ISR 1m |
| PDF | `/docs/2026-imdantu-struggle-plan.pdf` 200, `application/pdf`, 834,767 bytes |
| 헤딩 | `h1 → h2×6 → h3×2` |
| **D-n 동적 계산** | 8/28 → **D-11**, 9/4 → **D-18** (2026-08-17 기준 정확) |
| **금지 표현 9종** | `중재`·`필수유지업무`·`2028`·`6월 25일`·`6/25`·`실무교섭`·`투표율과 동의율`·`10만`·`과반이 찬성` **전부 0건** |
| **필수 표현 7종** | `조정안`·`구속력이 없습니다`·`지부 안내자료(2026-08-12) 기준`·`금융기관 지방이전 저지`·`96.05%`·`집결 장소와 시간은 지부 공지`·`표기 오류가 있습니다` **전부 존재** |
| 은폐 | `role="tab"`·`aria-selected` 0. `hidden` 1건은 Next 셸 빈 서스펜스 경계 |
| 히어로 | 문구 교체 확인, 이전 문구 잔존 0, CTA `href="/bargaining-2026"` 1건 |
| 빌드 | `typegen`·`tsc --noEmit`·`lint`·`build` 전부 통과. `any`/`as` 0 |

데스크톱 렌더 스크린샷: `_workspace/screenshots/투쟁안내/barg-desktop.png`

### QA 인계 (미검증)

- **360px·768px 실측** — 데스크톱 1280px 만 캡처했다
- 스크린리더 낭독, 키보드 전 플로우
- **프로덕션 배포 후 실화면** — ISR 갱신 지연 고려
- `daysUntilKst` 경계 동작(D-0 `오늘`, 음수 `종료`+완료 배지)은 코드 경로만 확인.
  **날짜를 넘겨 실측하지 못했다**
- 대비: §16.18 검증 조합만 썼으나 **신규 조합 여부를 스크립트로 재확인하지 않았다**

---

## §18. 푸터 관리자페이지 진입 링크 (2026-08-18)

### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/layout/SiteFooter.tsx` | 저작권 줄에 `관리자` 링크 추가 (+ `Link`·`ROUTES` import, 주석) |

신규 파일 없음. 토큰 추가 0건 — 기존 색 토큰만 사용했다.

### 마크업 구조

저작권 `<p>` 를 `flex flex-wrap items-center justify-between gap-x-6` 래퍼로 감쌌다
(기존 `mt-5` 는 래퍼로 이동, 저작권 문구·색·크기 변경 0). 좌: 저작권, 우: 관리자 링크.
`flex-wrap` 이므로 360px 처럼 한 줄에 안 들어가면 링크가 아랫줄로 내려간다 — 잘리거나
겹치지 않는다.

경로는 하드코딩하지 않고 `ROUTES.admin` 을 참조한다(union-webapp-dev §4).
`next/link` 사용 — 푸터의 첫 내부 링크이지만 헤더·히어로의 내부 이동 관례와 동일하다.

### 선택한 색 토큰과 대비 (footer 배경 --color-primary #093389 기준)

| 상태 | 토큰 | 값 | 대비 | 판정 |
|------|------|-----|------|------|
| 기본 | `text-primary-soft` | `#d9e9ff` | **9.23:1** | AAA(본문) 통과 |
| hover | `text-white` | `#ffffff` | **11.37:1** | AAA(본문) 통과 |

`.claude/skills/union-design-system/scripts/check-contrast.mjs "#d9e9ff" "#093389"` 실측:
`ratio 9.23 → AAA(본문) 통과`. 요구선(AA 4.5:1)을 2배 이상 상회한다.

**"관리자 링크는 눈에 덜 띄어야 한다"를 대비 낮추기로 구현하지 않았다** — §0.4 저대비 금지
규칙 정면 위반이다. 시각적 절제는 ① 크기(`text-caption` 15px, 본문 하한) ② 배치(푸터 최하단
우측) ③ 굵기 미부여로만 얻었고, 색은 바로 옆 저작권 문단과 **동일한 토큰**이다. 즉 이 링크는
푸터에서 가장 흐린 요소가 아니라, 가장 흐린 요소와 같은 수준이다.

`underline underline-offset-4` 를 준 이유: 저작권 문단과 색이 같으므로 **색이 아닌 형태로**
링크임을 알린다. 색 단독 구분(WCAG 1.4.1 위반)을 피하는 목적도 겸한다.

### 포커스·터치

- `focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2`
  — 딥블루 면 위의 관례(`HeroPanel.tsx:48`)와 동일. 헤더의 `outline-primary` 를 그대로
  가져오면 #093389 링이 #093389 배경에 묻혀 **포커스가 보이지 않는다.**
- `inline-flex min-h-touch items-center` — 44px 터치 대상(`--spacing-touch`) 확보.
- `ease-out-soft transition-colors duration-150` — 호버 색 전환, 기존 관례와 동일.

### 콘텐츠 은폐 금지 준수

`hidden`·`display:none`·조건부 렌더 없음. 서버 컴포넌트에서 **항상 렌더되는 일반 `<a>`**
로 출력된다. 로그인 여부에 따라 숨기지 않았다 — `/admin` 자체의 인증은 해당 라우트 책임이고,
링크를 숨기는 것은 보안이 아니라 은폐다.

### 검증 결과

| 명령 | 결과 |
|------|------|
| `npm run lint` | 통과 (경고 0) |
| `npx tsc --noEmit` | 통과 (exit 0) |
| `npm run build` | 통과 — `/admin` 포함 8 페이지 생성, TypeScript 체크 통과 |

**유의:** 타입 생성 전 `tsc --noEmit` 은 `src/app/layout.tsx(10,50) TS2304: Cannot find name
'LayoutProps'` 를 낸다. 이번 변경과 무관하며 `.next/types` 미생성 상태의 산물이다 —
`npm run build` 후 재실행하면 exit 0. QA 가 clean 클론에서 검증할 때 `tsc` 를 build 보다
먼저 돌리면 이 에러를 만나므로, **build → tsc 순서**로 확인할 것.

### QA 인계 (미검증)

- **브라우저 실측 미수행** — 360px/768px/1280px 실화면, 저작권 문구와의 줄바꿈 거동
- 키보드 Tab 이동 시 흰 포커스 링의 실제 가시성(스크립트 대비값이 아닌 육안)
- `/admin` 도착 후 동작(인증 화면 등)은 이번 범위 밖

---

## §19. 남은 일정 — 카운트다운 달력 (2026-08-18)

디자인 스펙 §18 전 항목 구현. `/bargaining-2026` 의 "남은 일정" 섹션에 달력 레이어를 추가했다.

### 변경/신규 파일

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/components/bargaining/StruggleCalendar.tsx` | **신규** (신규 폴더) | 격자·헤드라인·셀 4종. 서버 컴포넌트, 클라이언트 JS 0 |
| `src/lib/date.ts` | **추가 59줄 / 삭제 0줄** | `todayIsoKst` · `addDaysIso` · `weekdayIndexIso` · `formatKoreanMonthDay` (§18.10). 기존 함수 diff 0 |
| `src/app/bargaining-2026/page.tsx` | 수정 3곳 | ① `SCHEDULE` 에 `level` 추가 ② `<StruggleCalendar events={SCHEDULE} className="mt-6" />` 삽입 ③ `DateBadge` variant 판정식 1줄 교체 |

**손대지 않은 파일 (diff 0줄 확인)**: `globals.css` · `DateBadge.tsx` · `PostList.tsx` ·
`DeadlineStrip.tsx` · `HeroPanel.tsx` · admin 전부 · `server/**`.
`git diff --numstat` 로 5개 파일 전부 변경 블록 0 을 실측했다. 신규 색 토큰 0, 신규 문안 0.

**일정의 단일 출처**: 달력은 `SCHEDULE` 배열을 그대로 props 로 받는다. 달력용 날짜를
따로 두지 않았다 — 두 벌이 되면 한쪽만 고쳐졌을 때 조합원에게 서로 다른 날짜가 보인다.
`level` 은 기존 배열의 필드로 추가했고 `date`·`title`·`meta`·`detail` 문자열은 무변경이다.

### 스펙에서 벗어난 부분

**없음.** 렌더 계약 7단계·마크업·클래스·상태 전이를 스펙대로 구현했다.
다만 스펙 해석이 갈릴 수 있는 지점 2건을 아래에 남긴다 — **임의 변경이 아니라 스펙 문언의 적용 범위 판단**이며, 리더가 다르게 판단하면 즉시 고친다.

1. **월 경계 `M/D` 표기의 적용 범위.** §18.2.1 의 표는 `plain (월 경계)` 행만 두었으나,
   같은 절의 산문 규칙은 "**그 칸이** `day === 1` 이면 `M/D` 형식"이며 "격자 안에서
   8월→9월 전환을 알리는 **유일한** 표지이므로 생략 금지"라고 쓰여 있다.
   → **모든 비어 있지 않은 칸**(plain·today·event)에 적용했다. 매월 1일이 오늘이거나
   일정일이면 그 칸도 `9/1` 로 나온다. 현 데이터(9/1 은 평일 plain)에서는 차이가 없고,
   폭도 여유 안이다(peak 셀 20px 기준 `9/1` ≈ 28.4px < 셀 39.4px).
2. **상태 C 의 "격자 시작이 다음 주로 이동"(§18.7).** 렌더 계약(§18.1.2 5단계)은
   `start = 오늘이 속한 주의 일요일` 이다. 2026-08-29(토) 기준이면 그 주의 일요일은
   8/23 이므로 격자 시작은 8/23 이고, 8/28 칸은 **`iso < today` 규칙에 따라 빈 칸**이 되어
   사라진다. 알고리즘을 그대로 따랐고 행 수도 스펙이 예고한 "1~2행" 범위 안(2행)이다.
   §18.7 의 "다음 주로 이동"은 개괄 서술로 읽었다.

### 날짜 경계 실행 결과 (실측)

임시 라우트 `src/app/calendar-preview-tmp` 에서 `now` 를 주입해 **실제 React 서버 렌더
HTML** 을 생성하고 파싱해 확인했다. (`now` 는 `YYYY-MM-DDT00:00:00+09:00` = KST 자정)
검증 후 임시 파일 삭제 → `.next` 삭제 → 클린 재빌드로 잔존 0 을 확인했다(라우트 목록 8개, 프리뷰 없음).

| 시점 | 달력 | 헤드라인 | 격자 | 카드 |
|------|------|----------|------|------|
| **2026-08-18** (오늘) | 렌더 | `9월 4일 총파업` / **`D-17`** | **3행**, 범위 `8월 16일 – 9월 5일`. 8/16·8/17 빈칸, 8/18 today, 8/28 major, 9/1 은 `9/1` 표기, 9/4 peak | 8/28 `D-10`/emphasis, 9/4 `D-17`/imminent |
| **2026-08-29** (8/28 지난 후) | 렌더 | `9월 4일 총파업` / `D-6` | **2행**으로 축소, 범위 `8월 23일 – 9월 5일`. **8/28 칸이 빈 칸으로 사라짐**, 8/29 today | 8/28 `종료`/**default + 완료 배지**, 9/4 `D-6`/imminent |
| **2026-09-05** (전부 지난 후) | **미렌더 (`null`)** | — | — | 둘 다 `종료`/default + 완료 배지. 안내 문구·빈 카드 생성 0 |

추가로 중첩 상태(§18.3.4 · 상태 B·D)도 코드 경로가 달라 실측했다.

| 시점 | 결과 |
|------|------|
| **2026-08-28** (오늘 == 결의대회) | 8/28 셀 = `bg-primary` 면 + **`outline-white`** + 라벨 `오늘`, sr-only `8월 28일 총력투쟁 결의대회, 오늘`. 헤드라인 `D-7`. 2행 |
| **2026-09-04** (오늘 == 총파업) | 9/4 셀 = `bg-urgent-strong` 면 + **`outline-white`** + 라벨 `오늘`, sr-only `9월 4일 총파업, 오늘`. 헤드라인 **`오늘`**. **1행**(8/30–9/5) |

렌더 HTML 전수 검사(위 5시점 합산): `role="grid"` **0회**, `tabindex` **0회**,
포커스 가능 요소(`a`/`button`/`input`/`select`/`textarea`) **0개**,
`hover:`·`transition` 클래스 **0회**. 지난 날짜 셀은 `<td class="p-0.5 md:p-1"></td>` 로
내용이 완전히 비어 있다(`&nbsp;` 없음).

스크린리더 낭독 문자열도 HTML 에서 그대로 확인했다 —
`8월 18일 오늘` / `8월 28일 총력투쟁 결의대회, D-10` / `9월 4일 총파업, D-17` / `9월 1일`,
열 헤더 `일`+`일요일` … `토`+`토요일`, caption `8월 16일 – 9월 5일` + 보조 설명.

### 검증 명령 결과

| 명령 | 결과 |
|------|------|
| `npm run build` | **통과** — `Compiled successfully`, TypeScript 체크 통과, 8 페이지 생성. `/bargaining-2026` Revalidate `1m` 유지 |
| `npx tsc --noEmit` (build 이후) | **통과, exit 0** (출력 없음) |
| `npm run lint` | **통과, exit 0** (경고 0) |

빌드 산출 CSS 실측으로 클래스 생성도 확인했다 — `.h-14`, `.md\:h-18{height:calc(var(--spacing)*18)}`(=72px),
`.rounded-badge`, `.outline-offset-\[-2px\]{outline-offset:-2px}`, `.md\:text-hero-lg`.
`text-lead font-bold` 충돌 우려는 없다: Tailwind v4 의 `.text-lead` 는
`font-weight:var(--tw-font-weight, var(--text-lead--font-weight))` 이고 `.font-bold` 가
`--tw-font-weight` 를 설정하므로 **선언 순서와 무관하게 700 이 적용**된다(peak 셀 20px/700 확정).

### QA 인계 — 내가 검증하지 못한 것

- **브라우저 실측 전무.** 360/768/1280px 실화면을 열지 않았다. 특히 §18.6.1 의
  `D-10` 라벨 폭 여유 7.6px 는 **스펙의 폰트 메트릭 추정치**이고, Gmarket Sans 실제
  자족(字足)으로 360px 셀에서 잘리는지는 **육안 확인이 필요**하다. 가로 스크롤 0 여부도 동일.
- **스크린리더 실행 미수행.** 낭독 문자열이 DOM 에 있음은 확인했으나 NVDA/VoiceOver 표
  모드에서 실제로 §18.8.1 순서대로 읽히는지, 빈 셀에서 "빈 셀"을 어떻게 말하는지는 미확인.
- **200% 확대 미검증** — `table-fixed` 계산상 넘치지 않으나 실측 아님.
- **아웃라인 육안 확인 미수행** — `outline-offset-[-2px]` 내향 링이 인접 셀 여백(2px)을
  침범하지 않는지, 흰 아웃라인이 딥블루/딥레드 면 위에서 실제로 보이는지.
- **색 대비 재실측 미수행** — §18.9 는 디자이너가 `check-contrast.mjs` 로 실측한 값이고
  신규 조합이 0건이라 이번에 다시 돌리지 않았다. QA 가 재현 명령을 그대로 실행하면 된다.
- **`revalidate=60` 의 실제 재검증 동작** — 프로덕션에서 60초 뒤 D-n 이 갱신되는지는
  런타임 관찰이 필요하다. 빌드 산출물의 Revalidate 표기(`1m`)까지만 확인했다.
- **문안 게이트(§18.11.1)** — 새로 화면에 나타나는 5개 문자열은 리더·fact-verifier 확인 대상이며
  개발자가 판정할 사안이 아니다.

### §19.1 P2 방어 — 셀 라벨 줄바꿈 (QA 15회차 반영, 2026-08-18)

**변경 1건**: `StruggleCalendar.tsx` 의 `CELL_BASE` 에 `whitespace-nowrap` 추가(+주석).
다른 파일 변경 0. 라벨별로 붙이지 않고 **공통 클래스 한 곳**에 넣은 이유는 아래 판단 결과다.

| 대상 | 필요 판단 | 근거 |
|------|-----------|------|
| 셀 D-n 라벨 | **필요** | 360px 실측에서 14개 값이 줄바꿈(아래) |
| `today` 라벨 `오늘` | **예방 적용** | 한글은 글자 사이가 줄바꿈 기회다. 실측 폭 28.87px(셀 37.28px)로 현재는 여유 8.41px 이나 같은 실패 모드를 갖는다 |
| 월 경계 `9/1` 표기 | **예방 적용** | 슬래시 뒤가 줄바꿈 기회다. 실측 최대 31.25px |
| 일반 숫자(`19` 등) | 해당 없음 | 단일 토큰이라 끊길 자리가 없다. 공통 클래스에 포함되지만 동작 변화 0 |

**잘림 방어**: `overflow-hidden`·`truncate`·`text-overflow` 를 **어디에도 넣지 않았다.**
라벨→`<time>`→`td`→`tr`→`tbody`→`table`→카드→`section`→컨테이너→`main`→`body` 전 계층의
computed `overflow` 가 **전부 `visible`** 임을 브라우저에서 확인했다. 넘쳐도 잘리지 않는다.

#### 실측 방법

임시 라우트에 D-18~D-40 (23개 시점)을 `now` 주입으로 렌더하고, **실제 페이지와 동일한
컨테이너**(`mx-auto max-w-page px-4 md:px-8`)로 감싼 뒤 Chromium(Playwright, 360px)에서
`document.fonts.ready` 이후 측정했다. 컨테이너를 빼면 셀이 44px 이 되어 측정이 무의미해진다
— 1차 측정에서 실제로 이 함정에 빠져 재측정했다.

**줄바꿈 판정 기준 정정**: 라벨 span 은 flex 아이템이라 `display:block` 이고,
줄바꿈되어도 `getClientRects().length` 는 **1을 유지한다.** 높이(`22.5px` → `45px`)와
셀 `scrollHeight`(`56` → `62`)로 판정해야 한다. 첫 집계가 "줄바꿈 0"으로 나온 원인이었다.

#### 결과 — `whitespace-nowrap` 없음(대조군) vs 있음(현재)

측정 대상 span 167개, 셀 폭 39.42px(스크롤바 없음) / 37.28px(클래식 스크롤바 15px 존재 시).

| | 대조군(`white-space: normal` 강제) | **현재(`nowrap`)** |
|---|---|---|
| 줄바꿈 라벨 | **14종** — `D-20` `D-22` `D-23` `D-25` `D-28` `D-29` `D-30` `D-32` `D-33` `D-34` `D-35` `D-36` `D-38` `D-40` | **0종** |
| 라벨 높이 | 22.5px → **45px**(2줄) | 22.5px 유지 |
| 셀 `scrollHeight` | 56 → **62 / 61** | **56 고정** |
| 잘림 | 없음 | **없음** |
| 최대 넘침 | 0 (대신 줄바꿈) | **0.69px** (`D-40`) |

**줄바꿈의 실제 실패 모드는 "격자 행이 밀림"이 아니다.** 셀 높이는 `h-14`(56px) 고정이라
행은 그대로 있고, 대신 내용이 **색면 밖으로 빠져나간다** — 흰 라벨이 흰 카드 배경 위로
나가 **읽을 수 없게 된다.** peak 셀(빨강)·major 셀(남색)의 흰 텍스트라 대비가 1.0 이 된다.
QA 가 P2 로 본 것보다 실제 손상이 크다.

**넘침이 문제가 되는 구간 없음.** 최악값이 `D-40` 의 0.69px(좌우 각 0.35px)이고
셀 사이 여백은 `td` 패딩 4px(2+2), 카드 좌우 패딩은 12px 이라 전부 흡수된다.
가로 스크롤도 발생하지 않는다(`documentElement.scrollWidth == clientWidth`, 전 뷰포트).
`D-100` 같은 3자리는 §18.6.1 대로 구조적으로 발생하지 않는다. **폰트 크기는 건드리지 않았다.**

#### 현 데이터(D-17) 회귀 — 실제 페이지 `/bargaining-2026` 3개 뷰포트 실측

| 뷰포트 | 셀 폭 | 셀 높이 | 줄바꿈 | 넘침 | `오늘` | `D-10` 여유 | `D-17` 여유 | 가로 스크롤 |
|--------|-------|---------|--------|------|--------|-------------|-------------|-------------|
| 360px | 37.28px | 56px | 0 | 0 | 28.87px | **+0.30px** | +1.72px | 없음 (345=345) |
| 768px | 83.57px | **72px** | 0 | 0 | 28.87px | +46.59px | +48.01px | 없음 (753=753) |
| 1280px | 113.14px | **72px** | 0 | 0 | 28.87px | +76.16px | +77.58px | 없음 (1265=1265) |

헤드라인은 1280px 에서 computed **64px**, 1줄. 표 안 포커스 가능 요소 **0개** 재확인.
3행 격자·빈 칸·`9/1` 월 경계 표기·오늘 아웃라인 전부 종전과 동일하며, **현 데이터 렌더 결과 변화 0**이다.

> **QA 에 넘기는 주의값**: 스펙 §18.6.1 은 360px 에서 `D-10` 여유를 7.6px 로 추정했으나,
> 클래식 스크롤바(15px)가 잡히는 환경의 **실측 여유는 0.30px** 이다. 잘리거나 줄바꿈되지는
> 않지만 **여유가 사실상 0** 이므로, 앞으로 이 셀에 문자를 1글자라도 더 넣으면 넘친다.
> 폰트가 바뀌면 즉시 재측정이 필요하다.

#### 검증 명령 (재실행)

| 명령 | 결과 |
|------|------|
| `npm run build` | **통과** — 8 페이지, `/bargaining-2026` Revalidate 1m 유지 |
| `npx tsc --noEmit` (build 이후) | **통과, exit 0** |
| `npm run lint` | **통과, exit 0** |

임시 라우트·스크린샷·`.playwright-mcp`·`.next` 전부 삭제 후 클린 재빌드로 잔존 0 확인
(라우트 목록 8개, `git status` 에 임시 파일 없음).

#### 이 절에서 새로 검증된 항목 (§19 의 "미검증" 중 해소분)

- 360/768/1280px **브라우저 실측 완료** — 셀 폭·높이(56/72px)·가로 스크롤 0·라벨 잘림 0
- 360px 달력 카드 **육안 확인 완료**(스크린샷) — 3행, 빈 칸, 오늘 아웃라인, 8/28 남색·9/4 빨강, `9/1` 표기 정상

여전히 미검증: 스크린리더 실행, 200% 확대, 아웃라인 인접 셀 침범 여부(수치상 내향이라
침범 불가하나 육안 미확인), `revalidate=60` 런타임 동작.

---

## §20. 메인페이지 미니달력 + D-day 기준 통일 (2026-08-18)

디자인 스펙 §19 구현. 메인에 미니달력을 추가하고, D-day 기준을 **"가장 가까운 미래 일정"**으로
메인·상세 공통 단일 출처화했다.

### §20.1 변경/신규 파일

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/lib/struggleSchedule.ts` | **신규** | `STRUGGLE_SCHEDULE`(일정 단일 출처) · `futureEventsInOrder()` · `nextStruggleEvent()` |
| `src/components/bargaining/StruggleCalendar.tsx` | 확장 | `size` prop + 프리셋 룩업 · caption 분기 · mini 링크 · 헤드라인 대상/색 교체 · 같은 날 2건 처리 |
| `src/app/page.tsx` | 수정 2곳 | import 2줄 + 미니달력 블록(조건부) 삽입 |
| `src/app/bargaining-2026/page.tsx` | 수정 3곳 | 로컬 `SCHEDULE` 제거 → 모듈 import (문안 이동만) |

**손대지 않은 파일 (`git diff --numstat` 0줄 실측)**: `globals.css` · `DateBadge.tsx` ·
`DeadlineStrip.tsx` · `HeroPanel.tsx` · `OnnuriGuideCard.tsx` · `PostList.tsx` · admin · `server/**`.
**신규 컴포넌트 0 · 신규 색 토큰 0 · 신규 간격 토큰 0.**

**문안 이동 무결성**: 구 `page.tsx` 의 `SCHEDULE` 리터럴과 새 모듈의 값을 스크립트로 추출해
비교했다 — `date`·`title`·`meta`·`detail`·`level` **10개 필드 전부 완전 일치**(한 글자도 바뀌지 않음).

**단일 출처 구조**: 격자·헤드라인·메인 렌더 판정이 전부 `futureEventsInOrder()` **하나**를 통과한다.
필터(`null` 먼저 제거 — `null >= 0` 은 JS 에서 `true`)와 정렬(날짜 오름차순, 동일 날짜는 peak
우선)이 한 곳에만 존재하므로 메인·상세가 갈릴 경로가 없다. `nextStruggleEvent()` 도 이 함수의
첫 항목이다. `StruggleCalendar` 는 여전히 `events` prop 을 받는다(데이터를 직접 import 하지 않음).

### §20.2 스펙에서 벗어난 부분

**없음.** 다만 스펙이 명시하지 않아 판단이 필요했던 **구조 결정 1건**을 기록한다. 실측으로
검산했고 결과가 스펙의 수치와 일치하지만, 다르게 의도했다면 알려주기 바란다.

**md+ 2열에서 "자세히 보기" 링크를 어느 그리드 칸에 두는가.**
§19.1.1 은 카드에 `md:grid md:grid-cols-[12rem_1fr]` 를, §19.2.2 는 링크에 `mt-3 md:mt-4` 를
줄 뿐 링크가 어느 열인지 쓰지 않았다. 두 해석이 가능하다.

| 해석 | md+ 카드 높이(계산) | 스펙 §19.4.2 값 |
|------|--------------------|-----------------|
| (a) 좌측 열 = 헤드라인 **+ 링크**, 우측 열 = 격자 | 24 + 222.5 + 24 = **≈ 271px** | **≈ 271px** ✓ |
| (b) 링크를 3번째 그리드 항목으로(2행 1열) | 24 + 222.5 + 24(row gap) + 44 + 24 = **≈ 338px** | 불일치 ✗ |

→ **(a)를 채택**했다. 768px 실측 카드 높이가 **270.5px** 로 스펙 값과 일치한다(§20.4).

> ⚠️ **이 아래 문단은 리더 판정으로 뒤집혔다 — 현재 코드와 다르다. §20.8 을 볼 것.**
>
> ~~(a)의 부수 효과로 **모바일 순서가 헤드라인 → 링크 → 격자**가 된다. §19.4.2 의 모바일
> 내역은 높이 **합**이라 순서와 무관하며(어느 배치든 305.5px), 스펙이 모바일 순서를 지정한
> 곳은 없다.~~
>
> **리더 판정(2026-08-18): 모바일은 `헤드라인 → 격자 → 링크`.** 링크는 격자를 본 다음의
> 출구이고, 메인은 훑는 화면이라(§19.0 전제) 출구가 본체보다 먼저 나오면 조합원이 격자를
> 지나치고 링크만 본다. **현재 코드는 DOM 순서가 `헤드라인 → 격자 → 링크`** 이며 md+ 좌측 열
> 배치는 명시적 그리드 배치로 유지된다(카드 높이 270.5px 그대로). 구현·재실측은 §20.8.

### §20.3 날짜 경계 실측 — 메인·상세 D-n 일치 (5시점)

임시 라우트에 `now` 를 주입해 mini·full 을 **같은 페이지에서 나란히** 서버 렌더하고 HTML 을
파싱했다. `now` = `YYYY-MM-DDT00:00:00+09:00`(KST 자정).

| 시점 | `nextStruggleEvent` | **mini 헤드라인** | **full 헤드라인** | 일치 | 색 | 격자 |
|------|--------------------|--------------------|--------------------|------|-----|------|
| **2026-08-18** | 8/28 major | `8/28 총력투쟁 결의대회` **D-10** | `8월 28일 총력투쟁 결의대회` **D-10** | ✓ | 남색 `text-primary` | 3행, 8/18 today · 8/28 남 · 9/4 **적** |
| **2026-08-28** (당일) | 8/28 major | `8/28 …` **오늘** | `8월 28일 …` **오늘** | ✓ | 남색 | 2행, 8/28 남+**흰 아웃라인**, 9/4 적 D-7 |
| **2026-08-29** (전이) | **9/4 peak** | `9/4 총파업` **D-6** | `9월 4일 총파업` **D-6** | ✓ | **적색 `text-urgent-strong`** | 2행, 8/29 today, 9/4 적 |
| **2026-09-04** (당일) | 9/4 peak | `9/4 총파업` **오늘** | `9월 4일 총파업` **오늘** | ✓ | 적색 | 1행, 9/4 적+흰 아웃라인 |
| **2026-09-05** | **null** | **미렌더** | **미렌더** | ✓ | — | — |

- **전 시점에서 메인·상세의 D-n 문자열이 동일**하다. 시각 표기 형식만 `8/28` vs `8월 28일` 로
  다르며, mini 의 `sr-only` 는 긴 형식(`8월 28일 총력투쟁 결의대회`)을 그대로 준다(§19.4.3).
- 8/28 → 8/29 전이에서 대상이 자동으로 총파업으로 넘어가고 **색이 남색 → 적색**으로 바뀐다.
  숫자만 보면 `오늘` → `D-6` 으로 커지지만 이름·색 2중으로 "다른 일정"이 읽힌다(§19.3.4).
- **격자의 9/4 셀은 전 상태에서 적색(peak) 불변** — 헤드라인만 대상을 옮긴다(§19.9-8).
- mini `caption` 은 전 시점에서 `26년 임단협 투쟁 일정 달력입니다. …` 로 시작하고 `sr-only`,
  full 은 시각 노출(`text-caption text-ink-muted`)이다.

### §20.4 폭·배치 실측 (Chromium/Playwright, 실제 페이지)

**핵심 확인 — 셀 폭 동일성 (360px)**

| 페이지 | 카드 패딩 | **셀 폭** | 셀 높이 | 행 수 | 줄바꿈 | 라벨 넘침 |
|--------|-----------|-----------|---------|-------|--------|-----------|
| 메인 `/` (mini) | **12px** | **39.42px** | **44px** | 3 | 0 | 0 |
| 상세 `/bargaining-2026` (full) | **12px** | **39.42px** | 56px | 3 | 0 | 0 |

**셀 폭이 소수점까지 완전히 일치**한다(§19.9-3 통과). 카드 패딩도 양쪽 12px 로 동일(§19.9-2).
"미니"가 줄인 것은 **셀 높이(56→44px)뿐**이고 폭·행 수·정보량은 그대로다.

**md+ 2열 배치**

| 뷰포트 | 카드 display | 좌열 | 표열 | 셀 폭 | 셀 높이 | 카드 높이 | 줄바꿈 | 문서 가로 스크롤 |
|--------|--------------|------|------|-------|---------|-----------|--------|------------------|
| 768px | `grid` | **192px**(12rem) | **440px** | **54.85px** (스펙 54.86) | 56px | **270.5px** (스펙 ≈271) | 0 | 없음 |
| 1280px | `grid` | 192px | **632px** | **82.28px** (스펙 82.29) | 56px | 270.5px | 0 | 없음 |

헤드라인 `D-10` 은 md+ **36px**(`text-h1`) 1줄, 색 `rgb(9,51,137)`=#093389. 360px 은 28px.
인접 블록 간격은 1280px 실측 **앞 40px / 뒤 40px**(§19.2.1 md+ 값과 일치).

**메인 블록 순서·접근성 (360px 실측)**

- 도입 블록 순서: `section[주요 소식]`(히어로) → **미니달력 래퍼** → 온누리 카드 → 섹션 내비.
  ※ `DeadlineStrip` 은 이 환경에서 **API 미설정이라 조건부로 미렌더**됐다. JSX 상 위치는
  히어로와 미니달력 **사이**이며, 데이터가 있는 환경에서의 순서 확인은 QA 몫이다.
- 미니달력 안 헤딩 **0개**. 페이지 헤딩 아웃라인은 `h1 지부명 → h2×4(공지·소식·교육·방명록)`
  으로 **종전과 동일**(§19.9-11).
- 표 안 포커스 가능 요소 **0개**, 블록 내 링크는 `/bargaining-2026` **1개**(높이 44px = `min-h-touch`).
- `caption` computed `position: absolute`(sr-only) — 시각 미노출, SR 전문 제공.
- 콘솔 **에러 0**(CSS preload 경고 2건은 이번 변경과 무관한 기존 Next 경고).
- 360px·768px 스크린샷 육안 확인 완료 — 모바일은 헤드라인 가로 배치, md+ 는 좌측 열
  (일정명/D-10/자세히 보기) + 우측 격자 2열로 정상 렌더된다.

### §20.5 상세 페이지 회귀

| 항목 | 결과 |
|------|------|
| 헤드라인 | `9월 4일 총파업 D-17`(적색) → **`8월 28일 총력투쟁 결의대회 D-10`(남색 #093389, 40px)** — 의도된 유일한 변경(§19.3) |
| 셀 폭·높이·행 수 | 39.42px / 56px / 3행 — **변화 0** |
| 격자 셀 색 | 8/28 남색 · 9/4 **적색** — **변화 0** |
| 상세 카드 `meta`·`detail` | `8/28 D-10 총력투쟁 결의대회 서울 여의도 · 저녁 총파업 D-7 집회입니다.` / `9/4 D-17 총파업 종일 집결 장소와 시간은 지부 공지로 별도 안내합니다.` — **문자열 변화 0**(§19.9-17) |
| `DateBadge` variant | `level` 기준 그대로(8/28 emphasis · 9/4 imminent) — 카드 D-n 은 **각 일정의 D-n** 유지 |

DOM 상 추가된 것: 헤드라인 2개 `<p>` 를 감싸는 `<div>` 1개(레이아웃 영향 0 — 블록 안 블록).
`whitespace-nowrap`·`p-3 md:p-6`·`table-fixed` 는 전부 유지했다.

### §20.6 검증 명령 결과

| 명령 | 결과 |
|------|------|
| `npm run build` | **통과** — 8 페이지, `/` 와 `/bargaining-2026` 모두 Revalidate `1m` 유지 |
| `npx tsc --noEmit` (build 이후) | **통과, exit 0** |
| `npm run lint` | **통과, exit 0** |

임시 라우트·스크린샷·`.playwright-mcp`·`.next` 전부 삭제 후 클린 재빌드로 잔존 0 확인
(라우트 8개, `git status` 에 임시 파일 없음). **`any`·근거 없는 캐스팅 0** — 일정 선택 함수는
`<T extends DatedEvent>` 제네릭이라 `ScheduleItem`·`CalendarEvent` 양쪽이 캐스팅 없이 통과한다.

### §20.7 QA 인계 — 내가 검증하지 못한 것

- **`DeadlineStrip` 이 있는 상태의 배치·구별(§19.2.3 · §19.9-13)** — 이 환경은 API 미설정이라
  스트립이 렌더되지 않았다. 스트립과 미니달력이 세로로 붙었을 때의 시각 구별(면·radius·형태)은
  데이터가 있는 환경에서 봐야 한다.
- **히어로 모드 1(urgent 공지 존재)에서의 진입점(§19.9-10)** — 링크의 렌더 조건은 히어로 모드와
  **무관**하므로 구조상 항상 도달 가능하지만, 실제 urgent 공지가 있는 화면은 확인하지 못했다.
- **텍스트 전용 확대 200% (§19.9-16)** — mini 셀 44px 는 full 56px 보다 세로 여유가 적다.
  브라우저 텍스트 전용 확대 실측 미수행.
- **스크린리더 실행** — 낭독 문자열이 DOM 에 있음은 확인했으나 NVDA/VoiceOver 에서 표 2개
  (마감 스트립은 표가 아님)와 `aria-label` 영역이 실제로 어떻게 훑히는지는 미확인.
- **키보드 Tab 순서 실주행** — 표 안 포커스 요소 0개·링크 1개는 실측했으나 히어로 CTA →
  스트립 → 미니달력 링크 → 온누리 순서의 실제 이동은 미확인.
- **`revalidate=60` 런타임 동작** — 빌드 산출물의 `1m` 표기까지만 확인했다.
- **문안 게이트(§19.8.1)** — 새로 노출되는 4개 문자열은 리더·fact-verifier 확인 대상이다.

### §20.8 모바일 순서 수정 — 링크를 격자 뒤로 (리더 판정 2026-08-18)

§20.2 에서 보고한 판단 요청에 리더가 답했다: **모바일은 헤드라인 → 격자 → 링크**,
**md+ 좌측 열 배치(헤드라인 + 링크)는 유지**. 반영했다.

#### 구현 방식 — `order` 를 쓰지 않았다

`order` 로 시각 순서만 바꾸면 Tab 순서·스크린리더 낭독이 DOM 순서를 따라가
**보이는 것과 다른 순서로 읽힌다**(리더 요구 1). 그래서 **DOM 순서 자체를
`헤드라인 → 격자 → 링크` 로 바꾸고**, md+ 에서만 명시적 그리드 배치로 링크를 좌측 열에 되돌렸다.

| 요소 | 클래스 |
|------|--------|
| 카드 | `md:grid md:grid-cols-[12rem_1fr] **md:grid-rows-[auto_1fr]** md:gap-x-6 md:items-start` |
| 헤드라인 | `flex flex-wrap items-baseline gap-2 **md:col-start-1 md:row-start-1** md:block` |
| 격자 | `mt-4 **md:col-start-2 md:row-span-2 md:row-start-1** md:mt-0` |
| 링크 | `mt-3 **md:col-start-1 md:row-start-2** md:mt-4` |

- 세로 gap 을 0(`gap-x-6` 만)으로 두어 링크가 헤드라인 **바로 아래 16px**(`md:mt-4`)에 온다 —
  수정 전 좌측 열 모양과 동일하다.
- 격자가 2행을 `row-span` 하므로 카드 높이는 **격자가 정한다**(좌측 열이 짧아도 늘어나지 않음).
- **DOM 순서와 시각 순서가 어긋나는 곳은 없다**(아래 실측). 요구 1 은 "어긋나면 보고하라"였고,
  어긋나지 않게 구현했으므로 보고할 예외가 없다.

#### 재실측 (Chromium, 실제 메인페이지)

| 뷰포트 | 카드 display | **DOM↔시각 순서** | 시각 배치 | **카드 높이** | 셀 폭 | 셀 높이 | 줄바꿈 | 가로 스크롤 |
|--------|--------------|-------------------|-----------|---------------|-------|---------|--------|-------------|
| **360px** | `block` | **일치** | 헤드라인(348.1) → 격자(403.1) → **링크(589.6)** | 309.5px | 37.28px | 44px | 0 | 없음 |
| **768px** | `grid` | **일치** | 헤드라인(top 508.2, left 56) · 격자(top 508.2, left 272) · 링크(top 593.9, **left 56**) | **270.5px** | 52.71px | 56px | 0 | 없음 |
| **1280px** | `grid` | **일치** | 동일 구조 | **270.5px** | 82.28px | 56px | 0 | 없음 |

- **md+ 카드 높이 270.5px 유지 확인** — 스펙 §19.4.2 예산 ≈271px 그대로다(리더 요구 2 충족).
- md+ 에서 헤드라인과 링크의 `left` 가 **둘 다 56px(768px 기준)로 동일** = 같은 좌측 열,
  둘 사이 간격 **16px** — 수정 전과 같다.
- 360px 카드 높이 309.5px 는 §19.4.2 모바일 예산 ≈305.5px 대비 +4px 로, 헤드라인 D-n 의
  `mt-1`(4px)이 가로 배치에서 더해진 값이다. 스펙이 `≈` 로 준 값이라 이탈로 보지 않는다.
- 768/1280px 셀 폭이 §20.4 표(54.85/82.28)와 다른 것은 이 회차 측정 환경에 **클래식
  스크롤바(15px)가 잡혀** 뷰포트 유효폭이 753px 였기 때문이다. 기하는 동일하며 라벨 최대
  폭(36.98px) 대비 여유가 15.7px 이상이라 안전 구간이다.
- 360px 스크린샷 육안 확인 — `8/28 총력투쟁 결의대회 D-10` → 격자 3행 → `자세히 보기 →` 순.

#### 상세 페이지(full) 회귀 재확인

카드 직계 자식 `[div(헤드라인), table]`, 카드 내 링크 **0개**, 헤드라인
`8월 28일 총력투쟁 결의대회 / D-10 / rgb(9,51,137) / 40px`, 셀 37.28px·56px·3행,
줄바꿈 0, `caption` `position: static`(시각 노출), 상세 카드 `meta`·`detail` 문자열 변화 0.
**같은 측정 환경에서 mini 셀 폭 37.28px = full 셀 폭 37.28px** — 폭 동일성도 유지된다.

#### 검증 명령 (재실행)

| 명령 | 결과 |
|------|------|
| `npm run build` | **통과** — 8 페이지, `/`·`/bargaining-2026` Revalidate `1m` 유지 |
| `npx tsc --noEmit` (build 이후) | **통과, exit 0** |
| `npm run lint` | **통과, exit 0** |

임시 라우트·스크린샷·`.playwright-mcp`·`.next` 삭제 후 클린 재빌드로 잔존 0 확인.
D-day 계산 로직(`futureEventsInOrder`·헤드라인 대상·색)은 **한 줄도 건드리지 않았고**,
라이브 시점에서 메인·상세 모두 `D-10`·남색으로 일치함을 재확인했다.
§20.7 의 QA 미검증 항목은 그대로 유효하다.

### §20.9 재확인 — §20.8 반영 상태 (리더 재지시 대응, 2026-08-18)

리더가 "모바일 순서 수정이 반영되지 않았다(`StruggleCalendar.tsx:248-261` 에 링크가
`<table>` 앞)"고 재지시했다. **확인 결과 수정은 이미 작업 트리에 반영돼 있었다** —
리더가 §20.8 적용 **직전 상태**를 읽은 것으로 보인다(당시 그 라인 범위가 링크 블록이었다).
재작업 없이 현재 코드로 전 항목을 다시 실측했고, 리더가 지적한 **§20.2 본문 갱신**은 수행했다.

**현재 코드 위치 (재지시 시점 파일)**

| 항목 | 위치·값 |
|------|---------|
| `</table>` | 358행 |
| `자세히 보기` 링크 `<p>` | **370행 — 격자 뒤** |
| 카드 grid | 140행 `md:grid-cols-[12rem_1fr] md:grid-rows-[auto_1fr] md:gap-x-6` |
| 격자 배치 | 146행 `md:col-start-2 md:row-span-2 md:row-start-1` |
| 링크 배치 | 370행 `mt-3 md:col-start-1 md:row-start-2 md:mt-4` |
| `order-*` 클래스 | **0건** (의도적 미사용 — DOM 순서를 직접 바꿨다) |

**서버 렌더 HTML 검증** (`curl` → offset 비교): `</table>` offset 6752 < 링크 offset 7058
→ **링크가 격자 뒤**임이 마크업 수준에서 확인된다.

**재실측 (클린 빌드 후, 실제 메인페이지)**

| 뷰포트 | display | DOM 순서 | 시각 순서 | **일치** | **카드 높이** | 셀 폭 | 셀 높이 | 줄바꿈 | 가로 스크롤 |
|--------|---------|----------|-----------|----------|---------------|-------|---------|--------|-------------|
| **360px** | block | 헤드라인 → 격자 → 링크 | top 348.1 → 403.1 → **589.6** | **✓** | 309.5px | 37.28px | 44px | 0 | 없음(345=345) |
| **768px** | grid | 헤드라인 → 격자 → 링크 | (508.2,56) · (508.2,272) · **(593.9,56)** | **✓** | **270.5px** | 52.71px | 56px | 0 | 없음(753=753) |
| **1280px** | grid | 헤드라인 → 격자 → 링크 | (440.3,208.5) · (440.3,424.5) · **(526,208.5)** | **✓** | **270.5px** | 82.28px | 56px | 0 | 없음(1265=1265) |

- **md+ 카드 높이 270.5px 유지**(스펙 §19.4.2 예산 ≈271px) — 리더 요구 2 충족.
- md+ 에서 헤드라인과 링크의 `left` 가 동일(같은 좌측 열), 간격 **16px**.
- **DOM 순서 = 시각 순서**이므로 Tab 순서·SR 낭독이 보이는 순서와 어긋나지 않는다.
  요구 1 의 "불가피하게 어긋나는 경우"에 해당하지 않으며, 보고할 예외 없음.

**검증 명령 (재실행)**: `npm run build` 통과 · `npx tsc --noEmit` **exit 0** ·
`npm run lint` **exit 0**. 임시 산출물 0, `.next` 삭제 후 클린 재빌드.

**문서 정리**: §20.2 의 "(a)의 부수 효과로 모바일 순서가 헤드라인 → 링크 → 격자가 된다"
문단에 **취소선 + 리더 판정 결과**를 병기했다. 다음 사람이 현재 코드와 다른 설명을 읽지 않는다.

### §20.10 Q2 반영 — `weeks.length === 0` 가드 (QA 17회차 권고, 2026-08-18)

`StruggleCalendar.tsx:221` 에 `if (weeks.length === 0) return null;` 추가. **변경은 이 1줄 + 주석뿐**이며
다른 파일 변경 0.

#### 실패 경로 실측 — 지적된 크래시 지점과 실제가 다르다 ⚠️

권고문은 "무효한 `now` 가 주입되면 `weeks[0]` 접근에서 크래시한다"였다. **node 로 각 단계를
실행해 확인한 결과, 무효한 `now` 는 `weeks[0]` 에 닿기 전에 더 앞에서 던진다.**

| 단계 | 실측 결과 |
|------|-----------|
| `new Date("nonsense").getTime()` | `NaN` (Invalid Date) |
| `Intl.DateTimeFormat.formatToParts(InvalidDate)` | **`RangeError: Invalid time value` 를 던진다** |
| `Date.parse("")` | `NaN` |
| `Math.round((NaN - …)/86400000) + 1` | `NaN` |
| `for (let o = 0; o < NaN; o += 7)` | **0회 반복** → `weeks === []` |
| `weeks[0].map(...)` | `TypeError: Cannot read properties of undefined (reading 'map')` |

즉 무효한 `now` 의 실제 크래시 지점은 `futureEventsInOrder` → `daysUntilKst` 안의
`formatToParts`(**`RangeError`**)이고, `weeks[0]` 의 `TypeError` 는 그보다 뒤다.
`daysUntilKst` 는 대상 날짜의 유효성만 검사하고 `now` 는 검사하지 않는다.

**그래서 이 가드는 "현재 버그를 고치는 코드"가 아니라 구조적 방어다.** 다만 넣을 값어치는 있다:
위 `RangeError` 에 `null` 반환 가드를 붙이는 것이 그 예외의 **자연스러운 수정 방향**인데,
그렇게 고치는 순간 `start`/`end` 가 빈 문자열로 흘러 `weeks === []` 경로가 **곧바로 살아난다.**
호출부가 메인·상세 2곳으로 늘어 노출면이 커진 상황이라 남겨 두는 편이 맞다.
이 사실관계와 발생 조건을 **코드 주석에 그대로 적었다** — 근거 없는 방어 코드로 보여 다음 사람이
지우는 것을 막기 위해서다. `null` 반환 규약은 §18.7 상태 E 와 동일하다.

#### 정상 경로 렌더 불변 — 산출물 바이트 비교

가드 **있는 빌드**와 **없는 빌드**로 같은 임시 라우트(8/18·8/29·9/5 × mini·full)를 각각
프리렌더해 HTML 을 비교했다.

| 항목 | 결과 |
|------|------|
| `<main>` 이하 마크업 길이 | 22,748 / 22,748 |
| `<main>` 이하 sha256 | `c95da3cb66b727cc…` / `c95da3cb66b727cc…` — **완전 동일** |
| 전체 파일 유일한 차이 | Next 의 **랜덤 빌드 ID**(`"b":"ZI5F…"` vs `"N6VV…"`) 1곳뿐. 청크 파일명 집합도 동일 |

→ **8/18·8/29·9/5 세 시점의 렌더 결과가 가드 도입 전후로 바이트 단위 동일**하다.
정상 경로에서 `weeks.length` 는 1~3 이므로 가드가 발동하지 않는다(현 데이터에서 `weeks` 가
비는 경우는 없어야 하고, 빈다면 그건 상위 계산의 버그라는 권고문 판단에 동의한다).

#### 검증 명령

| 명령 | 결과 |
|------|------|
| `npm run build` | **통과** — 8 페이지, `/`·`/bargaining-2026` Revalidate `1m` 유지 |
| `npx tsc --noEmit` (build 이후) | **통과, exit 0** |
| `npm run lint` | **통과, exit 0** |

임시 라우트·비교용 HTML 전부 삭제 후 클린 재빌드로 잔존 0 확인.

### §20.11 임시 라우트 삭제 확인 (커밋 직전 관문, 2026-08-18)

§20.10 의 가드 전후 렌더 비교를 위해 `src/app/calendar-preview-tmp/` 를 만들었고
비교 직후 삭제했다. 리더가 본 "정적 페이지 9개"는 **A/B 두 번의 빌드가 도는 검증 진행 중
시점**의 상태다(그 라우트가 존재해야 두 빌드의 HTML 을 비교할 수 있다).

**최종 확인 (지금 실행, 클린 재빌드 기준)**

| 항목 | 결과 |
|------|------|
| `src/app/calendar-preview-tmp/` | **없음** |
| `.next` 삭제 후 재빌드 정적 페이지 | **`Generating static pages (8/8)`** — 8개 복귀 |
| 라우트 목록 | `/` · `/_not-found` · `/admin` · `/apple-icon.png` · `/bargaining-2026` · `/education/[id]` · `/icon.png` · `/news/[id]` · `/notices/[id]` — **검증용 라우트 0건** |
| `src/app/**/page.tsx` 전수 | `admin` · `bargaining-2026` · `education/[id]` · `news/[id]` · `notices/[id]` · `page.tsx` **6개뿐** |
| `git status --untracked-files=all` 의 `tmp`/`preview` | **0건** |
| `git ls-files --others --exclude-standard` 의 `tmp`/`preview` | **0건** |
| untracked 신규 파일 | `src/lib/struggleSchedule.ts` **1개뿐**(§19.3.3 정식 산출물) |
| `npx tsc --noEmit` / `npm run lint` | **exit 0 / exit 0** |

**재발 방지 메모**: 검증용 라우트는 `src/app/` 아래에 두면 존재하는 동안 실제 URL 이 된다.
다음에 같은 검증이 필요하면 **작업 시작·종료를 리더에게 알리거나**, 라우트 대신
`src/app/` 밖에서 `renderToStaticMarkup` 으로 렌더하는 방법을 검토한다
(현 프로젝트에는 TSX 러너가 없어 이번에는 라우트 방식을 썼다).

---

## §21. 8/28 결의대회 참석 안내 페이지 + 지도 + 진입 블록 + 온누리 주소 (2026-08-18)

**입력**: 스펙 `02_designer_spec.md` §20 전문(문안 게이트 §20.10 = 리더 확정본) ·
검증 `01_verifier_factcheck.md` 검증 리포트(4회차, 조건부 승인 — §7 수정 요구 11건 전부 이행) ·
원문 `00_input/content-rally-20260828.md`.

**스펙 이탈**: 4건(전부 §20 이 명시한 해결 수단 또는 실측 근거). §21.6 에 사유와 함께 전건 기록.

### §21.1 구현 범위 (파일 12개 — 스펙 §20.5 목록 + 타입 선언 1)

| # | 파일 | 작업 | 비고 |
|---|------|------|------|
| 1 | `src/lib/routes.ts` | `ROUTES.rally0828` · `ONNURI_GUIDE_DISPLAY_HOST` 추가 | 주소는 `EXTERNAL_LINKS.onnuriGuide` 에서 `new URL(...).host` 로 파생(§20.12.6) |
| 2 | `src/lib/rally.ts` | **신규** — `RALLY_DATE` · `rallyPhase(now)` · `STRUGGLE_SCHEDULE` 단일 출처 가드 | 날짜 두 벌 방지. 무효 입력은 `upcoming` |
| 3 | `src/lib/rallyMap.ts` | **신규** — 좌표·bbox·반경·라벨·거리 문구 | 검증 절 번호 주석. 컴포넌트에 좌표 리터럴 0 |
| 4 | `src/lib/naverMaps.ts` | **신규** — 네이버 지도 v3 타입 선언(값 0, 번들 영향 0) | `any`·무근거 캐스팅 0 |
| 5 | `src/components/home/RallyEntryCard.tsx` | **신규** — 메인 진입 블록 | 서버 컴포넌트. `phase` 를 받는다 |
| 6 | `src/components/rally/RallyStatus.tsx` | **신규** — 상태 배지 + past 문장 상수 | 메인·상세가 같은 배지를 쓴다 |
| 7 | `src/components/rally/RallyMap.tsx` | **신규 · `"use client"`** | 이 작업의 **유일한** 클라이언트 컴포넌트 |
| 8 | `src/components/rally/RallySchedule.tsx` | **신규** — 식순 16행 | 데이터 상수 동거 |
| 9 | `src/app/rally-2026-08-28/page.tsx` | **신규** — 페이지 전체, `revalidate = 60`, metadata | 서버 컴포넌트 |
| 10 | `src/app/page.tsx` | 미니달력 아래 진입 블록 1개 추가 | **+14 / −0**. 기존 블록 변경 0 |
| 11 | `src/app/bargaining-2026/page.tsx` | 8/28 카드에만 링크 1개 | **+21 / −1**(−1 은 import 행 교체). 문자열 변경 0 |
| 12 | `src/components/home/OnnuriGuideCard.tsx` | 주소 줄 1개 추가 | 기존 2줄 문구·클래스 diff 0 |
| 13 | `src/components/ui/icons.tsx` | `ArrowLeftIcon` 추가 | §16.15.5 규격 그대로 |
| 14 | `Dockerfile` · `deploy/web/docker-compose.yml` | `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` ARG/ENV/build.args | 빌드타임 임베드(선례: `NEXT_PUBLIC_API_BASE_URL`) |

**손대지 않은 파일 (diff 0줄 실측)**: `globals.css` · `HeroPanel` · `DeadlineStrip` ·
`StruggleCalendar` · `struggleSchedule.ts` · `SiteFooter` — `git diff HEAD --numstat` 전건 0.

### §21.2 지도 구현의 기술적 결정

| 판단 | 결정 | 근거 |
|------|------|------|
| 스크립트 URL | `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=…` | 3개 후보 URL 을 실제로 `curl` 해 200 + 유효 JS 확인. 현행 NCP 문서 형식 |
| 인증 실패 감지 | `window.navermap_authFailure` 전역 콜백 등록 → `failed` | **이것이 없으면 Client ID 가 틀렸을 때 빈 지도가 남는다.** 포트 3100(미등록 서비스 URL)에서 401 을 실제로 발생시켜 대체면 전환을 확인했다 |
| 타입 | `src/lib/naverMaps.ts` 에 쓰는 API 만 선언 | `window.naver` 를 **optional** 로 선언해 존재 검사를 강제한다 |
| 라벨 배치 | 0폭 앵커 `div` + 절대배치 자식 | Naver 마커 `anchor` 는 콘텐츠 크기를 알아야 해서 가변폭 라벨에 못 쓴다. 0폭 앵커면 `left/right/transform` 으로 정확히 붙는다 |
| 라벨 최대폭 | CSS 변수 `--rally-label-max` 를 마운트 노드에 세팅 | 0폭 컨테이닝 블록 안에서 `max-width:60%` 는 0 으로 해석된다. 리사이즈 시 **마커 재생성 없이** 값만 갱신한다 |
| 원의 bounds | `rallyMap.ts` 에서 반경 → 위경도 델타로 파생 | `Circle` 은 bounds 를 주지 않는다. 지오데식 상수(111,320 m/도) + `cos(lat)` 보정. **새 좌표가 아니라 EXIT5 파생값** |
| 정리 시점 | 생성 effect 와 `destroy` 를 **같은 effect** 에 둠 | 분리하면 StrictMode 재마운트에서 파괴만 되고 재생성되지 않아 빈 박스가 남는다 |

### §21.3 실측 — 지도 (프로덕션 빌드 + `next start`, 실브라우저)

**⚠ 로컬 확인은 반드시 포트 3000 에서 하라.** NCP 에 등록된 서비스 URL 이 `localhost:3000` 이라
**3100 으로 띄우면 인증 401 이 나고 지도가 뜨지 않는다**(실측). 이때 대체면이 정상 동작하므로
"실패 경로 실측"을 겸할 수 있다.

| 뷰포트 | 지도 박스 | zoom | ① 라벨 | ② 라벨 | ③ 라벨 | 박스 밖 잘림 | 가로 스크롤 |
|--------|-----------|------|--------|--------|--------|--------------|-------------|
| 360px | **328×246**(4:3) | 15 | 171–267 / 78–110 · **1행** | 7–155 / 154–186 · **1행** | 73–237 / 31–65 · **1행** | **0** | 없음(360=360) |
| 768px | **704×396**(16:9) | 16 | 351–447 | 203–351 | 253–417 | **0** | 없음 |
| 1280px | **896×504**(16:9) | 16 | 439–535 | 291–439 | 341–505 | **0** | 없음 |

- ① 도트 중심과 ③ 점선 원의 bbox 중심이 **픽셀 단위로 일치**(360px: 둘 다 (155,94) / 1280px: 둘 다 (423,186)).
- 원 지름 42px@z15 · 84px@z16 → 각각 0.2625 / 0.525 px/m — 반경 80m 와 정합.
- 마커 3개뿐. LED무대·화장실 핀·도로 하이라이트 **0건**. 위성/하이브리드 전환 UI **0건**, 확대 버튼 0건.
- `scaleControl` · NAVER 로고 · `© NAVER Corp.` 표기 유지(이용약관).

**비인터랙티브 실측** — 지도 위에서 wheel / mousedown→mousemove→mouseup / dblclick 을 발생시킨 뒤
① 도트의 화면 좌표가 **변하지 않음**(before == after). `wheel`·`touchstart` 모두 `defaultPrevented === false`,
마운트 노드 `touch-action: auto` → **모바일 한 손가락 드래그로 페이지가 정상 스크롤된다.**

**포커스 정지점**: 지도 안에 남는 것은 네이버 `legal.html` · `더보기` · OpenStreetMap 저작권 링크뿐.

### §21.4 실측 — 페이지·진입 블록·온누리 카드

| 항목 | 결과 |
|------|------|
| 헤딩 아웃라인 | `h1` → `h2`×5(집결/위치/지도/무대·출석·화장실/식순) → `h3`×3(무대·출석·화장실 카드) |
| 식순표 시간 열 | 360px **112px · 16행 전부 1행** · 가로 넘침 0 / 768px **140px · 전부 1행** |
| `※ 상황에 따라 식순 변경 가능` | **2회**(`<caption>` + 표 아래 `<p>`) |
| 인명 | `윤석구 금융노조 위원장` · `김동명 한국노총 위원장` — 소속 없는 단독 표기 **0건** |
| 금지 문자열 | `우측 도로`·`528세대`·`열렸`·`개최`·`성황`·`QR이 배포됩니다` **전건 0회** |
| 유보 표현 | `설치될 예정`·`배포할 예정`·`각 지부별 대오 논의`·`(설치 예정)` **전건 유지** |
| `18:30` | `text-hero` 40px(360) / `text-hero-lg` 64px(768+) — 페이지 유일 대형 수치. `18:00` 은 식순표 안에만 |
| `<time>` | `datetime="2026-08-28T18:30:00+09:00"` (DOM 속성 확인) · `sr-only` `오후 6시 30분` |
| 무대·출석·화장실 | 360px 세로 3장 / 768px **3열 동일 top(2107px)** |
| 진입 블록(360, upcoming) | 높이 **209px** · 표제 2행 · 요약 **1행** · 테두리 `2px #093389` · **`box-shadow: none`**(테두리 단독) · CTA 44px |
| 진입 블록 기타 | D-n **없음** · `h2/h3` **없음** · 인터랙티브 요소 **1개** |
| 링크 라벨 ↔ 목적지 | 메인 `자세히 보기`×2 → 전부 `/bargaining-2026`, `참석 안내 보기`×1 → `/rally-2026-08-28` · 상세 페이지 `참석 안내 보기`×1(8/28 카드에만, 9/4 카드에는 없음) |
| 온누리 카드 | **3줄** · 3번째 줄 `onnuri.koscomlabor.cloud`(`https://`·끝 슬래시 없음) · 360px 높이 **146px**(스펙 예측 146.09px) · 1줄 온전 · 접근성 이름 = `디지털온누리 사용 가이드 코스콤 조합원 대상 안내 · 외부 페이지가 새 창에서 열립니다`(**주소 미포함 — 종전과 동일**) |

**스크린리더 트리(진입 블록)**: `region "결의대회 참석 안내"` → 문단 3 + `link "참석 안내 보기"` — 스펙 §20.9 예상과 일치.

### §21.5 실측 — 상태 전이 · 미설정 빌드

`now` 주입은 **저장소 밖 스크래치패드의 `--require` 프리로드**로 프로세스 시계를 이동시켜 수행했다.
**`src/app/` 아래에 검증용 라우트를 만들지 않았다**(§20.11 재발 방지 메모 이행).

| 주입 날짜 | 상세 페이지 | 메인 진입 블록 | 콘텐츠 |
|-----------|-------------|----------------|--------|
| 2026-08-27 | 배지 없음 · past 문장 없음 | 배지 없음 · `border-primary` · 채움 버튼 | 전부 표시 |
| 2026-08-28 | **`오늘` 칩** | **`오늘` 칩** · `border-primary` · 채움 버튼 | 전부 표시 |
| 2026-08-29 | **`완료` 배지 + `2026년 8월 28일 일정이 지났습니다. 아래 안내는 기록으로 남겨 둡니다.`** | **`완료` 배지** · `border-border-strong` · **텍스트 링크** | 지도·식순표·화장실 **전부 그대로** |
| 2026-09-05 | 위와 동일 | 위와 동일 | 미니달력만 사라지고 **진입 블록은 남음**. 감싸는 `div.mt-8 md:mt-10` **1개**(여백 겹침 0) |

- 전 시점에서 사용자 지정 문구 `8/28(금) 저녁 결의대회 참석 안내` **불변**, `line-through` **0건**.
- 전 시점에서 `열렸`·`개최`·`성황` **0건**.

**Client ID 미설정 빌드**(`.env.local` 제거 후 클린 빌드): `<figure>`·`위치 지도` `h2`·네이버 스크립트가
**전부 사라지고 오류 문구도 없다.** 블록 2 의 위치 텍스트·320m·나머지 블록은 그대로. 빌드 로그에
`console.warn` **1회**.

**로드 실패 경로**(포트 3100 = 미등록 서비스 URL → 401): 대체면 + **요약 3줄**이 표시됨.
SSR HTML 에도 대체면 문자열이 **초기 DOM 으로 존재**(JS 차단 시 그대로 보인다).

### §21.6 스펙 이탈 4건 — 전부 실측 근거

| # | 스펙 | 실제 구현 | 사유 |
|---|------|-----------|------|
| 1 | §20.4.3 `fitBounds` padding `left: 24` | **`left: 56`** | 360px 실측에서 ② 라벨이 왼쪽으로 **8px 잘렸다**. §20.4.2 가 정한 해결 수단("넘치면 padding 을 키워 해결하고 **라벨 문자열은 줄이지 마라**") 그대로 적용. 문자열 변경 0 |
| 2 | §20.4.2 라벨 `max-width` 만 지정 | `width: max-content` **추가** | 0폭 앵커 안에서는 절대배치 요소의 shrink-to-fit 가용폭이 0 으로 계산돼 라벨이 **min-content 로 접힌다**(실측: `① 5번 출구` 2행, `③ 메인무대(설치 예정)` **3행 + 상단 4px 잘림**). 추가 후 세 라벨 모두 1행·잘림 0 |
| 3 | §20.3.6 시간 셀 `whitespace-nowrap` | nowrap 제거 + `~` 뒤 **`<wbr>`** | nowrap 유지 시 **텍스트 확대 200%** 에서 시간 문자열이 169px 이 되어 **내용 열 위에 겹쳐 찍힌다**(실측). `<wbr>` 는 기본 크기에서 **쓰이지 않는다** — 16행 전부 1행 유지(실측). 200% 에서만 `18:00~`/`18:30` 로 갈라져 겹침 0 |
| 4 | §20.9 "지도 내부 포커스 정지점은 네이버 로고·저작권 링크뿐" | 마운트 노드의 `tabindex="0"` 을 **제거** | 네이버가 마운트 노드에 `tabindex="0"` 을 붙인다. 조작 컨트롤이 0개라 **접근성 이름도 할 일도 없는 빈 탭 정지점**이 된다. 제거해야 스펙이 기술한 상태가 된다. 네이버 링크의 포커스 표시는 **덮어쓰지 않았다** |

추가로 §20.4.5 의 **로딩 상태에도 요약 3줄을 함께 표시**했다(스펙 표는 실패 상태에만 3줄을 적었으나
대체면 마크업 자체가 3줄을 포함한다). 근거: **JS 가 차단되면 상태가 영원히 `loading` 에 머문다.**
그때 요약이 없으면 §0.4 위반이 된다.

### §21.7 미검증·후속 확인 필요

1. **실기기 터치 미검증.** 한 손가락 드래그로 페이지가 스크롤되는 것은 `touch-action: auto` +
   `wheel/touchstart` 비취소 + 지도 미이동으로 **간접 확인**했다. 실제 iOS/Android 확인 권고.
2. **프로덕션 도메인 인증 미검증.** 로컬은 `localhost:3000` 으로만 확인했다.
   `koscomlabor.cloud` 배포 후 지도가 실제로 뜨는지 **1회 육안 확인이 필요하다**(빌드타임 임베드라
   값이 안 들어가면 지도 블록이 조용히 사라진다).
3. **텍스트 확대 200% 에서 문서 가로 스크롤이 발생한다(394px vs 360px).** 원인은 **`SiteFooter` 의
   로고 이미지(`h-7 w-auto`)** 로, `/`·`/rally-2026-08-28` 양쪽에서 동일하게 재현되는 **기존 결함**이다.
   이번 범위(§20)가 아니라 손대지 않았다. **리더 판단 요청.**
4. **인용부호 표기가 자리마다 섞여 있다.** 스펙 원문을 그대로 옮긴 결과다 —
   블록 2 단서·범례 각주·지도 sr-only 는 곡선따옴표(“ ”), 화장실 2줄은 곧은따옴표(" ").
   통일하려면 **문안 게이트 수정이 필요하므로 리더·검증자 판정 사항**이다.
5. **`design/QR.png` + 원문 §6.4(QR 출석체크 안내)는 이번 구현 범위 밖이다.**
   작업 중 `00_input/content-rally-20260828.md` 에 §6.4 가 추가됐으나 스펙 §20 과 검증 4회차에
   해당 항목이 없어 **구현하지 않았다.** 게시하려면 스펙·검증이 선행돼야 한다.

### §21.8 검증 명령

| 명령 | 결과 |
|------|------|
| `npm run build`(클린, `.next` 삭제 후) | **통과** — 정적 9개. `/rally-2026-08-28` Revalidate `1m` |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `src/app/**/page.tsx` 전수 | 6개 + 신규 1개 = **7개**. 검증용 라우트 **0건** |
| `git ls-files --others` 의 tmp/preview/png/playwright 흔적 | **0건** |
| 보호 파일 `git diff HEAD --numstat` | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter` **전건 0줄** |

---

## §22. 지도 사양 변경 대비 리팩터링 (2026-08-18 · 리더 지시 반영)

**지시**(리더, §21 보고 직후): ① 대오 표시가 **건물 폴리곤 → 의사당대로 위 구간**으로 바뀐다
② 내 위치(Geolocation) 기능이 추가된다 ③ 도로 구간 좌표는 검증 중이니 **확정 전에 그리지 마라**
④ 좌표·기호를 한 곳에 모아 **교체가 1파일 수정으로 끝나게** 하라 ⑤ 페이지가 블록 하나를 더 받을 수
있게 열어 두라 ⑥ `design/QR.png` 를 **아직 `public/` 로 옮기지 마라**.

지도 외(페이지 본문·식순표·진입 블록·온누리 카드)는 §21 에서 완료됐고 **이번에 변경 0**이다.

### §22.1 무엇을 바꿨나 — "그릴 것"을 데이터로

`src/lib/rallyMap.ts` 가 이제 **좌표뿐 아니라 기호까지** 들고 있다. `RallyMap.tsx` 는 해석만 한다.

```ts
export type MapFeature = DotFeature | BlockFeature | CircleFeature | PathFeature;
export const MAP_FEATURES: readonly MapFeature[] = [ … ];   // 이 배열이 지도의 전부다
```

| 종류 | 의미 (근거의 종류로 기호를 정한다 — §20.0-5) | 현재 항목 |
|------|---------------------------------------------|-----------|
| `dot` | **확정 좌표 1개**만 아는 것 | ① 5번 출구 |
| `block` | **확정된 경계(bbox)** 가 있는 것 | ② 더샵아일랜드파크 |
| `circle` | 좌표가 없어 **범위로만** 아는 것 | ③ 메인무대(설치 예정) |
| `path` | **도로 위 구간** — 대오용 (리더 지시) | **0건** — 좌표 검증 중 |

**교체 절차 (1파일)**: `MAP_FEATURES` 의 항목을 고치거나 넣고 빼면 끝난다.
- 초기 화면 범위 `MAP_FIT_BOUNDS` 는 배열에서 **자동 계산**된다(손으로 적은 bbox 가 남아 실제 표시와
  어긋나는 사고를 막는다). 항목이 0건이 되면 5번 출구 200m 로 떨어져 크래시하지 않는다.
- 라벨 앵커도 `featureLabelAnchor()` 가 기호별 기본값을 준다(블록=서쪽 변 중앙 / 원=북쪽 끝 /
  선=가운데 꼭짓점). 필요하면 항목의 `labelAt` 으로만 덮어쓴다.
- 색은 **확정도(`confidence`) 하나로** 결정된다(`confirmed` = #093389 / `planned` = #4b5563 + 점선).
  **항목이 늘어도 새 색 결정이 없다.** 확정도를 색 단독으로 전달하지 않는 규칙(검증 §5-4-2)도
  타입에 붙여 두었다 — `planned` 항목의 라벨 텍스트에는 유보 표현이 들어가야 한다.

`RallyMap.tsx` 에서 사라진 것: 도형별 하드코딩 블록(사각형 2 + 원 2 + 마커 3 나열) →
`MAP_FEATURES.forEach` 1개 + `drawFeature()` 1개. **좌표 리터럴은 여전히 `rallyMap.ts` 밖에 0건.**

### §22.2 `path`(도로 위 구간) 렌더러 — 데이터는 0건, 렌더러는 검증됨

- 선은 굵어야 "구간"으로 읽히므로 **casing 14px / 본체 8px**(도형의 7/3 보다 두껍게),
  `strokeLineCap`·`strokeLineJoin` 은 `round` — 도로를 따라가는 인상을 만든다.
- **검증**: 임시 항목(가짜 좌표 3점, `TEMP-PATH-RENDER-TEST` 표식)을 넣고 빌드해 실브라우저에서
  흰 casing + 파란 본체 + 라벨이 정상 렌더됨을 육안 확인한 뒤 **즉시 제거**했다.
  제거 확인: 백업본과 **sha256 완전 일치**(`ba2f2fa5…`), 저장소 전체 grep 에서 표식·임시 좌표 **0건**,
  `MAP_FEATURES` 의 `kind` 는 `dot`·`block`·`circle` 3건뿐.
- **확정 좌표는 넣지 않았다.** 검증되지 않은 좌표가 코드에 남으면 조합원이 엉뚱한 곳에 선다.

### §22.3 회귀 — 렌더 결과 불변 (실측)

리팩터링 전후 360px 실측이 **완전히 같다.**

| 항목 | 리팩터링 전 | 리팩터링 후 |
|------|-------------|-------------|
| 지도 박스 | 328×246 | **328×246** |
| ① 라벨 | 171–267 / 78–110 | **171–267 / 78–110** |
| ② 라벨 | 7–155 / 154–186 | **7–155 / 154–186** |
| ③ 라벨 | 73–237 / 31–65 | **73–237 / 31–65** |
| ① 도트 중심 | (155, 94) | **(155, 94)** |
| 도형 path 수 | 4 | **4** |
| 라벨 박스 밖 잘림 · 가로 스크롤 | 0 · 없음 | **0 · 없음** |

`npm run build` 통과 · `npx tsc --noEmit` exit 0 · `npm run lint` exit 0.

### §22.4 블록 추가 여지 (출석 안내 대비)

페이지는 `<div class="mx-auto … max-w-page">` 아래 `<section aria-labelledby="…" class="mt-section
md:mt-section-lg">` 이 **평평하게 나열**된 구조다. 블록 추가는 `<section>` 1개를 원하는 자리에 끼우는
것으로 끝나며 다른 블록의 간격·헤딩 아웃라인에 영향이 없다(`h1` → `h2` 나열).

다만 **디자이너 판단이 필요한 지점**: 현재 `출석` 은 블록 4(무대·출석·화장실)의 L2 카드 1장이다.
출석 안내가 독립 블록이 되면 **그 카드를 어떻게 할지**(제거 / 요약 유지 + 링크)가 정해져야 한다.
개발 쪽에서 임의로 정하지 않는다.

### §22.5 Geolocation(내 위치) — 아직 손대지 않았다

디자이너가 UX 설계 중이라 코드 0줄이다. 설계에 반영돼야 할 **기술 제약**을 미리 남긴다:

1. **HTTPS 필수.** `geolocation` 은 보안 컨텍스트에서만 동작한다 — 프로덕션(`koscomlabor.cloud`)은
   문제없고 로컬은 `localhost` 예외로 동작한다.
2. **권한 거부·실패가 정상 경로다.** 거부/타임아웃/실내 오차 어느 경우든 **텍스트 안내가 그대로
   남아야** 한다(§0.4). "위치를 못 받으면 안내가 사라지는" 설계는 불가.
3. **비인터랙티브 지도와 충돌하는 지점**: 현재 지도는 `draggable:false` 라 **내 위치로 지도를 옮길 수
   없다.** 현 위치가 초기 화면 밖이면 마커를 찍어도 보이지 않는다. 설계 선택지는
   (a) 내 위치를 `fitBounds` 범위에 포함시켜 축소 — 집결지가 작아진다,
   (b) 지도는 그대로 두고 **"5번 출구까지 약 N m" 텍스트만** 제공 — 비인터랙티브 유지,
   (c) 내 위치 버튼을 누른 동안만 조작 허용 — §20.0-7 의 근거(모바일 스크롤 사고)를 다시 검토해야 함.
   **판정 요청 사항이며 개발이 고르지 않는다.**
4. 위치 정확도가 낮을 때 **원(정확도 반경)으로 표현**하면 이미 있는 `circle` 기호와 의미가 겹친다
   (③ = 주최측 설치 예정). 기호 체계 재설계 시 함께 정리가 필요하다.

### §22.6 유지된 사항

- `design/QR.png` 를 **`public/` 로 옮기지 않았다.** 게시 형식 판정 대기 중.
- 원문 §6.4(QR 출석체크 안내)는 스펙·검증 미완이라 **구현하지 않았다**(§21.7-5 그대로).
- §21 의 페이지 본문·식순표·진입 블록·온누리 카드 변경 **0**.

---

## §23. 지도 사양 확정 반영 — 대오 밴드 · 내 위치 · QR 출석 블록 (2026-08-18)

**입력**: 스펙 §20.14(내 위치) · §20.18(대오 좌표) · §20.19(QR 출석) · §20.20(대오 렌더 확정) ·
§20.4.0(기호 체계 정정) / 검증 5회차 §5-12(폴리곤 20점) / 리더 판정 3건.

§22 에서 만든 데이터 모델 위에 **좌표·기호를 갈아끼웠다.** 렌더러 구조 변경은 최소였다.

### §23.1 대오 표시 — 건물 → 도로 위 밴드 (사용자 지적 시정)

| 항목 | 이전(§21) | 확정 |
|------|-----------|------|
| 코스콤지부 대오 | **더샵 건물 폴리곤을 파랑으로 채움** ← 사용자가 지적한 상태 | **의사당대로 위 20점 폴리곤(123m × 폭 40m)** |
| 더샵아일랜드파크 | 대오 표시(파랑 채움) | **위치 기준 건물** — 회색 실선 외곽선, **채움 0** |
| 대오 1 | 없음 | **18점 폴리곤 · 테두리 없는 옅은 파랑 면**(`fillOpacity 0.08`) |
| 메인무대 | ③ 점선 원 | **②** 점선 원(5번 출구 중심 80m) — 번호만 이동 |
| 번호 | ①출구 ②건물 ③무대 | **지리 순서** ①출구 ②무대 ③대오1 ④대오2 ⑤더샵 (+⑥ 내 위치) |

**리더 필수 조건 6건 이행**

| 지시 | 구현 | 확인 |
|------|------|------|
| 1. 가는 선 금지 → 폭 40m 면 | `naver.maps.Polygon`. `Polyline` 은 타입 선언에서도 제거 | 렌더 실측 — 면으로 그려짐 |
| 2. 양 끝 자르지 말 것 | 페이드는 네이버 API 미지원 → **점선 테두리 + 범례 문구** | 화면에 `구간 전후로 이어질 수 있습니다` **1건** |
| 3. 대오 1 은 더 옅게 | `estimated` 스타일 `fillOpacity 0.08` vs `calculated` `0.20` | 렌더 육안 확인 |
| 4. 두 밴드 사이 경계선 금지 | **`estimated` 에 테두리를 주지 않는다**(`strokeOpacity 0`) → 마주보는 변이 **존재하지 않는다** | 렌더 육안 확인 — 경계선 0 |
| 5. LED무대 좌표 없음 | `MAP_FEATURES` 에 항목 없음. 범례 각주로만 존재 명시 | grep 0건 |
| 6. 메인무대는 5번 출구 도트에 붙여 | 원의 중심 = `EXIT5`, 반경 80m | 도트 중심과 원 중심 **픽셀 일치** |

**문안**: `우측 도로` **0건** · `약 320 m` 단일 수치 **0건** · 거리는 전부 `약 220~340 m`.
블록 2 는 `더샵아일랜드파크 앞 의사당대로 · [결의대회대오 2]` + 거리 범위 + `※ 현장에서 지부
깃발을 확인해 주세요.` 3줄이다(§20.3.3 개정 — 유보 절 제거는 사용자 확인 반영).

### §23.2 확신도 기반 스타일 — 좌표만 갈아끼우면 되는 구조

`RALLY_COLUMNS` 의 `confidence` **한 글자**가 채움 농도·테두리 유무·선종·라벨 접미어를 전부 결정한다.
컴포넌트에 `id === "column-1"` 같은 분기 **0건**(grep — 주석 1건뿐).

**되돌리기 경로 실측**: `RALLY_COLUMNS` 에서 `column-1` 항목을 지우고 빌드했다.
→ 화면에서 `대오 1`·`범위는 근사` **0건**, 도형·지도 라벨·범례 행이 **동시에** 사라졌고
번호가 **①②③④ 로 자동 재부여**(구멍 없음)됐다. 대오 2 문구는 그대로. 복원 후 **sha256 일치**.

### §23.3 내 위치 (§20.14) — 5가지 경로 전부 실측

`getCurrentPosition` 을 스텁으로 교체해 결정적으로 재현했다(권한 대화상자 없이).

| 경로 | `role="status"` 문구 | 지도 | 범례 |
|------|----------------------|------|------|
| 허용·범위 안 | `내 위치를 지도에 표시했습니다. 집결 위치에서 북동 약 40m (정확도 약 ±25m)` | 도트+정확도 원 추가(도형 +2) | **⑥ 행 추가** |
| 허용·**범위 밖**(강남역) | `내 위치는 지도 범위 밖입니다. 집결 위치에서 동 약 10.3km (정확도 약 ±40m)` | **도형 0 · 지도 범위 불변**(① 도트 좌표 `399,169` 동일) | ⑥ 행 없음 |
| 거부 | `위치 표시를 사용하지 않습니다. 위 안내와 지도만으로도 집결 위치를 확인할 수 있습니다.` | 없음 | 없음 |
| 타임아웃 | `위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.` | 없음 | 없음 |
| `accuracy = 0` | 정확도 문구 **생략** | **정확도 원 생략**(도형 +0) | ⑥ 행 추가 |

- 버튼 라벨: 결과 후 `다시 확인`, 거부·오류 후 `내 위치 표시` — 실측 일치.
- **반복 요청 3회에 도형이 누적되지 않는다**(도형 수 원복 실측).
- **`fitBounds` 재호출 0** — 범위 밖에서도 지도가 움직이지 않는다(가장 중요한 항목).
- `watchPosition` **0건**(grep — 주석 1건뿐). 권한 요청은 **버튼 클릭 시에만**.
- **저장·전송 0**: `localStorage` 는 네이버 스크립트의 `__mantle_tile_meta_data` 1건뿐이고
  **좌표를 포함하지 않는다**(정규식 검사). `sessionStorage` 0 · 쿠키 없음 · URL 불변.
- 지도 실패 상태(포트 3100 = 미등록 서비스 URL → 401)에서 **내 위치 버튼이 렌더되지 않는다**(실측).
- **§20.14.2 두 문장이 화면에 있다**(실측): `출석체크와 무관합니다` ·
  `위치 권한은 사이트마다 따로 물어봅니다` · `서버로 보내거나 저장하지 않습니다`.

### §23.4 QR 출석체크 안내 (§20.19)

- 블록 순서 실측: **집결 → 코스콤지부 위치 → QR 출석체크 안내 → 위치 지도 → 무대·화장실 → 결의대회 순서**
- 카드 내부: 출발 전 확인 → **출석 2회** → 인증 제한 → 경고(카드 하단)
- **채색 면이 1개뿐**(실측): QR 블록 안에서 배경색이 흰색·투명이 아닌 요소는
  `bg-primary-soft`(#d9e9ff) **출석 시각 면 하나**. 색 텍스트도 그 안(#093389)에만 6건.
  ①③④ 에 채색 면·색 텍스트 **0건**. 경고 블록에 **적색 0건**, `role="alert"` 없음
- 창작 금지 전건 확인(화면 문자열): `설정 >` **0** · `크롬` **0** · `출석 무효` **0** ·
  `폐회 후 출석` **0** · `20:00까지 오시면` **0** · `2회 미완료` **0**
- `※ 2차 출석 시간은 식순상 폐회(20:20~)보다 늦게까지 열려 있습니다.` **있음**
- 이미지: `public/images/rally-2026-08-28/qr-guide.png`(원본 1920×1080 그대로 이동),
  표시 폭 **480px 상한**(360px 에서 328px), `alt` 는 §20.19.10-24 문자열, 캡션 `주최측 배포 안내자료`,
  **스캔 유도·스캔 금지 문구 0건**, 라이트박스 없음
- 블록 4 는 `무대`·`화장실` **2장**(`md:grid-cols-2`). 출석 카드가 담던 배포 예정 문장은
  이미지 캡션 자리로 이동 — **정보 손실 0**. 손피켓 별도 블록 **없음**(같은 피켓 중복 0)

### §23.5 라벨 배치 — 360px 에서 유일해가 나왔다 ★

라벨이 6개가 되면서 **초판 배치가 무너졌다**(실측: ③ 7px·⑤ 41px 박스 밖 잘림 + 3쌍 겹침).

**제약을 실측으로 확정했다.** 360px 지도 박스는 328×246 이고, `fitBounds` 가 고르는 zoom 15 에서
**도형 전체가 차지하는 영역은 90×117px** 에 불과하다. 남는 자리는 좌 127 / 우 111 / 상 65 / 하 64px.
라벨 폭은 98·164·166·164·189px 이므로 **98px 짜리 ①만 좌우 여백에 들어간다.**
나머지 4개는 가로 중앙 정렬(위/아래)로만 배치할 수 있다.

| 라벨 | 배치 | 이 배치일 수밖에 없는 이유 |
|------|------|---------------------------|
| ① 5번 출구 (98px) | **left** | 유일하게 좌우 여백에 들어가는 폭. ②와 중심이 같아 반드시 다른 방향이어야 한다 |
| ② 메인무대(설치 예정) (164px) | **top**(원 북쪽) | 원 아래는 대오 밴드가 차지한다. ①과 겹치지 않는 유일한 방향 |
| ③ 대오 1 (166px) | **bottom**(밴드 남쪽) | `top` 이면 ②와 12px 겹친다(실측) |
| ④ 코스콤지부 [대오 2] (164px) | **top**(밴드 북쪽) | `bottom` 이면 ⑤와 겹친다 |
| ⑤ 여의도더샵아일랜드파크 (189px) | **bottom** | 가장 긴 라벨 — 가로 중앙 정렬만 가능하고 최남단이라 아래뿐 |

- 좌우 간격을 16→**28px** 로 키웠다: 24px 에서 ①과 ④가 **3×21px** 겹쳤다(실측).
- **결과 (실측)**: 360 / 768 / 1280 세 폭 모두 **박스 밖 잘림 0 · 라벨 간 겹침 0**.
- **라벨 문자열은 한 글자도 줄이지 않았다.**

### §23.6 실측 결과 요약

| 항목 | 360px | 768px | 1280px |
|------|-------|-------|--------|
| 지도 박스 | 328×246(4:3) | 704×396(16:9) | 896×504(16:9) |
| 라벨 5개 잘림 / 겹침 | **0 / 0** | **0 / 0** | **0 / 0** |
| 가로 스크롤 | 없음 | 없음 | 없음 |
| 텍스트 확대 200% 문서 가로 스크롤 | **34px — 전부 `SiteFooter` 로고**(푸터를 숨기면 `scrollX` **0**) | — | — |
| QR 시각 면 200% | 면 안쪽 스크롤로 흡수(`sw 455 / cw 216`), **카드는 넘치지 않음**(`sw 296 = cw 296`) | — | — |

**상태 전이 3시점**(`now` 주입, 저장소 밖 프리로드 — 검증용 라우트 0):

| 주입 | 상세 배지 | past 문장 | 메인 배지·테두리·CTA | 콘텐츠 |
|------|-----------|-----------|----------------------|--------|
| 2026-08-27 | 없음 | 없음 | 없음 · `border-primary` · 채움 버튼 | 전부 표시 |
| 2026-08-28 | `오늘` | 없음 | `오늘` · `border-primary` · 채움 버튼 | 전부 표시 |
| 2026-08-29 | `완료` | **있음** | `완료` · `border-border-strong` · 텍스트 링크 | **QR 블록 포함 전부 표시** |

전 시점 `열렸`·`개최`·`성황` **0건**.

**지도 실패 대체면**(포트 3100 → 401 인증 실패 실재현): 박스 크기 불변(328×246, CLS 0) +
`지도를 불러오지 못했습니다.` + 요약 3줄(`더샵아일랜드파크 앞 의사당대로 [대오 2]` ·
`5번 출구에서 남동쪽으로 약 220~340 m`) + 내 위치 버튼 미렌더.

### §23.7 리더 판정 3건 반영

1. **`SiteFooter` 200% 가로 스크롤** → `_workspace/FOLLOWUPS.md` **7번**으로 등록(우선순위 낮음).
2. **인용부호 곡선따옴표 통일** → 화장실 2줄을 `“ ”` 로 교체. **따옴표 문자만 바뀌었고 문안
   내용은 불변.** `02_designer_spec.md` §20.10 문안 게이트 표 아래에 변경 사실을 기록했다.
   이로써 페이지의 인용부호가 전건 곡선따옴표로 일치한다.
3. **QR 구현 대상** → §20.19 대로 구현 완료(§23.4).

### §23.8 스펙 이탈 · 판정 요청

| # | 스펙 | 실제 | 사유 |
|---|------|------|------|
| 1 | §20.20.1 "①은 마커 위, ②는 원 아래" | **①은 마커 왼쪽, ②는 원 위** | 규정의 목적(같은 좌표의 두 라벨이 서로 가리지 않게)은 충족한다. 원문대로 하면 ② 라벨이 대오 밴드 위에 얹혀 ③④와 겹친다(실측). §23.5 참조 |
| 2 | §20.4.3 `fitBounds` padding 좌우 24 | **top 48 / right 24 / bottom 48 / left 56**, 라벨 간격 16→28 | 스펙이 정한 해결 수단("넘치면 padding 을 키워 해결하고 문자열은 줄이지 마라") 그대로. 문자열 변경 0 |
| 3 | §20.19.4 이미지 `unoptimized` vs 리더 지시 `next/image 최적화 적용` | **`next/image` + `unoptimized`** | 두 지시가 충돌한다. Next 이미지 최적화는 기본이 WebP **손실 압축**이라 **QR 코드·미세 문자 도판에 쓰면 안 된다**(스펙이 든 이유). `next/image` 컴포넌트를 쓰되(`width`/`height` 로 CLS 0) 재인코딩만 끈다. **판정 요청** |
| 4 | QA §20.20.7-74 "`의사당대로` 는 블록 2 텍스트에만" | 지도 **대체면**에도 있다 | 대체면은 지도 라벨이 아니라 **지도를 대체하는 텍스트**이고, 블록 2 와 다른 도로 표현을 쓰면 같은 사실이 두 말이 된다. 지도 **pill 라벨**에는 도로명 0건 |

**미해결 1건 (FOLLOWUPS 8번)**: 더샵을 **bbox 사각형**으로 그려 대오 2 폴리곤 20점 중 **4점이
건물 사각형 안**에 들어간다. 원인은 실제 부지 폴리곤(47노드) 대신 bbox 를 쓰기 때문이며
**밴드 좌표는 도로 위에 정확히 있다.** 47노드 좌표가 오면 데이터 교체만으로 해소된다.

### §23.9 검증 명령

| 명령 | 결과 |
|------|------|
| `npm run build`(클린) | **통과** — 정적 9개, `/rally-2026-08-28` Revalidate `1m` |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `src/app/**/page.tsx` | 7개 — **검증용 라우트 0건** |
| `design/QR.png` | `public/images/rally-2026-08-28/qr-guide.png` 로 **이동**(원본 283KB 그대로) |
| 보호 파일 diff | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter` **0줄** |

---

## §24. 기호 충돌 판정 반영 — 정확도 원 폐기 · 내 위치 핀 (2026-08-18 · §20.21)

§23 은 §20.14.4 대로 **도트 + 정확도 원**으로 구현돼 있었다. §20.21 판정으로 **원을 버리고 핀**으로 바꿨다.

### §24.1 변경 대조 (§20.21.3 표 이행)

| 위치 | §23 | §24 확정 |
|------|-----|----------|
| 내 위치 도형 | 도트 16px + **정확도 원 2겹** | **물방울 핀 24×32px, 원 없음** |
| 핀 앵커 | 도트 중심 | **핀 끝(하단 꼭짓점)** — 그 점이 좌표다 |
| 라벨 | `⑥ 내 위치`(번호 배지) | **`내 위치`** — 번호 배지 **없음** |
| 범례 행 | `⑥ 내 위치 — …(점선 원은 오차 범위)` | **번호 없이** `📍 내 위치 — 기기가 알려준 대략 위치입니다 (표시했을 때만 나타납니다)` |
| 정확도 표현 | 원 + 텍스트 | **텍스트 전담** + `accuracy > 40` 이면 한 줄 추가 |
| `fitBounds` | 내 위치는 애초에 배열 밖 | **`includeInBounds: false` 플래그로 명시** |
| 블록 4 | 무대 · 화장실 2장(§23 에서 이미 반영) | 변경 없음. 제목에 `출석` 문자 0건 재확인 |

**구현 방식**: `MapFeature` 유니온에 `kind: "pin"` 추가, base 에 `numbered?`·`includeInBounds?` 추가.
`myLocationFeature(position)` 이 핀 항목을 만들고, **정적 항목과 완전히 같은 렌더 경로**
(`createLabelMarker`)를 탄다 — 내 위치만 별도 코드로 그리지 않는다. `MAP_FIT_BOUNDS` 는
`includeInBounds !== false` 인 항목만 접는다.

**임계값 40m 을 상수로 뽑은 이유**: 대오 밴드 폭(§20.18.1)에서 나온 값이라는 근거를
`LOW_ACCURACY_THRESHOLD_M` 주석에 남겼다. 밴드 폭이 바뀌면 같이 바뀌어야 하는 값이다.

### §24.2 실측 — 내 위치 5경로 (§20.21.6-87~91)

| 경로 | 상태 문구 | 핀 | 지도 도형 | 범례 |
|------|-----------|-----|-----------|------|
| 허용 `accuracy 25` | `내 위치를 지도에 표시했습니다. 집결 위치에서 북동 약 40m (정확도 약 ±25m)` | **1** | 7(불변) | 6행 · 마지막 `📍 내 위치 — …` |
| 허용 `accuracy 120` | 위 + **`위치 정확도가 낮아 지도 위 표시가 실제와 다를 수 있습니다.`** | 1 | 7(불변) | 6행 |
| 허용 **범위 밖**(강남역) | `내 위치는 지도 범위 밖입니다. 집결 위치에서 동 약 10.3km (정확도 약 ±18m)` | **0** | 7 | **5행** |
| 거부 | `위치 표시를 사용하지 않습니다. …` (중립) | 0 | 7 | 5행 |
| 타임아웃 | `위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.` | 0 | 7 | 5행 |

- **지도 도형 수가 전 경로에서 7 로 불변**이다 — 정확도 원이 생기지 않는다.
  도형 7 = 건물 외곽선 2(casing+본체) + 메인무대 원 2 + 대오 1 밴드 1(테두리 없음 → casing 없음)
  + 대오 2 밴드 2. **원은 메인무대 하나뿐**(§20.21.6-87 충족).
- **① 5번 출구 도트 화면 좌표가 전 경로에서 동일** — `fitBounds` 재계산 0(§20.21.6-90).
- 범례 번호는 `① ② ③ ④ ⑤` 뿐이고 **내 위치 행에는 번호가 없다**(§20.21.6-91).
- 저정확도 줄은 같은 `role="status"` 컨테이너 안에 있고 **적색·경고 아이콘 0**(§20.21.6-89).
- 핀은 `<svg viewBox="0 0 24 32">` 물방울이라 ① 원형 도트와 **형태가 다르다**(§20.21.6-88).

### §24.3 회귀 재확인

| 항목 | 결과 |
|------|------|
| 360px 라벨 5개 | **잘림 0 · 겹침 0 · 가로 스크롤 없음** (박스 328×246) |
| 블록 4 | `무대 · 화장실` 2장, 제목·본문에 `출석` **0건** |
| `npm run build` / `tsc --noEmit` / `lint` | **통과 / exit 0 / exit 0** |

### §24.4 남은 판정 요청 (§23.8 에서 이월)

1. **이미지 최적화**: 리더 지시(`next/image` 최적화)와 스펙(`unoptimized`)이 충돌한다.
   현재 `next/image` + `unoptimized`. QR 도판의 lossy 재인코딩을 피하는 쪽을 택했다.
2. **FOLLOWUPS 8번**: 더샵을 bbox 사각형으로 그려 대오 2 폴리곤 4점이 건물 사각형 안에 든다.
   **밴드 좌표는 도로 위에 정확하다.** OSM 부지 폴리곤 47노드가 오면 데이터 교체로 해소된다.

---

## §25. 더샵아일랜드파크 — bbox → 실부지 폴리곤 교체 (2026-08-18 · 검증 §5-13)

§23.8 에서 미해결로 올렸던 항목(FOLLOWUPS 8번)이 좌표 확보로 해소됐다.

### §25.1 무엇을 바꿨나

| 항목 | 이전 | 확정 |
|------|------|------|
| 데이터 | `DSHARP_BOUNDS`(축정렬 bbox 4값) | **`DSHARP_POLYGON`** — OSM `way 682330255` 단순화 **13점**(검증 §5-13-4 의 14점에서 닫는 점 제외) |
| 도형 | `naver.maps.Rectangle` × 2 | **`naver.maps.Polygon` × 2**(casing 5px + 본체 2px, 채움 0) |
| 타입 | `OutlineFeature.bounds` | `OutlineFeature.polygon` — `Rectangle` 사용처 **0건** |
| 범례 문구 | `… — 위치 기준 건물` | **`… — 위치 기준 단지 부지`** |

- **닫는 점을 뺀 이유**: 네이버 `Polygon` 은 링을 자동으로 닫는다. **단순화를 더 하지 않았다**
  (검증 요구 32 의 "10노드 하한"과 무관 — 형태 그대로다).
- 선 굵기 2px 은 대오 밴드(3px)보다 **가늘고**, 색은 `#4b5563`(회색)으로 **낮은 채도**다.
  **채움 0** — 면을 채우면 대오 밴드와 같은 위계로 읽혀 "여기 모인다"로 오독된다(검증 §5-13-6).

### §25.2 겹침 해소 — 코드에서 직접 검산

교체 후 `src/lib/rallyMap.ts` 의 실제 좌표를 파싱해 다시 계산했다(검증자 수치와 대조).

| 검사 | 결과 | 검증자 §5-13-5 |
|------|------|-----------------|
| 변 교차 | **0회** | 0회 |
| 대오 2 점이 부지 안 | **0개** (이전 bbox 에서는 4개) | 0개 |
| 부지 점이 대오 2 안 | **0개** | 0개 |
| 최소 이격 | **21.7 m** | 21.8 m |

**약 22m 이격은 정상이다.** 부지→차도 중심선 28m − 밴드 남서 가장자리 6m = 22m 이고
**그 22m 는 보도·전면 공지(setback)** 다. 코드 주석에 **"떨어져 있으니 잘못 그렸다고 판단해
밴드를 부지 쪽으로 당기지 마라 — 당기는 순간 사용자가 지적한 원래 문제가 재발한다"** 를 명시했다.

### §25.3 라벨 앵커 — 스펙 문구와 실측이 갈린 지점 (판단 기록)

검증 §5-13-6 은 "라벨 `더샵아일랜드파크` 는 **부지 안쪽**에 둔다"이고, 그 이유로 **"도로 쪽에 두면
밴드 라벨과 충돌한다"** 를 든다.

- 처음에 문구 그대로 **부지 bbox 중심**에 앵커했더니 **라벨(189×34px)이 부지 외곽선을 덮어
  앵커 지물이 화면에서 보이지 않았다**(실측). 앵커는 조합원이 **눈으로 대조**하는 용도라
  형태가 가려지면 목적을 잃는다.
- 그래서 **부지의 남쪽 변**에 앵커하고 라벨을 아래로 뺐다. 도로는 **북동쪽**이므로
  규정의 목적(밴드 라벨과의 충돌 회피)은 그대로 충족한다 — 실측 겹침 **0**.

### §25.4 실측 (교체 후)

| 뷰포트 | 지도 박스 | 라벨 5개 | 잘림 | 겹침 | 도형 | 가로 스크롤 |
|--------|-----------|----------|------|------|------|-------------|
| 360px | 328×246 | ① 22–120/69–103 · ② 66–230/17–51 · ③ 92–258/148–182 · ④ 121–285/81–115 · ⑤ 89–277/195–229 | **0** | **0** | 7 | 없음 |
| 768px | 704×396 | — | **0** | **0** | 7 | 없음 |
| 1280px | 896×504 | — | **0** | **0** | 7 | 없음 |

- 도형 7 = 부지 외곽선 2(casing+본체) + 메인무대 원 2 + 대오 1 밴드 1(테두리 없음 → casing 없음)
  + 대오 2 밴드 2. **원은 여전히 메인무대 하나뿐.**
- **육안 확인(768·1280 스크린샷)**: 부지 외곽선이 도로 남서쪽에 그려지고, 대오 2 밴드는 그
  **북동쪽에 떨어져** 있다. 둘 사이 간격이 화면에서 명확히 보인다 — 밴드가 부지 위에 얹히지 않는다.

### §25.5 문자열 변경 1건 (보고 대상)

범례 ⑤ 행: `여의도더샵아일랜드파크 — 위치 기준 **건물**` → `… — 위치 기준 **단지 부지**`.

- 근거: OSM 태그가 `landuse=commercial` 이고 `building` 이 아니다. **대지 경계이지 건물
  외벽선이 아니며** 주차장·조경을 포함한다(검증 §5-13-2 · 요구 35 · 리더 지시).
  부지 안에 실제 건물(101·102동)이 따로 있다.
- §20.20.5 의 문자열을 고친 것이므로 **최종 검증 게이트에서 확인이 필요하다.**
- 코드 주석의 "건물" 표기도 "부지"로 정리했다(§20.4.0 정정 경위를 설명하는 문장은 원문 유지).

### §25.6 작업 중 관찰 — QA 임시 라우트

빌드 도중 `.next/types` 가 `src/app/qa-tmp-phase/page.js` 를 참조해 `tsc` 가 1회 실패했다.
**QA 가 상태 전이 검증용 임시 라우트를 만들었다가 지운 흔적**이며 내 산출물이 아니다.
현재 `src/app/` 에 해당 라우트는 **없고**, 클린 재빌드 후 `tsc` **exit 0** 이다.
**QA 파일을 건드리지 않았다.**

### §25.7 검증 명령

| 명령 | 결과 |
|------|------|
| `npm run build`(클린) | 통과 — 정적 9개 |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `maps.Rectangle` 사용처 | **0건**(폴리곤으로 전환) |
| 보호 파일 diff | 6종 **0줄** |

---

## §26. 라벨 앵커 결함 수정 — 라벨이 밴드를 덮던 문제 (2026-08-18 · QA 지적)

### §26.1 원인 — bbox 변 중점은 **대각선 폴리곤에 맞지 않는다**

라벨 앵커를 `anchorOnBounds()` 가 **bbox 변의 중점**에서 뽑고 있었다. 축정렬 도형에는 맞지만
대오 밴드는 **북서–남동 대각선**이라, bbox 변 중점이 **밴드 위가 아니라 옆 허공**에 잡힌다.

그 결과(360px 실측, 수정 전):

| 라벨 | 위치 | 덮은 것 |
|------|------|---------|
| ④ 코스콤지부 [대오 2] | `[121,82,285,116]` | **대오 1 밴드**(`[156,87,195,134]`) |
| ③ 대오 1 (범위는 근사) | `[92,148,258,182]` | **대오 2 밴드**(`[189,130,217,162]`) + 부지 |

**대오를 보여주려고 그린 도형을 우리 라벨이 덮었다**(§0.4 위반). 덤으로 ④(남쪽 밴드)의 라벨이
③(북쪽 밴드)의 라벨보다 **위**에 찍혀 지리 순서가 화면에서 뒤집혀 보였다.

**부지 bbox 가 실제의 1.8배였던 §25 의 문제와 같은 성질이다** — 축정렬 근사가 대각선 지물을
잘못 표현한다. 그래서 같은 방향으로 고쳤다: **근사(bbox)를 버리고 실제 형상을 쓴다.**

### §26.2 수정 — 앵커를 **도형의 극점**에서 뽑는다

```
top    → 폴리곤의 최북단 위도    bottom → 최남단 위도
left   → 최서단 경도            right  → 최동단 경도
```

**이것이 보장을 만든다**: `top` 라벨은 도형의 최북단보다 위에 놓이므로 **자기 도형을 절대 덮지
못한다.** 두 대오가 북서–남동으로 이어져 있으므로

- **대오 1 → `top`** (대오 1 최북단보다 위 = 두 밴드 모두보다 북쪽)
- **대오 2 → `bottom`** (대오 2 최남단보다 아래 = 두 밴드 모두보다 남쪽)

로 두면 **어느 라벨도 어느 밴드도 덮지 않는다.** 규칙을 지키는 게 아니라 **어길 수 없게** 만든 것이다.
동시에 화면에서 위가 대오 1, 아래가 대오 2 라 **지리 순서와 일치**한다.

**가로 위치·간격은 자유도로 남겼다**: `labelAlign`(west/center/east)과 `labelGap`(px).
세로 위치는 극점에서 나오므로 **이 둘을 어떻게 조정해도 "도형을 덮지 않는다"는 보장은 유지된다** —
라벨끼리의 충돌을 푸는 데만 쓴다.

| 항목 | placement | labelAlign | labelGap | 그 값인 이유(실측) |
|------|-----------|-----------|----------|--------------------|
| ① 5번 출구 | left | — | **38** | 기본 28 이면 ③ 라벨과 8px 겹친다 |
| ② 메인무대 | top | center | **29** | 원 북단(65)과 대오 1 북단(87) 사이가 **22px 뿐**이라, 34px 라벨 2개를 상단 여백에 포개 넣으려면 이 값이어야 한다 |
| ③ 대오 1 | top | **east** | 14 | 오른쪽으로 밀어 ① 라벨과 비껴간다 |
| ④ 대오 2 | **left** | — | **22** | **아래로 빼면 안 된다** — 아래 여백에 부지 외곽선(y 142~182)이 걸쳐 있어 아래로 빼면 ④ 가 부지를 **43% 덮는다**(폴리곤 단위 실측). 왼쪽 여백으로 빼면 부지 가림이 **3%** 로 떨어진다 |
| ⑤ 부지 | bottom | center | 14(기본) | ④ 가 왼쪽으로 비켜나 부지 아래 공간을 독점할 수 있게 됐다 |

**④ 를 왼쪽으로 뺀 판단의 근거**는 ⑤ 라벨을 부지 중심에 두지 않은 것(§25.3)과 **같다**:
부지는 조합원이 **눈으로 대조하는 기준 지물**이라 가리면 목적을 잃는다.
"밴드만 안 가리면 된다"로 멈추지 않고 **기준 지물까지 살렸다.**

### §26.3 실측 — 3뷰포트 전부 통과

**측정 방법 — 사각형 근사가 아니라 폴리곤 단위로 쟀다.**
`path.getPointAtLength()` 로 **밴드 외곽선을 1px 간격으로 순회**하고, `isPointInFill()` 로
**내부를 1px 격자로 샘플**한 뒤, 각 점을 `getScreenCTM()` 으로 화면 좌표로 변환해
**라벨 pill 사각형 안에 들어가는지** 판정했다. bbox 교차가 아니라 **실제 도형이 가려지는가**를 센다.

| 뷰포트 | 지도 박스 | **대오 1 가림** | **대오 2 가림** | 라벨×라벨 | 잘림 | ③④ 지리 순서 |
|--------|-----------|-----------------|-----------------|-----------|------|----------------|
| 360px | 328×246 | **0/125 · 0/548** | **0/86 · 0/347** | **0** | **0** | 일치 |
| 768px | 704×396 | **0/247 · 0/2216** | **0/173 · 0/1388** | **0** | **0** | 일치 |
| 1280px | 896×504 | **0/247 · 0/2216** | **0/173 · 0/1388** | **0** | **0** | 일치 |

(표기: `외곽선 히트/샘플 · 내부 히트/샘플`. 3뷰포트 합계 **9,700여 점 중 가려진 점 0개**.)
라벨 문자열은 **한 글자도 줄이지 않았다.**

**360px 최종 배치**
```
② 메인무대(설치 예정)  [ 66,  2, 230,  36]
③ 대오 1 (범위는 근사) [112, 38, 278,  72]     ← 대오 1 밴드(y 87~) 위
① 5번 출구             [ 12, 69, 110, 103]
④ 코스콤지부 [대오 2]  [  3,128, 167, 162]     ← 밴드 서쪽 여백(밴드는 x 189~)
⑤ 여의도더샵아일랜드파크[ 89,195, 277, 229]     ← 부지(~y 182) 아래
```

### §26.4 남는 것 — 밴드가 아닌 도형과의 겹침 (보고 대상)

**밴드는 어느 라벨에도 가려지지 않는다.** 다만 밴드가 아닌 두 도형에는 라벨이 일부 얹힌다:

| 겹침 | 정도 (외곽선 / 내부, 폴리곤 단위 실측) | 판단 |
|------|------------------------------------------|------|
| ④ 라벨 × **부지 외곽선** | 360px **9% / 3%** · 1280px **12% / 6%** | ④ 를 아래가 아니라 왼쪽으로 빼서 **43% → 3%** 로 줄였다. 남는 것은 부지 북동 모서리의 짧은 구간이며 부지 형태 대조에 지장이 없다 |
| ③·① 라벨 × **메인무대 원** | 360px **27% / 12%** · 1280px **30% / 12%** | ③ 라벨 아래변이 원의 위쪽 호를 7px 스친다. 더 띄우려면 ② 라벨이 지도 밖으로 나간다(상단 여백 87px 에 34px 라벨 2개가 들어가야 한다). 원은 "대략 범위"를 뜻하는 도형이라 위쪽 호 일부가 가려져도 의미가 유지된다 |

**360px 지도(328×246)는 이 라벨 집합의 수용 한계에 있다**(§23.5 에 이어 재확인).
도형이 차지하는 세로 구간이 117px 이고 라벨 5개가 각 34px 이라, 남는 여백에 전부 넣으면
자유도가 거의 0이다. **라벨이 하나 더 늘거나 문자열이 길어지면 이 배치는 다시 깨진다.**
그 경우 임의 조정 대신 디자이너에게 넘긴다(라벨 축약·지시선·지도 종횡비 중 택일이 필요하다).

### §26.5 검증 명령

`npm run build` 통과 · `npx tsc --noEmit` **exit 0** · `npm run lint` **exit 0** ·
360/768/1280 스크린샷 육안 확인(밴드 2개가 라벨에 가려지지 않고 보인다).

### §26.6 함수 이름 정정 — 호출부만 보고 오독되지 않게

리더가 코드 확인 중 `anchorOnBounds(polygonBounds(...))` 라는 **호출부 표기만 보고**
"아직 bbox 변 중점을 쓴다"고 판단한 일이 있었다. 함수 **본문**은 이미 극점 방식이었지만
**이름이 옛 의미를 가리키고 있었던 것이 원인**이다. 이름을 의미에 맞춰 고쳤다:

| 이전 | 현재 |
|------|------|
| `anchorOnBounds()` | **`anchorAtExtreme()`** — 극점에서 앵커를 뽑는다는 뜻 |
| `polygonBounds()` | **`polygonExtremes()`** — 꼭짓점들의 극값이지 "도형을 대신하는 사각형"이 아니다 |

`polygonExtremes()` 주석에 **"도형을 사각형으로 근사하는 용도가 아니다 — 부지를 bbox 로
그렸다가 실제의 1.8배가 됐던 사고(§25)를 반복하지 마라"** 를 남겼다.

### §26.7 구현이 §20.20.1 문구와 다른 이유 (리더 판정 2026-08-18 — 구현 유지·스펙 개정)

| 항목 | 스펙 §20.20.1 | 구현 | 실측 근거 |
|------|---------------|------|-----------|
| ① 5번 출구 | 마커 **위** | **왼쪽**(`left`, gap 38) | ①②는 좌표가 같아 라벨이 겹친다. 둘 다 위/아래로 두면 상단 여백 87px 안에 34px 라벨 3개(①②③)가 들어가야 해 성립하지 않는다. ① 은 98px 로 **유일하게 좌우 여백(127px)에 들어가는 라벨**이다 |
| ② 메인무대 | 원 **아래** | **위**(`top`, gap 29) | 원 아래는 **대오 밴드가 지나간다**(y 87~162). 아래로 두면 ② 라벨이 밴드를 덮어 §0.4 위반이 된다 — 이번 QA 실패의 원인과 같은 문제 |

**스펙의 방향 지정은 "①②가 서로를 가리지 않게 한다"가 목적**이고, 구현은 다른 방향 조합으로 그 목적을
**실측으로 달성**했다(전 뷰포트 라벨×라벨 겹침 0 · 라벨×밴드 겹침 0, §26.3).
문구에 맞추려고 되돌리면 겹침이 되살아난다. **리더 판정: 구현 유지, 디자이너에게 스펙 개정 요청.**

---

## §27. 모바일 지도 종횡비 `4/5` + 라벨 재배치 (2026-08-18 · QA 18회차 실패 2·3 · §20.23)

### §27.1 반영 3건

| # | 변경 | 위치 |
|---|------|------|
| 1 | `aspect-[4/3]` → **`aspect-[4/5]`**(모바일만, `md:aspect-[16/9]` 불변) | `RallyMap.tsx` 지도 박스 |
| 2 | 라벨 간격·정렬 재조정 5건(아래 표) | `rallyMap.ts` 데이터 |
| 3 | **`break-words`** 4곳(`break-keep` 유지한 채 추가) | 범례 행 2개 · 블록 2 첫 줄 · 경고 블록 본문 |
| — | `FIT_PADDING` | **변경 0** — 원인이 아니었다 |

### §27.2 결과 — 모바일 지도가 실제로 커졌다

| 항목 | 이전(4:3) | **확정(4:5)** |
|------|-----------|---------------|
| 지도 박스 | 328×246 | **328×410** |
| **축척** | **300 m** | **100 m** — md 와 동일해졌다 |
| **도형 묶음** | **104×129 px** | **180×234 px** (면적 **약 3.1배**) |

원인 진단이 맞았다: **패딩 상수가 아니라 4:3 박스 높이가 문제였다.** zoom 16 이 요구하는 세로
234 px 는 246 px 박스에 패딩 0 으로도 라벨과 함께 들어가지 못한다.

### §27.3 라벨 재배치 — 세로형 박스는 **수평 여유를 깎는다**

§20.23.4 의 경고가 실제로 발생했다. 수평 여유가 **224 → 134 px** 로 줄어 첫 빌드에서
**① 왼쪽 4 px · ④ 오른쪽 24 px 이 잘렸다**(실측). 아래로 조정해 해소했다.

| 라벨 | placement | align | gap | 그 값인 이유(실측) |
|------|-----------|-------|-----|--------------------|
| ① 5번 출구 | left | — | **26** | 38 이면 왼쪽 4 px 잘림. 26 이면 좌측 경계까지 8 px. 더 좁히면 원을 더 가린다 |
| ② 메인무대 | top | center | **38** | **768 px 기준**: 상단 여백이 81 px 뿐이라 42 면 경계까지 5 px. 38 이면 9 px |
| ③ 대오 1 | top | east | **46** | 14 면 라벨 아래변이 **원의 북동 호를 덮는다**(옛 박스 둘레 16%). 46 이면 원 최북단보다 위로 완전히 빠진다 |
| ④ 코스콤지부 [대오 2] | bottom | **west** | **42** | `east` 는 오른쪽 24 px 잘림(우측 여백 58 px). `center` 도 우측 4 px. `west` 로 33 px 확보. 부지 덮임은 gap 42(부지 아래 2 px)로 해결 |
| ⑤ 부지 | bottom | center | **40** | 46 이면 **768 px 에서 하단 1 px**. 40 이면 7 px, ④ 와도 4 px 뜬다 |

**튜닝 기준이 360 px 에서 768 px 로 바뀌었다.** 세로형(4:5)은 모바일에만 적용되므로
**16:9 인 768 px(704×396)의 세로 여백이 가장 좁다** — 상단 81 px · 하단 81 px 에 라벨 2개(68 px)씩
들어가야 해 슬랙이 13 px 뿐이다. 그 13 px 을 **2 / 4 / 7** 로 나눈 것이 위 값이다.

**리더 지시 `labelAlign: "east"`(④)를 그대로 쓰지 못한 이유**: 세로형 박스에서 우측 여백이
58 px 뿐이라 동쪽 정렬 시 라벨이 24 px 잘린다(실측). **지시의 목적은 "부지를 덮지 않게"** 였고,
그것을 `labelGap: 44`(부지 아래로 완전히 빼기)로 달성했다 — **부지 덮임 0%**.

### §27.4 실측 — 폴리곤 단위(외곽선 1 px 순회 + 내부 1 px 격자)

| 뷰포트 | 박스 | 축척 | **대오 1** | **대오 2** | **부지** | 메인무대 원 | 잘림 | 라벨겹침 | ③④ 순서 | **라벨 최소 여백** |
|--------|------|------|-----------|-----------|---------|-------------|------|----------|-----------|--------------------|
| 360px | 328×410 | **100 m** | **0% / 0%** | **0% / 0%** | **0% / 0%** | 13% / 9% | **0** | **0** | 일치 | **8 px**(① 좌) |
| 768px | 704×396 | 100 m | **0% / 0%** | **0% / 0%** | **0% / 0%** | 13% / 9% | **0** | **0** | 일치 | **7 px**(⑤ 하) |
| 1280px | 896×504 | 100 m | **0% / 0%** | **0% / 0%** | **0% / 0%** | 13% / 9% | **0** | **0** | 일치 | **61 px** |

(`둘레 % / 내부 %`. 대오 1 은 표본 247+2216, 대오 2 는 173+1388, 부지는 226+3437.)

**라벨별 경계 여백 (좌/우/상/하 px)**

| 라벨 | 360px | 768px |
|------|-------|-------|
| ① 5번 출구 | 8 / 222 / 113 / 263 | 196 / 410 / 106 / 256 |
| ② 메인무대(설치 예정) | 50 / 114 / **16** / 360 | 238 / 302 / **9** / 353 |
| ③ 대오 1 (범위는 근사) | 143 / **19** / 52 / 324 | 331 / 207 / 45 / 317 |
| ④ 코스콤지부 [대오 2] | 131 / 33 / 324 / 52 | 319 / 221 / 317 / 45 |
| ⑤ 여의도더샵아일랜드파크 | 109 / 31 / 362 / **14** | 297 / 219 / 355 / **7** |

**0~2 px 짜리 아슬아슬한 라벨은 없다.** 최소가 360px **8 px**, 768px **7 px** 다.
(조정 전에는 768px 에서 ⑤ 하단 **1 px** 였다 — 잘림은 아니지만 폰트 메트릭이 조금만 달라져도
넘어갈 값이라 간격을 재배분했다.)

**슬롯 검증 — 추정이 실제와 일치했다**

| 항목 | 360px 실측 | 1280px 실측 |
|------|-----------|-------------|
| 도형 묶음 | 180×235 px | 180×235 px |
| 여백(좌/우/상/하) | 90 / 58 / 88 / 88 | 366 / 350 / 135 / 135 |
| **좌우 여백에 들어가는 라벨** | **0개** (최대 여백 90 < 최소 라벨 폭 98) | 5개 |
| 상단 / 하단 슬롯(34 px 기준) | **2 / 2 = 4슬롯** (라벨은 5개) | 3 / 3 |

→ 360px 에서 **"좌우 슬롯 0 · 상하 4슬롯에 라벨 5개"** 라는 예측이 실측으로 확인됐다.
①(98 px)은 좌측 여백(90 px)에 **완전히는 못 들어가** 14 px 이 도형 위로 들어오며,
그것이 아래 원 덮임 13% 의 정체다.

- **④ × 부지 외곽선: 46.4% → 0%.** QA 권고 해소.
- **③ × 메인무대 원: 16% → 0%.**

**메인무대 원 — 라벨별 분리 집계 (QA 요청 형태)**

| 덮은 주체 | 둘레 | 내부 |
|-----------|------|------|
| ① 5번 출구 | **13%** (35/264) | **9%** |
| ③ 대오 1 | **0%** | **0%** |
| **잔존 둘레** | **87%** | — |

남은 13% 는 **전부 ① 이 만든다.** ① 은 원의 중심(5번 출구)에 붙는 라벨이고 ①②가 같은 좌표라
어느 방향으로 빼도 원과 만난다 — **없앨 수 없는 구조적 결과**이며 QA 가 §20.21.1 기호 문법 기준으로
이미 통과 판정한 부분이다.

### §27.5 ③ × 메인무대 원 — **여유가 생겼으니 0 으로 만드는 게 맞다** (리더 질의 답)

QA 는 "원의 70.8% 잔존 → 통과"로 판정했지만, **세로형 박스가 만들어 준 여유를 쓰면 ③ 의 몫을
0 으로 만들 수 있었다.** 그래서 그렇게 했다(② 42 / ③ 46 으로 상단 여백을 재배분).

판단 근거: 원은 "무대는 이 범위 어딘가"라는 **불확실성 자체를 전달하는 도형**이고, 호가 잘릴수록
그 범위가 작아 보인다. **가릴 이유가 없어졌는데 가려 둘 이유도 없다.**
남은 13% 는 ① 이 만드는 것이라 없앨 수 없다 — ① 은 원의 중심(5번 출구)에 붙는 라벨이고
①②가 같은 좌표인 이상 어느 방향으로 빼도 원과 만난다.

### §27.6 텍스트 확대 200%

| 항목 | 결과 |
|------|------|
| 페이지 콘텐츠발 가로 스크롤 | **0** — `break-words` 4곳으로 해소 |
| 남는 34 px | **`SiteFooter` 로고**(`FOLLOWUPS.md` 7번, 범위 밖). 푸터를 숨기면 `scrollX` **0** 으로 실측 |

`break-keep` 을 **빼지 않았다.** 빼면 한글이 음절 단위로 끊겨 §20.2.3 이 금지한 상태가 된다.
두 속성을 함께 두면 **한 낱말이 줄 폭보다 길 때만** 그 낱말이 쪼개진다.

### §27.7 검증 명령

`npm run build` 통과 · `npx tsc --noEmit` **exit 0** · `npm run lint` **exit 0** ·
360/768/1280 스크린샷 육안 확인 · 임시 파일·검증용 라우트 잔존 0.

### §27.8 라벨 여백 하한 8 px 확보 (QA 18회차 권고 · 2026-08-18)

QA 권고: 잘림은 0 이지만 한 자리 수 여백이 있어(768px ⑤ 하단 **1 px**) 폰트 렌더링이
몇 px 만 달라져도 잘린다. **여백 하한 8 px** 확보.

#### QA 제안(`FIT_PADDING` 좌 56→64 · 하 48→56)은 **실측으로 기각했다**

| 뷰포트 | 결과 |
|--------|------|
| 360px | 축척 **100 m 유지** ✓ · 전체 최소 여백 8 → **12 px** ✓ |
| **768px** | 축척 100 m 유지 ✓ · ⑤ 하단 7 → 11 px ✓ **그러나 ② 상단 9 → 5 px 로 악화** ✗ |

**세로 여백은 제로섬이다.** 하단 패딩을 늘리면 콘텐츠가 위로 밀려 **상단 여백이 그만큼 줄고**,
상단에 있는 ② 가 손해를 본다. 768px 의 세로 자유 공간은 `396 − 235 = 161 px` 로 고정이며
패딩은 그것을 상하로 **나누기만** 한다. → `FIT_PADDING` 원복(`48/24/48/56`).

#### 채택 — **간격 재배분**(3건). 축척·도형 크기 영향 0

161 px 을 **② 상 8 / ②③ 2 / ③–원 3 / 부지–④ 2 / ④⑤ 2 / ⑤ 하 9** 로 나눈 값이다.

| 라벨 | 이전 | **확정** |
|------|------|----------|
| ② 메인무대 | 38 | **39** |
| ③ 대오 1 | 46 | **47** |
| ⑤ 부지 | 40 | **38** |
| ① 5번 출구 / ④ 대오 2 | 26 / 42 | 변경 없음 |

#### 실측 — 3뷰포트

| 뷰포트 | 박스 | **축척** | 도형 묶음 | **전체 최소 여백** | 대오1 | 대오2 | 부지 | 원 | 잘림 | 겹침 |
|--------|------|---------|-----------|--------------------|-------|-------|------|-----|------|------|
| 360px | 328×410 | **100 m** | 180×235 | **8 px**(① 좌) | 0%/0% | 0%/0% | 0%/0% | 13%/9% | 0 | 0 |
| 768px | 704×396 | **100 m** | 180×235 | **8 px**(② 상) | 0%/0% | 0%/0% | 0%/0% | 13%/9% | 0 | 0 |
| 1280px | 896×504 | **100 m** | 180×235 | **62 px** | 0%/0% | 0%/0% | 0%/0% | 13%/9% | 0 | 0 |

**라벨별 경계 여백(좌/우/상/하 px)**

| 라벨 | 360px | 768px |
|------|-------|-------|
| ① 5번 출구 | **8** / 222 / 113 / 263 | 196 / 410 / 106 / 256 |
| ② 메인무대(설치 예정) | 50 / 114 / 15 / 361 | 238 / 302 / **8** / 354 |
| ③ 대오 1 (범위는 근사) | 143 / 19 / 51 / 325 | 331 / 207 / 44 / 318 |
| ④ 코스콤지부 [대오 2] | 131 / 33 / 324 / 52 | 319 / 221 / 317 / 45 |
| ⑤ 여의도더샵아일랜드파크 | 109 / 31 / 360 / 16 | 297 / 219 / 353 / **9** |

**축척 100 m 가 세 뷰포트 모두 유지된다**(최우선 조건 충족). 도형 크기·밴드 0%·부지 0% 도 불변.

#### 한계 기록 — 8 px 이 현 구성의 상한이다

360px 과 768px 모두 최소값이 **정확히 8 px** 이다. 우연이 아니라 **자유 공간을 8 px 하한에 맞춰
남김없이 나눈 결과**다. 두 뷰포트의 병목이 서로 다르다:

- **360px**: 수평 — ①(98 px)이 좌측 여백(90 px)보다 넓어 8 px 이 한계
- **768px**: 수직 — 상단 81 px 에 34 px 라벨 2개가 들어가 8 px 이 한계

**라벨이 하나라도 늘거나 문자열이 길어지면 8 px 을 지킬 수 없다.** 그때는 임의 조정하지 말고
디자이너에게 넘긴다(라벨 축약·지시선·박스 재조정 중 택일).

---

## §21 지도 인터랙티브 전환 · 대오 명칭 정리 (2026-08-19)

스펙 `02_designer_spec.md` §21(6468행~) 구현. 사용자 요청 **1(인터랙티브)·3(대오 명칭)** 범위.
**§21.4(화장실 ⑥)·§21.5(종료 20:30)는 구현하지 않았다** — 리더 지시가 "자리만 열고 값은 넣지 마라"였다.
자리는 열려 있다(§21.4 미구현 항목 참조).

### 21-1. 조작 계약 (§21.1.1) — 한 손가락은 언제나 페이지 스크롤

`src/components/rally/RallyMap.tsx`

| 입력 | 구현 | 실측 |
|------|------|------|
| 한 손가락 | 컨테이너 `touch-action: pan-y` + `draggable: (pointer: fine)` 일 때만 | 마운트 노드 computed `touch-action = pan-y` (지도·로드뷰 **양쪽**) |
| 두 손가락 | `touchmove` 2 touch 중심점 델타 → `map.panBy(-dx, -dy)` | 합성 터치 2점 +60px → 오버레이 5개 전부 정확히 +60px 이동. `처음 위치로` 활성화됨 |
| 핀치 | `pinchZoom: true` | (합성 불가 — 실기기 확인 필요) |
| 더블탭·더블클릭 | `disableDoubleTapZoom: true` · `disableDoubleClickZoom: true` | — |
| 휠 | `scrollWheel: false` + 직접 리스너에서 `e.ctrlKey \|\| e.metaKey` 일 때만 `setZoom` + `preventDefault()` | **맨 휠: `defaultPrevented=false`, 축척 100m 불변** / **Ctrl+휠: `defaultPrevented=true`, 100m → 50m** |
| 키보드 | `keyboardShortcuts: false` | 지도 안 Tab 정지점 5개(네이버 로고·더보기·OSM 링크) — **§20.9 시점과 동일, 증가 0** |

- 줌 범위 `minZoom: 15` · `maxZoom: 19` (`MAP_MIN_ZOOM`/`MAP_MAX_ZOOM`, `src/lib/rallyMap.ts`).
- `prefers-reduced-motion: reduce` → `setZoom(next, false)`(애니메이션 인자 off). 매 호출 시점에 `matchMedia`
  를 다시 읽는다(설정은 페이지가 열린 채로도 바뀐다). **`panBy` 는 네이버 API 에 애니메이션 인자가 없어
  원래 즉시 이동**이다 — 끌 것이 없다(§21.1.4 기록 요구 충족).
- **한계**: `(pointer: coarse)` 분기와 핀치는 데스크톱 헤드리스에서 검증 불가. 실기기 또는 기기 에뮬레이션
  세션에서 §21.8-101·102 를 확인해야 한다. 기전(`touch-action: pan-y` + coarse 에서 `draggable:false`)은
  코드·computed style 로 확인했다.

### 21-2. 컨트롤 행 (§21.1.3) — 전부 지도 밖

`CONTROL_CLASS` 하나로 5개 버튼이 §20.14.3 아웃라인 필을 공유한다(`px-5` — 폭 검산 전제).

| 실측(360px 콘텐츠 폭) | 값 |
|------|-----|
| 버튼 폭 | 축소 75 · 확대 75 · 처음 위치로 126 · 내 위치 표시 130 · 로드뷰 보기 126 |
| 행 수 | **2행**(75+75+126 / 130+126) · 가로 스크롤 **0** · 높이 **44px** |
| 768px | **1행** |
| 비활성 | 초기 `처음 위치로` 비활성 → z15 에서 `축소` 비활성 → z19 에서 `확대` 비활성 (전부 실측) |
| `처음 위치로` 복귀 | z19·팬 이후 클릭 → 축척 100m, 라벨 5개 좌표가 **초기값과 픽셀 동일**(①8/113 ②49/14 ③143/50 ④130/324 ⑤109/360) |

- 로드뷰 상태에서는 **`지도로 돌아가기` 단 하나만** 렌더한다. 확대·축소·처음 위치로·내 위치는 **보이지 않는
  지도**를 조작하므로 결과를 볼 수 없다 — §20.14.3 이 금지한 **죽은 버튼**이 된다.
  스펙은 "로드뷰 상태에서 첫 번째 버튼"이라고만 썼고, 그것을 **목적으로 해석**한 판단이다.
  **리더 승인 완료(2026-08-19)** — "보이지 않는 지도를 조작하는 버튼은 결과를 볼 수 없어 죽은 버튼이다.
  스펙이 '첫 번째 버튼'이라고만 쓴 부분을 목적으로 해석한 것이 맞다." **이 근거를 지우지 마라.**
- 상태 문구는 `role="status"` **하나를 내 위치와 로드뷰가 공유**한다. 지도 확대·축소·이동은 문구를 만들지 않는다.

### 21-3. 라벨 접힘 (§21.2) — 등급 + 화면 좌표 교차

- `labelPriority` 를 `MAP_FEATURES` 데이터 필드로 추가(`src/lib/rallyMap.ts`). ①④ `primary`, ②③⑤ `secondary`,
  `tertiary` 는 값만 준비(⑥ 미구현).
- 접힘은 **텍스트 pill 만** 접고 **번호 배지는 남긴다**(`data-rally-folded="1"`). 범례가 번호를 설명하므로
  §0.4 은폐가 아니다.
- 겹침 판정은 **렌더 후 `getBoundingClientRect()` 교차**(지리 좌표 추정 금지, §20.23.5).

| 실측 | 결과 |
|------|------|
| 초기(z16, 360·768) | **①②③④⑤ 텍스트 전부 노출**, 접힘 0 — §21.8-107 ✓ |
| z15(축척 300m) | **②③⑤ 배지로 접힘 · ①④ 텍스트 유지**. ① y151~185 / ④ y285~320 → **수직 100px 이격, 겹침 0** — §21.8-108 ✓ |
| z19(축척 20m) | 접힘 0(전부 노출) |
| 범례 | 접힘과 무관하게 항상 5행 — §21.8-109 ✓ |

#### ⚠ 스펙 충돌 1건 — 겹침 임계값 8px → **0(실교차)** 으로 구현 (리더 승인, 디자이너 판정 대기)

§21.2.3 은 "8px 미만이면 겹침으로 본다"고 규정한다. 그런데 **현행 초기 화면(z16)의 라벨 사이 실측
간격이 1~2px** 다(360px: ② 바닥 y49 ↔ ③ 머리 y50, ④ 바닥 y359 ↔ ⑤ 머리 y360).
8px 를 그대로 적용하자 **처음 보는 화면에서 ③⑤ 가 즉시 배지로 접혔다**(§21.8-107 위반, 실측 확인).

- §26·§27 의 라벨 배치는 밴드·부지 가림 0% 를 맞추느라 **자유 공간을 8px 하한에 남김없이 나눈 결과**이고,
  라벨끼리는 그때 1~2px 로 붙었다(03 문서 §27.8 표의 여백과 일치). 여백을 벌리려면 그 결과를 다시 흔들어야
  하는데, 리더 지시는 **"초기 뷰는 지금과 같아야 한다"** 였다.
- 임계값 0(실제 교차 시에만 접음)으로 두어도 **§21.8-108 은 성립한다** — z15 에서는 지물 간 화면 거리가
  절반이 되어 ②③·④⑤ 가 실제로 교차하고, 등급 임계(secondary ≥ 16)가 먼저 접는다.
- 코드에 `LABEL_MIN_GAP = 0` 과 근거를 남겼다. **임계값만 8 로 되돌리지 마라 — 라벨 배치부터 재설계해야 한다.**
- **리더 판단(2026-08-19): 실교차 방식 유지.** 다만 *"이건 증상이 아니라 신호다 — 라벨 배치가 1~2px
  간격으로 포화 상태라는 뜻"* 이라며 **디자이너에게 §26·§27 라벨 배치 재설계 판정을 요청**한 상태다.
  판정이 오기 전까지 이 구현이 기준이다.

### 21-4. 로드뷰 (§21.3)

- **같은 박스를 덮는다.** 지도 마운트를 `display:none` 으로 숨기지 않고 `inert` 만 걸고 그 위에 파노라마
  레이어를 덮는다. 숨긴 지도는 컨테이너를 0으로 읽어 복귀 시 타일이 어긋나고, 되돌리려면 뷰를 초기화해야
  해 조합원이 보던 자리를 잃기 때문이다. `inert` 로 **아래 레이어의 Tab 정지점 5개가 전부 빠지는 것**을 실측했다.
- **`submodules=panorama` 필수** — 없으면 `maps.Panorama` 자체가 없다. 또한 이 서브모듈은 **본 스크립트
  `onLoad` 이후에 도착**한다(실측: onLoad 시점 `undefined`, 1.5초 뒤 `function`). 한 번만 확인하면
  `로드뷰 보기` 버튼이 영영 안 나온다 → 200ms 간격 재확인, 8초 시한 후 미지원 확정(죽은 버튼 금지).
- 실측: 버튼 클릭 → `로드뷰를 불러오는 중입니다.` 노출 → 파노라마 렌더(박스 328×410 불변) →
  `지도로 돌아가기` 단독 노출 → 복귀 시 축척 100m·라벨 5개 그대로. 새로고침하면 **항상 지도**(상태 미기억).
- 실패 경로: `pano_status` 가 OK 가 아니거나 8초 내 `getPanoId()` 가 없으면 **박스를 지도로 되돌리고**
  `이 위치의 로드뷰를 불러오지 못했습니다.` 를 공유 `role="status"` 에 낸다. 버튼은 남는다(재시도 가능).
  **5번 출구는 파노라마가 존재해 실패 경로는 인위 유발로만 확인 가능** — 실측 미완(리더 판단 요청).
- `sr-only` `로드뷰는 시각 자료입니다. 위치 안내는 위 텍스트를 참고해 주세요.` 를 마운트 앞에 둔다(실측 확인).

### 21-5. 대오 명칭 (§21.6)

| 자리 | 처리 |
|------|------|
| 블록 2 첫 줄 | `더샵아일랜드파크 앞 의사당대로 · [결의대회대오 2]` → **`더샵아일랜드파크 앞 의사당대로`** |
| 지도 대체면 | `… 의사당대로 [대오 2]` → **`코스콤지부 — 더샵아일랜드파크 앞 의사당대로`** |
| 지도 라벨 ④ · 범례 ④ | **유지** |

`grep -rn "결의대회대오" src/` → **0건**. `[대오 2]` 는 `src/lib/rallyMap.ts` 의 라벨·범례 2곳에만 남는다.
코드 주석에도 리터럴을 쓰지 않았다(QA grep 오탐 방지).

### 21-6. 검증

- `tsc --noEmit` 0 · `eslint` 0 · `next build` 성공 · 브라우저 콘솔 에러 0.
- **타입 우회 0**: `any`·근거 없는 `as` 없음. 파노라마 타입은 `src/lib/naverMaps.ts` 에 직접 선언했고
  `Panorama` 는 **선택 필드**다(런타임에 없을 수 있다는 사실을 타입이 말한다).
- **텍스트 확대 200%**: `main` 안 넘침 **0**(컨트롤 행은 5행으로 접히며 폭 유지). 문서 가로 스크롤 34px 은
  **`footer img.h-7`** 이 원인 — FOLLOWUPS 7번 기지 항목이고 §21 과 무관하다.
- 스크린샷은 MCP 스크린샷 호출이 5초 시한을 넘겨(페이지가 길고 지도 캔버스가 무겁다) 남기지 못했다.
  근거는 위 수치 실측이다.

### 21-7. 미구현 · 리더 판단 대기

1. **§21.4 화장실 ⑥** — 스펙은 이미 **확정본**(검증 6회차, 좌표 `37.525530, 126.919669`)이지만 리더 지시는
   "자리만 열어라"였다. `labelPriority: "tertiary"`(z≥17) 와 등급 인프라는 완성돼 있어 **`MAP_FEATURES`
   항목 1개 추가 + 범례 문구**로 끝난다. 다만 §21.4.4 가 요구하는 **fitBounds 축척 재실측**이 따라붙는다.
2. **§21.5 종료 20:30** — `<dl>` 3행 확장은 문안·출처 확정 대기. 값 미투입.
3. **핀치·한 손가락(coarse pointer)** — 실기기 확인 필요.
4. **로드뷰 실패 경로** — 실패 지점을 만들 수 없어 코드 경로만 확인.

---

## §21.4 화장실 표시 — ⑥ 여의도공원 입구 (2026-08-19)

리더 지시(§21.4 확정본, 검증 6회차 요구 36~44) 구현. **§21.5 종료 20:30 은 여전히 값 미투입**이다.

### 21.4-1. 무엇을 그렸고 무엇을 그리지 않았는가

| 항목 | 구현 |
|------|------|
| 좌표 | `PARK_ENTRANCE = { lat: 37.52553, lng: 126.919669 }` (`src/lib/rallyMap.ts`) |
| 기호 | **실선 도트 + `go`(파랑)**. 점선 원 아님 · 공원 면 아님 |
| 라벨 | **`⑥ 여의도공원 입구`** — `화장실` 단독 표기 **0건**(코드 라벨 문자열 전수 확인) |
| 범례 | `● ⑥ 여의도공원 입구 — 화장실은 공원 안에 있습니다. 정확한 위치는 현장 안내판을 확인해 주세요` |
| 등급 | `tertiary`(z ≥ 17) |
| 화장실 카드 | 2줄째에 `코스콤지부 집결 위치에서 여의도공원까지 약 80 m (도보 약 1분)` 추가. **기존 3줄 한 글자도 불변**(실측 문자열 대조) |

- **개별 화장실 핀은 여전히 없다.** 코드 주석에 "이 좌표는 공원에 들어가는 지점이지 화장실 위치가 아니다"를
  근거와 함께 남겼다 — 나중에 누가 라벨을 `화장실` 로 줄이면 **도트가 거짓말을 하게 된다.**
- 5번 출구 기준 거리는 **본문·주석 어디에도 숫자로 남기지 않았다**(QA grep 오탐 방지).

### 21.4-2. `fitBounds` 재실측 — **축척 100m 유지, 초기 화면 변화 0**

§21.4.4 가 "⑥ 이 밴드 남동단보다 20m 더 남동이라 표시 범위가 넓어진다"고 우려했으나,
**실측 결과 bbox 가 전혀 바뀌지 않았다** — ⑥ 이 기존 bbox(부지 폴리곤이 만드는 남·동 극점) **안에** 든다.

| 뷰포트 | 박스 | 축척 | 기존 라벨 5개 좌표 | ⑥ |
|--------|------|------|--------------------|-----|
| 360px | 328×410 | **100 m** | ①8/113 ②49/14 ③143/50 ④130/324 ⑤109/360 — **§27.8 표와 전부 동일** | 배지 272~300 / 278~306 |
| 768px | 704×396 | **100 m** | ①196/106 ②237/7 ③331/43 ④318/317 ⑤297/353 — **동일** | 배지 460 / 271 |
| 1280px | 896×504 | **100 m** | 변화 0 | 배지 |

**§21.4.7-119 충족.** 박스 높이를 키울 필요가 없었다.

### 21.4-3. ⚠ 스펙 이탈 2건 — **리더 수용 완료(2026-08-19)**

> 두 건 다 리더가 수용했고 **스펙 문구 갱신 대상**으로 디자이너에게 통보됐다.
> *"체크리스트를 통과시키려고 배치를 고른 게 아니라, 옳은 배치가 체크리스트를 성립시킨 것이라 순서가 맞다."*
> **되돌리지 마라 — 되돌리면 아래 실측 수치가 그대로 재발한다.**

#### (1) 접힌 배지의 위치 — 앵커 중심 → **라벨 방향으로 이동**

초판 구현은 배지를 앵커 위에 얹었다. ⑥ 을 넣고 폴리곤 단위로 재측정하니 **그 배지가**
**대오 2 밴드 외곽선 6.7% · 부지 외곽선 12% 를 덮었다**(360px, 표본 3,600점). 자기 도트도 가렸다.
→ 배지도 pill 과 **같은 `placement`·`gap`** 을 쓰도록 고쳤다. 라벨 배치는 이미 "도형을 덮지 않는 방향"으로
계산돼 있으므로 접힌 배지가 그것을 따르는 것이 옳고, 접고 펼 때 배지가 튀지도 않는다.

#### (2) ⑥ 라벨 방향 — 스펙의 **남쪽** → **동쪽**(26px)

§21.4.3 은 "라벨 앵커 고정 — 도트의 남쪽. 밴드가 북서로 뻗어 있어 남쪽이 비어 있다"고 규정했다.
**도형에 대해서는 맞다. 그러나 z16 초기 화면에서 도트 남쪽은 ④·⑤ 라벨 pill 이 통째로 점유한다**
(④ y324~359 · ⑤ y360~394, 둘 다 x109~297, 도트는 x246). 남쪽에 두면 배지가 **④ pill 을 10px 덮고**,
간격을 키우면 ⑤ pill 에 걸리며, 더 내리면 박스 아래로 잘린다(하단 여백 16px).

**4방향 × 5간격 = 20개 후보를 실측**(도형 외곽선 표본 교차 + pill 사각형 간격 + 박스 여백)한 결과
`도형 가림 0 · pill 여백 ≥ 8px · 박스 여백 ≥ 4px` 를 만족한 것은 **동쪽 계열뿐**이었다.

| 채택값 | 도형 가림 | ④ pill 과의 여백 | 박스 우측 여백 |
|--------|-----------|------------------|----------------|
| **동쪽 26px** | **0** | **18 px** | 28 px |

부수 효과로 **§21.4.7-122 가 요구한 "z17 에서 텍스트 pill" 이 실제로 성립**한다 —
남쪽 배치일 때는 ④ pill 과 겹쳐 **z19 까지 접혀 있었다**(실측). 동쪽 배치에서는 z17 에 ④ 와 **9px** 이격.

**둘 다 리더·디자이너 확인 대상**이다. 스펙 문구를 고칠지, 배치를 되돌리고 ④⑤ 라벨을 재설계할지는
디자이너 판단 영역이라 임의로 정하지 않았다.

### 21.4-4. 라벨 예산 재검산 (폴리곤 단위, 라벨 6개)

| 뷰포트 | 원(②) | 대오 1 | 대오 2 | 부지 | 잘림 | 라벨 최소 여백 |
|--------|-------|--------|--------|------|------|----------------|
| 360px | 13.2% / 9.0% | **0% / 0%** | **0% / 0%** | **0% / 0%** | **0** | 1px(②↔③, 종전과 동일) |
| 768px | 13.2% / 9.0% | **0% / 0%** | **0% / 0%** | **0% / 0%** | **0** | 1px(②↔③) |
| 1280px | 13.2% | 0% | 0% | 0% | **0** | 1px(②↔③) |

**⑥ 을 추가하고도 §27.8 기준선(밴드 0% · 부지 0% · 원 13/9)이 그대로다.**
문자열을 줄인 곳은 없다. 200% 텍스트 확대에서 화장실 카드 포함 `main` 넘침 **0**.

### 21.4-5. 남은 관찰 · 판단 대기

1. **z15(사용자가 축소한 상태)에서 ⑤ 배지가 ④ pill 을 일부 덮는다.** 배지는 접힘의 종착 상태라
   더 접을 수 없다. 도형 가림은 z15 에서도 **0%** 다. 초기 화면(z16)의 문제가 아니라 재설계하지 않았다.
   **리더 판단(2026-08-19): 현행 유지 · 기록만 남긴다.** 사용자가 의도적으로 축소한 상태이며
   §21.2 가 "확대 방향은 해결하지 않는다"고 정한 것과 같은 성격이다.
2. **범례 각주**(`LEGEND_FOOTNOTE`) — **검증자 판정 대기. 건드리지 마라(리더 지시 2026-08-19).**
   여전히 `화장실은 좌표가 확인되지 않아 지도에 표시하지 않았습니다` 다.
   ⑥ 이 생긴 지금도 **사실로서 참**이고(표시한 것은 공원 입구다) ⑥ 범례가 그 구분을 설명하지만,
   두 문장이 나란히 놓이는 그림은 **디자이너·검증자 확인이 필요**해 손대지 않았다.
3. **§21.5 종료 20:30** — 값 미투입 유지(출처 확보 전 게시 불가).

---

## §22 라벨 포화 재판정 + §21.5 종료 시각 확정 (2026-08-20)

`02_designer_spec.md` §22.0 변경표 6건 + 검증 8회차(요구 52~56) + 9회차(요구 57~66) 반영.
**모든 수치는 실제 지도가 렌더된 상태에서 실측**했다(`isPointInStroke`/`isPointInFill` 1px 격자 전수 · 3뷰포트).

### 22-1. §22.0 변경표 6건 — 전부 적용

| # | 항목 | 적용 위치 |
|---|------|-----------|
| 1 | ② `메인무대(설치 예정)` → **`메인무대(예정)`** | `rallyMap.ts` 라벨. 범례 ② 행은 `주최측 설치 예정` 완전형 그대로 |
| 2 | ③ 접미어 제거 | **`BAND_STYLE.estimated.labelSuffix = ""`**(`RallyMap.tsx`). `id` 분기 아님 — 확신도 데이터 모델 유지(§20.20.2) |
| 3 | ④ `코스콤지부 [대오 2]` → **`코스콤지부`** | `RALLY_COLUMNS[column-2].label`. `[대오 2]` 는 **범례 ④ 행 한 곳에만** 남는다 |
| 4 | ③ `labelGap` 47 → **41** | ②↔③ 2px → **8.0px** |
| 5 | ⑤ `labelPriority` → **`tertiary`** | z16 배지 · z17 텍스트 |
| 6 | ⑤ `labelGap` 38 → **44** | ④↔⑤ 2px → **8.0px** |

범례 3행·키 줄 **diff 0**, ①②④⑥ 의 `placement`·`labelGap` **변경 0**, 지도 중심·줌·축척·도형 크기 **변경 0**.

### 22-2. ⚠ 스펙 표에 없던 1건 — **⑤ 배지 `labelAlign: "west"` 추가**

§22.6 표는 ⑤ 강등 후 `축척·로고 침범 0` 으로 적었으나, **실측에서 침범이 남았다.**

- 그 계산은 `© NAVER Corp.` 를 **x10~88 로만** 잡았다. 실제 렌더에는 **그 오른쪽에 네이버 로고
  이미지가 하나 더 있다**(360px: **x211~256 · y393~403**). 가운데 정렬 ⑤ 배지(x189~217)가
  그 로고의 좌상단을 **6×1px 덮었다.**
- 360px 하단의 빈 가로 구간은 **x88.2~211 (122.8px)** 뿐이다. **서쪽 정렬**로 배지를 **x150~178** 에
  놓아 로고까지 33px, 저작권 문구까지 62px 를 확보했다.
- **세로 앵커는 부지 최남단 그대로**라 ④↔⑤ **8.0px** 과 부지 가림 0% 는 영향받지 않는다.
  768·1280 에서는 원래 여유가 있어 이동해도 충돌이 없다(실측).

> §22.10 이 `지도 크롬 가림 0%` 를 2급 제약으로 세운 그 항목에 **실측이 하나 더 걸린 것**이다.
> **`labelAlign: "west"` 를 지우지 마라 — 지우면 로고 침범이 재발한다.**

### 22-3. §21.9.3 히스테리시스 구현 (체크리스트 152)

접기와 펴기의 임계를 분리했다: **접기 = 실교차(0px) · 펴기 = 8px**(`LABEL_MIN_GAP` / `LABEL_REVEAL_GAP`).
한 값으로 양방향을 판정하면 경계 줌에서 라벨이 깜빡인다. 접힘 상태는 `foldedRef` 가 기억한다.

### 22-4. 초기 뷰(z16) 3뷰포트 실측 — **§22.7 표 재현**

| 뷰포트 | 박스 | 축척 | 최소 쌍간격 | 다음 순위 | 박스 여백 최솟값 | 지도 크롬 침범 | 대오1/대오2/부지 | 잘림 |
|--------|------|------|-------------|-----------|------------------|----------------|------------------|------|
| 360 | 328×410 | **100 m** | **8.0**(②③ · ④⑤) | 18(④⑥) | **8.28**(① 좌) | **0** | **0% / 0% / 0%** | **0** |
| 768 | 704×396 | **100 m** | **8.0**(②③ · ④⑤) | 18(④⑥) | **8**(② 상) | **0** | **0% / 0% / 0%** | **0** |
| 1280 | 896×504 | **100 m** | **8.0**(②③ · ④⑤) | 18(④⑥) | **62**(② 상) | **0** | **0% / 0% / 0%** | **0** |

- **라벨 폭**(360 실측): ① **97.72** · ② **135.00** · ③ **82.39** · ④ **110.83** — §22.7 표와 동일.
  최장 라벨이 ② 135.00px 이고 `max-width` 197px 안에서 1줄(여유 62px) — 체크리스트 156 ✓
- **z16 구성: 텍스트 pill 4개(①②③④) · 번호 배지 2개(⑤⑥)** — 체크리스트 148 ✓
- **768 ⑤ 배지 하단 여백 9px**(10px 미만 — 실측값이며 폰트 렌더링이 바뀌면 재측정 필요)
- ⑤ 배지 위치(360): **x150~178 · y366~394** / ⑥ 배지: **x272~300 · y278~306**

**줌 동작**(360 실측)

| 상태 | 결과 |
|------|------|
| z17 | ⑤ `여의도더샵아일랜드파크`(원문 그대로) · ⑥ `여의도공원 입구` **텍스트 pill 노출**, 최소 간격 **37px** — 체크리스트 149 ✓ |
| z18 | 유지, 최소 간격 103px |
| z16 복귀 | 배지 2개로 정확히 복귀, 좌표 동일 |
| `처음 위치로` | 초기 화면과 **픽셀 동일**(축척 100m) — 체크리스트 153 ✓ |

**별건(체크리스트 157)**: ① `5번 출구` 가 메인무대 점선 원을 덮는 비율은 **본선 10.22% · 내부 8.14%**
(3뷰포트 동일, 개정 전후 불변). §22.11 이 신규 회귀가 아니라고 명시한 항목이며 수치만 기록한다.
스펙의 12.28% 와 차이가 나는 것은 측정 방식(1px 격자 전수 vs 스펙 측정) 차이로 보인다 — **경향은 동일**.

### 22-5. 검증 8회차 (요구 52~56)

| 요구 | 반영 |
|------|------|
| 52 | ⑥ 범례에서 **미검증 문구(공원 안내 표지 확인) 삭제.** 소스 전체 grep **0건** |
| 53 | ⑥ 범례 = `여의도공원 입구 — 확인된 위치입니다. 화장실은 공원 안에 있으며, 개별 위치는 확인되지 않아 지도에 표시하지 않았습니다 — 위 화장실 안내를 참고해 주세요.` |
| 54 | 범례 각주 = **LED무대 문장만**(화장실 문장은 ⑥ 행으로 **이관**, 정보 손실 0) |
| 55·56 | 범례 ②③④·키 줄 **무수정** · 지도 라벨 `여의도공원 입구` **무변경** |

### 22-6. 검증 9회차 (요구 57~66) — 블록 1 종료 시각

`<dl>` 3행 + 각주 2줄. **문안은 9-9 기준값과 문자 단위로 일치**(실측 대조).

| 항목 | 실측 |
|------|------|
| `<dt>` 순서 | `본대회` / **`코스콤지부`** / `장소` — **`종료` 라는 단어 0건** (158·162 ✓) |
| `<dd>` | `20:30까지 참가 계획` — **18px / weight 400 / `#1a1a1a`**, `19:00 개회` 와 완전 동일 (159·161 ✓) |
| `18:30` | **40px / 700 — 페이지 유일 최대 크기**(다음이 h1 28px). 4행 + 각주 2줄로 늘어난 뒤에도 최상위 (요구 66 ✓) |
| 각주 2줄 | 18px **`#1a1a1a`(ink)** — `ink-muted` 아님 (161 ✓). 색 강조·대형 수치 0 |
| `<dl>` 그리드 | **64.83px / 207.17px** — §22.13.4 실측 예측치와 **동일** |
| `장소` `<dd>` | **2줄 유지**(160 ✓) |
| 전파 금지(63) | `20:30` 은 **블록 1 밖에 0건** — 히어로·`RallyEntryCard`·`metadata.description`·`struggleSchedule.ts` 무수정(grep 확인) |
| 요구 15 | `QrAttendanceCard.tsx` **diff 0** |

`<time>` 은 `18:30` 전용을 유지했다(§22.13.5) — 한 표에서 한 행만 마크업이 다르면 그 차이가 의미로 읽힌다.
경과 후 문구를 과거형으로 바꾸는 코드는 **넣지 않았다**(요구 64).

### 22-7. 그 밖의 검증

- `tsc` 0 · `eslint` 0 · `next build` 성공 · 브라우저 콘솔 에러 0
- 대비(§22.14): ⑤ 배지 `#ffffff on #4b5563` = **7.56**, ⑥ 배지 `#ffffff on #093389` = **11.37** (스크립트 실측). **신규 색 조합 0**
- 텍스트 확대 200%: `main` 안 넘침 **0**, `<dl>` 3행 유지(그리드 25.94/186.69px)
- **체크리스트 154 — 지도+범례가 360×640 한 화면에 들어가지 않는다**: 지도 박스 410 + 범례(6행, ⑥ 이 3줄)로
  **총 869px**. 뷰포트 640 을 229px 초과한다. §21.9.5 대로 **기록만 하고 범례는 줄이지 않았다**
  (범례 문구가 검증 조건이다). 박스 410px 은 §20.23 이 축척 100m 를 위해 확정한 값이라 손대지 않았다.

---

## §23 두 손가락 팬 제거 (QA 19회차 권고 채택 · 2026-08-20)

### 23-1. 무엇을 왜 뺐나

**두 손가락 `panBy` 로직을 제거했다.** `RallyMap.tsx` 의 `touchmove`/`touchend`/`touchcancel` 리스너가
통째로 사라지고, 그 `useEffect` 에는 **Ctrl/⌘ + 휠 처리만** 남는다.

- **QA 19회차 실측**: 두 손가락 **간격을 100px 로 고정한 채 평행이동**시켰는데도 축척이
  100m → **300m(줌 2단)** 로 떨어졌다. 네이버 지도의 `pinchZoom` 과 우리 `panBy` 가
  **같은 2-touch 제스처를 나눠 갖지 못한다.**
- **이동하려다 축척이 바뀌는 것은 조작이 아니라 사고다.** 조합원이 대오를 보려고 옮기는 순간
  지도가 3배 축소되면 얻는 것보다 잃는 것이 크다.
- §21.1.1 이 **예견해 둔 fallback** 이다(*"두 손가락 팬 구현이 불안정하면 그것만 빼도 된다"*).
  **핀치(확대·축소) + `처음 위치로`(복귀)** 만으로 "정적이라 답답하다"는 원래 요구는 충족된다.
- **`처음 위치로` 버튼은 유지**한다 — 핀치로 화면이 틀어졌을 때의 **유일한 복귀 경로**다.

> **되살리려면 조건이 있다: 핀치와 팬 제스처가 실제로 분리되는지부터 실기기에서 실측하라.**
> **한 손가락 팬을 여는 것으로 대체하지 마라 — 그것이 원래 막으려던 사고다.**
> 이 단서는 `RallyMap.tsx` 조작 계약 주석과 `naverMaps.ts` 의 `panBy` 선언 위에 함께 남겼다
> (타입 선언은 재검토 시 다시 만들지 않도록 남겨 뒀고, 현재 호출부는 0이다).

### 23-2. 제거 후 실측 (360px)

| 항목 | 결과 |
|------|------|
| 두 손가락 평행이동(간격 100px 고정, 6스텝) | **축척 100m 불변** · 오버레이 이동 **0px** · **페이지 스크롤 0px** · `처음 위치로` 비활성 유지(상태 변화 없음) |
| QA 기록 "두 손가락 이동 중 페이지 4px 스크롤" | **재현되지 않는다**(0px) |
| 맨 휠 | `defaultPrevented=false` · 축척 **100m 불변**(페이지 스크롤 우선) |
| Ctrl + 휠 | `defaultPrevented=true` · 100m → **50m** |
| `축소` → z15 | 축척 300m · `축소` 버튼 **비활성** |
| `처음 위치로` | 초기 화면과 **좌표 문자열 단위로 동일**(①8,113 ②65,15 ③185,57 ④158,324 ⑤150,366 ⑥272,278) |
| 초기 뷰 | pill 4 · 배지 2 · 최소 간격 **8.0**(②③) · 축척 **100m** — §22 실측과 불변 |
| 컨트롤 행 | 5버튼 유지(`축소`·`확대`·`처음 위치로`·`내 위치 표시`·`로드뷰 보기`) |

`tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0.

**핀치 자체는 코드 변경이 없다**(`pinchZoom: true` 그대로). 제거한 것은 우리 리스너뿐이므로
**핀치 동작 확인은 기기 에뮬레이션/실기기 QA 몫**이다.

### 23-3. 대기 중 (디자이너 판정)

1. **로드뷰에서 한 손가락 스크롤 차단** — 파노라마 뷰어의 중첩 div 3겹이 `touch-action: auto` 이고
   자체 회전 제스처로 `preventDefault` 한다. `pan-y !important` 로 막으면 **로드뷰를 회전할 수 없어
   기능이 목적을 잃는다.** 설계 충돌이라 **임의로 고치지 않는다.**
2. **z15 에서 ④ pill × ⑤ 배지 336px² 중첩** — ④ 는 `primary` 라 안 접히고 ⑤ 는 이미 배지라
   더 접을 단계가 없다. 히스테리시스로 해소되지 않는 **3등급 체계의 한계**다.

---

## §23(스펙) 반영 — 로드뷰 전체 화면 모달 · `minZoom` 설계 승격 (2026-08-20)

`02_designer_spec.md` §23.0 변경표 5건 + §23.1.5 구현 스펙 + §23.2 를 반영했다.

### 23s-1. 로드뷰 = 전체 화면 `<dialog>` 모달 (§23.0-1~4)

| 항목 | 구현 |
|------|------|
| 여는 방법 | **`showModal()` 만** 사용 — 포커스 트랩·`Esc`·배경 `inert`·top-layer 를 브라우저가 제공한다. 직접 구현하지 않았다 |
| 크기 | `h-[100dvh] w-full max-w-none m-0 p-0 border-0` · `bg-black` · `backdrop:bg-black/80` |
| `닫기` | 상단 우측 `top/right: max(12px, env(safe-area-inset-*))`, §20.14.3 아웃라인 필(불투명) 재사용, `autoFocus`, 상시 노출 |
| `::backdrop` 클릭 | **핸들러를 붙이지 않는 것이 곧 구현이다** — 회전 중 오탭으로 닫히면 안 된다 |
| 배경 스크롤 | `showModal()` 과 **별도로** `body{position:fixed; top:-scrollY; overflow:hidden}` |
| 지도 | **페이지에 그대로 있다.** 박스 토글이 만들던 "지도가 지금 없는 상태"가 사라졌다(§23.1.4 조건 ⑤) |
| 컨트롤 행 | **항상 같은 5개.** `view` 분기 제거, `지도로 돌아가기` 는 모달 안 `닫기` 로 이동 |
| 파노라마 마운트 | `touch-action` 을 **건드리지 않는다** — 모달 안에서는 한 손가락 회전이 설계된 동작이다 |

#### ⚠ 스크롤 복원에 필요한 두 가지 (둘 중 하나만 빠져도 어긋난다 — 실측)

1. **레이아웃 강제 반영**(`void document.body.offsetHeight`) — `position:fixed` 를 막 푼 시점에는
   문서 높이가 아직 **뷰포트 높이(800)** 라 `scrollTo` 가 **0 으로 잘린다.**
2. **`behavior: "instant"`** — 이 사이트는 `globals.css` 에 `html { scroll-behavior: smooth }` 가 있어
   기본값으로 부르면 **애니메이션 도중 브라우저 자체 복원과 경합**한다(실측: 목표 3355 → 3247).
3. `focus({ preventScroll: true })` — 기본 `focus()` 는 대상을 보이려고 스크롤을 옮긴다(실측 **818px 이탈**).

세 가지를 모두 적용한 뒤 **왕복 2회 모두 `scrollY` 델타 0px** 이다.

### 23s-2. 로드뷰 실측 (§23.1.6 새 합격 기준)

| # | 항목 | 결과 |
|---|------|------|
| 164 | `닫기` 상시 노출 | top 12 · right 12 · 44px, 항상 보임 |
| 165 | 닫은 뒤 `scrollY` | **±0px**(왕복 2회) · 포커스 **`로드뷰 보기` 복귀** |
| 167 | `Esc` / `::backdrop` | **`Esc` 로 닫힘**(실키 입력) · **backdrop 클릭으로는 안 닫힘** |
| 168 | 포커스 순회 | `닫기` → (파노라마가 삽입한 네이버 로고 링크) → `닫기` 로 **순환**. **배경 요소는 순회에 없다** |
| 169 | 높이 | 모달 `800px` = 뷰포트 높이(**`100dvh`**) |
| 170 | 지도 보존 | 닫으면 지도·라벨·축척 100m 그대로 |
| 171 | 실패 경로 | **실측 확인**(`getPanoId()` 만 null 로 만드는 런타임 래퍼로 "파노라마 없음" 재현): 시한 후 **모달이 닫히고** `role="status"` 에 `이 위치의 로드뷰를 불러오지 못했습니다.`, 버튼 유지, 스크롤 ±0, **검은 화면에 머물지 않음** |
| 172 | 새로고침 | `dialog.open === false` · `display:none` |
| 173 | 컨트롤 행 | 항상 5개 · 360px **2행** · 가로 스크롤 0 |

- **모달 안 포커스 정지점이 2개다**(`닫기` + 네이버 로고 링크). §23.1.5 는 "정지점 `닫기` 하나"로 적었지만
  로고 링크는 **파노라마 뷰어가 삽입하고 네이버 지도 이용 조건상 유지 대상**이다(지도 쪽 `© NAVER` 링크와 같은 성격).
  제거하지 않았다 — **판정 필요 시 리더·디자이너에게 올린다.**
- 조작 계약 재확인(지도 상태): `touch-action: pan-y` · 한 손가락으로 지도 **이동 0** ·
  맨 휠 `defaultPrevented=false`·축척 불변 · Ctrl+휠 `true`·100m→50m.

### 23s-3. `minZoomOverride` — z15 를 설계 대상으로 (§23.0-5 · §23.2)

- `MapFeatureBase.minZoomOverride?: { placement?; labelGap? }` 신설. **`z === MAP_MIN_ZOOM` 에서만** 적용된다.
- ⑤ dsharp: **`{ placement: "left", labelGap: 26 }`**. ①②③④⑥ 은 오버라이드 없음.
- 방향·간격 해석은 **`labelPlacementAt(feature, zoom)` 한 곳**이 담당한다(컴포넌트에서 분기 금지).
  방향이 바뀌면 **앵커 좌표도 함께 옮겨야** 하므로 `marker.setPosition()` 을 함께 호출한다 —
  아이콘만 갈아끼우면 라벨이 옛 앵커에 붙은 채 방향만 뒤집혀 **엉뚱한 곳을 가리킨다.**

#### z15 실측 (360px · 픽셀 전수)

| 항목 | 기준값(§23.2.4) | **실측** |
|------|-----------------|----------|
| ⑤ 배지 | x110~138 · y229.5~257.5 | **x110~138 · y230~258** |
| ④↔⑤ | +27.5 | **+27** |
| 전체 쌍 최솟값 | 19.0(②③) | **19.0(②③)** |
| ④↔⑥ | 23.0 | **23.0** |
| 박스 여백 최솟값 | 24.3(① 좌) | **24.3(① 좌)** |
| 도형 가림 | 0px | **0px(대오1·대오2·부지·원 전부)** |
| 크롬 침범 | 0 | **0** |
| 구성 | pill 2 + 배지 4 | **pill 2 + 배지 4 — ①~⑥ 여섯 개가 전부 화면에 있다**(미표시 등급 없음) |

`축소` 버튼은 z15 에서 **비활성**, `처음 위치로` 는 z16 초기 화면으로 **좌표 단위 동일 복귀**.
1280px z15 도 같은 패턴(19/23/27 · 크롬 0 · 도형 0 · 잘림 0)이다.

#### z16 불변 확인 (§22.16-140·141 재실행)

| 뷰포트 | 축척 | 최소 쌍간격 | 박스 여백 최솟값 | 크롬 | 대오1/대오2/부지 | 잘림 |
|--------|------|-------------|------------------|------|------------------|------|
| 360 | 100m | **8.0**(②③·④⑤) | **8.3**(① 좌) | 0 | **0px** | 0 |
| 768 | 100m | **8.0** | **8**(② 상) | 0 | **0px** | 0 |
| 1280 | 100m | **8.0** | **62**(② 상) | 0 | **0px** | 0 |

라벨 좌표도 §22 실측과 동일하다(①8.3,113 ②64.5,15 ③184.8,57 ④157.6,324 ⑤150,366 ⑥272,278).

### 23s-4. 검증

`tsc` 0 · `eslint` 0 · `next build` 성공 · **콘솔 에러 0**.
(측정 중 1건 발생한 콘솔 에러는 **내 테스트 스텁이 가짜 리스너 핸들을 반환해** 네이버 `removeListener` 가
던진 것으로, 제품 코드 경로가 아니다. 실제 인스턴스를 쓰는 재현 방식으로 바꿔 재측정했고 에러 0이다.)

---

## §24 1단계 — 메인무대 표기(범례) · 네이버 길찾기 링크 (2026-08-21)

`02_designer_spec.md` §24.0 변경표 2건. **지도 라벨 ①·②③④⑤⑥ · 범례 ②③④ · 키 줄 · 지도 수치는 변경 0.**

### 24-1. 범례 ① 행 (요구 69 · 필수)

```
① 국회의사당역 5번 출구 — 확인된 위치입니다. 메인무대는 이 앞에 설 예정입니다
```

- 기호는 **실선 도트 `●` 그대로**(요구 8 — 기호는 확인 등급 유지). **구분을 지는 주체가 이 범례 행**이라는
  사실을 `rallyMap.ts` 주석에 남겼다. 문구를 줄이면 확인/예정 구분이 사라진다.
- 지도 라벨 ① 은 **`5번 출구` 그대로**다 — `(메인무대 예정)` 은 360px 박스에 **87.8px 넘쳐** 4방향 전부
  기각됐고 **2단계 팝업으로 이월**됐다(취소 아님).

### 24-2. 네이버 길찾기 링크 (요구 71~77)

블록 1 집결 안내 패널, **`<dl>` 바로 아래 · `※` 2행 위**. URL 은 §24.6 확정 문자열을
`src/lib/routes.ts` `EXTERNAL_LINKS.naverDirections` 에 두고, 표시 도메인은 **`href` 에서 파생**한다
(`NAVER_DIRECTIONS_DISPLAY_HOST` — 링크와 표시가 갈리지 않게. 온누리 카드와 같은 규칙).

**URL 주석에 남긴 것**(요구 78): 좌표부는 네이버 내부 인코딩이라 **형식이 바뀌면 에러 없이 엉뚱한 지도가 뜬다** ·
직접 만들지 마라 · **소수 좌표 형식은 200 을 주면서 마포구 성산동을 보여준다** · 레거시/앱 스킴 금지 ·
**HTTP 200 을 동작 근거로 삼지 마라(SPA)** · **8/28 전 1회 재확인**.

#### 실측 (360px)

| 항목 | 결과 |
|------|------|
| 카드 | **288 × 144.1px** · 가로 넘침 **0** (스펙 예측 140.5 — 제목 줄높이 차 +3.6) |
| 제목 | `네이버 지도로 길찾기` 18px/700 **#093389**(11.37) + **↗ SVG 16×16**(텍스트 문자 아님) |
| 보조 | 2줄 **45px** · 15px/400 **#1a1a1a**(17.40) — `ink-muted` 아님 |
| 메타 | `외부 링크(새 창) · map.naver.com` 15px **#4b5563**(7.56) |
| 접근성 이름 | `네이버 지도로 길찾기 도착지는 국회의사당역 5번 출구입니다. … 외부 링크(새 창) · map.naver.com` — 3중 병행 자동 충족 |
| 위치 | `<dl>` 바로 다음 형제 ✓ · `※` 2행은 그 뒤 ✓ · **지도 컨트롤 행은 5개 그대로**(6번째 버튼 없음) |
| 속성 | `target="_blank"` · `rel="noopener noreferrer"` |
| 768 | 카드 640 × 121.6(보조 1줄) · 넘침 0 |

#### ★ 링크 실호출 확인 (체크리스트 190 — HTTP 200 근거 금지)

**실제로 열어 렌더 결과를 눈으로 확인했다**(스크린샷 확보):
`길찾기 - 네이버지도` 화면이 뜨고 **도착지 입력란에 `국회의사당역 5번 출구`**,
**빨간 `도착` 핀이 국회의사당역 5번 출구에 꽂힌다.** 출발지는 비어 있어 조합원이 입력하면 경로가 나온다
— 보조 문구와 화면이 일치한다. 마포구 성산동 같은 오답이 아니다.

### 24-3. 초기 뷰 불변 확인 (체크리스트 182·183)

| 뷰포트 | 축척 | 최소 쌍간격 | 박스 여백 | 크롬 침범 | 대오1/대오2/부지 | 잘림 | 라벨 ① |
|--------|------|-------------|-----------|-----------|------------------|------|--------|
| 360 | **100m** | **8.0**(②③·④⑤) | **8.3**(① 좌) | **0** | **0px** | 0 | **`5번 출구`** |
| 768 | **100m** | **8.0** | **8**(② 상) | 0 | **0px** | 0 | 동일 |

라벨 좌표도 §22·§23 실측과 **완전히 동일**(①8.3,113 ②64.5,15 ③184.8,57 ④157.6,324 ⑤150,366 ⑥272,278).
범례 행이 2줄이 되어도 **지도 박스·도형·축척에는 영향이 없다**(범례는 박스 아래 `figcaption`).

### 24-4. 체크리스트 192 — §21.9.5 재확인 (기록)

360×640 에서 **지도 + 범례 = 891px**(종전 869 → **+22**, 스펙 예측 +22.5와 일치). 뷰포트 640 을 **251px 초과**한다.
**범례를 줄이지 않았다** — 문구가 검증 조건이다(요구 69·71). §21.9.5 규칙대로 기준을
*"지도 바로 아래 인접"* 으로 두고 이 사실을 기록한다.

### 24-5. 검증

`tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0(경고 1건은 Next.js CSS preload 안내로 이 변경과 무관).
대비 실측: 제목 **11.37** · 보조 **17.40** · 메타 **7.56** · 보더 **4.83**(UI 3:1) — **신규 색 조합 0**.

### 24-6. 2단계 인수인계 확인 (§24.9)

이월 부채를 알고 있다: ① 팝업에 `5번 출구 (메인무대 예정)` 전문 + 범례 ① 문장을 함께 넣고,
①② 는 팝업에서도 병합하지 않으며, 팝업이 생겨도 범례를 지우지 않는다.
2단계로 pill 예산 제약이 풀리면 `labelGap`·`minZoomOverride` 상수 정리 대상이 된다.

---

## §25 2단계 — 라벨 클릭 팝업 (2026-08-21)

`02_designer_spec.md` §25.0 변경표 7건. **초기 뷰의 ②④ 위치·축척·도형은 변경 0.**

### 25-1. `textMode` 신설 — `labelPriority` 와 축을 분리

`MapFeatureBase.textMode: "always" | "popup"`. ②④ = `always`, ①③⑤⑥ = `popup`(내 위치 = `always`).
`popup` 항목은 **줌이 올라가도 텍스트를 띄우지 않는다** — ⑤⑥ 의 z17 pill 노출은 폐기(§25.11).
`popup` 항목의 `labelPriority` 는 무시되지만 **지우지 않았다**(3단계 복원 근거).

### 25-2. 노출 정책 실측 (360px · z16)

| 항목 | 결과 |
|------|------|
| 텍스트 pill | **정확히 2개** — `②메인무대(예정)` · `④코스콤지부` |
| 번호 | **6개 전부 화면에 있다**(`[data-rally-number]` = ①~⑥). **벌거벗은 점·면 0** |
| z17 | pill 이 여전히 **②④ 뿐**(①③⑤⑥ 텍스트 안 나옴) |
| 초기 복귀 | `처음 위치로` → 축척 100m · pill 2 · 번호 6 |
| ②④ 위치 | **변경 0**(②64.5,15 · ④157.6,324 — §24 실측과 동일). ①③ 은 배지로 바뀌어 좌표가 달라진 것이 정상 |
| 도형 가림 | 대오1·대오2·부지 **0px**(360·768 픽셀 전수) · 잘림 0 · 축척 **100m** |

> **측정 셀렉터 규약**: `data-rally-badge` 는 **접힌 배지 전용**(§22·§23 기준값이 여기 묶여 있다),
> `data-rally-number` 는 **화면에 있는 번호 전부**(pill 안 배지 포함 — 요구 86 검사용). 둘을 섞지 마라.

### 25-3. 어포던스 4겹 (§25.2)

| 겹 | 구현 | 실측 |
|----|------|------|
| 1 문구 | `<figcaption>` **첫 줄**(키 줄 위) `※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.` | 15px / **600** / `#1a1a1a`(ink) — 흐리지 않음·접히지 않음 |
| 2 **②④ pill 도 눌린다** | `data-rally-hit` 를 pill 에도 부여 | **6개 전부 팝업이 열린다**(②④ 포함) |
| 3 커서·hover | `cursor:pointer` + `globals.css` 의 `@media (any-hover:hover)` 링 | 6개 전부 `pointer` |
| 4 선택 링 | 열린 항목 배지·pill 에 `--color-ink` 3px | 6개 전부 확인 |

- **도형(원·밴드·부지)은 클릭 대상이 아니다.** 문구가 `번호를 누르면` 이므로 도형을 눌리게 만들면
  **그 문안이 거짓이 된다**(§25.2.1). 마커에만 `clickable: true` 를 줬다.
- **자동 열림 없음** — 기본 상태는 전부 닫힘.

### 25-4. 팝업 = 박스 고정 패널 (§25.4~§25.7)

**말풍선이 아니다.** 가로는 박스 좌우 16px 안쪽 고정(`max-w-[480px]` 중앙), 세로만 마커 반대편.
**좌우 잘림이 계산이 아니라 구조로 0**이고, 3단계 드래그가 와도 흔들리지 않는다.

#### 6개 팝업 전수 실측 (360px)

| # | 제목 | 자리 | 크기 | 잘림 | 자기 마커 가림 | 본문 = 범례 |
|---|------|------|------|------|----------------|-------------|
| ① | `①5번 출구` | 하단 | 296×194 | 0 | **없음** | ✓ |
| ② | `②메인무대(예정)` | 하단 | 296×194 | 0 | 없음 | ✓ |
| ③ | `③대오 1` | 하단 | 296×170 | 0 | 없음 | ✓ |
| ④ | `④코스콤지부` | 상단 | 296×218 | 0 | 없음 | ✓ |
| ⑤ | `⑤여의도더샵아일랜드파크` | 상단 | 296×170 | 0 | 없음 | ✓ |
| ⑥ | `⑥여의도공원 입구` | 상단 | 296×218 | 0 | 없음 | ✓ |

- **본문은 `MAP_FEATURES[].legend` 에서 파생**한다. 별도 문자열 상수 **0**(요구 88) — 6개 전부 범례 행과 글자까지 같다.
- 768·1280: 폭 **480**(상한) · 높이 146~194 · 박스의 **34~38%** · **범례는 전혀 가려지지 않는다**(요구 E).
- **② 팝업 제목에 `(예정)` 이 있다**(요구 79·93). ① 팝업 본문이 1단계에서 못 넣은 "무대는 이 앞에 설 예정" 을 완결한다.

#### 개폐 동작 실측

| 입력 | 결과 |
|------|------|
| 다른 배지 클릭 | 교체(**동시에 열린 팝업 항상 1개**) |
| 같은 항목 재클릭 | 닫힘(토글) |
| `닫기` | 닫힘 (`tabindex="-1"`) |
| `Esc` | 닫힘(`document` 레벨 — 팝업에 포커스가 없어도 동작) |
| **지도 빈 곳 클릭** | 닫힘 — **실제 클릭으로 확인**했다. 합성 `MouseEvent` 로는 네이버 내부 이벤트가 발생하지 않아 안 닫힌다(**측정 방식의 한계이지 제품 결함이 아니다**) |
| 줌 | **열린 채 유지**(① 로 확인: z16→z17 유지) |
| 선택 마커가 박스 밖으로 | **닫힘**(⑥ 로 확인: z17 에서 박스 밖 → 닫힘) |
| 로드뷰 열기 | 닫힘 |

### 25-5. 터치·접근성

- **배지 히트 44×44px**(시각 크기 28px 유지, 투명 확장) · **히트 겹침 0**(6개 전수).
  **pill 히트는 실제 크기 그대로** — 44px 로 늘리면 ⑤ 배지와 5px 겹쳐 ⑤ 를 눌렀는데 ④ 가 열린다.
- **지도 안 탭 정지점 = 네이버 로고·저작권 5개 그대로. 증가 0**(요구 91 · §21.1.4 유지).
- 팝업은 `aria-hidden="true"` 이고 `닫기` 는 `tabindex="-1"` — **`aria-hidden` 안에 포커스 가능 요소 0개**.
- **텍스트 등가는 범례가 100% 진다.** 팝업이 새로 만드는 정보가 0이라 성립하는 판단이며,
  **범례를 줄이면 즉시 §0.4 위반이 된다**(§25.9.1). 범례 6행·키 줄 **diff 0** 확인.

### 25-6. 검증

`tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0.
대비: 팝업 제목·본문 **17.40** · `닫기` **11.37** · 테두리 **4.83**(UI) — **신규 색 조합 0**.
`globals.css` 에 hover 링 규칙 1건 추가(마커 DOM 은 네이버가 문자열로 주입해 Tailwind 가 닿지 않는다).

### 25-7. 3단계 인수인계

- 드래그 중 ②④ pill 이 도형을 가리는 문제는 3단계 소관이다(지금 풀지 않았다).
- **팝업은 3단계 영향을 받지 않는다** — 박스 고정이기 때문이다. 다만
  **드래그로 선택 마커가 박스를 벗어나면 팝업을 닫는 규칙은 이미 심어 뒀다**(`idle` 리스너).

---

## §27 3단계 — 드래그 개방 · 지도 안 `+/−` · 전체 화면 · 키보드 부채 상환 (2026-08-21)

`02_designer_spec.md` §27.0 변경표 + §27.13(사용자 결정) + §27.14(두 모드 병행).

### 27-1. 조작 계약 개정 — **원칙에 예외가 생겼다**

`draggable: true`(항상) · 마운트 노드 `touch-action: none`. §21.1.0 의
*"한 손가락은 언제나 페이지 스크롤. 예외 없음"* 이 **"단 지도 위는 사용자 결정으로 예외"** 가 됐다.

**코드 주석에 남긴 것**(리더 지시): *"위험은 해소되지 않았다. 감수된 것이다."* 리더가 위험을 명시 고지한 뒤
사용자가 택했고, 되돌리는 법(`draggable` 분기 + `touch-action: pan-y`, **둘은 한 쌍**)과
발동 조건(§27.13.8 — 사고 1건이라도 접수되면 리더 보고)도 함께 적었다.

유지: 맨 휠 = 페이지 스크롤 · Ctrl/⌘+휠만 확대 · 더블탭 무동작(실측 회귀 통과).

### 27-2. ⚠ QA-245 — **알려진 제약**의 수치 (360×800 실측)

| 값 | 실측 |
|----|------|
| 지도 박스 | **328×410** · 좌우 여백 **16px**(엄지 접촉 폭 약 45px 보다 좁다 — **좌우로는 피할 수 없다**) |
| 엄지 영역(뷰포트 하단 60% = 480px) **최대 점유** | **85.4%** |
| 그때의 **최소 안전 세로** | **70px** |
| 지도가 엄지 영역에 걸리는 스크롤 구간 | **890px / 5,592px = 15.9%** |

스펙 예측(81.5% / 89px / 15.4%)과 **같은 크기의 값**이며 실제 박스가 410px 이라 조금 더 나쁘다.
**이것은 실패 항목이 아니라 기록 항목이다.**

### 27-3. ⚠⚠ QA-247 — **완화 수단 1이 최악 구간에서 화면에 없다** (리더 판단 요청)

안내 문구 `※ 지도는 손가락 하나로 움직입니다…` 는 **2줄 · 45px** 로 지도 바로 아래에 상시 있다(요구 246 충족).
**그러나 스크롤 위치별로 훑어 보니**:

| 스크롤 위치 | 엄지 영역 점유 | 안내 문구가 화면에 |
|-------------|----------------|--------------------|
| 지도 상단이 y360 | **85%**(최악) | **없다** |
| 지도 상단이 y320 | 85% | **없다** |
| 지도 상단이 y280 | 77% | 있다 |

> **§27.13.3 의 완화 논리("갇힌 조합원이 눈만 아래로 내리면 답이 있다")가 최악 구간에서는 성립하지 않는다.**
> 그 구간에서 문구를 보려면 스크롤해야 하는데, 바로 그때 스크롤이 막혀 있다.

- **탈출 경로 자체는 있다**: 그 위치에서 지도 **위쪽 화면 상단 320~360px** 은 지도 밖이라 스와이프가 스크롤된다(QA-248).
- **그러나 그 사실을 알려 주는 문구가 그 순간 화면에 없다.**
- → **§27.13.8 예약 완화 1순위(지도 가장자리 44px 띠)의 검토 근거가 될 수 있다.** 리더·디자이너 판단 요청.

### 27-4. 지도 안 `+/−` (§27.4) — 실측

360px(박스 328): **x272~316 · y12~56 / y54~98** · 각 **44×44** · **SVG 글리프**(텍스트 문자 아님) ·
`aria-label` `확대`·`축소` · `+`는 z19, `−`는 z15 에서 비활성.
**충돌 0**: 마커 히트 6종 · 지도 도형(대오1·대오2·부지) · 지도 크롬(축척·로고·저작권) 전부 **0px**(픽셀 전수).

### 27-5. 컨트롤 재정리 · DOM 순서 (§27.4.3 · §27.14.0·2)

- 지도 밖에서 `축소`·`확대` **제거** → **4개**: 1행 `지도 크게 보기`(145.9) + `처음 위치로`(126.1) = **280.0**,
  2행 `내 위치 표시`(130.3) + `로드뷰 보기`(126.1) = **264.4** — 실측 **2행**(행 수 변화 0).
- **DOM 순서**: 지도 → 어포던스 문구 → 안내 문구 → **컨트롤 행** → `<figcaption>`(키 줄·범례·각주).
  `<figcaption>` 이 `<figure>` 의 **마지막 자식**이다(실측 확인).
  드래그로 길을 잃은 조합원이 `처음 위치로` 를 찾으려 **범례 6행을 건너뛸 필요가 없다.**
- `지도 크게 보기` ↔ `로드뷰 보기` 는 **다른 행**이고 로드뷰 보조 문구도 그대로다.

### 27-6. 전체 화면 지도 (§27.6 · §27.14.3) — 로드뷰 기반 재사용

`<dialog>`+`showModal()` · **100dvh**(375×800 = 뷰포트 높이 일치) · 배경 스크롤 잠금·복원 3중 장치
(`lockBodyScroll`/`unlockBodyScroll` **모듈 함수로 추출해 로드뷰와 공유**) · `::backdrop` 클릭 닫기 없음.

| 실측 | 결과 |
|------|------|
| 별도 인스턴스 | 닫으면 **페이지 지도 라벨 좌표가 열기 전과 문자열 단위로 동일** · `scrollY` **±0px** · 포커스 `지도 크게 보기` 복귀 |
| 진입 | `fitBounds` 재실행 → 축척 **100m** · 마커 6개 · pill ②④ |
| 컨트롤 | `닫기`(상단 우측·초기 포커스) · `+/−`(우측) · `처음 위치로`(하단 좌측) · 어포던스 문구 오버레이 · `sr-only` 안내 |
| 팝업 | 열림·본문이 범례 문장 그대로·**잘림 0**(343×170) |
| `Esc` | **팝업만 닫히고 모달은 열려 있다**(§27.14.6-262) |
| 조작 | `touch-action: none` · 한 손가락 팬이 **설계된 동작**(뺏을 페이지 스크롤이 없다) |

**⚠ QA-260 — 배포 게이트**: 모달 안에 **범례를 넣지 않았다**(§27.14.3 근거 5건).
그러나 그것은 **§0.4 판정이고 검증 소관**이라 스펙 스스로 *"판정 전에는 이 모드를 배포하지 마라"* 를 걸어 뒀다.
**구현은 끝났고 배포 가부는 검증 판정에 달려 있다.** "범례 필수" 판정이 나오면 모달 하단에 **접지 않고** 넣는다.

### 27-7. 키보드 부채 상환 (§27.8) — 실측 전건 통과

| 항목 | 실측 |
|------|------|
| 진입 첫 지점 | **④ 코스콤지부**(`tabindex="0"` 하나뿐) |
| 지도 안 정지점 | **그룹 1개** + 네이버 로고·저작권 5개 — 컨트롤 행이 5→4로 줄어 **페이지 순증 0** |
| 순회·실행 | 방향키 ④→⑤→④ · **Enter → 팝업**(`④코스콤지부`) |
| `Esc` | 팝업 닫힘 + **포커스가 ④ 로 복귀** |
| 팝업 | **`aria-hidden` 해제** · `닫기` **`tabindex` 제거**(정상 포커스) — **한 쌍으로** 바꿨다 |
| 마커 | `aria-hidden` 해제 · `aria-label` = **`④ 코스콤지부`**(짧게, 설명은 팝업이 진다) |
| 반려선 | **`aria-hidden` 안 포커스 가능 요소 0개** |
| 범례 연동 | 마커 포커스 시 **범례 해당 행 강조**, blur 시 해제. 범례 행은 여전히 **`<button>` 이 아니다** |
| 전체 화면 | **같은 roving group 방식**이고 그룹이 **`닫기` 다음** 정지점 |
| `role="application"` | **없다** |

**§26.1.5 폴백(`textMode` 를 `always` 로 되돌림) 조건은 소멸했다.**

포커스 복원 버그 1건을 실측으로 잡았다: 아이콘 재그리기의 포커스 복원이 조건 없이 동작하면
**모달이 열릴 때 `닫기` 로 보낸 초기 포커스를 지도가 빼앗는다.** → *"이미 그룹 안에 포커스가 있을 때만"* 으로 고쳤다.

### 27-8. 회귀 (§25·§26 산출물)

- 초기 뷰: 축척 **100m** · 라벨×도형 가림 **0px** · 잘림 **0** · **②④ pill 위치 불변**(②64,14 · ④157,324)
- 팝업: **드래그 중 제자리**(이동 0px) · 이탈 판정은 `idle`(= 동작 완료 후 1회)이라 **깜빡임 없음**
- `처음 위치로`: 초기 좌표로 복귀(①78,116 ②64,14 ③212,63 ④157,324 ⑤150,366 ⑥272,278)
- 맨 휠 `defaultPrevented=false`·축척 불변 / Ctrl+휠 확대 / 더블탭 무동작

`tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0.

### 27-9. 미검증 · 판단 대기

1. **실제 터치 드래그·핀치** — 합성 `TouchEvent` 로는 네이버 내부 제스처가 트리거되지 않는다.
   **기기 에뮬레이션 QA 필요**(QA-222·223·225).
2. **QA-247**(위 27-3) — 완화 문구가 최악 구간에서 화면 밖. **리더·디자이너 판단 요청.**
3. **QA-260** — 전체 화면 범례 부재에 대한 **검증 판정 전 배포 금지**.

---

## ★ 긴급 정정 — 코스콤지부 위치 주장 제거 (검증 12회차 · 2026-08-21)

주최측 새 배치도(§6.9)로 **`대오 1·2` 체계가 `1·2·3구역` 으로 교체**됐고 **코스콤지부는 3구역 배정 예정**이다.
현행 표시가 가리키던 자리는 새 자료 기준 **2구역 — 다른 지부 대오**다. **파생 7건을 전수 제거했다.**

### E-1. 제거·교체 7건 (요구 98~102)

| # | 자리 | 조치 |
|---|------|------|
| 1·3 | 지도 라벨 ④ + ④ 밴드 폴리곤 | **제거**(`MAP_FEATURES` 에서 밴드 항목 삭제) |
| — | 지도 ③ `대오 1` 밴드 | **함께 제거** — 명칭이 새 체계에 없고 애초에 `estimated`(순수 추정)였다 |
| 2 | 범례 ③④ 행 | 밴드 제거로 **자동 소멸**(범례는 `MAP_FEATURES` 파생) |
| 4 | 블록 2 산문 | **§12-8 ② 확정안으로 교체**(아래) |
| 5 | `DISTANCE_TEXT_LONG/SHORT` | **상수 자체 삭제** — `220~340 m` 는 **과소추정이라 위험 방향** |
| 6 | 화장실 카드 거리 1줄 | **삭제**(안전 방향이지만 무효한 근거로 계산된 수치를 남기지 않는다) |
| 7 | 지도 대체면 | `코스콤지부 — 집회 3구역 배정 예정(위치 확인 중)` 로 교체, 거리 문구 삭제 |
| — | 범례 각주 | `지부별 집회구역은 주최측이 새 배치도로 안내해 확인 중이며, 확인 전까지 지도에 표시하지 않습니다.` **추가** |
| — | 각주 1 | **`종료 시각은 안내되지 않았습니다` 절만 삭제**(§6.9 하단 `18:30 ~ 20:30` 때문에 **거짓이 될 수 있는 부정 주장**) |

**블록 2 최종 문안**(실측 확인):
`주최측 안내에 따르면 코스콤지부는 집회 3구역에 배정될 예정입니다.` /
`구역의 정확한 위치는 확인 중이며, 확인되는 대로 지도에 반영하겠습니다.` /
`집회 장소는 여의도 의사당대로(국회의사당역 인근)입니다.` / `※ 현장에서 지부 깃발을 확인해 주세요.`

### E-2. ⚠ 데이터까지 지웠다 — 되살아나지 않게

`ColumnBand` 타입 · `RALLY_COLUMNS` 좌표 · `toBandFeature` 를 **전부 삭제**했다. 주석만 남겼다:
**"옛 좌표를 되살려 3구역에 붙이지 마라. 그것이 날조다"** · 복원 경로(git 이력 · 검증 §5-12-7) ·
**"좌표가 필요해지면 원본 배치도를 확보해 처음부터 다시 산출하고, 그때도 `estimated` 가 상한"**(요구 106).
소스에 남겨 두면 언젠가 다시 쓰인다 — 그것이 §12-4 가 경고한 위험이다.

**키보드 진입 지점도 옮겼다**: ④ 코스콤지부 → **① 5번 출구**(그 지점이 사라졌고, 구역 미확정 상태에서
조합원이 확실히 가야 하는 곳은 내리는 역이다). 구역이 확정되면 되돌리는 것을 검토하라.

### E-3. 실측 (360px · content 360 · box 328×410)

| 항목 | 결과 |
|------|------|
| 지도 지점 | **4개**(①5번 출구 ②메인무대(예정) ③더샵 부지 ④공원 입구) · 번호 자동 재부여 |
| 도형 | 원 + 부지 **2개**(밴드 2개 소멸) |
| **부지 가림(남은 유일한 1급 대상)** | **본선 0% / 내부 0%** |
| 메인무대 원 가림(별건 §22.11) | 본선 **7.7%** · 내부 6.95% — pill 이 배지가 되며 **10.22% → 7.7% 로 줄었다** |
| 축척 | **100m 유지**(밴드 제거로 `fitBounds` 범위가 바뀌었는데도) |
| 잘림·가로 스크롤 | **0 / 0** · 200% 확대 `main` 넘침 **0** |
| 팝업 | 4개 전부 동작, 제목·본문이 범례 행과 일치 |
| 금지 문자열 | `더샵아일랜드파크 앞 의사당대로` · `220~340` · `약 80 m` · `종료 시각은 안내되지` · `대오 1/2` — **렌더 전부 0건** |

**부수 수정 1건**(§27 산출물의 회귀): 범례 행 강조용 `px-1` 이 텍스트 가용 폭을 줄여
**200% 에서 ③ 행이 7px 넘쳤다** → `-mx-1` 로 상쇄해 **0** 으로 되돌렸다.

`tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0.

### E-4. 커밋 분리 — **완료**(리더 지시 절차대로)

3단계는 배포 불가(키보드 방향키 실패 + 판정 2건 대기)라 **정정만 남겼다.**
`git add -p` 는 이 환경에서 인터랙티브 플래그를 못 써서 **파일 되돌림 + 재적용**으로 했다.

| 단계 | 결과 |
|------|------|
| 1. 백업 | `git diff` 전체 패치 + `RallyMap.tsx` 단독 패치 + **파일 사본** 3중으로 보관(스크래치패드). untracked 없음 |
| 2. 되돌림 | `git checkout -- src/components/rally/RallyMap.tsx` |
| 3. 재적용 | **정정 hunk 1개만** — 대체면 문구 + `DISTANCE_TEXT_SHORT` import 제거 |
| — | **키보드 진입 상수·범례 `-mx-1` 은 재적용하지 않았다**: HEAD 에는 `KEYBOARD_ENTRY_ID` 도 `px-1` 도 **없다** — 둘 다 3단계가 만든 것이라 **3단계 소관**이 맞다(리더 예상대로) |
| 4. 검증 | `tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0. **참조 오류 1건이 여기서 드러났다** — `rallyMap.ts` 에서 상수를 지웠으므로 대체면 hunk 가 **import 제거를 포함해야** 빌드가 선다 |
| 5. 실측 | 아래 E-5 |

**백업 위치**(정정 배포 후 3단계 복원용):
`stage3-backup.patch`(작업 트리 전체) · `RallyMap.stage3.patch` · `RallyMap.stage3.tsx`(파일 사본).

### E-5. 정정본(3단계 제외) 실측 — 360px

| 항목 | 결과 |
|------|------|
| 지도 지점 | **4개**(①5번 출구 ②메인무대(예정) ③더샵 부지 ④공원 입구) · 도형 2개(밴드 소멸) |
| **부지 가림** | **본선 0% / 내부 0%** |
| 메인무대 원(별건 §22.11) | 본선 7.7% / 내부 6.95% |
| 축척 · 박스 | **100m** · 328×410 · 잘림 0 · 가로 스크롤 0 |
| 컨트롤 행 | **종전 5개**(`축소`·`확대`·`처음 위치로`·`내 위치 표시`·`로드뷰 보기`) — 3단계가 빠져 조작이 두 손가락으로 돌아갔고 **안내 문구도 함께 빠져 정합성 유지** |
| 범례 | 4행 + 각주에 `지부별 집회구역은 … 확인 전까지 지도에 표시하지 않습니다.` |
| 블록 2 | 확정안 4문장 |
| 금지 문자열 | 렌더 **0건**(`더샵아일랜드파크 앞 의사당대로` · `220~340` · `약 80 m` · `종료 시각은 안내되지` · `대오 1/2`) |
| 200% 확대 | `main` 넘침 **0**(문서 34px 은 `footer img.h-7` — FOLLOWUPS 7 기지 항목) |

### E-6. 원본 참고 — 커밋 분리 전 기록

### E-6-old. (커밋 분리 전) 조율 요청 기록


작업 트리에 **3단계(드래그·전체 화면·키보드) 변경이 커밋되지 않은 채** 함께 있다.

| 파일 | 내용 |
|------|------|
| `src/lib/rallyMap.ts` | **정정 전용**(밴드·좌표·거리 상수 제거, 범례 각주) |
| `src/app/rally-2026-08-28/page.tsx` | **정정 전용**(블록 2·각주 1·화장실 거리) |
| `src/components/rally/RallyMap.tsx` | **혼재** — 정정 hunk 는 **대체면 1곳 + 키보드 진입 상수 1곳 + 범례 `-mx-1` 1곳**, 나머지는 전부 3단계 |

→ **파일 단위 분리는 불가**하지만 **hunk 단위 분리는 가능하다**(정정 hunk 3개가 서로 떨어져 있다).
커밋·배포는 지시받은 범위 밖이라 **하지 않았다.** 리더 조율 요청.

### E-7. §28 반영 — 상태 패널 · `<dl>` 행 교체 (2026-08-21)

디자이너 §28 이 구현보다 늦게 나와 **2건을 추가**했다. §28.0 변경표의 나머지(#1·2·4·5·6·8·9)는 이미 일치했다.

#### (1) 지도 위 상태 패널 (§28.2 · 변경표 #3)

**각주만으로는 부족하다**는 판정이다 — 범례 각주는 범례 행 아래라 조합원이 거기까지 읽지 않고,
**④ 를 그냥 지우면 이전에 본 위치가 기억에 남는다.** *"지워진 자리는 스스로 말하지 않는다."*

| 항목 | 구현 |
|------|------|
| 자리 | `<figure>` 안 **지도 박스 바로 위**(`mb-3` → 실측 간격 **12px**) |
| 모양 | `rounded-card border-l-4 border-primary bg-surface p-4` — 좌측 바는 **장식 전용**, 의미는 문자가 진다 |
| 본문 | **18px / 600 / `#1a1a1a` on `#f9fafb` = 16.65**(신규 색 조합 0). 아래 안내 문구(15px)보다 한 단계 위 |
| 아이콘·적색 | **쓰지 않았다** — 적색은 긴급 공지 전용이고 이것은 *미확정*이다. **색으로 겁주지 않는다** |
| 문안 | `코스콤지부는 집회 3구역에 배정될 예정입니다.` / `구역의 정확한 위치는 확인 중이라 지도에 표시하지 않았습니다.` |

**문자열은 `ZONE_STATUS`(`rallyMap.ts`) 한 곳에서 파생한다** — 블록 2 산문과 같은 출처다(요구 88 원칙).
두 자리에 따로 두면 **구역이 확인됐을 때 한쪽만 고쳐져** 지도는 "표시하지 않았다"는데 본문은 위치를 말하게 된다.

**⚠ 패널을 `RallyMap.tsx` → `page.tsx` 로 옮겼다**(리더 지적 반영).
스펙(§28.2.3)은 `<figure>` 안을 지정했지만 **3단계 백업 패치가 `RallyMap.tsx` 를 통째로 덮으므로**
거기 두면 **복원 시 이 패널이 조용히 사라진다.** `page.tsx` 의 지도 섹션(제목 아래 · `<RallyMap>` 바로 위)에
두면 복원과 무관하다 — 실측으로 확인: `RallyMap.tsx` 정정 diff는 **+5/−4 줄뿐**이고
백업 사본에 `ZONE_STATUS` 참조가 **0건**이다(패널이 그 파일에 없으므로 덮여도 영향 0).

**시각 위치는 동일하다**: `<figure>` 의 첫 시각 요소가 지도 박스라, `<figure>` 밖 바로 위나
`<figure>` 안 첫 자식이나 화면에서는 같은 자리다(실측 간격 20px). **되돌리지 마라.**

#### (2) `<dl>` 행 교체 (변경표 #7 · §28.4)

`코스콤지부 | 20:30까지 참가 계획` **행 제거** → **`집회 시간 | 18:30 ~ 20:30`**.
행 순서 **집회 시간 → 본대회 → 장소**(큰 범위 → 그 안의 한 지점 → 장소).

| 실측 | 결과 |
|------|------|
| `<dt>` 열 폭 | **55.44px** — 제거된 `코스콤지부` 기준(64.83px)보다 **좁아졌다**. 넓어지지 않았다 |
| `장소` `<dd>` | **2줄 유지**(줄바꿈 악화 0) |
| `18:30 ~ 20:30` | **18px / 400** — 기존 `<dd>` 토큰 그대로, 굵거나 크지 않다 |
| 대형 `18:30` | **40px 유일**(다음이 h1 28px) — §20.3.2 불변 |
| 접근성 | 시각 문자열 `aria-hidden` + `sr-only` `오후 6시 30분부터 오후 8시 30분까지`. `18:30` 의 `<time>`·`sr-only` 는 변경 0 |
| 각주 | 1행 = `※ 20:30 은 … 폐회선언은 20:20~ 입니다.`(절 1개 삭제본) · **2행 유지** |
| 옛 문자열 | `20:30까지 참가 계획` · `종료 시각은 안내되지` **렌더 0건** |
| 200% 확대 | `main` 넘침 **0** · `<dl>` 3행 유지 |

#### (3) 지도 회귀 재확인 (패널 추가 후)

박스 **328×410** · 축척 **100m** · 지점 4개 · **부지 가림 0%/0%** · 원 7.69%(별건) · 잘림 0 · 가로 스크롤 0 · 콘솔 에러 0.

#### (4) 디자이너 제안 1건 — 전달만 한다

§28.3.1: **⑤ 의 존재 이유가 소멸했다**(④ 가 사라져 "무엇의 위치 기준"인지가 없어졌고,
새 자료에서 그 방향은 2구역이라 **조합원이 옛 자리를 기억해 낼 수 있다**).
**문안 변경이라 개발자 소관이 아니다 — 검증 판정 대기.** 이번 정정에서는 손대지 않았다.

### E-8. ⑤ 더샵 부지 제거 (검증 16회차 요구 130 · 2026-08-21)

**도형은 위치를 주장하지 않아도 "여기가 중요하다"를 말한다.** ④ 가 사라진 뒤 ⑤ 는 지도에 남는
**유일한 지상 건물**이 됐고 그 방향은 새 배치도 기준 **2구역(다른 지부 대오)** 이다 —
**배포본을 이미 본 조합원에게는 옛 자리 기억을 강화한다.**
8회차가 ⑥ 도트에 `화장실` 단독 라벨을 금지한 것과 같은 논리다(**기호가 놓이는 것 자체가 주장이다**).

**도형·라벨·범례 행 + `DSHARP_POLYGON` 좌표까지 제거**했다. 좌표 주석에는 ③④ 와 **다른 성격**임을 남겼다:
이것은 **실재하는 지물의 확인된 좌표**(OSM `way 682330255`)이고 근거가 무효가 된 것이 아니라 **역할이 사라진 것**이라,
**"구역 확정 시 앵커로 재검토 가능. 단 그때도 새 구역 기준으로 판단할 것"** — 옛 대오 2 와의 인접 관계(이격 21.7m 등)는
이미 폐기된 체계의 값이다.

#### 실측 (360px · content 360)

| 항목 | 결과 |
|------|------|
| 지도 지점 | **3개** — ① 5번 출구(배지) · ② 메인무대(예정)(pill) · ③ 여의도공원 입구(배지). 번호 **자동 재부여** |
| 도형 | **1개**(② 점선 원만 남는다) |
| **축척** | **100m 유지** — `fitBounds` 가 3점으로 재계산됐는데도 그대로다(리더 우려 지점, **깨지지 않았다**) |
| 박스 | 328×410 · 잘림 **0** · 가로 스크롤 **0** · 200% `main` 넘침 **0** |
| 팝업 | 3개 전부 정상(제목 `①5번 출구`·`②메인무대(예정)`·`③여의도공원 입구`, 본문 = 범례 행, **잘림 0**) |
| 범례 | **3행** + 각주에 구역 문장 유지 |
| 상태 패널 · `<dl>` | **유지**(`집회 시간` → `본대회` → `장소`) |
| `더샵`·`아일랜드파크` | **렌더 0건** · 소스 좌표 **0건**(주석만 남음) |
| 원 가림(별건 §22.11) | 본선 7.69% / 내부 6.94% — ① 배지, 개정 전과 동일 |

`tsc` 0 · `eslint` 0 · `build` 성공 · 콘솔 에러 0.

### E-9. `FIT_MAX_ZOOM = 16` — 1280px 축척 이탈 수정 **(적용 → 철회 → 재적용, 최종 적용)**

**최종 상태: 적용. 원래 코드에 결함이 있었고 이 수정이 맞다.**

#### 결함

⑤ 더샵 부지 제거로 `fitBounds` 범위의 **남쪽 앵커가 사라져 범위가 좁아졌다.**
박스가 가장 큰 **1280px(896×504)에서만 z17(50m)이 걸리고**, ② pill 이 원 위쪽에 붙는데
**원이 올라가 박스를 24px 벗어난다**(② 좌표 y **−24**).

**360·768 은 100m 로 정상이다 — 1280 에서만 발현한다.** 리더가 **프로덕션(창 폭 400px 대)에서
`축척 50m · ② pill 미노출`** 을 직접 관측했다. QA 도 새 컨텍스트 / `setViewportSize` / DPR 1 데스크톱
**3가지 독립 조건 전부에서 일관 재현**했다.

#### 철회가 있었던 경위 — 기록으로 남긴다

중간에 QA 가 실패를 **철회**했고 그에 따라 나도 수정을 되돌렸다가, 다시 적용했다.
철회 근거가 된 그 한 번의 측정에서 **1280 박스가 328×410(비율 4:5 = 모바일 세로형)** 으로 나왔는데,
1280 에서는 `md:aspect-[16/9]` 가 적용돼 **896×504** 여야 한다 — **CSS 미디어쿼리가 반영되지 않은
비정상 상태**였고, 정상 결과를 비정상으로 오인한 것이다.
(`next start` 의 static 404 문제는 실재했지만 **그것과 이 결함은 별개**였다. 두 현상을 하나로 묶은 것이 오판의 원인.)

> **교훈: 측정값이 기대와 다를 때 "환경 탓"으로 닫기 전에 그 값이 물리적으로 가능한지 먼저 보라.**
> 1280 에서 4:5 박스는 **CSS 규칙상 나올 수 없는 값**이었고, 그 한 가지만 확인했으면 오판을 피했다.

#### 수정 — `fit()` 상한만 분리

`fit()` 의 `map.getZoom() > MAP_MAX_ZOOM` → **`FIT_MAX_ZOOM`(16)**.

> ⚠ **`MAP_MAX_ZOOM`(19)은 건드리지 않았다.** QA 권고 문구는 `MAX_ZOOM: 16` 이었지만 그 상수는
> **사용자 조작 상한**이라, 그대로 따랐으면 **조합원이 지도를 확대할 수 없게 되고**
> §21.1.1 의 `minZoom 15 / maxZoom 19` 계약이 깨진다.
>
> **규칙: 권고가 지목한 "값"이 아니라 그 권고가 고치려는 "증상"을 보라.**
> 같은 이름의 상수가 두 가지 일을 하고 있으면 문자 그대로 적용하는 순간 **엉뚱한 계약이 깨진다.**

대안(`FIT_PADDING.top` 증가 · ② `labelGap` 축소)은 **라벨 배치를 다시 흔들기 때문에** 쓰지 않았다.

#### 실측 (BUILD_ID `XOGvKJMBOtzVedBhZulZN`)

| 뷰포트 | 박스 | 축척 | ② 좌표 | 잘림 |
|--------|------|------|--------|------|
| 385(≈프로덕션 관측 폭) | 353×441 (4:5) | **100m** | 81.5, **46** · **pill 노출** | **0** |
| **1280** | 896×504 (16:9) | **100m** ✅ | 352.5, **77** | **0** ✅ |

**조작 계약 유지 실측**(1280): `확대` 100→50→30→**20m(z19) disabled** ·
`축소` **300m(z15) disabled** · `처음 위치로` → **100m 복귀, 좌표 초기와 동일**.
→ **`fit()` 상한을 16으로 낮춰도 조작 상한은 그대로다.**

`tsc` 0 · `eslint` 0 · `build` 성공.
**해시**: `RallyMap.tsx` **`1e3db660d832d8d8…`** — 기능은 이전 적용본(`43300a7d…`)과 같고
**주석에 "1280 전용 발현 · 프로덕션 관측 · 조작 상한 불변" 을 덧붙여** 해시가 달라졌다.
`rallyMap.ts` `1d86029a…` · `page.tsx` `e7e2cbef…` 는 동결 시점과 동일.

