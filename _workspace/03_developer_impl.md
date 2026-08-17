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
