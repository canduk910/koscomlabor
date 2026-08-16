# QA 리포트: 방명록 백엔드 실통신 통합 (4회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 범위: `server/`(Fastify+PostgreSQL) ↔ 프론트 연동 실통신 검증 (기준: 06 명세 §2/§4/§9, 03 구현 §8, 07 로컬 절차 §1.3)
- 환경: 로컬 PostgreSQL 16(brew) + 백엔드 `npm run dev`(127.0.0.1:3001) 직접 기동 + 프론트 `next start`(:3000, `NEXT_PUBLIC_API_BASE_URL` 설정 프로덕션 빌드)
- 핵심 방법: **프로덕션 파서 직접 실행** — `src/lib/api/guestbook.ts`를 Node(타입 스트리핑)로 그대로 import하여 실서버에 호출. 명세 ↔ 실응답(curl 원시) ↔ 프론트 파서 3자를 문서 대조가 아닌 실행으로 대조
- 정리: 테스트 등록 데이터 `TRUNCATE guestbook_entries`(0행 확인), 기동 프로세스 2종(3000/3001) 종료, 임시 스크립트·로그 삭제, 프론트는 미설정 클린 빌드로 복원

## 4회차 요약: 통과 14 | 실패 0 | 미검증 4

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 응답 shape 3자 대조 — 목록 (최우선) | `GET /guestbook` 실응답: 최상위 JSON 배열(봉투 없음)·원소 4필드(`id` UUID string/`author`/`body`/`createdAt` ISO 8601 UTC 밀리초+Z)·추가 필드 없음·`content-type: application/json; charset=utf-8` — 명세 §2.1과 일치, **프로덕션 `listGuestbookEntries` 실행이 `ok: true`로 파싱** (parseGuestbookEntry 통과) |
| 2 | 응답 shape 3자 대조 — 등록 | `POST /guestbook` 201 + 단일 객체 4필드 — `createGuestbookEntry` 실행 `ok: true`. author 앞뒤 공백 패딩 입력 → **응답이 trim된 값** 반환 실측 (명세 §2.2 "trim 적용된 값") |
| 3 | 에러 분기 — 429 | 성공 등록 30초 내 재등록: 원시 429 + `retry-after: 30` + body `{error:{code:"RATE_LIMITED",message:한국어}}` — 프론트 실행 결과 `reason: "rate-limited"` + "잠시 후 다시 시도" 안내. UI는 `result.message`를 그대로 표시(`GuestbookPanel.tsx:118`) |
| 4 | 에러 분기 — 400 | 31초 대기 후(rate limit 선행 검사 유의사항 §9 반영) author 21자: 원시 400 `VALIDATION_ERROR` — 프론트 `reason: "validation"` + **서버 한국어 message 원문 그대로**("닉네임은 20자 이하여야 합니다."). 목록 경로도 `limit=0` → validation 분기 확인 |
| 5 | E2E 데이터 흐름 (API 레벨) | 등록 → 목록 재조회: 신규 글이 배열 첫 원소(최신순), **서버 응답 entry와 목록 첫 원소 deep equal true** — 낙관적 prepend의 소스가 서버 응답값이므로 trim·표시값 불일치 구조적으로 없음. 재조회로 서버 영속(새로고침 동등) 확인 |
| 6 | 계약 A (페이지네이션) | `listGuestbookEntries({limit:1})` → 1건 배열, shape 불변 — 승인된 계약 확장 실동작 |
| 7 | CORS | Origin `http://localhost:3000` preflight: `access-control-allow-origin` 반환 + methods `GET, POST` + headers `Content-Type, Accept` + credentials 미설정 + `X-Total-Count` expose. 비허용 Origin은 ACAO 미반환 — 명세 §4.4 일치 |
| 8 | 설정 상태 렌더 | `NEXT_PUBLIC_API_BASE_URL` 설정 빌드 SSR HTML: `<form>` + 가시 `<label>` 2종(닉네임/내용) + maxLength 20/500(백엔드 한도와 동일 수치) + `role="status"` 2건(피드백·로딩) + 글자수 안내, 준비 중 카드 미렌더. `next start` 실서빙 200 확인 |
| 9 | 미설정 회귀 | 환경변수 없는 클린 빌드: 준비 중 카드 복귀·`<form>` 0건·번들/HTML에 API URL 잔존 0건 — §7.1 무회귀 |
| 10 | admin 비노출 | 프론트 `src/` grep: admin/ADMIN/Bearer/Authorization 0건. 설정 빌드 클라이언트 번들(`.next/static`) grep: `ADMIN_API_TOKEN`·`Authorization`·`admin/guestbook` 0건. GuestbookPanel에 삭제 UI 없음 — 명세 §2.3 "프론트 계약 밖" 준수 |
| 11 | 개인정보 실측 | DB: 원문 IP 컬럼 없음(스키마 `\d` 확인), `ip_hash`는 64자 hex(HMAC)만, IP 패턴 검색 0행. 서버 로그(실통신 37행): 닉네임·본문 문자열 0건, `remoteAddress` 0건(기동 바인드 주소 1건뿐), 필드는 method/url/statusCode/responseTime만 — 명세 §4.1 일치 |
| 12 | 정적 검사 | 프론트 `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(○ Static/● SSG 유지), `server/` 자체 `npm run typecheck`(strict) 통과 |
| 13 | 폼 스펙 §7.2 (코드 검증) | 가시 레이블·input `h-12`(48px)/`border-strong`/radius 8px/`px-3`·textarea `min-h-30`(120px)·등록 버튼 primary-strong/흰 텍스트/700/44px·hover 배경 유지+outline(스펙의 배경 변화 금지 준수)·전송 중 disabled+"등록 중…"·`role="status"` 상시 렌더·목록 0건 시 "아직 남겨진 글이 없습니다"(EmptyState 재사용)·실명 유도 문구 없음("닉네임") |
| 14 | 타입 경계 (계약 C) | `GuestbookErrorReason` 유니온 ↔ 명세 §2.4 code 매핑(`RATE_LIMITED`→rate-limited, `VALIDATION_ERROR`→validation, 그 외→network), `parseErrorBody` 필드별 typeof 검증, body 비명세 형식 시 HTTP 상태 기반 2차 방어선 — 타입 우회 0건 |

### 비고 (실패 아님)

1. 서버의 429 message와 프론트 폴백 문구가 동일 문자열("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.") — 원시 curl로 서버 body 원문임을 확인해 구분 완료. 서버 문구 변경 시에도 프론트는 서버 message 우선이므로 동작 문제 없음.
2. 방명록 §7.2의 스펙 미정의 구간(로딩/조회 실패 상태, 등록 실패 텍스트 `text-urgent-strong` — §8 "적색은 긴급 배너 유일" 원칙과 긴장)은 개발자가 03 문서 §8에 명시한 대로 **frontend-designer 확인 대기** 항목.
3. 백엔드 기동 시 Fastify deprecation 경고(FSTDEP023, `disableRequestLogging`) — fastify@6 대비 정리 권고 (backend-developer 몫, 동작 영향 없음).

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 브라우저 실조작 E2E (폼 입력→제출→목록 UI 갱신, `role="status"` SR 낭독) | 브라우저 자동화 환경 없음 — 프로덕션 fetch·파서 코드를 Node에서 직접 실행하는 방식으로 통신 계약은 실검증했으나, React 상태 전이·DOM 갱신은 코드 리뷰까지만 |
| 2 | 장주기 rate limit (1시간 10회/24시간 30회)·중복 내용 24h 제한·ip_hash 90일 NULL 배치 | 시간 제약 (백엔드 자체 실측 27케이스 중 T13·T25에 부분 포함 — 06 §9) |
| 3 | 프로덕션 배포 환경 (nginx/TLS/api.koscomlabor.cloud CORS·X-Forwarded-For 경유 rate limit) | 미배포 — 07 §2.7 배포 검증 체크리스트로 배포 시점에 수행 필요 |
| 4 | 스크린리더·실뷰포트 (기존 1–3회차와 동일) | 환경 제약 |

---

# QA 리포트: 디지털온누리 가이드 링크 카드 (3회차 — 증분 검증)

- 작성: qa-tester | 작성일: 2026-08-16
- 범위: 신규 외부 링크 카드 + 인접 경계면 (변경 파일: `src/components/home/OnnuriGuideCard.tsx` 신규, `src/lib/routes.ts`, `src/components/ui/icons.tsx`, `src/app/page.tsx`)
- 기준: 스펙 §9(신규)·§8 갱신·§2 채택표 #19/#20, 구현 요약 §7
- 검증 방법: 스펙 ↔ 코드 교차 비교 + 실빌드 HTML 실측(배너 존재/부재 양 시나리오 — urgent 임시 파일 라운드트립 후 삭제·복원 실측) + 대비 스크립트 재실측 + tsc/lint/build

## 3회차 요약: 통과 13 | 실패 0 | 미검증 4 (1·2회차와 동일 사유)

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 배치 (배너 부재 — 현재 기본) | 실빌드 HTML 실측: 카드가 `<main>` 내 컨테이너의 첫 자식 — 배너 미렌더 시 헤더 아래 첫 요소(스펙 §9.1). 카드 문자열 위치 < tablist 위치 확인 |
| 2 | 배치 (배너 존재) | urgent+verified 임시 파일로 실빌드: **배너 → 카드 → 탭리스트** 순서 실측(오프셋 비교). 검증 후 파일 삭제·클린 재빌드·빈 상태 복원 실측(content/에 .gitkeep만, "QA 테스트" 잔존 0건) |
| 3 | 간격 | `page.tsx:26` 컨테이너 `mt-8`(2rem — main 상단 여백을 카드가 이어받음) + `page.tsx:29` 카드-탭리스트 `mt-8`(2rem) — 스펙 §9.1 값 일치 |
| 4 | 컨테이너 스타일 | `OnnuriGuideCard.tsx:20` — `bg-primary-tint`·`rounded-xl`(12px)·`border-l-4 border-primary`·`p-4`(1rem)/`md:px-6`(1.5rem)·`min-h-touch`(44px) — 스펙 §9.2 전 항목 일치 |
| 5 | 텍스트 스타일 | 제목 `text-body font-bold text-primary-strong`(18px/700/#1e40af), 설명 `mt-1`(0.25rem) `text-caption font-normal text-ink` — **tint 위 ink-muted 금지 준수**(§2 탈락표), 말줄임 클래스 없음(HTML 실측 — 새 창 안내 문구 보존) |
| 6 | #1d4ed8 용법 | 좌측 보더(`border-primary`) 전용 — 카드 내 텍스트·아이콘은 전부 `primary-strong`. `text-primary` 사용 0건 유지 |
| 7 | hover/focus-visible | `group-hover:underline`(제목) + `hover:outline-2 hover:outline-primary-strong`(배경 변화 없음), `focus-visible:outline-3 outline-primary offset-2` — 스펙 §9.2 상태표 그대로 |
| 8 | 외부 링크 안전성 | 실빌드 HTML 실측: `<a href="https://onnuri.koscomlabor.cloud/" target="_blank" rel="noopener noreferrer">` — 세 어트리뷰트 모두 렌더 확인 |
| 9 | 라우팅 경계 분리 | `routes.ts:21-24` — `EXTERNAL_LINKS`가 내부 `ROUTES`와 별도 객체(절대 URL 전용, 주석으로 blank/noopener 규약 명시). 내부 라우트 교차 검증 대상에 외부 URL이 섞이지 않는 구조. URL 스펙 문자열과 정확 일치 |
| 10 | 신규 색 조합 실측 | `check-contrast.mjs` 재실측: `#1a1a1a/#eff6ff` 15.99(AAA — 스펙 #19), `#1e40af/#eff6ff` 8.01(AAA — #8), `#1d4ed8/#eff6ff` 6.16(UI 3:1 통과 — #20, 보더 전용), hover outline `#1e40af/#ffffff` 8.72(AAA — #6) — 스펙 수치와 전부 일치 |
| 11 | 접근성 | 카드 전체 단일 `<a>` — 접근성 이름에 제목+"외부 페이지가 새 창에서 열립니다" 자동 포함(내부 텍스트, 코드 확인). 외부 이동 3중 표시(↗ 아이콘 + 문구 + 이름). `BookIcon`(24px)·`ExternalLinkIcon`(20px) 모두 `aria-hidden="true"`+`currentColor`. 터치 `min-h-touch` |
| 12 | 위계 보존 (§8 갱신) | 카드에 적색·urgent 계열·"긴급" 배지·전폭 배경 미사용 — 컨테이너 폭 내 주조색 계열만 (긴급 배너 시각 우위 유지) |
| 13 | 회귀 (인접 경계면) | `page.tsx` 수정이 유일한 접점 — 탭 ARIA 상태(aria-selected true×1/false×2) 실측 유지, 상세 라우트 ● SSG 유지, `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static 유지) |

### 비고

- 아이콘-텍스트 간격 `gap-3`(0.75rem)·hover outline offset 미지정은 스펙이 정의하지 않은 구간 — Tailwind 표준 스케일 사용으로 임의 hex/px 아님, 이슈 아님.
- 신규 파일 4종에 hex/px 하드코딩·타입 우회(`as any` 등) 0건 (전문 코드 리뷰).

### 미검증 (1·2회차와 동일 — 환경 제약)

브라우저 실조작(hover/focus 시각 상태 실측 포함) / 스크린리더 실낭독 / 375px 실뷰포트(카드 설명 2줄 흘림 실측) / 방명록 §7.2(백엔드 미구축).

---

# QA 리포트: 메인페이지 탭 게시판 (2회차 — 회귀 검증)

- 작성: qa-tester | 작성일: 2026-08-16
- 범위: 1회차 실패 2건 해소 확인 + 수정·신규 파일의 인접 경계면 (스킬 §5 회귀 원칙)
- 수정·신규 파일: `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`, `src/components/board/PostArticle.tsx`, `src/components/layout/SiteHeader.tsx`, `src/lib/content.ts`, 스펙 §4.2 개정본
- 검증 방법: 코드 교차 비교 + 실빌드 라운드트립(플레이스홀더 임시 파일 4건, 검증 후 전량 삭제·빈 상태 복원 실측) + tsc/lint/build 재실행

## 2회차 요약: 통과 12 | 실패 0 | 미검증 4 (1회차와 동일 사유) | 권고 2

### 이전 실패 항목 해소 확인

| # | 1회차 실패 | 판정 | 확인 내용 |
|---|-----------|------|----------|
| 1 | 미구현 상세 라우트 링크 | **해소** | `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx` 신규 확인. `PostList.tsx:33`·`UrgentBanner.tsx:24`의 href(`ROUTES.notice/news`) ↔ 실존 라우트 매칭. `dynamicParams = false`(양쪽 17행) + `generateStaticParams`가 `getVerifiedNotices/News`(verified만) 기반 — **실빌드 실측**: verified 파일만 `.next/server/app/notices|news/*.html` 생성, `verified: false` slug는 미생성(→404). `getVerifiedPost`가 상세 조회 시 verified 게이트 재적용 + slug 경로 조작 방어(`content.ts:192`) — 이중 방어 확인 |
| 2 | news source 필수 미강제 | **해소** | `content.ts:110-113` — `category === "news" && source === null`이면 throw. **실빌드 재실증**: source 누락 verified news 파일로 빌드 실패 + 파일 경로 포함 에러 메시지 확인. title/date와 동일한 "조용한 누락 대신 빌드 실패" 정책으로 일관화 |

### 스펙 §4.2 개정 ↔ 구현 교차 확인 (리더 지정 중점)

**통과.** 개정 스펙: md 미만 좌우 패딩 `0.25rem`·폰트 `1rem`/1.5, md 이상 `1rem`·18px, 분기점 **md**. `BoardTabs.tsx:112` 실코드: 기본(md 미만) `px-1 text-[1rem]/[1.5]` + `md:px-4 md:text-body md:min-w-32 md:flex-none` — 분기점 md로 정확히 일치, sm 분기 없음(스펙 의도와 동일). 탭리스트 `md:inline-flex md:w-auto`(95행)도 §3.5 균등분할→좌측 정렬 전환과 일치. 1회차 S1 종결.

### 신규 경계면 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 타입 경계 | `PostDetail = PostSummary + body`(`content.ts:35-37`) ↔ `PostArticle` props(`PostArticle.tsx:44`) ↔ 상세 페이지 `getVerifiedPost` 반환 타입 일치. 목록 경로는 `listVerifiedPosts`에서 body를 명시 제외(150-162행) — 클라이언트 직렬화 페이로드에 본문 미유입 |
| 2 | XSS/raw HTML | `rehype-raw`·`dangerouslySetInnerHTML` grep 0건. **실빌드 실측**: 본문에 `<script>alert(...)</script>` 포함 테스트 파일 → 렌더 DOM에 실행 가능한 script 요소 없음(RSC 페이로드 내 이스케이프 문자열로만 존재). react-markdown 기본 설정(raw HTML 미실행) 확인 |
| 3 | h1 유일성 | 상세 페이지 `SiteHeader asHeading={false}` → 로고 `<p>` 렌더 실측, `<h1>` 정확히 1개(게시물 제목) 실측. 본문 마크다운 h1/h2→h2, h3→h3 매핑으로 위계 역전 없음 |
| 4 | 디자인 토큰 | 상세 신규 파일 3종 hex/px 하드코딩 0건. `max-w-prose`(42rem)·`max-w-page`(48rem) 토큰, 본문 링크·뒤로가기 `text-primary-strong`(#1e40af — #1d4ed8 텍스트 금지 준수), 뒤로가기 `min-h-touch`, focus-visible 스타일 존재 |
| 5 | 라우팅 (신규) | 뒤로가기 `backHref = ROUTES.homeTab("notices"|"news")` → `/`·`/?tab=news` — 실존 경로·탭 파서와 일치(빌드 HTML에서 href 실측) |
| 6 | 타입 우회 | 전체 재grep — `as any|as unknown|@ts-ignore|@ts-expect-error` 0건 유지 |
| 7 | 빌드 3종 | `npx tsc --noEmit` 오류 0, `npm run lint` 오류 0, `npm run build` 통과(`/` ○ Static 유지, 상세 ● SSG). 임시 파일 4건 전량 삭제 후 클린 재빌드·빈 상태 복원 실측(content/에 .gitkeep만 잔존) |

### 권고 (실패 아님 — web-developer 참고)

1. `PostArticle.tsx:13-41` — 마크다운 h4~h6 미매핑: 콘텐츠가 h4 이하를 쓰면 브라우저 기본 스타일(h5/h6은 15px 미만 가능)로 렌더되어 스펙 "15px 미만 금지"를 우회할 여지. h4 이하 매핑 추가 또는 콘텐츠 규약에 "제목은 h3까지" 명시 권장.
2. `content.ts:192` slug 정규식이 거부하는 파일명(공백 등)은 목록에는 노출되나 상세가 404 — 파일명이 규약 밖이면 `parsePostFile`에서 throw하여 빌드에서 잡는 것이 일관적. (콘텐츠 파일명이 통제되는 현 운영에서는 실위험 낮음)

### 미검증 (1회차와 동일 — 환경 제약)

브라우저 실조작 키보드 내비게이션 / 스크린리더 실낭독 / 375px 실뷰포트 실측 / 방명록 §7.2(백엔드 미구축). 상세 페이지도 동일 제약 적용.

---

# QA 리포트: 메인페이지 탭 게시판 (1회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 대상: `src/` 전체, `content/`, `src/app/globals.css`
- 근거: `_workspace/00_input/requirements.md`, `_workspace/02_designer_spec.md`, `_workspace/03_developer_impl.md`, `union-qa-testing` 스킬, `union-webapp-dev` 스킬 §3
- 이전 리포트: 없음 (1회차 — 회귀 검증 대상 없음)
- 검증 방법: 코드 교차 비교 + 실빌드 HTML 실측(임시 플레이스홀더 콘텐츠 라운드트립, 검증 후 전부 삭제·빈 상태 복원 확인) + 대비 스크립트 실행 + tsc/lint/build 실행

## 요약: 통과 20 | 실패 2 | 미검증 4 | 스펙 확인 필요 1

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 라우팅 (경계면: 링크 생산자 ↔ page 파일) | `src/components/board/PostList.tsx:33` (`hrefFor(post.slug)`), `src/components/notice/UrgentBanner.tsx:24` (`ROUTES.notice(post.slug)`) ↔ `src/app/` (상세 라우트 부재) | 목록 아이템·긴급 배너 링크가 `/notices/[slug]`, `/news/[slug]`를 가리키지만 `src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`가 존재하지 않음. 실빌드 HTML에서 `href="/notices/qa-test-…"` 출력 실측 확인 — **verified 콘텐츠가 1건이라도 등록되는 즉시 클릭 시 404**. 현재는 content/가 비어 있어 노출되지 않을 뿐임 (개발자도 03_developer_impl.md §4-4에서 인지·보고) | 상세 라우트(`src/app/notices/[slug]/page.tsx`, `src/app/news/[slug]/page.tsx`) 구현을 콘텐츠 등록의 선행 조건으로 확정하고 web-developer에게 구현 요청. 차기 스프린트로 미룬다면 "상세 페이지 구현 전 콘텐츠 등록 금지"를 운영 규칙으로 리더가 명문화할 것 (범위 판단은 리더 몫) |
| 2 | 콘텐츠 스키마 (경계면: 스펙 §5 ↔ 로더 ↔ 컴포넌트) | `src/lib/content.ts:115` (`source: readString(data.source)` — null 허용) ↔ `src/components/board/PostList.tsx:44` (`post.source !== null`일 때만 출처 렌더) ↔ 스펙 §5 "금융노조 소식 탭은 **출처 필수 표기**" | 로더가 news 카테고리의 `source` 누락을 허용하여 출처 없는 소식이 그대로 게시됨. 실증: source 없는 verified news 임시 파일이 출처 미표기 상태로 목록에 렌더됨을 빌드 HTML에서 확인. title/date는 누락 시 빌드 실패시키면서 news의 source는 조용히 통과 — 방어선 비일관 | `src/lib/content.ts`의 `parsePostFile`에서 `expectedCategory === "news"`이고 `readString(data.source) === null`이면 title/date와 동일하게 throw (98행 category 검사 인접에 추가). 오보 방지 원칙상 "조용한 누락"보다 빌드 실패가 안전 |

## 스펙 확인 필요 (frontend-designer 몫 — 스펙 자체의 조합 충돌)

| # | 위치 | 내용 | 요청 |
|---|------|------|------|
| S1 | 스펙 §4.2 ↔ `src/components/board/BoardTabs.tsx:112` | 스펙은 탭 좌우 패딩 1rem + "잘리면 모바일 한정 16px 축소 허용"을 규정하나, 375px에서 3탭 균등분할 시 두 조건이 물리적으로 양립 불가(개발자 계산: 탭당 가용 ~109px < 16px 텍스트+패딩 32px). 개발자는 모바일 한정 `px-1`(4px) + 16px(`text-[1rem]/[1.5]`)로 구현 (md+는 스펙대로 px-4·18px·min-w-32). 15px 미만 금지는 준수됨 | 디자이너가 모바일 패딩 축소치를 스펙에 공식 반영하거나 대안(탭 스크롤 등) 제시. 현 구현은 스펙 미정의 구간의 최소 해석으로 합리적 |

## 통과 항목 (검증한 것만)

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | verified 게이트 (실동작) | `verified: false` 임시 파일이 목록에서 제외됨을 빌드 HTML에서 실측 (`content.ts:87` — `readBoolean(data.verified) !== true → null`, boolean 정확 일치) |
| 2 | verified 게이트 (실동작) | `verified: true` + title/date 누락 파일 → 빌드 실패 실측 (`content.ts:94` throw, 에러 메시지에 파일 경로 포함 — 조용한 누락 방지 설계 확인) |
| 3 | 긴급 배너 (실동작) | urgent+verified 1건 존재 시 `aria-label="긴급 공지"` region·배지·아이콘 렌더, 0건 복원 시 DOM에서 완전 제외 — 양쪽 모두 빌드 HTML 실측 |
| 4 | 빈 상태 (실동작) | 콘텐츠 0건에서 "등록된 공지사항이 없습니다"/"등록된 소식이 없습니다" + 보조 메시지 렌더 실측. `role="status"` 미부여(스펙 §6대로), 가짜 예시 게시물 없음 |
| 5 | 방명록 폼 미렌더 (실동작) | 빌드 HTML에 `<form>` 0건 실측. `GuestbookPanel.tsx:29-35` — unconfigured/configured **양쪽 모두** PreparingCard 반환 (백엔드 실구축 전 disabled 폼·가짜 UI 노출 경로 없음, 스펙 §7.1 준수) |
| 6 | 방명록 API 계층 | `guestbook.ts` — `GuestbookResult` 판별 유니온으로 unconfigured 명시 반환, 응답은 `parseGuestbookEntry(unknown)`에서 필드별 typeof 검증. any/근거 없는 as 없음 |
| 7 | 콘텐츠 스키마 교차 | 스킬 §3 frontmatter(title/date/category/urgent/deadline/source/verified) ↔ `content.ts` 필드별 검증 함수 ↔ `PostSummary` ↔ `PostList` props — source 강제 건(실패 #2) 제외 전 필드 명칭·타입·옵셔널 일치. category↔디렉토리 불일치 시 throw 확인 |
| 8 | 라우트 상수 규약 | 모든 내부 링크가 `ROUTES` 상수 경유 (SiteHeader/PostList/UrgentBanner/BoardTabs grep 확인, 문자열 하드코딩 0건). `ROUTES.home`("/")·`homeTab` 쿼리 ↔ `page.tsx` 실존, `?tab=` 파서 `isTabId`와 `TAB_IDS` 단일 소스 일치 |
| 9 | 타입 우회 탐지 | `as any\|as unknown\|@ts-ignore\|@ts-expect-error` grep 결과 0건 |
| 10 | 디자인 토큰 값 | `globals.css` `@theme` 블록 ↔ 스펙 §1 — 색 12종·타이포 5단계(라인하이트/웨이트 포함)·간격 3종 전부 값 일치. create-next-app 다크모드 미디어쿼리 제거 확인 |
| 11 | 임의 값 하드코딩 | 컴포넌트 내 hex 하드코딩 0건, arbitrary value는 `text-[1rem]/[1.5]`(스펙 허용 모바일 16px, S1 참조) 1건뿐. radius(rounded/lg/xl=4/8/12px)·아이콘 크기(size-3.5/5/10=14/20/40px)·간격 전부 스펙 값과 일치 |
| 12 | #1d4ed8 텍스트 금지 | `text-primary` 사용처 0건 — `--color-primary`는 `focus-visible:outline-primary`(포커스 링, UI 전용)로만 사용. 본문 크기 링크·hover 텍스트는 전부 `primary-strong`(#1e40af). `#e5e7eb`(border-soft)는 divide/구분선 장식 전용, `#9ca3af` 미사용 |
| 13 | 색상 대비 (스크립트 실측) | 실사용 17조합 전부 `check-contrast.mjs` 실행 — 텍스트 조합 11종 전부 AAA 통과(최저 7.23:1), UI 전용 조합 6종(포커스 링·보더·아이콘) 전부 3:1 이상. 스펙 §2 수치와 완전 일치 |
| 14 | 탭 ARIA 구조 (실측) | tablist(`aria-label="게시판"`)/tab×3/tabpanel×3, `aria-controls`↔패널 id·`aria-labelledby`↔탭 id 교차 일치, `aria-selected` true×1/false×2·로빙 탭인덱스(선택 탭만 0) — SSR HTML에서 실측. 비선택 패널 `hidden` 실측, 패널 `tabindex=0` |
| 15 | 탭 키보드 (코드 검증) | `BoardTabs.tsx:62-87` — ←/→ 양끝 순환, Home/End, 이동 즉시 활성화(automatic activation) + `tabRefs` focus 이동. 탭 상태는 URL 쿼리 단일 소스(`useSyncExternalStore`), 잘못된 `?tab=` 값은 기본 탭 폴백 |
| 16 | 시맨틱 마크업 | landmark: header/main/footer + 배너 section role=region. 이동=`<Link>`/동작=`<button type="button">` 구분, `div onClick` 0건, `<img>` 0건(SVG 전부 `aria-hidden`+currentColor, 의미는 인접 텍스트 담당). 제목 h1(헤더)→h2(방명록 카드) 순서 건너뜀 없음 |
| 17 | 날짜 처리 | `date.ts` — Intl UTC 고정, 수동 계산 없음. `YYYY.MM.DD` 표기·`<time datetime="YYYY-MM-DD">` 빌드 HTML 실측(SSR이 `dateTime` 카멜케이스로 출력하나 HTML 속성 대소문자 무구분으로 유효 — 개발자 결정 8 확인) |
| 18 | 터치 대상·포커스 | 탭·헤더 링크·배너 링크 `min-h-touch`(44px), 목록 아이템 `py-4`+2행 콘텐츠(≥72px). 모든 인터랙티브 요소에 `focus-visible:outline-3` 존재(목록은 내향 offset -3), `:focus`(마우스)에는 미표시 |
| 19 | 정렬·배너 선택 로직 | `content.ts:120-125` urgent 우선→게시일 내림차순, `getLatestUrgentNotice`는 정렬 후 첫 건(최신 urgent) — 스펙 §5·§3.2 일치 |
| 20 | 빌드/정적 검사 | `npx tsc --noEmit` 오류 0, `npm run lint` 오류 0, `npm run build` 통과 — `/` 정적 프리렌더(○ Static) 유지. 테스트 파일 삭제 후 클린 재빌드로 빈 상태 복원 확인(content/에 .gitkeep만 잔존, "QA 테스트" 문자열 잔존 0건) |

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | 브라우저 실조작 키보드 내비게이션 (화살표/Home/End 실입력, 포커스 시각 확인) | 브라우저 E2E 실행 환경 미구성 — 코드 검증 + SSR HTML 실측까지만 수행 (통과 #14·15는 그 범위의 판정) |
| 2 | 스크린리더 실낭독 (탭 전환 안내, 배지 "긴급" 낭독) | 보조기기 실행 환경 없음 |
| 3 | 375px 실뷰포트에서 "금융노조 소식" 탭 잘림 여부 실측 | 뷰포트 렌더 환경 없음 — 개발자 계산값만 존재 (S1과 연동, 디자이너 확인 시 실기기 확인 권장) |
| 4 | 방명록 §7.2 작성 폼·글 목록 | NCP 백엔드 미구축 — 구현 자체가 이번 범위 외. API 계층 시그니처만 코드 검증(통과 #6) |

## 비고

- 다크 모드는 스펙이 명시적으로 범위 제외 — 검증 대상 아님.
- 검증용 임시 파일 4건(`qa-test-verified-urgent.md`, `qa-test-unverified.md`, `qa-test-broken.md`, `qa-test-news-no-source.md`)은 전부 명백한 플레이스홀더 문구(`[QA 테스트 파일입니다]`)로 작성했고, 검증 후 삭제·클린 재빌드로 잔존 없음을 확인했다.
- 실패 #1은 개발자가 이미 인지·보고한 항목이나, "콘텐츠 등록 즉시 404"라는 트리거 조건이 있으므로 리더의 명시적 결정(상세 라우트 선행 구현 또는 콘텐츠 등록 차단 규칙) 전까지 실패로 유지한다.
