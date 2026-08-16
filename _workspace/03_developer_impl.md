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

## 14. 자가 검증 결과 (최초 구현, 2026-08-16)

```
npx tsc --noEmit   → 통과 (오류 0)
npm run lint       → 통과 (오류 0)
npm run build      → 통과 (/ 정적 프리렌더 ○ Static)
```

추가 스모크 테스트 (명백한 플레이스홀더 임시 파일로 라운드트립 후 즉시 삭제 — content/는 현재 비어 있음):
- verified+urgent 파일 존재 시: 긴급 배너 렌더(`aria-label="긴급 공지"`), 배지·`YYYY.MM.DD` 표기·목록 노출 확인
- `verified: false` 파일: 목록에서 제외됨 확인 (게이트 동작)
- 콘텐츠 0건 복원 후: 배너 미렌더·빈 상태 표시 확인
