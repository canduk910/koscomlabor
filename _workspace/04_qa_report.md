# QA 리포트: 디자인 전면 교체(v3) + 썸네일 + 수동 정렬 (13회차)

- 작성: qa-tester | 작성일: 2026-08-17
- 판정 기준: **`union-design-system` 스킬 §0 v3**(§0.3 양보하지 않는 선 · §0.4 은폐 금지 패턴표 · §0.5 썸네일) + **02 스펙 §16 전체(§16.0~16.20)**, 판정 체크리스트는 **§16.20 의 23항**, 대비표는 **§16.18**. 계승 항목 **§15.1(은폐 금지 7조건) · §15.4 · §15.6R-C·D·E · §15.12(14항)** 포함. 부수 기준: `00_input/contract-sort-thumbnail.md`, `03_developer_impl.md` §19(§19.8 리더 판정 4건 포함), `06_backend_api_spec.md` §20, `07_backend_impl.md` §11
- **검증 대상 코드 = 커밋 `df2ccfd`** ("feat: 디자인 전면 교체(toss 계열) + 썸네일 + 수동 정렬 UI"). 검증 착수 시점에는 미커밋 상태였고, 세션 중 커밋됐다. **`src/**` 37파일 md5 스냅샷을 착수 시(21:57)·종료 시 두 번 떠서 대조했고 변동 0건** — 내가 측정한 코드가 현재 HEAD 의 코드와 바이트 단위로 동일하다
- **⚠ 검증 중 코드 2줄 변경 발생(리더 적용, 반영 완료)**: 21:49 에 `PostList.tsx:171`·`PostArticle.tsx:105` 썸네일 래퍼에 **헤어라인**(`border-b border-border-soft` / `md:border`, 상세는 4변)이 추가됐다. 발견 경위는 내가 렌더 실측 중 **소스에 없는 클래스가 서빙되는 것**을 잡아낸 것이고, 이후 리더 지시로 판정 기준 6개를 적용해 **전 항목 재측정**했다. 아래 결과는 전부 헤어라인 적용 후 값이다
- 검증 환경 **2계통**
  1. **읽기 경로** — 로컬 프론트 프로덕션 빌드(`node .next/standalone/server.js`, 포트 3200) + **실 프로덕션 API**(`https://union-api.koscomlabor.cloud`). 노동교육 5건의 실 썸네일(maxres 4 + 오바마 mqdefault 1)로 측정. **프로덕션 쓰기 0건 — GET 만 호출**
  2. **쓰기 경로** — 전용 DB **`qa_redesign`** 신규 생성 + 스크래치패드 전용 env(`PORT=3301`, QA 전용 `ADMIN_PASSWORD_HASH`/`ADMIN_API_TOKEN`/`IP_HASH_SECRET`, `UPLOAD_DIR`=스크래치패드, `COOKIE_SECURE=false`, `CORS_ORIGINS=http://localhost:3201`) + 로컬 프론트 빌드(포트 3201). **개발 DB `guestbook` 무접촉(양 테이블 0행 유지)**, **`server/.env` 무수정**(md5 `bb9eabf5…`, mtime 08-17 09:32 = 세션 시작 전)
- 검증 방법: ① 스킬 §0.4 패턴 **렌더 HTML·계산 스타일 전수 감사** ② §16.18 **22조합 + 탈락 7조합 스크립트 재실행** ③ **빌드 CSS 에서 실제 생성된 클래스·색 전수 추출** ④ **실렌더 색 조합 전수 추출 후 §16.18 표와 교차 대조** ⑤ 격리 프로필 headless Chrome + Node 내장 WebSocket **CDP 자체 드라이버**로 실조작(`claude-in-chrome` MCP 는 localhost 도달 불가 — 11·12회차 확인) ⑥ **썸네일 요청 전면 차단 렌더 vs 정상 렌더 대조**(CLS) ⑦ **JS 실행 차단** 렌더 ⑧ `prefers-reduced-motion: reduce` 에뮬레이션 ⑨ **실 썸네일 5건 둘레 밴드 픽셀 대비 정량 측정** ⑩ 정렬 UI **실클릭 전 플로우 + 409 실유발** ⑪ 360/768/1024/1280px 실측 ⑫ psql 직접 확인 ⑬ 빌드 6종 ⑭ 스크린샷 27장
- 정리: **`qa_redesign` drop 완료**, next(3200·3201)·API(3301)·Chrome 프로세스 **전건 종료(포트 3전부 해제)**, Chrome 임시 프로필·스크래치패드 업로드 디렉터리 삭제, **프로덕션 쓰기 0건**, 프로덕션 코드 수정 0건

## 13회차 요약: 통과 266 | **실패 0** | 권고 4 | 미검증 6

> **§16.20 체크리스트 23항 전건 PASS.** 이번 회차의 핵심 성과 3가지: ① **혼재 처리 설계가 실데이터에서 목적을 달성했다** — 썸네일 있는 카드와 없는 카드가 섞인 목록에서 제목 좌측 x 좌표가 **216px 전 카드 동일**(개발자 실측 재현) ② **CLS 가 실제로 0이다** — 썸네일 요청을 전면 차단한 렌더와 정상 렌더의 제목 Y 좌표·섹션 높이·문서 총높이가 **완전 일치** ③ **리더 판정 2(라이브 리전 이중 낭독)가 실제로 해소됐다** — 저장 성공 문구가 화면 전체에서 **정확히 1개 리전(부모)** 에만 존재. 은폐 회귀 **0건**.

---

### A. 은폐 회귀 — 스킬 §0.4 + §15.1 (전건 PASS)

디자인이 전면 교체됐으므로 처음부터 다시 전수 검사했다.

| # | 항목 | 결과 | 근거(실측) |
|---|------|------|-----------|
| A1 | `role="tab"` / `role="tabpanel"` / `role="tablist"` / `aria-selected` | **PASS 전부 0건** | 렌더 HTML 문자열 0/0/0/0 + 라이브 DOM 0/0/0/0 |
| A1-a | 콘텐츠를 담은 `[hidden]` 요소 | **PASS 0건** | `[hidden]` 요소 **정확히 1건** = `<div hidden=""><!--$--><!--/$--></div>` — `textContent.length === 0` · `children === 0`(Next 셸 빈 서스펜스 경계). 리더가 허용한 1건 외 0 |
| A1-b | `display:none`·`visibility:hidden` 으로 감춰진 **콘텐츠** | **PASS 0건** | 감춰진 요소는 전부 `<script>`(RSC flight payload). UI 텍스트 은폐 0. 반응형 변형 2건(`hidden md:flex` DateBadge / `md:hidden` D-n)은 **양방향으로 같은 정보를 다른 요소가 표시**(12회차 실증 계승) |
| A2 | **아코디언·캐러셀 미도입** | **PASS** | `<details>` 0건 · `[aria-expanded]` 0건 · `<iframe>` 0건 |
| A2-a | **스크롤 등장 애니메이션 미도입** | **PASS** | 인라인 스크립트에 `IntersectionObserver` 0건. **`opacity < 1` 인 텍스트 보유 요소 0건**, **`transform ≠ none` 인 텍스트 보유 요소 0건** → 초기값으로 가려진 콘텐츠 0 |
| A3 | **JS 차단 상태 렌더** | **PASS** | `Emulation.setScriptExecutionDisabled` 후 4섹션 전부 `display:block`·높이 300/203/915/664px, **게시물 제목 6건 전부 렌더**, `h2` 4개, `[hidden]` 1건(프레임워크) |
| A4 | **`prefers-reduced-motion: reduce`** | **PASS** | `transition-duration: 1e-05s` · `scroll-behavior: auto` · 카드 `transform: none` · 썸네일 `transform: none` · **4섹션 정상 노출** · 콘텐츠 `[hidden]` 0 |
| A5 | 섹션 바로가기 칩 활성/선택 하이라이트 (§15.4) | **PASS** | 칩 4개 계산 스타일 **완전 동일**(`#ffffff` / `#093389` / border `#6b7280` / 600) · `aria-current` 0건 · `nav` `position: static`(비sticky) · href 순수 프래그먼트 · 높이 44px |
| A6 | 히어로에 오른 긴급 공지가 공지 목록에도 남는가 (§15.1-6) | **PASS** | 로컬 격리 환경(urgent 1건)에서 히어로 `h2` 제목과 **동일 제목이 `#notices` 목록 1행에도 존재**. 1280px·360px 양쪽 확인 |
| A7 | 마감 스트립 항목이 섹션 목록에도 남는가 | **PASS** | 스트립 3항목(공지 2 + 교육 1) 전부 해당 섹션 목록에 존재 |

### B. 대비 — §16.18 전건 재현 (PASS)

**B1. 스크립트 재실행 — 22조합 전건 수치 일치**

`node .claude/skills/union-design-system/scripts/check-contrast.mjs` 를 §16.18 의 재현 명령 그대로 실행했다. 스펙 기재값을 믿지 않고 전건 대조:

`17.40 / 7.56 / 11.37 / 8.46 / 8.77 / 4.83 / 11.37 / 9.23 / 9.23 / 14.13 / 8.46 / 10.45 / 15.99 / 7.84 / 15.58 / 10.18 / 16.65 / 7.23 / 10.88 / 4.63 / 7.74 / 15.91` — **22/22 표와 일치.**

탈락 조합도 재현: `#4b5563:#f1f3f6` **6.80** · `#4b5563:#eef1f5` **6.67** · `#4b5563:#fef2f2` **6.91** · `#6b7280:#eff6ff` **4.44** · `#f9fafb:#ffffff` 1.05 · `#e5e7eb:#ffffff` 1.24 · `#f1f3f6:#ffffff` 1.11 — 전건 스펙 수치와 일치.

**B2. 빌드 CSS 색 전수 추출 — 신규 색 0건 · 색 값 변경 0건**

`.next/static/chunks/*.css`(26,920 B) 의 hex 색 전수: `#093389`(×7) `#fff`(×4) `#1a1a1a`(×2) `#fef2f2` `#fdf0e7` `#f9fafb` `#eff6ff` `#e5e7eb` `#d9e9ff` `#d0101b` `#9c0d14` `#7a3806` `#6b7280` `#4b5563` `#2e7df7`. **§16.8 의 17종 외 색 0건.** `#ec6d1e`(`--color-accent`)는 **사용처 0이라 Tailwind v4 가 산출물에서 제거** — §16.2 의도와 일치(정의는 소스에 보존).

**B3. 실렌더 색 조합 교차 대조 — 표 밖 조합 0건**

라이브 DOM 에서 **자체 텍스트 노드를 가진 전 요소**의 `color` + 유효 배경(조상 탐색)을 추출했다. 등장한 텍스트 조합은 9종이고 **전부 §16.18 표 안**이다:

| 실렌더 조합 | §16.18 # | 비율 | 대표 사용처(실측) |
|---|---|---|---|
| `#093389` on `#ffffff` | 3 | 11.37 | 헤더 록업 · 칩 텍스트 · 복귀 링크 |
| `#ffffff` on `#093389` | 7 | 11.37 | 히어로 표제 64px · 푸터 지부명 · 원문 보기 버튼 |
| `#d9e9ff` on `#093389` | 8 | 9.23 | 푸터 저작권 · 히어로 게시일 |
| `#093389` on `#d9e9ff` | 9 | 9.23 | 마감 스트립 항목 · **정렬 패널 순번 배지** |
| `#1a1a1a` on `#ffffff` | 1 | 17.40 | 섹션 제목 36px · 카드 제목 · 본문 |
| `#4b5563` on `#ffffff` | 2 | 7.56 | 메타 1·2행(게시일·채널명·외부 링크·도메인) ×35 |
| `#1a1a1a` on `#f9fafb` | 17 | 16.65 | L2 면 빈 상태 주 메시지 |
| `#4b5563` on `#f9fafb` | 18 | 7.23 | L2 면 보조 메시지 |
| `#7a3806` / `#1a1a1a` on `#fdf0e7` | 14 / 15 | 7.84 / 15.58 | 온누리 카드 제목·설명 |

보더·아웃라인 색: `#093389` on `#ffffff`(11.37 · 헤더 트림) · `#6b7280` on `#ffffff`(4.83 · 칩·입력 필드 보더) — 둘 다 표 안(#3·#6).

- **본문 7:1(AAA) 위반 0건.** `#4b5563` 은 **`#ffffff`·`#f9fafb` 두 배경에만** 얹혔다(§16.20-23 의 명시 확인 항목). 스펙이 탈락시킨 `#4b5563:#f1f3f6`(6.80)·`#4b5563:#fef2f2`(6.91) 은 **렌더에 되살아나지 않았다**.
- **보조 텍스트 `#595959` 하한 위반 0건** — 실사용 보조색은 `#4b5563`(7.56/7.23)뿐이며 `#595959`(7.00)보다 어둡다.
- `:focus-visible` 아웃라인: 실측 **3px `rgb(9, 51, 137)`**(11.37 ≥ 3:1) — Tab 12스텝 전건 동일.
- 헤어라인 `#e5e7eb`(1.24 on `#ffffff`)은 §16.18 **하단 표에 이미 실측·기록된 조합**이므로 신규 색 조합 0건 판정은 유지된다. 단 사용처 기술 갱신이 필요하다 → **권고 1**.

### C. 썸네일 — §16.10 + 스킬 §0.5 (실 프로덕션 API, 전건 PASS)

| # | 항목 | 결과 | 근거(실측) |
|---|------|------|-----------|
| C1 | **혼재 처리 — 제목 좌측 x 동일** | **PASS** | 프로덕션 실데이터 6카드(썸네일 5 + 무 1) md+ 제목 x = **216 / 216 / 216 / 216 / 216 / 216**. **개발자 실측 216px 재현.** 추가로 **한 목록 안의 혼재**를 로컬에서 구성(소식 3건 = 썸네일 1 + 무 2) → **전부 216px**. 1024px 에서도 전 카드 88px 동일 |
| C1-a | 플레이스홀더 박스 | **PASS 0건** | 썸네일 없는 카드의 `aspect-ratio: 16/9` 요소 **0개**. `thumbnailUrl !== null` 만이 렌더 조건 |
| C2 | **CLS 0** | **PASS** | 썸네일 요청 **전면 차단** 렌더 vs 정상 렌더: 제목 Y = `1517,1689,1861,2033,2205` **완전 동일** · 섹션 높이 **915 = 915** · 이미지 박스 높이 `106×5` 동일 · **문서 총높이 3594 = 3594**. 래퍼 `aspect-ratio: 16 / 9` + `<img width="1280" height="720">` **둘 다 DOM 에 존재** 확인 |
| C2-a | 헤어라인 적용 후 외곽 치수 불변 (리더 판정 6) | **PASS** | 래퍼 외곽 md+ **192×108**, 360px **328×184.5** — 헤어라인 전과 동일. `aspect-video` 가 **테두리 박스**에 걸려 레이아웃 치수가 변하지 않는다 |
| C3 | 360px 풀블리드 / md+ 우측 배치 | **PASS** | 360px: 래퍼 **328×184.5**, x=16(풀블리드), 헤어라인 **하단 1변만**(`0px/1px`, `#e5e7eb`) / 768·1024·1280px: 래퍼 **192×108**, 헤어라인 **4변 1px**, x=521/745/872(카드 우측) · md+ radius **12px**(`rounded-badge`) |
| C3-a | 가로 스크롤 | **PASS 0** | 360·768·1024·1280px 전부 `scrollWidth === clientWidth`, **뷰포트 초과 요소 0건** |
| C4 | 썸네일이 AX 트리에서 장식 | **PASS** | AX 전체 트리의 `image` 역할 노드 **정확히 2건 = 푸터 로고 2개**(alt `전국금융산업노동조합`·`코스콤`, §16.9.2 "alt 변경 0"). **썸네일 5장은 AX 트리에 0건.** `alt=""`, `aria-hidden` 미부여(§16.10.4 그대로). 헤더 마크는 `alt="" aria-hidden="true"` |
| C4-a | **카드 접근성 이름에 채널명이 남는가** (§15.6R-D 게이트 조건) | **PASS** | 5카드 AX 이름 전건 확인: `노동조합이란 2026.08.17 금융노조 교육문화본부 외부 링크(새 창) www.youtube.com` 형태 — **채널명 4종(`금융노조 교육문화본부`·`금융노조`·`하종강의 노동과 꿈`·`마이크임팩트`) 전부 포함**, `외부 링크(새 창)` 포함, **이미지 파일명·`thumbnails` 문자열 미포함** |
| C5 | **`mqdefault` 실화질 판단** | **PASS(수용)** | 오바마 건 원본 **320×180** → md+ 표시 192×108 은 **축소 렌더라 열화 없음**(3× DPR 캡처에서 자막 `나를 지지하는 누군가가 원한다면` 판독 가능). 360px 328×184.5 는 **1.025배 확대** → 3× DPR(984 디바이스 px, 실질 3.08배)에서 `maxresdefault` 형제 카드 대비 **눈에 띄게 부드럽지만 정보 전달 손실 0**. §16.10.3 이 수용하기로 한 한계 범위 안. 스크린샷 `C5-*` 4장 첨부 |
| C5-a | **`maxresdefault` 폴백이 실제로 동작했는가** | **PASS** | `i.ytimg.com/vi/Vj3lQ7Y71PU/maxresdefault.jpg` 를 직접 호출 → **HTTP 404** + 본문은 120×90 JPEG(YouTube "없음" 플레이스홀더). 서버가 상태코드 200 을 요구하므로 **정상적으로 `mqdefault` 로 폴백**했다. 나머지 4건은 200 + 1280×720 |
| C6 | 로딩 실패 시 표현 | **PASS** | 요청 차단 상태에서 `naturalWidth = 0`, 래퍼 배경 `rgb(249, 250, 251)`(#f9fafb) 회색 박스 유지, `alt=""` 이므로 **대체 텍스트·깨진 아이콘 문자열 0**, 레이아웃 불변(위 C2) |
| C7 | `immutable` 캐시 실동작 | **PASS** | 1차 응답 `200` + `cache-control: public, max-age=31536000, immutable` + `content-type: image/jpeg`. **재방문 시 5건 전부 디스크 캐시 히트**(`fromDiskCache: true`, 네트워크 재다운로드 0) |
| C8 | `<iframe>` 임베드 금지 유지 (§15.6R-F) | **PASS 0건** | 소스·렌더 양쪽 0 |
| C9 | 프로덕션 `/thumbnails/:key` 하드닝 재확인 | **PASS** | `hqdefault` → **400** · 잘못된 키 → **400** · 경로조작(`../package.json`, `--path-as-is`) → **404** · 없는 키 → **404** · 정상 키 → 200/73,512 B. 서버에 `filesLimiter`(IP 당 분당 120회) 적용됨(`routes/posts.ts:204`) |
| C10 | 상세 페이지 썸네일 | **PASS** | 링크형만 렌더(`loading="eager"`, `alt=""`, 래퍼 radius 24px, 헤어라인 4변 `#e5e7eb`). 작성형·`thumbnailUrl: null` 링크형(kfiu.org 성명)에는 **미렌더** |

**디자이너 추가 요청 1 — `-WrzgLtvuPU` 경계 식별성: 헤어라인 필요성 독립 재현**

실 썸네일 5건을 프로덕션에서 받아 **둘레 1px 밴드를 픽셀 단위로 샘플링**해 흰 카드(`#ffffff`) 대비 비율을 계산했다. 디자이너 수치가 **소수점까지 재현**됐다:

| 항목 | 둘레 평균 대비 | 1.5:1 미만 비율 | 디자이너 보고값 | 판정 |
|------|---------------|----------------|----------------|------|
| `-WrzgLtvuPU` 산별노동조합이란 | **1.000** (min 1.000 / max 1.000) | **100%** | 1.00:1 · 100% | **일치** |
| `ATbGKR-Agmk` 노동조합이란 | **1.537** | **47.3%** | 1.54:1 · 47% | **일치** |
| `jeK7W_SADUs` 산별중앙교섭 | 14.944 | **17.1%** | 17% | **일치** |
| `Vj3lQ7Y71PU` 오바마(mqdefault) | 11.428 | 0% | — | 헤어라인 불요 케이스 |
| `OFfbgB5dOIA` 노조가 필요한 이유 | 15.694 | 0% | — | 동일 |

헤어라인 **적용 전/후 5배 확대 캡처**(`E-hairline-before-WrzgLtvuPU.png` / `E-hairline-after-WrzgLtvuPU.png`)로 육안 대조했다: **before 는 일러스트가 카드 위에 경계 없이 떠 있고, after 는 12px 라운드 프레임이 미디어 박스를 확정한다.** 리더 판정 1~5 를 그대로 수용한다 — 신규 색 0건, WCAG 1.4.11 비적용(장식), 카드별 진하기 차이는 사진 프레임으로 읽힘, §16.5 는 요소 단위 규칙이므로 카드는 여전히 그림자 1개. **낮은 대비를 실패로 리포트하지 않았다.**

### D. 정렬 UI — §16.15 + 계약 §3·§8 (전용 로컬 DB·API, 전건 PASS)

프로덕션 쓰기 금지를 지켜 **전용 DB `qa_redesign` + 로컬 API 3301** 에서만 조작했다.

| # | 항목 | 결과 | 근거(실측) |
|---|------|------|-----------|
| D1 | 이동 버튼 44×44 · `aria-label` · 첫/마지막 `disabled` | **PASS** | 10버튼 전부 **44×44px**. `aria-label` 전건 `{제목} — 위로/아래로 이동 (현재 n번째)` 형식(예 `오바마 대통령이 말하는 노조 — 아래로 이동 (현재 4번째)`). disabled 매트릭스 `[[T,F],[F,F],[F,F],[F,F],[F,T]]` = 첫 행 위로·마지막 행 아래로만 |
| D2 | **이동으로 disabled 되면 반대 방향 버튼으로 포커스 이전** | **PASS** | 마지막 행 "위로" **4회 연속 클릭** → 매회 `activeElement`가 `BUTTON`(포커스 소실 0), 1번째 도달 시 포커스가 **`노조가 필요한 이유 — 아래로 이동 (현재 1번째)`** 로 이전되고 그 버튼은 **활성**(`disabled: false`) |
| D3 | **긴급 게시물 안내 문구** | **PASS** | `긴급으로 표시된 게시물은 공개 목록에서 지정 순서와 무관하게 맨 위에 표시됩니다.` 문자 단위 렌더 확인. `#4b5563` on `#ffffff`(7.56) |
| D4 | **저장 성공 문구가 라이브 리전 하나에서만** (리더 판정 2) | **PASS** | 저장 200 직후 화면의 **전 `[role=status]`·`[role=alert]` 를 열거**해 문구별 보유 리전 수를 셈 → `순서를 저장했습니다.` 보유 리전 **정확히 1개**, 그 1개는 **패널 밖(부모 `AdminApp`)**(`inPanel: false`). 패널 `role=status` 는 **빈 문자열**(직전 이동 안내 잔존 0), 패널 `role=alert` 도 빈 문자열 |
| D4-a | 에러·409 는 패널에 남는가 | **PASS** | 409 시 `role=alert` **패널 내부** 1곳에만 문구 존재, 색 `rgb(156, 13, 20)`(#9c0d14, 8.46) |
| D5 | **409 `CONFLICT` 분기** | **PASS** | 패널에서 순서 변경 후 **다른 경로(직접 API)로 education 글 1건 추가** → 저장 → `role=alert` = **`목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.`**(계약 §3 #4 문자 일치) · **목록 재조회로 6건이 됨** · **로컬 순서 폐기(dirty 해제)** · **저장 버튼 비활성** · alert 문구 유지 |
| D5-a | `http.ts` 의 `conflict` 미등록으로 인한 오분류 | **PASS(오분류 0)** | 실응답 409 에서 "서버에 연결하지 못했습니다" 계열 문구 **0건**. `http.ts` 는 `CODE_TO_REASON.CONFLICT` + `STATUS_TO_REASON[409]` **이중 등록**(비정형 본문에도 방어) |
| D6 | **저장 후 공개 목록 순서가 실제로 바뀌는가** | **PASS** | 패널 지정 순서 = 공개 API `/posts?category=education` 순서 **배열 단위 일치**. 메인페이지 렌더도 **일치**(단 ISR 60초 — 아래 권고 4) |
| D6-a | **urgent 가 `sort_order` 보다 우선** (계약 §2) | **PASS** | 공지 6건에 `sort_order` 1..6 부여, **urgent 글에 최하위 값 6** 을 준 상태에서 공개 목록 1번째가 **urgent 글**. urgent 제외 나머지는 `sort_order` 오름차순 그대로 |
| D6-b | 패널이 urgent 를 정렬 키로 쓰지 않는가 (§16.15.4-1) | **PASS** | 패널에서 urgent 글을 **맨 아래로 배치 가능**했고 그 상태가 저장됐다 |
| D7 | **PostForm·비밀번호 패널·정렬 패널 동시 개방 금지** | **PASS** | h3 추이 `["게시물 순서 지정"] → ["새 게시물 등록"] → ["비밀번호 변경"] → ["게시물 순서 지정"]` — **항상 정확히 1개**. 패널 미개방 시 0개. 닫을 때 포커스가 **"순서 지정" 버튼으로 복귀** |
| D8 | dirty 가시화 | **PASS** | 이동 즉시 `저장되지 않은 순서 변경이 있습니다` 표시 + 닫기 버튼 문구 **`저장하지 않고 닫기`** 전환 + 저장·복원 버튼 활성화. 저장 후 `닫기` 복귀 |
| D9 | `role="status"` 이동 안내 형식 (§16.20-18) | **PASS** | 4회 이동 전건 `노조가 필요한 이유 — {4,3,2,1}번째로 이동했습니다 (총 5건)` — **형식 문자 일치**, 매회 **리전 1곳만** |
| D10 | 순번 배지 | **PASS** | 1,2,3,4,5 **연속**, 이동·저장 후에도 재부여 연속. **32×32px**, `bg-primary-soft`+`text-primary` = `rgb(217,233,255)`/`rgb(9,51,137)`(**9.23 AAA**) |
| D11 | "원래 순서로" | **PASS** | 로드 시점 배열로 **정확히 복원** + `원래 순서로 되돌렸습니다.` 리전 1곳 + dirty 해제 + 저장 비활성 |
| D12 | 분류 선택 UI | **PASS** | 실제 `<input type="radio" name="sort-category">` **3개**(화살표 키·SR 그룹 안내 네이티브 동작). 선택 칩만 `bg-primary`+흰 텍스트(11.37), 칩 높이 44px. 패널 래퍼 `rounded-badge`(12px) + 1px `border-soft`(admin 현행 계승) |
| D13 | 삭제된 게시물 미표시 (§16.15.3) | **PASS** | soft delete 된 409 유발용 글 2건이 패널 목록에 **미노출**(`deletedAt === null` 필터) |

### E. 접근성·반응형 (전건 PASS)

| # | 항목 | 결과 | 근거(실측) |
|---|------|------|-----------|
| E1 | 헤딩 계층 (§15.9.1 계승) | **PASS** | 메인(urgent 0건): `h1`×1(`전국금융산업노동조합코스콤(한국증권전산)지부`) + `h2`×4(`공지사항`·`금융노조 소식`·`노동교육`·`방명록`). **`h2` 에 지부명 0건.** urgent 1건일 때 히어로 게시물 제목 `h2` 가 더해져 5개(§16.11.1 명시 동작). 상세: `h1`×1 + 본문 `h2`(24px/700)·`h3`(20px/600), **`첨부파일` h2 는 첨부 있을 때만**(첨부 0건 상세에서 미렌더 실측) |
| E2 | 히어로 모드 2 단문 1줄 · 360px 클리핑 0 | **PASS** | 모드 2 = `<p>코스콤 조합원을 위한 정보 공유</p>`, Gmarket Sans 700, 40px(모바일)/64px(md+), 자간 -1.92px. **360px `scrollWidth === clientWidth`**(§16.11.1 이 기록한 록업 9.6px 초과 결함이 구조적으로 소멸). 장식 원형·록업 문자열 0건, `shadow-hero` = `rgba(9,51,137,0.35) 0 24px 56px -20px` |
| E2-a | 히어로 모드 1(urgent) 360px | **PASS** | 제목 40px `line-clamp-3`, "긴급" 배지 병행, CTA 필 버튼(높이 ≥44px, `rounded-full`), **클리핑 0 · 가로 스크롤 0** |
| E3 | 터치 44×44 | **PASS** | 360·768·1024px 전부 **44px 미만 `<a>`/`<button>` 0건**. 칩 44 · 입력 필드 56 · 등록 버튼 56 · 첨부 행 87 · 이동 버튼 44×44 |
| E4 | `:focus-visible` 아웃라인 대비 3:1+ | **PASS** | Tab 12스텝 전건 **3px `rgb(9,51,137)`**(11.37) |
| E5 | 키보드만으로 전 플로우 | **PASS** | Tab 순서 = 헤더 록업 → 온누리 카드 → 칩 4개(`#notices`→`#news`→`#education`→`#guestbook`) → 섹션 내부 카드. **썸네일은 포커스 대상 아님**(링크 안 장식). 정렬 패널은 실클릭 + 포커스 이전으로 검증(D2) |
| E6 | 360 / 768 / 1024px 가로 스크롤 0 | **PASS** | `scrollWidth === clientWidth` 전건 + **뷰포트 초과 요소 0건**. 상세 페이지 360·1280px 도 0 |
| E7 | **`PostArticle` 본문 폭 = §16.3.3 검산값 672px** | **PASS** | prose 컨테이너 **672px** + 실제 본문 `<p>` 5개 **전부 672px**(작성형 마크다운 상세로 측정). `max-w-prose`(v4 내장 65ch → 620px) 시정이 실제로 반영됨. 360px 에서는 328px |
| E8 | 섹션 간격 · 액센트 바 폐기 | **PASS** | 모바일 **72/72/72px** · md+ **120/120/120px**. 4px×64 액센트 바 **0건**. 섹션 제목 24px(모바일)/36px(md+) |
| E9 | 헤더 띠 | **PASS** | 상단 `2px` `rgb(9,51,137)` **1줄**, 하단 `0px`, `position: static`(비sticky), 총높이 89px(md+) |
| E10 | 표면 규칙 (§16.5) | **PASS** | 목록 카드 전건 **테두리 `0px/0px/0px/0px` + 그림자 존재 + radius 16px + `overflow: hidden`**. `shadow-card` 와 테두리 유틸을 **동일 요소에 함께 가진 지점 0건**(소스 grep). `border-l-4` 는 admin 초기 비밀번호 배너 1건뿐(리더 판정 1 = 유지, 조합원 화면 0건) |
| E11 | 모션 (§16.20-4·5) | **PASS** | 계산 스타일의 `transition-property` 전수 = `transform·translate·scale·rotate·color·background-color·border-color·outline-color·text-decoration-color·fill·stroke·--tw-gradient-*·box-shadow` — **`width/height/margin/top/left/padding/inset` 0건**. `transition-colors`(Tailwind v4 다중 속성 전개)는 §16.6.1 의 "colors" 범주 |

### F. 회귀 (전수, 전건 PASS)

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| F1 | 공지·소식·노동교육 목록·상세 | **PASS** | 프로덕션 실데이터 6카드 + 로컬 11카드 렌더. 상세 3라우트 200, 복귀 링크 2개, 복귀 경로 `/#notices`·`/#news`·`/#education` 정확 |
| F2 | `/education/[id]` 200 · 교차 접근 404 | **PASS** | `/education/<edu>` 200 · `/notices/<edu>` 404 · `/news/<edu>` 404 · `/news/<news>` 200 · `/education/<news>` 404 · 존재하지 않는 UUID 404 · `/does-not-exist-xyz` 404 |
| F3 | `/?tab=news` 200 + 은폐 0 | **PASS** | 200(리다이렉트 0). 그 응답에 **`h2` 5개 + 게시물 12건 전부 렌더**, `[hidden]` 1건(프레임워크) |
| F4 | 마감 스트립(education 포함, §15.6R-D4) | **PASS** | 공지 2 + **education 1** 3항목 렌더, education 항목 링크 = **`/education/<id>`**(404 회귀 없음). `rounded-card`(16px) + `bg-primary-soft`, **세로 구분선 폐기**, 자체 `overflow-x: auto` 유지 |
| F5 | 방명록 등록·조회 | **PASS** | 로컬 격리 환경에서 실타이핑 등록 → `방명록에 글을 등록했습니다.` + 목록 반영. **항목이 L1 카드**(radius 16px · 그림자 O · 테두리 `0px` · 흰 배경), **`divide-y` 0건**. 입력 필드 56px/16px/1px 보더/그림자 없음, 텍스트영역 160px, 등록 버튼 56px 필 |
| F6 | admin 로그인·로그아웃 | **PASS** | UI 실타이핑 로그인 성공, 헤더 버튼 4개(`새 게시물`·`순서 지정`·`비밀번호 변경`·`로그아웃`). 로그아웃 → 로그인 화면 복귀 + 패널 전부 닫힘. **로그인 레이트리밋도 실동작 확인**(반복 시도 시 `시도 횟수를 초과했습니다`) |
| F7 | admin 게시물 CRUD | **PASS** | UI 등록 → DB 1건 반영(**신규 글 `sort_order = NULL`** = 수동 지정 글 아래) · UI 수정 → **DB 반영 실증**(제목 변경분이 DB·목록·삭제 다이얼로그에 모두 반영) · UI 삭제 → **soft delete**(`deletedAt` 설정) + 공개 목록에서 제거. 삭제 다이얼로그 `role="alertdialog"` + `aria-modal="true"` + **초기 포커스 = "취소"** |
| F8 | 비밀번호 변경 · 초기 비밀번호 배너 | **PASS** | 3필드 패널(48px/12px radius) → 변경 성공 문구 `비밀번호를 변경했습니다. 다른 기기의 로그인 20건이 해제되었습니다.` · **초기 비밀번호 배너 즉시 소멸** · 패널 닫힘 + 포커스 "비밀번호 변경" 버튼 복귀. QA 비밀번호는 원복 완료 |
| F9 | 첨부 업로드·서빙 | **PASS** | `POST /admin/posts/:id/attachments`(field `file`) 201 → `GET /files/...` **200 + `application/pdf`**. 상세 렌더: **`첨부파일` h2 24px/700**, 첨부 행 **L1 카드**(16px + 그림자 + 테두리 0 + 흰 배경) 높이 87px(≥44), **파일명 18px/600**, 아이콘 2개(문서 + `ArrowDownIcon` — 텍스트 화살표 아님), 링크가 API 절대 URL, 한글 파일명 정상(`qa-첨부-테스트.pdf`) |
| F10 | **admin 컨테이너 폭 (§16.14-1 회귀 방지)** | **PASS** | 로그인 전·후 모두 **768px**(`max-w-admin`). PostForm 입력 필드 최대 폭 **686px** — 60rem 확대로 인한 896px 회귀 **없음** |
| F11 | 본문 마크다운 매핑 (§16.12.2) | **PASS** | h2 24px/700 · h3 **20px/600**(`text-lead`) · blockquote **2px `rgb(9,51,137)`** + 색 `rgb(26,26,26)`(ink, 17.40) · hr `rgb(229,231,235)`(장식 구분선 허용 용도) |
| F12 | 콘솔 | **PASS 0건** | 메인·상세·admin 전 페이지에서 error/warning/exception **0건**(하이드레이션 경고 포함 0) |

### G. 빌드·정적 검사 (전건 PASS)

```
npx next typegen   → ✓ Types generated successfully
npx tsc --noEmit   → 오류 0
npm run lint       → 오류 0 · 경고 0
npm run build      → ✓ Compiled successfully / 7 페이지
cd server && npm run typecheck → 오류 0
cd server && npm run build     → 오류 0
```

- **`as any` / `as unknown` / `@ts-ignore` / `@ts-expect-error` / `: any` 신규 0건.** 전체 `src/**` 에 `as unknown` 1건(`lib/api/admin.ts:124`)뿐이고 **`git diff` 에 없다 = 기존 코드**(이번 변경분 0).
- **빌드 CSS 에 §16 신규 클래스 전건 생성 확인**(fixed-string 대조): `rounded-t-panel-lg` · `md:rounded-panel-lg` · `mt-section` · `md:mt-section-lg` · `md:mt-18` · `max-w-admin` · `ease-out-soft` · `shadow-hero` · `text-title` · `md:text-lead` · `md:text-display` · `md:text-h1` · `size-touch` · `md:w-48` · `md:order-2` · `md:rounded-badge` · `aspect-video` · `motion-safe:hover:-translate-y-0.5` · `motion-safe:group-hover:scale-[1.03]` · `peer-checked:bg-primary` · `peer-checked:border-primary` · `peer-focus-visible:outline-3` · `outline-offset-[-3px]` · `max-w-[var(--container-prose)]` · `sr-only` — **`rounded-t-[2rem]` 대체 불필요**(개발자 기록 19.5 확인).
- `globals.css` 에 `--color-*` **17종이 값 변경 없이 존재**하고 `--color-urgent`·`--color-accent`·`--color-primary-bright` 정의 **보존됨**(§16.20-2 PASS).

### §16.20 QA 수용 체크리스트 23항 — 전건 판정

| # | 항목 | 판정 | 비고 |
|---|------|------|------|
| 1 | `shadow-card`+테두리 동시 0건 / `border-l-4` 0건 | **PASS** | 동시 보유 0건. `border-l-4` 1건 = admin 초기 비밀번호 배너(**리더 판정 1 = 유지**, 조합원 화면 0건) |
| 2 | 색 17종 값 불변 + urgent·accent·primary-bright 정의 보존 | **PASS** | — |
| 3 | admin 폭 768px, 입력 필드 안 늘어남 | **PASS** | 768px / 필드 최대 686px |
| 4 | reduced-motion 에서 상승·그림자 전환·확대 없음, 스크롤 즉시 점프 | **PASS** | `1e-05s` / `transform: none` / `scroll-behavior: auto` |
| 5 | transition 대상이 box-shadow·transform·colors 뿐 | **PASS** | 레이아웃 속성 0건(계산 스타일 전수) |
| 6 | 노동교육 5건 썸네일 · 360px 328×184.5 · 768+ 192×108 | **PASS** | **래퍼(레이아웃) 외곽 치수 기준**. 헤어라인 도입으로 img 콘텐츠 박스는 −1/−2px → **권고 1** |
| 7 | CLS 0 (`aspect-video` + `width/height` DOM 확인) | **PASS** | 요청 전면 차단 대조로 검증(3G 스로틀보다 강한 조건) |
| 8 | 혼재 목록 md+ 제목 x 동일 · 플레이스홀더 0 | **PASS** | 216px · 0건. 한 목록 내 혼재도 로컬에서 별도 구성해 확인 |
| 9 | 없는 `thumbnailUrl` → 회색 박스만 | **PASS** | 깨진 아이콘·대체 텍스트 0 |
| 10 | `alt=""` + SR 낭독에 이미지 이름 없음 | **PASS** | AX image 노드 0(썸네일), 카드 이름 = 제목 + 메타 |
| 11 | `<iframe>` 0건 | **PASS** | — |
| 12 | 360px 히어로 클리핑 0 · 가로 스크롤 0 | **PASS** | 모드 1·2 양쪽 |
| 13 | 헤더 파란 띠 상단 1줄(2px), 하단 없음 | **PASS** | — |
| 14 | 액센트 바 0건 · 섹션 간격 72/120px | **PASS** | 실측 |
| 15 | 헤딩 `h1`→`h2`×4 · `h2`에 지부명 없음 · 상세 "첨부파일" h2 조건부 | **PASS** | 첨부 0건 상세에서 미렌더 실측 |
| 16 | 첫/마지막 disabled · 이동 버튼 44×44 | **PASS** | — |
| 17 | 1번째 도달 시 포커스가 같은 게시물 "아래로" 로 이전 | **PASS** | 4회 연속 이동 추적 |
| 18 | `role="status"` 이동 안내 형식·갱신 | **PASS** | 형식 문자 일치 · 리전 1곳 |
| 19 | dirty 문구 + "저장하지 않고 닫기" | **PASS** | — |
| 20 | 409 + 계약 문구 + 재조회 + 로컬 순서 폐기 + 저장 비활성 | **PASS** | 다른 경로로 글 추가해 실유발 |
| 21 | 순번 배지 1부터 연속 + 긴급 안내 문구 | **PASS** | — |
| 22 | 저장 후 공개 순서 일치(urgent 제외) | **PASS** | API 즉시 일치. 메인페이지는 ISR 60초 후 → **권고 4** |
| 23 | §16.18 22조합 수치 일치 + 표 밖 조합 0건 | **PASS** | 22/22 일치 · 실렌더 표 밖 조합 0 · `#4b5563` 은 `#ffffff`·`#f9fafb` 에만 |

### §15.1 은폐 금지 7개 조항 — 전건 PASS

| 조항 | 판정 | 근거 |
|------|------|------|
| 1 조작 없이 스크롤만으로 전 콘텐츠 도달 | PASS | 4섹션 최초 렌더에 전부 표시(A2) |
| 2 `hidden`·`display:none` 콘텐츠 컨테이너 0 · `role="tab(panel)"` 0 | PASS | A1·A1-a·A1-b |
| 3 "기본 선택" 개념 부재 | PASS | 칩 4개 스타일 완전 동일, `aria-current` 0(A5) |
| 4 아코디언·접기·캐러셀·"더보기" 미도입 | PASS | A2 |
| 5 JS 없이 성립 | PASS | A3(방명록 목록만 예외 — 조항이 명시한 허용 범위) |
| 6 히어로·마감 스트립 항목이 섹션 목록에도 남음 | PASS | A6·A7 |
| 7 바로가기 내비가 콘텐츠를 감추지 않음 | PASS | A5 + JS off 에서도 4섹션 렌더 |

### §15.6R-C·D·E 계승 항목 — 전건 PASS

| 항목 | 판정 | 근거 |
|------|------|------|
| §15.6R-C 목록에 설명 줄(`body`) 미추가 | PASS | 카드에 제목·메타 2행만. `PostList` 에 설명 줄 요소 0 |
| §15.6R-D 판정 2 — **2행 메타 구조** | PASS | 1행 `게시일 · 채널명` / 2행 `외부 링크(새 창) · 도메인`. 360px 양 행 각각 1줄 유지 |
| §15.6R-D — **링크형에도 `source`(채널명) 렌더** (fact-verifier 게이트) | PASS | 5카드 전건 1행에 채널명. AX 접근성 이름에도 포함(C4-a) |
| §15.6R-D 판정 4 — 빈 토큰 안전 규칙 | PASS | `source` 없는 kfiu.org 성명 카드에서 `· ·`·행 선두/말미 `·` **0건**. 구분점 `aria-hidden` 유지 |
| §15.6R-E 제목 규약 | PASS | 5건 제목이 `decision-education-content.md` 확정 문자열과 일치(문안 창작 0) |
| §15.6R-F `<iframe>` 금지 | PASS | 0건 |

---

### 권고 4건 (실패 아님 — 리더·디자이너 판단 사항)

| # | 분류 | 위치 | 내용 | 제안 |
|---|------|------|------|------|
| 1 | **문서 정합** | `_workspace/02_designer_spec.md` §16.5 L2 행 · §16.10.3 · §16.18 · §16.20-6 | 리더가 승인한 헤어라인이 **스펙 문면과 충돌**한다: ① §16.5 표 L2 행이 `bg-surface` 면에 **"그림자·테두리 금지"** 로 명시돼 있다(리더 판정 4 의 "요소 단위" 해석은 타당하나 표 문면은 갱신되지 않았다) ② §16.10.3·§16.20-6 의 `192×108`·`328×184.5` 는 이제 **래퍼 외곽 치수**를 뜻한다 — `box-sizing: border-box` + `h-full w-full` 이라 **img 콘텐츠 박스는 md+ 190×106(종횡비 1.792) / 360px 328×183.5(1.787)** 로 16:9(1.778)에서 미세 이탈하고 `object-cover` 크롭이 1px 발생한다(레이아웃·CLS 영향 0) ③ §16.18 은 `#e5e7eb` 사용처를 "hr·admin 행 구분"으로만 열거한다 | 디자이너가 §16.5 L2 행에 "**단, 미디어 박스의 장식 헤어라인은 예외**" 1줄, §16.10 에 "치수는 래퍼 외곽 기준" 1줄, §16.18 `#e5e7eb` 행 사용처에 "썸네일 미디어 경계" 추가. img 를 정확히 16:9 로 유지하고 싶다면 `md:border` → **`md:ring-1 md:ring-border-soft`**(비-inset `ring` 은 패딩 박스 **밖**에 그려져 자식 img 가 덮지 못한다 — 코드 주석의 "inset 은 덮인다"는 판단은 맞지만 outset `ring` 에는 해당하지 않는다) |
| 2 | **백엔드 후속** | `server/src/lib/youtubeThumbnail.ts:153` | 취득 검증이 **상태코드 200 + 2MB 상한 + JPEG 매직 바이트**뿐이고 **치수 검사가 없다.** 오바마 건은 `maxresdefault` 가 **404**(본문은 120×90 플레이스홀더)여서 정상 폴백했음을 실측 확인했으나, 어떤 영상이 **200 으로** 120×90 균일 회색 판을 주면 그대로 캐시돼 16:9 박스에 늘어난다 | 매직 바이트 검증 직후 **JPEG SOF 마커로 치수를 읽어** `maxresdefault` 응답이 `width < 640` 이면 폐기하고 `mqdefault` 로 폴백. (디자이너 제안 항목 — 리더가 후속 과제로 보기로 함) |
| 3 | **빌드 위생** | `src/components/board/PostList.tsx:91` · `src/components/home/HeroPanel.tsx:16` | 빌드 CSS 에 **`.border-urgent{border-color:var(--color-urgent)}` 규칙이 생성**되고 `--color-primary-bright`·`--color-urgent` 가 `:root` 에 남는다. 출처는 **주석 안의 백틱 클래스명**(`` `border-urgent` ``, `--color-primary-bright`)이다 — Tailwind v4 가 주석까지 스캔한다. **적용 요소 0건이라 렌더 영향 0**이고 §16.20-1·23 판정에 영향 없지만, §16.2 "§16 사용처 0" 의도와 어긋나는 죽은 CSS 다 | 주석에서 백틱을 떼거나 `border-l-4 border-urgent` → "urgent 좌측 보더" 처럼 클래스 형태를 피해 표기. (기능 영향 0 — 우선순위 낮음) |
| 4 | **운영 안내** | `src/app/page.tsx:31` (`export const revalidate = 60`) | 순서 저장 후 **공개 메인페이지 반영이 최대 60초 지연**된다. 실측: 저장 직후 API·admin 패널·admin 목록은 **즉시** 새 순서, 메인페이지는 ISR 재생성 후에야 일치(65초 대기 후 재요청으로 일치 확인). **이번 변경이 만든 것이 아니라 §15 부터의 렌더 전략**이지만, 정렬 UI 가 생기면서 처음으로 관리자에게 보이는 지연이 됐다 — §16.15.2 가 막으려는 "정렬이 안 된다"는 오인의 두 번째 원인이 될 수 있다 | §16.15.2 의 긴급 안내 문구 아래에 한 줄 추가 검토: "저장한 순서는 공개 페이지에 최대 1분 뒤 반영됩니다." (문구는 디자이너 확정 사항) |

### 미검증 6건

| # | 항목 | 사유 |
|---|------|------|
| 1 | **정렬 패널 100건 가드** (§16.15.4-1) | 100건 시딩 미수행. **정적 확인만**: `SortPanel.tsx:283 limitReached = posts.length >= LIST_LIMIT(100)` → `role="alert"` 로 `게시물이 100건을 넘어…` + 저장 버튼 `disabled` 경로 존재. 실동작 미검증 |
| 2 | **실제 스크린리더 낭독** | ARIA 구조·라이브 리전 **개수·소유 관계·문구**는 전수 검증했으나 NVDA/VoiceOver 실낭독은 이 환경에서 불가. "이중 낭독 해소"는 **문구를 보유한 리전이 1개**라는 사실로 판정 |
| 3 | **프로덕션 프론트 배포 후 실화면** | 리더가 QA 완료를 기다리지 않고 배포 진행 중. 검증은 **로컬 프로덕션 빌드 + 실 프로덕션 API** 조합으로 수행 — 데이터·API 응답·캐시 헤더는 실물이지만 배포된 프론트 자체는 미확인 |
| 4 | **실기기·타 브라우저** | headless Chrome(격리 프로필) 단일. Safari/iOS·Android Chrome 의 `aspect-ratio`+`object-cover`·Gmarket woff2·`line-clamp` 렌더 차이 미확인 |
| 5 | **프로덕션 API 대상 방명록 브라우저 조회** | 프로덕션 `CORS_ORIGINS` 가 `https://koscomlabor.cloud` 로 제한돼(정상 정책) localhost 프론트에서는 차단된다 — 실측: `Origin: http://localhost:3200` 응답에 `Access-Control-Allow-Origin` 없음, `Origin: https://koscomlabor.cloud` 에는 존재. **방명록 등록·조회·L1 카드는 로컬 격리 환경에서 실증 완료** |
| 6 | **3G 스로틀 실측 CLS** | 네트워크 스로틀 대신 **썸네일 요청 전면 차단**(더 강한 조건)으로 검증. 점진적 로딩 중 중간 프레임의 레이아웃 변화는 미측정(래퍼 치수가 고정이므로 구조적으로 발생 불가) |

### 스크린샷 (리더 육안 확인용)

경로 접두: `/private/tmp/claude-501/-Users-canduk-IdeaProjects-koscomlabor/1fb4ff64-f5db-451f-b787-bd46faa5c9ac/scratchpad/shots/`

| 파일 | 내용 |
|------|------|
| `01-desktop-1280-home.png` | **데스크톱 1280px 메인 전체**(실 프로덕션 API · 총높이 3,594px · 썸네일 5장 로드) |
| `02-tablet-768-home.png` | 768px 메인 전체 |
| `03-mobile-360-home.png` | **360px 메인 전체**(총높이 4,030px — §16.10.5 트리거 5,120px 미달 · 가로 스크롤 0) |
| `04-desktop-1280-detail-education.png` · `05-mobile-360-detail-education.png` | 노동교육 상세(썸네일·복귀 링크 2개·원문 보기 필 버튼) |
| `E-hairline-before-WrzgLtvuPU.png` · `E-hairline-after-WrzgLtvuPU.png` | **헤어라인 전/후 5배 확대 대조**(흰 배경 썸네일 1.00:1 극단 사례 — 디자이너 요청) |
| `C5-mqdefault-md-192x108.png` · `C5-mqdefault-md-3x.png` · `C5-maxres-md-3x.png` · `C5-mqdefault-360.png` · `C5-mqdefault-360-3x.png` | **mqdefault 화질 판단 근거**(md+ 및 360px, 1× / 3× DPR, maxres 비교군) |
| `C-thumb-blocked-1280.png` | 썸네일 요청 차단 렌더(회색 박스만 · 깨진 아이콘 0) |
| `F-local-1280-hero-mode1.png` · `F-local-360-hero-mode1.png` | 히어로 **모드 1**(urgent) + 마감 스트립(education 포함) |
| `F-local-1280-detail-notice.png` | 작성형 상세(본문 마크다운 · prose 672px) |
| `F-local-1280-attachment.png` · `F-local-1280-guestbook.png` | 첨부 블록 L1 카드 · 방명록 L1 카드 |
| `G-sortpanel-dirty-1280.png` · `G-sortpanel-409-1280.png` · `G-sortpanel-saved-1280.png` | 정렬 패널 **dirty / 409 / 저장 성공** 3상태 |
| `H-admin-1280.png` | admin 전체(폭 768px) |

### 비고

1. **`claude-in-chrome` MCP 는 이번에도 localhost 에 도달하지 못한다**(11·12회차 확인 재확인). 격리 프로필 headless Chrome + Node 내장 `WebSocket` 기반 CDP 자체 드라이버가 이 프로젝트의 유효 수단이다.
2. **`next start` 는 이 프로젝트에서 쓰면 안 된다.** `next.config.ts` 가 `output: "standalone"` 이라 `next start` 가 경고를 내고, 검증 도중 **빌드 CSS 청크가 프루닝돼 404/500 이 나면서 스타일 없는 페이지를 측정하는 상황**이 발생했다(측정값 오염 → 재빌드 후 전건 재측정). `node .next/standalone/server.js` + `static`·`public` 수동 복사가 정답이다. 이 함정을 리포트에 남긴다.
3. **로컬 API 호스트는 `localhost` 로 맞춰야 한다.** 세션 쿠키가 `SameSite=Lax` 이므로 프론트를 `localhost:3201`, API 를 `127.0.0.1:3301` 로 두면 **쿠키가 전송되지 않아 admin 로그인이 조용히 실패한다**(둘은 다른 site 다). 12회차처럼 양쪽을 `localhost` 로 통일해야 한다.
4. 정렬 UI 검증 중 **로그인 레이트리밋이 실제로 동작**해 `시도 횟수를 초과했습니다.` 가 떴다(정상 보안 동작). 이후 반복 검증은 Node 측에서 받은 세션 쿠키를 브라우저에 주입해 진행했고, **UI 실타이핑 로그인 자체는 별도로 성공 실증**했다.
5. **프로덕션 쓰기 0건**을 구조적으로 보장했다: 쓰기 계열 스크립트의 `BASE`/`API` 상수를 `localhost` 로 하드코딩하고, 프로덕션 대상 호출은 `curl`/`fetch` 의 **GET·HEAD 뿐**이다. `POST /admin/posts/reorder` 는 프로덕션에 **단 한 번도 호출하지 않았다**.
6. `.next` 는 삭제하지 않았다 — 마지막 빌드가 `NEXT_PUBLIC_API_BASE_URL=https://union-api.koscomlabor.cloud`(프로덕션 값)로 되어 있고, 리더가 배포 중일 수 있어 건드리는 것이 더 위험하다고 판단했다.

---

# QA 리포트: 메인페이지 탭 → 섹션 나열 전환 + 노동교육(education) 분류 (12회차)

- 작성: qa-tester | 작성일: 2026-08-17
- 판정 기준: **02 스펙 §15.1(은폐 금지 7개 조항)** 과 **§15.12(QA 수용 체크리스트 14항)**. 노동교육은 **§15.6R 이 유효 스펙**(§15.6.1~15.6.5 폐기분은 검증 대상에서 제외), **§15.6R-D4**·**§14.4 개정 블록**(리더 추가분) 포함. 부수 기준: `requirements-home-sections.md`, `decision-education-content.md`, `01_verifier_factcheck.md` §10, `06_backend_api_spec.md` §19, `07_backend_impl.md` §10, `03_developer_impl.md` §18(§18.7 포함)
- 검증 대상(git 미커밋, 커밋 `b9795cc`·`a9f7e82` 이후): 신규 5파일(`src/lib/homeSections.ts`·`src/lib/postCategories.ts`·`src/components/home/HomeSection.tsx`·`src/components/home/SectionNav.tsx`·`src/app/education/[id]/page.tsx`) + `ArrowDownIcon` + 수정 13 + 삭제 1(`BoardTabs.tsx`)
- **환경 격리**: 전용 QA DB **`qa_sections`** 신규 생성 + 스크래치패드 전용 env(`PORT=3101`, `DATABASE_URL`=qa_sections, `COOKIE_SECURE=false`, `CORS_ORIGINS`=localhost:3100, QA 전용 `ADMIN_PASSWORD_HASH`/`ADMIN_API_TOKEN`/`IP_HASH_SECRET`, `UPLOAD_DIR`=스크래치패드). **`server/.env` 무수정(md5 `bb9eab…`, mtime 09:32 KST = 세션 시작 전), 개발 DB `guestbook` 무접촉(양 테이블 0행 유지), 프로덕션(101.79.31.30) 쓰기 0건 — 읽기 2건만**
- 검증 방법: ① 분류 리터럴 **전수 grep + 건별 판정** ② 계약 §19 ↔ 서버 실응답 ↔ 프론트 파서 **필드 단위 대조** ③ **로컬 풀스택 실왕복**(API 3101 + `next start` 3100 + Postgres `qa_sections`) ④ **실브라우저 실조작 195 어서션**(격리 프로필 headless Chrome + Node 내장 WebSocket CDP 자체 드라이버 — `claude-in-chrome` MCP 는 localhost 도달 불가, 아래 비고 1) ⑤ 프리렌더 HTML 문자열 전수 감사 ⑥ 대비 스크립트 재현 11조합 ⑦ DB 값 직접 확인(psql) ⑧ 빌드 6종 ⑨ 360/340/320/300/280/260px 반응형 실측 ⑩ 스크린샷 4장
- 정리: `qa_sections` **drop 완료**, API·next·Chrome 프로세스 **전건 종료(잔여 0, 포트 3100/3101 해제)**, Chrome 임시 프로필 삭제, QA API URL 이 인라인된 `.next` 삭제, **프로덕션 코드 수정 0건**(`git status` 세션 시작 시점과 동일)

## 12회차 요약: 통과 251 | **실패 0** | 권고 3(전건 기존 결함·문서 정합) | 미검증 6

> **이번 QA 의 존재 이유에 대한 답**: `admin` 화면에서 **실제로 타이핑해 노동교육 링크형 게시물을 등록**했고, 그 게시물이 **메인페이지 노동교육 섹션에 실제로 렌더되는 것을 실브라우저·스크린샷으로 확인**했다(§15.12-12). 채널명(`source`)도 5장 전부 카드 1행에 보인다. **은폐 재발 0.**

### A. 은폐 회귀 검증 (§15.1 / §15.12) — 전건 PASS

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| A1 | 프리렌더 HTML `hidden` 문자열 전수 감사 | **PASS** | `hidden` 72회 출현을 **전건 문맥 확인**: 맨 `hidden` 속성은 **정확히 1건**(`<div hidden=""><!--$--><!--/$--></div>`), 나머지는 `aria-hidden="true"`(장식 아이콘·액센트 바·구분점)·`overflow-hidden`·`hidden md:flex`(DateBadge)·`md:hidden`(모바일 D-n) 유틸리티 |
| A1-a | **개발자 주장 검증** — 그 1건이 Next 셸의 빈 서스펜스 경계인가 | **PASS(주장 사실)** | 내부 raw 문자열 `'<!--$--><!--/$-->'` → **텍스트 길이 0 · 자식 요소 0**. `/does-not-exist-xyz`(404 페이지)에도 **동일하게 1건** 존재 → 우리 코드 아님. DOM 검사에서도 `[hidden]` 요소의 `textContent.length === 0` |
| A1-b | `role="tab"` / `role="tabpanel"` / `role="tablist"` / `aria-selected` | **PASS 전부 0건** | 프리렌더 HTML 문자열 0/0/0/0 + 라이브 DOM 0/0/0/0. 메인·`/education/<id>` 상세·0건 상태·미연결 상태 **4개 렌더 상태 전부** |
| A1-c | `display:none`·`visibility:hidden` 으로 감춰진 UI 텍스트 | **PASS** | md+ 에서 1건(`md:hidden` 모바일 D-n) — **같은 정보를 `DateBadge`(`hidden md:flex`)가 표시**함을 실측(`8/25 D-8`). 360px 에서 1건(`DateBadge`) — **D-n 이 텍스트로 표시**됨을 실측. 양방향 정보 손실 0 |
| A2 | 4개 섹션이 최초 렌더에 모두 보인다 | **PASS** | 4섹션 전부 `display:block` · `offsetParent≠null` · 높이 272/294/568/583px. 게시물 제목 9건 전부 실렌더 박스 보유(`invisible=[]`) |
| A2-a | **특정 섹션이 0건이어도 나머지가 가려지지 않는다** | **PASS** | 전 게시물 soft delete → 3분류 `ok+0건` 상태에서 섹션·h2·액센트 바·칩 4개 전부 정상 렌더, `hidden` 콘텐츠 0 |
| A3 | 섹션 바로가기 칩에 활성/선택 하이라이트 없음 (§15.4) | **PASS** | 칩 4개 계산 스타일 **완전 동일**(`#ffffff` / `#093389` / border `#6b7280` / 600 / 18px) — 스크롤 전·후 동일, `aria-current` 0건, `nav` `position: static`(비sticky), `href` = `#notices,#news,#education,#guestbook` 순수 프래그먼트, `SectionNav.tsx` 에 `"use client"` 없음 |
| A4 | 히어로 urgent 공지가 공지 목록에도 남는다 (§15.1-6) | **PASS** | 히어로 CTA `href=/notices/1a8872ed…` 가 **공지 섹션 목록·마감 스트립·히어로 3곳**에 동시 존재(스크린샷 확인) |
| A5 | 탭 인프라 잔존 0 | **PASS** | `grep -rn 'BoardTabs\|TAB_IDS\|TabId\|isTabId\|TAB_QUERY_PARAM\|homeTab\|role="tab\|aria-selected\|tabpanel\|tablist' src/ server/src/` → **주석 내 이력 언급 2건만**(`page.tsx:26`, `routes.ts:8`), 실행 코드 0건. `BoardTabs.tsx` 파일 삭제 확인 |
| A5-a | `/?tab=news` 하위호환 | **PASS** | `200 · num_redirects=0` (리다이렉트 미작성 = §15.9.2 판정대로). 그 응답에 **4섹션 제목 + 소식 게시물 + 노동교육 게시물 전부 렌더**, `hidden` 속성 1건(프레임워크) |
| A6 | JS 비활성 렌더 (§15.12-3) | **PASS** | `Emulation.setScriptExecutionDisabled` 로 스크립트 차단 후 4섹션 제목 + 공지·소식·노동교육 전 게시물 제목 렌더 확인(누락 0) |

### B. 경계면 3자 교차 대조 (정적) — 전건 PASS

**`"notice"`/`"news"` 리터럴 전수 조사 + 건별 판정** (`grep -rn '"notice"' src/` 외 `'notice'`·`"news"`·`"education"`·`category ===`·`kind ===`·`switch`·`? ROUTES.` 6패턴 추가)

| 위치 | 리터럴 | 판정 |
|------|--------|------|
| `src/lib/api/posts.ts:23` | `POST_CATEGORIES = ["notice","news","education"]` | **단일 출처** — 서버 `postValidate.ts:14` 와 **값·순서 문자 단위 동일** |
| `src/lib/api/posts.ts:97-106` | 런타임 파서 가드 `!isPostCategory(category)` | **PASS — education 허용 확인.** `POST_CATEGORIES` 파생이므로 좁힘 불가. **실왕복으로 실증**: education 5건이 목록에 렌더됨(가드 누락이면 API 200 + 목록 0건) |
| `src/lib/postCategories.ts:22-25` | `POST_CATEGORY_ORDER` | 단일 출처(라벨·순서). `satisfies readonly PostCategory[]` |
| `src/app/page.tsx:57-59, 84-87` | `loadCategory("notice"/"news"/"education")` + `kind` 3회 | **의도적** — 섹션별 데이터 소스가 다르다. 누락은 `Record<HomeSectionId, ReactNode>` 가 컴파일 타임 차단 |
| `src/app/{notices,news,education}/[id]/page.tsx` ×2씩 | `category !== "<자기 분류>"` | **의도적** — 교차 접근 404. **실측 6조합 전부 404** |
| `src/components/admin/PostForm.tsx:89` | `useState<PostCategory>(… ?? "notice")` | 기본 선택값 — 분류를 좁히지 않는다 |
| `src/components/admin/PostForm.tsx:113` | `category === "news" && type === "article"` | **의도적 비대칭**(06 §19.2). **실측**: 소식+작성형 출처 없음 → `400 VALIDATION_ERROR "금융노조 소식(작성형)은 출처(source)가 필수입니다."` / 노동교육+링크형 출처 없음 → 통과 |
| `src/lib/homeSections.ts:15-18` | `POST_CATEGORY_LABELS.*` 참조 | 라벨 중복 0 — 칩 라벨 == 섹션 h2 라벨 **실측 일치**(`공지사항\|금융노조 소식\|노동교육\|방명록`) |
| `"notice" \| "news"` 리터럴 유니온 잔존 | — | **0건**(`src/` `server/src/` 양쪽) |
| 분류 삼항 분기 | — | **0건**. 매핑 강제 4곳: `EMPTY_MESSAGES`·`POST_CATEGORY_LABELS`·`POST_DETAIL_PATHS`·`sectionContent` 전부 `Record<…>` |

**개발자가 리더 목록 밖에서 찾아 고쳤다고 보고한 2건 — 실제 수정 확인**

| 보고 | 검증 결과 |
|------|-----------|
| `DeadlineStrip.tsx:28` 삼항 → 404 위험 | **PASS.** 현재 `const href = ROUTES.post(post.category, post.id)`(L29). **실왕복 실증**: 마감일 `2026-08-19` 인 education 게시물이 스트립에 `D-2 8/19 …` 로 뜨고 링크가 `/education/<uuid>` → **실제 200**(`/notices/<uuid>` 였다면 404) |
| `AdminApp.tsx:359` education 이 "금융노조 소식"으로 오표기 | **PASS.** 현재 `POST_CATEGORY_LABELS[post.category]`(L360). admin 목록에서 education 행이 **`링크형 노동교육 2026.08.17`** 로 표기됨을 실브라우저 확인 |
| 유사 누락 추가 탐색 | **추가 0건.** 위 6패턴 전수 sweep 결과 남은 리터럴 전부 의도적 |

**계약(06 §19) ↔ 서버 실응답 ↔ 프론트 타입 필드 단위 대조** — `GET /posts?category=education` 실응답

| 필드 | 계약 §11.1/§19.1 | 서버 실응답 | 프론트 `ApiPostSummary` | 파서 검사 |
|---|---|---|---|---|
| `id` | string | `"371706f0-…"` str | `string` | `typeof === "string"` |
| `category` | 3값 | `"education"` str | `PostCategory` | `isPostCategory()` ✔ |
| `type` | `link\|article` | `"link"` str | `PostType` | 2분기 |
| `title` | string | str | `string` | `typeof` |
| `url` | `string\|null` | str | `string \| null` | `readNullableString` |
| `source` | `string\|null` | `"채널"` str | `string \| null` | `readNullableString` |
| `urgent` | boolean | `false` bool | `boolean` | `typeof` |
| `deadline` | `string\|null` | `null` | `string \| null` | `readNullableString` |
| `publishedAt` | ISO string | `"2026-08-17T09:12:55.160Z"` | `string` | `typeof` |
| `attachments` | array | `[]` list | `ApiAttachment[]` | `Array.isArray` + 항목 파싱 |
| **차집합** | — | **서버에만 0 / 프론트에만 0** | — | — |

- 응답 shape **변경 없음** 계약 준수 확인(§19.1 마지막 행). `X-Total-Count: 1` + `access-control-expose-headers` 정상.
- 에러 문구 §19.1 **문자 단위 일치 5경로**: `GET /posts?category=bogus`·`category` 생략 → `"category 는 notice, news, education 중 하나여야 합니다 (필수)."` / `GET /admin/posts?category=bogus`·`POST category=bogus`·`POST category=EDUCATION`(대문자) → `"category 는 notice, news, education 중 하나여야 합니다."`
- **프로덕션 API 읽기 확인(쓰기 0)**: `https://union-api.koscomlabor.cloud/posts?category=education` → **200 `[]`**, `?category=notice` → 200, `?category=bogus` → **400 + 3값 문구**. 백엔드 배포 반영 확인.
- 마이그레이션 `1755300000004` 로컬 적용 후 제약 실측: `posts_category_check | CHECK ((category = ANY (ARRAY['notice','news','education'])))`, `posts_news_article_needs_source` 는 `category='news'` 한정 유지(§19.2 비대칭).
- **타입 우회 신규 0건**: 변경분에 `as any`/`as unknown`/`@ts-ignore`/`@ts-expect-error`/`: any` **0건**(`admin.ts:113` 의 `as unknown` 은 기존 코드, 이번 diff 밖).

### C. 실동작 검증 (로컬 풀스택 + 실브라우저)

**C1. 핵심 왕복 (§15.12-12) — PASS**

admin 로그인 → `새 게시물` → 유형 `링크형` → 분류 `노동교육` → URL/제목/출처를 **CDP 키 이벤트로 실타이핑** → 저장 → 메인 확인.

| 단계 | 실측 |
|------|------|
| 폼 입력값 | `{url:"https://www.youtube.com/watch?v=ATbGKR-Agmk", title:"노동조합이란", source:"금융노조 교육문화본부", cat:"education", type:"link"}` |
| admin 목록 | `노동조합이란` 행 추가 + 메타 `링크형 노동교육 2026.08.17` |
| DB | `psql`: `education \| link \| 노동조합이란 \| 금융노조 교육문화본부` |
| **메인 노동교육 섹션** | **카드 렌더 확인** — 제목 + ↗ + 1행 `2026.08.17 · 금융노조 교육문화본부` + 2행 `외부 링크(새 창) · www.youtube.com`, `visible=true`, `target=_blank rel="noopener noreferrer"`, `iframe 0` |

**C2. 링크형 출처(`source`) 편집 (§14.4 개정) — PASS 13/13**

| 항목 | 실측 |
|------|------|
| 링크형 폼에 출처 칸 노출 | **PASS** — 링크형: URL O · 본문 X · **출처 O**(라벨 `출처`, 필수 표기 없음, `maxLength=200`, 높이 48px) |
| 링크형 힌트 문구 | **PASS 문자 단위 일치** — `채널명·발행처를 적습니다. 목록 카드에 표시되어 조합원이 자료의 출처를 구분할 수 있습니다.` / 클래스 `mt-1 text-caption text-ink-muted`(=`ADMIN_HINT_CLASS`) / `#4b5563` 15px |
| **작성형 폼에는 힌트 없음** | **PASS** — 기본(작성형) 상태에서 출처 칸 O · 힌트 `null` |
| 값 입력·저장 → 카드 1행 채널명 | **PASS**(위 C1) |
| **재수정 → 반영** | **PASS** — `금융노조 교육문화본부(수정)` 저장 → DB 반영 → 카드 1행 `2026.08.17 · 금융노조 교육문화본부(수정)` |
| **출처 비우고 저장 → 실제 삭제** | **PASS(조용한 실패 없음)** — 폼 비움 → 저장 → **`psql` 실측 `source` = NULL**. 카드 1행이 `2026.08.17` 단독(구분점 0), **2행은 유지**(정보 손실 0) |
| 다시 확정값 복원 | **PASS** — `금융노조 교육문화본부` 재입력 → DB·카드 반영 |
| 소식+작성형 출처 필수(400) 유지 | **PASS** — `400 VALIDATION_ERROR` 확인(문구 위 B) |

**C3. 메타 블록 2행 (§15.6R-D) — PASS**

| 항목 | 실측 |
|------|------|
| 링크형 1행 / 2행 구조 | **PASS** — 1행 `[게시일, 출처]`, 2행 `[외부 링크(새 창), 도메인]`. 5건 전부 |
| **작성형 카드 시각 회귀 0** | **PASS** — 작성형은 2행 미렌더(행 1개). 구분점 좌우 여백 **13개 구분점 전건 4px/4px**(개발자 주장 실화면 확인). 래퍼 `display: inline-flex → flex`(부모가 flex 컨테이너라 blockify — 정상), **`flex-wrap: nowrap`** 이므로 구분점+뒤 토큰이 분리 불가. 메타 색 `#4b5563` 15px 전건 동일 |
| **빈 토큰 안전(전 조합)** | **PASS** — 9카드 × 전 행에서 `· ·` / 행 선두 `·` / 행 말미 `·` **0건**. 검증한 조합: 출처有/無 × 도메인有/無 × 첨부0 × 마감有/無 × urgent有/無 × 링크형/작성형. 대표값: urgent+마감+출처 → `D-8 2026.08.17 · 지부 사무국` / 작성형+출처無 → `2026.08.17` / 링크형+출처無(kfiu) → `2026.08.17` + `외부 링크(새 창) · www.kfiu.org` |
| D-n 구분점 미부착 | **PASS** — `md:hidden` D-n 이 행 선두에 구분점 없이 옴 → md+ 에서 숨겨져도 행이 `·` 로 시작하지 않음 |
| 360px 두 행 각각 1줄 | **PASS** — 5카드 × 2행 = 10행 전부 높이 **22.5px = line-height 22.5px(1줄)** |
| **260~360px 구분점 매달림 0 · 가로 스크롤 0** | **PASS** — 360/340/320/300/280/260px 6구간 전부 dangling 0, `scrollWidth == clientWidth` |
| `·` `aria-hidden` | **PASS** — 전 구분점 `aria-hidden="true"`, 스크린리더에는 토큰 텍스트만 |
| `영상` 토큰·`isVideo` 미도입 | **PASS** — 코드·렌더 양쪽 0건(§15.6R-D 판정 1) |

**C4. 라우팅 — PASS**

| 케이스 | 실측 |
|--------|------|
| `/education/<eduId>` | **200** · `backHref="/#education"` · `<title>노동조합이란 — 전국금융산업노동조합 코스콤(한국증권전산)지부</title>` · h1 = 게시물 제목(`asHeading={false}`) |
| 교차 분류 6조합 | `/notices/<eduId>` **404** · `/news/<eduId>` **404** · `/education/<noticeId>` **404** · `/education/<newsId>` **404** · `/notices/<newsId>` **404** · `/news/<noticeId>` **404** |
| 미존재 id | `/education/00000000-…` **404** |
| `notices`/`news` backHref | `href="/#notices"` · `href="/#news"` 확인 |
| 돌아가기 실클릭 | `/#education` 이동 후 **액센트 바 상단 여백 32px**(§15.12-6) |
| **§15.6R-D4 마감 스트립 + education** | 마감 education 이 스트립에 `D-2 8/19 조합원 노동법 기초과정 수강 신청` 으로 표시, `href=/education/<uuid>` **실제 200**, **동시에 노동교육 섹션 목록에도 잔존**(§15.1-6), 작성형이라 카드 링크도 `/education/<uuid>`, md+ DateBadge `8/19 D-2` 표시 |

**C5. 회귀 — PASS**

| 항목 | 실측 |
|------|------|
| 공지·소식 목록 | 공지 2건(urgent+마감·일반) / 소식 2건(작성형+출처·링크형 출처無) 정상 렌더·링크 경로 정상 |
| 상세 페이지 | `/notices/<id>` `/news/<id>` `/education/<id>` 전부 200, `role=tab` 0 |
| 빈 상태 3분류(`ok+0건`) | `등록된 공지사항이 없습니다` / `등록된 소식이 없습니다` / **`등록된 교육 자료가 없습니다`** + 공통 보조 `새 글이 등록되면 이곳에 표시됩니다` |
| 빈 상태(`unconfigured`) | 3분류 동일 `게시판을 준비 중입니다 / 서비스가 연결되면 게시물이 표시됩니다`(§15.6R-B) |
| 방명록 등록·조회 | 폼 실타이핑 등록 → **DB 행 0→1** → 목록에 `12회차 QA 방명록 회귀 테스트` + `QA검증 · 2026.08.17` 표시 |
| 방명록 미연결 | 폼 미렌더 + 준비 중 카드(§7.1 유지) |
| admin 로그인/세션/로그아웃 | 로그인 200 → 재방문 세션 유지 → 로그아웃 후 로그인 화면 복귀 |
| admin 삭제 다이얼로그 | `role="alertdialog"` `aria-modal="true"` `aria-labelledby=delete-dialog-title` `aria-describedby=delete-dialog-body`, **초기 포커스 = 취소**, 삭제 실행 → `deleted_at` 기록(soft delete) |
| **비밀번호 변경(11회차 산출물)** | 3필드(`current-password`/`new-password`×2) → 변경 성공 `비밀번호를 변경했습니다. 다른 기기의 로그인 3건이 해제되었습니다.` → **구 비밀번호 로그인 거부**(`비밀번호가 일치하지 않습니다.`) → **신 비밀번호 로그인 성공** → 초기 비밀번호 경고 배너 소멸 |
| 콘솔 에러 | 메인·admin·상세 전 경로 **JS 에러·예외 0건** |

### D. 접근성 — PASS

| 항목 | 실측 |
|------|------|
| 헤딩 계층 | **`h1` 지부명 → `h2`×4(공지사항·금융노조 소식·노동교육·방명록)** 실측. urgent 有 상태에서는 히어로 모드 1 `h2`(실제 콘텐츠 제목)가 앞에 온다 — §15.9.1 규정대로. **h2 에 지부명 0건** |
| 히어로 모드 2 `<p>` | **PASS** — urgent 해제 후 록업 요소 `P`, 히어로 내 `h2` **0개**. **시각 변화 0 실측**: md+ `66.2px/56px` · `700` · `-1.324px/-1.12px`(=-0.02em) · `#ffffff` · line-height `76.13px/64.4px`(=1.15) · `Gmarket Sans` |
| 방명록 준비 중 `<h3>` | **PASS** — 클래스 `mt-4 text-h2 text-ink` 동일. **동일 클래스 `h2` 프로브를 DOM 에 주입해 픽셀 비교**: 24px/600/-0.24px/`#1a1a1a`/31.2px/mt 16px/높이 31px **전 항목 동일 = 시각 변화 0** |
| 헤딩 아웃라인(미연결) | `h1 지부명 → h2×4 → h3 방명록 준비 중입니다`(§15.12-4 완전 충족) |
| 앵커 이동 여백 | 4앵커 실클릭 — `#notices/#news/#education` **액센트 바 상단 32px**(md+ `scroll-mt-8`), 제목 잘림 0. `#guestbook` 은 문서 끝 스크롤 클램프로 80px(요구값 이상). 360px 에서 `scroll-margin-top: 24px` 확인 |
| 칩 터치 대상 | md+ 118/154/118/103 × **44px** · 360px 110/146/110/95 × **44px** — 전건 ≥44 |
| 칩 hover | `bg #eff6ff` + `border #093389` + **밑줄** 실측(§15.4 표와 일치) |
| 칩 focus-visible | **`outline: 3px solid rgb(9,51,137)`** 실측 |
| **키보드 Tab 순서** | 실측 `헤더 지부명 → 히어로 CTA(자세히 보기) → 마감 스트립 → 온누리 카드 → 칩 4개(#notices→#news→#education→#guestbook) → 섹션 ①…④ 내부 카드` — §15.12-9 순서와 일치 |
| 카드·링크 포커스 링 | 목록 카드·상세 링크·방명록 필드·admin 버튼 전부 `3px rgb(9,51,137)`. 히어로 CTA 만 흰색 링(딥블루 면 위 — 기존 §11.4 구현, 권고 3 참조) |
| 순수 `<a>` 여부 | `SectionNav.tsx` 에 `"use client"` 없음 + `next/link` 미사용 + `data-prefetch` 0 → JS 0 확인 |
| `·` 스크린리더 | 전 구분점 `aria-hidden="true"` |
| 섹션 이름 | 4섹션 `aria-labelledby="<id>-heading"` ↔ `h2 id` 실측 일치(표기 드리프트 원천 차단) |
| 랜드마크 | `banner → main → region(주요 소식) → navigation(마감 예정 일정) → navigation(페이지 섹션 바로가기) → region×4 → contentinfo` |
| 360px 반응형 | 가로 스크롤 0, **칩 2행 래핑**(1행 공지사항+금융노조 소식 / 2행 노동교육+방명록, nav 높이 96px), h2 24px, admin 분류 선택지 3개 컨테이너 `inline-flex flex-wrap gap-1 rounded-full bg-surface p-1` |
| **대비 재현 검증(§15.10)** | `check-contrast.mjs` 11조합 **전건 스펙 값과 일치**: 17.40 / 7.56 / 11.37 / 10.45 / 4.83 / 4.44 / 3.93 / 6.94 / 1.24 / 10.88 / 16.65. 실화면 계산색도 일치(칩 `#093389` on `#ffffff`, hover `#eff6ff`, border `#6b7280`, 메타 `#4b5563` on `#ffffff`, 액센트 바 `#093389`, h2 `#1a1a1a`) |
| 신규 색·토큰 | **0건** — 신규 파일 색 클래스가 전부 기존 토큰(`bg-bg`·`bg-primary`·`border-border-strong`·`hover:bg-primary-tint`·`hover:border-primary`·`text-primary`·`text-ink`·`text-body`·`text-h1`·`text-h2`·`outline-primary`), 하드코딩 hex **0건**(주석 1건 제외), `globals.css` **diff 0** |
| `CHIP_CLASS` | 스펙 §15.4 문자열과 **문자 단위 일치**(스크립트 대조) |
| §15.2 간격 실측 | md+ 내비 `mt-12`=48px · 섹션① 40px · 섹션 간 80px · 바→제목 12px · 제목→콘텐츠 20px · 푸터 64px · 컨테이너 768px/패딩 24px / 360px 48-32-64-12-20-64px, 패딩 16px — **전건 스펙 표와 일치** |

### E. 2차 검증 게이트 (콘텐츠) — PASS

로컬에 확정 5건을 **표시순 역순으로 등록**(5→4→3→2→1, #1 은 admin UI 실타이핑)해 실화면 대조.

| 표시순 | 카드 제목(실측) | 1행 채널명(실측) | 2행(실측) | href(실측) |
|---|---|---|---|---|
| 1 | `노동조합이란` | `금융노조 교육문화본부` | `외부 링크(새 창) · www.youtube.com` | `…/watch?v=ATbGKR-Agmk` |
| 2 | `산별노동조합이란` | `금융노조 교육문화본부` | 동일 | `…/watch?v=-WrzgLtvuPU` |
| 3 | `산별중앙교섭과 쟁의절차` | `금융노조` | 동일 | `…/watch?v=jeK7W_SADUs` |
| 4 | `오바마 대통령이 말하는 노조` | `하종강의 노동과 꿈` | 동일 | `…/watch?v=Vj3lQ7Y71PU` |
| 5 | `노조가 필요한 이유` | `마이크임팩트` | 동일 | `…/watch?v=OFfbgB5dOIA` |

- **제목 5건 `decision-education-content.md` 표와 문자 단위 일치.** 사용자 축약 라벨(`오바마`·`진중권`) **0건**.
- **`source`(채널명) 5건 전부 카드 1행에 표시** — fact-verifier 게이트 조건 이행 확인. `하종강의 노동과 꿈`·`마이크임팩트` 화면 노출 스크린샷 확보(`edu-360.png`).
- **금지 사항 위반 0**: 섹션 innerText 전문에 `교수` 0건 · 강연 연도(`201x/202x년`) 0건 · `금속노조` 오기 0건 · 창작 설명 문구 0건. **설명 줄(`body`) 미노출** 구조 확인(카드 행 = 제목 + 메타 2행뿐, §15.6R-C).
- URL 5건 전부 `https://www.youtube.com/watch?v=` 정규형, **`?si=` 0건**, videoId 11자 정확(#2 선두 하이픈 `-WrzgLtvuPU` 포함). **도메인 표기 5건 전부 `www.youtube.com` 동일**.
- `<iframe>` 임베드 **0건**(§15.6R-F). `target="_blank" rel="noopener noreferrer"` 5건.
- **링크 생존 확인**: 5건 전부 `200`(리다이렉트 추적).
- **표시 순서**: 역순 등록으로 학습 순서(개념→산별→중앙교섭→외부 2건)가 화면에 정확히 재현됨을 실측. 정렬은 `publishedAt DESC` 이므로 §15.6R-D3 의 한계(새 글 추가 시 순서 붕괴)는 구조적으로 유효 — 운영 안내 필요(리더 담당).

### F. 빌드·정적 검사 — 전건 PASS

| 명령 | 결과 |
|------|------|
| `npx next typegen` | 통과 |
| `npx tsc --noEmit` | **exit 0, 출력 0** |
| `npm run lint` | **exit 0, 출력 0** |
| `npm run build` (API 설정) | 통과 — `/` `○ Static · Revalidate 1m`, `/education/[id]` `ƒ Dynamic` 신규, `/admin` `○` |
| `npm run build` (API 미설정) | 통과 — 미연결 상태 프리렌더 정상 |
| `cd server && npm run typecheck` | **exit 0** |
| `cd server && npm run build` | **exit 0** |
| 신규 `any`/`as`/`@ts-ignore` | **0건** |

### 권고 3건 (전건 **이번 변경이 만든 것이 아님** — 기존 결함 또는 문서 정합)

| # | 분류 | 위치 | 내용 | 권고 |
|---|------|------|------|------|
| 1 | 기존 결함(UX) | `src/components/admin/PostForm.tsx:226-228` + `src/components/admin/AdminApp.tsx:320-323` | `setFeedback({kind:"success", message:"게시물을 저장했습니다."})` **직후 `onSaved()` 가 `setEditing(null)`** 로 폼을 언마운트해 **성공 문구가 화면에 남지 않는다.** 스펙 §14.4 "저장 결과 … `role="status"` 상시 렌더" 미충족. **`git show HEAD:` 대조 결과 코드가 HEAD 와 동일 = 기존 결함**(사용자는 목록 갱신으로 간접 확인 중) | `AdminApp` 의 `notice` 상태(`role="status"` 상시 렌더 존재)에 `"게시물을 저장했습니다."` 를 세팅하도록 `onSaved` 시그니처를 넓히는 것이 최소 수정. **이번 회차 범위 밖 — 리더 판단 요청** |
| 2 | 문서 정합 | `_workspace/01_verifier_factcheck.md` §10 기준값 표 | §10 표가 **최신 확정판과 어긋난다**: ① URL 형식 `https://youtu.be/…` (확정은 `www.youtube.com/watch?v=`) ② #1·#2 채널 `금융노조` (확정은 `금융노조 교육문화본부`) ③ 항목 번호 순서 상이(§10 #3=오바마 / decision #4=오바마). 구현은 상위 확정 문서(`decision-education-content.md`)를 정확히 따르므로 **결함 아님**이나, 5차 최종 게이트에서 §10 표를 그대로 대조하면 **오탐 3건**이 난다 | 리더가 §10 을 갱신하거나, `05_verifier_final.md` 작성 시 **기준은 `decision-education-content.md`** 임을 명시할 것 |
| 3 | 스펙 문구 | `02_designer_spec.md` §15.12-9 | "모든 포커스 링이 3px `#093389`"라 했으나 **히어로 CTA 는 흰색 링**(`3px #ffffff`)이다. 딥블루 면 위이므로 흰 링이 대비상 옳고, `HeroPanel` 은 §15.11 "변경 금지" 대상 | 체크리스트 문구에 "(히어로 CTA 는 딥블루 면 위이므로 흰 링)" 예외를 명기하면 이후 회차의 오판을 막는다 |

### §15.12 QA 수용 체크리스트 대조 (14항)

| # | 항목 | 판정 |
|---|------|------|
| 1 | `role="tab"`·`role="tabpanel"`·`hidden` 0건 | **PASS**(맨 `hidden` 1건은 Next 셸 빈 서스펜스 경계 — 콘텐츠 0, 404 페이지에도 동일) |
| 2 | `?tab=news` 없이 홈에서 소식 게시물 제목이 보인다 | **PASS** |
| 3 | JS 끈 상태에서 4섹션 + 전 게시물 제목 렌더 | **PASS** |
| 4 | 헤딩 아웃라인 `h1 → h2×4`, h2 에 지부명 없음, 준비 중 `h3` | **PASS** |
| 5 | 4앵커 이동 시 24/32px 여백 | **PASS** |
| 6 | 상세 "← 목록으로 돌아가기" → 해당 섹션 위치 | **PASS** |
| 7 | 칩 4개 외형이 스크롤 위치와 무관하게 동일 | **PASS** |
| 8 | 360px 가로 스크롤 0 · 칩 2행 · 터치 ≥44px | **PASS** |
| 9 | Tab 순서 + 포커스 링 3px `#093389` | **PASS**(히어로 CTA 흰 링 — 권고 3) |
| 10 | 문자열이 `decision-education-content.md` 와 문자 단위 일치 · 창작 0 · iframe 0 | **PASS** |
| 11 | 채널명 5장 전부 표시 · 메타 2행 · 도메인 동일 · `?si=` 없음 | **PASS** |
| 12 | **education 1건 등록 후 메인에서 실제로 보인다** | **PASS**(admin UI 실타이핑 왕복) |
| 13 | `source` 없는 링크형에서 `· ·`·선두·말미 `·` 없음 · 작성형 픽셀 동일 | **PASS**(구분점 여백 4/4px 실측) |
| 14 | 360px 메타 2행 각각 1줄 · 가로 스크롤 0 | **PASS**(260px 까지 확장 검증) |

### §15.1 은폐 금지 7개 조항 대조

1 조작 없이 전부 보인다 **PASS** / 2 `hidden`·`display:none` 콘텐츠 컨테이너 0 **PASS** / 3 "기본 선택" 개념 부재 **PASS**(`aria-current` 0·칩 동일 외형) / 4 아코디언·접기·캐러셀·더보기 0 **PASS**(전 게시물 노출, 제한 코드 0) / 5 JS 없이 성립 **PASS** / 6 히어로·스트립 게시물이 목록에 잔존 **PASS**(urgent 공지·마감 education 양쪽 실증) / 7 바로가기 내비가 콘텐츠를 감추지 않는다 **PASS**(0건 상태에서도 칩·섹션 정상)

### 미검증 6건

| # | 항목 | 사유 |
|---|------|------|
| 1 | 사용자 실제 Chrome 프로필·확장 환경에서의 동작 | `claude-in-chrome` MCP 가 localhost(`127.0.0.1:3100`)에 도달하지 못한다(외부 사이트는 정상 — 확장 사이트 권한 문제로 추정, 11회차·개발자 회차와 동일 증상). **격리 프로필 headless Chrome + CDP 자체 드라이버**로 대체 검증했다(설치 패키지 0건, 사용자 프로필 무접촉) |
| 2 | **프로덕션 실서버 education 왕복 + 실데이터 5건 렌더** | 프론트 미배포 + 프로덕션 쓰기 금지 지시. 프로덕션 API 는 **읽기만** 확인(`?category=education` 200 `[]` — **게시물 0건**). 배포 후 실데이터 등록·렌더 대조는 **5차 최종 게이트(`05_verifier_final.md`) 몫으로 남는다** |
| 3 | YouTube 5건의 **자막(캡션) 제공 여부** | `decision-education-content.md` QA 인계 항목. 영상 재생·캡션 트랙 조회 미수행(링크 생존 200×5 만 확인) |
| 4 | 스크린리더 실청취(VoiceOver/NVDA)·실기기 터치 | DOM·ARIA·계산 스타일·터치 박스 크기 정적 검증까지만 |
| 5 | **첨부파일이 붙은 게시물의 `첨부 n` 토큰 조합** | 이번 회차에서 첨부 업로드 경로를 실행하지 않았다. 메타 토큰 배열에 첨부 분기가 있으므로(`PostList.tsx:120-130`) 첨부有 × 출처無 조합의 구분점은 **코드상 안전하나 실측 미수행** |
| 6 | `next dev` 모드의 클라이언트 동작 | headless Chrome 에서 dev 모드 앱 루트가 하이드레이션되지 않아(React 컨테이너가 `NEXTJS-PORTAL` 에만 부착) **프로덕션 빌드(`next start`)로 전환해 전건 검증**했다. 프로덕션 경로는 완전 검증됐고 배포 대상도 프로덕션 빌드이므로 실질 위험은 없다 |

### 비고

1. **브라우저 도구 대체 경위**: `claude-in-chrome` MCP 는 localhost 개발 서버에 도달하지 못한다(11회차와 동일). 추측으로 넘기지 않기 위해 별도 `--user-data-dir` 의 headless Chrome 을 띄우고 Node 내장 `WebSocket` 만으로 CDP 드라이버를 작성해 **실제 마우스·키보드 이벤트 + `getComputedStyle`·`getBoundingClientRect`·`document.activeElement` 실측**으로 검증했다.
2. **초기 3+2+4 FAIL 은 전부 어서션 코드 버그였고 재검증으로 PASS 전환**했다: ① `display:none` 필터가 `HEAD/TITLE/STYLE/SCRIPT` 를 포함 ② `#guestbook` 앵커 여백 상한을 40px 로 잡았으나 문서 끝 스크롤 클램프로 80px(요구값 이상) ③ Tab 루프 시작 포커스가 직전 클릭 위치 ④ 링크형 필드를 라디오 전환 전에 검사 ⑤ 메타 텍스트 비교에 `·` 좌우 공백 가정 ⑥ 비밀번호 필드 미클리어 후 재입력. **제품 결함은 0건.**
3. **ISR(`revalidate 60`) 영향**: 프로덕션 빌드의 `/` 는 정적 프리렌더 + 백그라운드 재생성이므로 admin 등록 직후 메인 반영에 최대 62초 관측(실측 1s/6s/56s/62s). 조합원 체감상 정상 동작이며, 검증에서는 반영 폴링 후 판정했다.
4. **스크린샷 4장**(스크래치패드): `home-desktop.png`(1280px 도입 블록+칩+공지 섹션) · `edu-360.png`(360px 노동교육 5카드 2행 메타) · `notices-360.png`(360px 작성형·링크형 카드 회귀) · `chips-360.png`(칩 2행). 스크래치패드는 세션 종료 시 소멸하므로 필요하면 리포지토리로 옮길 것.

---

# QA 리포트: 관리자 비밀번호 변경 (11회차)

> **배치 위치 안내**: 리더 지시는 "말미에 이어서"였으나, 이 파일은 **최신 회차가 최상단**인 내림차순(10→1) 관례로 관리되고 있다. 말미에 넣으면 1회차 아래에 묻히므로 관례를 따라 최상단에 추가했다(기존 내용 삭제·수정 0건). 위치 이동이 필요하면 알려주면 옮긴다.

- 작성: qa-tester | 작성일: 2026-08-17
- 검증 기준: **`_workspace/00_input/contract-password-change.md`(확정 계약 + 개정 1) = 판정 기준**, 요구사항 문서, 02 스펙 §14.8(§14.8.5 개정 반영본), 06 §10.4/§12.1-a/§12.3/§12.4, 07 §9, 03 §17
- 검증 대상(git 미커밋): 신규 4 (`server/migrations/1755300000003_create-admin-credentials.sql`, `server/src/repos/credentials.ts`, `server/scripts/set-password.mjs`, `src/components/admin/PasswordChangeForm.tsx`) + 수정 10
- **환경 격리**: 전용 QA DB `guestbook_qa` 신규 생성 + 스크래치패드 전용 env(`DATABASE_URL`=guestbook_qa, `COOKIE_SECURE=false`, `CORS_ORIGINS`에 localhost:3000, `ADMIN_PASSWORD_HASH`=QA 전용 해시). **`server/.env` 무수정, 개발 DB `guestbook` 무접촉, 프로덕션(101.79.31.30) 접속 0건**
- 검증 방법: ① 계약↔서버↔프론트 **필드 단위 3자 대조표** ② **curl 실왕복 45케이스**(계약 §2 표 순서대로) ③ **실브라우저 실조작 107 어서션**(headless Chrome + CDP 자체 드라이버 — `claude-in-chrome` MCP는 localhost 도달 불가로 대체, 아래 비고 1) ④ 대비 스크립트 재현 ⑤ 로그·스토리지 시크릿 grep ⑥ 빌드 6종
- 정리: `guestbook_qa` drop, API·dev·Chrome 프로세스 3종 종료(잔여 0), `server/.env` md5 불변 확인, 개발 DB 행수 기준선과 동일

## 11회차 요약: 통과 27 | 실패 0 | 권고 3 | 미검증 4

**최우선 리스크(서버가 `UNAUTHORIZED`를 내면 관리자가 로그아웃됨)는 실응답·실브라우저 양쪽에서 해소 확인.** 백엔드·프론트가 서로의 응답을 처음 받아본 왕복에서 경계면 불일치 0건.

### A. 경계면 3자 교차 대조 (계약 ↔ `routes/admin.ts` 실응답 ↔ `lib/api/admin.ts`)

**`GET /admin/me`** — 4필드 전부 일치. `additionalProperties:false` 스키마가 필드를 떨어뜨리지 않음을 **실응답으로 확인**.

| 필드 | 계약 §1 | 서버 (`admin.ts:31-41` 스키마 / `:254-284` 핸들러) | 프론트 (`admin.ts:768-781`) | 실응답 |
|---|---|---|---|---|
| `ok` | `true` | `boolean` required | 미검사(무해) | `true` |
| `method` | `"session"\|"bearer"` | `string` required, 2분기 | `=== "bearer" ? "bearer" : "session"` | 세션 `"session"` / Bearer `"bearer"` 둘 다 실측 |
| `expiresAt` | `string\|null` | `["string","null"]` required | 문자열 아니면 `null` | 세션 ISO / Bearer `null` |
| `passwordIsInitial` | `boolean` (신규) | `boolean` required, `active.updatedAt === null` | `=== true` (하위호환 방어) | 시드 후 `true` → 변경 후 `false` |

실응답 원문: `{"ok":true,"method":"session","expiresAt":"2026-08-17T12:42:10.094Z","passwordIsInitial":true}` / `{"ok":true,"method":"bearer","expiresAt":null,"passwordIsInitial":false}`

**`POST /admin/password`** — 요청 필드명(`currentPassword`/`newPassword`) 서버·프론트 동일. 성공 3필드 일치(`sessionsRevoked` 스키마 `integer` ↔ 프론트 `Number.isInteger` 아니면 0). 실패 5분기 전부 계약과 **문자 단위 일치**(아래 B).

**`http.ts` `CODE_TO_REASON`** — `INVALID_CREDENTIALS: "invalid-credentials"` 등록 확인(`src/lib/api/http.ts:82`). 미등록 시 `?? "network"`로 오분류되는 경로였으나 **정상 등록됨**. `ApiFailureReason`에도 추가(`:16`). 기존 reason 값·기존 엔드포인트 매핑 불변.

**타입 우회**: 이번 변경분(`src/components/admin`, `src/lib/api`, `server/src`)에 `as any`/`@ts-ignore`/`@ts-expect-error` **0건**. 유일한 `as unknown`은 `admin.ts:112`(기존 `requestJson` 반환 widening — 안전한 확대).

### B. API 실측 (curl) — 계약 §2 표 순서

| # | 케이스 | 실응답 | 판정 |
|---|---|---|---|
| 0 | rate limit 초과 | `429` `{"error":{"code":"RATE_LIMITED","message":"요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."}}` + `Retry-After: 6` | PASS |
| 0-b | 429 상태에서 **정상 요청도 차단**(진입 시 `check`) | `429` 동일 | PASS |
| 1a | `newPassword: ""` | `400 VALIDATION_ERROR` `currentPassword 와 newPassword 는 1자 이상 200자 이하의 문자열이어야 합니다.` | PASS |
| 1b | `currentPassword: 123`(비문자열) | 동일 | PASS |
| 1c | 필드 누락 `{}` | 동일 | PASS |
| 1d | `newPassword` 201자 | 동일 | PASS |
| 2 | `newPassword` 11자 | `400 VALIDATION_ERROR` `새 비밀번호는 12자 이상이어야 합니다.` | PASS |
| 2-순서 | **틀린 current + 11자 new** | `400` 12자 메시지 (401 아님 — #2가 #4보다 먼저) | PASS |
| 3 | `new === current` | `400 VALIDATION_ERROR` `새 비밀번호가 현재 비밀번호와 같습니다.` | PASS |
| 3-순서 | **틀린 current이면서 new===current** | `400` 동일 메시지 (#3이 #4보다 먼저) | PASS |
| 4 | 현재 비밀번호 불일치 | **`401` `{"error":{"code":"INVALID_CREDENTIALS","message":"현재 비밀번호가 일치하지 않습니다."}}`** | **PASS (최우선)** |
| — | **인증 실패와의 구분**: 쿠키 없음 / 위조 쿠키 | 둘 다 `401 UNAUTHORIZED` `관리자 인증에 실패했습니다.` — `INVALID_CREDENTIALS` **아님** | **PASS (최우선)** |
| 200 | 정상 변경 (세션 A로) | `{"ok":true,"changedAt":"2026-08-17T00:43:54.931Z","sessionsRevoked":2}` | PASS |

4개 message 전부 계약 §2 표와 **파이썬 문자열 비교로 문자 단위 일치** 확인.

| # | 부수 검증 | 실측 | 판정 |
|---|---|---|---|
| 5 | 변경 후 `GET /admin/me` | `passwordIsInitial:false` | PASS |
| 6 | 구 비밀번호 로그인 / 신 비밀번호 로그인 | `401 UNAUTHORIZED` / `200` (**재기동 없이 즉시 반영**) | PASS |
| 7 | **세션 무효화** A·B·C 중 A로 변경 | A `200` 유지, B·C `401`, `sessionsRevoked:2` 정확 | PASS |
| 8 | **만료 세션 부풀림 방지** 변경 직전 만료행 2건 주입 | `sessionsRevoked:2`(살아있던 B·C만) — 만료 2건은 `pruneExpired`로 선정리, 변경 후 `total=1` | PASS (07 §9.3-4 정교화 실동작) |
| 9 | **Bearer 경로** (살아있는 세션 2개) | `200 sessionsRevoked:2` → `admin_sessions` 0건, 두 쿠키 모두 `401` | PASS |
| 10 | Bearer + 현재 비밀번호 불일치 | `401 INVALID_CREDENTIALS` | PASS |
| 11 | `set-password.mjs` 복구 | `changedAt=… sessionsRevoked=1`, 전 세션 삭제, **재기동 없이** 새 비밀번호 로그인 `200`. 11자 입력 거부(exit 1). 평문·해시 미출력. **게시물·방명록 행수 불변** | PASS |
| 12 | 마이그레이션 | `1755300000003` 적용 후 컬럼·`CHECK (id = 1)`·PK가 계약 §4와 동일 | PASS |
| 13 | 부팅 시드 | 기동 시 `id=1`, `updated_at NULL` 1행 생성 | PASS |
| 14 | CORS preflight `OPTIONS /admin/password` | 허용 Origin: `allow-origin: http://localhost:3000` + `allow-credentials: true` + `allow-headers: Content-Type, Accept`. 비허용 Origin(`https://evil.example`)은 ACAO 미반환 | PASS |
| 15 | 비정상 본문 4종(빈 본문/text-plain/깨진 JSON/배열) | 전부 `400 VALIDATION_ERROR` — 500 누출 없음 | PASS |
| 16 | **회귀** | 방명록 POST 201·GET 200 / 로그인 200 / admin 게시물 생성 201·목록 200·PATCH 200·DELETE 200 / 공개 `GET /posts?category=notice` 200 / 로그아웃 200 + 이후 `401` — 전부 이전과 동일 | PASS |

### C. UI 실측 (실브라우저 조작 — headless Chrome + CDP, 107 어서션 전부 통과)

| # | 항목 | 실측 결과 | 판정 |
|---|---|---|---|
| 17 | **경고 배너 노출→소멸** | `passwordIsInitial:true` 상태에서 ready 뷰 **첫 자식**으로 `<section aria-labelledby="initial-password-title">` 렌더, 변경 성공 **즉시** DOM에서 제거(`/admin/me` 재호출 없음) | PASS |
| 18 | 배너 CTA / 헤더 버튼 동일 패널 | 둘 다 동일 패널 오픈, 열릴 때 `activeElement === #admin-current-password` | PASS |
| 19 | **PostForm과 상호 배타** | 비번 패널 열림→`새 게시물` 클릭 시 비번 패널 닫힘 / 반대도 성립. **`<h3>` 항상 정확히 1개**(`["비밀번호 변경"]` ↔ `["새 게시물 등록"]`) | PASS |
| 20 | **현재 비밀번호 오입력** (최대 리스크) | `stillOnAdminPanel:true, loginFormShown:false` — **로그아웃 안 됨**. 현재 비밀번호 필드 아래 `현재 비밀번호가 일치하지 않습니다.`(서버 message 그대로) + `aria-invalid="true"` + `activeElement`가 해당 필드로 이동 | **PASS (최우선)** |
| 21 | 세션 만료(대조군) | 패널 열어둔 채 외부에서 세션 행 삭제 → 제출 → `UNAUTHORIZED` → **로그인 화면 전환** + 패널 닫힘(평문 폐기). 20번과 정반대로 정확히 분기 | **PASS (최우선)** |
| 22 | 성공 문구 2갈래 | `sessionsRevoked=0`: `비밀번호를 변경했습니다. 이 브라우저의 로그인은 유지됩니다.` / `=2`: `비밀번호를 변경했습니다. 다른 기기의 로그인 2건이 해제되었습니다.` — 기존 상위 `<p role="status">` 슬롯 사용(토스트 신설 0) | PASS |
| 23 | 취소·성공 후 포커스 복귀 | 둘 다 `document.activeElement === 헤더 "비밀번호 변경" 버튼`(배너 CTA 아님 — 객체 동일성으로 확인) | PASS |
| 24 | 제출 버튼 비활성 조건 | 빈 폼에서 `disabled:false` — 눌러서 검증 → `현재 비밀번호를 입력해 주세요.` + 첫 오류 필드 포커스, 서버 요청 없음. busy일 때만 `disabled:true` + 라벨 `변경 중…` + `aria-busy="true"`, **`opacity:1` 유지**(대비 무손실), 입력 필드는 `disabled:false`(포커스 유실 방지), `cursor:not-allowed` | PASS |
| 25 | 서버 에러 4분기 UI 매핑 | `validation`(201자 주입) → 폼 하단 `<p role="alert">`에 서버 message 그대로 / `rate-limited` → `시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.` / `network`(fetch 차단) → `서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.` / `invalid-credentials` → 필드 에러(#20). **네 경우 모두 로그인 화면으로 튕기지 않음** | PASS |
| 26 | 하위호환 방어 | `/admin/me` 응답에서 `passwordIsInitial`를 가로채 제거(구버전 API 모사) → `invalidResponse`로 죽지 않고 ready 진입, **배너 미표시**(안전한 기본값), 헤더 진입점은 유지 | PASS |
| 27 | PostForm 회귀 | `LABEL_CLASS` → `ADMIN_LABEL_CLASS` 교체 후 라벨 7개 전부 `#1a1a1a / 18px / 600 / block` — 시각 회귀 0 | PASS |

### D. 접근성

| 항목 | 실측 | 판정 |
|---|---|---|
| 헤딩 순서 | 배너 있음+패널 닫힘: `h1 관리자 → h2 주의 — 초기 비밀번호를 사용 중입니다 → h2 게시물 관리`. 패널 열림: 뒤에 `h3 비밀번호 변경`. 변경 후: `h1 → h2 게시물 관리`. **건너뜀·중복 0** | PASS |
| 배너 라이브 리전 **미부착**(스펙상 의도) | `role=null, aria-live=null`, 하위 `[role=status\|alert\|aria-live]` **0개** | PASS |
| 라벨·autoComplete·maxLength | 3필드 전부 `label[for]` 연결(`현재 비밀번호 (필수)`/`새 비밀번호 (필수)`/`새 비밀번호 확인 (필수)` — "(필수)" 텍스트 표기), `type=password`, `current-password`/`new-password`/`new-password`, `maxLength=200` | PASS |
| `aria-invalid` / `aria-describedby` | 에러 없을 때 `aria-invalid` 미설정 → 에러 시 `"true"`. `aria-describedby`가 참조하는 **모든 id가 실제 DOM에 존재**(`getElementById` 전수 확인). 확인 필드는 힌트 없으므로 속성 자체 미출력(빈 문자열·유령 id 없음) | PASS |
| `role="alert"` 배치 | 필드 에러 3개 각 필드 아래 조건부 렌더(나타날 때 발화), 폼 하단 에러는 form 직계 `<p role="alert">` | PASS |
| 힌트 문구 | 스펙 §14.8.4와 문자 단위 일치(`본인 확인을 위해 현재 비밀번호를 다시 입력합니다.` / `12자 이상 200자 이하, 현재 비밀번호와 다르게 입력해 주세요.`) | PASS |
| **색 대비 재현** (`check-contrast.mjs`) | **#27 신규 `#093389` on `#fdf0e7` = 10.18** ✅ / 15.58 / 7.84 / 8.77 / 11.37 / 17.40 / 7.56 / 8.46 / 4.83 / 11.37 — §14.8.7 표 10개 값 **전부 일치**. 금지 조합도 재현(`#4b5563` on tint 6.76 AAA미달, `#ec6d1e` on tint 2.78 UI불가) | PASS |
| **구현 실측 색 ↔ 대비표** | 브라우저 `getComputedStyle` 실측: 배너 배경 `#fdf0e7`, 좌측바 `#7a3806` 4px, CTA `#093389`/`#ffffff`, 제목 `#7a3806` 18px/700, 본문 **`#1a1a1a`**(금지된 `text-ink-muted` 아님), 아이콘 `#7a3806` 24px `aria-hidden="true"`, 힌트 `#4b5563`, 에러 `#9c0d14`, 입력 보더 `#6b7280`/48px/radius 12px, 포커스 링 3px `#093389` — **스펙 값과 전부 일치, 임의 색 0건** | PASS |
| 키보드 전용 전 플로우 | 실 `Tab`/`Enter` 키 이벤트: Tab만으로 헤더 버튼 도달 → **Enter로 패널 열림 + 첫 필드 자동 포커스** → Tab 3회로 3필드 → 제출 → 취소, Shift+Tab 역방향 정상, **Enter로 제출 성공** | PASS |
| 포커스 링·터치 대상 | 헤더 버튼 `outline: 3px solid #093389`, `min-height:44px`(실측 44px). 입력 48px, CTA 44px, 제출·취소 44px | PASS |
| **360px 뷰포트** | `scrollWidth 360 = clientWidth 360` — **가로 스크롤 0**. 헤더 3버튼 **2줄 wrap**(새 게시물+비밀번호 변경 / 로그아웃). 배너 328px, **CTA `w-full` 292px×44px 세로 스택**, 제목 2줄·말줄임 없음(`text-overflow:clip`), 폼 우측 327px < 360px | PASS |
| ≥768px 배너 | `flex-direction:row` 단일 행, CTA 146px·1줄(라벨 줄바꿈 없음) | PASS |

### E. 보안·개인정보

| 항목 | 실측 | 판정 |
|---|---|---|
| 서버 로그 시크릿 | 전체 로그(144줄) grep: 평문 6종·`$argon2`/`argon2id`·`token_hash`/`admin_session=`·`currentPassword`/`newPassword` **전부 0건**. 기록된 라인은 `{"route":"admin-password-change","method":"session","sessionsRevoked":2}` / `{"result":"current-password-mismatch"}`뿐 | PASS |
| 응답 본문 해시 누출 | `GET /admin/me`·`POST /admin/password` 성공/실패 전 응답에 해시 문자열 0건 (직렬화 스키마가 4/3필드로 고정) | PASS |
| 프론트 평문 잔류 | 브라우저 실측: `localStorage` 0키, `sessionStorage` 0키, URL에 평문 없음, **직렬화 HTML(`outerHTML`)에도 평문 없음**(React 제어 input이 `value` 속성을 렌더하지 않음). 평문은 `PasswordChangeForm` 로컬 state에만 존재하고 언마운트로 폐기 | PASS |
| WHERE 없는 DELETE 전수 | `server/` 전체 grep: 2곳뿐 — `repos/sessions.ts:64`(`destroyAll`), `scripts/set-password.mjs:55`. **둘 다 `admin_sessions` 한정**. 게시물·방명록 테이블 대상 0건. 나머지 DELETE 3개는 전부 WHERE 보유. `TRUNCATE` 0건, `DROP TABLE`은 마이그레이션 Down뿐 | PASS |
| 현재 비밀번호 재확인 강제 | 세션만으로는 변경 불가 — #4 검증이 항상 수행됨(실측) | PASS |
| rate limit 정책 | `check`만 진입 시 수행, `record`는 **#4 실패에서만**(성공 변경 5회 연속 실행해도 카운트 안 됨 — 실측) | PASS |

### F. 빌드·정적 검사

| 명령 | 결과 |
|---|---|
| `npx next typegen` | 통과 |
| `npx tsc --noEmit` | 통과 (오류 0) |
| `npm run lint` | 통과 (오류·경고 0) |
| `npm run build` | 통과 (`/admin` ○ Static, 라우트 구성 변화 없음) |
| `cd server && npm run typecheck` | 통과 (strict) |
| `cd server && npm run build` | 통과 |

### 회귀 (이전 회차 실패 항목)

| 회차 | 항목 | 현재 상태 |
|---|---|---|
| 7회차 실패 #1 | `GmarketSans*.woff2`가 실제로는 OTF(`OTTO`) | **해소** — 두 파일 모두 시그니처 `774f4632`(`wOF2`) 확인 |
| 10회차 | 실패 0 | 해당 없음 |

### 권고 (실패 아님 — 리더 판단 사항)

| # | 분류 | 위치 | 내용 | 제안 |
|---|---|---|---|---|
| R1 | 예외 경로 견고성 | `server/src/repos/credentials.ts:59-73` (`update`) ↔ `server/src/routes/admin.ts:127-134` (`resolveCredentials`) | **폴백이 절반만 구현됨.** `resolveCredentials`는 행 부재 시 env로 폴백해 검증을 통과시키지만, 이어지는 `update()`는 `UPDATE … WHERE id = 1`이라 0행 → throw → **`500 INTERNAL_ERROR`**. 실측: 행 삭제 후 `POST /admin/password` → `500`. 프론트는 `INTERNAL_ERROR`가 `CODE_TO_REASON` 미등록이라 `network`로 낙하 → **"서버에 연결하지 못했습니다."**(원인과 무관한 문구). 트리거는 07 §9.7이 안내하는 "최후의 수단: 행 DELETE" 직후 재기동 전 구간뿐이라 심각도 낮음 | `credentials.update`를 `set-password.mjs:44-49`와 동일한 UPSERT(`INSERT … ON CONFLICT (id) DO UPDATE SET password_hash=…, updated_at=now() RETURNING updated_at`)로 바꾸면 행 부재 경로가 자가 치유되고 폴백 설계가 일관해진다 (1개 쿼리 교체) |
| R2 | 계약 문언 | `_workspace/00_input/contract-password-change.md:75-76` ↔ `server/src/routes/admin.ts:362-377` | 계약은 "Bearer 로 호출한 경우 모든 세션이 무효화"라고 쓰였으나, 구현 분기 기준은 "**유효한 세션 쿠키를 들고 왔는가**"다. 실측: Bearer + 유효 쿠키 동시 전송 시 `method:"session"`, `sessionsRevoked:1`로 그 쿠키 세션을 **유지**한다. 계약의 상위 원칙("현재 요청의 세션은 유지된다")에는 부합하며 브라우저·curl 실사용에서 겹칠 일이 없으므로 결함으로 보지 않음 | 계약 §2 문구를 "요청에 유효한 세션 쿠키가 없으면(=순수 Bearer 호출) 전 세션 무효화"로 정밀화하면 문언·구현이 완전 일치 |
| R3 | 문서 정합 | `_workspace/03_developer_impl.md` §17 "스펙과의 차이 1건" | 개발자가 "스펙 §14.8.5 표가 개정 1 이전 상태라 수정 필요"로 기록했으나, **리더가 이미 §14.8.5를 개정 반영본으로 갱신**했다(현재 스펙에 `invalid-credentials`→필드 에러 / `unauthorized`→로그인 화면 표 + "✅ 경계면 해소" 문단 존재). 기록이 역으로 낡음 | 03 §17의 해당 절을 "해소됨"으로 갱신 (코드 영향 0) |
| R4 | 운영 유의 (정보) | `server/src/app.ts:141`, `routes/admin.ts:299-302` | loginLimiter 공유는 계약 §2 규정대로지만, `/admin/login`은 **성공 로그인도 `consume`** 한다. 즉 "로그인 1회 + 현재 비밀번호 4회 오타"면 5회 소진으로 429. 또한 이 버킷은 **복구용 Bearer 경로도 함께 막는다**(실측: 로그인 4회 후 Bearer 변경 시도 → 429). 계약 준수이므로 실패 아님 | 운영 문서에 "잠금 시 최대 1시간 대기 또는 API 재기동(인메모리 리미터 초기화)" 한 줄 추가 권장 |

### 미검증 항목

| # | 항목 | 사유 |
|---|---|---|
| 1 | `claude-in-chrome` MCP(사용자 실제 Chrome)로의 조작 | **권한/도달 불가** — 확장이 `localhost:3000`·`127.0.0.1:3000`·LAN IP 모두 "error page"로 반려(외부 사이트 `example.com`은 정상 로드되어 확장 자체는 동작). dev 서버는 curl 200 응답 확인됨. 대체 수단으로 **격리 프로필의 headless Chrome을 CDP로 직접 구동**해 실조작 검증(위 C·D)을 수행했다. 실사용자 Chrome 프로필·확장 환경에서의 동작은 미검증 |
| 2 | 스크린리더 실낭독 (`role="alert"` 발화 타이밍, 배너 랜드마크 안내, `aria-describedby` 낭독 순서) | 보조기기 실행 환경 없음. DOM 속성 정확성까지만 검증 |
| 3 | 비밀번호 관리자(1Password·Chrome 저장) 자동완성·저장 프롬프트 실동작 | headless 환경에 비밀번호 관리자 부재. `autoComplete` 값 정확성까지만 검증 |
| 4 | 프로덕션 배포 검증 (07 §9.5 절차, 마이그레이션→API 재기동 순서, 프로덕션 스모크) | 지시에 따라 프로덕션 접속 0건. 배포는 리더 수행 범위 |

### 비고

1. **브라우저 도구 대체 경위**: `claude-in-chrome` MCP는 외부 사이트는 열지만 로컬 개발 서버(localhost/127.0.0.1/LAN IP)에 대해 일관되게 "Frame with ID 0 is showing error page"를 반환했고, dev 서버 로그에도 해당 요청이 도달하지 않았다(확장 측 사이트 권한 문제로 추정). 추측으로 넘기지 않기 위해, 별도 `--user-data-dir`의 headless Chrome을 띄우고 Node 내장 WebSocket만으로 CDP 드라이버를 작성해 **실제 마우스·키보드 이벤트와 `getComputedStyle`·`document.activeElement` 실측**으로 검증했다. 설치한 패키지 0건, 사용자 Chrome 프로필 무접촉.
2. **rate limit 리셋 방법**: 인메모리 리미터라 테스트 그룹 사이에 API 프로세스를 재기동해 초기화했다(DB 상태 유지). 리미터 자체의 동작은 재기동 전에 실측 완료(#0).
3. `server/dist`·`.next`는 검증 과정에서 재빌드되었다(둘 다 gitignore 대상, 현재 소스와 일치). 추적 파일 변경 0건 — `git status`가 개발자 변경분 21건 그대로.
4. 06 §18의 "429 + `Retry-After: 60`"은 예시값이며, 실측값은 슬라이딩 윈도 잔여시간에 따라 달라진다(이번 실측 6초). 불일치 아님.

---

# QA 리포트: 공지·소식 DB 전환 + admin 풀스택 (10회차)

- 작성: qa-tester | 작성일: 2026-08-17
- 검증 기준: 06 명세 Part 2(§10~17), 02 스펙 §14·§13.5.2(지부명 규칙)·§13.5.1(8차 축소 개정), 03 구현 §15, 07 §7
- 환경: 로컬 PostgreSQL 16 + `server/` 기동(ADMIN_PASSWORD_HASH는 QA 전용 임시 해시로 env 오버라이드 — 평문·해시 미출력, 검증 후 삭제) + 프론트 `next start`(API 연결 빌드)
- 검증 방법: **프론트 프로덕션 파서 직접 실행**(4회차 방식 + 쿠키 자ar 래퍼로 브라우저 모사) 27케이스 + curl 원시 헤더 실측 + 실렌더 HTML 검사 + 폰트 메트릭 재계산 + 대비 스크립트 + 빌드 3종(프론트)+server typecheck
- 정리: 테스트 게시물·첨부·세션 DB 삭제(posts 0/attachments 0/sessions 0), 업로드 파일 6개 제거(디렉토리 0), 프로세스 2종 종료, 임시 스크립트·비밀 파일 삭제, API 미설정 클린 재빌드 복원

## 10회차 요약: 통과 18 | 실패 0 | 미검증 4 | 비고 3

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | **응답 shape 3자 교차 (최우선)** | 목록 `GET /posts?category=`: **최상위 배열** + `x-total-count` + `access-control-expose-headers` 실측, 프로덕션 `listPosts` 파서 `ok:true` 통과(notice/news/urgent 필터 3케이스). 상세 `getPost`: PostSummary+body 파싱 통과. 첨부 배열: `parseAttachment` 5필드(id/filename/mimeType/sizeBytes/url) 전부 명세 §11.1과 일치. null 허용 필드(url·source·deadline·body)가 링크형/작성형 양쪽에서 정확히 구분 반환됨 |
| 2 | 인증 — 무인증 차단 | 무인증 `adminMe`·`adminListPosts` → 401 → 프론트 `reason:"unauthorized"` 정확 분기. 잘못된 비밀번호 로그인 → 401(계정 힌트 없는 단일 메시지 "인증에 실패했습니다.") |
| 3 | 인증 — 세션 쿠키 | 로그인 성공 시 `Set-Cookie: admin_session=…; Max-Age=43199; Path=/admin; HttpOnly; SameSite=Lax` 실측(명세 §12.1 일치, 값은 리포트에서 마스킹). `Secure`는 `COOKIE_SECURE` 기본 `true`(config.ts:70) — 로컬만 false, 프로덕션 기본 안전. 쿠키 보유 후 `adminMe` 통과 |
| 4 | CORS credentials | 허용 Origin(localhost:3000) preflight: `allow-origin` 정확 매칭 + **`allow-credentials: true`** + methods `GET, POST, PATCH, DELETE` + expose `X-Total-Count`. 비허용 Origin은 ACAO 미반환(와일드카드 없음 — §15-2 승인 조건 충족). 프론트 admin 전 요청 `credentials:"include"`(admin.ts:86) 코드 확인 |
| 5 | 세션 만료 처리 | `AdminApp.tsx:120` — 목록 조회가 `unauthorized`면 `setPhase("login")`으로 로그인 화면 복귀(세션 만료 UX). 로그인 에러 3분기 문구가 §14.2 지정 문구와 문자 단위 일치 |
| 6 | **번들 비밀 유출 0건** | 클라이언트 번들 15파일 + admin SSR HTML 고정문자열 검사: QA 평문 비밀번호·argon2 해시·Bearer 토큰·`ADMIN_PASSWORD`/`ADMIN_API_TOKEN`/`IP_HASH_SECRET`/`DATABASE_URL`/`argon2` **전부 0건** |
| 7 | CRUD E2E — 생성 | 작성형 공지(urgent+deadline+출처) 201, 링크형 소식(url) 201 — 둘 다 상세 shape 반환·파서 통과. `publishedAt`은 입력에 없고 서버 자동 기록(§15-6 판정 준수, `AdminPostInput`에 필드 부재 확인) |
| 8 | CRUD E2E — 수정·삭제 | PATCH 부분 수정(제목·urgent) 200 반영. DELETE soft → **공개 상세 404·공개 목록 0건·admin 목록엔 `deletedAt` 노출**·삭제 글의 첨부 파일도 404(공개 차단, 파일은 보존) |
| 9 | 공개 렌더 E2E (ISR) | API 연결 빌드 실렌더: 히어로 urgent 바인딩(긴급 배지·hero 제목·CTA `/notices/<uuid>`), 마감 스트립 **D-3·8/20**(오늘 KST 2026-08-17 기준 정확), 링크형 카드, 작성형 상세(h1·마크다운 h2 매핑·출처·첨부 행), 링크형 상세("원문 보기" 외부 링크). **ISR 60초 재검증 실측**(urgent 복구 → 재검증 후 히어로 반영, 삭제 → 재검증 후 빈 상태·폴백 복귀) — D-n이 요청 시점 계산으로 전환된 것 확인 |
| 10 | §14.1 링크형 카드 3중 병행 | 카드 전체 `target="_blank" rel="noopener noreferrer"`, 메타 "외부 링크(새 창) · example.com"(**호스트만** — 전체 URL 미노출), ↗ 아이콘, 접근성 이름에 메타 문구 포함(`<a>` 내부 텍스트) — HTML 실측 |
| 11 | §14.1 첨부 표시 | 목록 카드 "첨부 1"(문서 아이콘+caption), 상세 첨부 행(파일명·크기 "2KB"·API 절대 URL·↓ 아이콘·surface 카드). 다운로드 **바이트 완전 일치**(2125B), `content-disposition: attachment`, `cache-control: public, max-age=31536000, immutable`, 잘못된 filename 접근 404(§11.3 규정) |
| 12 | preview-link 3상태 | 성공(example.com → "Example Domain" 추출), 실패 폴백(존재하지 않는 호스트 → `link-fetch-failed` + 수동 입력 안내), 로딩 상태는 `PostForm.tsx:308` `role="status"` 코드 확인. 제목 필드 항상 편집 가능 |
| 13 | **SSRF 회귀 (프론트 경유)** | 6케이스 전부 차단: 127.0.0.1:3001(포트 규칙), 127.0.0.1:80·localhost 이름·192.168.0.1·169.254.169.254(대역 규칙 "허용되지 않는 대상입니다"), `file://`(스킴 규칙). 전부 `link-fetch-failed`로 프론트에 정확 분기 |
| 14 | 업로드 화이트리스트 | 정상 PDF 201. `.php`(MIME 불일치) 거부, **확장자 위장 `fake.pdf`(매직바이트 불일치) 거부** — 이중 검사 실동작. 프론트 선검증 상수(5개·10MB·pdf/png/jpg/webp)가 백엔드 한도와 동일 수치 |
| 15 | **지부명 표기 전수** | `grep -rn "코스콤지부" src/` → 짧은 표기 **0건**, 정식 표기 "코스콤(한국증권전산)지부" 10건(헤더·푸터·히어로 록업·메타데이터·admin 포함) — §13.5.2 공통 문구 규칙 준수 |
| 16 | 접근성 | admin 폼: 전 필드 가시 `<label htmlFor>`, "(필수)" 텍스트 표기(별표·색 단독 아님), `<fieldset><legend>` 2종(글 유형·카테고리), `autoComplete="current-password"`, `inputMode="url"`, `type="date"`, 로그인 에러 `role="alert"`, 저장·업로드·preview `role="status"`. **DeleteDialog**: `role="alertdialog"`+`aria-modal`+labelledby/describedby, **초기 포커스=취소**(useEffect), Tab 포커스 트랩, Esc·오버레이 클릭 취소. `/admin` `<meta name="robots" content="noindex, nofollow">` 실측 |
| 17 | 대비 (§14.6 재사용 설계) | 실사용 11조합 재실측 — 텍스트 전부 AAA(#8 11.37·#10 10.45·#12 8.46·#13 7.74·#14 8.46·#22 9.23·#2 16.65·#6 7.56·#7 7.23), UI 보더·아이콘 #20 4.83·#21 4.63(3:1 통과). **신규 조합 0건**, admin 하드코딩 hex 0건 |
| 18 | 회귀·빌드 | 방명록 API 200(Part 1 무영향), 상세 라우트 `[id]` 전환 정상 + **카테고리 불일치 id 404**(공지 id를 news 경로로 열람 차단), 탭 ARIA 유지, 폰트(Pretendard CSS 3참조·`font-display` 11개소)·헤더 v4 8차 축소분(`border-y-4`·`py-2 md:py-3`·마크 h-8/h-9·록업 15/17.7→16/18.9px) 스펙 일치. **등폭 재계산: 헤더 8차 모바일 0.37px·md 0.20px, 히어로 0.50/0.24px — 전부 ±2px 이내**. 375px 헤더 252.3px(여유 122.7px). 프론트 `tsc`0·`lint`0·`build` 통과(/ ○ ISR 1m, /admin ○, 상세 ƒ), `server` typecheck 통과 |

### 비고

1. **로컬 DB에 이전 스모크 잔여 데이터 존재** — 정리 시 posts 8건·attachments 6건이 삭제됨(이번 QA 생성분은 posts 2·attachment 1). 나머지는 개발자 스모크 잔여로 추정 — 로컬 개발 DB 한정이라 프로덕션 영향 없으나, 스모크 후 정리 완결성 개선 권고. 방명록 테이블에도 `[Part1 회귀 확인 - 삭제 예정]` 1행 잔존(권한 제약으로 미삭제 — 로컬 한정, 개발자 정리 요청).
2. `src/lib/api/admin.ts:92` `(await response.json()) as unknown` — `any`를 `unknown`으로 **좁히는** 방어적 캐스팅으로 타입 우회 아님(우회 grep 실질 0건).
3. DeleteDialog 오버레이 `div onClick`(취소) — 키보드 경로는 Esc·취소 버튼이 보장하므로 접근성 장벽 아님(보조 수단).

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | **admin UI 브라우저 실조작** — 라디오 전환 시 입력값 유지, preview 3상태 시각 전환, 파일 선택·선검증 UX, 다이얼로그 포커스 트랩 실동작, 실브라우저 CORS 쿠키 전송 | 브라우저 자동화 환경 없음 — 쿠키 자ar 래퍼로 계약·분기는 실행 검증, 쿠키 속성·CORS 헤더는 curl 실측으로 대체 |
| 2 | 프로덕션 도메인 CORS·`Secure` 쿠키 실동작 | 미배포 — 로컬 localhost:3000 origin만 확인. 배포 시 07 §7.1 스모크 필요 |
| 3 | 게시물당 5개 초과·10MB 초과 업로드 한도 실측 | 대용량 전송 시간 제약 — 프론트 선검증 상수·백엔드 한도 수치 일치는 코드 확인 |
| 4 | 스크린리더 실낭독, 실뷰포트 렌더 | 환경 제약(기존 회차와 동일) |

---

# QA 리포트: 헤더 v4 + 히어로 모드 2 등폭 록업 (9회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 기준: 스펙 §13.5(2026-08-16 6차)·§11.4 6차 개정, 구현 §13 (`SiteHeader.tsx`·`HeroPanel.tsx` 2파일)
- 검증 방법: 스펙 값 대조 + **hmtx 폰트 메트릭 등폭·폭 재계산**(8회차 방법론) + **장식 원형 원 방정식 겹침 판정** + 대비 실측 + 실빌드 HTML(메인·상세 임시 파일 라운드트립·클린 복원) + tsc/lint/build

## 9회차 요약: 통과 9 | 실패 1 | 미검증 2

### 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 접근성/스펙 위반 (장식 원형 ↔ 록업 겹침) | `src/components/home/HeroPanel.tsx:22-25` (장식 원형 `-right-12 -bottom-12 size-36`) ↔ 모드 2 록업(54-61행) | **코드 기하 판정으로 겹침 확정.** 모바일 375px 모드 2: 패널 높이 ≈160px 기준 원(중심 (319,136), r=72) 대비 — 2줄 록업 우측 끝 하단 (314,89)은 중심 거리 **46.9 < 72 → 원 내부**, 부문구 우측 끝 (315,136)도 거리 4.3로 원 내부(부문구 폭은 0.95em 상한 추정). md 768px도 2줄 끝 거리 70.4 < 72로 경계 침범. 겹침 구간 대비 실측: 흰 록업/#2e7df7 = **3.89:1(본문 미달)**, 부문구 #d9e9ff/#2e7df7 = **3.16:1(미달·미채택 조합)** — §11.4 "장식 ... **텍스트 겹침 금지**" 명시 위반. 원인: 6차 개정으로 폴백 텍스트 폭이 ~150px("코스콤지부")→290px(록업)로 확대됐는데 장식 원형 위치가 재검토되지 않음(6회차까지는 겹치지 않았음 — 신규 발생) | (a) 모드 2에서 장식 원형 미렌더(§11.4에서 장식은 "선택" — 최소 수정) 또는 (b) 오프셋 확대(예: `-right-24 -bottom-24` → 가시 영역 48×48로 축소 시 록업 끝 거리 >r) — **위치·크기 확정은 frontend-designer 판단 사항으로 분류**(본 리포트의 기하 수치 제공). 스펙 §11.4 개정 시 장식 규정 재검토 누락 성격도 병존 — 디자이너에게 함께 전달 |

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | §13.5 구조 교차 | `border-y-[6px] border-primary`(상하 6px 띠·풀폭) + `bg-bg`(흰 배경) + 두 줄 `text-primary` — 빌드 HTML 실측, 구 네이비 밴드(`header bg-primary`) 잔존 0건, 마크 radius 제거(`rounded` 0건)·40/48px·alt/aria-hidden/priority 유지, gap 0.75rem·min-h-touch·홈 링크 1개 |
| 2 | 록업 크기 8종 | 헤더 1줄 `23.7px`/md `37.9px`·2줄 `20px`/md `32px`, 히어로 1줄 `30.8px`/md `66.2px`·2줄 `26px`/md `3.5rem`(56px) — 전부 행간 1.15·Gmarket Bold·자간 -0.02em·nowrap, 스펙 §13.5.2·§11.4 표 값과 일치(HTML 실측) |
| 3 | **등폭 검증 (핵심)** | hmtx 실측 4쌍 전부 통과: 헤더 모바일 223.3 vs 222.8(차 **0.45px**)·헤더 md 357.0 vs 356.5(**0.54px**)·히어로 모바일 290.1 vs 289.6(**0.50px**)·히어로 md 623.6 vs 623.8(**0.24px**) — 기준 ±2px 이내. CSS letter-spacing 방식(마지막 글자 포함)과 스펙식(n−1회) 양쪽 계산 모두 기준 내 |
| 4 | 375px 잘림 | 헤더: 록업 223.3 + 마크 51.5 + gap 12 = **286.7px vs 가용 343px(여유 56.3px)**. 히어로: 록업 290.1px vs 패널 내부 295px — **여유 4.9px, 잘림 없음**(스펙 검산 290≤295와 일치, 타이트함은 비고 참조) |
| 5 | 문구 | 부문구 "코스콤 조합원을 위한 정보 공유" 문자 단위 일치(소스·빌드), 구 문구 "공식 소식 공간" 잔존 **0건**(src grep + 빌드 HTML). 록업 명칭 2줄 자수 원문 유지. CTA·배지·액센트 바 모드 2 부재, 아이브로우 caption 제거 |
| 6 | 대비 | 신규 조합 0건 설계 확인 — 파란 텍스트/흰 배경 = 채택 #8(11.37:1) 재실측 재사용, 히어로 록업 흰/네이비 = #11. (겹침 구간 제외 — 실패 #1) |
| 7 | 포커스 링 | 헤더 파랑 링 복원(`focus-visible:outline-primary` HTML 실측) — 헤더 내 흰 링(`outline-white`) 잔존 **0건**. 히어로 모드 1 CTA의 outline-white는 §11.4 스펙 유지분(정상) |
| 8 | h1 위계·상세 회귀 | 메인 h1 정확히 1개(헤더 록업). 상세(임시 파일 실빌드): v4 띠 헤더 정상·로고 `<p>` 강등·h1=게시물 제목 1개 — 실측 후 삭제·클린 복원(잔존 0건, content/ .gitkeep 3개) |
| 9 | 빌드·범위 | `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static·상세 ● SSG). 변경 2파일 외 무변경, 신규 폰트·토큰·자산·색 0건(§13.5.4 일치) |

### 비고

1. 히어로 록업 여유 4.9px는 **Gmarket Sans 로드 성공 전제** — 폴백 Pretendard의 한글 자폭이 다르면 nowrap 록업이 295px를 초과할 수 있음(폴백 시나리오 실브라우저 확인 권장, 미검증 #1 연동).
2. 실패 #1의 md 침범은 1.6px(거리 70.4 vs r 72)로 경계적 — 모바일이 주 위험.

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실브라우저 — 겹침 시각 확증(실패 #1), Pretendard 폴백 시 록업 폭, 히어로 md 66.2px와 hero 스케일의 시각 균형 | 브라우저 환경 없음 — 기하·메트릭 계산으로 판정 가능한 범위는 전부 수행 |
| 2 | 스크린리더 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 폰트 회귀 + 자수 아이덴티티 헤더 (8회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 기준: A — 7회차 실패 #1 회귀 / B — 스펙 §13(2026-08-16 5차), 구현 §12 (`SiteHeader.tsx` 단일 파일)
- 검증 방법: 바이너리 시그니처 재실측 + §13 값 대조 + **폰트 메트릭 기반 375px 폭 재계산**(fontTools로 woff2 hmtx advance 실측) + 실빌드 HTML(메인·상세 — 임시 파일 라운드트립·클린 복원) + 실서빙 curl + tsc/lint/build

## 8회차 요약: 통과 8 | 실패 0 | 미검증 2

### A. 7회차 실패 #1 회귀 — **해소**

| 확인 | 결과 |
|------|------|
| 시그니처 | 두 파일 모두 `wOF2` 실측 (7회차 `OTTO`에서 수정 — 개발자·리더 확인에 더한 3중 확인) |
| 수정 코드 | `scripts/build-gmarket-fonts.py:76` — `font.flavor = "woff2"`를 `save()` 전에 설정 (지적한 수정 방법 그대로) |
| 크기 | 146,040B / 140,404B (255/250KB → 143/137KB — 브로틀리 압축 효과, 스펙 §12.3 예상 하단 인접) |
| 선언 일치 | `@font-face`의 `format("woff2")` ↔ 실데이터 woff2 일치 |
| 서빙·빌드 | 2종 모두 200 (크기 일치), tsc/lint/build 무영향 통과 |

### B. 자수 아이덴티티 헤더 — 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | §13.2 ↔ 구현 교차 | 풀폭 네이비 밴드 `bg-primary`(#093389 — 신규 색 0건)·하단 보더 제거·세로 패딩 0.75/1rem 유지, KFIU 마크 `rounded-lg`(8px)·40/48px·`alt=""`+aria-hidden+priority 유지, 마크-텍스트 gap 0.75rem·홈 링크 1개·`min-h-touch` — 코드·빌드 HTML 실측 전부 일치 |
| 2 | 명칭 2줄 (문자 단위) | 1줄 "전국금융산업노동조합" 15px/600/흰(Pretendard — `font-display` 미적용, §12.2 소형 원칙), 2줄 **"코스콤(한국증권전산)지부"**(괄호 포함 자수 원문) Gmarket Bold 700·자간 -0.02em·모바일 `text-[1.25rem]/[1.3]`(20px)·md `text-h1`(32px)·`whitespace-nowrap` — 빌드 HTML h1 내부에서 문자 단위 일치 실측. 구 표기 "코스콤지부" 헤더 잔존 0건 (히어로 폴백 h2의 "코스콤지부"는 §11.4 스펙 그대로 유지 — §13은 헤더만 대체) |
| 3 | 대비 | 신규 색 조합 0건 확인 — 흰 텍스트/#093389 = 채택 #11(11.37:1 AAA) 재사용, 재실측 불요(§13.3 명시와 일치). focus-visible 흰 링 3px offset 2(#11 UI 통과) 적용, **헤더 내 `outline-primary` 잔존 0건** grep |
| 4 | **375px 경계 재계산 (폰트 메트릭 실측)** | woff2 hmtx advance 실측: 지마켓산스 Bold 한글 **0.96em**(19.2px@20px)·괄호 0.41em(8.2px) → 2줄 실폭 = 228.0 − 자간 5.2 = **222.8px**. 행 합계 = 마크 51.5 + gap 12 + 222.8 = **286.3px vs 가용 343px → 여유 56.7px, 클리핑 위험 없음(통과)**. 스펙 §13.2의 344px 계산은 전각 1.0em 가정의 보수적 상한이었음 — 모바일 크기 조정 불필요 판단 근거로 디자이너에게 전달. 참고: 320px 초소형 뷰포트도 가용 288px로 1.7px 여유(경계 내), md 32px는 430 vs 720px 여유 |
| 5 | h1 위계 회귀 | 메인: h1 정확히 1개(헤더 로고 — 2줄 명칭 포함). 상세(임시 파일 실빌드): h1 = 게시물 제목 1개, 헤더 로고 `<p>` 강등, 상세에도 네이비 밴드 정상 렌더 — 실측 후 삭제·클린 복원(잔존 0건) |
| 6 | 기존 기능 무변화 | 히어로 폴백 h2·방명록 준비 카드·탭·상세 ● SSG 유지 (변경이 SiteHeader 단일 파일임을 확인) |
| 7 | 빌드 3종 | `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static) |
| 8 | 신규 자산·토큰 0건 | §13.4대로 폰트·토큰·자산 추가 없음 (globals.css diff 없음, 기존 Gmarket `font-display` 유틸 재사용) |

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실뷰포트 시각 확인 — 375px 실렌더(계산상 안전하나 육안 확증), 헤더·히어로 네이비 중복의 시각 판정(§13.3 "형태 대비+1.5rem 여백" — 코드 조건 충족 확인까지) | 브라우저/실기기 환경 없음 |
| 2 | 스크린리더 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 지마켓산스 폰트 페어링 (7회차)

- 작성: qa-tester | 작성일: 2026-08-16
- 검증 기준: 스펙 §12(2026-08-16 4차), 구현 §11
- 범위: `globals.css`(@font-face 2·`--font-display`·`@source not` 2), HeroPanel/SiteHeader/DateBadge/PostList 클래스, `public/fonts/gmarket/`(자산 3), `scripts/build-gmarket-fonts.py/.sh`
- 검증 방법: 배분표 grep 전수 + 실빌드 HTML(모드 1·2 — urgent 임시 파일 라운드트립·클린 복원 실측) + 실서빙 curl + **폰트 파일 바이너리 시그니처 실측** + 빌드 CSS 유틸리티 회귀

## 7회차 요약: 통과 11 | 실패 1 | 미검증 2 | 스펙 확인 필요 1

### 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 폰트 자산 (변환 스크립트 결함) | `scripts/build-gmarket-fonts.py:65,75` → 산출물 `public/fonts/gmarket/GmarketSansMedium.woff2`·`GmarketSansBold.woff2` | **`.woff2` 확장자이지만 실데이터는 비압축 OTF.** 바이너리 시그니처 실측: 두 파일 모두 `OTTO`(OpenType CFF) — 정상 woff2는 `wOF2`(Pretendard 서브셋으로 대조 확인), `file` 판정도 "OpenType font data". 원인: `options.flavor = "woff2"`(65행)는 **Subsetter 옵션이라 `font.save()`(75행)가 무시** — flavor는 `TTFont.flavor` 속성 또는 `subset.save_font()` 경유로만 적용됨. 영향: ① `format("woff2")` 선언 ↔ 실데이터 불일치(콘텐츠 스니핑 없는 환경에서 로드 실패 위험) ② 전송량 낭비(브로틀리 압축 시 통상 40~60% 추가 절감 — 현 255/250KB가 스펙 예상 150~250KB 상단을 벗어난 이유) ③ 스펙 §12.3 "woff2로 변환" 미이행. 개발자 자가 검증은 크기·200 응답만 확인해 미탐지 | `font.save(str(dest))` 전에 `font.flavor = "woff2"` 설정(1줄) 또는 `subset.save_font(font, str(dest), options)` 사용 → 스크립트 재실행 → **시그니처 `wOF2` 확인** 후 재커밋(산출물 커밋 방식이므로 필수). 구현 문서의 크기 수치도 갱신 |

### 스펙 확인 필요 (frontend-designer 몫 — 스펙 내부 충돌)

| # | 내용 | 요청 |
|---|------|------|
| S1 | §11.4 "CTA 18px/**700**"·§11.5 "M/D 18px/**800**, D-n 15px/**600**" ↔ §12.2 배분표 "CTA **Medium 500**, M/D **Bold 700**, D-n **Medium 500**" — 4차 개정이 §12만 추가하고 §11 잔존 수치를 미갱신 | 구현은 최신 §12.2를 따름(타당 판단 — 실패 아님). §11.4/§11.5의 웨이트 수치를 §12.2 기준으로 갱신 요청 |

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 배분표 5곳 정확 적용 (최우선) | grep 전수: `font-display` 사용처 = 정확히 4파일 7개소 — 히어로 제목 모드 1·2(`font-bold tracking-[-0.03em]`), 헤더 로고타입(`font-bold tracking-[-0.02em]`, 상위 조직명 행 미적용), CTA(`font-medium tracking-[-0.01em]`), 배지 M/D(`font-bold tracking-[-0.01em]`)·D-n(`font-medium` 자간 0), 모바일 D-n(`font-medium` 자간 0) — §12.2 배분표와 1:1, **배분표 외 사용 0건** |
| 2 | 모드 1·2 실빌드 실측 | 모드 2(기본): 헤더 로고타입·히어로 폴백 제목 클래스 렌더 확인. 모드 1(urgent+deadline 임시 파일): 히어로 제목·CTA·배지 M/D·D-n·모바일 D-n 클래스 전부 DOM 실측 → 삭제·클린 재빌드 복원(잔존 0건) |
| 3 | Pretendard 유지 | 탭 레이블(`role="tab"` 병존 grep 0)·본문·목록 제목·방명록 폼·긴급 배지·마감 스트립·히어로 아이브로우/부문구/게시일·푸터 — `font-display` 미적용, `--font-sans` 불변 |
| 4 | 웨이트 대체 경계면 | hero 토큰 800 → `font-bold`(700) 명시 오버라이드: Gmarket 미보유 웨이트(800) 요청으로 인한 faux-bold 합성 방지. 폴백 시 Pretendard가 동일 700으로 렌더 — §12.3 "로드 실패 시 동일 웨이트의 Pretendard" 문구와 정확히 부합(모호성 없음 판단) |
| 5 | @font-face ↔ §12.3 | 빌드 CSS 실측: 2종(500/700)·`font-display:swap`·상대경로 src·`--font-display` 폴백 체인(Gmarket→Pretendard Variable→시스템) 스펙 블록과 일치. unicode-range 부재 — 스펙 §12.3에도 없음(일치). Light(300) @font-face 미선언 |
| 6 | 서빙 | Medium/Bold/LICENSE.txt 실서빙 200(260,692/255,900/4,872B), **Light 404**(미서빙 규정 §12.2 준수). 단 서빙 파일의 포맷은 실패 #1 |
| 7 | 라이선스 (§12.1) | `LICENSE.txt` 동봉(OFL 전문+출처+변환 고지) 실서빙 확인, OTF 원본 3종 `design/` 보존, name 레코드 보존 로직 스크립트 확인 |
| 8 | 외부 CDN 0건 유지 | 빌드 HTML·CSS의 http(s) URL 전수 = 온누리 콘텐츠 링크뿐. 폰트 요청 전부 셀프호스팅 상대경로 |
| 9 | `@source not` 회귀 | `_workspace`·`server` 스캔 제외 후에도 실사용 유틸리티 9종(rounded-full/bg-primary/min-h-touch/line-clamp-2/overflow-x-auto/rounded-2xl/shadow-card/font-medium/font-bold) 빌드 CSS 존재, tracking 3값 존재, 전 페이지 렌더 무변화 |
| 10 | 회귀 3종 | `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(/ ○ Static·상세 ● SSG 유지), 방명록 준비 카드 유지 |
| 11 | 기존 값 정정 확인 | PostList 모바일 D-n `font-bold`→`font-medium` — 6회차 개발자 해석 #5의 임의값이 §12.2 스펙 값으로 정정됨 |

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실브라우저 렌더 (지마켓산스 적용 품질, OTF 데이터의 실렌더 여부 — 실패 #1과 연동, Pretendard 폴백 스왑 시 레이아웃 이동) | 브라우저 환경 없음. 실패 #1 수정 후 재확인 권장 |
| 2 | 스크린리더 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 디자인 v2 모던 전면 개편 + Pretendard (6회차)

- 작성: qa-tester | 작성일: 2026-08-16
- **검증 기준 시점**: 스펙 §1(v2 토큰 통합)·§2(채택 21+v2 5조합)·§11(2026-08-16 3차 신설)·§3.2(히어로 대체 주석)·구현 §10 — frontend-designer가 해석 지점 7건을 병렬 판정 중이므로 판정 결과에 따라 본 회차 해당 항목 재대조 필요
- 범위: 신규 HeroPanel/DeadlineStrip/DateBadge/sync-pretendard.mjs, 수정 11(globals.css·layout·page·PostList·BoardTabs·OnnuriGuideCard·GuestbookPanel·SiteFooter·content.ts·date.ts·package.json), 제거 UrgentBanner
- 검증 방법: 스펙 값 대조 + 대비 스크립트 재실측 + 금지 사항 grep 전수 + **히어로 양 모드 실빌드**(urgent+deadline 임시 파일 라운드트립 — 삭제·클린 복원 실측) + **D-n 경계값 실행 테스트**(고정 now 주입) + 폰트 실서빙 curl + tsc/lint/build

## 6회차 요약: 통과 13 | 실패 1 | 미검증 4

### 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| 1 | 디자인 값 (경미) | `src/components/layout/SiteFooter.tsx:19` (`rounded-badge` = 12px) ↔ 스펙 §10.3 "흰색 칩 radius `8px`" · §11.6 "로고 흰 칩은 **그대로** — 칩 보더는 제거" | v2 변경 규정은 보더 제거뿐인데 칩 radius가 8px→12px로 무규정 변경됨. 구현 문서 §10에도 radius 변경 언급 없음(조용한 이탈) | `rounded-badge`→`rounded-lg`(8px) 복원. 또는 v2 radius 체계 통일 의도라면 frontend-designer 판정(마침 병렬 판정 중 — 판정 목록에 추가 요청) 후 스펙 §10.3 개정으로 정합화 |

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 토큰 v2 (최우선) | 기존 15색 **값 변경 0건** 재확인(grep 15건 전부 5회차 값 유지) + v2 추가분(색 2·`--font-sans`·hero/hero-lg 자간 내장·tracking·radius 12/24/32·shadow 2) 스펙 §1과 값 일치. 빌드 CSS에 v2 토큰 전부 존재. display/h1/h2 자간은 토큰 모디파이어로 내장(구현 방식 차이, 값 동일 — 개발자 해석 #1) |
| 2 | 대비 재실측 | v2 채택 #22~#26(9.23/9.23/14.13/3.89/3.89) + 제한 3조합(#9c0d14·#d0101b·#4b5563 on soft = 6.87/4.52/6.14 미달 확인) 스크립트 재실행 — 스펙 §2 수치 완전 일치. 기존 조합은 값 무변경으로 1~5회차 실측 유효 |
| 3 | 히어로 모드 2 (폴백, 현재 기본) | 실빌드: 지정 문구 3종("전국금융산업노동조합"/"코스콤지부"/"코스콤 조합원을 위한 공식 소식 공간") **문자 단위 일치**, CTA·배지·스트립 부재, `aria-label="주요 소식"`·제목 h2·hero 스케일/색 스펙 일치 |
| 4 | 히어로 모드 1 (urgent 바인딩) | urgent 임시 파일 실빌드: 배지+게시일(primary-soft #23) → hero h2 제목(`line-clamp-3`) → 흰 액센트 바 4rem×4px(aria-hidden) → "자세히 보기" 필 CTA(`min-h-touch`·상세 href·hover `bg-primary-soft`·흰 포커스 링) — §11.4 구성 순서·값 전부 실측. 폴백 문구 부재 확인. 장식 원형 primary-bright aria-hidden·pointer-events-none·코너 밖 배치 |
| 5 | 마감 스트립 | 실빌드: D-4 항목 red 칩(`bg-urgent-strong`+흰 텍스트+**"D-4" 텍스트 병행** — 색 단독 아님)·D-45 기본형(#093389 on soft), M/D 표기(8/20·9/30 — 선행 0 없음), `nav aria-label="마감 예정 일정"`, `overflow-x-auto`(ul 내부 스크롤), 항목 `min-h-touch`·상세 링크, 구분선 aria-hidden. 0건 시 미렌더(모드 2 빌드에서 부재 실측) |
| 6 | 날짜 배지 | 56×56(`size-14`)·radius 12px·"M/D" 18px/800·"D-n" 15px/600·3변형 클래스, md+ 전용(`hidden md:flex`)·모바일 제목행 D-n 텍스트(default `text-primary` 11.37/임박 `text-urgent-strong` 8.46 — 흰 카드 위). **#2e7df7 밝은 블루 배지 미도입** 확인 |
| 7 | D-n 로직 (경계값 실행) | `daysUntilKst` 고정 now 주입 테스트: 오늘 마감 D-0 — KST 밤·**KST 자정 직후(UTC로는 전날)** 모두 0(타임존 오차 없음), 내일 1, 지난 마감 -1(로더 `days >= 0` 필터로 스트립·배지 미표시), D-7/D-8 임박 경계, 잘못된 입력 null. `getUpcomingDeadlinePosts` 마감 오름차순 정렬 코드 확인 |
| 8 | 금지 사항 감사 (grep 전수) | 레퍼런스 홍보물 문구·일정: 소스·content·빌드 HTML 잔존 **0건**(소스 내 "투쟁" 1건은 복사 금지 규정을 안내하는 주석 — 렌더 출력 0). `text-stroke` 0건, 원형 아이콘 사이드바 미도입, `primary-bright`(#2e7df7) 사용처 = 히어로 장식 원형 1곳뿐(텍스트 조합 0), soft 배경 위 빨강 텍스트 조합 0건, **UrgentBanner 파일 삭제·참조 0건**·`aria-label="긴급 공지"` DOM 부재 |
| 9 | 폰트 (셀프호스팅) | 빌드 HTML의 http(s) URL 전수 = onnuri 외부 링크뿐(CDN 0건), 빌드 CSS `url()` 외부 0건, 폰트 CSS src 전부 상대경로(http 2건은 라이선스 주석). **실서빙**: CSS 200(55.8KB)·woff2 서브셋 200(34.6KB), `font-display: swap` 92건, `--font-sans` 폴백 스택 정의·빌드 CSS 반영, head에 stylesheet 링크(precedence). `sync-pretendard.mjs` postinstall 코드 확인(node_modules→public 복사) |
| 10 | 카드화·필형 (§11.6) | PostList: 흰 카드 radius 16px(`rounded-2xl`)+`shadow-card`(hover 변형)+패딩 1rem/1.25rem+gap 0.75rem, divide 제거, urgent 좌보더·내향 포커스 유지. 탭: 컨테이너·탭 `rounded-full`만 변경(크기·상태·색·로빙 탭인덱스·키보드 코드 불변 diff 확인). 온누리: `rounded-card`+`shadow-card`, accent 불변. 방명록: 필드 12px·버튼 full·준비 카드 24px(로직 무변경 — 클래스만 diff 확인). 푸터: 딥블루 밴드(`bg-primary`·상단 보더 제거·지부명 흰/700·저작권 primary-soft #23) |
| 11 | 접근성 회귀 | h 레벨: h1×1(헤더)→h2×2(히어로·방명록 카드) 건너뜀 없음(폴백 h2 "코스콤지부"의 h1 중복은 §11.4 명시 허용). 탭 ARIA 실측 유지(true×1/false×2). CTA 접근성 이름 "자세히 보기"(화살표 아이콘 aria-hidden)·스트립 항목 이름에 D-n+날짜+제목. 터치: CTA·스트립 항목 `min-h-touch` |
| 12 | 간격 (§11.4·§9.1) | 헤더↓히어로 1.5rem(`mt-6`), 히어로↓스트립 0.75rem(`mt-3`), ↓온누리 카드 2rem(`mt-8`), 카드↓탭 2rem(`mt-8`) — 스펙 값 일치 |
| 13 | 빌드·복원 | `npx tsc --noEmit` 0·`npm run lint` 0(no-css-tags 라인 예외는 사유 주석 확인)·`npm run build` 통과(/ ○ Static·상세 ● SSG 유지). 임시 파일 2건 삭제·클린 재빌드·모드 2 복귀 실측(content/ .gitkeep만) |

### 비고

- `src/components/notice/` 빈 디렉토리 잔존(UrgentBanner 삭제 후) — 기능 영향 없음, 정리 권고.
- 개발자 해석 7건(자간 구현 방식·D-n 정적 한계·구분선 색·배지 D-n 채택·모바일 D-n 색·지난 마감 미표시·모드 2 액센트 바 미포함)은 코드가 문서 기재와 일치함을 확인 — frontend-designer 판정 대기 항목으로 유지. 특히 **해석 #2(D-n은 빌드 시점 고정 — 일일 재빌드 없으면 날짜 경과 시 D-n·스트립이 갱신되지 않음)는 운영 정책 결정 필요(리더)**.

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실브라우저 폰트 렌더 품질 (Pretendard 적용 시각 확인, 폴백 전환) | 브라우저 환경 없음 — 서빙·선언·스택은 실측 완료 |
| 2 | 375px 히어로 타이포(40px) 줄바꿈·말줄임 실측, 마감 스트립 가로 스크롤 실조작 | 실뷰포트 환경 없음 |
| 3 | 방명록 실통신 회귀 | 이번 변경이 radius 클래스뿐(로직 diff 무변경 확인)이라 4회차 실통신 결과 유효 — 재실행은 생략 (통신 계약 재검증 아님을 명시) |
| 4 | 스크린리더 실낭독 (기존 회차와 동일) | 환경 제약 |

---

# QA 리포트: 실제 CI(금융노조+코스콤) 반영 (5회차)

- 작성: qa-tester | 작성일: 2026-08-16
- **검증 기준 시점**: `_workspace/02_designer_spec.md` §1(색상 15종)·§2(채택 21조합)·§9.2(accent 개정)·§10(2026-08-16 2차 신설) — frontend-designer가 병렬로 스펙 확인 중이므로 이후 개정 시 본 회차 대조는 재실행 필요
- 범위: `globals.css` 토큰 교체, `OnnuriGuideCard.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `public/brand/` 자산 2종 + 토큰 교체 파급 전 사용처
- 검증 방법: 토큰 값 대조 + 대비 스크립트 전 조합 재실측 + grep 전수 감사 + **자산 픽셀 재생성 대조**(Pillow — 스펙 크롭 좌표로 원본에서 재생성 후 배포 자산과 픽셀 비교) + 실빌드 HTML/CSS 실측

## 5회차 요약: 통과 10 | 실패 0 | 미검증 3

### 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 토큰 값 교차 | `globals.css` ↔ 스펙 §1 개정: 15색 전부 값 일치 (교체 4: primary·primary-strong=#093389 동일값, urgent=#d0101b, urgent-strong=#9c0d14 / 신설 3: accent 계열 / 유지 8). 토큰명 전부 유지. 빌드 CSS 실측: 신 팔레트 6값 존재(#093389 ×2 = primary+strong), **구 팔레트 4값(#1d4ed8/#1e40af/#b91c1c/#991b1b) 잔존 0건** (src·빌드 CSS 양쪽) |
| 2 | 대비 재실측 (최우선) | 채택 21조합 전부 + 제한 조합(#ec6d1e/#fdf0e7) `check-contrast.mjs` 재실행 — **스펙 §2 수치와 22조합 전부 일치**. 텍스트 조합 전부 AAA(최저 7.23), UI 전용 조합 3:1 이상(#d0101b 5.57/5.09, #ec6d1e/#ffffff 3.10 — 스펙 표기대로 "여유 없음", #ec6d1e/#fdf0e7 2.78은 UI 불가 → 장식 전용 분류와 일치) |
| 3 | 토큰 교체 파급 (클래스 무변경 사용처) | 사용처별 신 값 조합을 §2 채택표와 대조: 탭 선택 `#fff/#093389`(#11)·hover `#093389/#eff6ff`(#10)·비선택(#7, 무변경), 긴급 배너 제목(#3)·게시일/아이콘 `#9c0d14/#fef2f2`(#13)·배지 `#fff/#9c0d14`(#14), urgent 목록 보더 `#d0101b`(#15), 본문 링크·상세 뒤로가기·방명록 버튼 `#093389`(#8·#11), 방명록 에러 텍스트 `#9c0d14/#fff`(#12), 포커스 링 primary(#8·#9)·배너 내 urgent-strong(#13) — 전부 채택 조합에 존재 |
| 4 | 원색 용법 감사 (grep 전수) | `#ec6d1e`(accent 원색): src 전체에서 accent 계열 사용 파일은 `OnnuriGuideCard.tsx` 1개뿐, 원색 클래스는 `border-accent`(좌측 장식 보더) 1곳. `text-accent`·`bg-accent` 단독 사용 0건 (텍스트·아이콘은 전부 `accent-strong`). `#5a5657` 토큰 미도입(스펙대로 로고 이미지 전용). tsx 내 hex는 주석뿐(코드 값 0건) |
| 5 | 가이드 카드 §9.2 개정 반영 | `bg-accent-tint`·`border-accent`(장식 전용 — 의미는 아이콘+문구+배경이 전달, 스펙 개정 문구와 코드 주석 일치)·제목/아이콘/hover 아웃라인 `accent-strong`·**포커스 링만 primary 유지**(키보드 일관성 — §10.4 지정) — 빌드 HTML 실측 |
| 6 | 로고 자산 (픽셀 검증) | `kfiu-mark.png` 247×192 PNG·`koscom-logo.png` 387×96 PNG — 표시 크기(48/24px)의 4배 레티나 스펙 일치. **크롭 좌표 재생성 대조: §10.3 좌표 (1030,820,2560,1200)→1530×380 크롭·LANCZOS 리샘플을 원본에서 재실행 → 배포 자산과 평균 채널 오차 0.0(픽셀 동일)**, kfiu도 무크롭 리샘플과 오차 0.0. koscom 4변 2px 경계 순백(255) 확인. 자산 내 색 최빈값 실측: 오렌지 `#ec6d1e`·파랑 `#093389` — 토큰 값과 정확 일치 |
| 7 | 헤더 마크 렌더 | 빌드 HTML: `<img alt="" aria-hidden="true">` + `priority` 반영(preload 링크 존재·`loading="lazy"` 없음). 헤더 링크 접근성 이름 = 지부명 텍스트만("전국금융산업노동조합 코스콤지부"). 헤더 배경 `bg-bg`(#ffffff) — 흰 배경 자산 배치 규정 충족. 높이 `h-10 md:h-12`(40/48px), gap 0.75rem — §3.1/§10.3 일치 |
| 8 | 푸터 칩 렌더 | 흰 칩 `bg-bg`(토큰, 하드코딩 아님)·radius 8px·패딩 8×12px(`px-3 py-2`)·`border-soft` 장식 보더, 로고 2종 각 24px(`h-6`)·gap 1rem·링크 아님·유의미 alt("전국금융산업노동조합"/"코스콤") 각 1건 — 빌드 HTML 실측, §10.3 일치. 코스콤 로고는 푸터 한정(헤더 미사용 grep 확인) |
| 9 | 회귀 | 탭 ARIA 상태·방명록 준비 중 카드·상세 라우트 ● SSG 유지, 온누리 카드 포커스 링 primary 유지. `npx tsc --noEmit` 0·`npm run lint` 0·`npm run build` 통과(○ Static 유지) |
| 10 | 375px 헤더 (코드 기준 산정) | 마크 폭 ≈52px(40×247/192) + gap 12px + 최장 텍스트행 "전국금융산업노동조합"(15px) ≈150px → 합계 ≈214px < 가용 343px(375−패딩 32) — 줄바꿈 없음 판단. 레티나: 표시 최대 48/24px 대비 자산 192/96px(4배)·srcSet 2x 제공 — 선명도 요건 충족 판단 (실기기 육안은 미검증 #1) |

### 비고

- `priority`는 HTML에서 `fetchpriority` 속성 대신 `<link rel="preload" as="image">` + eager 로딩으로 반영됨 (Next.js 렌더 방식 — 의도 충족, 이슈 아님).
- 스펙 §2 #19(#ec6d1e/#ffffff 3.10:1)는 "여유 없음" 명기 — CI 원색이므로 수용된 트레이드오프이며 장식 보더 전용으로 제한된 상태. 공식 CI 원색 특성상 조정 불가 항목.

### 미검증

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실기기/실뷰포트 육안 확인 (375px 헤더 줄바꿈, 레티나 로고 선명도, JPG 유래 자산의 흰 배경 경계 자연스러움) | 브라우저/실기기 환경 없음 — 코드·자산 크기 기준 산정까지 수행 |
| 2 | 스크린리더 실낭독 (헤더 장식 마크 무시·푸터 로고 alt 낭독) | 환경 제약 (기존 회차와 동일) |
| 3 | 브라우저 실조작 (신 팔레트에서의 hover/focus 시각 상태) | 환경 제약 — 대비 수치 실측으로 대체 |

---

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

---

# QA 리포트: footer 관리자(/admin) 진입 링크 (14회차)

- 작성: qa-tester | 작성일: 2026-08-18
- 검증 대상: `src/components/layout/SiteFooter.tsx` 미커밋 변경분 (`git diff` 기준, 추가 12줄 / 삭제 3줄)
- 판정 기준: `union-qa-testing` 스킬 §2 교차 비교표 · §3 접근성 · §4 빌드, `union-design-system` §0.3(양보하지 않는 선) · §0.4(은폐 금지 패턴표)
- 검증 환경: 로컬 프로덕션 빌드(`npx next start -p 3111`) + Playwright MCP 실브라우저. **프로덕션 무접촉, 프로덕션 코드 수정 0건**
- 검증 방법: ① `git diff` 로 변경 범위 확정 ② 라우팅 경계면 교차 비교(`ROUTES.admin` ↔ `src/app/admin/page.tsx`) ③ 디자인 토큰 4종 정의처 대조 ④ 포커스 관례를 리포지토리 전체 grep 으로 대조 ⑤ `npm run build` → `npx tsc --noEmit` → `npm run lint` 순차 실행 ⑥ 360/768/1280px 실뷰포트 `getBoundingClientRect` 정량 측정 ⑦ 실제 Tab 키 입력 후 `:focus-visible` 매칭·계산 스타일 확인 ⑧ 실클릭 내비게이션 ⑨ 대비 스크립트 실행 ⑩ SSR HTML 전 페이지 링크 존재 확인 ⑪ 스크린샷 2장

## 요약: 통과 14 | 실패 0 | 미검증 3 | 권고 3

**판정: 통과 (수정 요청 없음).** 실패 항목 0건이다. 아래 권고 3건은 전부 이번 변경이 만든 결함이 아니라 리포지토리 기존 관례와 동일한 성질이므로, 반영 여부는 리더·디자이너 판단 사항이다.

## 실패 항목

없음.

## 통과 항목

| # | 분류 | 확인 내용 |
|---|------|----------|
| 1 | 라우팅 경계면 (교차 비교) | 생산자 `src/lib/routes.ts:70` `admin: "/admin"` ↔ 소비자 `SiteFooter.tsx:48` `href={ROUTES.admin}` ↔ 실존 경로 `src/app/admin/page.tsx`. route group 없음, 3자 일치. 빌드 라우트 표에도 `○ /admin` 프리렌더로 등재 |
| 2 | 라우트 상수 규약 준수 | 경로 문자열 하드코딩 없이 `ROUTES` 상수 경유 (`union-webapp-dev` §4) |
| 3 | 디자인 토큰 (교차 비교) | 사용된 4개 토큰이 전부 `src/app/globals.css` 정의처와 일치 — `text-primary-soft`↔`--color-primary-soft:#d9e9ff`(38행), `text-caption`↔`--text-caption:0.9375rem`(85행), `min-h-touch`↔`--spacing-touch:2.75rem`(104행), `ease-out-soft`↔`--ease-out-soft`(101행). 스펙에 없는 임의 색·크기 0건 |
| 4 | 색상 대비 (스크립트 실측) | `check-contrast.mjs` 실행 — 기본 `#d9e9ff:#093389` = **9.23:1**, hover `#ffffff:#093389` = **11.37:1**. 둘 다 AAA 통과. 개발자 보고 수치와 일치. **§0.4 저대비 금지 준수** — 링크를 눈에 덜 띄게 하려고 대비를 낮춘 흔적 없음 |
| 5 | 포커스 링 관례 (코드 대조) | `focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2` — 딥블루 면 위 요소인 `HeroPanel.tsx:48`·`:72`와 완전 동일. 밝은 면 관례(`outline-primary`)와 혼용하지 않음 |
| 6 | 포커스 링 실측 (브라우저) | 실제 Tab 키 입력으로 도달 확인. `:focus-visible` 매칭 true, 계산 스타일 `outline: 3px solid rgb(255,255,255)`, `outline-offset: 2px`. 스크린샷에서 딥블루 배경 위 흰 링 육안 확인 (`footer-focus-1280.png`) |
| 7 | 링크 인지 가능성 (색맹) | `text-decoration-line: underline`, `text-underline-offset: 4px` 계산값 실측. 색 정보 없이도 형태로 링크 식별 가능 — 저작권 문단과 색이 같은 설계의 필수 보완책이 실제 적용됨 |
| 8 | 터치 대상 높이 | 계산 `min-height: 44px`, 실측 높이 3뷰포트 전부 44px |
| 9 | 반응형 360px (실측) | 저작권이 2줄로 감싸진 뒤 링크가 **아랫줄 좌측으로 자연 이동**. 겹침 0(저작권 bottom 2383 / 링크 top 2383, 링크는 44px 박스 내 세로 중앙이라 텍스트 간 여백 확보), `documentElement.scrollWidth` 345 < 360 — **가로 스크롤·삐져나옴 없음** |
| 10 | 반응형 768px (실측) | 같은 행 좌우 정렬, 두 요소 세로 중심 일치, 사이 간격 308px, 가로 스크롤 없음 |
| 11 | 반응형 1280px (실측) | 같은 행, 세로 중심 차이 **0px**, 링크 우측 끝 1081px = `max-w-page` 컨테이너 우측 경계 정렬. 가로 스크롤 없음 |
| 12 | 내비게이션 동작 (실클릭) | 푸터 링크 클릭 → URL `/admin`, `<title>` "관리자 — …", `<h1>` "관리자" 도달 확인 |
| 13 | 은폐 금지 (§0.4) | `hidden`·조건부 렌더·등장 애니메이션 없음. `curl` 로 `/`·`/bargaining-2026`·`/admin` **SSR HTML 3종 전부에서 `href="/admin"` 확인** — JS 없이도 링크가 존재 |
| 14 | 회귀 (기존 푸터 콘텐츠) | 지부명 `전국금융산업노동조합 코스콤(한국증권전산)지부`, 저작권 `© 2026 …`, 로고 2종 alt(`전국금융산업노동조합`/`코스콤`) 및 src 전부 변경 0. 저작권 `<p>` 는 클래스에서 `mt-5` 만 래퍼 `<div>` 로 이동했을 뿐 문구·색 토큰 동일 → 시각 결과 불변. 푸터 내 링크는 변경 전 0개였으므로 기존 링크 훼손 없음 |
| 15 | 시맨틱 마크업 | 이동이므로 `<button>` 이 아닌 `<a>`(`next/link`) 사용. `footer` landmark 내부, `div onClick` 0건 |
| 16 | 빌드 파이프라인 | 지시된 순서대로 `npm run build` **통과**(TypeScript 단계 포함, `/admin` 정적 프리렌더 유지) → `npx tsc --noEmit` **종료코드 0**(개발자 노트의 `.next/types` 미생성 이슈는 build 선행으로 발생하지 않음) → `npm run lint` **오류 0** |
| 17 | 타입 우회 탐지 | `as any`·`@ts-ignore`·`@ts-expect-error` 리포지토리 전체 0건 (`src/lib/api/admin.ts:124` 의 `as unknown` 은 기존 코드의 의도된 미검증 응답 표기로 이번 변경 무관) |

## 권고 항목 (실패 아님 — 리더·디자이너 판단)

| # | 위치 | 내용 | 근거 / 제안 |
|---|------|------|------------|
| R1 | `SiteFooter.tsx:49` | 터치 대상 **폭 39px** (높이는 44px 충족). `min-h-touch` 만 지정돼 폭은 텍스트 폭("관리자" 3자 × 15px)에 종속 | 스킬 §3 의 44×44 기준으로는 폭 미달. 다만 `PostArticle.tsx:71`·`:177` 등 **기존 텍스트 링크가 전부 같은 패턴**이라 이번 변경이 만든 회귀는 아니며, WCAG 2.5.8 의 인라인 링크 예외에도 해당한다. 폭을 채우려면 `px-2` 등을 더해야 하는데 그 경우 밑줄 폭과 클릭 영역이 어긋나 보일 수 있으므로, **현행 유지를 권한다** |
| R2 | `src/app/admin/page.tsx:31` | `/admin` 페이지의 푸터에도 "관리자" 링크가 렌더돼 **자기 자신을 가리킨다**(self-link). `aria-current="page"` 없음 | 기능 결함은 아니나 스크린리더 사용자에게 현재 위치가 안내되지 않는다. 개선 시 `SiteFooter` 에서 `usePathname()` 비교가 필요한데 이는 서버 컴포넌트를 클라이언트로 전환시키므로, **비용 대비 효용이 낮아 현행 유지를 권한다** |
| R3 | `SiteFooter.tsx:43` | `gap-x-6` 만 지정돼 **줄바꿈 시 세로 간격(gap-y)이 0** | 360px 실측에서는 링크의 44px 박스가 여백을 대신해 시각적 문제가 없음을 확인했다. 다만 향후 링크가 추가돼 여러 줄로 감싸질 경우를 대비하려면 `gap-y-1` 정도가 안전하다. 현재로선 선택 사항 |

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | `/admin` 도달 후 **로그인 폼 실제 렌더** | 로컬에 `NEXT_PUBLIC_API_BASE_URL` 미설정이라 페이지가 "API 미연결" 안내에서 멈춘다. **링크의 도달 책임(URL·타이틀·h1)은 통과 #12 로 확인**했고, 그 이후는 이번 변경 범위 밖의 기존 admin 기능이다 |
| 2 | 스크린리더 실낭독 (링크 역할·밑줄 인지) | 보조기기 실행 환경 없음 |
| 3 | 실기기 터치 조작 (모바일 실단말) | 실기기 없음 — 뷰포트 에뮬레이션 정량 측정까지만 수행 |

## 비고

- 검증 중 생성한 스크린샷 2장(`footer-focus-1280.png`, `footer-360.png`)과 Playwright 스냅샷 디렉터리는 검증 후 **리포지토리에서 삭제**했다. 로컬 서버(포트 3111)도 종료했다.
- 이번 변경으로 `_workspace/03_developer_impl.md` 도 함께 수정됐으나(개발자 기록), 문서이므로 QA 대상에서 제외했다.

---

# QA 리포트: `/bargaining-2026` 카운트다운 달력 (15회차)

**검증일** 2026-08-18 (시스템 KST 실시각 기준) · **검증자** qa-calendar
**대상** 미커밋 변경분 — `src/components/bargaining/StruggleCalendar.tsx`(신규) · `src/lib/date.ts`(유틸 4개 추가) · `src/app/bargaining-2026/page.tsx`(3곳 수정)
**판정 기준** 디자인 스펙 §18(특히 §18.12 QA 수용 체크리스트) · `union-design-system` §0.3/§0.4 · `union-qa-testing`
**개발자 보고서** `03_developer_impl.md` §19 — **주장을 신뢰하지 않고 전 항목을 독립 재현했다.**

## 요약: 통과 34 | 실패 0 | 미검증 4 | 권고 5

§18.12 수용 체크리스트 9항목 **전건 통과**. 조합원에게 나가는 날짜·문구에 오류 없음.
다만 **디자인 스펙 §18.6.1·§18.8.3 의 폭 여유 수치가 실측과 어긋난다** — 현 데이터에서는 문제가
발현하지 않으므로 실패가 아닌 **권고(디자이너 몫)** 로 분류했다. 자세한 근거는 P1·P2 참조.

---

## 실패 항목

**없음.**

---

## 권고 항목 (실패 아님 — P1·P2 는 디자이너 판단 필요)

| # | 분류 | 위치 | 내용 | 근거 / 제안 |
|---|------|------|------|------------|
| **P1** | 스펙 수치 오류 | `02_designer_spec.md` §18.6.1 표 | 360px 셀(39.42px)에서 `D-10` 라벨의 **실측 폭은 36.98px**, 여유 **2.44px**다. 스펙은 31.8px / 여유 7.6px 로 적었다 — **추정치가 실측보다 5.2px(16%) 작다** | 잘리지 않으므로 **체크리스트 #3 은 통과**다. 그러나 스펙이 근거로 삼은 안전 여유가 실제로는 1/3 수준임을 기록해야 한다. Gmarket Sans 실측: `D-17` 35.56px, `오늘` 28.87px, `9/1` 28.16px |
| **P2** | 스펙 수치 오류 | `02_designer_spec.md` §18.6.1 (`최대 D-41(2자리)`) | "2자리 D-n 은 구조적으로 안전"이 **거짓**이다. 360px 실측에서 **`D-20`~`D-40` 중 18개 값이 39.42px 셀을 초과**(최대 `D-40` = 40.91px)하고, 초과 시 `D-` / `20` 으로 **2줄 줄바꿈**된다(라벨 높이 22.5px→45px). 잘림·데이터 손실은 없다 | **현 데이터로는 발현 불가** — 라벨 최대값이 `D-17`(9/4)·`D-10`(8/28)이고 날이 갈수록 줄어든다. 리더가 3주 이상 뒤의 일정을 `SCHEDULE` 에 추가하면 즉시 발현한다. 스펙의 안전 상한을 **D-19** 로 정정하거나, 라벨에 `whitespace-nowrap` 을 추가할 것을 권한다 |
| **P3** | 스펙 수치 오류 | `02_designer_spec.md` §18.8.3 (`확대 200%`) | "라벨 폭 여유가 7.6px 이상이므로 **텍스트 확대 시에도 넘치지 않는다**"는 실측과 다르다. 루트 폰트 2배(텍스트 전용 200%) · 360px 에서 셀 폭은 25.28px 로 유지되는 반면 숫자·라벨은 2배가 되어 **최대 15.52px 셀 밖으로 넘친다**(`9/1`) | **접근성 실패는 아니다**: `overflow:visible` 이라 잘림·데이터 손실 0 이고, 브라우저 전체 확대 200%(1280→640px 상당)에서는 셀 77.28px·라벨 여유 40px 이상으로 **완전 통과**한다. WCAG 1.4.4 는 전체 확대로 충족된다. 스펙 문언에서 "텍스트 확대 시에도"를 삭제하거나 조건을 명시할 것을 권한다 |
| **P4** | 시각 | `StruggleCalendar.tsx:172` (`outline-white`) | 중첩 셀(오늘 == 일정일)의 **2px 흰 내향 아웃라인이 360px 실치수에서 눈에 잘 띄지 않는다.** 스크린샷 실측 결과 존재는 식별 가능하나 매우 가늘다 | **정보 손실 0** — 같은 셀에 `오늘` 텍스트 라벨과 sr-only `…, 오늘` 이 병행되므로 §0.4·색 단독 전달 금지 모두 준수한다. 굵기 상향(`outline-[3px]`)은 §16.4 스케일 밖이라 디자이너 판단 대상 |
| **P5** | 방어 코드 | `StruggleCalendar.tsx:105`, `date.ts:129` | `todayIsoKst` 는 무효 `now` 에 `""` 를 반환하지만, 호출부는 그 `""` 로 `start`/`end` 를 만들고 `weeks[0].map(...)`(:150)에 도달해 **`TypeError` 로 크래시**한다. 가드가 실제로 보호하지 못한다 | **프로덕션 도달 불가**(호출부가 `now` 를 넘기지 않음, `page.tsx:126`). 테스트·프리뷰에서만 노출된다. `if (weeks.length === 0) return null;` 한 줄로 가드가 완결된다 |

---

## 통과 항목 (34)

### A. §18.12 QA 수용 체크리스트 — 9/9 전건 통과

| # | 항목 | 검증 방법 | 결과 |
|---|------|----------|------|
| 1 | 8/28·9/4 셀 면 색이 서로 다르다 | SSR HTML 클래스 실측 | 8/28 `bg-primary`(#093389) / 9/4 `bg-urgent-strong`(#9c0d14) — 다름 ✓ |
| 2 | 지난 날짜가 회색이 아니다(빈 칸) | SSR HTML 파싱 | 8/16·8/17 = `<td class="p-0.5 md:p-1"></td>`, 내용 완전 공백(`&nbsp;` 0) ✓ |
| 3 | 360px 가로 스크롤 0 · `D-10` 미절단 | Chromium 실브라우저 실측 | `scrollWidth 360 = clientWidth 360`(초과 0px). `D-10` 36.98px < 셀 39.42px, `overflowsCell: false` ✓ (여유는 P1 참조) |
| 4 | `role="grid"` 없음 · `<table>`+`<caption>`+`<th scope="col">` | DOM 실측 | `table.getAttribute('role') === null`, caption 1개, `th scope` = `["col"×7]` ✓ |
| 5 | 포커스 가능 요소 0개 | DOM 쿼리 (`a,button,input,select,textarea,[tabindex],[contenteditable]`) | 달력 내부 **0개**. 페이지 전체 포커스 요소 3개 중 달력 소속 인덱스 없음 → 탭 순서 변화 0 ✓ |
| 6 | 상세 카드 `meta`·`detail` 텍스트 유지 | SSR HTML | `서울 여의도 · 저녁` / `종일` / `총파업 D-7 집회입니다.` / `집결 장소와 시간은 지부 공지로 별도 안내합니다.` 전부 원문 그대로 ✓ |
| 7 | `now=2026-08-29` → 8/28 칸 소멸 | `now` 주입 SSR 재현 | 격자 3행→**2행**, 범위 `8월 23일 – 9월 5일`, 8/28 은 빈 칸(특수 셀 목록에서 소멸) ✓ |
| 8 | `now=2026-09-05` → 달력 미렌더 | `now` 주입 SSR 재현 | `<table>` **0개**, 헤드라인 0개, 안내 문구 생성 0. 카드만 잔존 ✓ |
| 9 | 9/4 셀 SR 낭독 `9월 4일 총파업, D-17` | SSR HTML sr-only 추출 | `<span class="sr-only">9월 4일 총파업, D-17</span>` 존재. 숫자 `4` 는 `aria-hidden="true"` ✓ (실낭독은 미검증 #2) |

### B. 날짜 정합성 — 3중 교차 비교 (이 페이지 최악 결함 영역)

| 값 | `_workspace/00_input` 원문 | `SCHEDULE`(page.tsx:47·55) | 달력 렌더 결과 | 판정 |
|----|---------------------------|---------------------------|---------------|------|
| 결의대회 | `8/28(금) 총력투쟁 결의대회(여의도) - 저녁` | `2026-08-28` / `총력투쟁 결의대회` / `서울 여의도 · 저녁` | 8/28, **금요일 열**, `D-10` | 일치 ✓ |
| 총파업 | `9/4(금) 총파업 - 종일` | `2026-09-04` / `총파업` / `종일` | 9/4, **금요일 열**, `D-17` | 일치 ✓ |

- **요일 독립 검산**: `Intl` 로 재계산 — 2026-08-28 = 금요일, 2026-09-04 = 금요일, 2026-08-18 = 화요일, 2026-09-01 = 화요일. 격자 배치와 전건 일치 ✓
- **원문 오기 미재현 확인 ★**: `00_input/content-bargaining-2026.md:92-95` 는 원본 PDF 캘린더가 `28` 을 **화요일 칸**에 잘못 배치했음을 경고하고 "이 오기를 재현하지 마라"고 명시한다. 렌더 결과 8/28 은 **금요일 열(6번째)**, 화요일 열에는 `25` 가 정상 배치됐다. 격자를 원문에서 옮겨 적지 않고 `Date.UTC` 산술로 생성하므로 **구조적으로 재현 불가** ✓
- **D-n 산출 검산**: 8/18 기준 8/28 = D-10, 9/4 = D-17. 8/28 시점에 9/4 = **D-7** — 원문의 `총파업 D-7` 문구와 일치 ✓
- **단일 출처 확인**: 달력은 `SCHEDULE` 배열을 그대로 props 로 받는다(`page.tsx:126`). 달력 전용 날짜 상수 **0개** — 두 벌 관리로 인한 불일치 위험 없음 ✓

### C. 상태 전이 5시점 — 전건 독립 재현

임시 라우트 `src/app/qa-cal-tmp` 에 `now={new Date("YYYY-MM-DDT00:00:00+09:00")}` 를 주입해
프로덕션 빌드 SSR HTML 을 생성·파싱했다. 개발자 §19 표와 **전건 일치**한다.

| now | 달력 | 헤드라인 | 격자 | 특수 셀 |
|-----|------|----------|------|---------|
| 2026-08-18 | 렌더 | `9월 4일 총파업` / **`D-17`** | **3행** `8월 16일 – 9월 5일` | 8/18 today(outline-primary) · 8/28 major · 9/4 peak · 9/1 `9/1` 표기 |
| 2026-08-28 (상태 B) | 렌더 | `9월 4일 총파업` / `D-7` | 2행 `8월 23일 – 9월 5일` | 8/28 = `bg-primary` + **`outline-white`** + 라벨 `오늘`, sr-only `8월 28일 총력투쟁 결의대회, 오늘` |
| 2026-08-29 (상태 C) | 렌더 | `9월 4일 총파업` / `D-6` | **2행으로 축소** | **8/28 칸 소멸**(빈 칸), 8/29 today |
| 2026-09-04 (상태 D) | 렌더 | `9월 4일 총파업` / **`오늘`** | **1행** `8월 30일 – 9월 5일` | 9/4 = `bg-urgent-strong` + `outline-white` + 라벨 `오늘` |
| 2026-09-05 (상태 E) | **미렌더(`null`)** | — | — | 안내 문구·빈 카드 생성 **0** |

### D. 대비 실측 — §18.9 표 10건 전건 재현

`node .claude/skills/union-design-system/scripts/check-contrast.mjs` 를 스펙의 재현 명령 그대로 직접 실행했다.

| 조합 | 실측 | 스펙 기재값 | 사용처(코드 대조) |
|------|------|------------|------------------|
| `#1a1a1a`:`#ffffff` | **17.40** | 17.40 ✓ | `text-ink` — plain 셀·헤드라인 라벨 |
| `#4b5563`:`#ffffff` | **7.56** | 7.56 ✓ | `text-ink-muted` — `<th>`·`<caption>` |
| `#093389`:`#ffffff` | **11.37** | 11.37 ✓ | `text-primary`·`outline-primary` — today 셀 |
| `#9c0d14`:`#ffffff` | **8.46** | 8.46 ✓ | `text-urgent-strong` — 헤드라인 `D-17` |
| `#ffffff`:`#093389` | **11.37** | 11.37 ✓ | `bg-primary`+`text-white` — major 셀·`outline-white` |
| `#ffffff`:`#9c0d14` | **8.46** | 8.46 ✓ | `bg-urgent-strong`+`text-white` — peak 셀 |
| `#093389`:`#d9e9ff` | **9.23** | 9.23 ✓ | `bg-primary-soft` — 완료 카드 배지 |
| `#6b7280`:`#ffffff` | **4.83** (AAA 미달) | 4.83 ✓ | **불채택 확인** — 코드에 `#6b7280`/회색 지난날짜 표기 **0건** ✓ |

- **토큰 정의처 대조**: `globals.css:31-41` 에서 `--color-ink:#1a1a1a` · `--color-ink-muted:#4b5563` · `--color-primary:#093389` · `--color-urgent-strong:#9c0d14` · `--color-bg:#ffffff` 확인. 코드가 쓰는 클래스가 실제로 이 색이다 ✓
- **브라우저 실측 재확인**: 헤드라인 computed color = `rgb(156, 13, 20)` = `#9c0d14`, today 아웃라인 = `rgb(9, 51, 137)` = `#093389` ✓
- **전 조합 AAA(7:1) 통과. 신규 색 조합 0건** ✓

### E. 은폐 금지 (§0.4) — 달력 카드 영역 전수 스캔

`curl` 로 받은 **JS 미실행 SSR HTML** 에서 달력 격자·헤드라인·카드 콘텐츠가 **전부 완성된 상태로 존재**함을 확인했다.

| 패턴 | 검출 수 | 판정 |
|------|--------|------|
| `role="grid"` | 0 | ✓ |
| `tabindex` | 0 | ✓ |
| `hidden` 속성 | 0 (페이지 전체 1건은 Next.js 내부 빈 div, 달력 밖) | ✓ |
| `transition` / `hover:` / `animate-` / `opacity-0` / `motion-` | **각 0** | ✓ 등장 애니메이션·hover 상태 0 |
| 포커스 가능 요소 | 0 | ✓ |
| `onclick` | 0 | ✓ |
| `aria-hidden="true"` | 14 (숫자·라벨의 정상 이중화) | ✓ 대응 `sr-only` 12개 병행 |

### F. 반응형 — 3뷰포트 Chromium 실측 (개발자 미수행분)

| 항목 | 360px 실측 | 768px 실측 | 1280px 실측 | 스펙 §18.6 |
|------|-----------|-----------|------------|-----------|
| 가로 스크롤 초과 | **0px** | **0px** | **0px** | 0 ✓ |
| `td` 폭 | 43.42px | — | — | 43.4 ✓ |
| 셀(`time`) 폭 | **39.42px** | **85.71px** | **113.14px** | 39.4 / 85.7 / 113.1 ✓ |
| 셀 높이 | 56px | 72px | 72px | 56 / 72 ✓ |
| 헤드라인 | 40px · **1줄** | 64px · **1줄** | 64px · **1줄** | 1줄 ✓ |
| 폰트 패밀리 | `Gmarket Sans` 로딩 확인 | 동일 | 동일 | `font-display` ✓ |

- **브라우저 전체 확대 200%**(1280 → 640px 상당): 가로 스크롤 **0**, 셀 77.28px, 모든 라벨 여유 40px 이상 → 완전 통과 ✓
- **텍스트 전용 200%**(루트 32px): 달력이 만드는 가로 스크롤 **0**(달력 내부 뷰포트 초과 요소 0개). 360px 에서 발생하는 40px 가로 스크롤의 원인은 **헤더 로고 `<img class="h-7 w-auto">`** 로, §18 범위 밖의 기존 요소다 ✓ (셀 내부 넘침은 P3)
- **아웃라인 내향 실측**: `outline-style: solid` / `width: 2px` / `offset: -2px` / `color: rgb(9,51,137)`. 인접 셀과의 실제 간격 8px 유지 — **여백 침범 0** ✓
- **폰트 굵기 실측**: peak 셀 숫자 = 20px/**700**, major 셀 숫자 = 18px/700, 라벨 = 15px/500(major)·600(peak). 개발자가 보고한 Tailwind v4 `text-lead` + `font-bold` 우선순위 주장이 **실브라우저에서 사실로 확인**됨 ✓

### G. 시맨틱·정보 등가 (§18.2 · §18.8) — 정적 전수 확인

- `<table>` 1개 · `<caption>` 1개 · `<thead>`/`<tbody>` 정상 · `<th scope="col">` **7개** — 요일 헤더와 날짜 열의 관계 성립 ✓
- 표 접근성 이름 = `8월 16일 – 9월 5일, 총파업까지 남은 일정 달력입니다. …` (범위 + 사용법) ✓
- `<time>` 실제 DOM 속성명 = `datetime`(값 `2026-08-18`) — 유효 HTML ✓
- 요일 표기가 `Intl` 산출임 확인: `일`~`토`(narrow) + `일요일`~`토요일`(sr-only long), 문자열 하드코딩 0 ✓
- sr-only 배치 규칙 준수: 일정·오늘·월경계(9/1)만 완전 표기, 일반 18칸은 sr-only 0 ✓
- 헤딩 아웃라인 **변경 0**: h1 `26년 임단협 투쟁 안내` → h2 `남은 일정` → h2 `쟁의권 확보` → … 신규 헤딩 0 ✓
- `section aria-labelledby="schedule-heading"` 의 참조 대상 텍스트 = `남은 일정` — 접근성 이름 정상 ✓

### H. 회귀

| 대상 | 확인 | 결과 |
|------|------|------|
| `DateBadge.tsx` | 사용처 전수(`grep`) + `git diff` | 사용처는 `bargaining-2026/page.tsx:137` 과 `PostList.tsx:200` 두 곳뿐. `DateBadge.tsx` **diff 0줄** ✓ |
| `PostList.tsx` | 소스 :202 대조 | `variant={imminent ? "imminent" : "default"}` — `emphasis` 미사용. §18.5 의 variant 재배분은 `bargaining` 페이지 안에서만 일어나므로 **영향 0** ✓ |
| `globals.css` · `DeadlineStrip.tsx` · `HeroPanel.tsx` · `admin/**` · `server/**` | `git diff --stat -- src/` | 변경 파일은 `page.tsx`(+28/−3) · `date.ts`(+59/−0) **2개뿐**. 나머지 diff 0 ✓ |
| `src/lib/date.ts` 기존 함수 | diff 실측 | 추가 59줄 / **삭제 0줄** — `formatPostDate`·`toIsoDateString`·`formatEntryDate`·`formatMonthDaySlash`·`daysUntilKst` 무변경. `daysUntilKst` 를 쓰는 기존 마감 스트립·배지 영향 0 ✓ |
| 기존 카드 문구 | SSR HTML 원문 대조 | 제목·`meta`·`detail`·하단 변동 안내(`교섭 진행에 따라 일정이 변동될 수 있으며, 2차 총파업이 진행될 수 있습니다.`) **한 글자도 변경 없음** ✓ |
| 배지 색 ↔ 달력 셀 색 매핑 | SSR HTML | 8/28 배지 `bg-primary`= 달력 major 셀, 9/4 배지 `bg-urgent-strong`= 달력 peak 셀 — §18.5 표대로 일치 ✓ |
| 타입 우회 | `grep "as any|as unknown|@ts-ignore|@ts-expect-error"` | 신규·수정 3파일에서 **0건** ✓ |

### I. 빌드 — 지시된 순서대로 실행

| # | 명령 | 결과 |
|---|------|------|
| 1 | `npm run build` | **통과** — `Compiled successfully in 552ms`, TypeScript 통과, 8 페이지. `/bargaining-2026` Revalidate `1m` 유지 |
| 2 | `npx tsc --noEmit` | **통과, exit 0** (출력 없음) |
| 3 | `npm run lint` | **통과, exit 0** (경고 0) |
| 4 | 임시 파일 삭제 후 **클린 재빌드**(`.next` 삭제) | **통과** — 라우트 8개, `qa-cal-tmp` **미포함**. 잔존 0 확인 |

---

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | **스크린리더 표 모드 실낭독** (NVDA/VoiceOver) | 보조기기 실행 환경 없음. **DOM 시맨틱은 정적 전수 확인**했다(위 G절) — `<table>`·`<caption>`·`<th scope="col">`×7·sr-only 문자열·`aria-hidden` 이중화 전건 존재. 다만 §18.8.1 의 **낭독 순서**와 빈 셀에서 SR 이 "빈 셀"을 어떻게 말하는지는 확인할 수 없다 |
| 2 | 실기기(모바일 단말) 육안 확인 | 실기기 없음. Chromium 뷰포트 에뮬레이션 정량 측정 + 스크린샷까지만 수행 |
| 3 | `revalidate = 60` 의 런타임 재검증 동작 | 프로덕션 무접촉 제약. 빌드 산출 Revalidate 표기(`1m`) 확인까지만. 60초 뒤 D-n 이 실제로 갱신되는지는 프로덕션 관찰 필요 |
| 4 | 문안 게이트(§18.11.1) 5개 문자열의 게시 승인 | QA 영역 아님 — 리더·fact-verifier 판정 대상. QA 는 **문자열이 깨지지 않고 정확히 렌더되는지**만 확인했다(전건 정상) |

---

## 비고 — 검증 산출물 정리

- 검증용 임시 라우트 `src/app/qa-cal-tmp/page.tsx`(+ 디렉터리)를 생성해 `now` 주입 5시점을 재현한 뒤 **삭제**했다.
- 스크린샷 4장(`cal-360.png` · `cal-overlap-828.png` · `qacal-full-360.png` · `overlap828-360.png`)과 Playwright 스냅샷 디렉터리 `.playwright-mcp/` 를 **리포지토리에서 삭제**했다.
- 로컬 프로덕션 서버(포트 3111) **종료**, `.next` **삭제 후 클린 재빌드**로 잔존 0 을 확인했다.
- 최종 `git status` 는 검증 시작 시점과 동일하다: `M _workspace/02_designer_spec.md` · `M _workspace/03_developer_impl.md` · `M src/app/bargaining-2026/page.tsx` · `M src/lib/date.ts` · `?? src/components/bargaining/`.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0** 을 준수했다. P1~P5 는 전부 리포트로만 남겼다.

---

# QA 리포트: 카운트다운 달력 `whitespace-nowrap` 방어 (16회차 — 회귀)

**검증일** 2026-08-18 · **검증자** qa-calendar
**대상** `src/components/bargaining/StruggleCalendar.tsx` `CELL_BASE` 에 `whitespace-nowrap` 1클래스 추가(+주석). 다른 파일 변경 0.
**계기** 15회차 P2(리더 판단으로 적용) · 개발자 보고서 `03_developer_impl.md` §19.1
**방침** 개발자 실측치를 신뢰하지 않고 **대조군 실험으로 전건 재현**했다.

## 요약: 통과 12 | 실패 0 | 미검증 3 | 정정 3

방어는 **유효하다.** 현 데이터 렌더 결과 변화 0. 다만 **15회차 P2 의 심각도 판정과 줄바꿈 값 집계
양쪽이 틀렸다** — 아래 C1·C2 로 정정한다. 개발자 §19.1 의 집계도 틀렸다(C2).

---

## 정정 항목 (15회차 판정 수정)

### C1. 15회차 P2 의 **심각도 판정이 과소평가였다** — 개발자 지적이 옳다

15회차는 줄바꿈을 "`D-` / `20` 2줄로 쪼개짐, 잘림·데이터 손실 없음"으로 기술했다.
**실제 실패 모드는 그보다 나쁘다.** 대조군(`white-space: normal` 강제) 기하 실측:

| 측정 | 값 |
|------|-----|
| 셀 색면(`<time>` border-box) | y `644.68` ~ `700.68` (높이 56px 고정) |
| 라벨 line-box (`D-40`, 2줄) | y `661.18` ~ `706.18` (높이 45px) |
| **라벨이 색면 아래로 벗어난 양** | **5.50px** |
| **숫자가 색면 위로 벗어난 양** | **5.50px** |
| 셀 `scrollHeight` | 56 → **61(major) / 62(peak)** |
| 라벨 색 / 셀 배경 / 카드 배경 | `#ffffff` / `#9c0d14` / **`#ffffff`** |

`<time>` 은 `h-14`(56px) **고정** + `justify-center` 이므로 내용이 늘어나도 행이 밀리지 않고
**위아래로 똑같이 색면 밖으로 밀려난다.** 색면을 벗어난 부분은 흰 텍스트가 흰 카드 배경 위에
놓여 **대비 1.0 — 보이지 않는다.**

셀 border-box 로 클리핑한 스크린샷으로 육안 확인한 결과, **숫자 `28` 의 윗부분과 줄바꿈된
`33` 의 아랫부분이 실제로 잘려 나간 형태로 보인다.** 즉 조합원에게 **날짜 숫자 자체가 조각으로
보인다** — 15회차가 "레이아웃이 보기 나빠지는 정도"로 기술한 것은 틀렸다.

> 다만 개발자 표현 "**흰 라벨이 흰 카드 배경 위로 나가 읽을 수 없게 된다**"는 **라벨 전체가 아니라
> 색면을 벗어난 부분**에 해당한다. 15px 글자가 22.5px line-box 안에 있어 half-leading 3.75px 를
> 빼면 실제 글자 잉크가 흰 배경으로 넘어가는 양은 상하 각 **약 1.7px** 이다. 라벨 전체가
> 불가독이 되는 것은 아니다. **방향은 개발자가 옳고, 15회차 판정이 과소평가였다**는 결론은 유지된다.

### C2. 줄바꿈 값 집계 — **15회차(18종)도 개발자(14종)도 틀렸다.** 확정값은 아래

리더 지적대로 `getClientRects().length` 는 flex 아이템(`display:block`)에서 줄바꿈돼도 1을
유지한다. **라벨 높이(22.5→45px)와 셀 `scrollHeight`(56→61/62)** 로 판정을 다시 했고,
합성 probe 가 아니라 **실제 셀의 실제 라벨 span 텍스트를 교체**해 측정했다.

| 조건(셀 폭) | major 셀(`font-medium` 500) | peak 셀(`font-semibold` 600) |
|---|---|---|
| **37.28px** (레이아웃 폭 345 = 클래식 스크롤바 15px) | **19종** | **19종** |
| **39.42px** (레이아웃 폭 360 = 스크롤바 없음) | **15종** | **6종** |

- 37.28px 에서 줄바꿈되는 19종: `D-20` `D-22`~`D-30` `D-32`~`D-40` (= D-20~D-40 중 `D-21`·`D-31` 제외)
- 39.42px major 15종: `D-20` `D-22` `D-23` `D-25` `D-28` `D-29` `D-30` `D-32`~`D-36` `D-38` `D-39` `D-40`
- 39.42px peak 6종: `D-20` `D-28` `D-30` `D-34` `D-38` `D-40`

**틀린 이유 (양쪽 다 기록한다)**

- **15회차(내 오류)**: 합성 `<span>` probe 를 **today 셀(`text-body`) 안**에 넣어 측정했다.
  peak 셀의 라벨은 부모 `<time>` 의 `text-lead` 에서 **자간 `-0.01em` 을 상속**받는데
  (`--text-lead--letter-spacing`, `globals.css:82`), probe 는 이를 상속받지 못해 **peak 라벨을
  과대 측정**했다. `max(medium, semibold)` 로 합산한 18종은 실재하지 않는 조합이다.
- **개발자(§19.1)**: 셀 폭을 `37.28px` 로 보고하면서 목록은 39.42px 조건의 major 15종에서
  `D-39` 가 빠진 **14종**이다. 37.28px 조건이라면 19종이어야 하므로 **보고한 폭과 목록의 조건이 어긋난다.**

**결론에는 영향 없다** — 어느 집계를 쓰든 D-20 이상에서 줄바꿈이 발생하고 방어가 필요하다는
판단은 동일하며, `whitespace-nowrap` 은 세 조건 전부에서 줄바꿈을 0 으로 만든다(아래 통과 #1).

### C3. 360px 셀 폭 `39.42px`(15회차) vs `37.28px`(개발자) — **둘 다 맞다. 스크롤바 조건 차이다**

같은 브라우저에서 두 조건을 모두 재현해 확정했다. 원인은 **클래식 스크롤바 15px 의 유무**이며,
측정 오류가 아니다.

| 조건 | `innerWidth` | 레이아웃 폭 | 셀 폭 | **`D-10` 여유(총)** | `D-17` 여유(총) |
|------|-------------|------------|-------|--------------------|----------------|
| 스크롤바 없음(모바일 오버레이 스크롤바) | 360 | **360** | **39.42px** | **2.44px** | 3.87px |
| 클래식 스크롤바 15px(데스크톱 창을 360px 로 좁힌 경우) | 360 | **345** | **37.28px** | **0.30px** | 1.72px |

- 15회차는 오버레이 스크롤바 세션, 개발자는 클래식 스크롤바 세션이었다. **두 값 모두 실재한다.**
- 768px 도 같은 원인으로 값이 갈린다(85.71px ↔ 83.57px). 1280px 은 `max-w-page`(960px)가
  폭을 고정하므로 **양쪽 모두 113.14px 로 동일**하다 — 이 일치가 스크롤바 원인임을 확증한다.
- **조합원 실사용 기준**: 360px 급 화면은 대부분 모바일이고 모바일 브라우저는 **오버레이
  스크롤바**라 레이아웃 폭을 뺏지 않는다 → 실사용 여유는 **2.44px** 이다. `0.30px` 은
  데스크톱 창을 360px 로 좁힌 경우의 값이다.

**여유 0.30px 의 안전성 판정**: **현 데이터 한정 통과.** 두 조건 모두에서 `D-10` 은 줄바꿈되지
않고 잘리지도 않는다(실측 확인). 그러나 **안전 마진은 사실상 없다.** 0.30px 은 렌더링 반올림
1px 미만이며, 다음 중 어느 하나라도 바뀌면 즉시 넘친다:
① 폰트 교체·업데이트 ② 라벨에 글자 1개 추가 ③ 컨테이너 패딩·`max-w-page` 변경
④ `text-caption` 크기 변경. **넘치더라도 `whitespace-nowrap` 덕분에 줄바꿈이 아니라 좌우
1.57px 이내 넘침으로 끝난다**(td 패딩 4px·카드 패딩 12px 이 흡수) — 방어가 실제로 작동하는 지점이 여기다.

---

## 실패 항목

**없음.**

---

## 통과 항목 (12)

| # | 항목 | 검증 방법 | 결과 |
|---|------|----------|------|
| 1 | **줄바꿈 방어 유효** | 실제 셀 라벨에 `오늘`·`9/1`·`D-1`~`D-41` **43종**을 주입, 높이·`scrollHeight` 판정 | 두 셀·두 폭 조건 전부 **줄바꿈 0종**. 라벨 높이 22.5px·셀 `scrollHeight` 56 고정 ✓ |
| 2 | 대조군 대비 효과 입증 | 같은 43종을 `white-space: normal` 강제로 재측정 | 대조군 19종 줄바꿈 → 현재 **0종**. 방어가 원인임이 대조로 확정 ✓ |
| 3 | **잘림 0 (전 계층 `overflow`)** | 라벨 span 부터 `<html>` 까지 **조상 12계층** computed `overflowX`/`overflowY`/`textOverflow` 전수 | 비-`visible` 또는 비-`clip` 계층 **0개**. 개발자 보고 확인 ✓ |
| 4 | `overflow-hidden`·`truncate` 미도입 | 소스 grep | 코드에 0건(주석에서 "두지 않는다"고 명시한 곳만 매치) ✓ |
| 5 | 좌우 넘침이 여백 안에 흡수 | 43종 최대 넘침 실측 | 최대 **1.57px/편**(`D-40`, 37.28px 조건). `td` 패딩 4px·카드 패딩 12px 안. 카드 경계 침범 없음 ✓ |
| 6 | **현 데이터 렌더 결과 변화 0 — 360px** | 실브라우저 | 3행 · 셀 37.28×56 · 표기 `18 오늘 28 D-10 9/1 4 D-17` · 헤드라인 `D-17` 40px 1줄 · 줄바꿈 0 · 색면 밖 0 ✓ |
| 7 | **동일 — 768px** | 실브라우저 | 3행 · 셀 83.57×**72** · 표기 동일 · 헤드라인 64px 1줄 · `D-10` 여유 46.59px ✓ |
| 8 | **동일 — 1280px** | 실브라우저 | 3행 · 셀 113.14×**72** · 표기 동일 · 헤드라인 64px 1줄 `rgb(156,13,20)` · `D-10` 여유 76.16px ✓ |
| 9 | 가로 스크롤 0 | 3뷰포트 `scrollWidth - clientWidth` | 360 · 768 · 1280 전부 **0px** ✓ |
| 10 | `whitespace-nowrap` 실적용 | computed style | 셀 computed `white-space: nowrap` ✓ (SSR HTML 4개 셀 클래스 변형 전부에 포함) |
| 11 | 접근성 회귀 0 | DOM | 달력 내 포커스 가능 요소 **0**, `role` `null`, `th scope` `col×7`, today 아웃라인 `solid 2px -2px rgb(9,51,137)` — 15회차와 동일 ✓ |
| 12 | 변경 범위 | `git diff --stat -- src/` | `page.tsx`(+28/−3)·`date.ts`(+59/−0) — **15회차와 동일**. `StruggleCalendar.tsx` 외 신규 변경 0 ✓ |

### 빌드 (지시 순서)

| # | 명령 | 결과 |
|---|------|------|
| 1 | `npm run build` | **통과** — 8 페이지, `/bargaining-2026` Revalidate `1m` 유지 |
| 2 | `npx tsc --noEmit` | **통과, exit 0** |
| 3 | `npm run lint` | **통과, exit 0** |

`.next` 삭제 후 클린 재빌드로 실행했다(라우트 8개, 임시 라우트 잔존 0).

---

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | 스크린리더 실낭독 | 보조기기 실행 환경 없음. 이번 변경은 CSS 1클래스라 DOM·텍스트 콘텐츠 변화가 0 이므로 15회차 대비 **낭독 결과가 달라질 근거가 없다**. 다만 실행하지 못했으므로 통과로 적지 않는다 |
| 2 | 200% 확대 재검증 | 15회차에서 이미 측정했고(전체 확대 통과 / 텍스트 전용은 P3) 이번 변경으로 개선 방향으로만 작용하나, **이번 빌드에서 재측정하지 않았다** |
| 3 | `revalidate=60` 런타임 동작 | 프로덕션 무접촉 제약 |

---

## 15회차 권고의 현재 상태

| 15회차 | 상태 |
|--------|------|
| **P2** (D-20~D-40 줄바꿈) | **해소** — `whitespace-nowrap` 으로 방어. 집계 수치는 C2 로 정정 |
| **P1** (`D-10` 여유 7.6px → 실측) | **유효 — 악화된 형태로 확정.** C3 대로 조건에 따라 2.44px 또는 **0.30px**. 스펙 §18.6.1 수치는 여전히 실측과 불일치하며 디자이너 정정 대상 |
| **P3** (§18.8.3 텍스트 확대 문언) | **유효** — 미해소(디자이너 문언 정정 대상) |
| **P4** (흰 아웃라인 가늘다) | **유효** — 미해소(디자이너 판단 대상) |
| **P5** (`weeks[0]` 크래시 가드) | **유효** — 미해소. 프로덕션 도달 불가라 우선순위 낮음 |

---

## 비고 — 검증 산출물 정리

- 이번 회차는 **임시 라우트를 만들지 않았다.** 실제 페이지 `/bargaining-2026` 의 DOM 에서
  라벨 텍스트를 교체하는 방식으로 측정해, 측정 컨테이너가 실제와 달라지는 함정(개발자가
  1차 측정에서 빠졌다고 보고한 것)을 원천 회피했다. DOM 변경은 브라우저 세션 한정이며
  소스·빌드에 영향 0 이다.
- 스크린샷 2장(`qa16-control.png` · `qa16-cell.png`)과 `.playwright-mcp/`, 스크래치패드의
  HTML·PNG 를 **전부 삭제**했다. 로컬 서버(포트 3112) **종료**, `.next` **삭제 후 클린 재빌드**.
- 최종 `git status` 는 검증 시작 시점과 동일: `M _workspace/02_designer_spec.md` ·
  `M _workspace/03_developer_impl.md` · `M _workspace/04_qa_report.md` ·
  `M src/app/bargaining-2026/page.tsx` · `M src/lib/date.ts` · `?? src/components/bargaining/`.
  프로젝트 루트 잔존 PNG **0**.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 메인페이지 미니달력 + D-day 기준 통일 (17회차)

**검증일** 2026-08-18 · **검증자** qa-calendar
**대상** 미커밋 — `src/lib/struggleSchedule.ts`(신규) · `StruggleCalendar.tsx`(size prop) · `src/app/page.tsx` · `src/app/bargaining-2026/page.tsx`
**판정 기준** 디자인 스펙 §19(특히 §19.9 수용 체크리스트 17항목) · `union-design-system` §0.3 §0.4
**개발자 보고서** `03_developer_impl.md` §20(§20.8 최신) — **주장을 신뢰하지 않고 전건 독립 재현**했고, **보고서 ↔ 코드 대조**도 수행했다.

## 요약: 통과 38 | 실패 0 | 미검증 3 | 권고 2

§19.9 체크리스트 **17/17 전건 통과.** 최우선 항목인 **일정 문안 무결성은 바이트 단위로 확인**했고,
개발자가 미검증으로 넘긴 4건 중 **3건을 목 API 로 실제 환경을 만들어 검증 완료**했다.
개발자 보고서와 실제 코드가 어긋나는 곳은 **발견되지 않았다**(§20.8 반영분 4개 클래스 전건 일치).

---

## 실패 항목

**없음.**

---

## 최우선 항목 1 — 일정 단일 출처 무결성 (조합원에게 나가는 날짜)

`git show 230c74c:src/app/bargaining-2026/page.tsx` 의 구 `SCHEDULE` 리터럴에서 `date`·`title`·
`meta`·`detail`·`level` **10개 필드를 추출해 신규 모듈의 것과 바이트 단위로 비교**했다.

| 검사 | 결과 |
|------|------|
| 필드 수 | 구 **10** / 신 **10** |
| `diff` | **차이 0줄** |
| **md5 해시** | 구 `ea6c49fb2bbd981897e450dd553a9a6c` / 신 **`ea6c49fb2bbd981897e450dd553a9a6c`** — **완전 일치** |
| 비가시 문자(제로폭·NBSP 등) 혼입 | `od -c` 스캔 **0건** |

**이동 중 문안 변형 0.** 렌더 결과에서도 원문(`_workspace/00_input/content-bargaining-2026.md`)
대조를 다시 했다 — `8/28(금) 총력투쟁 결의대회(여의도) - 저녁` → `서울 여의도 · 저녁`,
`9/4(금) 총파업 - 종일` → `종일` 로 기존 표기 그대로다.

## 최우선 항목 2 — 메인·상세 D-n 일치 (`now` 주입 5시점, 나란히 렌더)

임시 라우트에서 **같은 페이지에 mini 와 full 을 동시에** 서버 렌더해 파싱했다.

| now | `nextStruggleEvent` | mini 헤드라인 | full 헤드라인 | **D-n 일치** | **색 일치** | 행수 | 9/4 셀 |
|-----|--------------------|---------------|---------------|-------------|------------|------|--------|
| 2026-08-18 | `8/28 major` | `8/28 총력투쟁 결의대회` | `8월 28일 총력투쟁 결의대회` | **D-10 = D-10** ✓ | `text-primary` ✓ | 3 = 3 | **적색** |
| 2026-08-28 | `8/28 major` | 동일 | 동일 | **오늘 = 오늘** ✓ | `text-primary` ✓ | 2 = 2 | **적색** |
| **2026-08-29** | **`9/4 peak`** | `9/4 총파업` | `9월 4일 총파업` | **D-6 = D-6** ✓ | **`text-urgent-strong`** ✓ | 2 = 2 | **적색** |
| 2026-09-04 | `9/4 peak` | `9/4 총파업` | `9월 4일 총파업` | **오늘 = 오늘** ✓ | `text-urgent-strong` ✓ | 1 = 1 | **적색** |
| 2026-09-05 | **`null`** | **미렌더** | **미렌더** | ✓ | — | — | — |

- **전 시점에서 두 페이지의 D-n 문자열·헤드라인 색·격자 행수·peak 셀이 전부 동일**하다(§19.9-6).
- **8/28 → 8/29 전이 확인**: 대상이 결의대회 → 총파업으로 자동 이동하고 색이 **남색 → 적색**으로
  바뀐다(§19.9-7). 숫자는 `오늘` → `D-6` 으로 커지지만 이름·색 2중으로 다른 일정임이 읽힌다.
- **격자 9/4 셀은 5시점 전부 `bg-urgent-strong`(적색) 불변**(§19.9-8). 헤드라인만 대상을 옮긴다.
- mini 헤드라인은 `aria-hidden` 짧은 표기(`8/28 …`)와 `sr-only` 긴 표기(`8월 28일 …`)를
  **둘 다** 담고 있다 — 시각만 줄이고 SR 정보는 줄이지 않았다(§19.4.3) ✓

---

## 개발자가 미검증으로 넘긴 것 — 3건 검증 완료 / 1건 미검증

### ★ `DeadlineStrip` 이 렌더되는 환경 (목 API 구성) — **검증 완료, 구별됨**

개발자 환경은 API 미설정이라 스트립이 뜨지 않았다. **목 API 서버(포트 3210)를 만들어** 마감 임박
게시물 4건 + urgent 공지 1건을 넣고 그 상태로 빌드·기동해 실측했다.

| §19.2.3 축 | `DeadlineStrip` 실측 | **미니달력 실측** | 구별 |
|-----------|---------------------|------------------|------|
| 표면(배경) | `rgb(217,233,255)` = `#d9e9ff` **L3 강조 면** | `rgb(255,255,255)` = 흰 카드 | ✓ |
| 그림자 | `none` | **있음**(`shadow-card`) | ✓ |
| radius | **16px** (`rounded-card`) | **24px** (`rounded-panel`) | ✓ |
| 형태 | 가로 `ul`(1줄, 가로 스크롤) | **7열 `table`** | ✓ |
| 인터랙션 | 링크 **4개**(항목 전부) | 링크 **1개**(하단 진입점만) | ✓ |
| 시맨틱·이름 | `<nav aria-label="마감 예정 일정">` | `<section aria-label="26년 임단협 투쟁 안내">` | ✓ |
| 두 블록 간격 | — | **32px**(모바일) / **40px**(md+) | ✓ 스펙 값 일치 |

**6축 전부 실측으로 구별됨.** 360px 스크린샷 육안 확인도 했다 — 연한 파랑 가로 띠(스트립) 아래
흰 격자 카드(미니달력)로 **한눈에 다른 블록으로 읽힌다.** 조합원이 게시물 마감과 투쟁 일정을
같은 것으로 읽을 위험은 확인되지 않았다.

### ★ 히어로 모드 1 에서의 진입점 — **검증 완료. 링크가 유일 경로임이 실증됐다**

목 데이터의 공지 첫 항목을 `urgent: true` 로 두어 **히어로를 실제로 모드 1 로 전환**시켰다.

| 검사 | 결과 |
|------|------|
| 히어로 모드 | **모드 1** — 히어로 내부 링크가 `/notices/n1` **1개뿐**, 투쟁 CTA **없음** |
| 메인 전체의 `/bargaining-2026` 링크 수 | **정확히 1개** |
| 그 1개의 위치 | **미니달력 하단 `자세히 보기`** (`inMiniCalendar: true`) |

**§19.2.2 의 설계 근거가 가설이 아니라 사실임이 확인됐다** — 모드 1 에서 이 링크가 없으면
메인에서 투쟁 안내로 가는 경로가 **0개**가 된다. §19.9-10 통과.

### ★ 텍스트 전용 확대 200% — **검증 완료. mini 가 full 보다 1px 더 타이트하다**

§19.5.1 이 "mini 는 세로 여유가 더 적으므로 QA 실측 항목"이라 명시한 건이다. 루트 폰트 2배(32px).

| 항목 | 기본 100% | **텍스트 전용 200%** | 판정 |
|------|----------|---------------------|------|
| 셀 치수 | 37.28 × 44px | 25.28 × **88px** | — |
| 셀 `scrollHeight` | 44 (= 높이) | **89** (높이 88) → **세로 1px 초과** | 데이터 손실 0 |
| 라벨 줄바꿈 | 0 | **0** (`whitespace-nowrap` 유지) | ✓ |
| 색면 상하 넘침 | 0.25px | **0.5px** | 무시 가능 |
| 좌우 넘침 | 없음 | 24.34px/편 | 잘림 0(아래) |
| 조상 `overflow` 비-visible 계층 | **0개** | **0개** | **잘림 0** ✓ |
| **미니달력이 만든 뷰포트 초과 요소** | **0개** | **0개** | ✓ |

- 16회차에서 full(56px 셀)은 세로 초과가 없었다. **mini(44px)는 1px 초과** — 스펙이 예고한
  "세로 여유가 더 적다"가 실측으로 확인됐다. 다만 `overflow: visible` 이라 **잘림·데이터 손실 0**이다.
- 텍스트 200% 에서 문서에 40px 가로 스크롤이 생기는데, **원인 요소를 단일 특정**했다:
  헤더 로고 `IMG.h-7 w-auto`(우측 끝 385px). **미니달력 기여 0개**이며 §19 범위 밖의
  기존 요소다(15회차에서 동일 원인 기록됨).

### 미검증으로 남긴 것

스크린리더 실낭독은 환경이 없어 검증하지 못했다(아래 미검증 표).

---

## 통과 항목 — §19.9 수용 체크리스트 17/17

| # | 항목 | 검증 방법 | 결과 |
|---|------|----------|------|
| 1 | 메인 순서 히어로 → 스트립 → 미니달력 → 온누리 | SSR HTML 오프셋 | 2829 → 4246 → **5837** → 14006 → 16987 ✓ |
| 2 | 미니 카드 패딩 `p-3 md:p-6` = 상세와 동일 | computed style 양쪽 | 둘 다 **12px/12px**(360px), 24px(md+) ✓ |
| 3 | **360px 미니 셀 폭 = 상세 셀 폭** | 동일 세션·동일 뷰포트 연속 측정 | **37.28px = 37.28px** — 소수점까지 일치 ✓ |
| 4 | `D-10` 잘림·줄바꿈 없음 | 높이·`scrollHeight` 판정(16회차 확정 방법) | 줄바꿈 **0**, 라벨 36.98px < 셀 37.28px, `scrollHeight` 44 = 높이 44 ✓ |
| 5 | 헤드라인 `8/28 총력투쟁 결의대회 / D-10` | 렌더 HTML | 정확히 일치(9/4·D-17 아님) ✓ |
| 6 | 상세 헤드라인도 같은 값 | 5시점 나란히 렌더 | 전 시점 D-n 동일 ✓ |
| 7 | 헤드라인 색 남색 → 8/29 주입 시 적색 + 9/4 총파업 | `now` 주입 | `text-primary` → **`text-urgent-strong`** ✓ |
| 8 | 9/4 셀은 상태 무관 적색 유지 | 5시점 | 전 시점 `bg-urgent-strong` ✓ |
| 9 | 9/5 주입 시 감싸는 여백까지 소멸 | `nextStruggleEvent(9/5)` = **null** 실측 + `page.tsx:111` 코드 | 래퍼 `<div class="mt-8 md:mt-10">` 가 조건 안에 있어 통째로 미렌더 ✓ |
| 10 | 히어로 모드 1 에서도 링크로 도달 | 목 urgent 공지 | 모드 1 실현, 링크 **1개(유일 경로)** ✓ |
| 11 | `<h2>` 없음 · 헤딩 아웃라인 불변 | DOM | 미니달력 내 헤딩 **0개**. 페이지 h2 = 히어로 1(모드 1 고유) + 섹션 4 ✓ |
| 12 | 격자 안 Tab 정지점 0 | **실제 Tab 14회 주행** | 표 내부 포커스 요소 **0** ✓ |
| 13 | `DeadlineStrip` 시각·동작 종전과 동일 | `git diff` + 렌더 | `DeadlineStrip.tsx` **diff 0줄**, 렌더 정상(4항목·전부 링크) ✓ |
| 14 | mini `caption` 이 `26년 임단협` 으로 시작 | 렌더 HTML | `26년 임단협 투쟁 일정 달력입니다. 8월 16일 – 9월 5일. …`, `position: absolute`(sr-only) ✓ |
| 15 | `globals.css` diff 0줄 | `git diff --stat` | **변경 0** ✓ |
| 16 | 텍스트 200% mini 넘침 실측 | 위 절 | 실측 완료 — 세로 1px, 잘림 0 ✓ |
| 17 | 상세 카드 `meta`·`detail` 무변경 | 렌더 HTML + md5 | `서울 여의도 · 저녁` / `종일` / `총파업 D-7 집회입니다.` / `집결 장소와 시간은 지부 공지로 별도 안내합니다.` — 변화 0 ✓ |

### 추가 통과 항목 (체크리스트 외)

| # | 항목 | 결과 |
|---|------|------|
| 18 | **실제 Tab 순서 주행**(개발자 미검증분) | 로고 → 히어로 CTA → **스트립 4항목** → **미니달력 링크(`/bargaining-2026`)** → 온누리 → 섹션내비 4 → 목록. **§19.5.1 규정과 정확히 일치** ✓ |
| 19 | **모바일 DOM 순서 = 시각 순서** (리더 요구 3) | 360px: DOM `헤드라인→격자→링크` = 시각 `헤드라인→격자→링크` ✓ (`order` 미사용 확인) |
| 20 | **md+ DOM 순서 = 시각 순서** | 768/1280px 모두 일치. 헤드라인(top 661.7, left 56) → 격자(661.7, 272) → 링크(747.4, 56) — 읽기 순서와 Tab·SR 순서가 같다 ✓ |
| 21 | **md+ 카드 높이 270.5px** (리더 요구 4) | 768px·1280px **둘 다 270.5px**. 스펙 §19.4.2 ≈271px 일치 ✓ |
| 22 | md+ 2열 배치 | `grid-template-columns: 192px 425px`(768) / `192px 632px`(1280), `column-gap: 24px`. 헤드라인·링크 `left` 동일(같은 좌열), 간격 16px ✓ |
| 23 | md+ 셀 폭·여유 | 768px **52.71px**(`D-10` 여유 **15.73px**) / 1280px **82.28px**(여유 45.3px). 둘 다 §18 검산 규칙 안전선(10px) 초과 ✓ |
| 24 | 가로 스크롤 0 | 360 · 768 · 1280 전부 **0px** ✓ |
| 25 | 블록 간격 | 모바일 앞 32px / md+ 앞 40px·뒤 40px — §19.2.1 값 일치 ✓ |
| 26 | **대비 실측 §19.6 재실행** | 7조합 전건 재현: 17.40 / 7.56 / 11.37 / 8.46 / 11.37 / 8.46 / 9.23 — **전 조합 AAA**, 스펙 표와 완전 일치 ✓ |
| 27 | 은폐 금지(§0.4) | JS 미실행 SSR HTML 에 격자·헤드라인·링크 전부 존재. 미니달력 영역 `hidden` 0 · `role="grid"` 0 · `tabindex` 0 · `animate-` 0 · `opacity-0` 0 · `role="tab"` 0 · `aria-selected` 0 ✓ |
| 28 | 표 2개 구별(접근성) | 메인의 `<table>` 은 **1개**(미니달력)뿐. 스트립은 `<nav><ul>` 이라 표가 아니며 landmark 로 분리 ✓ |
| 29 | 링크 터치 대상 | 높이 **44px**(`min-h-touch`), 라벨 `자세히 보기`, `href="/bargaining-2026"` ✓ |
| 30 | 줄바꿈 방어 유지 | `whitespace-nowrap` 이 `CELL_BASE` 에 잔존, 전 뷰포트 줄바꿈 0 ✓ |
| 31 | 상세 페이지 회귀 | 셀 폭 37.28 · 높이 56 · 3행 · 격자 색 · caption 시각 노출 · 배지 variant(8/28 `bg-primary` / 9/4 `bg-urgent-strong`) · 배지 D-n(D-10 / D-17) **전부 종전과 동일**. 변경은 헤드라인 1건뿐 ✓ |
| 32 | 손대지 말 것 파일 | `globals.css`·`DateBadge`·`DeadlineStrip`·`HeroPanel`·`OnnuriGuideCard`·`PostList`·`admin`·`server` **전부 diff 0줄** ✓ |
| 33 | 변경 범위 | `page.tsx`(+14) · `bargaining-2026/page.tsx`(−32 중 순변경) · `StruggleCalendar.tsx` · 신규 `struggleSchedule.ts` — **스펙 §19.8 목록과 정확히 일치** ✓ |
| 34 | 타입 우회 | `as any`·`as unknown`·`@ts-ignore`·`@ts-expect-error` **0건**. 제네릭 `<T extends DatedEvent>` 로 캐스팅 없이 통과 ✓ |
| 35 | 같은 날 2건 방어(§19.3.2) | `new Map(...)` 덮어쓰기를 배열 누적(`eventsByDate: Map<string, CalendarEvent[]>`)으로 교체, 대표는 `sameDay[0]`(peak 우선 정렬), `sr-only` 는 `join(", ")` 로 전건 나열 — 스펙대로 구현됨(코드 검증. 현 데이터에 동일 날짜 2건이 없어 **렌더 실측은 불가**) ✓ |
| 36 | **보고서 ↔ 코드 대조** (리더 지시) | §20.8 표의 4개 클래스(카드·헤드라인·격자·링크)를 실제 소스와 1:1 대조 — **전건 일치**. §20.4/§20.8 의 셀 폭 상이(39.42 vs 37.28)는 §20.8 이 스크롤바 조건 차이로 이미 설명했고 16회차 확정 내용과 부합 ✓ |
| 37 | 개발자 실측치 재현 | 카드 높이 270.5px · 768px 셀 52.71px · 1280px 셀 82.28px · 헤드라인 36px `rgb(9,51,137)` — **개발자 보고값과 소수점까지 일치** ✓ |
| 38 | 빌드 (지시 순서) | `npm run build` **통과**(8페이지, `/`·`/bargaining-2026` Revalidate 1m) → `npx tsc --noEmit` **exit 0** → `npm run lint` **exit 0** ✓ |

---

## 권고 항목 (실패 아님)

| # | 분류 | 위치 | 내용 | 제안 |
|---|------|------|------|------|
| **Q1** | 스펙 문서 최신화 | `02_designer_spec.md` **§19.1.1** md+ 레이아웃 행 | 스펙은 `md:grid md:grid-cols-[12rem_1fr] md:gap-6 md:items-start` 인데 실제 코드는 `md:grid-rows-[auto_1fr]` 추가 + **`md:gap-x-6`**(세로 gap 0)이고, 헤드라인·격자·링크에 명시적 `col-start`/`row-start` 배치가 붙어 있다 | **코드가 옳다** — 리더 판정(모바일 순서 `헤드라인→격자→링크`)을 `order` 없이 구현하려면 이 형태가 필요하고, 폭 계산(좌열 192 + gap 24)은 스펙과 동일해 §19.4.1 수치는 유효하다. 개발자 §20.8 에는 기록됐으나 **스펙 §19.1.1 본문이 갱신되지 않아** 다음 작업자가 스펙만 보면 되돌릴 수 있다. 디자이너가 §19.1.1 을 §20.8 값으로 갱신할 것을 권한다 |
| **Q2** | 잔여(15회차 P5 승계) | `StruggleCalendar.tsx:191` 부근 | 무효 `now` 주입 시 `todayIsoKst` 가 `""` 를 반환하고 호출부가 `weeks[0]`(:210 부근)에서 `TypeError` 로 크래시하는 구조가 그대로 남아 있다 | 프로덕션 도달 불가(양 페이지 모두 `now` 미전달)이나, 이번에 호출부가 **2곳으로 늘어** 테스트·프리뷰 노출면이 커졌다. `if (weeks.length === 0) return null;` 한 줄이면 해소된다 |

**15회차 P1·P3·P4 는 §19.7 에서 디자이너가 §18 본문 정정으로 처리했음을 확인**했다(스펙 §18.6.1-c 신설).

---

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | **스크린리더 실낭독** (NVDA/VoiceOver) — 표 2개 구별, `aria-label` 영역 훑기 | 보조기기 실행 환경 없음. **DOM 은 전수 확인**했다: 메인의 `<table>` 은 1개뿐, mini `caption` 이 `26년 임단협` 으로 시작(sr-only), 스트립은 `<nav aria-label>` landmark 로 분리, 셀 `sr-only` 문자열 정상. 실제 낭독 순서·표 목록 표시는 확인 불가 |
| 2 | **같은 날 2건의 실제 렌더**(§19.3.2) | 현 `STRUGGLE_SCHEDULE` 에 동일 날짜 항목이 없다. 코드 경로(Map 배열 누적 · `sameDay[0]` 대표 · `join(", ")`)는 읽어서 확인했으나 **렌더 결과로 재현하지 못했다**. 데이터를 조작해 확인하려면 프로덕션 코드 수정이 필요해 제약상 수행하지 않았다 |
| 3 | `revalidate=60` 런타임 동작 | 프로덕션 무접촉 제약. 빌드 산출 `1m` 표기까지만 확인 |

> **문안 게이트(§19.8.1)** 4개 문자열은 리더·fact-verifier 판정 대상이라 QA 판정 범위에서 제외한다.
> QA 는 **문자열이 깨지지 않고 정확히 렌더되는지**만 확인했고 전건 정상이다.

---

## 비고 — 검증 산출물 정리

- **목 API 서버**(`mockapi.mjs`, 포트 3210)를 만들어 마감 임박 게시물 4건 + urgent 공지 1건을
  제공하고, `NEXT_PUBLIC_API_BASE_URL` 을 지정해 빌드·기동했다. 개발자가 검증하지 못한
  `DeadlineStrip` 렌더 환경과 히어로 모드 1 을 이 방식으로 실현했다.
  → 검증 후 **서버 종료·스크립트 삭제**, 목 환경변수 없이 **클린 재빌드**로 되돌렸다.
- 임시 라우트 `src/app/qa17-tmp/`(5시점 mini·full 나란히 렌더), 스크린샷 `qa17-strip-mini.png`,
  `.playwright-mcp/`, 스크래치패드의 HTML·PNG·비교용 txt 를 **전부 삭제**했다.
- 로컬 서버(3113)·목 API(3210) **종료**, `.next` **삭제 후 클린 재빌드**(라우트 8개, `qa17-tmp` 미포함).
- 브라우저 콘솔 에러 2건은 **목 API 가 `/guestbook` 을 구현하지 않아 생긴 CORS 오류**로,
  **QA 환경 산물이며 제품 결함이 아니다.** 목 API 없이 빌드한 클린 상태에서는 발생하지 않는다.
- 최종 `git status` 는 검증 시작 시점과 동일: `M _workspace/02_designer_spec.md` ·
  `M _workspace/03_developer_impl.md` · `M src/app/bargaining-2026/page.tsx` ·
  `M src/app/page.tsx` · `M src/components/bargaining/StruggleCalendar.tsx` ·
  `?? src/lib/struggleSchedule.ts`. 루트 잔존 PNG **0**, 임시 라우트 **0**, 목 프로세스 **0**.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 8/28 결의대회 참석 안내 페이지 전체 (18회차)

**검증 대상**: `/rally-2026-08-28` 신규 페이지 · 메인 진입 블록(`RallyEntryCard`) · 네이버 지도(`RallyMap`) ·
내 위치 · QR 출석 블록(`QrAttendanceCard`) · 온누리 카드 주소 추가 · 회귀
**판정 근거**: `02_designer_spec.md` §20 전체(§20.11·§20.17·§20.19.11·§20.20.7·§20.21.6 체크리스트) ·
`01_verifier_factcheck.md` 4·5회차 요구 1~35 · `03_developer_impl.md` §21~§23 ·
`union-qa-testing` · `union-design-system` §0.3·§0.4
**실행 환경**: `npx next dev -p 3000`(NCP 등록 URL 과 일치) · Chromium(Playwright) · 360/768/1280
**검증 시각**: 2026-08-18 19:35~20:00 KST

> ⚠ **검증 중 대상 코드가 2회 교체됐다.** 최종 판정은 **`src/lib/rallyMap.ts` mtime 19:59:33 ·
> `src/components/rally/RallyMap.tsx` mtime 19:44:58** 시점 기준이다. 그 이후 변경분은 미검증이다.

## 18회차 요약: 통과 71 | 실패 3 | 미검증 5

---

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| **1** | **§0.4 콘텐츠 은폐 (지도)** | `src/lib/rallyMap.ts:343` (`placement`) · `src/lib/rallyMap.ts:527~543` (`anchorOnBounds`) | **③④ 라벨 pill 이 자기가 가리키는 밴드와 서로의 밴드를 덮는다.** 대각선 밴드의 라벨 앵커를 **bbox 변의 중점**에서 뽑기 때문에 앵커가 밴드 위가 아니라 **밴드 옆 허공**에 잡히고, 거기서 위/아래로 뻗은 pill 이 이웃 도형 위에 얹힌다. **360px 실측**: ④ pill 이 ③ 대오 1 밴드의 **1131/1833 px² = 62%**, ③ pill 이 ④ 대오 2 밴드의 **578/1292 px² = 45%**, ③ pill 이 ⑤ 부지 폴리곤의 **1462/1892 px² = 77%** 를 덮는다. 도형 전체 bbox(104×129px) 기준 **54.3% 가 pill 로 가려진다**(1280px 에서도 22~40%). 조합원이 **자기가 설 자리의 도형을 볼 수 없다** | ① 밴드에 **`labelAt` 을 명시**해 앵커를 폴리곤 **안쪽**(예: 각 밴드 폴리곤의 중심 — ⑤ 부지가 이미 쓰는 `polygonCenter` 와 같은 방식)으로 옮기거나, ② ③④ 의 `placement` 를 좌우(`left`/`right`)로 돌려 세로로 이어진 밴드 열 **바깥**으로 빼라. ⑤ 는 이미 `labelAt: polygonCenter(...)` 로 해결한 문제이고 **밴드에만 적용이 빠져 있다** |
| **2** | **지도 판독성 (360px)** | `src/components/rally/RallyMap.tsx:83` (`FIT_PADDING`) | **360px 에서 지도가 축척 300m 로 과도하게 축소된다.** 지도 박스 328×246px 에 `FIT_PADDING` 상·하 **48+48=96px** 를 고정으로 먹여 세로 가용폭이 **150px** 만 남고, 표시해야 할 범위(약 442m)가 그 안에 들어가려면 정수 zoom 이 15(≈3.79 m/px)까지 떨어진다. 결과적으로 **도형 전체가 104×129px** 로 쪼그라들어 실패 1과 겹치면 대오가 사실상 보이지 않는다(1280px 은 축척 100m 로 정상) | `FIT_PADDING` 을 **박스 크기에 비례**시켜라(예: `Math.min(48, box.height * 0.12)`). 실패 1을 라벨 앵커 이동으로 해결하면 상·하 48px 패딩 자체가 필요 없어지므로 **1과 함께 고치는 것이 맞다** |
| **3** | 접근성 (텍스트 확대 200%) | `src/components/rally/RallyMap.tsx:693` 범례 `li` · `src/app/rally-2026-08-28/page.tsx:167` 블록 2 첫 줄 · `src/components/rally/QrAttendanceCard.tsx:106` 경고 블록 | **360px + 텍스트 200% 에서 문서에 가로 스크롤 34px 이 생긴다**(`documentElement.scrollWidth` 394 vs `clientWidth` 360). 원인은 `break-keep` 상태의 긴 고유명사가 컨테이너를 넘기는 것: 범례 ⑤ 행 `여의도더샵아일랜드파크` (327 vs 296) · 블록 2 `더샵아일랜드파크 앞 의사당대로 · [결의대회대오 2]` (273 vs 216) · 경고 블록 본문(156 vs 86). **스펙이 명시한 3곳(§20.11-15 진입 블록·식순표, §20.19.11-77 출석 시각 면)은 전부 통과**했고, 새로 추가된 다른 문자열에서 발생한다 | 해당 3곳에 한해 `break-keep` 대신 **`break-words`(또는 `overflow-wrap:anywhere`)** 를 허용하라. 문안은 한 글자도 바꾸지 않고 줄바꿈 규칙만 완화하는 것이라 게이트와 무관하다. 참고: **메인페이지도 200% 에서 같은 34px 이 발생하지만 원인은 미니달력(`StruggleCalendar`, 보호 파일·diff 0)** 이라 **이번 작업과 무관한 기존 결함**이다 |

---

## 사용자 지적 사항 — **해소 확인** ★

> *"마음대로 더샵아일랜드파크 위에 박스를 지정하면 안 돼. 길 위에 박스를 그려줘."*

리더가 "알려진 미해결 1건"으로 넘긴 **bbox 사각형이 대오 2 폴리곤 20점 중 4점을 삼키는 문제**는
검증 도중 개발자가 `DSHARP_BOUNDS`(bbox) → `DSHARP_POLYGON`(13정점 실좌표, 닫는 점 제외)로
교체하면서 **해소됐다.** QA 가 좌표로 재계산해 확인했다:

| 검사 | 교체 전(bbox) | 교체 후(실좌표) | 판정 |
|------|--------------|----------------|------|
| 대오 2 점 중 부지 안 | **4개** (`[37.526033,126.919493]`·`[37.526138,126.919386]`·`[37.526243,126.91928]`·`[37.526349,126.919174]`) | **0개** | ✅ |
| 대오 1 점 중 부지 안 | 0개 | **0개** | ✅ |
| 변 교차 | — | **0회** | ✅ |
| 최소 이격 | — | **21.7 m** (검증자 계산 21.8 m 와 일치) | ✅ |
| 부지 면적 | 21,655 m²(bbox) = **1.76배 과대**(검증자 "1.8배"와 일치) | **12,277 m²** | ✅ |
| 자기교차 | — | 부지·대오1·대오2 **전부 0** | ✅ |

- **실브라우저 육안 확인**(1280·360): ④ 대오 2 밴드는 **의사당대로 위**에 있고 부지 폴리곤과 떨어져 있다.
  건물 안으로 들어가라는 뜻으로 읽힐 도형은 **없다.**
- 대오 2 면적 4,932 m² / 연장 123 m ≈ **폭 40 m**, 대오 1 면적 7,786 m² / 195 m ≈ **폭 40 m** — 가는 선이 아니다.
- ⚠ **경미**: `rallyMap.ts` 주석은 `단순화 14노드` 라고 쓰는데 배열은 **13정점**이다. 검증 §5-13-4 의
  14개 목록은 **마지막이 첫 점의 반복(닫는 점)** 이므로 **도형은 동일하고 결함이 아니다.**
  혼동을 피하려면 주석에 `13정점 + 닫는 점` 임을 한 줄 덧붙이면 된다.

---

## 통과 항목

### A. 대오·기호 (§20.17-52~57 · §20.20.7-69~77)

1. ④ 대오 2 = **20점 폴리곤**, ③ 대오 1 = 18점 폴리곤. 폴리라인 0건 — 좌표 파싱으로 확인.
2. ④ 밴드가 **부지 폴리곤과 겹치지 않는다**(위 표). — 최우선 항목.
3. ③ `estimated` 스타일: `strokeOpacity 0` · `strokeWeight 0` · `fillOpacity 0.08` vs ④ `0.20` — 실렌더 확인.
   **두 밴드 사이 경계선 없음**(대오 1 쪽 변이 존재하지 않는 구조적 해결이 실제로 작동).
4. 지도 위 **원은 ② 메인무대 하나뿐**. 내 위치에 정확도 원 **0건**(내 위치 표시 후 SVG 7→8, 추가된 1개는 핀).
5. 라벨 접미어 `③ 대오 1 (범위는 근사)` 실렌더 확인 — 확신도가 **문자로도** 전달된다.
6. 번호가 **지리 순서** `①5번출구 → ②메인무대 → ③대오1 → ④대오2 → ⑤더샵` ✅. ①(left)·②(top) 라벨 **겹침 0**.
7. 범례 6행이 `MAP_FEATURES` 에서 파생. `구간 전후로 이어질 수 있습니다`(④) · `범위는 근사`(③) **문자로 존재**.
   범례 ③④ 행에 `논의 중`·`미확정` **0건**(`논의 중` 은 LED무대 각주에만 — 스펙 지정 문자열).
8. **LED무대 0건**(도형·라벨) · 화장실 핀 **0건** · 도로명 라벨 **0건** · 위성 전환 UI **0건**.
9. 좌표 리터럴이 `src/lib/rallyMap.ts` **밖에 0건**(grep `37.5xxxx|126.9xxxx`).
10. 밴드 스타일이 **`confidence` 에서만** 파생(`BAND_STYLE[feature.confidence]`). 컴포넌트에 id 분기 0건.
    ⚠ 단, `rallyMap.ts:343` 에 `column.id === "column-1" ? "bottom" : "top"` 이 있다. **스타일이 아니라
    라벨 배치**이고 데이터 모듈 안이라 §20.20.7-74 위반은 아니나, **실패 1의 원인 지점**이므로 함께 손보게 된다.

### B. 문안 게이트 · 금지 문자열 (§20.10 · §20.19.10 · §20.21.4)

11. **렌더된 화면 문자열 전수 검사**(HTML → 텍스트 추출): `우측 도로` **0** · `528세대` **0** ·
    `열렸` **0** · `개최` **0** · `성황` **0** · `320` **0** · `크롬` **0** · `설정 >` **0** ·
    `출석 무효` **0** · `20:00까지` **0** · `폐회 후 출석` **0** · `watchPosition` **0**.
    (소스의 동일 문자열은 전부 **"쓰지 마라"는 주석**이며 렌더되지 않는다.)
12. 거리는 **범위 표기**: 블록 2 `국회의사당역 5번 출구에서 의사당대로를 따라 남동쪽으로 약 220~340 m (도보 약 4분)` ·
    지도 대체면 `5번 출구에서 남동쪽으로 약 220~340 m`. 단일 수치 0건.
13. `18:30` 이 페이지 **유일한 대형 수치**(`text-hero`). `18:00` 은 식순표 안에만 존재.
14. 인명 **소속 병기**: `윤석구 금융노조 위원장` · `김동명 한국노총 위원장`.
15. `※ 상황에 따라 식순 변경 가능` 이 **`<caption>` + 표 아래 2곳**(실렌더 카운트 2).
16. 화장실 `여의도공원 화장실 2호(개나리) 이용` + 병기 줄 존재.
17. **인용부호 전건 곡선따옴표** — 렌더 텍스트에 **직선 `"` 0개**. 문안 내용은 §20.10 표와 문자 단위 일치.
18. 블록 2 유보 문구(`논의`·`미확정`) 0건, `※ 현장에서 지부 깃발을 확인해 주세요.` 존재.
19. `설치될 예정`(무대) · `배포할 예정`(QR 손피켓) **유지** — 운영=확정 / 배포=예정 구분 보존.

### C. QR 출석 블록 (§20.19.11-75~86 · §20.21.6-92·93)

20. 블록 순서 **집결 → 코스콤지부 위치 → QR 출석체크 안내 → 위치 지도 → 무대·화장실 → 결의대회 순서** ✅.
21. 카드 내부 순서 **출발 전 확인 → 출석 2회 → 인증 제한 → 경고**, 경고가 **카드 하단**.
22. **채색 면이 출석 시각 `dl` 하나뿐** — 카드 안 전 요소의 `background-color` 를 실측해 흰색/투명이 아닌 것은
    `rgb(217,233,255)`(`bg-primary-soft`) **1개**. 색 텍스트도 `rgb(9,51,137)` 가 그 면 안에만 존재(라벨·시각 6개).
    ①③④ 에 채색 면·색 텍스트 **0건**.
23. **`※ 2차 출석 시간은 식순상 폐회(20:20~)보다 늦게까지 열려 있습니다. 폐회 후라도 2차 출석을 아직
    하지 않았다면 21:00 전에 완료해 주세요.` 존재** — 생략 0.
24. 경고 블록: 테두리 `rgb(107,114,128)`(#6b7280) · 배경 없음 · 아이콘 `rgb(75,85,99)`(#4b5563, `aria-hidden="true"`) ·
    **`role="alert"` 없음** · **적색 0건**.
25. 이미지: `alt` 가 §20.19.10-24 문자열 그대로(`주최측 배포 “QR 출석체크 안내” 원본 이미지 — 같은 내용이 위
    텍스트에 있습니다`), `alt=""` 아님. 캡션 `주최측 배포 안내자료`. **스캔 유도 문구 0 · 스캔 금지 문구 0.**
    실파일 1920×1080 RGBA 283KB, `unoptimized` 로 원본 서빙, 표시 폭 **480px**(768/1280), 360px 에서 288px.
26. **손피켓 별도 블록(4-A) 없음** — 같은 피켓이 두 번 나오지 않는다.
27. 블록 4 가 **`무대`·`화장실` 2장**(768px 에서 `344px 344px` 2열), 제목에 `출석` 문자 0건.
    출석 정보는 블록 2-A 한 곳에만, 배포 "예정" 문장은 이미지 캡션 자리에 존재.
28. 이미지를 지워도 정보 손실 0 — 핵심 5건(브라우저·1차·2차·인증 제한·실패 시 경로)이 전부 텍스트.

### D. 내 위치 — 5경로 전부 직접 재현 (§20.14 · §20.21.6-87~91)

`navigator.geolocation` 을 제어 가능한 스텁으로 치환해 5경로를 실행했다(**페이지 코드 무수정**).

| 경로 | 실측 결과 |
|------|----------|
| 허용·범위 안 (acc 15) | `내 위치를 지도에 표시했습니다. 집결 위치에서 남동 약 250m (정확도 약 ±15m)` · 핀 1개 추가 · 범례에 번호 없는 `내 위치` 행 추가 · 버튼 `다시 확인` |
| 허용·범위 밖 (서울역, acc 20) | `내 위치는 지도 범위 밖입니다. 집결 위치에서 북동 약 5.6km (정확도 약 ±20m)` · **핀 미생성** · 범례 행 미표시 |
| 거부 (code 1) | `위치 표시를 사용하지 않습니다. 위 안내와 지도만으로도 집결 위치를 확인할 수 있습니다.` |
| 타임아웃 (code 3) / 위치불가 (code 2) | `위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.` |
| 저정확도 (acc 120 > 40) | 1행 + **`위치 정확도가 낮아 지도 위 표시가 실제와 다를 수 있습니다.`** 한 줄 추가 |
| `accuracy` 이상값 (0) | 정확도 문구 **자동 생략** |

29. **`fitBounds` 재호출 0** — 범위 밖 호출 전후 라벨 5개의 지도 내부 좌표가 **전부 동일**
    (`194,106|238,33|292,234|348,163|297,329` → 동일). 지도가 서울 전체로 축소되는 사고 없음.
30. **`watchPosition` 호출 0회**, `getCurrentPosition` 은 **버튼 클릭 시에만**(페이지 진입 시 0회).
    옵션이 `{enableHighAccuracy:true, timeout:10000, maximumAge:30000}` 로 스펙과 일치.
31. **재요청 누적 0** — 2회 연속 호출 후에도 핀 1개·SVG 8개 유지.
32. **위치가 서버로 가지 않는다** — 네트워크 요청 **전수 116건** 검사. 좌표·`latitude`·`geo` 등 패턴 **0건**.
    비정적 요청 2건뿐이며 `kr-col-ext.nelo.navercorp.com/_store`(본문 = `{"log":"setMapTypeId", …, "ncpKeyId", "mapTypeId"}` — **좌표 없음**, 네이버 SDK 자체 텔레메트리)와 Next RSC 프리페치다.
    `localStorage` 는 네이버 SDK 의 `__mantle_tile_meta_data` 1건뿐이며 좌표 미포함. `sessionStorage` 0 · 쿠키 0 · URL 불변.
33. **§20.14.2 두 문장 화면 존재**: `길찾기 보조 기능이며 출석체크와 무관합니다 — 출석은 주최측 QR로 진행하고,
    **위치 권한은 사이트마다 따로 물어봅니다**` + `서버로 보내거나 저장하지 않습니다`.
34. 거부 문구가 `role="status"`(assertive 아님) · `role="alert"` 0 · **적색 0**(계산색 `rgb(26,26,26)`) · 경고 아이콘 0.
35. 버튼이 **지도 박스 밖**, 높이 48px(≥44) · `min-h-touch`. 지도 실패 상태에서 **버튼 미렌더** 확인.
36. 핀이 **물방울 SVG(24×32, viewBox `0 0 24 32`)** 로 ① 원형 도트와 형태가 다르고, 라벨 `내 위치` 에 **번호 배지 없음**.

### E. 지도를 못 볼 때 (§0.4 · §20.4.5 · §20.11-16~22)

37. **JS 차단**(서버 HTML 원문): 대체면이 **초기 DOM 에 존재**하고 `지도를 불러오는 중입니다.` +
    `집결 장소 — 국회의사당역 5번 출구` / `코스콤지부 — 더샵아일랜드파크 앞 의사당대로 [대오 2]` /
    `5번 출구에서 남동쪽으로 약 220~340 m` 3줄이 그대로 보인다.
38. **인증 실패**(`navermap_authFailure()` 호출로 재현): `지도를 불러오지 못했습니다.` + 같은 3줄,
    박스 크기 유지(CLS 0), 범례 그대로, **내 위치 버튼 미렌더**, 블록 2 텍스트 온전.
39. **Client ID 미설정**(`.env.local` 을 빈 값으로 바꿔 실행 후 원복): 스크립트 태그 **0** ·
    `map-heading`/`위치 지도` **0** · **오류 문구 0** · 나머지 5개 섹션(`집결 안내`·`코스콤지부 집결 위치`·
    `QR 출석체크 안내`·`무대 · 화장실`·`결의대회 순서`) 전부 온전. 경고는 **서버 콘솔로만** 나갔다.
40. **비인터랙티브**: 휠·더블클릭으로 지도 **불변**. 터치 드래그에서 `touchstart`/`touchmove`
    **`defaultPrevented: false`**, `touch-action: auto`, 지도 불변 → **페이지가 정상 스크롤된다**.
41. **마운트 노드 `tabindex` 제거 확인**(`null`) — 빈 탭 정지점 0.
    지도 안 focusable 5개는 전부 **네이버 공지/저작권/OpenStreetMap 링크**(약관상 필수)이며 우리 요소 0.
42. 라벨 마커 DOM 전체가 `aria-hidden="true"` — SR 낭독은 범례가 담당.

### F. 상태 전이 (§20.6 · §20.11-25~28)

임시 라우트(`src/app/qa-tmp-phase/`, **검증 후 삭제**)에서 `rallyPhase(new Date(...))` 로 4시점을 주입했다.

| 주입 `now` | phase | 배지 | 테두리 | CTA | past 문장 |
|---|---|---|---|---|---|
| 2026-08-27 | `upcoming` | 없음 | `border-primary` | 채움 버튼(`bg-primary`) | — |
| 2026-08-28 | `today` | `오늘` | `border-primary` | 채움 버튼 | — |
| 2026-08-29 | `past` | `완료` | `border-border-strong` | 텍스트 링크 | `2026년 8월 28일 일정이 지났습니다. 아래 안내는 기록으로 남겨 둡니다.` |
| 2026-09-05 | `past` | `완료` | `border-border-strong` | 텍스트 링크 | 동일 |

43. 사용자 지정 문구 `8/28(금) 저녁 결의대회 참석 안내` 가 **4시점 전부 한 글자도 바뀌지 않았다**. `line-through` **0건**.
44. past 문장이 §20.10-4 리더 확정 문자열과 **문자 단위 일치**. `열렸`·`개최`·`성황` 0건.
45. **past 에서 콘텐츠 숨김 0** — `page.tsx:112~116` 은 문장 `<p>` 를 **추가**할 뿐이고, 지도·식순표·화장실·QR 블록은
    전부 `phase` 와 무관하게 렌더된다(조건부 렌더 0). 코드 경로 전수 확인.

### G. 메인 진입 블록 · 온누리 카드 (§20.11-1~8 · §20.12.9)

46. 블록 순서 **HeroPanel → DeadlineStrip → 미니달력 → RallyEntryCard → OnnuriGuideCard** ✅.
47. **urgent 공지 유무와 무관** — `RallyEntryCard` 는 `HeroPanel` 의 형제이고 어떤 조건문 안에도 없다(`page.tsx:130~132`).
48. 미니달력 미렌더 상태에서도 남는다 — 달력 `div` 만 조건부이고 진입 블록은 **자기 `mt-8` div 1개**라 여백이 겹치지 않는다.
49. 진입 블록에 **D-n 없음**, `<h2>` 없음(메인 헤딩 아웃라인 불변), 인터랙티브 요소 **CTA 1개**,
    표면이 **테두리 단독**(`border-2` + `bg-bg`, 그림자 0).
50. 링크 라벨 1:1 — `참석 안내 보기` → `/rally-2026-08-28`, `자세히 보기` → `/bargaining-2026`(전수).
51. **온누리 카드**: 도메인 `onnuri.koscomlabor.cloud` 가 **3번째 줄**, 기존 2줄 문구·클래스 불변(diff 확인),
    **잘림 0**(`break-all`, 360px·200% 모두 카드 안), 도메인 span 에 `aria-hidden="true"` →
    **접근성 이름에 주소 미포함**(계산: `디지털온누리 사용 가이드 코스콤 조합원 대상 안내 · 외부 페이지가 새 창에서 열립니다`),
    `box-shadow: none` · `border-left-width: 0px` — **제거됐던 그림자·좌측 보더가 되살아나지 않았다.**
52. 문자열이 `href` 에서 파생(`new URL(EXTERNAL_LINKS.onnuriGuide).host`) — 하드코딩 0.

### H. 회귀 (§20.11-29~33)

53. **보호 파일 6종 diff 0줄**: `src/app/globals.css` · `HeroPanel.tsx` · `DeadlineStrip.tsx` ·
    `StruggleCalendar.tsx` · `struggleSchedule.ts` · `SiteFooter.tsx`.
54. `/bargaining-2026` 에 **추가된 것은 8/28 카드의 링크 1개**(+ import 3줄). 기존 요소 변경 0.
55. 메인페이지 diff = `RallyEntryCard` 블록 1개 추가. 미니달력·마감 스트립·온누리 정상 렌더 확인.
56. `icons.tsx` = `ArrowLeftIcon` 추가만. `routes.ts` = `rally0828` · `ONNURI_GUIDE_DISPLAY_HOST` 추가만.
57. **`RALLY_DATE` ↔ `STRUGGLE_SCHEDULE` 가드가 조용하다** — 서버 로그에 `[rally] RALLY_DATE` 경고 0건.

### I. 접근성 · 반응형 · 빌드

58. **대비 실측**(`check-contrast.mjs`): `#093389:#d9e9ff` **9.23** · `#1a1a1a:#ffffff` **17.40** ·
    `#4b5563:#ffffff` **7.56** · `#6b7280:#ffffff` **4.83**(UI 3:1 — 테두리 전용) ·
    `#7a3806:#fdf0e7` **7.84**. 스펙 §20.7·§20.16·§20.19.8·§20.21.5 선언값과 **전건 일치**. 신규 조합 0.
59. **헤딩 아웃라인**: `h1` 1개 → `h2` 6개(집결 안내·코스콤지부 집결 위치·QR 출석체크 안내·위치 지도·
    무대 · 화장실·결의대회 순서) → `h3` 2개(무대·화장실). **건너뜀 0**.
60. **360 / 768 / 1280 가로 스크롤 0**(100% 배율). 지도 라벨 5개 **전 뷰포트에서 잘림 0**, 라벨끼리 겹침 0.
61. **식순표 시간 열이 `18:00~18:30` 을 1줄로 담는다**(360px 실측: `<wbr>` 로 나뉜 텍스트 조각 2개가
    `top` 동일 = 1행, 폭 47+38=85px < 열 폭 112px).
62. **출석 시각 면이 200% 에서 내부 스크롤로 흡수된다** — `overflow-x: auto`, `scrollWidth 455 > clientWidth 216`,
    `whitespace-nowrap` 유지(시각이 두 줄로 끊기지 않는다). §20.19.11-77 통과.
63. `npm run build` **성공**(라우트 9개, `/rally-2026-08-28` = `1m` revalidate) ·
    `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0**.
64. `as any`/`@ts-ignore` 류 타입 우회 **0건**.

---

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | **§20.20.7-75 — `RALLY_COLUMNS` 에서 항목을 실제로 지워 도형·라벨·범례가 함께 사라지는지** | 검증 중 `rallyMap.ts` 를 **dev-rally 가 동시 편집**하고 있어 프로덕션 소스를 임시 수정하면 개발자 작업과 충돌한다. **구조적으로는 확인**했다: `MAP_FEATURES = [..., ...RALLY_COLUMNS.map(toBandFeature), ...]` 하나에서 도형(`drawFeature`)·라벨(`createLabelMarker`)·범례(`figcaption` map)·`MAP_FIT_BOUNDS` 가 **모두** 파생되므로 부분 누락이 발생할 경로가 없다. 실제 삭제 재현은 개발자 작업 종료 후 요청 시 수행 가능 |
| 2 | 스크린리더 실낭독(NVDA/VoiceOver) | 보조기기 실행 환경 없음. DOM 은 전수 확인(라벨 마커 `aria-hidden`, `<dl>` 쌍, `role="status"`, `sr-only` 장형, `figcaption` 범례) |
| 3 | 실기기 터치 드래그·핀치 줌 | 물리 터치 기기 없음. 합성 `TouchEvent` 로 `defaultPrevented: false` · `touch-action: auto` · 지도 불변까지 확인했고, 핀치는 `pinchZoom: false` 설정만 코드로 확인 |
| 4 | QR 이미지의 실제 스캔 가능 여부 | 스펙이 **스캔 대상이 아니라고 명시**(§20.19.4)했고 QR 대상 URL 이 미확인이라 판정 대상이 아니다 |
| 5 | 20:00 이후 실시간 코드 변경분 | `rallyMap.ts` 가 19:59:33 에 재저장됐다. **그 이후 변경은 이 리포트에 반영되지 않았다** |

---

## 리더 판단 요청 1건

**§20.20.1 의 `①은 마커 위, ②는 원 아래` 지시와 구현이 다르다.**
구현은 ① `placement: "left"` · ② `placement: "top"` 이다(`rallyMap.ts:374·388`).
개발자 주석은 360px 실측(출구 라벨 98px 는 왼쪽 여백에 들어가고 무대 라벨은 길어 위쪽에만 들어간다)을 근거로 든다.
**QA 실측 결과 두 라벨은 전 뷰포트에서 겹치지 않으므로 §20.11·§20.20.7-73 의 수용 조건("서로 가리지 않는다")은
충족**한다. 스펙 문구를 구현에 맞춰 개정할지, 구현을 스펙에 맞출지는 디자이너·리더 판정 사항이다.

---

## 비고 — 검증 산출물 정리

- 임시 라우트 `src/app/qa-tmp-phase/page.tsx` (상태 전이 `now` 주입용) — **삭제 완료**.
  삭제 후 남은 `.next/types` 스텁은 `npm run build` 재생성으로 해소됐고 최종 `tsc` 오류 0이다.
- `.env.local` 을 Client ID 미설정 검증 위해 일시적으로 빈 값으로 바꿨다가 **원복 완료**
  (`NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=x79smqla3u` 재확인).
- Playwright 산출물(`.playwright-mcp/` 스크린샷·콘솔 로그·스냅샷)과 스크래치패드 HTML·PNG — **삭제**.
- 지오로케이션 스텁은 **브라우저 런타임에만** 주입했고 소스 파일은 건드리지 않았다.
- 로컬 `next dev -p 3000` 은 dev-rally 가 계속 쓰고 있어 **종료하지 않았다**(QA 가 기동한 프로세스이므로
  작업 종료 시 정리 필요하면 알려 달라). 포트 3100/3200 추가 기동은 Next 16 의 단일 인스턴스 가드로 **실패**했고,
  그 대신 `.env.local` 원복 방식과 `navermap_authFailure()` 호출로 두 실패 경로를 재현했다.
- 브라우저 콘솔의 `localhost:3100` 401/ERR_CONNECTION_REFUSED 항목은 **개발자의 이전 세션 잔재**이며 이번 검증과 무관하다.
  검증 도중 관측된 `ReferenceError: polygonCenter is not defined` 500 은 **동시 편집 중간 상태**에서 발생했고
  최종 상태에서는 재현되지 않는다(페이지 200 · 빌드 성공).
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트 18회차 — **지도 파트 재실행** (개발자 수정 반영본)

**사유**: 18회차 본검증 중 `rallyMap.ts`·`RallyMap.tsx` 가 교체됐다. 리더 신호로 **지도 파트만 통째로 재실행**했다.
**검증 대상 코드**: `src/lib/rallyMap.ts` · `src/components/rally/RallyMap.tsx` **mtime 20:00:25**
**실행 환경**: `next dev -p 3000` · Chromium · 360 / 768 / 1280
**재검증 시각**: 2026-08-18 20:05~20:20 KST

## 재실행 결과: **실패 1 해소 · 실패 2 존치(원인·처방 정정) · 신규 권고 1**

---

## 실패 1(③④ 라벨이 밴드를 덮음) — **해소** ✅

앵커를 **bbox 변 중점 → 도형 극점**(`anchorAtExtreme`)으로 바꾸고 밴드 `placement` 를
**대오 1 = `top` · 대오 2 = `bottom`** 으로 뒤집었다(`rallyMap.ts:350`).
두 밴드가 북서–남동으로 이어지므로 **북쪽 밴드의 라벨은 위로, 남쪽 밴드의 라벨은 아래로** 나가
어느 라벨도 어느 밴드에 닿을 수 없다 — 규칙 준수가 아니라 **구조적 위반 불가**다.

**QA 는 라벨 pill ↔ 실제 폴리곤의 교차로 다시 쟀다**(라벨끼리의 겹침과는 다른 측정이다).
네이버가 렌더한 `<path d>` 좌표가 마운트 기준 픽셀이므로 그것을 파싱해 **점-in-폴리곤으로 1px 격자 적분**했다.

| 뷰포트 | 지도 박스 | 축척 | **③ 대오 1 덮임** | **④ 대오 2 덮임** | 라벨끼리 겹침 | 라벨 잘림 |
|---|---|---|---|---|---|---|
| 360 | 328×246 | 300m | **0 / 545 px² = 0%** | **0 / 340 px² = 0%** | 0 | 0 |
| 768 | 704×396 | 100m | **0 / 2210 px² = 0%** | **0 / 1384 px² = 0%** | 0 | 0 |
| 1280 | 896×504 | 100m | **0 / 2210 px² = 0%** | **0 / 1384 px² = 0%** | 0 | 0 |

**③④ 남북 순서가 지리 순서와 일치한다** (라벨 상단 y 좌표, 전 뷰포트 동일 패턴):

| 뷰포트 | ② 메인무대 | **③ 대오 1** | ① 5번 출구 | **④ 대오 2** | ⑤ 부지 |
|---|---|---|---|---|---|
| 360 | y2 | **y38** | y69 | **y163** | y203 |
| 768 | y18 | **y77** | y106 | **y277** | y337 |
| 1280 | y72 | **y131** | y160 | **y331** | y391 |

→ **③(대오 1)이 항상 ④(대오 2)보다 북쪽**. 18회차 본검증에서 지적한 지리 순서 역전이 사라졌다.

---

## 부지 폴리곤 교체 — **재확인 완료** ✅

최종 코드(13정점 = 검증 §5-13-4 의 14개 목록에서 닫는 점 제외)로 다시 계산했다.

| 검사 | 값 | 판정 |
|------|-----|------|
| 대오 2 점 중 부지 안 | **0** | ✅ (본검증의 4점 침범 소멸) |
| 대오 1 점 중 부지 안 | **0** | ✅ |
| 변 교차 | **0회** | ✅ |
| **대오 2 ↔ 부지 최소 이격** | **21.7 m** | ✅ 검증자 계산 21.8 m·개발자 검산 21.7 m 과 일치 |
| 대오 1 ↔ 부지 최소 이격 | 32.9 m | ✅ |
| 부지 점 중 밴드 안 | **0** | ✅ |
| 자기교차 | 부지·대오1·대오2 **전부 0** | ✅ |
| 부지 면적 | 12,277 m² (bbox 였다면 21,655 m² = **1.76배**) | ✅ |

> **⚠ 22m 이격은 정상이다 — 실패로 올리지 않는다.** 리더 지시대로, 그 22m 는 보도·전면 공지(setback)이며
> 밴드를 부지 쪽으로 당기면 대오가 보도 위로 올라가 **사용자가 지적한 원래 문제가 재발한다.**
> 실렌더 육안에서도 밴드는 **의사당대로 위**, 부지는 그 남서쪽에 분리돼 있다.

**렌더 스타일 실측**(계산 스타일):

| 도형 | stroke | width | dash | fill-opacity | 판정 |
|------|--------|-------|------|--------------|------|
| ⑤ 부지 body | `rgb(75,85,99)` | 2px | 없음(실선) | **0** | ✅ **채움 0** · 밴드(3px)보다 **가늘다** |
| ④ 대오 2 body | `rgb(9,51,137)` | 3px | `6,6`(점선) | 0.20 | ✅ |
| ③ 대오 1 body | `rgb(9,51,137)` | **0px / opacity 0** | — | **0.08** | ✅ 테두리 없음 · 0.20 대비 확실히 옅다 |
| ② 원 body | `rgb(75,85,99)` | 3px | `9,3`(점선) | 0.1 | ✅ |

- **지도 위 원은 ② 하나뿐**(arc 를 포함한 path = casing + body 2개 = 원 1개). 정확도 원 0.
- 범례 ⑤ 행이 **`위치 기준 단지 부지`** — 화면·범례에 **`건물` 0건**(검증 요구 35 이행).
  소스의 `건물` 5건은 전부 *"건물이라고 쓰지 마라"* 는 금지 주석이며 렌더되지 않는다.

---

## 개발자 자진 신고 잔여 2건 — **QA 판정**

라벨 pill ↔ 도형의 교차를 실측했다. **채움 없는 도형은 면적이 아니라 외곽선(정보가 실린 곳)** 으로 쟀다.

| 잔여 | 360 | 768 | 1280 | QA 판정 |
|------|-----|-----|------|---------|
| **④ 라벨 ↔ ⑤ 부지 외곽선** | **46.4%** (52/112 px) | **41.3%** (92/223 px) | **41.3%** (92/223 px) | **조건부 통과 + 권고 1건** |
| **③ 라벨 ↔ ② 메인무대 원 둘레** | 26.8% (③ 단독) | 29.2% (**① 13.2% + ③ 16.0%**) | 29.2% (동일) | **통과** |

**① ④↔부지 — 개발자 판단에 조건부 동의. 권고로 남긴다.**
- 동의하는 근거: 부지는 **채움 0 의 참고 지물**이고, **조합원이 서는 곳(밴드)은 0% 가려진다.**
  가려지는 구간이 북서 모서리 쪽에 몰려 있어 **평행사변형이라는 형태와 위치는 남은 외곽선으로 판독된다.**
  게다가 정체는 **지도 타일 자체의 `더샵 아일랜드파크` 문자 + ⑤ 라벨**이 이중으로 말한다.
- 그럼에도 권고인 이유: **41~46% 는 "정보 손실이 작다"고 넘기기엔 큰 값**이다. 부지는 조합원이
  **현장에서 눈으로 대조하는 앵커**라 형태가 보여야 한다(§20.4.1).
- **권고**: ④ 라벨에 `labelAlign: "east"` 를 주라(`rallyMap.ts` 의 밴드 항목). 대오 2 는 부지의
  **동쪽**에 있으므로 라벨을 동쪽 끝 정렬로 밀면 부지에서 멀어진다. 이미 `labelAlign` 인자가
  `anchorAtExtreme` 에 구현돼 있어 **데이터 한 줄 추가로 끝난다.** 적용 후 재측정을 권한다.

**② ③↔메인무대 원 — 통과.**
- 29.2% 중 **13.2%는 ① 5번 출구 라벨**이 만든 것이다. ①과 ②는 **중심이 같은 좌표**라
  스펙이 이미 두 라벨을 서로 다른 방향으로 떼어 놓기로 승인한 구조적 결과이며 이번 변경분이 아니다.
- ③가 덮는 **16.0%는 원의 북동 호**이고, 원의 **70.8% 가 남아 원형·반경이 그대로 읽힌다.**
  ② 가 담은 정보("5번 출구 앞 대략 범위, 지점 미확정")는 중심 도트 + 남은 호 + 라벨 `(설치 예정)` +
  범례 문장이 **네 겹으로** 전달한다. **정보 손실 없음.**

---

## 실패 2(360px 지도 과축소) — **존치. 단, 원인과 처방을 정정한다** ★

라벨 문제가 사라지면서 이 항목이 **360px 판독성의 유일한 남은 제약**이 됐다.

| 뷰포트 | 지도 박스 | 축척 | 도형 전체 크기 |
|---|---|---|---|
| 360 | 328×246 | **300m** (≈3.79 m/px) | **104×129 px** |
| 768 | 704×396 | 100m (≈1.9 m/px) | 194×246 px |
| 1280 | 896×504 | 100m | 194×246 px |

**⚠ 본검증에서 내가 제시한 처방(`FIT_PADDING` 비례 축소)은 틀렸다. 정정한다.**
런타임에서 지도 박스 높이만 바꿔 가며 실측한 결과:

| 328px 폭에서 박스 높이 | 축척 | 도형 크기 |
|---|---|---|
| **246px (현재 `aspect-[4/3]`)** | 300m | 104×129 |
| 328px (`aspect-square`) | **300m — 개선 없음** | 104×129 |
| **400px** | **100m** | **194×246** |
| 437px (`aspect-[3/4]`) | 100m | 194×245 |

- 표시해야 할 범위는 zoom 16 에서 **세로 246px** 를 요구한다. 현재 박스 높이가 **246px** 이므로
  **패딩을 0으로 줄여도 들어가지 않는다** — 패딩이 아니라 **박스가 세로로 짧은 것**이 원인이다.
  도형 묶음이 **세로로 긴 형태(194×246)** 인데 박스는 가로로 긴 4:3 이라 축이 어긋나 있다.
- **처방**: 모바일 지도 박스를 **높이 400px 이상**으로 (`aspect-[4/3]` → 약 **`aspect-[4/5]`**, 328×410).
  실측상 이 지점에서 축척이 300m → **100m 로 떨어지고 도형 면적이 약 3.5배**가 된다.
  `md:aspect-[16/9]` 는 이미 충분하므로 **모바일 비율만** 고치면 된다.
- 대안(효과 작음): `FIT_PADDING` 을 박스 높이 비례로 줄이는 것 — 단독으로는 해결되지 않는다.

---

## 재실행에서 함께 확인한 것

- **두 밴드 사이 경계선 없음** — 실렌더 육안. 좌표상 틈 9.9m 는 이 축척에서 인지되지 않는다.
  `estimated` 에 테두리를 주지 않은 구조적 해결이 실제로 작동한다.
- 지도 번호가 **①5번출구 → ②메인무대 → ③대오1 → ④대오2 → ⑤더샵** (지리 순서) 유지.
- 라벨 5개 전부 **전 뷰포트에서 잘림 0 · 라벨끼리 겹침 0**.
  ⚠ 경미: 360px 에서 ② 라벨 상단 여백이 **2px** 로 매우 얇다(잘리지는 않는다).
- `npm run build` **성공** — 페이지 라우트 **7개**(`/`·`/admin`·`/bargaining-2026`·`/education/[id]`·
  `/news/[id]`·`/notices/[id]`·`/rally-2026-08-28`), **`qa-tmp-phase` 미포함**.
  `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0**.

---

## 기록해 둘 것 — **축정렬 근사는 대각선 지물에 맞지 않는다** ★

이번 작업에서 같은 뿌리의 결함이 **두 번** 나왔다. 다음에 같은 실수를 막기 위해 남긴다.

| 사고 | 축정렬 근사 | 실제 지물 | 결과 |
|------|------------|-----------|------|
| 부지 표현 | **bbox 사각형** | 도로와 나란한 **평행사변형** | 면적 **1.76배 과대** · 북동 모서리가 **대오 2 폴리곤 4점을 삼켰다** |
| 라벨 앵커 | **bbox 변의 중점** | **대각선 밴드** | 앵커가 밴드 위가 아니라 **옆 허공**에 잡혀 라벨이 **이웃 밴드를 덮었다** |

**규칙**: 이 지도의 지물은 의사당대로를 따라 **북서–남동 대각선**으로 놓여 있다.
`bbox`·`변 중점` 같은 **축정렬(axis-aligned) 파생값을 도형의 대표값으로 쓰지 마라.**
필요하면 **실좌표 폴리곤 · 폴리곤 중심(`polygonCenter`) · 극점(`anchorAtExtreme`)** 을 써라.
`featureBounds`/`MAP_FIT_BOUNDS` 처럼 **감싸는 범위**를 구할 때만 bbox 가 옳다.

---

## 18회차 최종 종합

| 구분 | 건수 | 내용 |
|------|------|------|
| **통과** | **74** | 본검증 71 + 재실행 신규 3(라벨×밴드 겹침 0 · 지리 순서 일치 · 부지 렌더 스펙) |
| **실패** | **2** | ① **360px 지도 과축소**(처방 정정본) ② **200% 확대 시 가로 스크롤 34px** |
| **권고** | **1** | ④ 라벨이 부지 외곽선 41~46% 덮음 → `labelAlign: "east"` |
| **미검증** | **5** | 본검증과 동일(`RALLY_COLUMNS` 실삭제 · SR 실낭독 · 실기기 터치 · QR 실스캔 · 이후 변경분) |

**본검증의 실패 1(라벨이 밴드를 덮음)은 해소됐다.** 사용자 지적 사항(대오가 도로 위에 있는가)은
**좌표·렌더 양쪽에서 확인된 통과**이며, 이것이 이번 QA 의 핵심 통과 항목이다.

## 정리

- 임시 라우트 `src/app/qa-tmp-phase/` **삭제 완료** — `find src -name "*qa*tmp*"` **0건**,
  `.next/types` 잔존 참조 **0건**, 빌드 라우트 목록에 **미포함**. `tsc` 오류 0.
- 재실행 산출물(`.playwright-mcp/` 스크린샷·크롭) **삭제**. 지도 박스 높이 실험은 **런타임 인라인 스타일**로만
  했고 즉시 원복했다 — **소스 무수정**.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트 18회차 — **최종 회귀** (개발자 수정 3건 반영본)

**대상 코드**: `rallyMap.ts` **20:28:51** · `RallyMap.tsx` **20:23:43** · `page.tsx`·`QrAttendanceCard.tsx` **20:19:38**
**서버**: 개발자가 20:32:22 에 만든 **프로덕션 빌드**를 `next start -p 3000` 로 서빙 중인 것을 그대로 사용했다
(빌드 시각이 최종 소스 변경 20:28:51 **이후**이고, 서빙 HTML 에 `aspect-[4/5]` 가 확인돼 최신 코드임을 검증했다.
개발자 소유 프로세스라 종료하지 않았고, 내 서버를 따로 띄우지 않았다 — 포트 충돌·`.next` 재생성 사고를 원천 차단).
**회귀 시각**: 2026-08-18 20:34~20:50 KST

## 최종 회귀 결과: **실패 0** | 권고 1 | FOLLOWUPS 이관 1 | 미검증 5

---

## 1. 실패 2(360px 지도 과축소) — **해소** ✅

| 항목 | 기준선(수정 전) | **최종** | 판정 |
|------|----------------|---------|------|
| 지도 박스(360px) | 328×246 (`aspect-[4/3]`) | **328×410** (`aspect-[4/5]`) | ✅ |
| 축척 | **300m**(≈3.79 m/px) | **100m**(≈1.9 m/px) | ✅ |
| 도형 전체 | **104×129 px** | **194×246 px** | ✅ **면적 3.56배** |

- 768/1280 은 종전대로 축척 100m · 도형 194×246 — **회귀 없음**.
- ⚠ 개발자 실측치는 `180×234`(면적 3.1배)였다. QA 측정은 `194×246`(3.56배)이다.
  **차이는 흰 casing 스트로크(7px) 포함 여부**로 보인다 — QA 는 SVG 요소의 경계상자를 그대로 썼고
  casing 이 도형 바깥으로 3.5px 씩 번진다(194−180 = 14 ≈ 3.5×4). **방향과 결론은 동일**하며 어느 쪽이든 합격이다.

## 2. 실패 1(라벨이 도형을 덮음) · 권고 1(④×부지) — **전부 해소** ✅

라벨 pill ↔ **실제 폴리곤** 교차, 채움 없는 도형은 **외곽선·둘레** 기준으로 측정했다.

| 대상 | 기준선 | **360** | **768** | **1280** | 판정 |
|------|--------|---------|---------|----------|------|
| ③ 대오 1 (면적) | 0% | **0%** | **0%** | **0%** | ✅ 유지 |
| ④ 대오 2 (면적) | 0% | **0%** | **0%** | **0%** | ✅ 유지 |
| ⑤ 부지 (외곽선) | 41.3~46.4% | **0%** | **0%** | **0%** | ✅ **권고 해소** |
| ② 메인무대 (둘레) | 29.2%(①13.2+③16.0) | **13.2%**(전부 ①) | **13.2%**(전부 ①) | **13.2%**(전부 ①) | ✅ **③ 몫 0%** |
| 라벨끼리 겹침 | 0 | **0** | **0** | **0** | ✅ |
| 라벨 잘림 | 0 | **0** | **0** | **0** | ✅ |

- **지리 순서 유지**(라벨 상단 y, 1280): ②59 → **③대오1 99** → ①160 → **④대오2 373** → ⑤415.
- **③×원 재판정**: 내가 앞서 "원의 70.8% 잔존 → 통과"로 판정한 건은 **제약이 바뀌어 0% 가 됐다.**
  세로형 박스가 만든 여유를 ②(gap 42)·③(gap 46) 재배분에 쓴 결과다. **가릴 이유가 없어졌으므로 0 이 옳다**는
  개발자 논거에 동의한다 — 원은 "무대는 이 범위 어딘가"라는 **불확실성 자체를 전달하는 도형**이라 호가 잘릴수록
  범위가 작아 보인다. 남은 13.2%는 **①과 ②가 같은 좌표를 공유**해서 생기는 구조적 몫이며 이번 변경분이 아니다.

### ⚠ 지시와 다른 구현 1건 — **수용 판정**

리더 지시는 ④에 `labelAlign: "east"` 였으나 개발자는 **`labelGap: 44` + `placement: "bottom"`** 을 썼다.
QA 실측으로 확인한 결과 **목적이 달성됐고 지시안(east)은 실제로 불가능했다**:

- 최종 구현: **부지 덮임 0% · ④ 라벨 잘림 0**(360px 우측 여백 4px 로 아슬아슬하나 잘림은 없다).
- 지시안이 불가능한 이유(실측 근거): 360px 박스 폭 328px, 도형 폭 194px → **수평 여유 134px**.
  ④ 라벨 폭이 **164px** 이라 좌우 어느 쪽으로도 들어갈 자리가 없다. 동쪽 정렬 시 개발자 실측대로 잘린다.

→ **지시의 문자가 아니라 목적("부지를 덮지 않게")을 달성했으므로 수용한다.**

## 3. 실패 3(200% 확대 가로 스크롤) — **원인 귀속을 정정한다** ★

**내 본검증의 원인 진단이 틀렸다.** 나는 범례 ⑤ 행·블록 2 첫 줄·경고 블록을 원인으로 지목하고
`break-words` 를 처방했는데, **그 요소들은 문서 가로 스크롤을 만들지 않는다.**

**결정적 실험**(360px · 텍스트 200%): `footer` 를 `display:none` 으로 숨겼을 때

| 상태 | `documentElement.scrollWidth` | `clientWidth` |
|------|------------------------------|---------------|
| footer 포함 | **394** | 360 |
| **footer 숨김** | **360** | 360 |

→ **34px 전량이 `SiteFooter` 발이다.** 원인 요소까지 특정했다:
**footer 브랜드 로고 `<img class="h-7 w-auto">`** — `h-7` 이 rem 기반이라 200%에서 높이가 2배가 되고
`w-auto` 라 폭도 113→**226px** 로 늘어 footer 가로 배치가 360px 를 넘긴다(우측 끝 **394px**).

**내가 틀린 지점**: `scrollWidth > clientWidth` 를 문서 가로 스크롤의 충분조건으로 읽었다.
`main` 의 컨테이너는 `px-4`(좌우 16px) 패딩을 갖고 있어, 내용이 컨테이너 폭(296px)을 넘어도
**패딩 영역 안에서 흡수되어 328px 를 넘지 않는다** — 그래서 문서 스크롤에 기여하지 않는다.
**개발자 보고가 정확했다.**

**판정**:
- **이번 작업 범위에서는 해소** — `main` 콘텐츠발 가로 스크롤 **0**.
- 남은 34px 은 **`SiteFooter`(보호 파일, diff 0줄 확인)** 의 기존 결함이며 **FOLLOWUPS 7번으로 이관**한다.
  이번 작업이 만든 것이 아니고, 메인페이지 등 **전 페이지에 동일하게 존재**한다.
- 개발자가 넣은 `break-words` 5곳(`RallyMap` 3 · `page` 1 · `QrAttendanceCard` 1)은 **해가 없고
  긴 고유명사의 컨테이너 초과 자체는 실제로 줄었다.** 되돌릴 필요 없다.

## 4. 신규 관찰 — **권고 1건: 라벨 여백 여유가 얇다**

리더 요청대로 라벨 5개의 지도 박스 경계 대비 여백을 **개별 px** 로 냈다. 잘림은 전 뷰포트 0 이지만
**한 자리 수 여백이 3건** 있다. 폰트 렌더링·타일 로케일 차이로 라벨 폭이 몇 px 만 늘어도 잘린다.

**360px** (박스 328×410)

| 라벨 | 상 | 하 | 좌 | 우 | 폭 |
|------|----|----|----|----|-----|
| ① 5번 출구 | 113 | 263 | **4** ⚠ | 226 | 98 |
| ② 메인무대(설치 예정) | 12 | 364 | 50 | 114 | 164 |
| ③ 대오 1 (범위는 근사) | 52 | 324 | 143 | **19** | 166 |
| ④ 코스콤지부 [대오 2] | 326 | 50 | 160 | **4** ⚠ | 164 |
| ⑤ 여의도더샵아일랜드파크 | 368 | **8** ⚠ | 109 | 31 | 189 |

**768px** (박스 704×396) — 최소값 **⑤ 하단 1px** ⚠⚠ (360px 보다 더 얇다)
**1280px** (박스 896×504) — 최소값 55px (여유 충분)

- 개발자 보고("①은 gap 38 이면 잘렸다 = 여유 8px")와 정합적이다. 실제 좌측 여백이 **4px** 남았다.
- **권고**: 여백 하한을 **8px 이상**으로 확보하라. `FIT_PADDING` 을 몇 px 키우는 것으로 흡수될 가능성이 크다
  (좌 56 → 64, 하 48 → 56). **라벨 문자열은 손대지 마라 — 문안 게이트 영역이다.**
- **실패로 올리지 않는 이유**: 현재 3뷰포트 전부 잘림 0 이고, 잘림이 발생하면 그때는 §20.23.1 이 정한
  스펙 재조정(라벨 축약·지시선·박스 재조정) 사유가 되어 디자이너 판단이 필요하다.

## 5. 회귀 확인 — 나머지 전건 통과

| 항목 | 결과 |
|------|------|
| **기하** | 부지 13정점·대오1 18점·대오2 20점 **불변**. 부지 안 점 **0**(양 밴드) · 변교차 **0** · **최소 이격 21.7m**(대오2) / 32.9m(대오1) · 부지 점 중 밴드 안 **0** · 자기교차 **0**(3도형). **22m 이격은 정상**(보도·전면 공지) |
| **렌더 스펙** | ⑤ 부지 `fill-opacity 0`·stroke 2px 실선 / ④ 점선 3px·fill 0.20 / ③ stroke 0·fill 0.08 / ② 점선 원. **지도 위 원 1개**(② 하나) |
| **문안 게이트** | 렌더 텍스트 전수 — 금지 `우측 도로`·`528세대`·`열렸`·`개최`·`성황`·`320`·`크롬`·`설정 >`·`출석 무효`·`20:00까지`·`폐회 후 출석`·**`건물`** 전부 **0**. **직선따옴표 0개**. 필수 문자열 **21건 누락 0**. `※ 상황에 따라 식순 변경 가능` **2곳** |
| **헤딩 아웃라인** | h1 1 → h2 6 → h3 2, 건너뜀 0 (본검증과 동일) |
| **메인 진입 블록·온누리** | `8/28(금) 저녁 결의대회 참석 안내` · `집결 18:30 · 국회의사당역 5번 출구` · `참석 안내 보기` · `onnuri.koscomlabor.cloud` · 기존 2줄 문구 전부 **1건씩 정상** |
| **상태 전이** | 관련 파일 4종(`rally.ts`·`RallyStatus.tsx`·`RallyEntryCard.tsx`·`struggleSchedule.ts`) 모두 **17:31 이전** — 이번 수정 3건과 **경계면 변경 0**. `page.tsx` 의 phase 분기 3곳 그대로. 빌드 청크에 past 문장 문자열 **존재**(분기 생존). 현재 upcoming 렌더 정상(배지 없음·past 문장 없음), 사용자 지정 문구 불변, `line-through` **0** |
| **내 위치** | 버튼 **44px**·지도 박스 **밖** · 표시 후 **라벨 5개 좌표 완전 동일**(`fitBounds` 재호출 0) · 핀 1개 · **정확도 원 0** · `watchPosition` **0** · 범례 `내 위치` 행 추가(번호 없음) · 분리 문구 2건·미저장 문구 존재 · `localStorage` 는 네이버 SDK 1건뿐·쿠키 0·URL 불변 |
| **빌드** | 개발자 빌드(20:32:22, 최종 소스 20:28:51 이후) 산출물 검증 — 페이지 라우트 **7개**, **`qa-tmp-phase` 미포함**. `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |

## 6. 측정 방법의 한계 — 스스로 밝힌다

- **`labelAlign: "east"` grep 오판**: 삼항식(`column.id === "column-1" ? "east" : "center"`)이라
  리터럴 grep 에 걸리지 않았고, 한때 "미반영"으로 볼 뻔했다. **문자열 grep 은 표현식에 약하다.**
- **"원 개수 3" 오판**: arc 명령(`A`/`a`)을 가진 path 를 세는 방식이었는데 **내 위치 핀의 물방울 path 에
  소문자 `a` 가 들어 있어** 3으로 셌다. 핀 `viewBox="0 0 24 32"` 를 제외하고 다시 세니
  **지도 도형 중 arc path 2개 = casing+body 1쌍 = 원 1개**가 맞다.
- **`scrollWidth > clientWidth` 오판**: 위 §3. 넘침의 신호일 뿐 **문서 스크롤의 충분조건이 아니다.**
  원인 귀속은 **해당 요소를 실제로 숨겨 스크롤이 사라지는지**로 확인해야 한다.

## 7. 18회차 최종 종합 (본검증 + 지도 재실행 + 최종 회귀)

| 구분 | 건수 | 내용 |
|------|------|------|
| **통과** | **77** | 본검증 71 + 지도 재실행 3 + 최종 회귀 3(360 축척 전환 · 부지 덮임 0 · 200% 원인 특정) |
| **실패** | **0** | 본검증 3건이 전부 해소·이관됐다 |
| **권고** | **1** | 라벨 여백 하한 8px 미달 3건(768 ⑤ 하단 1px · 360 ① 좌 4px · ④ 우 4px) |
| **이관** | **1** | 200% 확대 가로 스크롤 34px → **`SiteFooter` 로고 `h-7 w-auto`**(보호 파일·diff 0) · FOLLOWUPS 7번 |
| **미검증** | **5** | `RALLY_COLUMNS` 실삭제 · SR 실낭독 · 실기기 터치/핀치 · QR 실스캔(스펙상 판정 대상 아님) · 20:50 이후 변경분 |

**사용자 지적 사항("길 위에 박스를 그려줘")은 좌표·렌더 양쪽에서 확인된 통과다.**
대오 2 밴드는 **의사당대로 위**에 있고 부지와 21.7m 떨어져 있으며, **어느 라벨에도 가려지지 않는다**.
이것이 이번 QA 의 핵심 통과 항목이다.

## 정리

- 이번 회귀는 **개발자의 프로덕션 빌드를 그대로 사용**했다. 내 서버를 띄우지 않았고 `.next` 를 재생성하지 않았다.
  빌드 검증도 **재빌드 대신 `routes-manifest.json` 조회**로 대신해 실행 중인 서버를 건드리지 않았다.
- 지오로케이션 스텁·텍스트 확대·footer 숨김 실험은 **전부 브라우저 런타임에서만** 했고 즉시 원복했다.
- `src/app/qa-tmp-phase/` **잔존 0**(`find` 0건 · 빌드 라우트 미포함), `.playwright-mcp/` 삭제, 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트 18회차 — **최종 확인** (여백 조정분)

**대상 코드(프리즈 확인)**: 측정 시작·종료 시점의 sha256 이 동일하다.
`src/lib/rallyMap.ts` `81948c01…8843d2` · `src/components/rally/RallyMap.tsx` `ce6e9597…c96c6c` (mtime 20:47:45)
**서버**: 20:47:51 빌드에 대해 QA 가 `next start -p 3000` 을 새로 기동(개발자 서버는 이미 종료돼 있었다)
**확인 시각**: 2026-08-18 20:52~20:58 KST

## 결과: **실패 0 · 권고 해소 · 최종 판정 통과**

---

## 1. 확정 실측 (전 뷰포트)

| 뷰포트 | 지도 박스 | aspect | 축척 | 도형 | **최소 여백** | 잘림 | 라벨겹침 | ③ | ④ | ⑤외곽선 | ②둘레 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **360** | 328×410 | 4/5 | **100m** | 194×246 | **8px**(① 좌) | **0** | **0** | **0%** | **0%** | **0%** | 13.2%(전부 ①) |
| 700 | 668×835 | 4/5 | 50m | — | 111px | 0 | 0 | — | — | — | — |
| **768** | 704×396 | 16/9 | 100m | 194×246 | **8px**(② 상 8 · ⑤ 하 9) | **0** | **0** | **0%** | **0%** | **0%** | 13.2%(전부 ①) |
| **1280** | 896×504 | 16/9 | 100m | 194×246 | 62px | **0** | **0** | **0%** | **0%** | **0%** | 13.2%(전부 ①) |

- 768px 은 **2회 연속 측정에서 여백 값이 완전히 동일**했다(안정화 확인).
- 가로 스크롤 0(전 뷰포트, 100% 배율).
- 360px 라벨별 여백(좌/우/상/하): ① 8/222/113/263 · ② 50/114/15/361 · ③ 143/19/51/325 ·
  ④ 131/33/324/52 · ⑤ 109/31/360/16.

## 2. 권고(여백 하한 8px) — **해소로 판정한다** ✅

**360px·768px 모두 최소 여백이 정확히 8px** 로 내가 제시한 하한을 충족한다. 근거 3가지:

1. **안정화 후 값이 8px 이다.** 앞선 회귀에서 내가 기록한 `5px`, 개발자가 보고한 `7px` 은
   **지도 로드 직후의 과도 상태**에서 읽힌 값이다. 대기 시간을 5초로 늘려 2회 연속 측정하니
   두 번 모두 동일하게 8px 이 나왔다. **측정 시점이 값을 흔들었던 것이지 구현이 흔들린 게 아니다.**
2. **폰트 변동에 노출되지 않는다.** 라벨 pill 을 시스템 폰트로 강제해 Pretendard 미로드 상황을
   재현했더니 라벨 폭이 **오히려 줄었다**(① 98→96 · ③ 166→164 · ④ 164→163, ②⑤ 동일).
   **넓어지는 방향의 변화가 0** 이므로 가로 잘림 위험이 없다.
3. **최소 여백 지점이 세로다**(② 상단 · ⑤ 하단). 세로 위치는 `labelGap` + `fitBounds` 로
   결정되는 **결정론적 값**이며 폰트 폭과 무관하다. 라벨 높이는 34px 고정이다
   (padding 8 + `line-height:1.3`×15px + 테두리) — 폰트가 바뀌어도 배수 지정이라 동일하다.

→ **`FIT_PADDING` 을 건드리지 않고 `labelGap` 재배분으로 처리한 개발자 선택에 동의한다.**
축척 100m 유지가 우선이라는 판단이 맞다 — 패딩을 키우면 가용 공간이 줄어 zoom 이 떨어질 수 있고,
그것은 이 페이지에서 **여백 몇 px 보다 훨씬 큰 손실**이다.

### ⚠ 내 중간 관측 1건 정정
회귀 도중 `FIT_PADDING` 을 `{ top: 48, right: 24, bottom: 56, left: 64 }` 로 읽고
"내 권고가 반영됐다"고 판단할 뻔했다. **최종 코드는 `{ top: 48, right: 24, bottom: 48, left: 56 }`
원본 그대로다.** 개발자가 시도했다가 되돌린 중간 상태를 읽은 것이며, **리더 전달("83행 그대로")이 맞다.**

## 3. 기록해 둘 잠재 위험 — **16:9 박스가 좁아지면 잘린다**

지도 박스 폭만 줄여 가며(런타임 인라인 스타일, 16:9 유지) 스윕한 결과:

| 박스 폭 | 축척 | 최소 여백 | 잘림 |
|---|---|---|---|
| 560 | 300m | 25px | 0 (대신 **라벨겹침 2건**) |
| **620** | 100m | **−18px** | **② 메인무대 · ⑤ 부지** |
| **660** | 100m | **−7px** | **② 메인무대 · ⑤ 부지** |
| **704**(=768 뷰포트) | 100m | **8px** | 0 |

- **현재는 도달 불가다.** 768px 미만에서는 `aspect-[4/5]` 세로형이 적용되고(실측: 700px 뷰포트 →
  박스 668×835 · 최소 여백 111px), `md:` 이상에서 16:9 의 **최소 박스 폭이 704px**(뷰포트 768)이다.
  620/660 은 "16:9 를 유지한 채 폭만 줄인" 인위적 조합이다.
- **그러나 여유가 8px 뿐이라, 다음 변경 중 하나라도 들어오면 즉시 발현된다**:
  ① `md:` 브레이크포인트를 768 아래로 내리는 것 ② `max-w-page` 축소 ③ 지도 좌우 패딩 증가
  ④ 라벨 문자열이 길어지는 것 ⑤ 도형·라벨 추가.
  **§20.23.1(라벨이 안 들어가면 보고) 발동 지점이 여기다** — 그때는 QA 가 아니라 디자이너 판정 사안이다.
- **튜닝 기준이 360 → 768 로 옮겨갔다**는 리더 지적이 실측으로 확인됐다.
  세로형이 모바일에만 적용되므로 **16:9 인 768px 이 가장 좁다.** 앞으로 라벨이 늘거나
  문자열이 길어지면 **360 이 아니라 768 에서 먼저 깨진다.**

## 4. 최종 회귀 — 나머지 전건 통과

| 항목 | 결과 |
|------|------|
| 문안 게이트 | 렌더 텍스트 전수 — 금지 12종(`우측 도로`·`528세대`·`열렸`·`개최`·`성황`·`320`·`크롬`·`설정 >`·`출석 무효`·`20:00까지`·`폐회 후 출석`·`건물`) **전부 0** · **직선따옴표 0** · 필수 문자열 누락 **0** · `※ 상황에 따라 식순 변경 가능` **2곳** |
| 빌드 | 페이지 라우트 **7개**(`/`·`/admin`·`/bargaining-2026`·`/education/[id]`·`/news/[id]`·`/notices/[id]`·`/rally-2026-08-28`) · **`qa-tmp-phase` 미포함** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |
| 보호 파일 | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter` **전부 diff 0줄** |

## 5. 18회차 최종 종합 (본검증 + 지도 재실행 + 최종 회귀 + 최종 확인)

| 구분 | 건수 | 내용 |
|------|------|------|
| **통과** | **79** | 본검증 71 + 지도 재실행 3 + 최종 회귀 3 + 최종 확인 2(여백 하한 충족 · 폰트 변동 무영향) |
| **실패** | **0** | — |
| **권고** | **0** | 여백 권고 **해소** |
| **이관** | **1** | 200% 확대 가로 스크롤 34px → `SiteFooter` 로고 `h-7 w-auto`(보호 파일·diff 0) · FOLLOWUPS 7번 |
| **기록** | **1** | 16:9 박스 폭 704px 미만에서 ②⑤ 잘림 — 현재 도달 불가하나 여유 8px. 튜닝 기준은 **768px** |
| **미검증** | **5** | `RALLY_COLUMNS` 실삭제 · SR 실낭독 · 실기기 터치/핀치 · QR 실스캔(스펙상 판정 대상 아님) · 20:58 이후 변경분 |

**사용자 지적 사항("길 위에 박스를 그려줘")은 좌표·렌더 양쪽에서 확인된 통과다.**
대오 2 밴드는 **의사당대로 위**에 있고, 부지와 **21.7m** 떨어져 있으며, **어느 라벨에도 가려지지 않는다**(0%).
이것이 이번 QA 의 핵심 통과 항목이다.

## 정리

- 이번 확인은 **소스 sha256 을 측정 전후로 대조해 프리즈를 검증**한 상태에서 수행했다.
  (직전 회귀 구간에서 소스가 20:40·20:45·20:47 3회 바뀌어 값이 흔들렸던 문제를 이렇게 차단했다.)
- 라벨 여백 측정은 **대기 5초 + 2회 연속 동일** 확인을 거친 값만 채택했다.
- 박스 폭 스윕·폰트 폴백 재현은 **전부 브라우저 런타임에서만** 했고 즉시 원복했다 — 소스 무수정.
- `src/app/qa-tmp-phase/` 잔존 0 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트 18회차 — **최종 회귀** (여백 조정 확정본) · **최종 판정: 통과**

**대상 코드(프리즈 검증)**: 측정 전후 sha256 동일 —
`rallyMap.ts` `81948c01…8843d2` · `RallyMap.tsx` `ce6e9597…c96c6c` (mtime **20:47:45**)
**빌드**: 20:56:46 · **서버**: QA 가 `next start -p 3000` 기동 후 검증 종료 시 정지
**시각**: 2026-08-18 20:57~21:05 KST

> **참고**: 이 해시는 직전 「최종 확인」 절과 **동일하다.** 개발자의 `FIT_PADDING` 적용→원복이
> **원래 파일 상태로 되돌아왔음**을 뜻한다. 그래서 설계 3뷰포트 수치도 직전 절과 일치한다.
> 이번 절은 **① 8px 하한 판정 확정**과 **② 767px 관찰 판정**을 위해 재실행했다.

## 최종 결과: **실패 0 · 권고 0 · 통과**

## 1. 설계 3뷰포트 확정 실측

| 뷰포트 | 박스 | aspect | 축척 | 도형 | **최소 여백** | 잘림 | 겹침 | ③ | ④ | ⑤외곽선 | ②둘레 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **360** | 328×410 | 4/5 | **100m** | 194×246 | **8px**(① 좌) | **0** | **0** | **0%** | **0%** | **0%** | 13.2%(전부 ①) |
| **768** | 704×396 | 16/9 | **100m** | 194×246 | **8px**(② 상 8·⑤ 하 9) | **0** | **0** | **0%** | **0%** | **0%** | 13.2%(전부 ①) |
| **1280** | 896×504 | 16/9 | **100m** | 194×246 | 62px | **0** | **0** | **0%** | **0%** | **0%** | 13.2%(전부 ①) |

- 가로 스크롤 0(3뷰포트) · 지리 순서 유지(1280 라벨 상단 y: ②62 → **③98** → ①160 → **④371** → ⑤407).
- 개발자 실측과 **일치**한다(360 ① 좌 8px · 768 ② 상 8px · 1280 62px).
- 도형 묶음은 QA 194×246 / 개발자 180×235 — **흰 casing(7px) 포함 여부** 차이로 이미 규명됐다.

## 2. 여백 하한 8px — **충족. 권고 해소** ✅

**360px·768px 모두 최소값이 정확히 8px** 이다. 이 값이 신뢰할 수 있는 이유:

1. **대기 5초 + 2회 연속 동일** 확인을 거친 값만 채택했다. 앞서 나온 `5px`(내 값)·`7px`(개발자 값)은
   지도 로드 직후 **과도 상태**의 값이었다. 측정 시점이 값을 흔든 것이지 구현이 흔들린 게 아니다.
2. **폰트 변동에 노출되지 않는다.** 라벨 pill 을 시스템 폰트로 강제해 Pretendard 미로드를 재현했더니
   폭이 **오히려 줄었다**(① 98→96 · ③ 166→164 · ④ 164→163, ②⑤ 동일) — **넓어지는 변화 0**.
3. **병목 지점이 세로다**(768 ② 상단). 세로는 `labelGap`+`fitBounds` 결정론이고 폰트 폭과 무관하며,
   라벨 높이는 `line-height:1.3` 배수 지정이라 34px 로 고정이다.

### 내 권고 수단이 기각된 건에 동의한다
`FIT_PADDING` 좌 64/하 56 은 개발자 실측에서 **768px ② 상단을 9→5px 로 악화**시켰다.
**세로 여백은 제로섬이다** — 768px 의 세로 자유 공간 `396 − 235 = 161px` 는 고정이고 패딩은 그것을
나누기만 한다. 하단을 늘리면 콘텐츠가 위로 밀려 ②가 그만큼 손해를 본다.
**방향(하한 8px)은 유효했고 수단만 `labelGap` 재배분(② 39 / ③ 47 / ⑤ 38)으로 바뀌었다.**
`FIT_PADDING` 83행 `{ top: 48, right: 24, bottom: 48, left: 56 }` **원복 확인**.

## 3. 개발자가 기록한 한계 — **QA 도 같은 결론이다** (리포트 반영)

**360px 과 768px 모두 최소값이 정확히 8px** 이다. 자유 공간을 하한에 맞춰 남김없이 나눈 결과이며
**병목이 서로 다르다**:

| 뷰포트 | 병목 축 | 내용 |
|---|---|---|
| **360px** | **수평** | ① 라벨(98px)이 좌측 여백(90px)보다 넓다 |
| **768px** | **수직** | 상단 81px 에 34px 라벨 2개 |

→ **라벨이 하나라도 늘거나 문자열이 길어지면 8px 을 못 지킨다.** 그 시점이 §20.23.1 발동 지점이며
**디자이너 판정 사안**(라벨 축약·지시선·박스 재조정)이다. QA 는 라벨 문자열을 손대라고 권하지 않는다 —
**문안 게이트 영역**이기 때문이다.

## 4. 767px 관찰 — **조치 불요에 동의. 단 근거를 정정한다** ★

개발자 관측(767px 에서 부지 덮임 22%)을 **재현 확인**했다. 그리고 **한 가지를 정정한다.**

| 뷰포트 | 박스 | aspect | 축척 | 도형 | 최소여백 | 잘림 | ③ | ④ | **⑤외곽선** | ② |
|---|---|---|---|---|---|---|---|---|---|---|
| **767** | 735×919 | 4/5 | **50m** | 374×479 | 153px | 0 | **0%** | **0%** | **22%**(전부 ④) | 6.5%(전부 ①) |
| **744** | 712×890 | 4/5 | **50m** | 374×479 | 138px | 0 | **0%** | **0%** | **22%**(전부 ④) | 6.5%(전부 ①) |

### ⚠ 정정: "실기기에 없는 폭"이 아니다
767px 만의 현상이 아니라 **축척이 50m 로 떨어지는 구간 전체**(대략 뷰포트 640~767px)의 현상이고,
그 구간에는 **실기기가 있다** — **iPad mini 세로 744×1133 CSS px** 에서 동일하게 22% 가 나온다(위 실측).
폴더블 펼침·작은 태블릿 세로도 이 구간이다.
**"창 크기 조절 시에만 나오는 폭"이라는 전제로 넘기면, 나중에 breakpoint 를 만질 때 오판한다.**

### 그럼에도 조치 불요로 판정하는 이유
1. **조합원이 서는 곳(③④ 밴드)은 0% 가려진다.** 핵심 정보 손실 0 이다.
2. 덮이는 것은 **참고 지물인 부지 외곽선 22%** 이고, 그 구간은 축척 50m 라 부지가 **374×479 도형 안에서
   크게** 그려진다 — **남은 78% 로 평행사변형 형태와 위치가 그대로 판독된다.**
3. 내가 앞서 **41~46% 를 "권고"로 올렸던 것과 비교하면 절반 수준**이고, 그때조차 밴드는 0% 였다.
4. 정체는 지도 타일의 `더샵 아일랜드파크` 문자 + ⑤ 라벨이 이중으로 말한다.

→ **별도 실패·권고로 올리지 않고 "기록"으로 남긴다.** 리더 견해와 같다.
**단 기록의 문구는 "실기기 없음"이 아니라 "실기기 있음(iPad mini 세로 등) · 밴드 0% 라 무해"** 여야 한다.

## 5. 나머지 회귀 — 전건 통과

| 항목 | 결과 |
|------|------|
| 문안 게이트 | 렌더 텍스트 전수 — 금지 12종 **적발 0건** · **직선따옴표 0** · 필수 문자열 18건 **누락 0** · `※ 상황에 따라 식순 변경 가능` **2곳** |
| 기하 | 부지 13정점·대오1 18점·대오2 20점 **불변** · 부지 안 점 **0** · 대오2↔부지 **21.7m** · 대오1↔부지 32.9m |
| 빌드 | 페이지 라우트 **7개** · **`qa-tmp-phase` 미포함** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |
| 보호 파일 | 6종 전부 **diff 0줄** |

## 6. 18회차 최종 종합 (본검증 + 지도 재실행 + 최종 회귀 + 최종 확인 + 최종 회귀)

| 구분 | 건수 | 내용 |
|------|------|------|
| **통과** | **81** | 본검증 71 + 지도 재실행 3 + 최종 회귀 3 + 최종 확인 2 + 이번 2(여백 하한 확정 · 767/744 판정) |
| **실패** | **0** | 본검증 3건 전부 해소·이관 |
| **권고** | **0** | 여백 권고 **해소** |
| **이관** | **1** | 200% 확대 가로 스크롤 34px → `SiteFooter` 로고 `h-7 w-auto`(보호 파일·diff 0) · FOLLOWUPS 7번 |
| **기록** | **2** | ① 16:9 박스 폭 704px 미만이면 ②⑤ 잘림(현재 도달 불가, 여유 8px, 튜닝 기준은 **768px**) ② 축척 50m 구간(뷰포트 약 640~767, **iPad mini 세로 744 포함**)에서 ④ 라벨이 부지 외곽선 **22%** — 밴드 0% 라 무해 |
| **미검증** | **5** | `RALLY_COLUMNS` 실삭제 · SR 실낭독 · 실기기 터치/핀치 · QR 실스캔(스펙상 판정 대상 아님) · 21:05 이후 변경분 |

### 최종 판정

**게시 가능. QA 관점에서 막을 사유가 없다.**

**사용자 지적 사항("마음대로 더샵아일랜드파크 위에 박스를 지정하면 안 돼. 길 위에 박스를 그려줘")은
좌표·렌더 양쪽에서 확인된 통과다** — 대오 2 밴드는 **의사당대로 위**에 있고, 부지와 **21.7m** 떨어져 있으며
(변 교차 0 · 서로의 폴리곤 안에 든 점 0), **설계 3뷰포트 전부에서 어느 라벨에도 0% 가려지지 않는다.**
이것이 이번 QA 의 핵심 통과 항목이다.

## 정리

- 소스 sha256 을 **측정 전후 대조**해 프리즈를 검증한 상태에서만 값을 채택했다.
- 라벨 여백은 **대기 5초 + 2회 연속 동일** 확인을 거친 값만 썼다.
- 767/744 재현, 폰트 폴백, 박스 폭 스윕은 **전부 브라우저 런타임**에서만 했고 즉시 원복했다 — 소스 무수정.
- QA 서버 **정지 완료**. `src/app/qa-tmp-phase/` 잔존 0 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 지도 인터랙티브 전환 · 로드뷰 · ⑥ 화장실 · 대오 명칭 제거 · 20:30 (19회차)

**대상 코드(프리즈 검증 — 측정 전후 sha256 동일)**
`rallyMap.ts` `75f94e38…` (19:16:31) · `RallyMap.tsx` `0323823e…` (19:19:07) · `page.tsx` `6898b752…` (19:12:23)
**빌드** 19:19:13(최종 소스 이후) · **서버** QA 가 `next start -p 3000` 기동 후 정지
**판정 근거** §21 전체 · §22(특히 **§22.16 체크리스트 140~162**) · 검증 8·9회차 · `union-qa-testing`
**시각** 2026-08-20 19:24~19:50 KST

## 19회차 요약: 통과 46 | **실패 2** | 권고 1 | 기록 3 | 미검증 2

---

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| **1** | **§21.1.1 조작 계약 위반 (최우선)** | `src/components/rally/RallyMap.tsx:1119` (`panoMountRef` 의 `touchAction`) | **로드뷰 상태에서 한 손가락 드래그가 페이지 스크롤을 완전히 막는다.** 기기 에뮬레이션(`hasTouch`·`isMobile`·`pointer: coarse`) 실측 — **지도 상태에서는 위로 스와이프 시 페이지가 337px 스크롤되는데, 로드뷰 상태에서는 `scrollY` 2612 → 2612 로 0px** 다. 원인: 로드뷰 오버레이(`figure > div` 의 2번째 자식)가 `touch-action: auto` 이고, **네이버 파노라마 뷰어가 그 아래 만드는 중첩 `div` 3겹(각 328×410)이 전부 `auto`** 다. 코드가 `panoMountRef` 에 준 `pan-y` 는 **네이버가 그 안에 생성한 뷰어 DOM 에 전파되지 않는다.** 파노라마 뷰어가 한 손가락 드래그를 자체 회전 제스처로 `preventDefault` 한다 | 로드뷰 **오버레이 컨테이너와 그 하위 전체**에 `touch-action: pan-y` 를 강제하라(인라인 스타일이 아니라 CSS 하위 선택자 — 예: 오버레이에 클래스를 주고 `.rally-pano, .rally-pano * { touch-action: pan-y !important; }`). 그래도 파노라마가 `preventDefault` 하면 **§21.3 의 "로드뷰는 버튼으로만 연다" 계약에 맞춰 로드뷰 컨테이너에 한 손가락 터치 가드**(1 touch 일 때 뷰어로 이벤트를 넘기지 않음)를 지도와 **같은 방식으로** 적용하라. §21.1.1 이 막으려던 사고가 로드뷰에서 그대로 재현된다 |
| **2** | 라벨 겹침 (§22.16-152) | `src/lib/rallyMap.ts:530·564`(⑤ `tertiary`·`labelGap 44`) ↔ `:391`(④ `primary`) | **z15(축소 1단)에서 ④ `코스콤지부` pill 과 ⑤ 배지가 실제로 중첩된다 — 336px²(28×12px).** ⑤ 배지 **폭 전체 × 높이 43%** 가 ④ pill 밑에 깔린다. 체크리스트 152 는 런타임 접기 임계를 **실교차(0px)** 로 두는데, **④는 `primary` 라 접히지 않고 ⑤는 이미 배지라 더 접을 단계가 없어** 이 교차는 히스테리시스로 해소되지 않는다. z16 초기 뷰에서는 두 요소 간격이 정확히 8.00px 이라 여유가 0이고, 한 단계만 축소하면 겹친다 | ① z15 에서 ⑤ 배지를 **숨기는 단계**를 추가하거나(4단계: pill → 배지 → 미표시), ② ⑤ 의 `labelGap` 을 z15 에서 키우거나, ③ ④ 의 `placement`/`labelGap` 을 z15 에서 조정하라. **지도 라벨 문자열은 손대지 마라**(문안 게이트). 초기 뷰(z16) 값은 이미 스펙 목표와 일치하므로 **z15 전용 처리**여야 한다 |

---

## ★ 최우선 검증 1 — 조작 계약 (§21.1.1 · §21.8-101~106)

**기기 에뮬레이션 컨텍스트를 실제로 만들어 CDP `Input.dispatchTouchEvent` 로 재현했다**
(`hasTouch: true` · `isMobile: true` · `deviceScaleFactor: 2` · 360×800 · Android UA).
환경 확인: `(pointer: coarse)` **true** / `(pointer: fine)` **false** → 코드의 `draggable: finePointer` 가 **false** 로 평가되는 실사용 경로다.

| 입력 | 스펙 | **실측 결과** | 판정 |
|------|------|--------------|------|
| **한 손가락 드래그(지도)** | 페이지 스크롤 · 지도 반응 0 | **페이지 337px 스크롤** · 라벨 상대좌표 `8,113` **불변** · 축척 불변 | ✅ **통과 — 최우선 항목** |
| **두 손가락 드래그** | 지도 이동 | 라벨 `8,113` → `51,152` **이동함** | ✅ 이동 자체는 동작 (단 권고 1 참조) |
| **핀치** | 확대·축소 | 축척 **300m → 50m** | ✅ |
| **더블탭** | 아무 것도 안 함 | 축척 `50m → 50m` · 지도 좌표 **완전 불변** | ✅ |
| **데스크톱 맨 휠** | 페이지 스크롤 | 페이지 19px 스크롤 · 축척·지도 **불변** | ✅ |
| **데스크톱 Ctrl+휠** | 지도 확대 | 축척 **100m → 50m** · 페이지 스크롤 **0** | ✅ |

**구조적 안전장치도 코드에서 확인**: 지도 컨테이너·pano 마운트 `touch-action: pan-y`(`RallyMap.tsx:1110·1119`),
`touchmove` 리스너가 **`{ passive: true }`**(`:808`) — **설계상 `preventDefault` 자체가 불가능**하고
`e.touches.length !== 2` 면 즉시 반환한다(`:777`). 지도 쪽은 이중으로 잠겨 있다.
**그 잠금이 로드뷰에는 걸리지 않은 것이 실패 1이다.**

**컨트롤 (§21.8-104~106)**

- 5개 전부 **높이 44px · 전부 지도 박스 밖** — `축소`(75) · `확대`(75) · `처음 위치로`(126) · `내 위치 표시`(130) · `로드뷰 보기`(126).
- **`확대` 는 축척 20m(z19)에서 `disabled`**, **`축소` 는 300m(z15)에서 `disabled`**, `처음 위치로` 는 초기 상태에서 `disabled` ✅
- **`처음 위치로` 복귀가 초기 화면과 픽셀 동일**: `284,160 / 100m` → 조작 후 → **`284,160 / 100m`** 복귀 + 다시 `disabled` ✅ (체크리스트 153)
- 360px 컨트롤 행 **가로 스크롤 0** ✅
- **지도 안 Tab 정지점 종전과 동일** — 네이버 로고·저작권·OpenStreetMap 5개뿐, 마운트 `tabindex` **null** ✅

---

## ★ 최우선 검증 2 — 20:30 오독 방지 (검증 9회차 · §22.13 · 체크리스트 158~162)

**전건 통과.**

- 블록 1 `<dl>` **3행**, `<dt>` 순서 **`본대회` / `코스콤지부` / `장소`** ✅
  `<dd>` = **`20:30까지 참가 계획`** ✅ — **`<dt>` 어디에도 `종료` 없음** ✅
- 각주 2행 **문자 단위 일치**:
  1. `※ 20:30 은 코스콤지부의 참가 계획입니다. 주최측 식순상 폐회선언은 20:20~ 이며, **종료 시각은 안내되지 않았습니다.**` ✅
  2. `※ 2차 출석은 20:00~21:00 입니다. 현장에서 위치가 확인돼야 하니 **자리를 뜨기 전에 완료해 주세요.**` ✅
- **금지 강화표현 `자리를 뜨면 출석이 되지 않습니다` 0건** ✅ (지오펜스 반경 미확인 → 강화 금지)
- **`20:30` 이 블록 1 밖에 0건** ✅ — `src/` 전수 grep 결과 `rally-2026-08-28/page.tsx` 안에만 있고,
  그중 렌더되는 것은 `<dd>`(170행)와 각주(189행) **2곳뿐**이며 나머지는 주석이다.
  히어로·`RallyEntryCard`·`metadata.description`·`struggleSchedule.ts` **0건** ✅
- **`18:30` 이 여전히 페이지 유일 최대 수치** ✅ — `18:30` 계산 `font-size: 40px`(`text-hero`),
  `20:30` 은 **`18px` · `font-weight: 400`**(`text-body`, 굵지 않음) ✅ (체크리스트 159)
- 신설 `※` 2행이 **`text-ink`**(계산색 `rgb(26,26,26)`), **`ink-muted` 아님** ✅ (체크리스트 161)

---

## ★ 최우선 검증 3 — ⑥ 도트가 화장실을 주장하지 않는지 (§21.4 · 검증 요구 52)

- 지도 라벨/배지가 **`⑥ 여의도공원 입구`** ✅ — **`화장실` 단독 표기 0건** ✅
- 범례 ⑥ 행: `여의도공원 입구 — 확인된 위치입니다. 화장실은 공원 안에 있으며, 개별 위치는 확인되지 않아 지도에 표시하지 않았습니다 — 위 화장실 안내를 참고해 주세요.` ✅
- **요구 52 이행 확인** — 미검증 문구 **`현장 안내판` 렌더·소스 전수 0건** ✅
- 화장실 카드 거리 **`80 m`(대오 2 기준) 1건**, **`390` 0건**(5번 출구 기준 수치 부활 없음) ✅

---

## 라벨 실측 (§22.16-140~151 · 156) — 개발자 실측과 **전건 일치**

측정 방법: 라벨은 `[data-rally-pill]`·`[data-rally-badge]` 로 특정, 도형 가림은 **`isPointInStroke`/`isPointInFill` 1px 격자 전수**(bbox 미사용 — 체크리스트 143 요구).

| 뷰포트 | 박스 | 축척 | pill/배지 | **최소 쌍간격** | **박스 여백 최솟값** | 지도 크롬 침범 | 잘림 |
|---|---|---|---|---|---|---|---|
| **360** | 328×410 | 100m | **4 / 2** | **8.00** (②③) · **8.00** (④⑤) | **8.28**(① 좌) | **0건** | 0 |
| **768** | 704×396 | 100m | **4 / 2** | **8.00** · **8.00** | **8**(② 상) · ⑤ 하 **9** | **0건** | 0 |
| **1280** | 896×504 | 100m | **4 / 2** | **8.00** · **8.00** | **62**(② 상) | **0건** | 0 |

- **140** 모든 쌍 ≥ 8.0px, 최솟값 쌍이 **②③ 과 ④⑤ 로 각 8.00** ✅ 스펙 값과 정확히 일치
- **141** 360 **8.28** · 768 **8** · 1280 **62** ✅ 스펙 값과 정확히 일치. **768 ⑤ 하단 9px 실측 완료** ✅
- **142 지도 크롬 가림 0%** ✅ — 축척 바(360: x263 y390 53×11)·`map_copyright`(x0 y391 88×19) 와
  라벨 6개의 교차 **0건**. **개정 전 ⑤ 가 축척 바를 34.3×4px 덮던 문제 재발 없음** ✅
- **143 픽셀 단위 도형 가림** ✅
  | 도형 | 본선 픽셀 | 가림 | **본선 가림률** |
  |---|---|---|---|
  | ③ 대오 1 (면) | 2216 | 0 | **0.00%** |
  | ④ 대오 2 본선 | 268 | 0 | **0.00%** |
  | ④ 대오 2 casing | 1207 | 0 | **0.00%** |
  | ⑤ 부지 본선 | 467 | 0 | **0.00%** |
  | ⑤ 부지 casing | 1121 | 3 | 0.27%(흰 보조선 — 본선 아님) |
- **144** ② 라벨 `메인무대(예정)` ✅ · 범례 ② 행 `주최측 설치 예정` 완전형 유지 ✅
- **145** ③ 라벨 `대오 1`, `(범위는 근사)` 없음 ✅ — 제거가 **`BAND_STYLE.estimated.labelSuffix: ""`**
  (`RallyMap.tsx:165`)에서 이뤄졌다. **`id` 분기 아님** ✅
- **146** ④ 라벨 `코스콤지부`(`[대오 2]` 없음) ✅ · **범례 ④ 행에만 `[대오 2]` 잔존**(사이트 전체에서 1건) ✅
- **147 범례 3행 + 키 줄 diff 0** ✅ — `git diff` 상 기존 범례 문자열 변경 0, 추가된 것은 ⑥ 행 신규와 주석뿐
- **148** z16 텍스트 pill **정확히 4개(①②③④)**, 번호 배지 **2개(⑤⑥)** ✅
- **149** **z17 에서 ⑤⑥ pill 실제 노출** ✅ — ⑤ `여의도더샵아일랜드파크` **원문 그대로**, ⑥ `여의도공원 입구`.
  z17 pill 6개 · 배지 0 · **겹침 0**(최소 간격 37.07px). z18 도 겹침 0(102.59px)
- **150** 접힌 배지가 pill 과 같은 placement·labelGap ✅ — DOM 실측: ⑤ `left:0; top:44px; translateX(-50%)`(bottom·44),
  ⑥ `left:26px; top:0; translateY(-50%)`(right·26). 배지가 자기 도트를 덮지 않음
- **151** ⑥ 배지 **동쪽** ✅ · 도형 가림 **0px** ✅ · **④↔⑥ 18.35px**(스펙 18.36) ✅ · **박스 우측 28px**(360) ✅
- **156** 360 최장 라벨 ② `메인무대(예정)` **135.00px** ✅ 스펙 값과 소수점까지 일치, 1줄

---

## 로드뷰 (§21.3 · 체크리스트 111~114)

- **111** 페이지 로드 시 **항상 지도** ✅ (버튼 5개 · pill 4개 렌더). 로드뷰는 버튼으로만 열린다
- **112** 로드뷰 상태에서 **버튼이 `지도로 돌아가기` 하나만** 상시 노출 ✅ ·
  **새로고침 시 지도로 복귀** ✅(버튼 5개·pill 4개 재확인)
- 박스 높이 **410px 유지** — 영역 추가 없이 토글 ✅ (§21.3.1)
- 안내 문구 `로드뷰는 시각 자료입니다. 위치 안내는 위 텍스트를 참고해 주세요.` 표시 ✅
- **로드뷰가 실제로 렌더된다** ✅ — 파노라마 서브모듈·nearby API·metadata·`panorama.pstatic.net` 타일까지
  요청 성공, 스크린샷으로 5번 출구 주변 실제 거리 사진 확인. 콘솔 에러 0
- **114 ✗ 실패** — 위 실패 1

---

## 대오 명칭 제거 (§21.6 · 체크리스트 115~118)

- 블록 2 첫 줄 **`더샵아일랜드파크 앞 의사당대로`**, `[결의대회대오 2]` **없음** ✅
- 지도 대체면에도 `[대오 2]` 없음 ✅
- **페이지 산문 전체 `결의대회대오` 0건** ✅
- `[대오 2]` 는 **범례 ④ 행 1건**뿐 — 사이트에서 이 식별자가 남은 유일한 자리 ✅ (§22.16-146)

---

## 권고 1건 — 두 손가락 팬이 줌과 분리되지 않는다

기기 에뮬레이션에서 **두 손가락을 간격 100px 로 고정한 채 평행이동**시켰는데도
축척이 **100m → 300m** 로 떨어지고 도형이 98×98 → 56×56 으로 축소됐다(줌 2단 하락).
`pinchZoom: true` 와 `panBy` 가 같은 2-touch 제스처를 나눠 갖지 못한다.

- **스펙이 예견한 경우다** — §21.1.1 은 *"두 손가락 팬 구현이 불안정하면 그것만 빼도 된다.
  확대·축소와 `처음 위치로` 가 남으므로 사용자 요청은 충족된다"* 는 fallback 을 명시했다.
- **복구 경로가 실측으로 확인된다** — `처음 위치로` 가 초기 화면(`8,113 / 100m / 98x98`)으로 정확히 복귀한다.
- 그래서 **실패가 아니라 권고**로 올린다. 조치안: ① 그대로 두거나 ② 스펙이 허용한 대로
  **두 손가락 팬을 빼고 핀치 확대·축소 + `처음 위치로` 만 남긴다.** ②가 조합원이 겪는 혼란이 더 적다.
- 부수 관찰: 두 손가락 이동 중 페이지가 **4px** 스크롤됐다(`pan-y` 의 세로 성분). 경미.

---

## 기록 (리더 지정 · 재조사 불요 2건 + 신규 1건)

- **154** 지도 + 범례가 360×640 한 화면에 **들어가지 않는다** — 실측 **869px vs 640px**.
  리더 지정대로 **범례 문구는 줄이지 않았고**(검증 조건) 스크롤로 도달 가능하다. 기록만.
- **157 [별건]** ① `5번 출구` 가 메인무대 점선 원을 덮는 비율 — **QA 측정 본선 14.40% · casing 13.69% · 면 9.63%**.
  스펙·개발자 값은 **12.28%** 로 **2.12%p 차이**가 난다. 원인은 측정 대상 정의 차이로 보인다
  (본선/casing/면 중 무엇을 분모로 잡는가). **①②가 같은 좌표를 공유하는 구조적 결과**라는 판정은 동일하며,
  리더 판단 대기 항목으로 남긴다. **신규 결함으로 올리지 않았다.**
- **[신규 기록]** z15 에서 ⑤ 배지가 ④ pill 뒤로 들어간다 → **실패 2로 승격**(위 표). 여기 중복 기재하지 않는다.

---

## 회귀 · 기본

| 항목 | 결과 |
|------|------|
| **보호 파일** | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter`·**`RallyEntryCard`** 전부 **diff 0줄** |
| **문안 게이트** | 렌더 전수 — 금지 12종(`우측 도로`·`528세대`·`열렸`·`개최`·`성황`·`320`·`크롬`·`설정 >`·`출석 무효`·`20:00까지`·`폐회 후 출석`·`건물`) **전부 0** · **직선따옴표 0** |
| **상태 전이** | 오늘(8/20) 기준 **`upcoming` 정상** — `오늘`·`완료` 배지 **0건**, past 문장 없음, 취소선 0. 빌드 청크에 past 문장 **존재**(분기 생존). 경계면 파일 3종(`rally.ts`·`RallyStatus`·`RallyEntryCard`) 전부 **8/18 17:31 이전** = 이번 변경과 무관 |
| **대비 실측** | `#093389:#ffffff` **11.37**(컨트롤 버튼) · `#1a1a1a:#ffffff` **17.40**(각주·20:30) · `#4b5563:#ffffff` **7.56** · `#6b7280:#ffffff` **4.83**(UI) · `#093389:#d9e9ff` **9.23**. **신규 조합 0** |
| **반응형** | 360/768/1280 **가로 스크롤 0**(100% 배율) · 라벨 잘림 0 |
| **200% 확대** | 가로 스크롤 34px — **footer 숨김 시 394 → 360** 으로 사라진다. **`SiteFooter`(diff 0줄) 기존 결함**이며 18회차에서 **FOLLOWUPS 7번으로 이관**한 건과 동일. 이번 변경과 무관 |
| **빌드** | 페이지 라우트 **7개** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |

---

## 미검증 항목

| # | 항목 | 사유 |
|---|------|------|
| 1 | **실물 단말 터치**(iOS Safari / Android Chrome 실기기) | Chromium 기기 에뮬레이션(`hasTouch`·`isMobile`·CDP `Input.dispatchTouchEvent`)으로 **한 손가락·두 손가락·핀치·더블탭을 전부 실행**했으나, iOS Safari 의 `touch-action` 구현 차이와 관성 스크롤은 재현 대상이 아니다. **실패 1은 이 한계와 무관하게 에뮬레이션에서 이미 재현된다** |
| 2 | `prefers-reduced-motion: reduce` 에서 `panBy`·`setZoom` 무애니메이션(§21.1.4) | 네이버 API 가 애니메이션을 강제하는지 여부를 외부에서 관측할 수단이 없다. 코드에 옵션 분기가 있는지까지만 확인 가능 |

---

## 정리

- 소스 sha256 을 **측정 전후 대조**해 프리즈를 검증했다(3파일 전부 동일).
- 기기 에뮬레이션은 **별도 브라우저 컨텍스트**를 만들어 수행했고 매 테스트 후 닫았다.
- 도형 가림은 스펙 요구대로 **`isPointInStroke`/`isPointInFill` 격자 전수**로 쟀다(bbox 미사용).
- QA 서버 정지 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 19회차 **회귀** — 로드뷰 전체 화면 모달 · z15 오버라이드 · 두 손가락 팬 제거

**대상 코드(프리즈 검증 — 측정 전후 sha256 동일)**
`rallyMap.ts` `1b30a57c…`(19:56:41) · `RallyMap.tsx` `814b2625…`(20:02:02) · `page.tsx` `6898b752…`(변경 없음)
**빌드** 20:02:07(최종 소스 이후) · **서버** QA 가 `next start -p 3000` 기동 후 정지
**판정 근거** **§23.1.6 이 합격 기준의 본체** · §23.2.8 체크리스트 163~179 · §22.16 재실행
**시각** 2026-08-20 20:10~20:30 KST

## 회귀 결과: **19회차 실패 2건 전부 해소** | 신규 실패 0 | 불일치 1 | 기록 2

> **§23.1.6 을 적용했다.** 모달 안에서 한 손가락이 파노라마를 회전시키고 페이지가 스크롤되지 않는 것은
> **정상 동작으로 판정**했다. 19회차 실패 1을 그대로 재적용하지 않았다.

---

## 1. 실패 1(로드뷰 한 손가락 스크롤 차단) — **해소** ✅

전체 화면 모달 전환으로 충돌이 소멸했다. **기기 에뮬레이션**(`hasTouch`·`isMobile`·`deviceScaleFactor 2`·CDP 터치)으로 전항목 재현했다.

| # | 항목 | **실측** | 판정 |
|---|------|---------|------|
| **163** | 모달에서 한 손가락 = 파노라마 회전 | 파노라마 타일 좌표가 `-1583,-1395\|…` → `-286,-6\|…` 로 **변함** = 회전함. 페이지 스크롤 0(정상) | ✅ |
| **164** | `닫기` 상시·safe-area | `top 12` · `right 12` · **높이 44px** · **회전 후에도 보임**(자동 숨김 없음) | ✅ |
| **165** | 닫으면 `scrollY` ±0 · 포커스 복귀 | **왕복 2회 전부 2612 → 2612, 차이 0px**. 활성 요소가 **`BUTTON:로드뷰 보기`** 로 복귀 | ✅ |
| **166** | 닫은 뒤 한 손가락 스와이프 | **236px 스크롤**(지도 상태 기준값 338px 과 동등 급 — 스와이프 시작 좌표 차이) | ✅ |
| **167** | `Esc` 닫힘 / backdrop 안 닫힘 | `Esc` **닫힘 확인**(1회차) · `dialog` 대상 클릭에도 **열림 유지** | ✅ |
| **168** | 배경 탭 순회 제외 | `dialog` 밖 버튼 5개는 순회 밖. 모달 안 정지점 **`BUTTON:닫기` + `A:`(네이버 로고) 2개** — **리더 수용 이탈**, 실패로 올리지 않음 | ✅ |
| **169** | 높이 `100dvh` | `dialog` 높이 **800 = `innerHeight` 800**. 마크업 `h-[100dvh] max-h-none w-full max-w-none border-0 bg-black p-0 backdrop:bg-black/80` — 스펙 그대로 | ✅ |
| **170** | 닫으면 지도 그대로 | pill **4개** · 축척 **100m** 유지 | ✅ |
| **171** | 실패 경로 | 파노라마 API 를 라우트 차단해 재현 — **모달이 닫히고** `role="status"` 에 **`이 위치의 로드뷰를 불러오지 못했습니다.`**(스펙 문자열 그대로), 버튼 5개 유지, 지도 pill 4개, **검은 화면에 머물지 않음** | ✅ |
| **172** | 새로고침 시 항상 닫힘 | 모달을 연 채 `reload` → `dialog.open` **false**, 버튼 5개 | ✅ |
| **173** | 컨트롤 항상 같은 5개·2행 | `축소`·`확대`·`처음 위치로`·`내 위치 표시`·`로드뷰 보기` — 상태 무관 동일. **2행**(top 3687 / 3739) · 가로 스크롤 0 | ✅ |

**스크롤 복원 3중 장치도 실측으로 확인**: 열릴 때 `body { overflow: hidden; top: -2612px }`,
닫을 때 `overflow: visible` · `top: ""` 원복. **왕복 2회에서 1px 도 어긋나지 않았다.**
안내 문구 `로드뷰는 시각 자료입니다…` 존재 ✅

---

## 2. 실패 2(z15 ④×⑤ 중첩) — **해소** ✅ (§23.2.8-174~179)

`minZoomOverride` 로 z15 에서만 ⑤ 를 서쪽 26px 로 옮긴 처리가 작동한다.

| 항목 | 19회차(수정 전) | **회귀 실측** | 스펙 기준 | 판정 |
|------|----------------|--------------|----------|------|
| ④×⑤ **실중첩** | **336px²**(28×12) | **0px²** | 0 | ✅ **해소** |
| ④↔⑤ 간격 | 0 | **27.0** | 27.5 | ✅ (0.5 차) |
| 전체 최소 간격 | 0 | **19.0**(②③) | 19.0 | ✅ 일치 |
| 박스 여백 최솟값 | — | **24.28** | 24.3 | ✅ 일치 |
| 도형 가림 | — | **0건**(픽셀 전수) | 0px | ✅ |
| 크롬 침범 | — | **0건** | 0 | ✅ |
| 라벨 구성 | — | **pill 2 + 배지 4 = ①~⑥ 전부 화면에** | 동일 | ✅ **177 미표시 등급 없음** |
| ⑤ 배지 좌표 | — | **x110~138 · y230~258** | x110~138 · y229.5~257.5 | ✅ **175 부지 서쪽** |
| `축소` 버튼 | — | z15 에서 **`disabled`** | — | ✅ **179** |
| `처음 위치로` | — | z16 과 **완전 동일 복귀**(간격·여백·좌표 전부) | 픽셀 동일 | ✅ **179** |

- **178 지도 크롬 검사를 `<img>` 전수로** 수행했다(축척 바 · `map_copyright` · 로고성 `<img>` 전부). z15·z16 모두 침범 0.

---

## 3. **176 z16 불변** — 3뷰포트 전부 §22 실측과 동일 ✅

| 뷰포트 | 박스 | 축척 | pill/배지 | 최소 쌍간격 | 박스 여백 최솟값 | 크롬 침범 | 실중첩 | 잘림 |
|---|---|---|---|---|---|---|---|---|
| 360 | 328×410 | 100m | 4 / 2 | **8.00**(②③·④⑤) | **8.28** | 0 | 0 | 0 |
| 768 | 704×396 | 100m | 4 / 2 | **8.00** | **8** | 0 | 0 | 0 |
| 1280 | 896×504 | 100m | 4 / 2 | **8.00** | **62** | 0 | 0 | 0 |

**도형 가림(픽셀 전수)**: ③ 대오 1 면 **0%** · ④ 대오 2 본선·casing **0%** · ⑤ 부지 본선 **0%**.
(②원 13.69/14.40% 와 ⑤ casing 0.27% 는 종전과 동일 — 아래 기록 참조)
④↔⑥ **18.35** · ⑥ 박스 우측 **28** — 전부 §22 값 그대로다. **한 값도 바뀌지 않았다.**

---

## 4. 지도 조작 계약 — 불변 확인 ✅

| 입력 | 실측 | 판정 |
|------|------|------|
| 한 손가락 드래그(지도) | 페이지 **338px 스크롤** · 지도 반응 0 | ✅ |
| **핀치**(코드 변경 0 — QA 몫) | 축척 **300m → 50m** | ✅ **동작 확인** |
| 맨 휠 / Ctrl+휠 | 19회차 확인분 유지(맨 휠 = 페이지 스크롤 · Ctrl+휠만 확대) | ✅ |
| `축소` z15 비활성 · `처음 위치로` 픽셀 동일 복귀 | 위 §2 표 | ✅ |

---

## 5. ⚠ 개발자 보고와 어긋난 것 1건 — **불일치(계약 위반 아님)**

**두 손가락 평행이동 시 축척이 여전히 바뀐다.**

| 항목 | 개발자 보고 | **QA 실측** |
|------|------------|-----------|
| 축척 | 100m **불변** | **100m → 300m** (줌 2단 하락) |
| 오버레이 이동 | **0** | 이동함 |
| 페이지 스크롤 | 0 | **0** ✅ 일치 |

- 측정 조건: 두 손가락 **간격을 100px 로 고정**한 채 `(+6, +4)` 씩 10스텝 평행이동(CDP 터치).
- **원인은 제거된 `panBy` 리스너가 아니라 네이버의 `pinchZoom: true`** 다. 코드에서 팬 리스너가 사라진 것은
  `grep` 으로 확인했고, 남은 2-touch 해석은 **네이버가 전담**한다. 손가락 간격이 완전히 일정해도
  네이버가 미세 오차를 줌으로 환산한다.
- **계약 위반은 아니다.** 팬을 제거한 뒤의 계약은 "두 손가락 = 핀치"뿐이고, 스펙이 요구하는 팬 동작이
  더는 없다. `처음 위치로` 로 복구되는 것도 확인했다.
- **다만 "축척 불변"이라는 개발자 실측은 재현되지 않았다.** 리포트에 사실대로 남긴다.
- **리더가 지적한 "두 손가락 이동 중 페이지 4px 스크롤"은 재현되지 않았다** — 이번 실측 **0px**. 19회차 기록을 정정한다.

---

## 6. 회귀 · 기본 — 전건 통과

| 항목 | 결과 |
|------|------|
| **문안 게이트** | 렌더 전수 — 금지 15종(`우측 도로`·`528세대`·`열렸`·`개최`·`성황`·`320`·`크롬`·`설정 >`·`출석 무효`·`20:00까지`·`폐회 후 출석`·`건물`·**`현장 안내판`**·**`390`**·**`결의대회대오`**) **적발 0건** · **직선따옴표 0** · 필수 문안 14건 **누락 0** · `※ 상황에 따라 식순 변경 가능` **2곳** · `[대오 2]` **1건**(범례 ④ 행) |
| **20:30** | `<dt>` `본대회`/**`코스콤지부`**/`장소` 3행 · `<dd>` **`20:30까지 참가 계획`** · `종료` 라벨 0 · 각주 2줄 문자 일치 · **`20:30` 이 `rally-2026-08-28/page.tsx` 밖 0건** |
| **⑥ 도트** | 범례 `⑥ 여의도공원 입구 — 확인된 위치입니다. 화장실은 공원 안에 있으며…` · `화장실` 단독 0 · `현장 안내판` 0 · `80 m`(대오 2 기준) · `390` 0 |
| **범례 diff 0** | ①②③ 행·키 줄(`실선 = 확인된 위치 · 점선 = 근사 · 옅은 면 = 범위 근사`) **원문 그대로**. 추가는 ⑥ 행뿐 |
| **보호 파일** | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter`·`RallyEntryCard`·**`RallySchedule`**·**`QrAttendanceCard`** **9종 전부 diff 0줄** |
| **상태 전이** | 오늘(8/20) **`upcoming` 정상** — `오늘`·`완료` 배지 0, past 문장 없음 |
| **대비** | `#093389:#ffffff` **11.37**(컨트롤·`닫기` 버튼 공용) · `#1a1a1a:#ffffff` **17.40** · `#4b5563:#ffffff` **7.56**. 신규 조합 0 |
| **반응형** | 360/768/1280 가로 스크롤 **0** · 라벨 잘림 0 · 컨트롤 2행 |
| **빌드** | 라우트 **7개** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |

---

## 7. 기록 (재조사 불요)

- **154** 지도 + 범례가 360×640 한 화면에 들어가지 않는다(**869px**). 범례 문구는 검증 조건이라 줄이지 않았다.
- **157 [별건]** ① 이 ② 메인무대 원을 덮는 비율 — QA 측정 **본선 14.40% · casing 13.69% · 면 9.63%**(스펙 12.28%).
  **19회차와 동일 수치이고 이번 변경으로 바뀌지 않았다.** 분모 정의 차이로 보이며 리더 판단 대기 항목.

## 8. 미검증 (19회차와 동일)

| # | 항목 | 사유 |
|---|------|------|
| 1 | 실물 단말(iOS Safari `100dvh`·`::backdrop`·관성 스크롤) | Chromium 기기 에뮬레이션으로 터치 전항목을 실행했으나 iOS 구현 차이는 재현 대상이 아니다. **모달 판정은 이 한계와 무관하게 에뮬레이션에서 전건 재현됐다** |
| 2 | `prefers-reduced-motion: reduce` 애니메이션 억제 | 네이버 API 내부 동작을 외부에서 관측할 수단이 없다 |

---

## 최종 판정

**19회차 실패 2건이 모두 해소됐고 신규 실패는 없다. QA 관점에서 막을 사유가 없다.**

불일치 1건(두 손가락 평행이동 시 축척 변화)은 **계약 위반이 아니며** 복구 경로가 있으나,
개발자 실측과 어긋나므로 사실대로 남긴다. 리더가 이 한 건을 어떻게 다룰지 판단하면 된다.

## 정리

- 소스 sha256 을 측정 전후 대조해 **프리즈를 검증**했다.
- 터치 검증은 **`hasTouch`·`isMobile` 전용 컨텍스트 + CDP `Input.dispatchTouchEvent`** 로 수행했고 매번 컨텍스트를 닫았다.
- 로드뷰 실패 경로는 **파노라마 API 라우트 차단**으로 재현했다(네트워크 조작은 브라우저 컨텍스트 한정).
- 도형 가림은 **`isPointInStroke`/`isPointInFill` 격자 전수**, 크롬 검사는 **`<img>` 전수**로 했다.
- QA 서버 정지 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 1단계 — 범례 ① 보강 + 네이버 길찾기 링크 (20회차)

**대상 코드(프리즈 검증 — 측정 전후 sha256 동일)**
`rallyMap.ts` `f5c581a9…`(07:57:22) · `page.tsx` `992ea5a7…`(07:58:06) · `routes.ts`(신규 24줄)
**변경 규모** 3파일 `+74 / −3` · **`RallyMap.tsx` diff 0줄**(렌더 로직 무변경)
**빌드** 07:58:09(최종 소스 이후) · **서버** QA 가 `next start -p 3000` 기동 후 정지
**판정 근거** §24 · 검증 10회차(요구 67~78) · `03_developer_impl.md` §24
**시각** 2026-08-21 07:58~08:12 KST

## 20회차 결과: **통과 21 | 실패 0 | 기록 1**

---

## 1. 범례 ① 행 보강 ✅

렌더 실측 문자열:

```
● ① 국회의사당역 5번 출구 — 확인된 위치입니다. 메인무대는 이 앞에 설 예정입니다
```

- **리더 제시 문구와 일치**한다. `확인된 위치` → `확인된 위치입니다` 는 ⑥ 행 표기와 정렬한 것이며 의미 변화가 없다.
- **요구 8(확인/예정 구분)의 이행 주체가 이 행**이라는 설계가 문면에서 성립한다 —
  `확인된 위치입니다`(출구, 실선 도트 = 확인 등급)와 `설 예정입니다`(무대)가 **한 문장 안에서 분리**돼 있다.
- **범례 ②③④⑤⑥ 행과 키 줄은 한 글자도 바뀌지 않았다**(요구 71) — `git diff` 상 변경은 ① 행 1줄뿐이다.
  키 줄 `실선 = 확인된 위치 · 점선 = 근사 · 옅은 면 = 범위 근사` 원문 유지.

---

## 2. 네이버 길찾기 링크 — **실렌더로 확인** ✅ ★

**HTTP 200 을 근거로 삼지 않았다. 실제로 열어 도착 핀을 눈으로 확인했다.**

| 검사 | 결과 |
|------|------|
| 최종 URL | `map.naver.com/p/directions/-/3zf71R,2AKrxU,국회의사당역%205번%20출구,,/-/transit` (200) |
| **도착지 입력란 실제 값** | **`국회의사당역 5번 출구`**(`input.input_search` 의 `value`) ✅ |
| **지도 위 빨간 `도착` 핀** | **국회의사당역 `5` 번 출구 마커 바로 위에 꽂힌다** — 스크린샷 확대로 확인. 주변 출구(2·3·9)와 명확히 구분되고 `의사당대로` 도로명이 함께 보인다 ✅ |
| 엉뚱한 위치 여부 | 본문에 `성산동`·`마포` **0건**. 지도 중심이 국회의사당역 일대 ✅ |
| 좌표 형식 | base62 인코딩(`3zf71R,2AKrxU`) — 소수 좌표 형식으로 바뀌지 않았다 ✅ |

**마크업 (요구 74~77)**

| 항목 | 실측 | 판정 |
|------|------|------|
| 외부 이동 3중 표시 | ① `ExternalLinkIcon` **SVG 1개**(텍스트 ↗ 아님) ② 메타 문구 `외부 링크(새 창) · map.naver.com` ③ 접근성 이름에 전부 포함(단일 `<a>`) | ✅ |
| `target` / `rel` | `_blank` / **`noopener noreferrer`** | ✅ |
| 표시 도메인 | `NAVER_DIRECTIONS_DISPLAY_HOST = new URL(EXTERNAL_LINKS.naverDirections).host` — **`href` 에서 파생**, 리터럴 없음 | ✅ |
| 배치 | 블록 1 `<dl>` 하단 **721** → 링크 상단 **745** → 첫 `※` 상단 **901**. **`dl` 바로 아래·`※` 2행보다 위** | ✅ |
| 표면 | `border: #6b7280`(border-border-strong, UI **4.83** ✓) · `bg: #ffffff` · 제목 `#093389`(**11.37**). **아웃라인 필 아님 · accent(오렌지) 미사용** | ✅ |
| 지도 컨트롤 행 | **5개 그대로**(`축소`·`확대`·`처음 위치로`·`내 위치 표시`·`로드뷰 보기`) — **6번째 버튼 없음** | ✅ |
| 보조 문구 | `도착지는 국회의사당역 5번 출구입니다. 출발지를 입력하면 경로가 나옵니다.` — `text-ink`(흐리지 않음) | ✅ |
| §0.4 | 내장 지도·텍스트 안내가 **그대로 남아 있다**(요구 77) | ✅ |

---

## 3. 불변 확인 — **§22·§23 실측과 전부 동일** ✅

| 뷰포트 | 박스 | 축척 | pill/배지 | 최소 쌍간격 | 박스 여백 최솟값 | 실중첩 | 잘림 |
|---|---|---|---|---|---|---|---|
| 360 | 328×410 | 100m | 4 / 2 | **8.00**(②③·④⑤) | **8.28** | 0 | 0 |
| 768 | 704×396 | 100m | 4 / 2 | **8.00** | **8** | 0 | 0 |
| 1280 | 896×504 | 100m | 4 / 2 | **8.00** | **62** | 0 | 0 |

- **도형 가림(픽셀 전수)**: ③ 대오 1 · ④ 대오 2 · ⑤ 부지 **본선 0%**. ② 원 13.69/14.40% 와 ⑤ casing 0.27% 는 종전과 동일.
- **지도 라벨 ① 이 `5번 출구` 그대로다** ✅ — 렌더 전수에서 **`(메인무대 예정)` 0건**.
  360px 초과로 4방향 전부 기각돼 **2단계 클릭 팝업으로 이월**된 것이 지켜졌다.
- **①② 병합 0**(요구 70) — pill 4개(①②③④)·배지 2개(⑤⑥)로 ①과 ②가 별개 라벨로 유지된다.
- **라벨 ②③④⑤⑥ 문자열 diff 0**(요구 71) — `git diff` 상 `label:` 변경 0줄.
- **`RallyMap.tsx` diff 0줄** — 라벨 렌더·배치 로직이 손대지지 않았으므로 위 불변은 **구조적으로도 보장**된다.

---

## 4. 회귀 · 기본 — 전건 통과

| 항목 | 결과 |
|------|------|
| **문안 게이트** | 금지 15종(`우측 도로`·`528세대`·`열렸`·`개최`·`성황`·`320`·`크롬`·`설정 >`·`출석 무효`·`20:00까지`·`폐회 후 출석`·`건물`·`현장 안내판`·`390`·`결의대회대오`) **적발 0** · **직선따옴표 0** · 필수 문안 13건 **누락 0** · `※ 상황에 따라 식순 변경 가능` **2곳** · `[대오 2]` **1건**(범례 ④) |
| **20:30** | `<dt>` `본대회`/**`코스콤지부`**/`장소` · `<dd>` `20:30까지 참가 계획` · 각주 2줄 유지 — **링크 삽입이 `<dl>` 구조를 건드리지 않았다** |
| **⑥ 도트** | 범례 ⑥ 행·`여의도공원 입구`·`80 m`·`390` 0건 유지 |
| **보호 파일** | 10종 전부 **diff 0줄** — `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter`·`RallyEntryCard`·`RallySchedule`·`QrAttendanceCard`·**`RallyMap.tsx`** |
| **상태 전이** | `upcoming` 정상(배지 0 · past 문장 없음) |
| **대비** | `#093389:#ffffff` **11.37**(링크 제목) · `#1a1a1a:#ffffff` **17.40**(보조 문구) · `#4b5563:#ffffff` **7.56** · `#6b7280:#ffffff` **4.83**(링크 테두리, UI 3:1 ✓). **신규 조합 0** |
| **반응형** | 360/768/1280 가로 스크롤 **0** · 링크 카드 288×144(360px) |
| **200% 확대** | 34px — **footer 숨김 시 394 → 360**. `SiteFooter`(diff 0) 기존 결함이며 FOLLOWUPS 7번 이관 건. 이번 변경과 무관 |
| **빌드** | 라우트 **7개** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |

---

## 5. 기록 1건 (리더 지정 · 재조사 불요)

**360×640 에서 지도 + 범례가 891px** 로 뷰포트를 넘는다(종전 869 → **+22px**, 범례 ① 행이 2줄로 늘어난 몫).
**범례를 줄이지 않았다** — 문구가 검증 조건(요구 69·71)이다. 기존 **154** 항목의 연장이며 스크롤로 도달 가능하다.

---

## 최종 판정

**실패 0. QA 관점에서 1단계 배포를 막을 사유가 없다.**

가장 중요한 항목이었던 **길찾기 링크의 도착지가 실제로 국회의사당역 5번 출구에 꽂힌다**는 것을
SPA 실렌더 + 스크린샷 확대로 확인했다. HTTP 200 을 근거로 삼지 않았다.

## 정리

- 소스 sha256 을 측정 전후 대조해 프리즈를 검증했다.
- 외부 사이트(`map.naver.com`)는 **읽기 전용 조회**만 했다 — 입력·클릭·로그인 없음.
- 도형 가림은 `isPointInStroke`/`isPointInFill` 격자 전수로 쟀다.
- QA 서버 정지 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 2단계 — 지도 라벨 클릭 팝업 (21회차)

**대상 코드(프리즈 검증 — 측정 전후 sha256 동일)**
`rallyMap.ts` `eddc529a…`(08:59:20) · `RallyMap.tsx` `1a7498c8…`(09:03:30) · `globals.css` `fc544b1c…`(09:01:54)
**변경 규모** 4파일 `+275 / −11` · **빌드** 09:03:34(최종 소스 이후)
**판정 근거** §25 · 검증 11회차(요구 83~93) · `03_developer_impl.md` §25
**시각** 2026-08-21 09:04~09:30 KST

## 21회차 결과: 통과 28 | **실패 1** | 기록 1 | 미검증 2

---

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| **1** | **키보드 접근 (§25 어포던스)** | `RallyMap.tsx` — `data-rally-hit` 마커 주입 HTML | **키보드로 팝업을 열 수 없다.** 문서 처음부터 **Tab 45회를 눌러도 `data-rally-hit` 요소에 도달하지 못한다**(도달 0). 마커는 `<span>`/`<div>` 이고 **`role`·`tabindex`·`aria-*` 가 전부 없다**. 팝업 컨테이너는 `aria-hidden="true"` 이고 그 안의 `닫기` 버튼은 `tabindex="-1"` 이라 순회에서도 빠진다. **포인터(마우스·터치) 전용 기능**이다 — 리더가 "못 하면 시각 사용자 전용 기능"이라고 짚은 그 상태다 | 각 `data-rally-hit` 에 **`role="button"` + `tabindex="0"` + `aria-expanded`** 를 주고 `Enter`/`Space` 핸들러를 붙여라. 팝업을 열 때 컨테이너의 `aria-hidden` 을 해제하고 `닫기` 의 `tabindex` 를 `0` 으로 올리며 포커스를 옮긴 뒤, 닫을 때 원래 마커로 되돌리면 된다. **⚠ 지도 안 탭 정지점이 6개 늘어나므로 §20.9(지도 안 정지점 최소화)와 충돌한다 — 디자이너 판정이 필요할 수 있다** |

**⚠ 이 실패의 성격을 정확히 적는다 — 정보 접근 손실은 0이다.**
팝업 본문이 **범례 행과 글자까지 동일**하고 범례는 `figcaption` 의 일반 텍스트라 스크린리더가 정상 낭독한다.
잃는 것은 **정보가 아니라 조작 수단**이다. `aria-hidden` + `tabindex="-1"` 조합 자체는
**WCAG 4.1.2 위반이 아니다**(포커스 불가능한 요소를 숨긴 것이므로 올바른 처리다).
걸리는 것은 **2.1.1(키보드)** 이며, 동일 정보가 범례로 완전 제공된다는 점이 완화 요인이다.

---

## 1. 어포던스 4겹 (§25.2) — 문구와 클릭 대상의 일치 ★

| 겹 | 실측 | 판정 |
|----|------|------|
| figcaption 안내 | **`※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.`** 첫 줄에 존재 | ✅ |
| `cursor: pointer` | `data-rally-hit` **6개 전부** | ✅ |
| hover 링 | globals.css 규칙 실재. **런타임 검증 실패 — 미검증**(아래) | △ |
| 선택 링 | 클릭 후 배지 `box-shadow` 에 **`rgb(26,26,26) 0 0 0 3px`** 추가 확인 | ✅ |

**⚠ 문구와 클릭 대상의 일치 — 통과** (리더가 지목한 지점)

- **도형 클릭으로는 팝업이 열리지 않는다** ✅ — ④ 대오 2 밴드 중심을 실클릭했으나 **미열림**.
  문구가 `번호를 누르면` 이므로 도형이 열리면 그 문안이 거짓이 되는데, **그 사고가 없다.**
- **번호는 6개 전부 열린다** ✅ — `②④ pill` 포함 실클릭 전수 성공.
  ②④ 는 pill 전체(135×34 · 111×34)가 히트라 **문구보다 넓게** 잡히지만, pill 안에 번호가 있으므로
  문구가 거짓이 되지 않고 **더 누르기 쉬운 방향**이라 해가 없다.

---

## 2. 팝업 — 6개 전수 실클릭 ✅

**모든 클릭은 Playwright 실입력(`locator.click`·`mouse.click`)으로 했다. 합성 `MouseEvent` 를 쓰지 않았다.**

| 항목 | 실측 | 판정 |
|------|------|------|
| **본문 = 범례 행** | 6개 전부 `{번호} {라벨}` + **범례 행 본문 그대로**. 별도 문자열 **0** | ✅ |
| 잘림 | `inset-x-4` 로 가로 박스 고정 — x16 / w296(=328−32). **박스 밖 false, 6개 전부** | ✅ |
| 동시 열림 | **항상 1개** | ✅ |
| 자기 마커 가림 | ①②③⑤⑥ **0px** · **④만 3768.2px²**(기록 1) | △ |
| 토글(같은 번호 재클릭) | 열림 → 닫힘 | ✅ |
| `닫기` 버튼 | 닫힘 | ✅ |
| `Esc` | 닫힘 | ✅ |
| **지도 빈 곳 실클릭** | **닫힘** — `p.mouse.click`(실입력)으로 도형·라벨 없는 좌하단 클릭 | ✅ |
| **줌해도 유지** | ① 로 시험(확대해도 박스 안에 남는 마커): 확대 1단·축소 복귀 **모두 유지** | ✅ |
| 마커가 박스 밖 → 닫힘 | ⑤ 로 4단 확대 시 **닫힘** | ✅ |
| 로드뷰 열면 닫힘 | **닫힘** | ✅ |

> **내 시험 설계 오류 1건을 정정한다.** 처음에 ⑤ 로 "줌 유지"를 시험해 *실패*로 읽었으나,
> 그것은 **⑤ 마커가 확대로 박스 밖에 나가 정상 닫힘**한 것이었다. 박스 안에 남는 ① 로 다시 시험해
> **줌 유지가 정상 동작함을 확인**했다. 실패로 올리지 않는다.

---

## 3. 셀렉터 규약 (리더 지시) ✅

| 셀렉터 | 실측 | 규약 |
|--------|------|------|
| `data-rally-badge` | **4개**(exit5·column-1·dsharp·park-entrance) | 접힌 배지 전용 ✅ |
| `data-rally-number` | **6개**(①~⑥) | 화면의 번호 전부 ✅ (요구 86) |
| `data-rally-pill` | **2개**(stage ② · column-2 ④) | 상시 노출 pill ✅ |
| `data-rally-hit` | **6개**, 전부 지도 마운트 안 | 클릭 대상 ✅ |

**§22·§23 기준값이 묶인 `data-rally-badge` 는 4개로 유지**돼 두 규약이 섞이지 않았다.

---

## 4. 보호 파일 `globals.css` 추가 1건 — **영향 범위 한정 확인** ✅

```css
@media (any-hover: hover) {
  [data-rally-hit]:hover [data-rally-badge],
  [data-rally-pill][data-rally-hit]:hover { box-shadow: 0 1px 3px …, 0 0 0 3px var(--color-ink); }
}
```

| 검사 | 결과 |
|------|------|
| 기존 규칙 변경 | **0줄** — 파일 끝에 `+16 / −0` 순수 추가 |
| 선택자 범위 | **`data-rally-hit` 은 `RallyMap.tsx` 밖에서 쓰이지 않는다**(`grep` 전수 — globals.css 자신의 3줄 외 0건). 지도 마커에만 닿는다 |
| 터치 기기 | `@media (any-hover: hover)` 로 제외 ✅ |
| 색 | `--color-ink`(중립) — 파랑·회색(확정도·성격 의미색) 회피 ✅ |

**사유도 타당하다** — 마커 DOM 은 네이버가 문자열로 주입하므로 Tailwind 클래스가 닿지 않는다.

---

## 5. 불변 확인 ✅

| 뷰포트 | 축척 | **② pill** | **④ pill** | 최소 여백 | 잘림 | 실중첩 | 가로 스크롤 |
|---|---|---|---|---|---|---|---|
| 360 | 100m | **64.5, 15** | **157.59, 324** | 15 | 0 | 0 | 0 |
| 768 | 100m | 252.5, 8 | 345.59, 317 | 8 | 0 | 0 | 0 |
| 1280 | 100m | 340.5, 62 | 433.59, 371 | 62 | 0 | 0 | 0 |

- **②④ pill 위치가 리더 제시값(② 64.5,15 · ④ 157.6,324)과 정확히 일치** — 변경 0 ✅
- **도형 가림(픽셀 전수)**: ③ 대오 1 · ④ 대오 2 · ⑤ 부지 **본선 0%** ✅
  ② 원은 **13.69/14.40% → 11.21/10.93% 로 오히려 감소**했다(① 이 pill → 배지로 작아진 효과). ⑤ casing 0.27% 종전과 동일
- **z17 에서 pill 이 `stage`·`column-2` 뿐** ✅ — ⑤⑥ pill 폐기가 지켜졌다(배지 4 · 번호 6)
- **지도 안 탭 정지점 증가 0** ✅ — 네이버 로고·저작권 링크 5개뿐(종전과 동일)
- **범례 6행·키 줄·라벨 문자열 diff 0줄** ✅ (요구 48·49·71)
- 히트 겹침 **0** ✅

---

## 6. 회귀 — 1단계 반영분 포함 전건 통과 ✅

| 항목 | 결과 |
|------|------|
| **1단계 회귀** | `page.tsx`·`routes.ts` **diff 0줄** — 범례 ① 보강(`메인무대는 이 앞에 설 예정입니다`)·길찾기 링크(`네이버 지도로 길찾기`·`도착지는 국회의사당역 5번 출구입니다`·`외부 링크(새 창)`) **렌더 확인** |
| **보호 파일** | `HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter`·`RallyEntryCard`·`RallySchedule`·`QrAttendanceCard`·`page.tsx`·`routes.ts` **10종 diff 0줄** |
| **문안 게이트** | 금지 15종 **적발 0** · **직선따옴표 0** · 필수 13건 **누락 0** · 식순 단서 **2곳** · `[대오 2]` **1건** |
| **20:30** | `<dt>` `본대회`/`코스콤지부`/`장소` 유지 |
| **상태 전이** | `upcoming` 정상 |
| **대비** | `#1a1a1a:#ffffff` **17.40**(팝업 본문) · `#093389:#ffffff` **11.37** · `#4b5563:#ffffff` **7.56**. 선택 링 `#1a1a1a`. **신규 조합 0** |
| **빌드** | 라우트 **7개** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |

---

## 7. 기록 1건

**④ 코스콤지부 팝업이 자기 pill 을 3768.2px² 가린다.** ④ pill 이 y324 인데 팝업이 y176~394 라 겹친다.
다른 5개는 **0px** 이다. 팝업이 세로만 마커 반대편으로 가는 규칙에서, ④ 는 박스 하단에 가까워
반대편(위)으로 간 패널이 자기 자신까지 덮는다. **④ 는 상시 노출 pill 이라 팝업을 닫으면 즉시 다시 보이고,
팝업 안에 같은 이름(`④ 코스콤지부`)이 제목으로 있어 정보 손실은 없다.** 개선은 3단계 이후로 미뤄도 된다.

---

## 8. 미검증 2건

| # | 항목 | 사유 |
|---|------|------|
| 1 | **hover 링 실동작** | `(any-hover: hover)` 가 **true** 로 평가되고 CSS 규칙도 실재하나, 헤드리스에서 `mouse.move` 후 `hit.matches(':hover')` 가 **false** 라 링이 적용되지 않았다. **합성 마우스의 한계**로 보인다 — 같은 방식(box-shadow)의 **선택 링은 정상 작동**하므로 규칙 자체는 유효할 가능성이 높다. 실기기·실브라우저 확인 필요 |
| 2 | **44×44 터치 히트 실측** | 마커 HTML 에 **`<span style="left:-8px;top:-8px;width:44px;height:44px">` 확장 박스가 실재**함을 소스로 확인했고 `locator.click` 은 6개 전부 성공한다. 다만 좌표 기반 오프셋 클릭(`mouse.click`)이 네이버 오버레이 스택에 가로채여 **경계 밖 히트를 좌표로 재지 못했다**. DOM 상 44px 은 확인, 실제 히트 반경은 미측정 |

---

## 최종 판정

**실패 1건(키보드 접근)을 제외하면 2단계 구현은 목표를 달성했다.**
특히 리더가 지목한 최대 위험 — **문구(`번호를 누르면`)와 클릭 대상의 일치** — 는 정확히 지켜졌다.
도형은 열리지 않고 번호는 6개 전부 열린다.

**실패 1의 처리는 리더 판단이 필요하다**: 키보드 접근을 열면 지도 안 탭 정지점이 6개 늘어
§20.9(지도 안 정지점 최소화)와 충돌한다. **정보 접근 손실이 0**(범례가 동일 문구 제공)이라는 점이
"조작 수단만 없다"는 성격을 정한다.

## 정리

- 소스 sha256 을 측정 전후 대조해 프리즈를 검증했다.
- **모든 개폐 검사를 Playwright 실입력으로 했다** — 리더 지시대로 합성 `MouseEvent` 를 쓰지 않았다.
- 셀렉터 규약(`data-rally-badge` 4 / `data-rally-number` 6)을 지켜 개수를 혼동하지 않았다.
- 도형 가림은 `isPointInStroke`/`isPointInFill` 격자 전수로 쟀다.
- QA 서버 정지 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

# QA 리포트: 3단계 — 드래그 개방 · 전체 화면 지도 · 키보드 부채 상환 (22회차)

**대상 코드(프리즈 검증 — 측정 전후 sha256 동일)** `RallyMap.tsx` `b39d9d2d…`(10:45:59) — **단일 파일 `+954 / −229`**
**빌드** 10:46:03(최종 소스 이후) · **판정 근거** §27(§27.13 사용자 결정 반영분) · `03_developer_impl.md` §27
**시각** 2026-08-21 10:49~11:20 KST

## 22회차 결과: 통과 31 | **실패 1** | 기록 3 | 판정 대기 1 | 미검증 1

---

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| **1** | **키보드 부채 상환 미완 (§26.1.4)** | `RallyMap.tsx:1123~1134` `focusItem` ↔ `:627~636` 포커스 복원 | **방향키로 다음 마커에 가면 포커스가 유실된다.** `roving tabindex` 자체는 `column-2 → dsharp` 로 정상 이동하는데 **`document.activeElement` 가 마커가 아니게 되고**(`body` 로 떨어짐), 그 뒤 방향키를 더 눌러도 `roving` 이 `dsharp` 에서 **멈춘다**(키 이벤트가 그룹 핸들러에 도달하지 않는다). 결과: **키보드로 열 수 있는 팝업은 진입 마커 ④ 하나뿐이고 나머지 5개는 열 수 없다.** 6회 반복 실측에서 **1회차만 성공, 2~6회차 전부 실패** | **원인은 `focusItem` 안의 실행 순서다.** `target?.focus({preventScroll:true})` 를 부른 **직후** `applyLabelVisibility(map.getZoom())` 가 `paint()` 를 돌려 **마커 DOM 을 재생성**하고, 방금 포커스한 요소가 제거된다. `paint()` 의 복원 로직은 `active.closest("[data-rally-hit]")` 로 **`inGroup` 을 먼저 확인**하는데 그 시점에는 이미 `body` 라 **복원을 건너뛴다**. → ① `applyLabelVisibility` 를 **먼저** 호출하고 그 뒤에 `focus()` 하거나, ② `paint()` 복원 조건을 `activeElement` 가 아니라 **`focusedRef.current` 기준**으로 바꿔라(그룹 진입 여부는 별도 플래그로 관리) |

**이 실패의 무게**: §26.1.4 는 기한을 **"3단계 배포 시점 또는 8/27 중 먼저"** 로 두고 **미해결 시 자동 폴백**(라벨 되돌리기)을 걸어 뒀다. **부채가 절반만 상환됐으므로 폴백 조건이 소멸하지 않았다.**
다만 **2단계보다는 분명히 전진했다** — `aria-hidden` 해제·`닫기` 포커스 개방·그룹 진입·Enter/Esc 는 전부 동작한다. 남은 것은 **방향키 이동 한 지점**이다.

---

## 1. 키보드 (§27.8) — 상환된 부분 / 남은 부분

| 항목 | 개발자 보고 | **QA 실측** | 판정 |
|------|------------|-----------|------|
| 진입 마커 | ④ | **`column-2`(④)** | ✅ 일치 |
| 그룹 정지점 | 1개(페이지 순증 0) | **지도 안 정지점 1개**(`rally-marker-column-2`), roving `tabindex` 가 나머지 5개 전부 `-1` | ✅ |
| 팝업 `aria-hidden` 해제 | 해제 | **`null`**(속성 없음) | ✅ **2단계 실패 해소** |
| `aria-hidden` 안 포커스 가능 요소 | 0 | **0건**(전수 검사) | ✅ |
| Enter 로 열림 | ○ | ④ 에서 **열림**, 본문 = 범례 행 | ✅ |
| Esc 닫힘 · 포커스 복귀 | ○ | **닫힘 + ④ 로 복귀** | ✅ |
| **방향키 이동** | ○ | **✗ 포커스 유실** — 위 실패 1 | **✗** |

---

## 2. ★ 감수된 위험의 정량화 (실패로 올리지 않음 — 리더 지시)

**사용자가 위험을 고지받고 선택한 항목이다. 아래는 나중에 판단할 근거로 남기는 수치다.**

### 2-1. 드래그 개방 자체 — 재현 확인

- `touch-action`: 지도 마운트 **`none`**(박스는 `auto`) — 한 손가락 드래그의 본체
- 기기 에뮬레이션(`hasTouch`·`isMobile`·CDP 터치) 실측: **지도 위 위로 스와이프 → 페이지 스크롤 `0px`**,
  지도만 이동(`65,15 → 65,-145`). **지도 위에서는 페이지를 내릴 수 없다** — 설계대로다.

### 2-2. 점유율·안전 여백 — **개발자 실측을 독립 재현했고 수치가 일치한다**

360×800 · 엄지 영역 = 하단 60%(320~800px) · 문서 전 구간 10px 간격 스캔(`scroll-behavior:auto` 강제).

| 지표 | 개발자 | **QA** | 일치 |
|------|--------|--------|------|
| 최대 점유율 | 85.4% | **85.4%** | ✅ |
| 지도가 엄지 영역에 걸리는 스크롤 구간 | 15.9% | **15.9%** | ✅ |
| 좌우 여백 | 16px | **16px**(엄지가 들어가지 않는다) | ✅ |
| 점유 ≥80% 구간 | — | **13개 구간** | — |
| **최악 구간의 지도 밖 세로 띠** | (70px) | **325px**(화면 상단) | 정의 차 |

> **안전 세로 70px 과 325px 의 차이는 측정 정의 차이다.** 나는 **화면 안에서 지도 밖인 연속 세로 띠의
> 최댓값**(위/아래 중 큰 쪽)을 쟀고, 최악 구간에서 그 띠는 **화면 상단 325px** 이다.
> 개발자의 70px 은 다른 정의(예: 엄지 영역 안쪽의 지도 밖 띠)로 보인다.
> **결론은 같다 — 탈출 경로는 있고, 그 경로가 엄지 자리가 아닌 화면 위쪽에 있다.**

### 2-3. **QA-247 재현 — 개발자 자진 보고가 맞다** ★

안내 문구: **`※ 지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 밖을 쓸어 주세요.`**

| 지표 | 값 |
|------|-----|
| 점유 ≥70% 이면서 **문구가 화면 밖**인 구간 | **16개** |
| 그 구간의 **최대 점유율** | **85.4%** — 즉 **최악 구간에서 문구가 안 보인다** |
| 문구가 보이는 **최대 점유율** | **80.2%** (개발자 보고 77% 와 근사) |

**완화 논리("눈만 아래로 내리면 답이 있다")가 최악 구간에서 성립하지 않는다**는 개발자 진단이 재현됐다.
탈출 경로(상단 325px)는 존재하지만 **그것을 알려 주는 문장이 그 순간 화면에 없다.**

### 2-4. **QA 가 추가로 짚는 각도 — 개발자 보고에 없던 것**

1. **문구가 지도 아래에 있다는 배치 자체가 문제의 원인이다.** 점유가 높을수록 지도가 화면을 채우고
   그만큼 아래 문구가 뷰포트 밖으로 밀린다 — **문구의 가시성과 위험도가 반비례**한다.
   완화가 필요한 정확히 그 순간에 완화 수단이 사라지는 구조다.
2. **탈출 경로가 화면 상단인데 안내는 아래를 가리킨다.** 문구는 `지도 밖을 쓸어 주세요` 라고만 하고
   **어느 쪽인지 말하지 않는다.** 최악 구간에서 지도 밖은 **위쪽 325px 뿐**이고 아래는 거의 없다.
   문구가 보이더라도 조합원이 아래를 시도하면 실패한다.
3. **`처음 위치로` 는 이 사고를 해결하지 못한다.** 그것은 **지도를 되돌리는** 버튼이지
   **페이지를 내리는** 수단이 아니다. 완화 조치 목록에서 이 둘이 섞여 있다.
4. 좌우 여백 16px 은 **양쪽 다** 16px 이라 좌·우 어느 쪽으로도 엄지가 들어가지 않는다(확인).

→ **디자이너 추가 완화 요청 시 이 4가지를 근거로 쓸 수 있다.**

---

## 3. 완화 조치 실효성

| 조치 | 실측 | 판정 |
|------|------|------|
| `처음 위치로` 상시 노출 | 지도 밖 컨트롤에 **항상 존재**(146px 행에 `지도 크게 보기` 와 나란히) | ✅ 노출은 됨 (단 위 2-4-3) |
| 지도 상하 스크롤 여백 | 최악 구간 **상단 325px** · 점유 ≥80% 구간 최소 **295px** | ✅ 띠는 충분히 넓다 |
| 좌우 여백 | **16px** — 엄지 진입 불가 | ✗ 실효 없음(설계상 예상된 값) |

---

## 4. 전체 화면 지도 (§27) — 왕복 2회 ✅

| 항목 | 실측 | 판정 |
|------|------|------|
| 모달 높이 | **900 / innerHeight 900**(100dvh) | ✅ |
| **`scrollY` 왕복** | 2773 → **2773**, 차이 **0px**(2회 모두) | ✅ |
| **페이지 지도 좌표** | `57,6` → **`57,6`** 동일(2회 모두) · 축척 **100m** 유지 | ✅ |
| **포커스 복귀** | **`지도 크게 보기`** 버튼(2회 모두) | ✅ |
| 초기 포커스 | **`닫기`** | ✅ |
| body 스크롤 잠금 | `top: -2773px` → 닫으면 원복 | ✅ |
| 모달 안 팝업 | **열림** | ✅ |
| 모달 버튼 | `닫기`·`확대`·`축소`·`처음 위치로` | ✅ |
| **범례** | 모달에 **없음** — **판정 대기**(실패 아님) | — |

---

## 5. 지도 안 `+`/`−` · 컨트롤 배치 ✅

- `rally-zoom-in` **44×44 @257,12** · `rally-zoom-out` **44×44 @257,54** — **지도 박스 안 우상단**
- **마커·배지·축척 바·저작권과 충돌 0px** · **도형 본선 가림 0px**(픽셀 전수)
- **지도 밖 컨트롤 4개 · 2행** — `지도 크게 보기`+`처음 위치로`(1행) / `내 위치 표시`+`로드뷰 보기`(2행). 전부 44px ✅

> **내 1차 분류 오류를 정정한다.** 처음에 `mount` 포함 여부로 나눠 "컨트롤 6개 4행"으로 읽었으나,
> `+`/`−` 는 **박스 안·마운트 밖 오버레이**라 그렇게 잡힌 것이다. **박스 기준으로 다시 재니 리더 전달과 일치**한다.

---

## 6. 불변 · 회귀 ✅

| 항목 | 결과 |
|------|------|
| **보호 파일** | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter`·`RallyEntryCard`·`RallySchedule`·`QrAttendanceCard`·`page.tsx`·`routes.ts`·**`rallyMap.ts`** — **12종 전부 diff 0줄**. 이번 변경은 `RallyMap.tsx` **단일 파일** |
| **1·2단계 회귀** | 범례 ① 보강(`메인무대는 이 앞에 설 예정입니다`) · 길찾기 링크(`네이버 지도로 길찾기`·`도착지는 국회의사당역 5번 출구입니다`) **렌더 확인** |
| **문안 게이트** | 금지 15종 **적발 0** · **직선따옴표 0** · 필수 11건 **누락 0** · 식순 단서 **2곳** · `[대오 2]` **1건** |
| **20:30** | `<dt>` `본대회`/`코스콤지부`/`장소` 유지 |
| **상태 전이** | `upcoming` 정상 |
| **대비** | `#093389:#ffffff` **11.37** · `#1a1a1a:#ffffff` **17.40**. 신규 조합 0 |
| **빌드** | 라우트 **7개** · `npx tsc --noEmit` **오류 0** · `npm run lint` **경고 0** |

---

## 7. 기록 3건

1. **감수된 위험 수치** — 위 §2 전체. 최대 점유 **85.4%** · 걸침 구간 **15.9%** · 좌우 여백 **16px** ·
   최악 구간 탈출 띠 **상단 325px** · **문구가 안 보이는 최대 점유 85.4%**.
2. **전체 화면 모달 안에서 `Esc` 한 번에 팝업과 모달이 함께 닫힌다.** 팝업만 닫고 모달을 유지하는 것이
   중첩 레이어의 통상 동작이다. §23.1.6 은 "`Esc` 로 닫힌다"만 요구해 **위반은 아니다.** 기록만 남긴다.
3. **②④ pill 이 드래그 중 도형을 가리는 정도**(§25 에서 3단계로 넘긴 항목) — 초기 뷰에서
   **도형 본선 가림 0%** 이고, 드래그는 지도를 옮길 뿐 pill 과 도형의 **상대 위치를 바꾸지 않으므로**
   가림 비율이 변하지 않는다(구조적). 별도 수치 없음.

## 8. 판정 대기 1건

**전체 화면 모달에 범례가 없다.** 디자이너가 근거 5건과 함께 설계하고 스스로 "검증 판정 전 배포 금지"를 걸어 뒀다.
QA 는 **부재를 사실로 확인**했고 **실패로 올리지 않는다.** 검증자 판정 대기.

## 9. 미검증 1건

**실물 단말 터치 드래그·핀치.** Chromium 기기 에뮬레이션 + CDP `Input.dispatchTouchEvent` 로
한 손가락 드래그를 재현해 **페이지 스크롤 0px·지도 이동**을 확인했으나, iOS Safari 의
`touch-action: none` 처리와 관성 스크롤은 재현 대상이 아니다.

---

## 정리

- 소스 sha256 을 측정 전후 대조해 프리즈를 검증했다.
- 점유율 스캔은 `scroll-behavior` 를 **런타임에서만** `auto` 로 강제해 측정 정확도를 확보했다(즉시 원복).
- 도형 가림은 `isPointInStroke` 격자 전수, 버튼 충돌은 박스 기준 사각형 교차로 쟀다.
- QA 서버 정지 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

### ⚠ 22회차 프리즈 표기 정정 (리포트 작성 직후 확인)

위 머리말에 **"측정 전후 sha256 동일"** 이라고 적었으나 **소스 파일 기준으로는 사실이 아니다. 정정한다.**

| 파일 | 측정 시작(10:49) | 리포트 작성 시점(10:58) |
|------|------------------|------------------------|
| `RallyMap.tsx` | `b39d9d2d…` | **`abf27948…`** (mtime 10:57:59) |
| `rallyMap.ts` | `eddc529a…` | **`f3ed8e68…`** (mtime 10:56:58) |
| `page.tsx` | `992ea5a7…` | **`dfed1e39…`** (mtime 10:58:11) |

**그러나 이번 회차의 측정값은 전부 유효하다.** 근거:

- 나는 `next start` 로 **빌드 산출물(`.next`)을 서빙**했고, **`BUILD_ID` mtime 은 10:46:03 으로 측정 내내 변하지 않았다.**
- 10:56~10:58 의 소스 변경은 **빌드되지 않았으므로 서버가 내보낸 코드에 반영되지 않았다.**
- 따라서 **위 모든 수치는 `RallyMap.tsx` `b39d9d2d…`(10:45:59) · 10:46:03 빌드에 대한 일관된 측정**이다.

**10:56~10:58 변경분(3파일)은 이번 회차에서 미검증이다.** 그 내용이 실패 1(방향키 포커스 유실)의
수정이라면 **별도 회귀가 필요하다.**

**교훈**: 프리즈 검증은 **소스 해시만이 아니라 `BUILD_ID` 까지 함께** 기록해야 한다.
`next start` 는 소스가 아니라 빌드를 서빙하므로 **판단 기준은 `BUILD_ID`** 다.

---

# QA 리포트: 긴급 정정 — 구역 위치 주장 제거 · ⑤ 부지 제거 (23회차)

**프리즈 검증(측정 전후 동일 — 22회차 규칙대로 `BUILD_ID` 포함)**
`rallyMap.ts` `1d86029a…` · `RallyMap.tsx` `637d4e9b…` · `page.tsx` `e7e2cbef…` · **`BUILD_ID` `YCSrlRldL5PgLwScMhEkK`**
**판정 근거** 검증 12회차(요구 98~106)·16회차(요구 130) · §28 · `03_developer_impl.md` E-4·E-5·E-7
**시각** 2026-08-21 11:20~11:35 KST

## 23회차 결과: 통과 24 | **실패 1** | 기록 1

> ⚠ 이 회차는 측정 중 코드가 3회 바뀌어 한 번 중단했다. **위 프리즈가 유지된 구간의 측정만 채택**했다.

---

## 실패 항목

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|------|------|------|----------|
| **1** | 라벨 잘림 (1280px) | `RallyMap.tsx` `FIT_PADDING` / ② `labelGap`·`placement` | **1280px 에서 축척이 `50m` 로 떨어지고 ② `메인무대(예정)` pill 이 지도 박스 위로 24px 잘린다.** 실측 `stage @324.5,**−24**` · 최소 여백 **−24** · 잘림 `[stage]`. 360(100m)·768(100m)은 정상인데 **1280만 한 단계 더 확대**된다. **2회 연속 측정에서 동일**(과도 상태 아님) | **원인은 ⑤ 제거로 `fitBounds` 범위가 좁아진 것**이다. 지점이 4개 → 3개가 되면서 남쪽 앵커(부지)가 사라져 범위가 축소됐고, 896×504 박스에서는 그 범위가 z17 에 들어가 **50m** 가 됐다. ② 는 원 위쪽(`bottom` 방향)에 붙는데 원이 위로 올라가 pill 이 박스를 벗어난다. → ① `MAX_ZOOM` 을 16 으로 낮추거나, ② `FIT_PADDING.top` 을 키우거나, ③ ② 의 `labelGap` 을 줄여라. **①이 가장 안전하다** — 3뷰포트 축척이 100m 로 통일된다 |

**리더가 우려한 지점이 정확히 발현됐다.** `fitBounds` 3점 재계산에서 **360·768 은 100m 를 지켰지만 1280 은 깨졌다.**
개발자 실측은 360px 만 커버해 이 구간을 놓친 것으로 보인다.

---

## 1. ★ 축척 100m — 뷰포트별 실측 (최우선 항목)

| 뷰포트 | 지도 박스 | **축척** | ② 좌표 | 최소 여백 | 잘림 | 2회 측정 안정 |
|---|---|---|---|---|---|---|
| **360** | 313×391 | **100m** ✅ | `69.5, 21` | **8** | 0 | ✅ |
| **768** | 689×388 | **100m** ✅ | `257.5, 19` | **19** | 0 | ✅ |
| **1280** | 896×504 | **50m** ✗ | `324.5, **−24**` | **−24** | **`stage`** | ✅ |

---

## 2. 지점 3개 · 번호 재부여 ✅

| 항목 | 실측 |
|------|------|
| 지점 | **3개** — `stage`[pill] `②메인무대(예정)` · `exit5`[badge] `①` · `park-entrance`[badge] `③` |
| 도형 | **2 svg** = ② 점선 원 1개(casing + 본선) — **부지 도형 0** |
| **번호** | `data-rally-number` = **`①`·`②`·`③`** — **연속, 건너뛴 번호 없음** |
| **번호 일치** | 배지/pill `①②③` = 범례 `①②③` = 팝업 제목 `① 5번 출구`·`② 메인무대(예정)`·`③ 여의도공원 입구` — **세 곳 전부 동일** ✅ |
| 범례 | **3행** + 각주 3줄(`※ 지도의 번호를 누르면…` · 확신도 키 줄 · LED무대/집회구역 각주) |

## 3. `더샵`·`아일랜드파크` 제거 ✅

- **렌더 0건**(3뷰포트 `document.body.innerText` 전수 — `더샵렌더: false`)
- **소스 좌표 0건** — `DSHARP_POLYGON` 실코드 제거, `dsharp` 식별자 **0건**.
  남은 `더샵`·`아일랜드파크` 10건/6건은 **전부 "제거됐다·되살리지 마라" 주석**이다.
- `MAP_FEATURES` = `dot`(exit5) + `circle`(stage) + `dot`(park-entrance) + `pin`(내 위치) — **`outline` 항목 없음**

## 4. 위치 주장 제거 (렌더 전수 · 앞 측정에서 확정, 재확인) ✅

`더샵아일랜드파크 앞 의사당대로` · `대오 1` · `대오 2` · `코스콤지부 [대오 2]` · `[대오 2]` ·
`약 220~340 m` · `여의도공원까지 약 80 m` · `종료 시각은 안내되지 않았습니다` · `20:30까지 참가 계획` ·
`결의대회대오` — **10종 전부 0건**

**소스 밴드 데이터 완전 제거**: `RALLY_COLUMNS`·`ColumnBand`·`toBandFeature` **실코드 0건**(주석만),
`column-2` 0건, 대오 밴드 좌표 0(남은 좌표는 `EXIT5`·`PARK_ENTRANCE` 뿐).

## 5. 상태 패널 (§28.2) ✅

- 문구: **`코스콤지부는 집회 3구역에 배정될 예정입니다.`** + `구역의 정확한 위치는 확인 중이라 지도에 표시하지 않았습니다.`
- **지도 박스 바로 위**에 위치(`지도위: true`, 간격 **101px**) · 색 **`rgb(26,26,26)` = `text-ink`**(흐리지 않음)
- **`ZONE_STATUS` 단일 출처 확인** — `page.tsx` 가 `ZONE_STATUS.assignment`/`.pending`/`.pendingOnMap` 을 참조하고
  **리터럴 중복 0**. 블록 2 산문과 지도 위 패널이 같은 상수에서 나온다.
- 파일 위치가 `RallyMap.tsx` → `page.tsx` 로 옮겨진 것은 **백업 패치 복원 시 패널 소실을 막는 조치**이며
  시각 위치는 동일하다. **스펙 §28.2.3 문자와 어긋나지만 실패로 올리지 않는다**(스펙 갱신 대상).

## 6. `<dl>` 교체 ✅

| `<dt>` | `<dd>` |
|---|---|
| **집회 시간** | `18:30 ~ 20:30` + `sr-only` `오후 6시 30분부터 오후 8시 30분까지` |
| **본대회** | `19:00 개회` |
| **장소** | `국회의사당역 5번 출구 메인무대 앞` (2줄 유지) |

**최대 폰트 40px 이 `18:30` 하나** — §20.3.2(페이지 유일 대형 수치) **불변 유지** ✅

## 7. 팝업 3개 ✅

| 마커 | 열림 | 본문 = 범례 행 | 잘림 |
|---|---|---|---|
| ① 5번 출구 | ✅ | `국회의사당역 5번 출구 — 확인된 위치입니다. 메인무대는 이 앞에 설 예정입니다` | 0 |
| ② 메인무대(예정) | ✅ | `메인무대 — 주최측 설치 예정…` | 0 |
| ③ 여의도공원 입구 | ✅ | `여의도공원 입구 — 확인된 위치입니다. 화장실은…` | 0 |

## 8. 회귀 ✅

| 항목 | 결과 |
|------|------|
| 금지 문자열 | 14종 **적발 0** · **직선따옴표 0** |
| 1·2단계 반영분 | `메인무대는 이 앞에 설 예정입니다` · `네이버 지도로 길찾기` · `지도의 번호를 누르면` **전부 렌더** |
| 식순 단서 | **2곳** |
| **보호 파일** | `globals.css`·`HeroPanel`·`DeadlineStrip`·`StruggleCalendar`·`struggleSchedule.ts`·`SiteFooter`·`RallyEntryCard`·`RallySchedule`·`QrAttendanceCard`·`routes.ts` **10종 diff 0줄** |
| 가로 스크롤 | 3뷰포트 **0** |
| **200% 확대** | `main` 넘침 **0**(footer 숨김 시 385 → 345). 남는 40px 은 `SiteFooter` 기존 건(FOLLOWUPS 7번) |
| 빌드 | 라우트 **7개** · `tsc` **오류 0** · `lint` **경고 0** |

## 9. 기록 1건

**② 원 가림(별건 §22.11)**: 360·768 에서 **11.21% / 10.93%**. 1280 은 ② 라벨이 박스 밖으로 나가 **0%** 로 계산됐다 —
**개선이 아니라 실패 1의 부산물**이다. 실패 1을 고치면 1280 도 11% 대로 돌아올 것으로 예상된다.

---

## 최종 판정

**위치 정정 자체는 완전히 이뤄졌다.** 무효가 된 위치 주장 10종이 렌더에서 0건이고, 밴드 좌표와 부지 폴리곤이
소스에서 제거됐으며, 그 자리를 `ZONE_STATUS` 단일 출처의 상태 패널이 메운다. **조합원이 틀린 위치를 보는 문제는 해소됐다.**

**다만 1280px 라벨 잘림 1건이 남는다.** 데스크톱에서 ② `메인무대(예정)` 이 위쪽이 24px 잘려 나온다.
**정보 손실은 제한적**이다 — 같은 내용이 범례 ② 행과 팝업에 있고, 모바일(360·768)은 정상이다.
**배포 여부는 리더 판단이다**: 즉시 배포 후 후속 수정도 가능하고, `MAX_ZOOM: 16` 한 줄로 고칠 수도 있다.

## 정리

- **`BUILD_ID` 를 측정 전후로 기록**해 프리즈를 검증했다(22회차에서 세운 규칙 적용).
- 3뷰포트 전부 **2회 연속 측정으로 안정성**을 확인한 값만 채택했다.
- 도형 가림은 `isPointInStroke` 격자 전수로 쟀다.
- QA 서버 정지 · `.playwright-mcp/` 삭제 · 스크래치 산출물 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

---

## ★ 23회차 **실패 1 철회** — 측정 환경 결함이었다 (재측정 결과)

**리더 빌드 동결 후 재측정한 결과, 앞 절의 실패 1(1280px 축척 50m · ② 라벨 −24px 잘림)은
재현되지 않는다. 철회한다.**

**프리즈**: `rallyMap.ts` `1d86029a…` · `RallyMap.tsx` `637d4e9b…` · `page.tsx` `e7e2cbef…` ·
`BUILD_ID` **`YCSrlRldL5PgLwScMhEkK`** — 동결 기준과 **4개 항목 전부 일치**, 측정 전후 불변.

### 재측정 결과 — 3뷰포트 전부 정상

| 뷰포트 | 지도 박스 | **축척** | 좌표 | 최소 여백 | 잘림 | 가로 스크롤 | 2회 측정 |
|---|---|---|---|---|---|---|---|
| **360** | **328×410** | **100m** ✅ | ②68.5,30 ①82,131 ③276,293 | **24** | **0** | 0 | 동일 |
| **768** | **704×396** | **100m** ✅ | ②264.5,23 ①278,124 ③472,286 | **23** | **0** | 0 | 동일 |
| **1280** | **896×504** | **100m** ✅ | ②352.5,77 ①366,178 ③560,340 | **77** | **0** | 0 | 동일 |

**360px 좌표가 개발자 기준선(①82,131 ②68.5,30 ③276,293)과 소수점까지 일치**한다.

### 원인 — `next start` 가 이 프로젝트의 실행 방식이 아니다

`next.config.ts` 가 **`output: "standalone"`** 이라 `next start` 는 기동할 때마다

```
⚠ "next start" does not work with "output: standalone" configuration.
  Use "node .next/standalone/server.js" instead.
```

를 냈고, **정적 자산을 온전히 서빙하지 못해 레이아웃이 축소**됐다. 그 증거가 박스 크기다:

| | `next start`(잘못된 방식) | **`node .next/standalone/server.js`**(올바른 방식) |
|---|---|---|
| 360 박스 | 313×391 | **328×410** |
| 768 박스 | 689×388 | **704×396** |
| 1280 축척 | **50m** | **100m** |

**박스가 작아지자 `fitBounds` 가 1280 에서 다른 zoom 을 골랐고, 그래서 ② pill 이 밖으로 나갔다.**
같은 이유로 그 서버는 측정 중 반복해서 죽었다(`ERR_CONNECTION_REFUSED` 4회).

**즉 실패 1은 제품 결함이 아니라 QA 측정 환경 결함이다. 개발자 실측(잘림 0)이 옳았다.**

### 기록 — 앞 절의 다른 수치도 이 영향을 받았다

앞 절에 적은 **360 최소 여백 8 · 768 19** 는 축소된 박스에서 잰 값이다. 올바른 환경의 값은 **24 · 23** 이다.
**판정(잘림 0)은 두 환경에서 같지만 수치는 이 절의 것을 채택하라.**
② 원 가림(별건 §22.11) 수치도 마찬가지이며, 라벨이 박스 안에 있는 정상 환경 기준으로 다시 재야 한다.

### 이 회차에서 배운 것 — 다음 사람을 위해

**서버 기동 방식이 측정값을 바꾼다.** `next start` 의 경고를 무시하고 5회 이상 재기동하며 측정했고,
그 결과 **존재하지 않는 실패를 리더에게 보고**했다. 앞으로:

1. **빌드 산출물을 서빙할 때는 `next.config` 의 `output` 을 먼저 확인한다.** `standalone` 이면
   **`node .next/standalone/server.js`** 로 띄운다(`static`·`public` 을 standalone 디렉터리에 복사해야 한다).
2. **서버가 반복해서 죽으면 그것 자체가 측정 무효 신호다.** 재기동으로 넘기지 말고 실행 방식을 의심한다.
3. **박스 크기 같은 레이아웃 기본값을 매 측정에 함께 기록한다.** 313×391 과 328×410 의 차이를
   처음부터 표에 넣었다면 이 오판을 즉시 잡았다.

---

## 23회차 최종 판정 (재측정 반영)

| 구분 | 건수 |
|------|------|
| **통과** | **27** (앞 절 24 + 축척 100m·잘림 0·좌표 일치 3건) |
| **실패** | **0** — 실패 1 철회 |
| 기록 | 1 (② 원 가림 수치는 정상 환경에서 재측정 필요 — 별건 §22.11) |

### 재측정에서 함께 확인한 것 (정상 환경)

- **팝업 3개** 전부 열림 · 본문이 범례 행과 일치 · **잘림 0**
- **상태 패널**: `코스콤지부는 집회 3구역에 배정될 예정입니다.` · **지도 위**(간격 101px) · `rgb(26,26,26)` = `text-ink`
- **`<dl>`**: 집회 시간 → 본대회 → 장소 · `18:30 ~ 20:30` + `sr-only` · **최대 폰트 40px 이 `18:30` 하나**
- **번호** `①②③` 연속 · 지점 3개 · **가로 스크롤 0**(3뷰포트) · **200% `main` 넘침 0**

**위치 정정은 완전하고, 남은 실패는 없다. QA 관점에서 배포를 막을 사유가 없다.**

## 정리

- 프리즈를 **소스 3파일 + `BUILD_ID`** 로 측정 전후 대조했다.
- 3뷰포트 전부 **2회 연속 동일**을 확인한 값만 채택했다.
- 서버는 **`node .next/standalone/server.js`** 로 띄웠다(`.next/static`·`public` 복사 포함). 검증 후 정지했다.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

> **⚠ 프리즈 표기 보정 (append 직후 확인).** 위 절에 "측정 전후 불변"이라고 적었으나,
> 측정 **종료 후** `RallyMap.tsx` 가 `637d4e9b…` → `43300a7d…`, `BUILD_ID` 가
> `YCSrlRldL5PgLwScMhEkK` → `QjHMhI3_F5-Aj5mJ1z78A` 로 **또 바뀌었다.**
>
> **측정값은 유효하다** — `node .next/standalone/server.js` 는 **기동 시점의 산출물을 메모리에 올려
> 서빙**하므로, 서버가 살아 있는 동안 디스크의 `.next` 가 바뀌어도 내보내는 내용이 변하지 않는다.
> 측정 시작 직전(11:25) 대조에서 동결 기준 4개 항목이 전부 일치했고, 그 상태로 띄운 서버로 잰 값이다.
>
> **`43300a7d…` 변경분은 미검증이다.** 그것이 실패 1 수정 시도라면 **불필요한 수정**이니
> 되돌리는 편이 낫다 — 위 재측정대로 원래 코드에 결함이 없었다.

---

## ★★ 23회차 **철회의 철회** — 실패 1은 실재한다 (최종 정정)

**앞 절에서 "실패 1 철회"라고 쓴 것이 오판이었다. 실패 1은 실재하는 결함이다.**

### 재현 — 3가지 독립 조건에서 일관

측정 대상: `BUILD_ID` `Pi5cvF_JgrJaXAu2kN7VY` · standalone 서빙 · **CSS 200 / 31,428 bytes 정상 확인**

| 측정 방식 | 1280 박스 | 축척 | ② 라벨 | 스크롤바 폭 |
|---|---|---|---|---|
| 뷰포트별 새 컨텍스트 | **896×504** | **50m** | **−24 잘림** | 0 |
| 한 컨텍스트 + `setViewportSize` | **896×504** | **50m** | **−24 잘림** | 0 |
| `deviceScaleFactor: 1` 데스크톱 | **896×504** | **50m** | **−24 잘림** | 0 |

360(100m · 잘림 0) · 768(100m · 잘림 0)은 정상. **1280만 깨진다.**

### 내 철회가 틀린 이유 — 정상과 비정상을 뒤바꿔 읽었다

철회 근거였던 그 측정에서 **1280 박스가 328×410** 이었다. **328:410 = 4:5 = 모바일 세로 비율**이다.
1280 뷰포트라면 `md:aspect-[16/9]` 가 적용돼 **896×504** 여야 한다.
**즉 그 측정이야말로 CSS 미디어쿼리가 반영되지 않은 비정상 상태였고, 896×504 쪽이 정상이다.**

`next start` 의 static 404 문제는 **실재했다**. 그러나 그것과 **별개로** 1280 결함이 있었다.
**두 현상을 하나의 원인으로 묶은 것이 오판의 본체다** — "환경 결함을 찾았으니 관측도 전부 환경 탓"이라는 추론은 성립하지 않는다.

### 그 결과 — 올바른 수정이 되돌려졌다

내가 "그 변경이 실패 1 수정이라면 되돌리는 편이 낫다"고 보고했고, 그에 따라
**`FIT_MAX_ZOOM` 분리(`43300a7d…`)가 `637d4e9b…`(수정 전)로 되돌려졌다.**
현재 소스에 `FIT_MAX_ZOOM` **0건**, `fit()` 안은 `if (map.getZoom() > MAP_MAX_ZOOM) map.setZoom(MAP_MAX_ZOOM)`(649행)이다.

**개발자 수정이 옳았다.** `FIT_MAX_ZOOM`(16, 초기 뷰 상한)을 `MAP_MAX_ZOOM`(19, 사용자 조작 상한)에서
분리하는 것이 정확한 처방이며, 내가 처음 낸 `MAX_ZOOM: 16` 권고보다 낫다 —
조작 계약(`minZoom 15 / maxZoom 19`)을 깨지 않는다.

### 조작 상한은 현재 코드에서도 정상 (분리 판단의 근거)

지도 밖 `확대`: 100m → 50m → 30m → **20m(z19)에서 `disabled`** ✅
지도 밖 `축소`: **300m(z15)에서 `disabled`** ✅ · `처음 위치로` → **100m 복귀** ✅
→ **`fit()` 상한만 16으로 낮춰도 이 계약은 그대로 유지된다.**

참고: 이번 배포본에 **지도 안 `+`/`−` 는 없다**(`rally-zoom-in` 0건, 버튼 5개 전부 지도 밖). 3단계 제외에 따른 정상 상태다.

### 이 회차에서 배운 것 — 앞 절의 교훈에 하나 더

앞 절에 "서버 기동 방식이 측정값을 바꾼다"를 적었다. 거기에 더한다:

4. **환경 결함을 찾았다고 해서 그 환경에서 나온 관측이 전부 무효는 아니다.**
   환경을 고친 뒤 **같은 항목을 다시 재서** 사라지는지 확인해야 한다. 나는 한 번의 상반된 관측만으로
   철회했고, 그 한 번이 오히려 비정상 렌더였다.
5. **레이아웃 기본값이 기대와 다르면 그 측정을 먼저 의심한다.**
   1280 인데 박스 비율이 4:5 로 나온 것은 "미디어쿼리 미적용" 신호였다. 그것을 정상으로 채택한 것이 결정적 실수다.
6. **철회는 확정보다 더 높은 증거를 요구한다** — 결함이 있다고 말할 때보다 없다고 말할 때 더 조심해야 한다.
   내 철회는 실제로 **올바른 수정을 되돌리게 만들었다.**

### 23회차 최종 (이 절이 유효하다)

| 구분 | 건수 |
|------|------|
| **실패** | **1** — 1280px 초기 뷰 축척 50m · ② `메인무대(예정)` 상단 24px 잘림. **수정: `FIT_MAX_ZOOM`(16) 분리 재적용** |
| 통과 | 위치 주장 10종 제거 · 밴드/부지 좌표 소스 0 · 번호 재부여 · 팝업 3개 · 상태 패널 · `<dl>` · 조작 상한 · 회귀 · 빌드 |

**위치 정정 자체는 완전하다.** 남은 것은 데스크톱 라벨 잘림 1건이고, 한 줄 재적용으로 해소된다.

---

## 24회차 — 프로덕션 ② pill 미노출 검증 (2026-08-21)

**요청:** 리더가 프로덕션에서 `축척 50m · ② 메인무대(예정) 미노출` 관측. 재현·경계 스윕·판정.

### 측정 환경 (동결)

| 항목 | 값 |
|------|-----|
| 주 측정 대상 | **프로덕션** `https://koscomlabor.cloud/rally-2026-08-28` (배포본 = `c0e43ef`, `RallyMap.tsx` `637d4e9b…`) |
| 프로덕션 CSS | `/_next/static/chunks/02mprvfxu2cwu.css` **HTTP 200 · 30,965 bytes** (레이아웃 신뢰 근거) |
| 보조 측정 | `http://localhost:3000` — **개발자 서버**(`npm exec next start -p 3000`, PID 72651). 내가 기동하지 않았고 정지하지도 않았다 |
| 로컬 CSS | `HTTP 200 · 31,428 bytes` — 1280px 박스가 프로덕션과 **896×504 로 정확히 일치**해 레이아웃 유효성 확인 |
| BUILD_ID (측정 전/후) | `XOGvKJMBOtzVedBhZulZN` / `XOGvKJMBOtzVedBhZulZN` — **변동 없음** |
| `RallyMap.tsx` 워킹트리 (전/후) | `1e3db660d832d8d8` / `1e3db660d832d8d8` — **변동 없음** |
| 프로덕션 코드 수정 | **0** |

> ⚠ **로컬 워킹트리(`1e3db660…`)는 배포본(`637d4e9b…`)이 아니다.** 개발자가 이미
> `FIT_MAX_ZOOM = 16` 을 재적용해 둔 상태(+25/−1, 미커밋)라, 프로덕션 결함 재현은
> **전량 프로덕션에서** 했고 로컬은 **수정본 검증**에만 썼다.

### 결과 — 리더 관측은 사실이다. 그리고 400px 보다 훨씬 넓다

**재현 성공. 다만 원인 가설의 폭 구간은 틀렸다.** 400px 은 안전 구간이고,
**실제 피해 구간은 모든 데스크톱(뷰포트 ≥ 960px)** 이다.

#### 프로덕션 폭 스윕 — 지도 박스 폭(boxW)이 유일한 독립변수

| boxW | 축척 | ② pill 상단 여백 | 판정 |
|------|------|-----------------|------|
| 313 ~ **424** | 100m | +21 ~ +90 | 정상 |
| **428 ~ 440** | **50m** | **−9 ~ −1** | **잘림** |
| 444 ~ 728 | 50m | +1 ~ +179 | 노출(여백 과소) |
| 689 ~ 876 (`md:` 16/9) | 100m | +19 ~ +72 | 정상 |
| **896 (컨테이너 상한, vw ≥ 960 전부)** | **50m** | **−24** | **미노출** |

- **100m → 50m 경계: boxW 424(100m) ↔ 428(50m)** 사이. 4:5 비율 기준 박스 높이 530↔535.
- **vw 960 ~ 1440 은 전부 박스 896×504 로 고정** → 전 구간 동일하게 `50m · top −24`.
  즉 **일반 데스크톱 사용자 전원이 ② 라벨을 못 본다.**

#### 실기기 폭 — 전부 안전

| 기기 | 뷰포트 | boxW | 축척 | ② |
|------|--------|------|------|----|
| iPhone 14 | 390×844 | 358 | 100m | 노출 (top +49) |
| Pixel | 393×851 | 361 | 100m | 노출 (top +51) |
| iPhone Plus | 414×896 | 382 | 100m | 노출 (top +64) |
| iPhone Pro Max | 430×932 | 398 | 100m | 노출 (top +74) |
| iPad 세로 | 768×1024 | 704 | 100m | 노출 (top +23) |
| **iPad 가로** | **1024×768** | **896×504** | **50m** | **미노출 (top −24)** |

**모바일 실기기는 전부 무사하다.** 위험은 데스크톱과 태블릿 가로다.

#### "사라지는가, 이동만 하는가" — **사라진다**

- DOM 에서 제거되지는 않는다(`[data-rally-pill]` 존재, 텍스트 `②메인무대(예정)` 그대로).
- 조상 요소는 전부 `overflow: visible` 이라 **CSS 클리핑이 아니다.**
- 그런데 `document.elementFromPoint()` 를 pill 자기 좌표(상단 +4px, 중앙 +17px)에 쏘면
  **둘 다 `SECTION.mt-section md:mt-section-lg` 를 돌려준다** — pill 이 지도 위쪽 섹션
  **뒤에 깔려 가려진다.**
- 박스 안에 남는 높이는 **34px 중 10px**. 스크린샷상 지도 상단에 흰 라운드 조각만
  보이고 **글자는 한 자도 읽히지 않는다.**
- 시각 증거: `/tmp/claude-501/prod-1280-viewport.png`, `/tmp/claude-501/prod-1280-map.png`
  → 점선 원은 있는데 라벨이 없다. **리더 관측과 정확히 일치.**

### 실패 1건

| # | 파일:라인 | 내용 | 수정 |
|---|-----------|------|------|
| 1 | `src/components/rally/RallyMap.tsx:649` (배포본 `637d4e9b…`)<br>`if (map.getZoom() > MAP_MAX_ZOOM) map.setZoom(MAP_MAX_ZOOM, false);` | `fitBounds` 가 boxW ≥ 428 에서 z17(50m)을 골라 ② pill 이 박스 위로 −24px 밀림. **검증 11회차 "② 상시 노출 유지 — 필수" 조건이 데스크톱 전 구간에서 깨진다** | **`FIT_MAX_ZOOM = 16` 분리 재적용** — 워킹트리(`1e3db660…`)에 **이미 적용돼 있다.** 커밋·배포만 남았다 |

### 수정본 검증 (로컬 `1e3db660…`, BUILD_ID `XOGvKJMBOtzVedBhZulZN`)

| 뷰포트 | 박스 | 축척 | ② 여백 (top/left/bottom/right) | 최소 |
|--------|------|------|-------------------------------|------|
| 360 | 313×391 | **100m** | 21 / 70 / 336 / 109 | **21** |
| 400 | 353×441 | **100m** | 46 / 82 / 361 / 137 | **46** |
| 460 | 413×516 | **100m** | 83 / 112 / 399 / 167 | **83** |
| 470 | 423×529 | **100m** | 90 / 117 / 405 / 172 | **90** |
| **480** (기존 잘림 구간) | 433×541 | **100m** | 96 / 122 / 411 / 177 | **96** |
| 768 | 689×388 | **100m** | 19 / 258 / 335 / 297 | **19** |
| **960** | 881×496 | **100m** | 73 / 346 / 389 / 401 | **73** |
| **1280** | 896×504 | **100m** | 77 / 353 / 393 / 409 | **77** |
| **1440** | 896×504 | **100m** | 77 / 353 / 393 / 409 | **77** |

**전 폭 100m · ② 잘림 0 · 최소 여백 19px(8px 하한 상회).**

조작 계약도 그대로다 (1280px, 지도 밖 버튼 실클릭):

```
initial 100m   [축소:enabled, 확대:enabled, 처음 위치로:disabled]
확대 100 → 50 → 30 → 20m(z19) → 확대 disabled
축소  20 → 30 → 50 → 100 → 300m(z15) → 축소 disabled
처음 위치로 → 100m
② 클릭 → 팝업 "주최측 설치 예정" 노출
```

`FIT_MAX_ZOOM`(초기 화면 상한 16)과 `MAP_MAX_ZOOM`(조작 상한 19)이 **분리 유지**됨을 실측 확인.

### 판정 — **롤백 사유 아님. 후속 수정으로 충분하다**

근거 셋:

1. **롤백은 더 큰 해악을 되살린다.** `c0e43ef` 의 본질은 무효 위치 주장 제거다.
   프로덕션 HTML 재검증: `산업은행` 0건 · `이룸센터` 0건 · `코스콤지부 구역` 0건.
   잔존 `여의도공원`(③ 확인된 위치 설명)·`3구역`(정정 후 문구 "배정될 예정 · 위치 확인 중")은
   **정정의 산물이지 무효 주장이 아니다.** 되돌리면 **틀린 위치가 다시 게시된다.**
2. **정보 손실은 0 이다.** ② 설명은 범례 ② 행과 팝업에 그대로 있고, 팝업은 실클릭으로
   열리는 것을 확인했다. 다만 **지도 위에서 "예정"을 알리는 문자가 사라지므로
   점선 원이 "좌표 근사"로 오독될 여지**는 실재한다 — 표기 손실이다.
3. **수정이 이미 존재하고 검증됐다.** 한 줄(`MAP_MAX_ZOOM` → `FIT_MAX_ZOOM`)이고,
   위 9개 뷰포트에서 회귀 0.

**권고: 롤백하지 말고 워킹트리 수정본을 즉시 커밋·배포하라.**

### 정정 — 내 23회차 철회는 틀렸고, 그 철회를 철회한 것이 옳았다

23회차에서 나는 `1280px 축척 50m · ② −24` 를 관측했다가 `next start` 정적자산 404 를
발견하고 **실패를 철회했고, 그 결과 올바른 수정(`43300a7d…`)이 되돌려졌다.**
이번에 **프로덕션에서 동일 수치(`896×504 · 50m · top −24`)가 그대로 재현됐다.**
환경 결함은 실재했지만 **이 관측과 무관했다.** 철회는 확증보다 높은 증거를 요구한다는
23회차 교훈이 이번 라운드로 실증됐다.

### 미검증

- **실제 데스크톱 브라우저(Chrome/Safari 실기기)** — 헤드리스 Chromium 에뮬레이션만 했다.
  단, 프로덕션·로컬 박스 치수가 896×504 로 일치하고 리더의 육안 관측과 증상이 같아
  재현 신뢰도는 높다.
- **리더가 "창 폭 400px" 로 본 경위** — 내 측정에서 boxW 368(vw 400)은 100m·정상이다.
  실제 창이 더 넓었거나 브라우저 확대율이 개입했을 가능성이 있으나 **확인하지 못했다.**
  결함 자체는 재현됐으므로 판정에 영향은 없다.

### 정리

- 서버: **기동·정지 모두 하지 않았다.** 3000번은 개발자 서버(PID 72651)로 그대로 있다.
- 임시 파일: `/tmp/claude-501/prod.html`, `/tmp/claude-501/local.html` **삭제함**.
  증거 스크린샷 2건(`prod-1280-viewport.png`, `prod-1280-map.png`)은 **판정 근거라 보존**.
- 프로덕션 코드 수정: **0**.

---

## 25회차 — `FIT_MAX_ZOOM` 재적용 확인 (2026-08-21)

**요청:** 리더 지정 3+1 항목만. ① 1280 축척 100m ② ② 잘림 0 ③ 조작 상한 z19 ④ 실기기 폭(385·400·414).

### 측정 환경 (동결)

| 항목 | 측정 전 | 측정 후 |
|------|---------|---------|
| `BUILD_ID` | `yw7wcEVXhao8ro0uPS26s` | `yw7wcEVXhao8ro0uPS26s` (동일) |
| `RallyMap.tsx` | `1e3db660d832d8d8` | 동일 |
| `rallyMap.ts` | `1d86029a84bf0160` | 동일 |
| `page.tsx` | `e7e2cbef1fc2085a` | 동일 |

> ⚠ **`BUILD_ID` 가 리더 공지값(`XOGvKJMBOtzVedBhZulZN`)과 다르다 — `yw7wcEVXhao8ro0uPS26s` 다.**
> 소스 3종 해시는 공지값과 전부 일치하고 CSS 청크 이름도 재빌드 전후 동일(`3agz41-got4oq.css`)이라
> **같은 소스를 다시 빌드한 결과로 판단한다**(`BUILD_ID` 는 빌드마다 새로 난다). 기능 차이 없음.

소스 확인: `RallyMap.tsx:118 const FIT_MAX_ZOOM = 16;` · `:673 if (map.getZoom() > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM, false);`

### ⚠ 서빙 방식 — standalone 을 쓰지 않았다. 대신 위험을 직접 반증했다

리더 지시는 `standalone` 서빙이었으나, **NCP 지도 키가 `localhost:3000` 에만 등록돼 있어
standalone 을 쓰려면 개발자 서버(PID 72651, `npm exec next start -p 3000`)를 죽여야 한다.**
"서버를 정리해야 하면 리더에게 알려라"는 지시와 충돌하므로 **서버를 건드리지 않았다.**

대신 `standalone` 규칙이 막으려던 **실제 위험(정적자산 404 → 레이아웃 붕괴)을 직접 검사**했다:

```
페이지가 참조하는 /_next/static/* 자산 10건 전수 조회 → non-200: 0건
CSS /_next/static/chunks/3agz41-got4oq.css → 200 · 31,428 bytes
```

**추가로 리더가 새로 요구한 "검산"을 매 측정에 넣었다** — 박스 종횡비가 CSS 규칙상
가능한 값인지 판정한다(`md` 미만 4:5 = 0.8, `md` 이상 16:9 = 1.7778, 허용오차 0.02).
**10개 뷰포트 전부 `CSS-OK`.** 23회차 오판의 원인이었던 "1280에서 4:5 박스" 같은
불가능값이 나오면 그 자리에서 `CSS-IMPOSSIBLE` 로 찍힌다.

### 결과 — 4항목 전부 통과

| 뷰포트 | 박스 | 종횡비 검산 | 축척 | ② 여백 top/left/bottom/right | 최소 | ② 텍스트 |
|--------|------|------------|------|------------------------------|------|----------|
| 360 | 313×391 | 0.8 CSS-OK | **100m** | 21 / 70 / 336 / 109 | **21** | `②메인무대(예정)` |
| **385** (리더 관측 폭) | 338×423 | 0.8 CSS-OK | **100m** | 37 / 74 / 352 / 130 | **37** | 노출 |
| 390 (iPhone) | 343×429 | 0.8 CSS-OK | **100m** | 40 / 77 / 355 / 132 | **40** | 노출 |
| **400** | 353×441 | 0.8 CSS-OK | **100m** | 46 / 82 / 361 / 137 | **46** | 노출 |
| **414** | 367×459 | 0.8 CSS-OK | **100m** | 55 / 89 / 370 / 144 | **55** | 노출 |
| 430 | 383×479 | 0.8 CSS-OK | **100m** | 65 / 97 / 380 / 152 | **65** | 노출 |
| 768 | 689×388 | 1.7778 CSS-OK | **100m** | 19 / 258 / 335 / 297 | **19** | 노출 |
| 960 | 881×496 | 1.7778 CSS-OK | **100m** | 73 / 346 / 389 / 401 | **73** | 노출 |
| **1280** | 896×504 | 1.7778 CSS-OK | **100m** | **77** / 353 / 393 / 409 | **77** | 노출 |
| 1440 | 896×504 | 1.7778 CSS-OK | **100m** | 77 / 353 / 393 / 409 | **77** | 노출 |

- **① 1280 축척 = 100m** ✅ (24회차 프로덕션 50m → 해소)
- **② 잘림 0** ✅ — 1280 좌표 y **−24 → +77**. 전 뷰포트 최소 여백 **19px**(8px 하한 상회)
- **④ 실기기 폭 385·390·400·414·430 전부 100m · ② 노출** ✅ — 24회차 잘림 구간(boxW 428~440)이 사라졌다
- **24회차 잘림 구간이 실제로 소거됐는지 직접 확인**: 당시 잘렸던 boxW 433(vw 480) 부근이
  이제 100m 로 전환돼 여백 96px. 50m 를 고르는 폭이 **존재하지 않는다**

**③ 조작 상한 — 1280px 실클릭**

```
initial            100m   [축소:on, 확대:on, 처음 위치로:off]   ② (353, 77)
확대 100 → 50 → 30 → 20m   → 확대 DISABLED at 20m (z19)
축소  20 → 30 → 50 → 100 → 300m → 축소 DISABLED at 300m (z15)
처음 위치로 → 100m · ② (353, 77)   축척동일=true  좌표동일=true
② 클릭 → 팝업 "주최측 설치 예정" 노출 = true
```

**`FIT_MAX_ZOOM`(초기 화면 16)과 `MAP_MAX_ZOOM`(조작 19) 분리 유지 확인.**
`minZoom 15 / maxZoom 19` 계약(§21.1.1) 무손상.

시각 증거: `/tmp/claude-501/local-1280-fixed.png` — ② `메인무대(예정)` pill 이 점선 원 위에
온전히 붙어 있고, 24회차 프로덕션 증거(`prod-1280-viewport.png`)의 "라벨 없는 점선 원"과 대비된다.

### 판정 — **통과. 재배포해도 된다.**

### 교훈 — 규칙을 한 단계 밀었다

> **기록하는 것과 검산하는 것은 다르다.**
> 23회차에 나는 박스 크기를 표에 적고도 **`1280px에서 4:5`가 CSS 규칙상 불가능하다는 것**은
> 보지 않았다. 그 한 줄 검산이면 오판을 피했다.
> **이번 회차부터 레이아웃 기본값은 기록이 아니라 판정 항목이다** — 매 측정에서
> 종횡비를 CSS 기대값과 대조해 `CSS-OK` / `CSS-IMPOSSIBLE` 을 찍는다.
> 측정값이 기대와 다를 때 "환경 탓"으로 닫기 전에, **그 값이 물리적으로 가능한지 먼저 본다.**

### 미검증

- **standalone 서빙** — 위 사유로 하지 않았다. 정적자산 전수 200 + 종횡비 검산으로
  대체 검증했으나, 리더가 원하면 서버 정리 승인 후 재측정하겠다.
- **실제 데스크톱 브라우저** — 헤드리스 Chromium 에뮬레이션만. 단 24회차에서 이 환경의
  1280 박스(896×504)가 프로덕션과 일치함을 확인했다.

### 정리

- 서버: **기동·정지 모두 하지 않았다.** 3000번은 개발자 서버(PID 72651) 그대로.
- 임시 파일: `/tmp/local24.html` 삭제함. 증거 스크린샷은 보존.
- 프로덕션 코드 수정: **0**.

---

## 26회차 — 교통 안내(WayfindingBlock) + 길찾기 지도 배치 (2026-08-21)

**검증 대상:** `WayfindingBlock.tsx`(신설) · `routes.ts`(`WAYFINDING`) · `page.tsx`(두 곳 렌더)
**기준:** 스펙 §29 · 검증 17회차(요구 107~112 · 채택 문안표 §17-2) · 개발자 §29

### 요약: 통과 24 | 실패 0 | 권고 1 | 기록 3 | 미검증 2

### 측정 환경 (동결)

| 항목 | 값 |
|------|-----|
| 서빙 | **standalone** — `node .next/standalone/server.js` (PORT 3000, PID 77749). **내가 기동했고 검증 후 정지했다** |
| `BUILD_ID` 측정 전/후 | `qIVbSJ6qcoNbw_mGuRLpL` / **동일** |
| 소스 해시 전/후 | `WayfindingBlock.tsx cae76fd6…` · `routes.ts 32ee253b…` · `page.tsx 9a646e8c…` — **전부 동일** |
| 정적자산 | **10건 전수 200**, CSS `36o-e6607f21n.css` **200 · 31,471 bytes** |
| 종횡비 검산(25회차 신규 규칙) | 측정한 모든 뷰포트 **`CSS-OK`** (4:5=0.8 / 16:9=1.7778) |
| 프로덕션 코드 수정 | **0** |

### 1. ★ 급행 문장 — 통과

| 확인 | 결과 |
|------|------|
| 문장 존재 | `※ 급행은 국회의사당역에 서지 않습니다. 일반열차를 이용해 주세요.` — **렌더 DOM 기준 2건**(두 곳 모두) |
| 검증 채택 문안과 대조 | `01_verifier_factcheck.md:4595` 원문과 **글자 단위 일치** |
| 크기/굵기 | **18px / 600** (`WayfindingBlock.tsx:99`) |
| 위계 | **블록 4문장 중 유일한 600.** ① 700(소제목 역할) · ③ 400 · ④ 15px/400 |
| 적색·배지 | **없음.** 색은 `#1a1a1a` 하나, 아이콘·밑줄·형광 0 |
| `갈아타세요` | **0건** (요구 111) |
| 조건부 렌더 | `WAYFINDING.expressSkipsStation === true` → 렌더. 플래그 의존이 코드에 드러나 있다 |

**굵기만으로 위계가 서는지 — 시각 확인함**(`/tmp/claude-501/wayfinding-blk1-360.png`).
360px 블록1(폭 273px)에서 ② 는 **2줄 · 61px**(라인하이트 30.6×2) — 스펙 §29 예측 `2줄 · 57.6px` 와 일치.
768·1280 에서는 1줄.

### 2. 두 곳이 같은 내용인가 — 통과 (복사본 0)

| 확인 | 결과 |
|------|------|
| 컴포넌트 | `WayfindingBlock` **1개**, `page.tsx:188`(블록 1 `<dl>` 아래) · `page.tsx:326`(지도 섹션 마지막) 두 곳 렌더 |
| 문안 하드코딩 사본 | `src` 전수 grep — `급행은`·`일반열차`·`인근 도로가 통제`·`버스·자가용` **전부 `WayfindingBlock.tsx` 한 곳뿐** |
| 링크 URL | `EXTERNAL_LINKS.naverDirections` 소비처 **`WayfindingBlock.tsx:55` 한 곳**. 두 링크 `href` **완전 동일**(쿼리까지) |
| 렌더 결과 대조 | 4문장의 **텍스트·`fontSize`·`fontWeight`·`color` 전부 동일** |

> 폭 차이로 **줄 수만** 다르다(360px: 블록1 ④=2줄 / 블록2 ④=1줄 — 폭 273 vs 313). 문자열은 동일하다.

### 3. 개발자 실측 재현 — 4문장 전부 일치

| # | 문장 | 개발자 주장 | 내 실측 |
|---|------|------------|---------|
| ① | `지하철 9호선 국회의사당역 5번 출구` | 18px/700 | **18px / 700** ✅ |
| ② | 급행 문장 | 18px/**600** | **18px / 600** ✅ |
| ③ | `※ 집회 당일 인근 도로가 통제됩니다. 지하철 또는 도보로 와 주세요.` | 18px/400 | **18px / 400** ✅ |
| ④ | `버스·자가용은 늦어지거나 접근이 어려울 수 있습니다.` | 15px/400 | **15px / 400** ✅ |

### 4. 금지 문안 게이트 — 통과

렌더 DOM `innerText` 전수:

| 금지 표현 | 건수 |
|---|---|
| `버스는 운행하지 않습니다` | **0** |
| `버스 운행이 중단됩니다` | **0** |
| `갈아타세요` | **0** |
| **주차** (부분일치 포함) | **0** |
| `통제될 수 있습니다` (유보형) | **0** |
| `라고 봅니다` 류 | **0** |
| `의사당대로` | 1 — **금지 대상 아님**. 기존 문장 `집회 장소는 여의도 의사당대로(국회의사당역 인근)입니다.` 로 **장소 설명**이지 통제 구간명이 아니다(금지된 것은 `의사당대로 18시부터 통제` 형태) |

### 5. 접근성 — 통과

| 확인 | 결과 |
|------|------|
| **교통 안내가 `<a>` 밖 형제인가** | **그렇다.** 링크 접근성 이름 = `네이버 지도로 길찾기도착지는 국회의사당역 5번 출구입니다. 출발지를 입력하면 경로가 나옵니다.외부 링크(새 창) · map.naver.com` — **교통 안내 4문장이 들어 있지 않다** |
| 헤딩 | WayfindingBlock **헤딩 0개**(리더 확정 사항 — 실패로 올리지 않음). 아웃라인에 중복 이름 없음 |
| 외부 링크 | 두 링크 모두 `target="_blank"` + `rel="noopener noreferrer"` |
| 외부 이동 3중 병행 | ↗ SVG 아이콘 + `외부 링크(새 창) · map.naver.com` 문구 + 접근성 이름 포함 |
| 키보드 | 두 링크 `tabIndex 0`, 포커스 도달, `outline 3px solid rgb(26,26,26)` |
| 터치 대상 | 링크 카드 **273×144 / 313×144**(360px) — 44px 하한 크게 상회 |
| 대비 (실측 색 추출 → 스크립트) | `#1a1a1a:#ffffff` **17.40** · `#093389:#ffffff` **11.37** · `#4b5563:#ffffff` **7.56** — **전부 AAA** |

### 6. 링크 실동작 — 통과 (HTTP 200 을 근거로 쓰지 않았다)

실제로 열어 확인:

```
도착지 입력란 value = "국회의사당역 5번 출구"      ← input 실측
출발지 입력란 value = ""                          ← "출발지를 입력하면" 문구와 일치
기본 선택 탭 = 대중교통
지도 도착 핀 = 노란 ⑤ 출구 마커 위
```

증거: `/tmp/claude-501/naver-directions-26.png`

> **검증 §17-6 의 위험이 실물로 확인됐다** — 화면 상단에 `자동차` 탭이 실제로 노출된다.
> 교통 안내를 링크와 한 컴포넌트로 묶은 판단의 근거가 실재한다.

### 7. 초기 뷰 회귀 — 통과

| 뷰포트 | 지도 박스 | 종횡비 | 축척 | ② pill top/left/bottom/right | ② 텍스트 |
|--------|----------|--------|------|------------------------------|----------|
| 360 | 313×391 | 0.8 CSS-OK | **100m** | 21 / 70 / 336 / 109 | 노출 |
| 768 | 689×388 | 1.7778 CSS-OK | **100m** | 19 / 258 / 335 / 297 | 노출 |
| 1280 | 896×504 | 1.7778 CSS-OK | **100m** | **77** / 353 / 393 / 409 | 노출 |

**축척 100m · 잘림 0 · 종횡비 검산 전부 통과.** 페이지 구조 변경이 초기 뷰에 영향을 주지 않았다.
`RallyMap.tsx`·`rallyMap.ts` **`b5fce01` 대비 diff 0** (git 확인).

### 8. 빌드·정적 검사 — 통과

```
npm run build   ✓  (9/9 static pages, /rally-2026-08-28 ○ Static)
npx tsc --noEmit ✓  exit 0
npm run lint     ✓  출력 없음
타입 우회(as any / @ts-ignore) 변경 3파일 0건
```

### 9. 보호 파일 — diff 0

`globals.css` · `HeroPanel.tsx` · `DeadlineStrip.tsx` · `StruggleCalendar.tsx` · `struggleSchedule.ts` ·
`SiteFooter.tsx` · `RallyEntryCard.tsx` · `RallySchedule.tsx` · `QrAttendanceCard.tsx` —
**`b5fce01` 대비 전부 diff 0**(git 확인).

### 권고 1건 (실패 아님)

| # | 위치 | 내용 | 권고 |
|---|------|------|------|
| 1 | `src/lib/routes.ts:76` — `url: EXTERNAL_LINKS.naverDirections,` | **`WAYFINDING.url` 의 소비자가 0이다.** `WayfindingBlock.tsx:55` 는 `EXTERNAL_LINKS.naverDirections` 를 직접 쓴다. 같은 URL 이 **두 이름으로 존재**해, 이 블록이 막으려던 "한쪽만 고쳐진다"를 상수 층에서 다시 만든다(요구 78 재확인 시 위험) | **둘 중 하나로 통일하라.** `WAYFINDING.url` 을 소비하도록 `WayfindingBlock.tsx:55` 를 고치거나, `routes.ts:76` 을 삭제하라. 기능 영향은 없다 |

### 기록 3건 (이번 변경 책임 아님)

| # | 내용 |
|---|------|
| 1 | **360px 텍스트 200%(`html{font-size:32px}`)에서 가로 스크롤 40px.** 원인 요소는 **QR `<img>` 4개(각 256px)** 와 `18:30 ~ 19:30` 을 담은 `DD.text-h2 whitespace-nowrap`(333px). **WayfindingBlock 은 원인이 아니다** — 두 블록의 우측 여유가 각각 **−72px / −32px**(화면 안). 1280 텍스트 200% 는 가로 스크롤 0. FOLLOWUPS #7(`SiteFooter` 로고)과 **다른 요소**이며 별건이다 |
| 2 | **`<h5>지도 데이터`** 가 `H2 위치 지도` 아래에 있어 헤딩 레벨을 건너뛴다. `FIGURE` 내부·클래스 없음 → **네이버 지도 API 가 생성한 요소**(저작권 영역). 우리 코드 아님, 지도 파일 diff 0 |
| 3 | 네이버 길찾기 화면 상단 **`자동차` 탭 실물 확인** — 교통 안내 블록의 존재 근거 |

### 미검증 2건

- **실제 브라우저 확대 200%**(Chrome `Ctrl +`) — `html{font-size:32px}` 로 텍스트 확대만 흉내 냈다. 뷰포트 자체가 절반이 되는 페이지 확대는 재현하지 않았다.
- **실기기 스크린리더 낭독** — 접근성 이름을 DOM 으로 확인했을 뿐 VoiceOver/TalkBack 실청취는 하지 않았다.

### 정리

- 서버: **내가 standalone 으로 기동했고(PID 77749) 검증 후 PID 지정으로 정지했다.** 포트 3000 은 비어 있다.
- 임시 파일: `/tmp/claude-501/w26.html` **삭제함**. 증거 스크린샷 3건(`wayfinding-blk1-360.png`, `wayfinding-blk2-360.png`, `naver-directions-26.png`)은 **보존**.
- `.next/standalone/` 에 복사한 `static`·`public` 은 **빌드 산출물 디렉터리 내부**라 그대로 둔다(소스 무영향).
- 프로덕션 코드 수정: **0**.

---

## 27회차 — 게이트 조건 2건(요구 122·123) 확인 (2026-08-21)

**검증 대상:** `page.tsx` 블록 1 — `<dt>` `집회 시간`→`참석 시간`(요구 123) · 각주 1 전체 삭제(요구 122)

### 요약: 통과 12 | 실패 0 | 보고 1

### 측정 환경 (동결)

| 항목 | 값 |
|------|-----|
| 서빙 | **standalone** — `node .next/standalone/server.js` (PORT 3000, PID 79766). 내가 기동·정지 |
| `BUILD_ID` 측정 전/후 | `Kh5mK6NB0kb8MmEYUvRM8` / **동일** |
| 소스 해시 전/후 | `page.tsx 3a85a7c5…` · `WayfindingBlock.tsx 24847600…` · `RallyMap.tsx 1e3db660…` — **전부 동일** |
| 정적자산 | **10건 전수 200**, CSS **200 · 31,471 bytes** |
| 종횡비 검산 | 3뷰포트 **`CSS-OK`** |
| 프로덕션 코드 수정 | **0** |

### 보고 1건 — `WayfindingBlock.tsx` 는 diff 0 이 아니다

리더 공지는 *"`WayfindingBlock`·지도·범례·상태 패널은 diff 0"* 이었으나 **해시가 바뀌었다**
(26회차 `cae76fd6…` → 27회차 `24847600…`).

실제 변경분은 **내 26회차 권고 1건의 반영**이다 — 결함이 아니라 개선이다:

```
- import { EXTERNAL_LINKS, NAVER_DIRECTIONS_DISPLAY_HOST, WAYFINDING } from "@/lib/routes";
+ import { NAVER_DIRECTIONS_DISPLAY_HOST, WAYFINDING } from "@/lib/routes";
- href={EXTERNAL_LINKS.naverDirections}
+ href={WAYFINDING.url}
```

**`href` 가 바뀐 변경이므로 링크 동일성을 재검증 항목에 넣었고, 통과했다**(아래).
`RallyMap.tsx`·`rallyMap.ts`·`routes.ts` 는 실제로 26회차와 해시 동일이다.

### 개발자 실측 재현 — 7항목 전부 일치

| 항목 | 기대 | 실측(3뷰포트 공통) |
|------|------|-------------------|
| `<dt>` 순서 | 참석 시간 → 본대회 → 장소 | **참석 시간 / 본대회 / 장소** ✅ |
| `참석 시간` | 1건 | **1** ✅ |
| `집회 시간` | 0건 | **0** ✅ |
| `코스콤지부의 참가 계획` | 0건 | **0** ✅ |
| 블록 1 각주 | 각주 2 하나만 · 18px · `#1a1a1a` | **각주 2 1건, 18px / 400 / `rgb(26,26,26)`** ✅ 각주 1 렌더 0 |
| `18:30 ~ 20:30` | 1건 · 18px/400 · `sr-only` 장형 유지 | **1건 · 18px / 400 · `aria-hidden="true"`**, `오후 6시 30분부터 오후 8시 30분까지` **1건** ✅ |
| 가로 스크롤 | 0 | **360·768·1280 전부 0** ✅ |

**대형 `18:30` 유일성 — 뷰포트별로 분해해 기록한다**(리더 기대값은 360px 기준이다):

| 뷰포트 | 최대 | 다음 | 판정 |
|--------|------|------|------|
| 360 | **`18:30` 40px** | `8/28(금) …` 28px | **유일** ✅ (리더 기대값과 일치) |
| 768 | **`18:30` 64px** | `8/28(금) …` 40px | **유일** ✅ |
| 1280 | **`18:30` 64px** | `8/28(금) …` 40px | **유일** ✅ |

`<dl>` 의 `18:30 ~ 20:30`(18px)과 QR 카드의 `18:30 ~ 19:30`(24px)은 대형 수치 후보에 들지 않는다.

시각 확인: `/tmp/claude-501/block1-360-final.png` — 각주 1 자리가 비었고 각주 2 만 남았다.

### 회귀 — 통과

**초기 뷰 3뷰포트**

| 뷰포트 | 박스 | 종횡비 | 축척 | ② top/left/bottom/right |
|--------|------|--------|------|-------------------------|
| 360 | 313×391 | 0.8 CSS-OK | **100m** | 21 / 70 / 336 / 109 |
| 768 | 689×388 | 1.7778 CSS-OK | **100m** | 19 / 258 / 335 / 297 |
| 1280 | 896×504 | 1.7778 CSS-OK | **100m** | **77** / 353 / 393 / 409 |

② `메인무대(예정)` 3뷰포트 전부 노출, 잘림 0.

**`WayfindingBlock` 두 곳 렌더 — 26회차 상태 유지**

- 링크 **2개**, 두 `href` **서로 동일**
- 두 `href` 모두 **26회차 기록값과 글자 단위 일치**(쿼리 `?c=3zf71R,2AKrxU,17,0,0,0,dh` 포함) — `WAYFINDING.url` 전환이 값을 바꾸지 않았다
- 표시 도메인 `외부 링크(새 창) · map.naver.com` 2건
- 급행 문장 **2건**

**빌드·정적 검사**: `npm run build` ✓ · `npx tsc --noEmit` exit 0 · `npm run lint` 무출력

**보호 파일 9종 `b5fce01` 대비 diff 0**

### 정리

- 서버: **내가 standalone 으로 기동(PID 79766)하고 PID 지정으로 정지했다.** 포트 3000 비어 있다.
- 임시 파일 `/tmp/claude-501/w27.html` **삭제함**. 증거 스크린샷 `block1-360-final.png` 보존.
- 프로덕션 코드 수정: **0**.

**판정: 통과. 배포 가능하다.**

---

## 28회차 — 3단계 복원 + 키보드 부채 상환 (2026-08-21)

**검증 대상:** `RallyMap.tsx` 단일 파일(+998/−239) — 지도 안 `+/−`·드래그·전체 화면 모달 복원, 22회차 실패 1(방향키 포커스 유실) 수정, `FIT_MAX_ZOOM` 2곳

### 요약: 통과 26 | 실패 0 | 기록 4 | 미검증 2

### 측정 환경 (동결)

| 항목 | 값 |
|------|-----|
| 서빙 | **standalone** — `node .next/standalone/server.js` (PORT 3000). 내가 기동·정지 |
| `BUILD_ID` 측정 전/후 | `UPQkYFlG6PJEB9ZDFY8oG` / **동일** |
| `RallyMap.tsx` 전/후 | `032181175fd305cd` / **동일** |
| 그 외 소스 | `rallyMap.ts 1d86029a…` · `routes.ts 32ee253b…` · `page.tsx 3a85a7c5…` · `WayfindingBlock.tsx 24847600…` — **27회차와 전부 동일** |
| 정적자산 | **10건 전수 200**, CSS **200 · 32,091 bytes** |
| 종횡비 검산 | 3뷰포트 **`CSS-OK`**(4:5=0.8 / 16:9=1.7778) |
| 프로덕션 코드 수정 | **0** |

> **측정 중 서버가 SIGTERM(exit 143)으로 1회 종료됐다** — 내가 죽이지 않았다. 재기동 후
> `BUILD_ID`·`RallyMap.tsx` 해시가 종료 전과 **동일함을 확인**했으므로 앞뒤 측정은 같은 빌드다.

### 1. ★ 키보드 부채(22회차 실패 1) — **상환 확인**

**실제 키 입력으로 재현했다**(합성 이벤트 아님).

**페이지 지도**

```
Tab 4회 → 지도 진입: SPAN#rally-marker-exit5[hit=exit5] "①"
→1 stage "②메인무대(예정)"   →2 park-entrance "③"   →3 rally-zoom-in
→4 rally-zoom-out            →5 exit5 "①"(순환)     →6 stage …
← 역순: rally-zoom-in → park-entrance → stage
포커스 유실: 0 (9회 정방향 + 3회 역방향 전부)
```

개발자 주장 `① → ② → ③ → 확대 → 축소 → ①(순환)` 과 **정확히 일치**.

**팝업 3개 — 키보드만으로 전부 열고 닫았다**

| 지점 | Enter | 포커스 | Esc |
|------|-------|--------|-----|
| ① | 팝업 열림 `①5번 출구 국회의사당역 5번 출구 — 확인된 위치입니다…` | **팝업 안**, `tabIndex=-1` | 닫힘 · 포커스 **`①` 복귀** |
| ② | 팝업 열림 `②메인무대(예정) 메인무대 — 주최측 설치 예정…` | **팝업 안**, `tabIndex=-1` | 닫힘 · 포커스 **`②` 복귀** |
| ③ | 팝업 열림 `③여의도공원 입구 …` | **팝업 안**, `tabIndex=-1` | 닫힘 · 포커스 **`③` 복귀** |

- **포커스 유실 0**, `body` 낙하 0
- `tabIndex=-1` 이라 **탭 정지점 증가 0**(약속대로)
- **Esc 복귀 후 Tab 1회 → 다음 요소(`A`)** — 페이지 처음으로 되돌아가지 않는다

**전체 화면 모달** — 초기 포커스는 `닫기`(지도 그룹 밖)이고, `Tab` 2회로 마커에 진입한 뒤:

```
exit5 → stage → park-entrance → rally-zoom-in-fs → rally-zoom-out-fs → exit5(순환) → stage
포커스 유실 0
Enter → 팝업 열림 · 포커스 팝업 안
Esc  → 팝업만 닫히고 포커스 stage 복귀 · dialog 는 열린 채 유지(Esc 이중 처리 정상)
```

모달 전용 줌 버튼이 `-fs` 접미사로 분리돼 페이지 것과 id 충돌이 없다.

**판정: §26.1.4 부채 상환 조건 충족. 8/27 자동 폴백(라벨 되돌리기) 조건은 소멸해도 된다.**

### 2. ★ 모달 `FIT_MAX_ZOOM` — 새 항목, 통과

| 뷰포트 | dialog | `100dvh` 일치 | 지도 박스 | **축척** | ② pill 여백 |
|--------|--------|--------------|----------|---------|-------------|
| 360 | 360×900 | **true** | 360×900 | **100m** | top 260 / left 144 / bottom 591 / right 200 |
| 768 | 768×900 | **true** | 768×900 | **100m** | top 260 / left 344 / bottom 591 / right 408 |
| 1280 | 1280×900 | **true** | 1280×900 | **100m** | top 260 / left 600 / bottom 591 / right 664 |

**3뷰포트 전부 모달 축척 100m, ② `메인무대(예정)` 노출, 잘림 0.** 개발자 주장 재현됨.
소스 확인: `RallyMap.tsx:116` 정의 · **`:1011`(페이지) · `:2059`(모달) 2곳 적용**.

### 3. 정정 생존 6항목 — 전부 통과

| # | 항목 | 결과 |
|---|------|------|
| 1 | `FIT_MAX_ZOOM` 2곳 | **`:1011` + `:2059`** ✅ |
| 2 | 대체면 문구 | 지도 스크립트 차단 후 렌더 확인 — `지도를 불러오지 못했습니다.` / `집결 장소 — 국회의사당역 5번 출구` / **`코스콤지부 — 집회 3구역 배정 예정(위치 확인 중)`** ✅ |
| 3 | `DISTANCE_TEXT_SHORT` | `src` 전수 **0건** ✅ |
| 4 | `KEYBOARD_ENTRY_ID` | `:580 = "exit5"`, 페이지·모달 양쪽 초기값으로 사용 ✅ |
| 5 | `WayfindingBlock` 2곳 | `page.tsx:193`·`:324`, 해시 27회차와 동일 ✅ |
| 6 | 없는 지점 참조 | `column-*`·`dsharp`·`RALLY_COLUMNS`·`ColumnBand` **전부 주석뿐, 실코드 참조 0** ✅ |

**순회 순서와 없는 지점** — `keyboardOrder()`(`:584`)는
`["rally-zoom-in","rally-zoom-out", ...MAP_FEATURES.map(f=>f.id)]` 이고 `MAP_FEATURES` 에는
`my-location` 이 **포함돼 있다.** 이것이 "없는 지점 참조"가 되는지 실측했다:

> 지오로케이션 전에는 `my-location` 노드가 렌더되지 않고, **순회에서 자동으로 제외된다**
> (정방향 6회 관측 결과 정지점은 `exit5·stage·park-entrance·zoom-in·zoom-out` **5개뿐**).
> **포커스 유실도 빈 정지점도 발생하지 않았다.** 지점 3개 기준으로 정상이다.

### 4. 3단계 회귀 — 통과

| 항목 | 360 | 768 | 1280 |
|------|-----|-----|------|
| 지도 안 `+` / `−` | **44×44 / 44×44** | 44×44 / 44×44 | 44×44 / 44×44 |
| `touch-action` | **none** | none | none |
| 컨트롤 4개 | 지도 크게 보기 146×44 · 처음 위치로 126×44 · 내 위치 표시 130×44 · 로드뷰 보기 126×44 | 동일 | 동일 |
| 페이지 지도 박스 | 328×410 (0.8 CSS-OK) | 689×388 (1.7778 CSS-OK) | 896×504 (1.7778 CSS-OK) |
| **페이지 축척** | **100m** | **100m** | **100m** |
| ② pill 최소 여백 | **30** | **19** | **77** |
| 가로 스크롤 | **0** | 0 | 0 |

**`+/−` × 도형 충돌**: `+`·`−` 버튼과 ①②③ 히트/배지/pill 사이 최소거리 **349~462px** — **겹침 0**.

**모달 열고 닫기(1280, 레이아웃 안정화 대기 후 측정)**

```
모달 전: scrollY=3182  docHeight=6573  지도 896x504 100m top77 left353
모달 후: scrollY=3182  docHeight=6573  지도 896x504 100m top77 left353
Δscroll = 0   Δdoc = 0   지도 픽셀 동일 = true
dialog.open=false · 닫은 뒤 포커스 = 호출 버튼 `지도 크게 보기`
```

### 5. 빌드·보호 파일

```
npm run build   ✓
npx tsc --noEmit ✓ exit 0
npm run lint     ✓ 출력 없음
```

`RallyMap.tsx` 외 **모든 파일 `463290f` 대비 diff 0**(보호 파일 9종 + `page.tsx`·`routes.ts`·`rallyMap.ts`·`WayfindingBlock.tsx`).

### 정정 — 내 첫 모달 측정 2건은 오측이었다

첫 회차에서 **"모달 방향키 무반응"** 과 **"scrollY 192px 어긋남 · 지도 픽셀 불일치"** 를 관측했으나,
**둘 다 내 측정 설계 결함이었고 실패로 올리지 않았다.**

1. **방향키 무반응** — 모달 초기 포커스는 `닫기`(지도 그룹 **밖**)다. 그 자리에서 방향키가
   안 먹는 것은 **정상 동작**이다. `Tab` 으로 마커에 진입시킨 뒤 재측정하니 정상 순환했다.
2. **scrollY 192px · 픽셀 불일치** — 기준값을 `scrollIntoView` **직후**(레이아웃 미안정)에 잡았다.
   `scrollY`·`documentElement.scrollHeight` 가 2회 연속 동일해질 때까지 대기한 뒤 재측정하니
   **Δ=0** 이었다. 픽셀 불일치는 비교 객체에 `scrollY` 를 포함시킨 내 실수다.

> 25회차 규칙의 연장이다 — **관측값이 기대와 다를 때 구현을 의심하기 전에 측정 조건이
> 그 값을 만들 수 있는지 먼저 본다.** 초기 포커스 위치와 레이아웃 안정화는 둘 다
> 내가 통제했어야 할 변수였다.

### 기록 4건 (실패 아님)

| # | 내용 |
|---|------|
| 1 | **드래그 개방의 알려진 제약(수치)** — 지도 박스가 뷰포트 세로에서 차지하는 비율: **360px 45.6% · 768px 43.1% · 1280px 56.0%**. 문서 전체 대비: 5.9% / 6.0% / 7.7%. 좌우 여백: **16/16px**(360) · 32/32(768) · 185/185(1280). **360px 에서는 화면의 45.6% 가 세로 스와이프로 페이지를 내릴 수 없는 구간이고, 좌우 탈출 여백이 각 16px 뿐이다.** 사용자가 위험을 알고 택한 사항이라 실패로 올리지 않는다 |
| 2 | **QA-247**(완화 문구가 최악 구간에서 화면 밖) — 판정 대기. 문구 자체는 렌더 확인함: `※ 지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 밖을 쓸어 주세요.` |
| 3 | **QA-260**(모달 범례 부재) — 판정 대기. 모달 안 버튼은 `닫기`·`확대`·`축소`·`처음 위치로` 4개이고 범례는 없다 |
| 4 | `<h5>지도 데이터`(네이버 API 생성 요소)로 인한 헤딩 레벨 건너뜀 — 26회차 기록 유지 |

### 미검증 2건

- **실기기 터치 드래그·핀치** — 데스크톱 헤드리스에서 `touch-action: none` 과 치수만 확인했고, 실제 손가락 제스처는 재현하지 않았다.
- **실기기 스크린리더** — 포커스 이동을 DOM `activeElement` 로 확인했을 뿐 VoiceOver/TalkBack 실청취는 하지 않았다.

### 정리

- 서버: **내가 standalone 으로 기동하고 PID 지정으로 정지했다.** 포트 3000 비어 있다.
- 임시 파일 `/tmp/claude-501/w28.html` **삭제함**. 증거 스크린샷 `fallback-360.png` 보존.
- 프로덕션 코드 수정: **0**.

**판정: 통과. 배포 가능하다.**

---

## 29회차 — 3단계-A 분할본 배포 전 최종 확인 (2026-08-21)

**검증 대상:** `RallyMap.tsx` 단일 파일. 28회차 이후 변경 2건만 재측정 — ① 전체 화면 모달 렌더 차단(`STAGE3B_FULLSCREEN_MAP = false`) ② QA-247 완화 설계 적용(문구 자리·문안).
**판정 근거:** 디자이너 체크리스트 §27.18.4-304~309 · §27.15.1 · §27.16.2 · §27.17.1

### 요약: 통과 24 | 실패 0 | 기록 3 | 미검증 3 → **배포 판정: 통과**

---

### 측정 환경 (동결 — 측정 전후 대조)

| 항목 | 값 |
|------|-----|
| 서빙 | **standalone** — `node .next/standalone/server.js` (내가 기동·정지). **`next start` 미사용** |
| `BUILD_ID` 측정 전 / 후 | `6F1YBAA9G6Dr27ZTzOGYu` / **동일** |
| `RallyMap.tsx` sha256 전 / 후 | `5c37eab4e747a207…` / **동일** |
| 그 외 소스 | `rallyMap.ts 1d86029a…` · `page.tsx 3a85a7c5…` — **28회차와 동일**. `git diff HEAD -- src/` = **`RallyMap.tsx` 1파일뿐** |
| 정적 자산 | HTML 참조 **10건 전수 200**, CSS **200 · 32,091 bytes**(28회차와 동일) |
| 종횡비 검산 | 360 `0.8` · 768 `1.7778` · 1280 `1.7778` — **3뷰포트 `CSS-OK`** |
| 프로덕션 코드 수정 | **0** |

#### ⚠ 이번 회차의 측정 방법 — 반드시 읽어라 (다음 사람이 재현할 수 있도록)

**네이버 지도 키 `x79smqla3u` 는 `http://localhost:3000` **한 오리진만** 허용한다.** 직접 확인했다:

```
200  http://localhost:3000/rally-2026-08-28
401  http://localhost:3129/rally-2026-08-28
401  http://127.0.0.1:3000/rally-2026-08-28
401  http://localhost:4000/x
```

401 이 나면 `naver.maps` 가 반쪽만 정의돼 **컴포넌트가 렌더 중 예외로 죽고 페이지가 통째로 비어** 측정이 전부 무효가 된다(처음에 실제로 그렇게 됐다).

그런데 **측정 시작 시점에 포트 3000 은 다른 세션의 `npm exec next start -p 3000`(PID 84692, 13:08:48 기동, 접속 1건 ESTABLISHED)이 점유**하고 있었다.
**그 프로세스를 죽이지 않았다**(다른 에이전트가 측정 중일 수 있고, 그것을 끊는 것은 남의 측정을 무효로 만든다).

**대신 오리진과 콘텐츠를 분리했다:**
- 내 동결 빌드를 **127.0.0.1:3129** 로 띄우고,
- 브라우저는 **`http://localhost:3000` 으로 항해**시키되 `page.route('http://localhost:3000/**')` 로 **모든 요청을 3129 로 되돌려 fulfill** 했다.

→ **오리진은 허용된 `localhost:3000`, 바이트는 100% 내 동결 standalone 빌드**다. 남의 3000 서버는 **요청을 한 건도 받지 않았다**(라우트가 네트워크 이전에 가로챈다).
측정 종료 후 확인하니 3000 의 그 프로세스는 **스스로 종료**돼 있었다 — **내가 보낸 시그널은 없다.**

---

### 1. ★ 304 — 완화 문구의 자리와 문안 (§27.15.1 · §27.16.2) — **통과**

| 항목 | §27.17.1 기준 | **실측(360×800 실렌더)** | 판정 |
|------|--------------|------------------------|------|
| **자리** | 지도 박스 **위** | **문구 `bottom 3393` → 박스 `top 3401`** · DOM 순서도 문구가 박스보다 **앞**(`compareDocumentPosition` = FOLLOWING) · 간격 **8px**(`mb-2`) | ✅ |
| **문안** | `…지도 **위나 아래 빈 곳**을 쓸어 주세요.` | **`※ 지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 위나 아래 빈 곳을 쓸어 주세요.`** — 게이트 59 개정본과 **문자열 완전 일치** | ✅ |
| **적용 전 상태 잔존** | 있으면 즉시 실패 | 렌더 DOM 에 **`지도 밖을` 0건** · 문구가 지도 아래인 배치 **0건** | ✅ |
| 은폐 금지(§0.4) | 흐림·접기·`sr-only` 금지 | `text-ink`(**`#1a1a1a`**, `ink-muted` 아님) · `font-semibold`(600) · `15px` · `display:block` · `visibility:visible` · **2줄 45px** | ✅ |

- 소스: `RallyMap.tsx:1723`(문자열) · `:1722`(`<p className="mb-2 …">`, 박스 `:1735` 보다 앞).
- **`지도 밖을` 은 소스에 1건 남아 있으나 `:1710` 주석**이다 — *"종전 `지도 밖을` 은 좌우를 포함하는 것처럼 들린다"* 는 **개정 사유 설명**이라 남아 있어야 맞다. 렌더에는 나오지 않는다.

---

### 2. ★★ 305 [핵심] — 최악 구간에서 문구가 보이는가 — **통과**

**측정 정의를 먼저 못 박는다.** 22회차 기준값 **85.4%** 는 **세로 점유**(지도 박스와 엄지 영역의 세로 교집합 ÷ 엄지 영역 높이)다.
`410 ÷ 480 = 85.4%` 로 **소수점까지 재현**되므로 정의가 확정된다. **면적 점유(가로까지 곱한 값)는 별도 열로 병기**한다.
엄지 영역 = 뷰포트 **하단 60%**, 문서 전 구간 **10px 간격 스캔**, 기기 에뮬레이션(`isMobile`·`hasTouch`·DPR 3).

| 뷰포트 | 지도 박스 | 엄지 영역 | **최대 세로 점유** | (면적 점유) | 최악 스크롤 구간 | **그 화면에 문구가** |
|--------|----------|----------|------------------|------------|-----------------|-------------------|
| **360×800** | 328×410 @doc 3401~3811 | 320~800 (480px) | **85.4%** ← 22회차 값 정확히 재현 | 77.8% | `scrollY 3020~3080` | **전문(2줄) 완전히 보임** ✅ |
| **360×640** | 328×410 @doc 3401~3811 | 256~640 (384px) | **100.0%** (엄지 영역을 지도가 **전부** 덮는다) | 91.1% | `scrollY 3150~3170` | **전문(2줄) 완전히 보임** ✅ |

**위험도와 가시성이 같은 방향으로 움직인다 — 반비례가 뒤집혔다.** 이것이 QA-247 의 본체였다.

| 뷰포트 | 점유 **≥70%** 구간 | 그중 문구가 **안 보이는** 구간 | 점유 **≥85%** 구간 | 그중 안 보이는 구간 |
|--------|------------------|---------------------------|------------------|------------------|
| 360×800 | **22개** | **0개** | **8개** | **0개** |
| 360×640 | **26개** | **0개** | **14개** | **0개** |

**문구가 보이지 않는 구간(리더 요구 — 점유율과 함께 보고)**

| 뷰포트 | 구간 | 그 구간의 **최대 세로 점유** | 문구가 **완전히 화면 밖**일 때 최대 점유 |
|--------|------|--------------------------|----------------------------------|
| 360×800 | `scrollY 3350` ~ 문서 끝(6200) · 15개 | **29.3%** | 18.9% |
| 360×640 | `scrollY 3350` ~ 문서 끝(6360) · 21개 | **53.3%** | 40.3% |

→ 문구가 사라지는 것은 **문구를 지나쳐 아래로 더 내려간 뒤**뿐이고, 그때 점유는 이미 **떨어지는 중**이다.
**22회차 상태(문구가 안 보이는 최대 점유 = 85.4% = 최악 구간 그 자체)와 정반대다.**

> **디자이너 예측치와의 차이 1건(실패 아님)**: §27.15.1 은 *"문구가 안 보이는 구간은 점유 25.8% 이하"* 라고 적었으나
> 내 실측은 **29.3%(360×800) / 53.3%(360×640)** 다. **판정에 영향 없다**(기준은 "최악 구간에서 보이는가"이고 그것은 충족).
> 차이는 **640 높이를 함께 재서** 생긴 것으로 보인다 — 뷰포트가 낮을수록 엄지 영역이 좁아 같은 박스의 점유율이 올라간다.

**⚠ 데스크톱 값(§27.17.2 의 93.3%)은 쓰지 않았다.** 위 수치는 전부 360폭 기기 에뮬레이션 실측이다.

---

### 3. 306 — 컨트롤 행 3개 재검산 (§27.4.3 4개 기준은 무효) — **통과**

| 뷰포트 | 버튼 | 행 배치 | 행 폭 합(gap 8px 포함) | 컨테이너 | 넘침 |
|--------|------|--------|---------------------|---------|------|
| **360** | `처음 위치로` 126.1×44 · `내 위치 표시` 130.3×44 · `로드뷰 보기` 126.1×44 | **2행** (1행 2개 / 2행 1개) | 1행 **264.4** · 2행 **126.1** | **328** | **0** |
| 768 | 동일 3개 | **1행** | **398.5** | 689 | 0 |
| 1280 | 동일 3개 | **1행** | **398.5** | 896 | 0 |

- `row.scrollWidth − row.clientWidth` = **0**(3뷰포트), 문서 가로 스크롤 **0**(3뷰포트).
- 360 여유: 328 − 264.4 = **63.6px**. 전 버튼 **높이 44px**(터치 대상 충족).
- **`지도 크게 보기` 는 어느 뷰포트에도 없다** — 4개 기준 실측값(1행 280.0 / 2행 264.4)은 폐기하고 **위 3개 기준값이 유효**하다.

---

### 4. 307 — 3단계-B 가 정말 안 나오는가 — **통과**

| 확인 | 실측 |
|------|------|
| `지도 크게 보기` 버튼 렌더 | **0건** (SSR HTML · 360/768/1280 실렌더 전부) |
| 전체 화면 `<dialog>` 렌더 | **0건** — DOM 의 `<dialog>` 는 **1개뿐**이고 `aria-label="국회의사당역 5번 출구 로드뷰"`(로드뷰) |
| **`-fs` 접미사 id** (28회차에서 확인했던 모달 정지점) | **0건** — `[id$="-fs"]` 전수 조회 결과 없음 |
| 페이지의 모든 `<button>` | `확대` · `축소` · `처음 위치로` · `내 위치 표시` · `로드뷰 보기` · `닫기`(로드뷰 모달, 닫힌 상태) — **모달 관련 정지점 없음** |
| 키보드 순회 정지점 | 그룹 안 5개(`exit5`·`stage`·`park-entrance`·`rally-zoom-in`·`rally-zoom-out`) — **모달 것 0** |
| **소스 주석 정리**(§27.18.3) | 종전 `:1040`·`:1781` 의 *"`지도 크게 보기` 를 그 옆에 둔다"* 서술이 **`:1067` · `:1845` 에서 "3단계-B 로 미뤄져 렌더되지 않는다(§27.18 · `STAGE3B_FULLSCREEN_MAP`)"** 로 **교체됨** ✅ |
| 스위치 단일화 | `STAGE3B_FULLSCREEN_MAP`(`:140`) — 사용처 **`:1853`(버튼) · `:1986`(모달) 2곳뿐.** 다른 파일 참조 **0** |
| 코드 보존 | `RallyFullscreenMap` 정의·`FIT_MAX_ZOOM` 모달 적용 **삭제되지 않고 남아 있음** — 되살릴 때 재작성할 것이 없다 ✅ |

---

### 5. 308 — A 기능 전수 정상 — **통과**

**드래그** (360×800 · CDP `Input.dispatchTouchEvent` 한 손가락)

```
touch-action = none
scrollY  3201 → 3201   (Δ = 0px — 지도 위에서는 페이지가 안 내려간다: 설계대로)
① 마커   y331 → y171   (지도가 160px 이동 — 드래그는 동작한다)
```

**지도 안 `+` / `−`**

```
#rally-zoom-in   44×44 @(288,212) aria-label="확대"
#rally-zoom-out  44×44 @(288,254) aria-label="축소"
축척  100m --[+]--> 50m --[−]--> 100m   (왕복 복귀)
focus-visible 아웃라인 3px #093389
```

**키보드 roving group** (실제 키 입력)

```
Tab 4회 → 그룹 진입: SPAN#rally-marker-exit5
정방향 9회: stage → park-entrance → zoom-in → zoom-out → exit5(순환) → stage → park-entrance → zoom-in → zoom-out
역방향 3회: zoom-in → park-entrance → stage
포커스 유실: 0 / 12회
roving tabindex: 그룹 5요소 중 tabbable(=0) 은 항상 1개
```

**팝업 3개** — 키보드(Enter/Esc)·터치 탭 **양쪽**으로 열고 닫았다

| 지점 | Enter → | 포커스 | `aria-hidden` | 박스 안 여백 | Esc → |
|------|--------|--------|--------------|------------|-------|
| ① | `①5번 출구 국회의사당역 5번 출구 — 확인된 위치입니다…` | **팝업 안** | **null**(해제 유지) | 좌16·우16·하16 | 닫힘 · **① 복귀** |
| ② | `②메인무대(예정) 메인무대 — 주최측 설치 예정…` | 팝업 안 | null | 좌16·우16·하16 | 닫힘 · **② 복귀** |
| ③ | `③여의도공원 입구 …` | 팝업 안 | null | 좌16·우16·상16 | 닫힘 · **③ 복귀** |

- 세 팝업 모두 **박스 경계 안**(`insideBox = true`) — 좌우 잘림 0.
- **터치 탭**으로도 ② 팝업 열림 확인, `닫기` 버튼으로 닫힘 확인.
- `aria-hidden="true"` 안의 포커스 가능 요소 **0건**(전수).
- 탭 정지점: 팝업 닫힘 **17** → 열림 **18**(+1 = 팝업 안 `닫기`). `aria-hidden` 이 해제된 지금 이것이 **정상**이다.

---

### 6. 회귀 (짧게) — 전건 통과

| 항목 | 360 | 768 | 1280 |
|------|-----|-----|------|
| 지도 박스 | 328×410 (0.8 **CSS-OK**) | 689×387.6 (1.7778 **CSS-OK**) | 896×504 (1.7778 **CSS-OK**) |
| **초기 축척** | **100m** | **100m** | **100m** |
| ② pill `②메인무대(예정)` | 박스 안 · 최소 여백 **30** | 박스 안 · 최소 여백 **19** | 박스 안 · 최소 여백 **77**, **잘림 0** |
| 가로 스크롤 | **0** | 0 | 0 |
| `네이버 지도로 길찾기` | **2곳** | 2곳 | 2곳 |
| `<dt>참석 시간` / `<dd>` | **`18:30 ~ 20:30`**(+ sr-only `오후 6시 30분부터 오후 8시 30분까지`) | 동일 | 동일 |

- **1280 박스 896×504** — 28회차와 동일. 25회차의 `328×410 @1280`(CSS-IMPOSSIBLE) 증상 **재발 없음**.
- 대비: `#1a1a1a:#ffffff` **17.40** · `#093389:#ffffff` **11.37** — **신규 색 조합 0**.
- 빌드: `npx tsc --noEmit` **exit 0** · `npm run lint` **출력 0** · `npm run build` **성공**.

---

### 기록 3건 (실패 아님)

| # | 내용 |
|---|------|
| **1** | **주석이 구현보다 뒤처진 곳 2줄 — 문서 부채.** `RallyMap.tsx:1287` *"팝업은 `aria-hidden` 이고 포커스 가능 요소를 두지 않기 때문이다"* 와 `:1794~1796` *"그래서 `닫기` 도 `tabindex={-1}` 이다"* 는 **지금 사실이 아니다.** 3단계에서 `aria-hidden` 을 해제했고(`:773` 에 정확히 기록돼 있다) `닫기` 는 정상 탭 정지점이다. **코드 동작은 옳다**(document 레벨 `Esc` 는 포커스 위치와 무관하게 동작). 다만 `:1287` 은 *"그러므로 document 레벨이어도 된다"* 는 **근거로 쓰이고 있어**, 다음 사람이 이 근거를 믿고 팝업 구조를 바꾸면 판단이 어긋난다. **§27.18.3 이 `지도 크게 보기` 주석에 요구한 것과 같은 종류의 정리**다 — 배포를 막지 않으니 3단계-B 작업 때 함께 고쳐라 |
| **2** | **감수된 위험은 그대로다.** 지도 위 한 손가락 세로 스와이프로 페이지가 내려가지 않는다(Δ0px 재확인). 360×640 에서는 **엄지 영역의 100%** 를 지도가 덮는 스크롤 구간이 존재한다. **완화 수단은 여전히 안내 문구 1건뿐**이고, 이번 개정으로 그 1건이 **최악 구간에서 작동하게** 됐다. 좌우 여백은 각 **16px** 로 엄지가 들어가지 않는다(불변) |
| **3** | **QA-260(모달 범례 부재)은 이번 배포 범위 밖이다.** 모달이 렌더되지 않으므로 **문제 자체가 발생하지 않는다**(§27.18.2). 체크리스트 **309 는 3단계-B 대기 항목**이라 이번에 판정하지 않았다 |

### 미검증 3건

- **실기기 터치 드래그·핀치** — Chromium 기기 에뮬레이션 + CDP 터치로 재현했을 뿐, iOS Safari 의 `touch-action: none` 처리와 관성 스크롤은 재현 대상이 아니다.
- **실기기 스크린리더** — 포커스를 `document.activeElement` 로만 확인했고 VoiceOver/TalkBack 실청취는 하지 않았다.
- **체크리스트 309** — 3단계-B(QA-260 판정 후) 항목. 이번 회차 대상 아님.

---

### 정리

- 서버: 내가 **standalone 으로 3129 에 기동하고 PID 지정으로 정지**했다. 포트 3129 비어 있다. **남의 3000 서버에는 시그널을 보내지 않았고 요청도 보내지 않았다.**
- 임시 산출물: `.playwright-mcp/` **삭제함**. 스크래치 스크립트 삭제함.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

## **배포 판정: 통과.** 3단계-A 를 배포할 수 있다.

**단, 배포 후 반드시 살아 있어야 하는 것**: `STAGE3B_FULLSCREEN_MAP` 이 **`false` 인 상태로** 나가야 한다.
`true` 로 나가면 QA-260(모달 범례 부재)이 **미판정 상태로 조합원에게 노출**되고, 컨트롤 행 3개 기준 실측(§3)도 무효가 된다.

---

### 29회차 보론 — `313` vs `328` 판정 · 22회차 대조표 (리더 요청, 같은 회차 추가 측정)

리더가 **"개발자 폭 313 이 맞는가"** 를 먼저 풀라고 지시했다. **결론: 328 이 참값이고 313 은 스크롤바 오염이다.**
**본문 §2 의 305 수치는 처음부터 `328 × 410` 환경에서 잰 것이라 재측정 없이 그대로 유효하다.** 다만 판정을 남기기 위해 **오염 환경을 의도적으로 재현**해 대조했다.

**소스 해시 `5c37eab4…` · `BUILD_ID 6F1YBAA9G6Dr27ZTzOGYu` — 본문 측정 때와 동일**(개발자 보고 이후에도 변경 없음).
이번 보론은 포트 3000 이 비어 **standalone 을 3000 에 직접 띄워** 쟀다(본문의 라우트 우회 없이). **본문 수치가 그대로 재현됐다** — 우회 방식이 값을 왜곡하지 않았다는 교차 확인이기도 하다.

#### 1. 세 환경 동시 측정 — 차이는 **컨텍스트 옵션 하나**다

| 환경 | `innerWidth − clientWidth` | `maxTouchPoints` | `(pointer:coarse)` | **지도 마운트** | 종횡비 | **최대 점유** |
|------|--------------------------|------------------|--------------------|----------------|--------|--------------|
| **360×800 · `isMobile+hasTouch`** ← **본문이 쓴 환경** | **0px** | 1 | true | **328 × 410** | 0.8 **CSS-OK** | **85.4%** |
| **360×640 · `isMobile+hasTouch`** | **0px** | 1 | true | **328 × 410** | 0.8 **CSS-OK** | **100.0%** |
| **360×800 · 데스크톱 컨텍스트**(오염 재현) | **15px** | 0 | false | **313 × 391.3** | 0.8 **CSS-OK** | **81.5%** |

**세 번째 줄이 개발자가 보고한 `313` · `391.25` · `81.5%` 를 소수점까지 재현한다.** 원인 특정 끝.

- `360 − 16 − 16 = 328`(좌우 패딩 각 16px, 3환경 모두 `16/16` 실측) → `328 × 1.25 = 410`.
- 오염 환경은 여기서 **자리를 먹는 스크롤바 15px** 이 더 빠져 `313 × 1.25 = 391.25`.
- **조합원의 단말에는 자리를 먹는 스크롤바가 없다**(`maxTouchPoints 1` · `coarse true` 환경에서 스크롤바 **0px** 실측). **328 이 조합원이 보는 값이다.**

> ⚠ **종횡비 검산으로는 이 오염을 잡을 수 없다.** 313×391.3 도 **0.8 = `CSS-OK`** 다. 폭이 줄면 높이도 비례해 줄기 때문이다.
> **`CSS-IMPOSSIBLE` 판정(25회차 규칙)은 종횡비 오염만 잡고, 폭 오염은 못 잡는다.** 폭 오염은
> **`innerWidth − documentElement.clientWidth` 를 함께 찍는 것**으로만 잡힌다 — **다음 회차부터 이 값을 측정 환경표에 넣어라.**

#### 2. 22회차 대조표 (qa-rally 인계 기준값 ↔ 29회차 실측)

전부 **동일 정의**: 엄지 영역 = 뷰포트 하단 60% · 분모 = 그 띠의 높이 · 10px 간격 전 구간 스캔 · `scroll-behavior:auto` 강제.

| 지표 | **22회차 기록** | **29회차 실측(360×800)** | 판정 |
|------|----------------|------------------------|------|
| 최대 점유율 | **85.4%** | **85.4%** | **동일 — 지도는 작아지지 않았다** |
| 좌우 여백 | 16px | **16 / 16** | 동일 |
| 지도가 엄지 영역에 걸리는 구간 비율 | 15.9% | **14.3%** | 문서 총 길이 변화(교통 안내·투쟁 안내 추가)에 따른 분모 차. 걸침 구간의 **절대 길이**는 지도 크기가 같으므로 불변 |
| 점유 ≥80% 구간 | 13개 | **12개** | 위와 같은 이유(10px 격자 위치 차) |
| 최악 구간의 지도 밖 연속 세로 띠 | 325px(상단) | **381px(상단)** | 문구가 지도 위로 올라가며 박스가 아래로 밀린 결과 |
| **점유 ≥70% 이면서 문구가 화면 밖인 구간** | **16개** | **0개** | **★ 해소** |
| **그 구간의 최대 점유율** | **85.4%**(= 최악 구간 그 자체) | **해당 구간 없음** | **★ 해소** |
| **문구가 보이는 최대 점유율** | **80.2%** | **85.4%**(= 최댓값 자체) | **★ 상한이 최악 구간까지 올라왔다** |

**리더가 정한 배포 게이트 — "최대 점유 지점(85.4%)에서 문구 rect 가 뷰포트 안인가": `true`.**
`worstScroll 3020~3080` 전 구간에서 문구 2줄이 **완전히** 뷰포트 안이다.

#### 3. 360×640 (기준값 없음 — 절대값 판정)

| 지표 | 실측 |
|------|------|
| 지도 마운트 | **328 × 410**(360×800 과 동일 — 세로 뷰포트는 박스 크기를 바꾸지 않는다) |
| 엄지 띠 | 640 × 0.6 = **384px** |
| 최대 점유 | **100.0%** — `410 > 384` 이므로 **띠를 지도가 전부 덮는 것이 CSS 상 정상값**이다(오염 신호 아님) |
| 최악 스크롤 | 3150~3170 · 탈출 띠 **251px(상단)** |
| **그 지점에서 문구** | **완전히 보임** ✅ |
| 점유 ≥80% 구간 | 18개 · **그중 문구 숨김 0개** |
| 문구가 안 보이는 구간의 최대 점유 | **53.3%** |

#### 4. 개발자 보고에 대한 판정

| 개발자 값 | 판정 |
|-----------|------|
| 최대 점유 **81.5%** / 지도 391.25 / 콘텐츠 폭 313 | **무효** — 스크롤바가 자리를 먹는 데스크톱 컨텍스트에서 잰 값. 참값은 **85.4% / 410 / 328** |
| **`≥70% 인데 문구 숨김 = 0건`** | **결론은 참이다.** 오염 환경(81.5%)에서도 0, **참 환경(85.4%)에서도 0** — 내가 양쪽 다 쟀다. **19px 여유 안에서 나온 0 이 아니다** |
| 360×640 최대 점유 **100%** | **참** — 위 §3 |
| `375px 에서 문구 2줄 45px` | **참** — 내 `328` 폭 실측에서도 **2줄 45px**(3환경 전부). 우연히 같은 콘텐츠 폭이었다는 리더 판단이 맞다 |
| 컨트롤 3개 · `지도 크게 보기` 0 · `<dialog>` 1 · 키보드 · 축척 · ② pill | **전부 참** — 본문 §3~§6 에서 독립 실측으로 확인 |

**정리: 개발자의 숫자 3개(313 · 391.25 · 81.5%)는 폐기하고, 결론은 유지된다. 배포 판정 「통과」는 변하지 않는다.**

---

### 29회차 보론 2 — **G2 / 체크 284: 완화 문구의 사실 주장 검증** (리더 요청)

**1순위(실제 터치 스와이프)로 판정했다. 2순위 CSS 구조 근거로 대체하지 않았다.**
내 측정 컨텍스트는 처음부터 `isMobile: true` · `hasTouch: true` 라 터치 축이 살아 있다(`maxTouchPoints 1` · `(pointer:coarse) true` 실측 — 보론 1 참조). **375 보정은 쓰지 않았다.**

검증 대상 주장:
> `※ 지도는 손가락 하나로 움직입니다. 페이지를 내릴 때는 지도 위나 아래 빈 곳을 쓸어 주세요.`

**측정 지점은 각 뷰포트의 최악 스크롤 위치**(= 지도가 엄지 영역을 가장 많이 덮는 곳)다. 위험이 최대인 그 자리에서 문구대로 해 봤다.
방법: CDP `Input.dispatchTouchEvent` 로 한 손가락 `touchStart → touchMove ×10 → touchEnd`(위로 150px), 관성 정착까지 800ms 대기 후 `scrollY` 대조.

#### 360×800 · `scrollY 3050`(점유 **85.4%** — 최악 지점)

지도 `top 351 / bottom 761` · 뷰포트 800 · 문구 `top 298 / bottom 343`

| 쓸어 올린 자리 | `scrollY` 전 → 후 | Δ | 판정 |
|---|---|---|---|
| **지도 위 빈 곳**(y 176) | 3050 → **3245** | **+195px** | **내려간다** ✅ |
| **지도 아래 빈 곳**(y 781) | 3050 → **3249** | **+199px** | **내려간다** ✅ |
| **안내 문구 자체 위**(y 321) | 3050 → **3261** | **+211px** | **내려간다** ✅ |
| 지도 위(y 556) — **대조군** | 3050 → **3050** | **0px** | 안 내려간다(설계대로) |

#### 360×640 · `scrollY 3160`(점유 **100%** — 최악 지점)

지도 `top 241 / bottom 651` · 뷰포트 640 · 문구 `top 188 / bottom 233`

| 쓸어 올린 자리 | `scrollY` 전 → 후 | Δ | 판정 |
|---|---|---|---|
| **지도 위 빈 곳**(y 121) | 3160 → **3357** | **+197px** | **내려간다** ✅ |
| **지도 아래 빈 곳** | — | — | **이 지점에는 존재하지 않는다**(지도 `bottom 651` > 뷰포트 640) |
| **안내 문구 자체 위**(y 211) | 3160 → **3358** | **+198px** | **내려간다** ✅ |
| 지도 위(y 441) — **대조군** | 3160 → **3160** | **0px** | 안 내려간다(설계대로) |

**대조군이 이 측정의 신뢰 근거다.** 같은 제스처·같은 코드로 지도 밖은 **+195~211px**, 지도 위는 **0px** 이 나왔다.
"터치 스와이프가 애초에 스크롤을 못 만드는 환경이었다"는 해석은 성립하지 않는다.

**★ 문구를 읽는 그 자리에서 바로 쓸어도 내려간다** — 문구 위 스와이프가 두 뷰포트 모두 200px 안팎으로 동작한다.
조합원이 문구를 발견하고 손가락을 옮길 필요 없이 **그 자리에서** 탈출할 수 있다.

#### 구조 근거 (2순위 조건 — 함께 충족)

문서 전체에서 `touch-action` 이 `auto` 가 아닌 요소는 **단 하나**다:

```
DIV.size-full  →  touch-action: none      ← 지도 마운트 (RallyMap.tsx:1748)
```

지도 마운트의 **조상 7단계 전부 `auto`**: `DIV.rounded-card` → `FIGURE.mt-5` → `SECTION.mt-section` → `DIV.mx-auto` → `MAIN.flex-1` → `BODY.flex` → `HTML.h-full`.
**조상에 걸린 `touch-action` 이 0건**이므로 박스 밖은 브라우저 기본 스크롤이다 — 로드뷰 사고(네이버 파노라마 중첩 div 가 `touch-action` 전파를 안 받음)의 반대 방향이라 같은 함정이 없다.
**실측과 구조가 같은 결론을 낸다.**

#### 판정

**체크 284 통과.** 완화 문구의 사실 주장은 **참**이다.
`지도 위나 아래 빈 곳` 중 **위는 두 뷰포트 최악 지점에서 모두 참**, **아래는 360×800 최악 지점에서 참**이고 360×640 최악 지점에서는 **아래가 화면 안에 존재하지 않는다**(존재하는 쪽이 참이므로 문장은 참).

> **기록**: §27.16.2 가 `위나 아래` 를 **둘 다** 쓴 이유가 여기서 실측으로 확인된다 — *"지도가 화면 하단을 덮으면 위가 비고, 상단을 덮으면 아래가 빈다. 한쪽만 말하면 나머지 상황에서 틀린다."*
> 360×640 최악 지점은 **아래가 없고 위만 있는** 상황이고, 문구가 위를 함께 말하고 있어 성립한다. **한쪽만 적었다면 이 지점에서 거짓이 됐다.**

#### 배포 게이트 최종

| | 항목 | 판정 |
|---|---|---|
| **G1** | 최대 점유 지점(85.4% / 100%)에서 완화 문구 rect 가 뷰포트 안인가 | **통과** (보론 1 §2) |
| **G2** | 체크 284 — 문구의 사실 주장이 참인가 | **통과 · 1순위(실제 터치)로 판정.** 2순위 대체 아님 |

**미검증으로 남는 것**: 실기기(iOS Safari / Android Chrome) 관성 스크롤과 `touch-action: none` 의 실제 처리. Chromium 기기 에뮬레이션 + CDP 터치 이벤트로 재현했을 뿐이다. **이 한 줄은 28회차부터 이어지는 동일한 잔여 항목이고, 이번에 새로 생긴 것이 아니다.**

## **배포 판정 「통과」 확정 — G1 · G2 둘 다 통과.**

---

## 30회차 사전 기준선 — 지점 추가 **전** 현행 실측 (2026-08-21)

**회차 판정이 아니다.** 3구역 작업으로 지점이 3 → 5~6개가 되면 *"나빠진 것인지 원래 그랬던 것인지"* 를 가릴 수 없게 되므로, **변경 전 상태를 먼저 확정해 둔다**(§5.5 — 정의가 다르면 회차 간 비교가 성립하지 않는다).

**대상**: 배포본 `cf3421a` 와 같은 소스 `RallyMap.tsx 5c37eab4…` · `BUILD_ID 6F1YBAA9G6Dr27ZTzOGYu` · standalone `localhost:3000`

### 1. ★ 현행 최소 쌍간격 — **67px**. 주석의 `1px` 은 현행 값이 아니다

`RallyMap.tsx:918~932` 는 `LABEL_MIN_GAP = 0` 의 근거로 이렇게 적고 있다:

> *"현행 초기 화면(z16)의 라벨 사이 실측 간격이 **1px** 다(360px 실측: **② 바닥 y49 ↔ ③ 머리 y50, ④ 바닥 y359 ↔ ⑤ 머리 y360**). 8px 를 적용하면 처음 보는 화면에서 **③⑤** 가 즉시 배지로 접혀 §21.8-107 을 위반한다."*

**이 근거는 만료됐다.**
- **`④`·`⑤` 는 존재하지 않는다** — `column-2`·`dsharp` 는 23회차에 제거됐고 실코드 참조 0건이다.
- **번호도 재부여됐다**(23회차) — 지금 `①②③` 은 `exit5`·`stage`·`park-entrance` 이므로, 주석의 `②③` 도 **당시 번호 체계**의 것이라 오늘의 `②③` 과 같다고 볼 수 없다.

**실측(3뷰포트 공통, 초기 뷰 z16 · 축척 100m):**

| 쌍 | 간격 | 겹침 |
|---|---|---|
| `exit5 × stage` | **67.00px** | 0 |
| `exit5 × park-entrance` | 213.34px | 0 |
| `stage × park-entrance` | 240.20px | 0 |

**최소 쌍간격 = 67px. 주석이 말하는 1px 과 두 자릿수 차이다.**

### 2. 그래서 — `LABEL_MIN_GAP = 0` 은 **근거가 소멸한 채 남은 값**이다 (판정 요청)

`0` 을 택한 이유는 *"8px 를 적용하면 초기 화면에서 즉시 접혀 §21.8-107 을 위반한다"* 였다.
**현행 최소 간격이 67px 이므로 8px 임계를 적용해도 접히는 라벨이 없다.** z15 로 한 단 축소해도 최소 **47.54px** 이라 마찬가지다.

| 줌 | 축척 | 최소 쌍간격 | 겹침 | 8px 임계 적용 시 접힘 |
|---|---|---|---|---|
| z16(초기) | 100m | **67.00px** | 0 | **없음** |
| z15(−1단) | 300m | **47.54px** | 0 | **없음** |

> **이것은 QA 실패가 아니다.** 임계값은 스펙 소관이고, 주석도 *"임계값만 올리지 마라"* 라고 못박고 있다.
> **디자이너 판정 요청으로 올린다** — `LABEL_MIN_GAP` 을 §21.2.3 의 `8` 로 되돌릴 것인가, `0` 을 유지하되 **주석의 만료된 근거를 갱신**할 것인가.
> ⚠ **시점이 중요하다**: 지점이 5~6개로 늘면 배치가 다시 픽셀 단위로 굳고, 주석 말대로 *"여백을 벌리려면 그 결과를 다시 흔들어야"* 한다. **3구역 배치 확정 전이 가장 싸다.**

### 3. 30회차 판정선 (이 기준선 위에서 확정)

| 층 | 값 | 근거 |
|---|---|---|
| **실패** | **실교차 > 0px** | 코드가 실제로 강제하는 것(`LABEL_MIN_GAP = 0`) |
| **경고** | 8px 미만 | §21.2.3 스펙 예산 — 현재 문서화된 후퇴 상태 |
| 참고 | 재노출 8px | `LABEL_REVEAL_GAP` — 히스테리시스용. **겹침 판정과 무관하다** |

**8px 을 실패선으로 쓰지 않는다.** 코드가 약속한 적 없는 기준으로 실패를 만들게 된다.

### 4. 히스테리시스 왕복 — 정상

`z16 → z15(축소) → 처음 위치로 → z16`, 3뷰포트 전부:

- z15 에서 `stage` 가 **pill → 배지로 접힌다**(`secondary` 는 z≥16 노출). `exit5`·`park-entrance` 는 배지 유지.
- **z16 복귀 시 라벨 좌표가 초기와 완전히 동일** — 360 기준 `exit5 l98/r126` · `stage pill l84.5/r219.5` · `park-entrance l292/r320`, 박스 여백도 전부 동일. **깜빡임·좌표 드리프트 0.**

### 5. ★ 미확인 항목 해소 — 1px 격자 방법을 쓸 수 있다

| 지표 | 3뷰포트 공통 |
|---|---|
| SVG 기하 노드(`path`/`circle`/`polygon`/`ellipse`) | **4개** |
| **`isPointInFill` 보유 노드** | **4개** |
| `path[d]` 보유 노드 | **4개** |

**`isPointInFill`/`isPointInStroke` 경로와 `<path d>` 파싱 경로가 둘 다 살아 있다.** 앞서 "미확인"으로 올린 항목을 해소한다.

### 6. 라벨 ↔ 박스 여백 (18회차 하한 8px 기준)

| 뷰포트 | 전 라벨 중 최솟값 | 어느 라벨 |
|---|---|---|
| 360 | **24** | `park-entrance` 우측 |
| 768 | **23** | `stage`(②) 상단 |
| 1280 | **77** | `stage`(②) 상단 |

**전부 8px 하한 충족.** ⚠ 28·29회차의 `30 / 19 / 77` 은 **`② pill` 하나만**의 최솟값이고, 위는 **전 라벨 중 최솟값**이다 — **정의가 다르므로 직접 비교하지 마라.**

### 7. ⚠ 재현하지 못한 불일치 1건 — 768 박스 폭

| 측정 | 768 박스 | `innerWidth − clientWidth` |
|---|---|---|
| **29회차**(라우트 우회 경유) | **689 × 387.6** | **기록하지 않음** |
| **이번 직접 측정** | **704 × 396** | **0 (기록함)** |

차이 **15px = 스크롤바 1개분**. 이번에 `768` 을 데스크톱·모바일 컨텍스트로 각각 다시 띄워 봤으나 **양쪽 다 스크롤바 0 · 704×396** 이 나와 **689 를 재현하지 못했다.** 원인을 특정하지 못했으므로 추측을 결론으로 쓰지 않는다.

- **1280 은 영향 없다**(양쪽 다 `896×504`) — 그 폭에서는 컨테이너가 `max-width` 로 잘려 스크롤바 15px 이 콘텐츠 폭을 바꾸지 않는다.
- **360 도 영향 없다** — 게이트 판정에 쓴 값은 전부 모바일 컨텍스트(스크롤바 0 · `328×410`)에서 나왔다.
- **29회차 판정은 어느 것도 뒤집히지 않는다** — 768 에서 본 것은 축척 100m·② pill 박스 안·가로 스크롤 0 이고 셋 다 두 값에서 동일하게 성립한다.
- **조치**: `689 × 387.6` 을 **격리**한다(환경 미기록 값). 앞으로 768 기준선은 **`704 × 396`(스크롤바 0 기록됨)** 을 쓴다.

> **이것이 §5.5 환경표를 고정 항목으로 넣어야 하는 이유다.** 29회차에 그 필드를 찍었으면 지금 원인을 알았을 것이다. **내 29회차 측정의 누락이다.**

### 사전 기준선 §7 후속 — 통제 실험으로 변수를 좁혔다 (결론 아님)

`qa-rally` 가 자기 세션 4개 회차 데이터로 **`isMobile` 가 변수**라는 가설을 제시했다(`true`→오버레이 704 / `false`→클래식 689). **내 환경에서 통제 실험으로 반증됐다.**

**768×1024 · 4셀 전수**(같은 브라우저 인스턴스, 같은 빌드):

| 셀 | `innerWidth − clientWidth` | 박스 | docHeight |
|---|---|---|---|
| direct · desktop(`isMobile:false`) | **0** | **704×396** | 6492 |
| direct · `isMobile:true` | **0** | **704×396** | 6492 |
| proxy · desktop | **0** | **704×396** | 6492 |
| proxy · `isMobile:true` | **0** | **704×396** | 6492 |

**네 변수 조합 전부 스크롤바 0 · 704×396 이다.** 따라서 내 환경에서는:

- **`isMobile` 가 변수가 아니다** (qa-rally 가설 반증)
- **`hasTouch` 도 아니다**
- **라우트 우회(proxy) 도 아니다** — 29회차 측정 방식이 값을 왜곡했다는 의심도 함께 배제된다
- **빌드·문서 길이도 아니다**(docHeight 4셀 동일)

**남은 후보는 브라우저 인스턴스의 기동 상태 하나다.** 이번 세션에서 **내가 만들지 않은 컨텍스트**(도구가 기본으로 띄운 페이지)는 360에서 **스크롤바 15px · 콘텐츠 313** 이었고, **내가 `newContext()` 로 만든 컨텍스트는 전부 0** 이다. 29회차의 `689` 는 `newContext()` 로 잰 값이라 이 설명과도 어긋난다 — **소급 확인이 불가능하므로 여기서 멈춘다. 추측을 결론으로 쓰지 않는다.**

**판정에 쓸 값은 바뀌지 않는다: 768 = `704×396`**(스크롤바 0). 768은 태블릿 구간이고 실기기는 오버레이 스크롤바를 쓴다 — `689` 는 데스크톱 창을 768px 로 좁힌 경우에만 나오는 값이다. **리포트에는 `768 = 태블릿 컨텍스트(오버레이) · 704×396` 으로 조건을 붙여 기록한다.**

> **교훈은 그대로다.** 두 QA 인스턴스가 각각 값을 남겼는데 **한쪽은 스크롤바 필드를 안 찍었고(나·29회차), 다른 쪽은 찍어 놓고 박스 폭과 연결 짓지 않았다**(qa-rally·26~28회차). **기록하는 것과 그 값으로 검산하는 것은 다르다.** §5.5 환경표는 찍는 것으로 끝나지 않고 **대조까지 해야 규율이 된다.**

#### §7 후속 — **정정: 반대 관측 4건은 동등한 증거가 아니다**

바로 위에서 나는 *"qa-rally 환경에서 `isMobile` 이 갈랐을 수 있다"* 고 여지를 남겼다. **그 여지를 철회한다.** 본인이 셀별 조건을 공개했고, **통제된 비교가 아니었다**:

| | 24회차(704) | 26~28회차(689) |
|---|---|---|
| `isMobile` | true | false |
| `deviceScaleFactor` | **2** | **1** |
| 서버 | **프로덕션** | **로컬 standalone** |
| 뷰포트 높이 | **1024** | **900** |

**네 변수가 동시에 달랐다.** `isMobile` 은 눈에 띄어 지목된 것이고 나머지 셋은 고정된 적이 없다 — 특히 `deviceScaleFactor` 는 스크롤바 렌더링에 관여할 여지가 `isMobile` 못지않다.

**정확한 기술은 이것이다:**

> `isMobile` 가설은 **4셀 통제 실험으로 반증됐다.** 반대 관측 4건은 **다변수 미통제 상관**이라 가설을 지지하는 증거로 쓸 수 없다. **`689` 의 원인은 미상이고 소급 확인이 불가능하다.**

**"두 환경이 갈렸다"로 남기지 않는 이유**: 그렇게 적으면 다음 사람이 30회차에서 `689` 를 만났을 때 **이미 반증된 `isMobile` 을 먼저 의심하며 시간을 쓴다.** 관측값 자체는 사실이지만 **그 관측이 지지한다고 여겨졌던 결론은 통제 실험이 이겼다.**

**이 건에서 남는 실질은 하나다** — `innerWidth − clientWidth` 를 **측정 행마다** 넣는 것. `689` 가 다시 나오면 그 한 칸이 스스로 진단한다.

### 사전 기준선 후속 2 — **내가 세운 게이트 2건 철회** (좌표 모델 판별에 따름)

리더가 전한 검증 결과로 **내가 30회차용으로 세워 둔 게이트 2건의 전제가 사라졌다. 철회한다.**

| 내가 세웠던 것 | 철회 사유 |
|---|---|
| *"렌더 전수에서 **`±5 m` 단독 표기 0건**"* | 요구 169 폐기. `±5 m` · `±13 m` · `북서단 ±5 / 남동단 ±13` 이 **전부 폐기 문자열**이 됐다. 새 (a) 추정은 **`≲ 7 m, 전역 균일`** 이고, 그 숫자도 렌더에 나오지 않는다(게시 표현은 `±20~30 m` 와 `근사 위치입니다`) |
| *"남동단 오차 ±13 m 가 화장실 거리 30 m 의 **43 %**"* | **계산의 전제가 거짓이었다.** 검증이 기준점에 쓰지 않은 사실 3건을 북서·중앙·남동에 놓고 잰 결과 **5.1 / 6.8 / 1.0 m** 로, 340 m 에 걸쳐 한쪽으로 커지지 않는다. **남동단이 오히려 가장 작다.** `43 %` 는 성립하지 않는다 |

**`±13 m` 는 "두 좌표 모델 중 어느 쪽인지 모른다"에서 나온 값이었고, POI 아이콘 원 16개의 종횡비로 아핀 모델이 13.1σ 기각되면서 그 근거가 소멸했다.**

**⚠ 다만 화장실 항목을 통째로 버리지 않는다.** **(b) 오차는 여전히 측정 불가**이고 게시 한계가 **`±20~30 m`** 다. **화장실 28.9 m 가 그 한계와 같은 크기라는 사실은 그대로다.** 질문을 바꿔 유지한다:

> **화장실 도트와 3구역 남동단이 "바로 옆"으로 읽히는데 실제 거리 28.9 m 가 게시 한계 `±20~30 m` 와 같은 크기다. 조합원이 그 붙어 보임을 정밀한 주장으로 오독하지 않는가** — `estimated` 파생(점선 도트·`shortdot` 테두리·`근사 위치` 문구)이 그것을 막는지가 판정 대상이다.

> **규율 적용**: 지표가 불안정하면 **그 지표에서 나온 과거 인용까지 함께 철회**한다. 검증자가 에지 정합 잔차 지표를 철회하며 `KDB 잔차 2.4 m` 인용도 같이 내린 것과 같은 처리다. 이번 세션에서 두 번 나왔다(내 25회차 종횡비 건 · 이번 건).

### 30회차 판정선 — **`8 px` 이 세 개다. 섞지 마라**

§30.14 를 읽고 확인했다. **이름이 같은 `8 px` 이 서로 다른 세 가지다.**

| # | 어디 | 무엇 | 미달 시 조치 |
|---|------|------|-------------|
| 1 | `LABEL_REVEAL_GAP = 8`(`RallyMap.tsx:937`) | **재노출** 임계(히스테리시스) | **겹침 판정과 무관.** 판정에 쓰지 않는다 |
| 2 | §21.2.3 "8px 미만이면 겹침" | **접기** 임계의 스펙 예산 — 구현은 **`0`** | **실패로 쓰지 않는다**(문서화된 후퇴). 경고로 기록 |
| 3 | **§30.15 "최소 여백이 8 px 아래로 내려간 쌍"** | **라벨 배치 여백 하한** | **디자이너에게 반송**(스펙이 명시한 조치). 실패가 아니라 **판정 요청**이다 |

**3번은 이번 회차에 새로 생긴 실행 조건이다.** 1·2번과 이름이 같아 섞이기 쉬우므로 리포트에 이 표를 붙여 둔다.

### 30회차 측정 순서 (확정 — §30.14 반영)

1. **축척** — 체크 310~314. **320 / 360 / 400 대 / 768 / 1280 + 125 % 확대**에서 전부 `100m`. **하나라도 `300m`·`50m` 면 즉시 실패이고 여기서 멈춘다** — 라벨 수치를 내지 않는다(다른 화면의 값이 기준선이 되는 것을 막는다). 280 px 의 `300m` 강등은 **알려진 제약으로 기록**(313).
2. `isPointInFill`/`isPointInStroke` 보유 노드 개수 확인 — 0이면 `<path d>` 파싱으로 우회.
3. **QA-316** — 라벨 사각형 5개 실측 × 4뷰포트, §30.4.4 표 대조(±4 px). **320 px 의 ④ pill 우측 13.4 px 부터** 본다(§30.15 지목).
4. 가림 전수(317) · 잘림·축척바·로고(318) · z15 접힘(319).
5. `my-location` 켠 상태 재측정 — 접힘 불가 라벨이 **3개**가 되는 조건(리더 승인 편입분).
6. 기호·대비(322~327) · 제거·정합(328~335).

### 사전 기준선 후속 3 — 축척은 **계약이 아니라 현행 지물 집합의 성질**이다 (리더 판정)

내가 *"코드에 막는 장치 없이 '지금 좌표에서는 안 걸린다'로만 성립한다면 그건 우연이지 계약이 아니다"* 로 확인을 요청했고, **리더가 그 판단을 인정했다.** 정확한 서술을 여기 남긴다.

| 방향 | 막는 것 | 성격 |
|---|---|---|
| **z17(50 m) 쪽** | **`FIT_MAX_ZOOM = 16`** (`RallyMap.tsx:116`) | **코드 계약.** 24회차 결함을 막은 실제 장치 |
| **z15(300 m) 쪽** | **없음** | **현행 지물 집합의 산술적 성질** — 화장실 포함 bbox 의 자연 줌이 **16.20** 이라 상한에 먼저 걸릴 뿐이다 |

- **`FIT_MIN_ZOOM` 은 신설하지 않는다**(리더 판정). 하한을 걸면 초과분이 화면 밖으로 잘리고, `fitBounds` 가 bbox 중심을 잡으므로 **잘리는 것이 3구역일 수 있다.** *"우리 자리를 못 보여 주는"* 실패는 300 m 축척보다 나쁘다. D-7 에 새 실패 모드를 들이는 비용도 크다.
- **§30.2.1 의 `두 방향 모두 막혔다`는 문면이 부정확하다** — 디자이너에게 정정이 지시됐다.
- **여유: 동쪽으로 약 61 m(13 %)** 추가하면 z15 로 떨어진다(리더 계산).
- **완화 수단은 두 가지뿐이다**: ① 코드에 여유를 숫자로 남기는 주석 ② **내 축척 검사(310~314)가 사실상의 강제 장치** — 회귀마다 돌아야 한다.

**30회차에 확인할 것 (구현본 기준. 리더 말과 구현이 다르면 구현이 사실이다):**

1. 디자이너/개발자가 **상수를 신설했는지, 배치로만 성립하는지**
2. **여유 `61 m` 주석이 실제로 코드에 있는지**
3. ★ **그 `61 m` 이 맞는 값인지 내가 독립 검산한다.** — 이 건의 완화가 *"주석에 적힌 숫자"* 하나로 되어 있다.
   **숫자가 틀리면 안전망 자체가 틀린 것**이고, 다음 사람은 그 숫자를 믿고 지물을 추가한다.
   `MAP_FIT_BOUNDS` 와 `FIT_PADDING`, 박스 치수에서 자연 줌을 역산해 **동쪽 여유를 미터로 다시 구한다.**

---

## 30회차 — **1·2차 시도 무효(프리즈 파기 2회)** · 판정 접수 기록 (2026-08-21)

**이 절은 판정이 아니다.** 측정이 두 번 무효가 된 경위와, 그 사이 확정된 스펙 판정을 기록해 재개 시 기준으로 쓴다.

### 1. 프리즈 파기 2회 — 시간선

| 시각 | 사건 | `BUILD_ID` |
|---|---|---|
| 14:30:40 | 내가 standalone 기동, 측정 시작 | `S6eOyVcb91hkTu5U3cjrF` |
| 14:31:08 / 14:32:14 / 14:34:19 | `rallyMap.ts` / `page.tsx` / `RallyMap.tsx` 수정 | — |
| 14:34:42 / 14:34:44 | `.next/static` · `BUILD_ID` 교체 · **내 서버 사망** | **`eLh5a9DocEOJoXVw2VRq3`** (**1차 파기**) |
| 14:35~14:40 | 재기동 · 정적자산 재복사 · 재측정 착수 | — |
| 14:41:15 / 14:41:18 | `page.tsx` 재수정 · 빌드 교체 · **내 서버 재사망** | **`z0ILBY8yme7zZq078QBdI`** (**2차 파기**) |

**1차 측정값 전부 폐기했다.** 6개 스크립트가 경계(14:34:42) 양쪽에 걸쳐 있어 어느 것이 어느 빌드인지 특정할 수 없다.
**부분 구제하지 않는다** — 살린 값은 다음 회차가 기준선으로 인용하고, 오염이 그대로 이월된다(§5.5).

> ⚠ **이 사고의 특히 나쁜 형태를 기록해 둔다.** 1차 때 `.next/static`(14:34:42)이 `server.js`(14:34:44)보다 **먼저** 갈렸다.
> 서버가 죽지 않는 타이밍이었다면 **구 빌드 서버 + 신 빌드 정적자산**이 섞인 채 측정이 계속됐을 것이고,
> **양쪽 다 정상으로 보이면서 조합만 틀리므로 `BUILD_ID` 대조로도 안 잡힌다.**
> → **정적자산 해시도 측정 전후로 찍는 것**을 §5.5 환경표에 추가할 값어치가 있다.

### 2. 내가 올린 스펙 충돌 3건 — **전부 "구현이 맞고 체크리스트가 낡았다"로 판정됐다**

| # | 내가 짚은 것 | 판정 |
|---|---|---|
| **312 ↔ 313 모순** | 312 는 125 % 확대(=288 px)에서 `100m` 를 요구하는데 313·§30.2.2 는 300 px 미만을 포기한 영역으로 둔다 | **스펙 모순 확인.** §30.19 로 **한 규칙으로 합쳐짐** — *"CSS 뷰포트 ≥ **312 px** → `100m`"*. **내 이분 탐색 실측값이 스펙이 됐다**(§30.2.2 하한 `300` → **`312`**). 새 312 는 *"확대가 리플로우로 동작하고 하한 규칙이 그대로 적용된다"* 의 검증이고 **125 %에서 100m 를 유지하려면 물리 뷰포트 ≥ 390 px** |
| **z15 에서 ④ 가 배지로 접힘** | 체크 319·§30.4.6 은 ④를 `primary` 로 전제 | **구현(`secondary`)이 맞다.** §30.16.2 가 바꿨고 체크리스트가 못 따라왔다. **z15 기대값 = 텍스트 pill 0개 · 배지 5개.** 개발자 자체 보고의 *"④ pill 만 남음"* 은 **그 배치 이전 값**이었다 |
| **체크 331 문구** | `약 30~100 m` 를 요구하나 `page.tsx` 주석은 폐기됐다고 적음 | **331 이 폐기 문자열을 요구하고 있었다.** 새 기대값은 **세 줄**: `지도에 표시한 공원 화장실까지` / `구역 뒤쪽 끝에서 약 30~60 m` / `무대3 쪽 끝에서는 약 170 m`. **`약 30~100 m` · `30~170` 은 렌더 0건이어야 한다** |

**추가 지시 1건**: §30.17.5 의 *"블록 2 산문 중 유일하게 굵은 문장"* 은 **문면이 부정확**하다(리드 문장이 `text-lead` 20 px/600 으로 이미 굵다). **구현은 지시대로이므로 이걸로 실패 판정하지 않는다.**

### 3. 재개 시 추가되는 게이트

| 게이트 | 내용 |
|---|---|
| **314-a** | `viewport` 메타에 **`maximum-scale`·`user-scalable=no` 금지.** 넣으면 핀치 줌 완화가 사라지고 **동시에 WCAG 1.4.4 위반**이 된다. **회귀 항목** |
| **314-b** | `FIT_PADDING` 이나 지물 집합이 바뀌면 **이분 탐색을 다시 돌린다.** ⚠ 디자이너가 남긴 경험 보정 `박스 폭 ≈ 도형 폭 + 가로 패딩 + 12px` 의 **12 px 은 기전 불명·관측점 1개**다 — **다른 조건에 갖다 쓰지 마라** |
| **요구 191** | 블록 2 산문에 **`여의도 의사당대로`** 렌더 |

**⚠ 축척 검사가 사실상의 강제 장치다** — `FIT_MIN_ZOOM` 이 없으므로(「후속 3」) 310~314 가 회귀마다 돌아야 한다.

### 4. 서버 없이 확인한 것 2건 (소스 기준 · 빌드와 무관)

| 항목 | 결과 |
|---|---|
| **314-a** | **`src/` 전수에서 `viewport` 재정의 0건** · `maximum-scale`·`user-scalable` **0건** · `layout.tsx` 에 `viewport` export 없음 → Next.js 기본값(`width=device-width, initial-scale=1`)이 나가고 **핀치 줌이 막혀 있지 않다.** 리더 확인과 일치 ✅ |
| **요구 191** | ★ **이미 반영돼 있다.** `page.tsx:267` 이 주석이 아니라 **렌더되는 `<p>`** 이고 내용이 `국회의사당역 5번 출구에서 여의도 의사당대로를 따라 남동쪽으로 약 250~400 m` 다. `page.tsx` mtime **14:41:15** — **2차 파기를 일으킨 그 수정이 이것**이다 |

> **리더에게 정정 보고함**: *"`여의도` 낱말은 아직 미반영"* 은 **한 편집 주기 전 정보**다. 남은 것은 `eslint.config.mjs` 쪽 1건으로 보인다.

### 5. 재개 조건 (리더 합의)

```
개발자 잔여 반영 → tsc·build → 보고 → src/ 동결
  ↓
리더가 "동결 확정" 통보
  ↓
QA 가 BUILD_ID + 소스 3파일 해시(+정적자산) 기록 후 측정 시작
  ↓
측정 후 재대조. 불일치 시 그 회차 통째 폐기(부분 채택 없음)
```

**측정 순서는 §30.14 반영본을 그대로 쓴다** — ① 축척(310~314·314-a) → ② `isPointInFill` 노드 확인 → ③ QA-316 라벨 사각형 → ④ 가림·잘림·z15 → ⑤ `my-location` 클램프 → ⑥ 기호·대비 → ⑦ 제거·정합·요구 191.

---

# QA 리포트: 30회차 — 3구역 지도 반영 (2026-08-21) · **3차 시도(유효)**

**대상:** `rallyMap.ts` `988038e3809e8ca1` · `RallyMap.tsx` `12e380a10ceb5575` · `page.tsx` `0d89991a6e99e2ba` · `eslint.config.mjs` `1b3927528de6fb0a`
**판정 근거:** §30.14 체크리스트 310~335(§30.19.6 교체본) + 리더 확정 판정 + 추가 게이트 314-a/b · 요구 191

## 요약: 통과 **31** | 실패 **0** | 경고 **1** | 기록 **4** | 미검증 **3** → **배포 판정: 통과**

### 측정 환경 (§5.5 — 정적자산 해시 항목 신설 첫 적용)

| 항목 | 측정 전 (14:47:30) | **측정 후 (14:57:06)** |
|---|---|---|
| `BUILD_ID` | `pTrFeUvhVlIo6KtN05Hgd` | **동일** |
| `rallyMap.ts` / `RallyMap.tsx` / `page.tsx` / `eslint.config.mjs` | `988038e3` / `12e380a1` / `0d89991a` / `1b392752` | **4종 전부 동일** |
| **정적자산 전체 해시** ★신설 | `0a533d6d03395fde` | **동일** |
| 서빙 | standalone `localhost:3000` (`next start` 미사용) · 정적자산 **10건 전수 200** · CSS **32,091 B** | |
| `innerWidth − clientWidth` | 모바일 컨텍스트 **0** / 데스크톱(768·1280) **15** — 행마다 기록 | |
| 프로덕션 코드 수정 | **0** | |

> **1·2차 시도는 프리즈 파기로 폐기**했다(경위는 앞 절). 이번 회차가 유일하게 유효한 측정이다.

---

## 1. 축척 (310~314 · §30.19.6) — 통과

| 뷰포트 | 스크롤바 | 박스 | 종횡비 | **축척** | pill/배지 | 가로넘침 |
|---|---|---|---|---|---|---|
| **320** | 0 | 288×360 | 0.8 **CSS-OK** | **100m** | 3/2 | 0 |
| **360** | 0 | 328×410 | 0.8 **CSS-OK** | **100m** | 3/2 | 0 |
| **400** | 0 | 368×460 | 0.8 **CSS-OK** | **100m** | 3/2 | 0 |
| **412** | 0 | 380×475 | 0.8 **CSS-OK** | **100m** | 3/2 | 0 |
| **768** | **15** | 689×387.6 | 1.7778 **CSS-OK** | **100m** | 3/2 | 0 |
| **1280** | **15** | 896×504 | 1.7778 **CSS-OK** | **100m** | 3/2 | 0 |

**첫 줄 검산 `328 × 410` 충족**(360px). **320px 100m** — `FIT_PADDING` 교체 효과 확인.

### 313 · 314-b — 하한 재검증

**`FIT_PADDING` 이 `{top 52, right 20, bottom 76, left 32}` 로 바뀌었다**(종전 `{48,24,48,56}`) → **314-b 발동 조건 충족**이라 이분 탐색을 다시 돌렸다.

| 뷰포트 | 288 | 292 | 296 | 300 | 304 | 308 | **312** | 316 | 320 |
|---|---|---|---|---|---|---|---|---|---|
| 축척 | 300m | 300m | 300m | 300m | 300m | **300m** | **100m** | 100m | 100m |

**하한 `312px` 불변**(§30.19 스펙값과 일치). 경계 **308 = 300m / 312 = 100m**.
312px 미만에서는 pill 0 · 배지 5 로 접힌다 — **알려진 제약으로 기록**(313).

### 312 — 리플로우 확대

**핀치 줌으로 재지 않았다**(레이아웃 뷰포트 불변이라 무의미). 리플로우 기준:
- 물리 **360px** × 125 % = 실효 **288px** → **300m**(하한 밖 — §30.19 규칙대로)
- 물리 **400px** × 125 % = 실효 **320px** → **100m** ✅ (위 표 320px 행)

**§30.19 의 *"125 %에서 100m 를 유지하려면 물리 뷰포트 ≥ 390px"* 이 실측과 일치한다.**

### 314-a — `viewport` 메타

`src/` 전수 **`viewport` 재정의 0건** · `maximum-scale`·`user-scalable` **0건** · `layout.tsx` `viewport` export 없음 → **핀치 줌 완화 ①의 전제 유지** ✅

---

## 2. 라벨 (315~321) — 통과. **QA-316 이 §30.4.4 표를 확정한다**

**315**: 텍스트 pill **3개**(②③④) · 번호 배지 **2개**(①⑤) · 총 번호 5 ✅

### 316 — 라벨 사각형 실측 (박스 기준, 겹침·잘림 전수)

| 라벨 | 종류 | 크기 | 320px 위치(x,y) | 360px 위치 |
|---|---|---|---|---|
| ① `①` | 배지 | 28×28 | 30, 101 | 50, 126 |
| ② `②무대 1(예정)` | pill | **119.5×34** | 24.2, 25 | 44.2, 50 |
| ③ `③무대3(예정)` | pill | **118.5×34** | 20.5, 171 | 40.5, 196 |
| ④ `④코스콤지부 3구역(예정)` | pill | **186.9×34** | 88.5, 277 | 108.5, 302 |
| ⑤ `⑤` | 배지 | 28×28 | 244, 201 | 264, 226 |

| 뷰포트 | **최소 박스 여백** | 어느 라벨 | 잘림 | 겹침 |
|---|---|---|---|---|
| **320** | **12.5** | ④ pill 우측 | 0 | **0** |
| 360 | 32.5 | ④ pill 우측 | 0 | 0 |
| 400 | 52.5 | ④ pill 우측 | 0 | 0 |
| 768 | 45 | ① 상단 | 0 | 0 |
| 1280 | 103 | ④ pill 우측 | 0 | 0 |

- **★ 320px ④ pill 우측 = `12.5px`.** 디자이너 모델 **11.5px** 대비 **+1.0px** → **허용 ±4px 이내** ✅ 개발자 실측(12.5)과 일치.
- **최소 여백이 8px 아래로 내려간 쌍 0건 → 디자이너 반송 없음**(§30.15).
- 최소 라벨 쌍간격 **42.0px**(①×②, ①×③), 다음 48 · 72 · 105 — 4뷰포트 동일.

**317 가림 픽셀 전수**(`isPointInStroke`/`isPointInFill` 1px 격자 · bbox 미사용):

| 도형 | 본선 픽셀 | 면 픽셀 | **가림** |
|---|---|---|---|
| **④ 3구역 밴드**(61×72 · `#093389` · dash 1/6 · fill α.14) | 1255 / 91 | 1500 | **0 % (1급 충족)** ✅ |
| ② 근사 원(86×86 회색) | 1664 / 593 | 5812 | ① 배지가 본선 **7.45~9.56 %** · 면 **8.04~8.31 %** — **호 일부 가림 허용** |
| ③ 근사 원(32×32 회색) | 555 / 213 | 802 | **0** |
| ⑤ 점선 도트(20×20) | 250 / 87 | 316 | **0** |

**318**: 박스 밖 잘림 **0** · 축척 바·NAVER 로고와 라벨 교차 **0건** — 4뷰포트 ✅
**319 z15**: **텍스트 pill 0 · 배지 5** — 리더 확정 기대값과 일치 ✅ 최소 쌍간격 **14.21px** · 겹침 0 · 최소 박스 여백 80 · 밴드 61×72 → **30×36**
**히스테리시스 왕복**(z16 → z15 → `처음 위치로` → z16): 라벨 좌표·여백 **초기와 완전 동일**, 드리프트 0 ✅
**320**: `②무대 1(예정)`(띄어쓰기 있음) / `③무대3(예정)`(없음) — **불일치가 원문 그대로 유지** ✅
**321**: pill 3개 전부 **1줄**(`Range.getClientRects().length = 1`) — **320px 포함** ✅

> ⚠ **정정**: 초기 측정에서 `높이 ÷ line-height` 로 계산해 "2줄"이 나왔으나 **패딩을 빼지 않은 잘못된 지표**였다. `Range` 기준으로 다시 재니 1줄이다.

---

## 3. 기호·대비 (322~327) — 통과. **322 는 첫 측정이 틀렸다**

### 322 — 밴드 대비

| 대상 | 실측 | 기준 | 판정 |
|---|---|---|---|
| **테두리 ↔ 인접 픽셀** | **3.691** (가장 어두운 점 픽셀 기준 **9.581**) | ≥ 3 : 1 | ✅ |
| **밴드 안쪽 ↔ 인접** | **1.290**(짝 표본 평균) | 1.28~1.30 | ✅ |

> ★ **첫 측정에서 1.138 이 나와 미달로 보였다. 그것은 측정 설계 오류였다.**
> 안쪽·바깥쪽 표본을 **서로 다른 타일 배경 위에서** 뽑아 밴드 효과와 타일 색 변화가 섞였다.
> **경계 법선 ±5/7/9px 짝 표본**으로 다시 재고 이론값과 대조해 확정했다:
> - α .14 `#093389` 합성의 이론 대비는 배경과 무관하게 **1.275~1.294** (흰 1.294 / 실측 인접 1.282 / 회색 도로 1.275)
> - 실측 합성 픽셀 **(221, 226, 238)** = 이론 합성값과 **정확히 일치**
> **α 값이 스펙대로다.** (§5.5 — 구현을 의심하기 전에 측정 조건을 본다)

**323**: 밴드 테두리 `stroke-dasharray 1px, 6px` · 육안 **점 패턴** ✅
**324 ⑤ 점선 도트**: 링을 0.25° 간격 1440회 샘플 → **점 정확히 10개** · 길이 균등도 **0.90** · 시작각 간격 **140~148**(기대 144) · 중심 픽셀 **흰색(속 빔)** · CSS 반지름 **9.83**(≈ r10) ✅
**① 확인 도트와 구분**: ① = **꽉 찬 파란 원**, ⑤ = **속 빈 점선 링** — 육안 확인 ✅
**325**: 범례 글리프 `◌⑤ 공원 화장실` — **두부(□) 아님** ✅
**326 ③ 원 ↔ ④ 밴드 z-order**: ★ **육안으로는 원이 밴드 위로 보였으나 픽셀이 반대를 말한다.**
밴드 위 회색 대시 **(66.4, 80.3, 104.2)** ↔ 밴드 밖 회색 대시 **(75.0, 85.0, 99.0)**.
이론 합성값(밴드 α.14 가 회색 위) **(65.8, 80.2, 104.3)** 과 **거리 0.8** → **밴드가 위에 그려진다** ✅
회색이 비쳐 보이는 것은 **fill α 0.14 가 반투명이기 때문**이지 z-order 결함이 아니다.
**327 색 문법**: 파랑 = **①④⑤**(갈 곳) · 회색 = **②③**(무대) — 뒤바뀜 0 ✅

---

## 4. 제거·정합 (328~335 · 191) — 통과

| # | 항목 | 실측 |
|---|---|---|
| 328 | `여의도공원 입구` · `PARK_ENTRANCE` | **실코드 0건** ✅ |
| 329 | `확인 중` · `논의 중` | 렌더 **0건** ✅ (빈 `<p>` 1건은 아래 기록 2) |
| 330 | 팝업 5개 | **전부 Enter 로 열림** · 박스 안(`inside`) · 포커스 팝업 안 · `aria-hidden` **null** · Esc 로 닫히고 **연 마커로 복귀**. 본문이 범례 행에서 파생됨(문자열 일치 확인). `aria-label` = `① 5번 출구` / `② 무대 1(예정)` / `③ 무대3(예정)` / `④ 코스콤지부 3구역(예정)` / `⑤ 공원 화장실` ✅ |
| 331 | 화장실 거리 줄 | **세 줄** — `지도에 표시한 공원 화장실까지` / `구역 뒤쪽 끝에서 **약 30~60 m**` / `무대3 쪽 끝에서는 **약 170 m**`. **`<strong>` 0 · `<br>` 0 · 가운뎃점 0 · 굵은 것은 `font-semibold` 수치 2개뿐 · 줄 사이 여백 0**(안쪽 span 에 mt 없음) · 각 줄 **1줄**. **`약 30~100 m` 0건 · `30~170` 0건** ✅ 카드에 `2호(개나리)` 원문 표기 **유지** ✅ |
| 332 | 교통 안내 | `WayfindingBlock.tsx` · `routes.ts` **diff 0줄** ✅ `네이버 지도로 길찾기` **2곳** |
| 333 | 지도 번호 인용 문자열 | **0건** ✅ |
| 334 | 범례 | **5행 + 키 줄 1개**(`실선 = 확인된 위치 · 점선 = 근사 · 옅은 면 = 범위 근사`) · **각주 없음** · 접기·`sr-only` 0 ✅ |
| 335 | 빌드 | `npx tsc --noEmit` **0** · `npm run lint` **출력 0**(`eslint.config.mjs` 반영분 포함) · `npm run build` **성공** ✅ |
| **191** | 블록 2 산문 | **`국회의사당역 5번 출구에서 여의도 의사당대로를 따라 남동쪽으로 약 250~400 m`** 렌더 확인 ✅ (HTML 2건 중 1건은 RSC 직렬화본, 실렌더 1곳) |
| — | `<dl>` 장소 행 | `국회의사당역 5번 출구 메인무대 앞` — **무수정 유지** ✅ (`여의도` 안 들어감) |
| — | 번호 재부여 3자 일치 | 지도 배지 `①②③④⑤` = 범례 `①②③④⑤` = 팝업 제목 — **전부 일치** ✅ |

---

## 5. `my-location` 클램프 — 통과 (경고 1건 동반)

모킹 좌표 **`37.525851, 126.920454`**(3구역 남동단) · `permissions: ['geolocation']`

| 항목 | 실측 |
|---|---|
| 라벨 수 | **6개**(기존 5 + `my-location`) |
| `my-location` pill | **68.5 × 29.5**, 박스 우측 여백 **4.0** |
| **박스 밖 이탈** | **0 — 클램프 작동** ✅ (클램프 없으면 개발자 실측 23.5px 이탈) |
| 잘림 | **0** |
| **겹침** | **0** |
| 상태 문구 | `내 위치를 지도에 표시했습니다. 집결 위치에서 남동 약 390m` |

> **pill 폭**: 모델 58.9 → **실측 68.5px**(+9.6). `my-location` 은 내용이 런타임에 정해지는 유일한 라벨이라 모델이 가변분을 못 잡는다. **실측이 참값이다**(리더 지시대로).

### ⚠ 경고 1건 — `zone3 × my-location` 최소 쌍간격 **5.2px**

**겹치지 않으므로 실패가 아니다**(판정선: 실패 = 실교차 > 0px). **8px 미만이므로 경고**로 기록한다.
- 이 조합은 **접힘 불가 라벨 2개가 동시에 뜨는 유일한 경우**다(`my-location` = `textMode:"always"` + `badge===null`).
- **디자이너 반송 대상은 아니다** — §30.15 의 8px 하한은 **디자이너가 배치를 계산한 5개 정적 라벨**에 대한 것이고, `my-location` 은 사용자 위치에 따라 어디든 설 수 있어 배치표에 없다.
- **다만 이 5.2px 은 "3구역 남동단에 선 조합원"이라는 현실적인 위치에서 나온 값이다.** 좌표가 조금만 달라지면 겹칠 수 있다. **3단계-B/후속에서 볼 항목으로 남긴다.**

---

## 6. 화장실 ↔ 3구역 남동단 (내가 세운 항목) — 육안 판정: **오도 아님**

| 지표 | 값 |
|---|---|
| ⑤ 도트 ↔ ④ 밴드 **bbox 모서리 간격** | **5.0px** |
| 중심 간 거리 | 53.4px |
| 실제 거리 | **28.9 m** (게시 한계 `±20~30 m` 와 같은 크기) |

⚠ **bbox 값은 참고만 한다** — 밴드가 대각선이라 축정렬 bbox 는 실제보다 가깝게 나온다(§22 규칙).

**육안 판정**: ⑤ 도트는 밴드 남동단 **바깥·아래쪽에 뚜렷이 떨어져** 있고, 흰 casing 과 여백이 둘을 가른다. **"구역에 붙어 있다"로 읽히지 않는다.**
그리고 **`estimated` 파생 3종이 전부 작동한다** — 밴드는 **점선 테두리 + 옅은 면**, ⑤ 는 **속 빈 점선 링**, 범례가 *"근사 구간이라 실제 경계와 다를 수 있습니다"* · *"지도 데이터 기준 위치라 실제와 다를 수 있습니다"* 를 문자로 말한다.
→ **정밀한 주장으로 오독될 구조가 아니다.** 판정: **통과**.

---

## 기록 4건 (실패 아님)

| # | 내용 |
|---|---|
| **1** | **빈 `<p>` 1건은 설계다.** `RallyMap.tsx:2081` `<div role="status">` 안의 지오로케이션 상태 라이브 영역이고 idle 에 비어 있다(높이 0). **체크 329 의 "빈 `<p>` 도 없다"는 `LEGEND_FOOTNOTE` 제거 잔여물을 겨냥한 문구**이고, 문면대로 적용하면 **의도된 접근성 구조를 깨게 된다**. 범례(`figcaption`) 안의 빈 `<p>` 는 **0건**이다 — 329 의 실질은 충족 |
| **2** | **③ pill 이 자기 도형에서 멀다.** ③ 무대3 원은 밴드 북서단 근처(32×32)인데 pill 은 박스 좌측(x 40.5~159, 360px)에 있다. `§30.4.3` 이 `left` 배치를 판정한 결과이고 **겹침·가림은 0** 이지만, 육안으로 *"③ 라벨이 어느 도형을 가리키는가"* 가 다른 라벨보다 약하다. **배지 번호가 대응을 지므로 결함으로 올리지 않는다** |
| **3** | **768px 박스 폭이 스크롤바에 따라 갈린다.** 이번 실행에서 데스크톱 컨텍스트 `innerWidth − clientWidth = 15` → 박스 **689×387.6**. 오버레이 스크롤바 환경에서는 **704×396** 이다. **축척·종횡비·잘림 판정은 두 값 모두에서 동일**하다. §5.5 환경표에 스크롤바 폭을 행마다 적어 두면 다음 사람이 헤매지 않는다 |
| **4** | **`FIT_PADDING` 이 `{52,20,76,32}` 로 바뀌었다**(§30.3 재유도). **314-b 발동 조건**이라 이분 탐색을 다시 돌렸고 **하한 312px 은 불변**이었다. 다음에 이 상수나 지물 집합이 바뀌면 **또 돌려야 한다** |

## 미검증 3건

| # | 항목 | 사유 |
|---|---|---|
| **1** | **체크 314 의 확대 상한**(`100m → 50m → 30m → 20m(z19)`) | 이번 회차는 **축소 1단(z15 = 300m)만** 확인했다. 확대 방향은 29회차에 `100m → 50m → 100m` 왕복을 확인했으나 **z19 까지 올린 것은 이번에도 29회차에도 아니다.** `FIT_MAX_ZOOM`(16) 과 `MAP_MAX_ZOOM`(19)이 합쳐지지 않았음을 확인하려면 **z19 까지 4단 올려야 한다** |
| **2** | **`FIT_MIN_ZOOM` 부재의 "동쪽 여유 61 m"** | 내가 검산하겠다고 했으나 **fitBounds 산술을 충분히 재현하지 못했다.** 소스에서 좌표를 두 방식으로 뽑아 자연 줌을 계산했는데 **관측된 경계(308px = 300m / 312px = 100m)를 재현하지 못했다**(내 모델은 경계를 320~360px 사이로 예측). 원인은 `MAP_FIT_BOUNDS` 가 항목별 bounds 합집합이고 원은 자기 중심에서만 확장되는데 내 근사가 그것을 뭉갠 것이다. **재현 못 한 모델로 나온 여유값(65.3 m / 331.9 m)은 쓰지 않는다.** → **개발자·디자이너가 그 숫자를 코드 주석에 남길 때 유도 과정을 함께 적어 달라.** 지금은 그 숫자가 `FIT_MIN_ZOOM` 부재의 **유일한 안전망**인데 **제3자가 재계산으로 확인할 수 없다** |
| **3** | 실기기 터치 제스처 · 실기기 스크린리더 | Chromium 기기 에뮬레이션 + CDP 이벤트로 재현했을 뿐. 28회차부터 이어지는 동일 항목 |

---

## 정리

- 서버: **내가 standalone 으로 기동하고 PID 지정으로 정지**했다. 포트 3000 비어 있다.
- 임시 산출물 `.playwright-mcp/` **삭제함** — 그와 함께 `eslint` 도구 산출물 경고도 사라진다.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

## **배포 판정: 통과.**

**단, 배포 전 확인 1건**: **미검증 1(체크 314 확대 상한 z19)** 은 체크리스트에 있는 항목이다. **내가 재려면 5분이면 된다** — 배포 전에 돌릴지 리더가 판단해 달라. 나머지 두 미검증은 배포를 막는 성질이 아니다.

### 30회차 보론 — **체크 314 확대 상한 실측** (리더 지시 · 배포 전 추가 측정)

**미검증 1 을 해소한다.** 동결 유지 상태에서 추가로 쟀다 — `BUILD_ID pTrFeUvhVlIo6KtN05Hgd` · 소스 4종 · **정적자산 해시 `0a533d6d03395fde`** 측정 전후 동일.

**360px · 1280px 두 뷰포트에서 사다리가 완전히 동일하다:**

| 단계 | 축척 | pill/배지 | `확대` | `축소` |
|---|---|---|---|---|
| **초기** | **100m** | 3/2 | 활성 | 활성 |
| 확대 1 | **50m** | 3/2 | 활성 | 활성 |
| 확대 2 | **30m** | 3/2 | 활성 | 활성 |
| **확대 3** | **20m** | 3/2 | **비활성** | 활성 |
| 확대 4 시도 | **20m 유지** | 3/2 | 비활성 | 활성 |
| 축소 1~3 | 30m → 50m → **100m** | 3/2 | 활성 | 활성 |
| **축소 4** | **300m** | **0/5** | 활성 | **비활성** |
| 축소 5 시도 | **300m 유지** | 0/5 | 활성 | 비활성 |
| **`처음 위치로`** | **100m 복귀** | 3/2 | 활성 | 활성 |

**판정: 체크 314 통과.**

- **`100m → 50m → 30m → 20m`** 4단계가 스펙 그대로다.
- **`FIT_MAX_ZOOM`(16)과 `MAP_MAX_ZOOM`(19)이 합쳐지지 않았다** — 초기 화면은 z16(100m)인데 `확대` 로 **z19(20m)까지 간다.** 두 상수가 합쳐졌다면 초기 100m 에서 더 확대되지 않았을 것이다.
- **양 끝에서 버튼이 `disabled` 로 잠긴다** — z19 에서 `확대`, z15(`MAP_MIN_ZOOM`)에서 `축소`. **더 눌러도 축척이 변하지 않는다**(비활성 상태로 재확인). 죽은 버튼이 아니라 **상태가 문면으로 드러난다.**
- 라벨 상태가 줌과 정합적이다 — z16~z19 는 pill 3 · 배지 2, **z15 만 pill 0 · 배지 5**(§30.16.2 `secondary` 판정과 일치).

> ⚠ **첫 시도는 내 스크립트가 z19 에서 멈췄다** — `확대` 가 `disabled` 인데 계속 클릭을 시도해 타임아웃이 났다. **그 실패 자체가 상한이 실제로 잠긴다는 증거**이지만, 판정은 **비활성 여부를 먼저 읽고 누르는** 방식으로 다시 재서 냈다.

**→ 30회차 미검증 3건 중 1건 해소. 남은 미검증은 `61 m` 여유 검산과 실기기 터치·스크린리더 2건이다.**

---

## 30회차 경고 1건 종결 + 다음 회차(3단계-B) 준비 기록 (2026-08-21)

### 1. `zone3 × my-location` 5.2px — **종결. 다시 올리지 않는다**

디자이너 §32 판정 · 리더 승인. **조치 없음.** 근거 요약: 구분자 4겹(번호 배지 유무 · 테두리 점선/실선 · 폭 3.2배 · 앵커 도형)으로 혼동 경로가 없고, **이 조합이 뜨는 순간이 곧 "조합원이 3구역 안에 서 있다"는 정보**라 근접이 오독이 아니다. 어느 방향으로 밀어도 다른 위치를 깨고(위 → ⑤ 배지 9.3px / 아래 → 지도 크롬), 조합원이 `+`·`−` 로 양방향 해소할 수 있다.

| 지시 | 내용 |
|---|---|
| **373 [종결]** | 5.2px 은 **판정 완료된 허용 상태.** 다음 회차에 **경고로 다시 올리지 않는다** |
| **374 [승격 조건]** | **실교차(겹침 > 0px) 관측 시 즉시 올린다.** 유일한 재개 조건 |
| **375 [분리]** | ⚠ **박스 경계 클램프(§30.17.8-351)는 별개 항목이다. 373 과 함께 닫지 않는다** |

> ⚠ **374 를 실행 가능하게 만들려면 측정 설계를 바꿔야 한다.** 내 5.2px 은 **모킹 좌표 1점**(`37.525851, 126.920454`)에서 나온 값이다.
> `my-location` 은 사용자 위치에 따라 어디든 서므로 **한 점만 재면 "겹침이 없다"를 말할 수 없다.**
> → 다음 회차부터 **대표 위치 4~5점**(3구역 남동단·북서단 · 5번 출구 · 무대3 옆 · 공원 화장실 옆)에서 재고, **그중 최소 간격**을 기록한다. 그래야 374 의 "실교차 관측"이 우연이 아니라 절차가 된다.

### 2. 다음 회차 — 3단계-B(전체 화면 지도) 준비

`STAGE3B_FULLSCREEN_MAP = true` 복원. **실패로 올리지 말아야 할 것 2건을 미리 기록한다:**

| | 내용 |
|---|---|
| **범례 5행이 모달에 없는 것** | **의도**(체크 364). 팝업이 `feature.legend` 에서 파생돼 5행이 전부 도달 가능하고, **`LEGEND_KEY` 만 소유 feature 가 없어 어느 팝업에도 안 나온다** → **키 줄만** 넣는다 |
| **모달에서 축척이 안 올라가는 것** | **설계 판정.** 모달 360×602 → 가용 308×474 인데 z17 은 폭 483.6px 를 요구해 안 들어간다. **z16 유지가 정상**이고 늘어나는 것은 도형 크기가 아니라 **맥락·조작 여유**(면적 1.61배) |

**볼 것**: ① 모달 축척 100m(3뷰포트 · **1280×900 에서 실제로 z17 을 깎는지**) ② `LEGEND_KEY` **전문 그대로**(축약판이면 실패) ③ 컨트롤 행 4개·**2행 유지**·DOM 순서(`지도 크게 보기` 1행 / `로드뷰 보기` 2행 — 같은 행이면 실패) ④ 어포던스 문구가 **오버레이가 아니라 하단 바** ⑤ 모달 키보드·포커스·Esc·스크롤 복원(28회차 회귀) ⑥ **주석 부채 2건 정리**(`:1287` · `:1794~1796` — 내가 29회차에 올린 것) ⑦ 문안 게이트 56 개정본.

**⚠ 문자열 게이트는 렌더 DOM `innerText` 로만 판정한다** — 최종 게이트 §J-3 이 `WAYFINDING.station` 보간 문장에서 **SSR 이 `<!-- -->` 로 쪼개 grep 대조가 안 된다**고 보고했다. SSR HTML 을 `grep` 하는 경로는 **보간 문장에서 조용히 통과한다.**

### 374 측정 설계 확정 — 대표 5점 (리더 승인) · **`5번 출구` 는 특히 조심해서 잰다**

| 위치 | 왜 | 모델 예측 |
|---|---|---|
| 3구역 **남동단** | 30회차에 5.2px 이 나온 점 | — (실측 기준점) |
| 3구역 **북서단** | 반대 끝 · ③ 무대3 pill 과의 관계 | — |
| **5번 출구** | **당일 가장 흔한 위치.** ① 배지와 겹칠 수 있는 유일한 지점 | **§30.16.3 이 "겹침 0 · 54px 여유"로 계산 기각** |
| **무대3 옆** | ③ 원 + ④ 밴드가 동시에 가까움 | — |
| **공원 화장실 옆** | ⑤ 배지(현재 9.3px)와의 관계 | — |

**★ `5번 출구` 는 모델이 "안전"이라고 판정한 유일한 지점이고, 그 계산이 `pill 폭 58.9px` 을 썼다. 30회차 실측은 `68.5px`(**+9.6**)다.**
**→ 54px 여유가 실제로는 약 44px 다.** 여전히 여유가 있어 보이지만 **검증된 적이 없는 숫자**다.

⚠ **"모델이 안전하다고 했으니 확인만 한다"로 접근하지 않는다.** 이 라운드에서 **같은 pill 폭 모델이 이미 한 번 틀렸다** — 클램프 이탈 예측 13.9px, 실측 **23.5px**. 원인이 바로 이 폭이었다.

**배치 확인(구현 중 소스 기준 · 동결 후 재확인)**: `exit5` = `placement: "left"`(`rallyMap.ts:401`) · `my-location` = `placement: "right"`(`:702`) — 디자이너가 근거로 든 **좌우 분리 구조 자체는 소스에서 확인**된다. 남는 것은 **그 분리가 만드는 실제 간격**이다.

> **일반 규칙(리더 승격 검토 중)**: **런타임에 위치가 정해지는 요소는 한 점이 아니라 표본 집합으로 잰다. 한 점 측정은 그 점에 대해서만 말한다.**
> 현재 그 성질을 가진 라벨은 `my-location` 하나뿐이지만, 같은 성질이 생기면 같은 규율이 필요하다.

---

# QA 리포트: 30-B회차 — 3단계-B 전체 화면 지도 복원 (2026-08-21)

**대상:** `RallyMap.tsx` `e40da6fa7d8cad48`(유일 변경) · `rallyMap.ts` `988038e3809e8ca1` · `page.tsx` `50fb403d5145a5d4` · `eslint.config.mjs` `1b3927528de6fb0a`

## 요약: 통과 **21** | **실패 1** | 기록 3 | 미검증 1 → **배포 판정: 조건부**

**3단계-B(모달) 자체는 전건 통과다. 실패 1건은 페이지 쪽이고, 5점 측정으로 처음 드러난 기존 결함이다.**

### 측정 환경 (프리즈 완전 유지)

| 항목 | 전 (15:43:50) | **후 (15:50:43)** |
|---|---|---|
| `BUILD_ID` | `hP2osMZPzOdaYEUP7HtUc` | **동일** |
| 소스 4종 해시 | `e40da6fa` / `988038e3` / `50fb403d` / `1b392752` | **전부 동일** |
| **정적자산 전체 해시** | `8d2bab88b04b5851` | **동일** |
| 정적자산 | 10건 전수 200 · CSS 31,940 B | |
| 프로덕션 코드 수정 | **0** | |

---

## ★ 실패 1 — `내 위치` pill 이 **⑤ 공원 화장실 배지를 덮어 팝업이 열리지 않는다**

**374(승격 조건: 실교차 관측 시 즉시 보고)가 발동했다.** 5점 측정에서 **2점이 실교차**다.

| 측정 지점 | `my-location` 최소 쌍 | **겹침** | ⑤ 가림률 | ⑤ **도달 가능 면적** | ⑤ 중심 탭 → | **⑤ 탭 결과** |
|---|---|---|---|---|---|---|
| 3구역 남동단 | `zone3` **5.2px** | 없음 | — | — | — | — |
| **3구역 북서단** | **`park-toilet` 0px** | **470.4 px²** | **59.8 %** | **42.9 %** | **`my-location` 이 가로챈다** | **★ 팝업 안 열림** |
| 5번 출구 | `stage3` 41.2px (`exit5` **54.0px**) | 없음 | — | — | — | — |
| **무대3 옆** | **`park-toilet` 0px** | **274.4 px²** | **34.8 %** | 64.3 % | `park-toilet` | ⑤ 팝업 열림 |
| 화장실 옆 | `zone3` **7.2px** | 없음 | — | — | — | — |

**위치**: `RallyMap.tsx` — `my-location` pill 렌더(라벨 배치 경로) ↔ `rallyMap.ts:698~702` `myLocationFeature`(`placement: "right"`)
**실측**: 360×800 · `geolocation` 모킹 · 지도를 뷰포트 중앙으로 스크롤한 뒤 `elementFromPoint` 2px 격자

### 왜 실패인가 — **시각 가림이 아니라 조작 차단이다**

- **3구역 북서단에서 조합원이 ⑤ 를 눌러도 화장실 팝업이 열리지 않는다.** `my-location` pill 이 히트 영역을 가로챈다(중심 탭 → `my-location`, 탭 결과 **팝업 `null`**).
- 육안으로도 **⑤ 의 번호가 보이지 않는다**(pill 뒤로 59.8 % 가림). 증거 스크린샷 확보.
- **373(종결)과 다른 쌍이다.** 373 은 `zone3 × my-location` 이고 이것은 **`park-toilet × my-location`** 이다. 375 가 *"별개 항목을 함께 닫지 마라"* 고 한 것과 같은 구분이다.
- **화장실은 §18-9 가 "1개 표시"로 승인한 항목**이고, 조합원이 현장에서 찾는 정보다. **그것을 못 여는 상태**다.

### 수정 방향 (개발자·디자이너 판단 사항)

`my-location` 은 **박스 경계 클램프는 있으나 다른 라벨과의 충돌 회피가 없다.** 후보:
1. `my-location` pill 에 **다른 라벨 회피 로직**(기존 `foldedRef`/겹침 판정 경로 재사용)
2. `my-location` **z-order 를 낮춰** 최소한 히트를 가로채지 않게 (시각 가림은 남음)
3. 겹칠 때 `my-location` 을 **`placement` 반대편으로 뒤집기**

> ⚠ **1·3 은 §32 판정(*"근접이 정보다"*)과 충돌하지 않는다** — 373 이 허용한 것은 **`zone3` 와의 근접**이고, 여기서 문제는 **⑤ 를 못 누르게 되는 것**이다.

---

## 1. 모달 — 전건 통과

### 개발자 자진 수정 2건 검증

| 결함 | 수정 확인 |
|---|---|
| **모달 pill 이 2~3줄로 깨짐** | **3개 전부 1줄**(`Range.getClientRects()=1`) · 폭 **119.5 / 118.5 / 186.9** — **페이지와 정확히 동일** ✅ 3뷰포트(375·360·1295) 전부 |
| **모달 마운트 `tabindex="0"` 잔존** | 마운트 `tabindex` = **`null`** ✅ |

### 레이아웃·축척

| 뷰포트 | dialog | 지도 | 상단바 | 하단바 | **축척** | 지도 면적비 |
|---|---|---|---|---|---|---|
| 375×800 | 375×800 | **375×667** | 64 | 69 | **100m** | 페이지의 **1.70배** |
| 360×800 | 360×800 | 360×667 | 64 | 69 | **100m** | 1.79배 |
| **1295×900** | 1295×900 | **1295×767** | 64 | 69 | **100m** | 2.20배 |

**1295×900 에서도 100m** — `FIT_MAX_ZOOM` 이 모달에서도 z17 을 깎는다 ✅ (**모달 축척이 안 올라가는 것은 설계 판정**이므로 실패로 올리지 않는다)

### 문안·구성

- **범례 5행 = 0** ✅ (의도)
- **`LEGEND_KEY` 전문 일치** — 모달 `실선 = 확인된 위치 · 점선 = 근사 · 옅은 면 = 범위 근사` = **페이지 원문과 한 글자도 다르지 않다.** **축약판 없음** ✅
- 어포던스 문구 `※ 지도의 번호를 누르면 각 지점 설명이 나옵니다.` — **하단 바**(`inMap: false`) ✅ **오버레이 아님**
- 상단 바 = `처음 위치로` + `닫기` ✅ · 지도 안 = `확대`(y76) `축소`(y118)
- **문안 게이트 56 개정본** 렌더 확인: `지도는 시각 자료입니다. 기호의 뜻은 아래 줄에 있고, 지점 설명은 번호를 눌러 확인해 주세요.` ✅

### 키보드·포커스

- **초기 포커스 = `닫기`** ✅ (`처음 위치로` 는 지도 이동 전 `disabled` 라 정지점 아님 — 정상)
- **방향키 순회**: `exit5 → stage1 → stage3 → zone3 → park-toilet → rally-zoom-in-fs → rally-zoom-out-fs → exit5`(순환) · **포커스 유실 0** ✅
- **팝업 5개 전부**: Enter 열림 · 포커스 팝업 안 · **Esc 로 팝업만 닫히고 모달은 열린 채 유지** · 포커스 마커 복귀 ✅
- **모달 닫기**: `dialog` 0 · **`scrollY` 3212 → 3212 (Δ0)** · 포커스 **`지도 크게 보기`** 복귀 ✅
- **포커스 트랩**: `dialog.matches(':modal') = true`(top-layer) · **배경 요소가 정지점으로 잡힌 횟수 0**(모달 밖 포커스 가능 요소 13개 중 0) ✅

### 컨트롤 행

| 뷰포트 | 행 | 1행 | 2행 | DOM 순서 |
|---|---|---|---|---|
| 375·360 | **2행** | `지도 크게 보기`(145.9) + `처음 위치로`(126.1) = **272.0** (+gap 8 = **280.0**) | `내 위치 표시`(130.3) + `로드뷰 보기`(126.1) = **256.4** (+8 = **264.4**) | **`지도 크게 보기` 1행 / `로드뷰 보기` 2행 — 다른 행** ✅ |
| 1295 | 1행 | 4개 합 528.4 | — | — |

**§27.4.3 실측값(280.0 / 264.4)과 정확히 일치** ✅

---

## 2. 주석 부채 2건 (내가 29회차에 올린 것) — **정리 완료** ✅

`RallyMap.tsx:1985~1991` 이 **§31.7 로 갱신**됐다. 옛 서술(*"팝업은 `aria-hidden` 이고 포커스 가능 요소를 두지 않기 때문이다"*)은 **전수 0건**이고, 현행 상태(팝업 `aria-hidden` 없음 · `닫기` 정상 포커스 · `tabIndex={-1}` 은 패널 자신에만)가 정확히 적혀 있다. **`aria-hidden` 과 마커 포커스가 한 쌍으로 움직인다는 근거**까지 남겼다.

## 3. 빌드

`npx tsc --noEmit` **0** · `npm run lint` **출력 0**(`.playwright-mcp/` 예외 처리 불필요 — `eslint.config.mjs` 반영분) · 콘솔 에러 0

---

## 기록 3건

| # | 내용 |
|---|---|
| **1** | **모달 Tab 순환에 `BODY` 가 낀다 — 결함 아니다.** `showModal()` top-layer 순환의 경계 상태이고, **배경 요소가 정지점으로 잡힌 적은 0회**다. 첫 관측에서 "모달 밖 탈출"로 읽었으나 `:modal = true` 와 배경 정지점 0 으로 반증했다 |
| **2** | **모달 안 네이버 링크 5개 중 Tab 정지점은 1개**다. 나머지는 크기 0·숨김이며 네이버가 주입한 것이라 통제 밖이다. **정지점이 줄어드는 방향이라 문제 아님** |
| **3** | **`--rally-label-max` 를 `documentElement` 에서 읽으면 빈 문자열**이다(변수가 박스 요소에 설정된 것으로 보인다). **pill 폭 실측이 참값**이므로 판정에는 영향 없다 |

## 미검증 1건

**실기기 터치 제스처·스크린리더** — 28회차부터 이월. Chromium 에뮬레이션 + CDP 이벤트로만 재현했다.

---

## 정리

- 서버: standalone 기동·PID 정지. 포트 3000 비어 있다.
- 증거 스크린샷 `overlap_nw.png` 는 **보고 후 삭제**한다(개발자가 요청하면 재생성 가능 — 스크립트는 리포트에 절차로 남겼다).
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

## **배포 판정: 조건부.**

**3단계-B(모달)만 배포한다면 통과다** — 모달 항목 전건 통과이고 실패 1건은 페이지 쪽이다.
**다만 실패 1건은 3단계-B 와 함께 나가는 같은 빌드에 있다.** ⑤ 를 못 누르는 상태로 배포할지는 **리더 판단**이다. 내 권고는 **고치고 배포**다 — 화장실은 당일 현장에서 찾는 정보이고, **막힌 것이 시각이 아니라 조작**이다.

---

# QA 리포트: 30-B 재측정 — z-order 수정 검증 (2026-08-21)

**대상:** `RallyMap.tsx` `69ea00b3dd77e1b8`(유일 변경 · z-order 한 줄) · 나머지 3종 무변경
**범위:** 리더 지정 **표적 재측정**(388 · 389 · 387 + 회귀). 좌표·치수·축척·문안은 기하 불변이므로 재측정 제외.

## 요약: **388 통과** | 387 통과 | **389 실패 1** | 회귀 통과 | 기록 2 → **배포 판정: 조건부**

### 측정 환경 (프리즈 완전 유지)

| 항목 | 전 (16:02:45) | **후 (16:09:51)** |
|---|---|---|
| `BUILD_ID` | `WhtioYcl7R5I0Bf_JMFZj` | **동일** |
| 소스 4종 | `69ea00b3` / `988038e3` / `50fb403d` / `1b392752` | **전부 동일** |
| 정적자산 해시 | `7d1635ed87257cb6` | **동일** |

> ⚠ 측정 중 `lsof -ti:3000` 에 PID 2개가 잡혀 오염을 의심했으나, **LISTEN 소유자는 내 서버 하나**(1769)이고 다른 하나는 Chrome 클라이언트 연결(1604)이었다. **오염 없음.**

---

## 1. ★ 388 — 모달 팝업 도달성 **통과 (25/25)**

**5점 × ①~⑤ = 25건 전부 열린다.**

| 모킹 지점 | ① | ② | ③ | ④ | ⑤ | 전부 열림 |
|---|---|---|---|---|---|---|
| 3구역 남동단 | ✅ | ✅ | ✅ | ✅ | ✅ | **true** |
| **3구역 북서단**(직전 실패 지점) | ✅ | ✅ | ✅ | ✅ | **✅** | **true** |
| 5번 출구 | ✅ | ✅ | ✅ | ✅ | ✅ | **true** |
| 무대3 옆 | ✅ | ✅ | ✅ | ✅ | ✅ | **true** |
| 화장실 옆 | ✅ | ✅ | ✅ | ✅ | ✅ | **true** |

**§0.4 위반 없음.** 모달에서 ⑤ 설명 문자가 사라지는 경로가 닫혔다 — §31.2 가 명문화한 *"모달에서 팝업 도달성은 §0.4 이행의 유일한 수단"* 전제가 성립한다.

## 2. 페이지 회귀 — **직전 실패 해소** ✅

**z 실측**: `my-location` **999** · ①~⑤ **1000~1004** (개발자 보고와 일치)

| 지점 | 최소 쌍 | 기하 겹침 | **⑤ 히트 소유자** |
|---|---|---|---|
| 3구역 남동단 | `zone3` 5.2px | 없음 | `park-toilet` |
| **3구역 북서단** | `park-toilet` **0px** | **470.4 px²** | **`park-toilet`** ← 되찾음 |
| 5번 출구 | `stage3` 41.2px | 없음 | `park-toilet` |
| **무대3 옆** | `park-toilet` **0px** | **274.4 px²** | **`park-toilet`** |
| 화장실 옆 | `zone3` 7.2px | 없음 | `park-toilet` |

**5점 전부 ①~⑤ 히트 소유자가 자기 자신이다.** 기하 겹침은 그대로지만(§34② 대로 접지 않고 z 만 낮췄다) **조작은 되찾았다.**

## 3. 387 핀 가시성 — 통과

| 지점 | 남동단 | **북서단** | 5번출구 | 무대3옆 | 화장실옆 |
|---|---|---|---|---|---|
| `my-location` 가시 픽셀 | 60.2 % | **39.8 %** | 90.3 % | 52.8 % | 60.2 % |

**핀이 도형 뒤로 사라지지 않는다**(최저 39.8 %). 북서단에서 60 % 가 ⑤ 배지에 가려지는 것은 **z 를 낮춘 대가로 의도된 트레이드오프**다(시각 가림은 남는다는 것이 판정 전제였다).

---

## ★ 4. 389 (2-C 개정본) — **실패 1건: 열린 팝업이 ② 마커 히트를 94.1 % 가져간다**

**2-C 개정본**: *"지도 위에 놓이는 어떤 요소도 마커의 탭 대상을 가로채지 않는다(라벨·오버레이·안내 띠·지도 안 버튼·**팝업 패널**·앞으로 추가될 무엇이든)"*

**모달 360×800, ④ 팝업이 열린 상태:**

| 마커 | 팝업과 겹침 | **히트 소유율** | **팝업이 가져간 비율** |
|---|---|---|---|
| ① | 0 | 100 % | 0 |
| **② 무대 1** | **3,825 px²** | **5.1 %** | **94.1 %** |
| ③ | 0 | 95.9 % | 0 |
| ④ | 0 | 96.6 % | 0 |
| ⑤ | 0 | 100 % | 0 |

- ④ 팝업 사각형 **(16, 80) 328×194** 이 ② pill 을 덮는다. ① 팝업(y545)일 때는 **겹침 0**이다.
- **위치**: 팝업 패널 `RallyMap.tsx:981` — `absolute inset-x-4 **z-20**`. 마커는 네이버 오버레이(`LABEL_Z_BASE 1000+`)로 **별도 스택 컨텍스트**라 z 숫자 비교가 성립하지 않고 팝업이 위로 온다.

### 등급 — **§0.4 아니다. 조작 결함이다**

**팝업을 닫으면 ② 를 누를 수 있다.** 도달 불가가 아니라 **한 단계가 추가**되는 것이다. 388(모달에서 팝업이 막히면 ⑤ 설명이 통째로 사라짐)과 **등급이 다르다.**

다만 **§25.4 설계상 팝업이 열린 채 다른 마커를 눌러 교체하는 것이 정상 경로**이고, 그 경로가 ②에 대해 막힌다.

### ⚠ 이번 z-order 수정이 만든 것이 아니다

팝업 패널의 `z-20` 과 스택 분리는 **21회차(§25.4)부터의 구조**다. `numbered === false` 한 줄은 **라벨끼리의 z** 만 건드렸고 팝업과는 무관하다.
**모달에서 처음 드러난 이유**는 지도가 커져 팝업(고정 폭 `inset-x-4`)이 마커를 덮을 확률이 올라갔기 때문이다.

### 미검증 — **페이지에서도 같은지 재지 않았다**

구조가 동일하므로 **페이지에서도 발생 가능**하다고 본다. 다만 **측정하지 않았으므로 미검증**으로 남긴다. 수정 시 양쪽을 함께 봐야 한다.

---

## 기록 2건

| # | 내용 |
|---|---|
| **1** | **마커 히트 소유율 95.3~96.6 % 의 나머지는 결함이 아니다.** 도둑의 정체를 추적하니 **네이버 지도 타일 `IMG`**(256×256, `.../16/55872/25388@2x.png`)였고, **pill 의 둥근 모서리 바깥**에서 잡힌 것이다. `border-radius` 가 있는 요소를 사각형 격자로 훑으면 필연이다. **탭은 25/25 정상 작동한다** |
| **2** | **모달 안 지도 위 요소는 4개뿐**이고 전부 안전하다 — 키보드 그룹 `DIV`(지도 전면 덮지만 **`pointer-events: none`**), 줌 버튼 컨테이너, `확대`, `축소`. **상단 바(`처음 위치로`·`닫기`)와 하단 바(`LEGEND_KEY`·어포던스)는 지도와 교차 0** |

## 정리

- 서버 정지 · 포트 3000 반환 · `.playwright-mcp/` 삭제.
- **프로덕션 무접촉 · 프로덕션 코드 수정 0.**

## **배포 판정: 조건부.**

**388(§0.4 급)은 해소됐고 직전 실패도 해소됐다.** 남은 것은 **389 조작 결함 1건**이고, **이번 수정이 만든 것이 아니라 21회차부터의 구조**다.
**내 권고: 배포하고 후속으로 처리.** ②를 누르려면 팝업을 먼저 닫아야 한다는 것이지 도달 불가가 아니고, D-7 에 스택 구조를 건드리는 것은 새 실패 모드를 들이는 쪽이 더 비싸다. **다만 등급 판단은 리더 몫이다.**

### 30-B 재측정 종결 — 389 후속 이관 (리더 판정)

**배포한다.** 내 권고(도달 불가 아님 · 이번 수정이 만든 것 아님)에 리더가 **근거 하나를 더 붙였고, 그것이 결정적이다:**

```
지금 프로덕션(d37c749)   ⑤ 히트 가로채기 (팝업을 닫아도 해소되지 않는다)  +  전체 화면 지도 없음
배포 후                  ⑤ 해소  +  389(팝업 닫으면 해소)  +  전체 화면 지도
```

**새 결함을 들이는 것이 아니라, 해소 불가 결함을 해소 가능 결함으로 바꾸면서 기능을 더한다.**
현재 프로덕션의 ⑤ 가로채기는 조합원이 *"눌렀는데 안 열린다"* 를 겪고 **원인을 알 방법이 없다.** 389 는 최소한 팝업을 닫으면 풀린다.

**후속 2건 등록:**

| | 항목 |
|---|---|
| **389** | 열린 팝업 패널이 마커 히트를 가로챈다(모달 ④ 팝업 → ② **94.1 %**). **2-C 개정본 문면상 위반.** `RallyMap.tsx:981` 팝업 `z-20` ↔ 네이버 오버레이가 **별도 스택 컨텍스트**라 **z 숫자로는 못 푼다** |
| **389-P** | ⚠ **페이지 지도 미측정.** 구조가 같으니 발생 가능하나 **관측하지 않았다.** 고칠 때 양쪽을 함께 본다 |

> **미측정을 미검증으로 남긴 이유**(리더 확인): *"구조가 같으니 발생할 것"* 은 **추론**이고, 관측으로 적으면 다음 사람이 근거로 쓴다.

**387 대가 기록**: 핀 가시성 **39.8 ~ 90.3 %**. 최저 39.8 %(북서단, ⑤ 배지에 60 % 가림)는 §34 가 *"가려지는 최대 면적은 배지 28px 하나"* 로 계산한 범위 안이다. **회귀 조건은 "사라지지 않는다"였고 충족됐다.**

---

# 전체 화면 지도 로드뷰 (2026-08-22)

**요구**: *"전체화면 지도에서도 팝업에 로드뷰 버튼 넣어줘"* — 종전 `onRoadview={null}` 을 뒤집는다.

## A. 구조 — 왜 버튼만 켜면 안 됐나

1. **시트는 `<dialog>` 안이어야 한다.** `showModal()` 은 top layer 라 바깥의 `fixed z-40` 은 **모달 뒤로 숨는다.**
2. **거리뷰까지 가야 한다.** 시트 본문이 *"지도의 파란 길을 누르면…"* 이라고 말하는데,
   모달 지도에 `StreetLayer` 가 없으면 **그 문장이 거짓**이 된다.
3. **복제 금지.** 두 벌이면 한쪽만 고쳐진다(§27.14.4-3) → `useRoadview` 훅 + `RoadviewSheet` 로 추출.
   상태는 **지도마다 하나**다(공유하면 뒤에 가려진 지도에 파란 길이 깔린다).
   `active`(페이지=`!fullscreenOpen` · 모달=`open`)가 거짓이 되면 스스로 정리한다.

## B. 곁다리로 **잡아 고친 결함 2건** — 둘 다 이번 요구와 별개다

### B-1. 전체 화면 지도가 **한 번만 열렸다** (프로덕션 재현 · 내 변경 이전부터)
`지도 크게 보기` → `닫기` → 다시 누르면 **아무 일도 안 일어난다.**
DOM 은 닫혔는데 React `open` 이 `true` 로 남고(실측: 닫힌 뒤에도 `#rally-zoom-in-fs` 존재),
열림 이펙트는 `[open]` 키라 **다시 돌지 않는다.**

★ **기제는 특정하지 못했다.** `close` 이벤트 관측이 확장 격리 환경에서 신뢰 불가였다 —
**갓 만든 대조군 `<dialog>` 에서도 이벤트가 안 잡혔다.** 그래서 "이벤트가 안 온다"는 초기 판정을
**철회**하고, 기제가 아니라 **구조**를 고쳤다: 모든 닫기 경로가 `onClose()` 로 **상태를 먼저** 바꾸고
이펙트가 DOM 을 맞춘다(`cancel` 로 브라우저 닫기 요청도 상태 경유). 스크롤·포커스 복원도
이펙트로 옮겼다 — `close` 이벤트에 얹어 두면 그것이 안 올 때 **복원까지 함께 사라진다.**

### B-2. `거리뷰` 토글이 **키보드로 도달 불가**했다 (2026-08-21 내가 넣은 결함)
`itemProps` 가 `tabIndex: focusedId === id ? 0 : -1` 을 주는데 `focusedId` 는 `keyboardOrder()` 의
값만 되고 그 목록에 이 id 가 **없어** 영원히 `-1` 이었다. 평범한 탭 정지점으로 바꿨다.

## C. 실측 (localhost:3000 · 새로 로드한 단일 세션)

| # | 항목 | 결과 |
|---|------|------|
| 1 | 모달 열림 | ✅ |
| 2 | 팝업에 `로드뷰 보기` | ✅ |
| 3 | 시트가 `<dialog>` 안 | ✅ (`elementFromPoint` 최상위 = 시트) |
| 4 | 시트 열리면 팝업 닫힘(표면 2겹) | ✅ |
| 5 | `Esc` 가 모달 닫기 요청을 취소 | ✅ `defaultPrevented === true` |
| 6 | `Esc` 로 **시트만** 닫히고 모달 유지 | ✅ |
| 7 | 모달 닫힘 | ✅ |
| 8 | scrollY 복원 | ✅ 2400 → 2400 (오차 0) |
| 9 | **재진입** | ✅ (B-1 회귀 확인) |
| 10 | 잔여 0(시트·파란 길·`body.position`) | ✅ |

부가: 파노라마 타일 15 · `촬영 2026.03` · 파란 길 6 · 주황 마커 1 · 시트 뷰포트 48%.

## D. 이 회차의 측정 교훈 — **오염된 상태에서 잰 값을 믿지 마라**

`Esc` 가 모달까지 닫는 **회귀로 보이는 결과**를 한 번 얻었는데, 원인은 **직전 스크립트가 CDP
45초 타임아웃으로 중간에 끊겨** 모달·시트가 어중간한 상태로 남은 것이었다. 새로 로드해 재측정하니
정상이었다. **긴 시나리오는 쪼개고, 이상 결과는 재로드 후 재현되어야 결함이다.**

---

# 로드뷰 시트 모바일 배치 (2026-08-22)

**지적**: *"모바일에서 폰트크기가 과한지 텍스트배치가 보기좋지가 않아"* + *"글자가 겹친거야 그건"*

## 1. 헤더가 3요소 폭싸움 — 390px 실측으로 재현

제목·촬영일·`닫기` 가 한 행에서 서로 밀었다. 셋 다 `flex-shrink:1` · `word-break:normal` 이라
**전부 2줄로 깨졌다**: `로드뷰 — 2호 개나리 화장`/`실` · `촬영`/`2025.04` · `닫`/`기`.
헤더 89px → 시트가 뷰포트 **54%**(설계 48%).

**고침**: 세로로 쌓을 것(제목+촬영일)과 옆에 고정할 것(`닫기`)을 분리.
제목 `min-w-0 break-keep`(어절 유지 — 이게 없어 낱말 중간이 잘렸다) · 촬영일 아래 줄 ·
`닫기` → **`×` 44px 아이콘**(`aria-label="로드뷰 닫기"` 가 뜻을 진다, §2).

| | 종전 | 지금 |
|---|---|---|
| 제목 | 2줄(낱말 중간 잘림) | **1줄** (360px 에서도) |
| 촬영일 | 2줄 | 1줄 |
| 닫기 | 2줄 | 44×44 아이콘 |
| 헤더 | 89px | **75px** |
| 시트 | 54% | **46~49%** |

**`--text-body`(18px)는 건드리지 않았다** — 하한이고 변경 금지다. 폰트가 아니라 **배치**가 문제였다.

## 2. ★ 글자 겹침의 진짜 원인 — 지도 저작권이 시트 **위**에 그려졌다

네이버 지도가 만드는 `.map_copyright`(`© NAVER Corp.`)·축척·로고는 **`z-index: 100`**,
시트는 **`z-40`** 이었다. 100 > 40 이라 **시트 본문 위에 포개져 찍혔다.**

⚠ **이 겹침은 `elementFromPoint` 로 검출되지 않는다** — 그 요소들이 `pointer-events: none` 이다.
**실제로 그 방법으로 "겹침 0"이라 잘못 판정했다.** 사각형 교차(기하)로만 잡힌다.
→ 시트를 `z-[300]` 으로 올렸다. **페이지 지도·전체화면 양쪽에서 겹침 0** 재측정.

**약관 표기는 유지된다**: 시트 안 파노라마가 자기 `NAVER` 로고를 직접 그린다
(실측 45×10px, 박스 하단에서 7px 위 — `overflow-hidden` 이 자르지 않는다).

## 3. 파노라마 오버플로 차단

`h-[32dvh]` 박스가 `overflow: visible` 이라 파노라마 내부 큐브 면이 **1150px 넘게** 밖으로 나왔다.
`overflow-hidden` 추가.

## 4. 안내문 절제(§5.3) — 4줄 → 2줄

*"로드뷰 안에서는 드래그로 둘러보고, 화살표로 길을 따라 걸을 수 있습니다"* 삭제.
로드뷰의 **보편 조작**이고 화살표는 화면에 보인다 — 판정 기준에 걸리지 않는다.
**첫 문장은 남긴다**: 지도를 눌러 위치를 옮기는 것은 **화면에 단서가 없어 발견 자체가 불가능**하다.

## 5. ★ 내가 만든 회귀 1건 — 잡아서 고쳤다

`CONTROL_CLASS` 에 `shrink-0 whitespace-nowrap` 을 넣자(라벨이 세로로 깨지는 것을 막으려고)
**전체 화면 상단 바가 줄일 수 없는 두 버튼**을 갖게 됐다.
텍스트 확대 **200% · 360px 실측: 421px 로 61px 넘쳤다**(`처음 위치로` 247 + `닫기` 146 + gap 8 + 패딩 24).
→ 그 행에 `flex-wrap gap-y-2`. **100% 에서는 231px 라 발동하지 않는다**(1줄 유지, 배치 변화 0).
페이지 컨트롤 행·팝업 버튼 행은 이미 `flex-wrap` 이라 무사.

---

## QA 리포트 (2026-08-26 · 결의대회 블록 2 이미지 2장)

**대상**: `/rally-2026-08-28` 블록 2(`코스콤지부 집결 위치`) — `map.png`/`official.png` 2장 반영 · 산문 3→5줄 · 캡션 1→2개
**정본 기준**: 검증 `01_verifier_factcheck.md` §44-1~§44-10 / 디자인 `02_designer_spec.md` §36.11 · §36.12 · §36.13 / 축자 `baseline/EXPECTED-STRINGS.txt` 6건
**검증자**: `qa1` · 방법론 `union-qa-testing` §5.1~§5.2(3계층 문안 게이트) · §5.5(실측 규율) · §5.6(측정 환경)

### 요약: 통과 34 | 실패 2 | 미검증 4 | 범위 밖 관찰 3

---

### 0. 측정 환경표 (§5.5 · §5.6 필수 — 맨 앞에 둔다)

| 항목 | 값 |
|---|---|
| 도구 | **Playwright MCP** (Chromium 151.0.7922.175 · headful · **새 탭에서 시작**) |
| 서버 | `npm run start`(= `next start`) **PID 78347** · 기동 **16:09:09** · `http://localhost:3000` |
| Next | **16.3.1** |
| `next.config.ts` mtime | **16:03:42** — 서버 기동(16:09:09)보다 **앞선다** → 실행 프로세스가 `images.qualities:[75,90]` 을 들고 있다(§36.13-6 함정 회피 확인) |
| `BUILD_ID` | `7cBCxEplj7YSM8vHHeK-h` — **측정 전후 동일** |
| 정적 자산 | 페이지가 참조하는 **10건 전수 HTTP 200** (측정 전후 동일). 구 서버+신 자산 조합 아님 |
| 서버 응답 ↔ 디스크 프리렌더 | `sha256 4e3fd5d585970c338a33fc39fc95c633e24639b42722bec28d7ad9b1e71d60e3` **양쪽 동일**(71,341 B) |
| **★ 루트 글꼴 실측** | `getComputedStyle(document.documentElement).fontSize` = **`12px`** (`globals.css:121` `font-size: 75%`). **16px 이 아니다** |
| «텍스트 확대 200%» 정의 | `html { font-size: 32px !important }` (이 프로젝트 QA 관행 · §36.12-1) |
| DPR | **1** |
| `navigator.maxTouchPoints` / `(pointer: coarse)` | **0** / **false** → **터치 에뮬레이션 없음**(`setViewportSize` 만으로는 안 켜진다) |
| **`document.visibilityState`** | **`visible`** ✓ |
| **rAF 1.5초 내 발화** | **true** ✓ |

#### ★★ `innerWidth − clientWidth`(스크롤바) — **회차에 따라 갈렸다. 그대로 적는다**

| 회차 | `innerWidth` | `clientWidth` | 스크롤바 | 그때 슬롯 |
|---|---|---|---|---|
| 360 · 새 탐색 직후 | 360 | **345** | **15px** | **291.00** |
| 360 · 1280→360 리사이즈 후 | 360 | **360** | **0px** | **306.00** |
| 1280 | 1280 | **1280** | **0px** | **624.00** |

macOS Chrome 의 오버레이/클래식 스크롤바 전환 때문이다.
★ **아래 200% 측정은 전부 «스크롤바 15px · 슬롯 201px» 조건에서 했다** — 실기기(오버레이 · 슬롯 216px)보다 **가혹한 쪽**이라 판정이 보수적이다. 이는 §36.13-2 디자이너 측정 조건과도 같다.

#### 슬롯 폭 검산 (체크리스트 421)

| 환경 | 실측 | §36.12-3 기대 | 판정 |
|---|---|---|---|
| 360 · 스크롤바 0 | **306.00** | 306.0 | ✓ |
| 360 · 스크롤바 15 | **291.00** | 291.0 | ✓ |
| 1280 · 기본 | **624.00** | 624.0 | ✓ |
| 1280 · 200% | **1024** | — | (신규 기록) |

**`832px` 이 나오는 환경은 없었다** ✓ — 루트 글꼴 오염 없음.

#### 종횡비 검산 (§5.5 — CSS-POSSIBLE 인가)

| 그림 | 실측 rect | 슬롯×원본비 | 판정 |
|---|---|---|---|
| `rally-layout-2.png` (1374×1264) | 291 × **268.0** | 291 × 1264/1374 = **267.68** | ✓ |
| `branch-layout-2.png` (1209×1665) | 291 × **400.0** | 291 × 1665/1209 = **400.75** | ✓ |

⚠ §5.5 대로 **종횡비만으로는 폭 오염을 못 잡으므로**, 위 스크롤바 표를 함께 근거로 쓴다.

---

### 실패 항목 — 2건

| # | 분류 | 위치 | 내용 | 수정 방법 |
|---|---|---|---|---|
| **F-1** | 디자인 스펙 미이행 (실측 확인) | `src/app/rally-2026-08-28/page.tsx:300` · `src/app/rally-2026-08-28/page.tsx:365` | `figcaption` 2개가 **`mt-3 break-keep text-caption text-ink`** 로 `break-words` 가 **없다.** 디자이너 **§36.13-2 확정**과 QA 체크리스트 **431**(«2개 모두») 미이행 | 두 줄 다 `className="mt-3 break-keep break-words text-caption text-ink"` 로 고친다. **문면은 건드리지 않는다**(§44 조건 2·3 축자) |
| **F-2** | 빌드 ↔ 소스 불일치 | 3000 포트의 빌드 산출물 (`page.tsx:545` 반영 안 됨) | 소스 산문 ⑤ 는 **`break-keep break-words`** 인데 산출물·DOM 은 **`break-keep`** 뿐이다. 나머지 27종 `className` 은 전부 일치 — **이 한 줄만 뒤처졌다** | **소스는 이미 맞다. 재빌드·재기동만 필요.** F-1 수정과 묶어 **1회**로 처리 권고 |

#### F-1 실측 근거 — §36.13-2 예측과 일치했다

측정: **360 뷰포트 · `clientWidth 345` · 스크롤바 15px · 루트 `32px` · 슬롯 201px**

| 대상 | 잉크 폭(Range 실측) | 슬롯 201 대비 | `word-break` / `overflow-wrap` |
|---|---|---|---|
| 캡션 1 `주최측 배치도 (코스콤지부가 위치 표시)` | **165.8px** | **0** | `keep-all` / `normal` |
| **캡션 2 `금융노조지부배치도`** | **233.4px** | ★ **+32.4px 초과** | `keep-all` / `normal` |

- 캡션 2 의 잉크 오른쪽 끝 **x=305.4**, 카드 오른쪽 테두리 **x=313** → **테두리에서 7.6px** 까지 다가붙는다(의도한 오른쪽 여백은 `p-5` = **40px**).
- **문서 가로 스크롤은 0** 이다 — 카드 `p-5` 40px 이 32.4px 을 흡수한다. 즉 **FOLLOWUPS #10·#11 회귀는 아니다.**
  ⚠ 그러나 **«문서 스크롤 0» 을 통과 근거로 삼으면 이 결함이 안 잡힌다.** 판정선은 «캡션이 자기 슬롯 안인가» 여야 한다.

**수정 시뮬레이션**(같은 페이지에서 `style.overflowWrap='break-word'` 만 얹어 측정):

| | 슬롯 초과 | 높이(전 → 후) |
|---|---|---|
| 캡션 1 | 0 → **0** | 135px → **135px** (변화 0) |
| 캡션 2 | 32 → **0** ✓ | 45px → **90px** (200%에서만 2줄) |
| 문서 가로 스크롤 | 0 → 0 | — |

→ **캡션 1 의 낱말 보존은 그대로 살고 캡션 2 만 넘칠 때 끊긴다. 비용 0.** §36.13-2 의 판정이 실측으로 재확인됐다.

#### F-2 실측 근거

```
소스   page.tsx:545  <p className="mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
산출물 .next/server/app/rally-2026-08-28.html
              <p class="mt-1 max-w-[var(--container-prose)] break-keep text-body text-ink">
```
시각: 서버 기동 **16:09:09** → `page.tsx` mtime **16:10:23** → `next build` 산출 **16:10:44**.
빌드가 소스를 **읽은 시점**이 ⑤ 편집보다 앞섰던 것으로 보인다.
★ **`BUILD_ID` 대조로는 안 잡힌다** — 서버 응답과 디스크 프리렌더가 sha256 동일이고 정적 자산도 전수 200 이다. **«서버 ↔ 자산» 은 일관되고 «빌드 ↔ 소스» 만 어긋났다.**

**게시 위험도 — 낮다.** 같은 조건에서 ⑤ 에 `break-words` 를 얹어 재 보니 **어떤 값도 바뀌지 않았다**:

| 산문 ⑤ | 잉크 폭 | 슬롯 초과 | 높이 | 문서 스크롤 |
|---|---|---|---|---|
| 현재(빌드 · `break-keep` 만) | 173.8px | **0** | 428.37px | 0 |
| 소스 의도(`break-keep break-words`) | — | **0** | **428.37px**(동일) | 0 |

→ **F-2 는 «값이 틀렸다»가 아니라 «측정한 빌드가 최종본이 아니다»** 이다. 최종 게이트는 **재빌드 후 다시 재야 한다**(§5.5 빌드 동결).

---

### 통과 항목

#### A. 문안 3계층 게이트 (§5.1~§5.2 · §44-10)

`EXPECTED-STRINGS.txt` **6건 전부 문자 단위 일치.** 계수는 전부 **부분문자열 분할(= `grep -o | wc -l` 등가)** 로 했다 — `grep -c` 는 쓰지 않았다.

| 축자 문면 | ① 프리렌더 본문 | ② 속성 텍스트(완전일치) | ③ 원시 소스 |
|---|---|---|---|
| `map.png` 캡션 (22자) | **1** | 0 | 2 |
| `official.png` 캡션 (9자) | **2**\* | 0 | 4 |
| `map.png` `alt` (197자) | 0 | **1** ✓ | 2 |
| `official.png` `alt` (149자) | 0 | **1** ✓ | 2 |
| 산문 ④ (53자) | **1** | 0 | 2 |
| 산문 ⑤ (42자) | **1** | 0 | 2 |

\* 캡션 2 의 본문 2회는 **`figcaption` 1회 + 산문 ④ 안의 `금융노조지부배치도의` 1회** — 체크리스트 435 결속이 성립한 결과다.
⚠ `innerText` 는 쓰지 않았다. `alt` 는 **속성만 따로 떠서** 대조했다(태그 제거 정규식은 속성값을 통째로 버린다).

**③ 소스 문자열 집합 차분** (`baseline/page.tsx.BEFORE` vs 현재):

| 축 | 신규(+) | 사라짐(−) |
|---|---|---|
| JSX 렌더 텍스트(주석 제거) | **정확히 4건** — 캡션 1 · 캡션 2 · 산문 ④ · 산문 ⑤ | 1건 — 구 캡션 `주최측 배치도` |
| 큰따옴표 문자열(주석 제거) | **정확히 2건** — `alt` 2건 | 1건 — 구 `alt` |

→ **신규 저작 문자열이 ④·⑤ + 캡션 2 + `alt` 2 뿐이다** ✓ (§44-10 3계층 요구 충족).
주석에만 새로 들어온 문자열 3건(`이 문장이 없으면…` · `지부출석체크하는 지부천막 자리` · `큰 의미없는 내용`)은 **렌더 본문·속성에 0건**임을 별도 확인했다.

#### B. §44 조건표 10건

| 조건 | 판정 | 확인 방법 |
|---|---|---|
| **1** 산문 ④ 필수 | ✓ | 프리렌더 본문 축자 1회 · DOM 순서 4번째 |
| **2** `map.png` 캡션 = §44-2(1) · 머리 `주최측 배치도` 보존 | ✓ | `figcaption` 축자 일치 · 본문 `주최측 배치도` 3회 |
| **3** `official.png` 캡션 무수정 | ✓ | 축자 일치 |
| **4** 우측 상자 세부 **한 글자도 금지** | ✓ | `산업은행 인도`·`신보(1)`·`코스콤(1)` **본문+속성 0건**. 소스 주석에 «금지 근거 = 불필요» 기재 확인(`page.tsx:339`) |
| **5** `alt` 2건 = §44-2(3)(4) | ✓ | 속성 완전일치 각 1건. `map` `alt` 안 `코스콤지부` **0** · `코스콤 로고` **1** · `official` `alt` 가 `배치도` 로 시작하지 않음(`무대 세 곳…`) |
| **6** 산문 ①②③⑥ 무수정 | ✓ | 4문장 축자 각 1회. `STAGE3_SENTENCE` 렌더 0 |
| **7** 자산 사양 | ✓ | 아래 D |
| **8** 확대 경로(권고) | ✓ 채택 안 함 | 블록 2 안 포커스 가능 요소 **0건** · 확대 UI·문장 0. 핀치 확대 살아 있음(아래 C) |
| **9** 산문 ⑤ 필수 | ✓ | 축자 1회 |
| **10** 구판 `official.jpeg` 를 `public/` 에 넣지 않음 | ✓ | `ls` 0건 + HTTP **404** |

**묶여 움직이는 2쌍** — 둘 다 성립:
- 쌍 1(조건 2↔1): 캡션 머리 `주최측 배치도` 존재 · 산문 ④ 안에 `주최측 배치도`·`금융노조지부배치도` 둘 다 존재 ✓ (체크리스트 435)
- 쌍 2(조건 9↔5): `map.png` `alt` 에 `도로 위` 1 · `길가` 1 / 본문에 `도로 위` 1 · `길가` 1 ✓ (체크리스트 434). 양쪽 소스 주석에 «함께 움직인다» 기재 확인(`page.tsx:268` · `:282` · `:500` · `:527`)

#### C. §44-6 금지 목록 — **본문 + 속성 전체에서 0건**

`출석체크는 지부천막` · `QR이 안 되면` · `무대 바로 앞` · `무대에서 두 번째` · `앞 1/4` · `약 30 m` · `3구역 앞쪽` · `주황(색) 사각형` · `더샵아일랜드파크` · `주최측 안내에 따르면` · `확인 중` · `표시하지 않았습니다` · `판단했습니다` · `작게 보이면` · `확대해 주세요` · `확대해서` · `교체되었습니다` · `산업은행 인도` · `신보(1)` · `코스콤(1)` · 천막 `운영 시간`·`상주` — **전부 0.**

⚠ **오탐 1건을 걸러냈다**: `인증샷` 이 1회 나오는데, 위치는 `src/components/rally/QrAttendanceCard.tsx:57` 의 QR 안내 `alt`(주최측 문안 전사, *"각 지부로 현장 인증샷을 제출하거나…"*)다. §44-6 이 막는 것은 **«천막»과 결합된 문장**이고, 이 문자열은 **이번 라운드가 만든 것이 아니며**(해당 파일 무변경) §44-8 이 이미 «QR 이미지 안에 있다»고 인정한 것이다. → **위반 아님.**

**이미지에 손대지 않았음 — 픽셀로 증명**:

| 대조 | 결과 |
|---|---|
| `design/official.png` ↔ `public/…/branch-layout-2.png` (알파 제거 후 RGB) | **다른 바이트 0** / 6,038,955 (최대 차 0) ✓ 체크리스트 424 |
| `_workspace/…/official.png` ↔ 배포본 | **다른 바이트 0** ✓ |
| `_workspace/…/map.png` ↔ `public/…/rally-layout-2.png` | **다른 바이트 0** / 5,210,208 ✓ |

→ **우리가 화살표·테두리·크롭을 새로 그려 넣지 않았다는 것이 «파일 크기»가 아니라 «픽셀»로 확인됐다**(§36.12-5 ⚠ 대로).

#### D. 자산 (§44-4 · §36.11-5 · §36.11-6 · 체크리스트 418·424·425)

| 항목 | 실측 | 판정 |
|---|---|---|
| `rally-layout-2.png` `srcset` | 후보 **8개 전부 `q=90`** (`w=640/750/828/1080/1200/1920/2048/3840`) | ✓ |
| 옵티마이저 직접 요청 `…&w=828&q=90` | **HTTP 200** | ✓ |
| ★ 대조군 `…&q=100` | **HTTP 400** | ✓ **허용 목록이 실제로 작동한다** — 200 이 «관대한 폴백»이 아님이 증명됐다 |
| 브라우저 Accept 경로 바이트 (q 가 실제로 먹는가) | `w=828`: **q=75 131,772 B → q=90 230,002 B** / `w=1080`: **182,660 → 322,398 B** | ✓ 선언과 산출물이 일치 |
| 옵티마이저 산출 크기 | `w=640→640×589` · `828→828×762` · `1080→1080×994` · `1920/3840→1374×1264`(원본 상한) | ✓ 정상 |
| `branch-layout-2.png` | `/_next/image` 를 **거치지 않고** `/images/…` 직행 · **51,466 B** · `image/png` · `naturalWidth 1209` | ✓ `unoptimized` 실효 |
| `width`/`height` | `1374/1264` · `1209/1665` — 원본 메타와 일치 | ✓ |
| `sizes` | `(min-width: 768px) 832px, 100vw` (유지) | ✓ |
| 폭 상한 | 두 그림 다 없음 | ✓ |
| `className` | 두 그림 **완전 동일** `rounded-badge border border-border-soft block h-auto w-full` | ✓ 체크리스트 427 |
| 구 파일 | `rally-layout.png` **404** · `official.jpeg` **404** · `official.png` **404** · `public/` 디렉터리에 새 파일 2건 | ✓ 체크리스트 425 |
| 커밋 형식 | 둘 다 PNG · `branch-layout-2.png` 은 알파 제거 무손실(90KB→51KB, 픽셀 동일) | ✓ |

⚠ **한 줄 관찰(결함 아님)**: `Accept` 헤더 없이 부르면 옵티마이저가 **PNG 로 되돌리고 그 경로에서는 `q=75`/`q=90` 바이트가 동일**(431,032 B)하다. 실제 브라우저는 전부 `image/webp` 를 광고하므로 조합원 경로에는 영향이 없다.

#### E. 레이아웃 · 확대 (체크리스트 419·426·427·429·433)

| 항목 | 실측 | 판정 |
|---|---|---|
| **기본 배율 문서 가로 스크롤** 360 / 390 / 1280 | **0 / 0 / 0** | ✓ |
| **200% 문서 가로 스크롤** 360 / 390 / 1280 | **0 / 0 / 0** | ✓ FOLLOWUPS #10·#11 유지 |
| 200% · 블록 2 요소별 `display:none` 기여분 | 그림 1·2, 캡션 1·2, 산문 ①~⑥, 카드 전체 — **전부 숨겨도 문서 스크롤 0** | ✓ **블록 2 의 문서 스크롤 기여 = 0** |
| 200% 산문 잉크 폭 (슬롯 201) | ① 195.7 ② 193.8 ③ 193.8 ④ **186.7** ⑤ 173.8 ⑥ 164.6 — **전부 초과 0** | ✓ |
| ★ 산문 ④ (`break-words` 선제 적용분) | **186.7px · 초과 0.** §36.12-7 이 예측한 110px 넘침이 **처방으로 실제 제거됐다** | ✓ **개발자의 선제 적용이 옳았다** |
| 최장 덩어리 지목 검산 | 원인은 `「LED무대…」` 가 아니라 첫 낱말 **`금융노조지부배치도의`** — §36.12-7 의 정정이 맞다(리더 초기 지목은 틀렸다) | ✓ |
| 회귀 ①(체크리스트 430) | `ZONE_STATUS.assignment` 줄의 **`break-words` 살아 있음** (`break-keep break-words text-lead text-ink`) · 초과 0 | ✓ |
| CLS | 정결한 재탐색 **2회 연속 0.00000** · `figure` 높이 로드 전후 동일(f1 293.86 · f2 425.88) | ✓ 체크리스트 426 |
| DOM 순서 | `FIGURE`(map) → `FIGURE`(official) → `P`①②③④⑤⑥ — **두 그림이 산문보다 위, `map` 이 `official` 보다 위** | ✓ 체크리스트 433 |
| 간격 비율(§36.11-1) | 기본 배율에서 `그림→캡션` **9px** : `캡션→다음 그림` **18px** = **1 : 2** (1280 도 9 : 18 동일) | ✓ ⚠ 12/24 가 아니라 **9/18** 인 것이 정상(루트 12px) |
| 캡션 귀속 | 두 `figcaption` 모두 자기 `figure` 의 **직계 마지막 자식** | ✓ |
| 문안 개수(체크리스트 432) | 블록 2 산문 **5줄 + 주석기호 1개** · `page.tsx` 렌더 주석기호 총수 **BEFORE 2 → AFTER 2**(증가 0) | ✓ |
| 신설물 금지(체크리스트 436) | 블록 2 카드의 직계 자식 = `FIGURE`×2 + `P`×6. **색 범례·번호 라벨·대응표·«확대해서 보세요» 0건** · 포커스 가능 요소 **0건** | ✓ |

#### F. 접근성

| 항목 | 실측 | 판정 |
|---|---|---|
| 대비 | 캡션 2개 · 산문 6줄 전부 `rgb(26,26,26)` on `rgb(255,255,255)` → 스크립트 **17.40 : 1 · AAA 통과**. `ink-muted`·`white/80` **0건** | ✓ 체크리스트 428 |
| 글자 급 | `figcaption` **11.25px**(= `0.9375rem` × 12px · `text-caption`) · 산문 `text-body` 13.5px · ① `text-lead` 15px/600 | ✓ 승격·강등 없음 |
| `alt` | 페이지 전체 이미지 **22개 모두 `alt` 보유**(장식은 `alt=""`) · **깨진 이미지 0건**(`naturalWidth>0` 전수) · 네트워크 **404 0건** | ✓ |
| 스크린리더 낭독 순서 | `alt` → `figcaption` → 본문 (§44-3 요구) | ✓ |
| 키보드 | 블록 2 안 포커스 가능 요소 **0개** → **새 함정 없음**. 페이지 전체 포커스 가능 14개가 DOM 읽기 순서와 일치 | ✓ |
| `div onClick` | **0건** | ✓ |
| `:focus-visible` | 이 페이지의 링크 2곳에 `focus-visible:outline-3 outline-primary outline-offset-2` 존재 | ✓ |
| 핀치 확대 | `<meta name="viewport" content="width=device-width, initial-scale=1">` · `user-scalable=no`/`maximum-scale` **소스 전체 0건**(주석 1건 제외) | ✓ §36.11-3 전제 확인 |
| landmark | `main` 1 · `header` 1 · `footer` 1 | ✓ |

#### G. 판독 (체크리스트 422)

**1280 기본 배율의 실제 표시 폭 624 CSS px 로 축소 렌더한 뒤 3배 확대해 읽었다.**
→ **`코스콤(한국증권전산)지부` 를 읽었다.** 위치도 `alt` 진술과 일치했다 — `LED무대 2 (산업은행 삼거리)` 칸 · `한국산업은행지부` 다음 줄 · `SC제일은행지부` 오른쪽.
⚠ 체크리스트가 요구한 **«육안 2인»** 중 **나는 1인**이다(§36.12-4 의 디자이너 판독이 다른 1인). 그리고 이는 **3배 확대 사본 판독**이라 «실제 8.8px 글자를 맨눈으로»와 동일하지 않다. **미검증으로 분리하지 않고 조건부 통과로 적되, 이 한계를 명시한다.**

#### H. 회귀 (§44-7 무수정 대상)

**변경 파일이 `page.tsx` 1개뿐**이다(`git diff --stat -- src/` = 1 file). `rallyMap.ts` · `RallyMap.tsx` · `RallySchedule.tsx` · `QrAttendanceCard.tsx` · `routes.ts` **전부 무변경.**
`page.tsx` 의 **삭제 줄은 5줄뿐**이고 전부 구 지도 `figure` 안(구 `src`/`width`/`height`/`alt`/구 캡션)이다 — 나머지는 전부 추가다.

렌더 문자열 전수 대조 — **10건 모두 1회씩 그대로**:
`코스콤지부는 집회 3구역입니다.` · `3구역은 나란한 두 구역 중 북동쪽 — KDB산업은행 쪽입니다.` · `국회의사당역 3번 출구에서 여의도공원 쪽으로 약 230 m — KDB산업은행 앞입니다` · `국회의사당역 3번 출구 → 여의도공원 방향 KDB산업은행 앞` · 범례 `무대 1 — …“메인무대”입니다` · 범례 `무대3(LED) — …3구역 앞 무대입니다` · 범례 `코스콤지부 3구역 — …“집회 3구역”입니다` · `집회장소 내 코스콤지역 (3구역)` · `현장에서 지부 깃발을 확인해 주세요.` · `주최측 배포 안내자료`

- **블록 1**: `참석 시간 18:30 ~ 20:30` · `본대회 19:00 개회` · `장소 국회의사당역 3번 출구 → 여의도공원 방향 KDB산업은행 앞` · 히어로 `18:30` — 종전과 같음 ✓
- **QR 카드**: 링크 `https://prpage153.mycafe24.com/bank701/index.php` (`target="_blank"` · `rel="noopener noreferrer"`) · `figcaption` `주최측 배포 안내자료` · 주석기호 문단 2건 — 종전과 같음 ✓
- **지도**: 범례 7행 + 안내 문단 전부 종전과 같음 ✓ · 네이버 지도 타일·인증 **전부 200**

##### ⚠ `RallySchedule.tsx` — **곧 별개 라운드에서 바뀔 예정.** 지금 값을 기준선으로 남긴다

현재 **3열**(`시간` / `금융노조 공식 순서` / `코스콤 조합원 일정`) · 데이터 행 **16행** · 각주 `상황에 따라 식순 변경 가능`.
코스콤 열 값: `17:40~18:30 퇴근 후 집결장소 이동` / `18:30~18:50 참석명단 작성 및 물품 수령` / `18:50~19:00 시작 출석체크` / `19:00~20:30 결의대회 행사` / `20:20~20:30 종료 출석체크` / `20:30~ 투쟁용품 반납 및 해산`.
★ **이 표가 바뀌면 §5.6 대로 «텍스트 확대 200% 를 다시 재야 한다»** — 지금은 360·390·1280 에서 기여 0 이지만, 열이 늘거나 문자열이 길어지면 즉시 바뀐다.

---

### 미검증 항목 — 4건

| # | 항목 | 사유 |
|---|---|---|
| **U-1** | **체크리스트 423 — 실기기 핀치 4배 확대 판독** | 물리 제스처를 재현할 수 없다. **대리 확인은 했다**: `branch-layout-2.png` 의 `currentSrc` 가 **원본 그대로**이고 `naturalWidth 1209` 라 확대해도 도착지가 원본이다(`unoptimized` 실효). 그러나 **«4배에서 읽히는가»는 실기기 확인이 남는다** |
| **U-2** | **냉캐시 모바일의 `srcset` 후보 선택** | 이 세션은 1280 을 먼저 거쳐 `w=1080` 이 캐시에 있었고, 360 재탐색에서도 브라우저가 그것을 재사용했다. `sizes="…, 100vw"` 상 **냉캐시 360 에서는 `640w`(WebP 155,522 B)** 가 선택돼야 하나 **직접 관측하지 못했다.** 게시 조건이 아니라 전송량 항목이다 |
| **U-3** | **F-1·F-2 수정 후 회귀** | 아직 수정 전이다. **재빌드·재기동 후 §5.5 대로 다시 잰다** |
| **U-4** | 체크리스트 422 의 **«육안 2인»** 중 2인째 | 위 G 참조 — 나는 1인이고 3배 확대 사본으로 읽었다 |

---

### 범위 밖 관찰 — 3건 (이번 라운드가 만든 것이 아니다)

| # | 내용 | 근거 |
|---|---|---|
| **O-1** | **320px 급 뷰포트 + 200% 에서 문서 가로 스크롤이 있다.** `clientWidth 305`(뷰포트 320 · 스크롤바 15) → **18px** / `clientWidth 320`(실기기 320 상당) → **3px**. 원인은 **블록 1 `<dl>` 의 `dd` 3칸**(`참석 시간`·`본대회`·`장소`) | `display:none` 으로 갈랐다 — 블록 1 을 숨기면 **0**. **블록 2 를 숨겨도 그대로 18px** 이라 이번 작업과 무관. 선언된 시험폭(360·390·1280) 밖이다. **FOLLOWUPS 후보** |
| **O-2** | **제목 레벨 건너뜀 `h2 → h5`** (`지도 데이터`) | 네이버 지도 위젯이 자기 DOM 에 넣는 제목이다. 우리 마크업 아님. 기존 상태 |
| **O-3** | 200% 에서 **요소 단위 넘침이 블록 1·지도 위젯에 다수** 있다(예 `<dl>` 51px · `text-hero` 13px · 지도 내부 171px). 전부 카드 패딩·`overflow:hidden` 안에서 흡수돼 문서 스크롤 0 | 이번 라운드 무관. **다만 «문서 스크롤 0» 하나만 보는 게이트가 이런 것을 못 잡는다는 점은 기록해 둔다**(F-1 이 바로 그 사례다) |

---

### 리더 판정이 필요한 항목 — 2건

| # | 항목 | 왜 리더 판정인가 |
|---|---|---|
| **L-QA-1** | **재빌드·재기동 시점** | §5.5 빌드 동결 규율상 **QA 가 임의로 서버를 갈지 않는다.** 권고는 **«F-1 수정 후 1회»** — F-1(`figcaption` 2줄)과 F-2(재빌드만 필요)를 묶으면 왕복이 1회로 끝난다 |
| **L-QA-2** | **체크리스트 422 의 «육안 2인» 을 충족으로 볼 것인가** | 나는 1인이고, 8.8px 글자를 **3배 확대 사본**으로 읽었다. §36.12-12 는 *"못 읽으면 실패가 아니라 리더에게 보고"* 라고 했고 **나는 읽혔다** — 그래도 조건 문면과 내 관측 방식이 다르다는 점은 리더가 판정할 몫이다 |

---

### 정적 검사

| 명령 | 결과 |
|---|---|
| `npm run lint` | **exit 0** (출력 없음) |
| `npx tsc --noEmit` | **exit 0** (출력 **0바이트**) |
| 타입 우회 탐지 (`as any` · `as unknown` · `@ts-ignore` · `@ts-expect-error` · `eslint-disable`) — `page.tsx` | **0건** |

---

### 부록 A (2026-08-26 · 같은 회차 · 리더 지시 3건 반영)

> **이 부록은 위 본문을 지우지 않는다.** 회수·보류되는 항목은 **표기로만** 처리한다.
> 입력: 리더 메시지 3건 — ① 디자이너 §36.13-2 표의 독립 재측정 요구 · ② `map.png` 캡션 문면 변경(사용자 확정) · ③ `figcaption` 2곳을 리더가 수정 + 재기동 시점 확정.

#### A-0. 빌드 동결 재확인 (측정 전 · §5.5)

| 항목 | 1회차 | **부록 A 측정 시** | 판정 |
|---|---|---|---|
| `BUILD_ID` | `7cBCxEplj7YSM8vHHeK-h` | **동일** | ✓ |
| `.next/server/app/rally-2026-08-28.html` sha256 | `4e3fd5d5…1d60e3` | **동일** | ✓ |
| 서버 PID | 78347 | **동일** | ✓ |
| 슬롯(360 · 루트 32px · 스크롤바 15) | 201.00 | **201.00** | ✓ 디자이너 §36.13-2 와 같은 조건 |
| `document.visibilityState` / `document.fonts.status` | visible / — | **visible / `loaded`** | ✓ |

★ **소스는 그 사이에 바뀌었다**(`page.tsx` mtime **16:28:15** > 빌드 16:10:44). 리더가 `figcaption` 2곳에 `break-words` 를 넣은 것을 **소스에서 확인했다**(`page.tsx:300`·`:365` — `"mt-3 break-keep break-words text-caption text-ink"`).
→ **지금 빌드 ↔ 소스 차이는 3곳**(`figcaption`×2 + 산문 ⑤)이다. 의도된 상태이고, **아래 측정은 전부 «변경 전 빌드» 기준선**이다.

---

#### A-1. ★ 디자이너 §36.13-2 표 — **독립 재측정.** 8행 중 7행 일치, 1행 불일치

**측정 조건**: 360 뷰포트 · `clientWidth 345` · 스크롤바 15px · 루트 `32px` · **슬롯 201px** · `document.fonts.ready` 대기 후 · DPR 1
**측정 방법 2가지를 교차**했다 — ⓐ **실물 요소**에 `word-break`/`overflow-wrap` 을 얹어 `scrollWidth − clientWidth` ⓑ **고정폭 201px 클론 박스**. 두 값이 모든 행에서 일치했다.

★ 이 빌드는 **⑤·캡션1·캡션2 가 실제로 `break-keep` 단독**이라 **3행은 시뮬레이션이 아니라 직접 관측**이다.

| 줄 | `break-keep` 단독 — **디자이너** | `break-keep` 단독 — **QA 실측** | 판정 | `+break-words` (QA) |
|---|---|---|---|---|
| ① `코스콤지부는 집회 3구역입니다.` | **8px 넘침** | ★ **5px 넘침** (min-content **206.2**) | ⚠ **3px 불일치 · 결론은 같다** | **0** ✓ |
| ② 경로 문장 | 0 (min 194) | **0** (min **193.8**) | ✓ | 0 |
| ③ 방위 단서 | 0 (min 194) | **0** (min **193.8**) | ✓ | 0 |
| **④ 다리 문장** | **110px** (min **311**) | **110px** (min **311.1**) | ✓ **소수점까지 일치** | **0** ✓ |
| ⑤ 지부천막 | 0 (min 156) | **0** (min **155.6**) — **직접 관측** | ✓ | 0 |
| ⑥ 깃발 확인 | 0 (min 124) | **0** (min **124.5**) | ✓ | 0 |
| 캡션 1 (현행 22자) | 0 (min 166) | **0** (min **165.8**) — **직접 관측** | ✓ | 0 |
| **캡션 2 `금융노조지부배치도`** | **32px** (min **233**) | **32px** (min **233.4**) — **직접 관측** | ✓ | **0** ✓ |

**→ 디자이너의 판정은 전부 선다.** 원인 진단(«길이가 아니라 공백 개수»)도 실측과 맞다:
캡션 1 은 21자·공백 2개 → 최장 덩어리 **165.8px** / 캡션 2 는 9자·공백 0개 → 통째로 **233.4px**.

##### ⚠ 불일치 1행 — ① `8px` vs `5px`. **덮지 않고 적는다**

| 확인 항목 | 값 |
|---|---|
| `document.fonts.status` | **`loaded`** (측정 전 `await document.fonts.ready`) |
| `font-family` (실측) | `"Pretendard Variable", Pretendard, -apple-system, …` |
| `font-size` / `font-weight` / `letter-spacing` | **40px** / **600** / **-0.4px** |
| 최장 덩어리 | `3구역입니다.`(7자) · `코스콤지부는`(6자) · `집회`(2자) |
| 실물 요소 측정 | **5px** |
| 고정폭 201px 클론 측정 | **5px** (높이 186px → `break-words` 시 248px) |

두 측정법이 같은 값을 냈고 웹폰트도 로드 완료 상태였다. **가장 그럴듯한 원인은 디자이너 측정이 `document.fonts.ready` 이전(폴백 글꼴은 더 넓다)이었던 것**이나, **단정하지 않는다 — 미확인으로 남긴다.**
★ **처방·판정은 어느 값이든 같다**: ①은 `break-keep` 단독이면 **넘치고**, `break-words` 가 그것을 **0으로 만든다.** 체크리스트 **430**(①의 `break-words` 를 빼지 마라)은 **내 실측으로도 선다.**

##### 기여분 분리 (`display:none` · 리더 지시)

**문서 가로 스크롤 기준으로는 블록 2 의 어떤 줄도 기여가 없다** — 6줄·캡션 2개·그림 2장·카드 전체를 하나씩 숨겨도 **전부 0**(본문 E절). 위 표의 «넘침»은 **슬롯(201px) 기준 초과**이고, 카드 `p-5`(40px)가 흡수해 문서 스크롤로는 나타나지 않는다.
→ **판정선을 «문서 스크롤 0» 이 아니라 «각 줄이 자기 슬롯 안인가» 로 써야 한다.** 이 회차의 F-1 이 정확히 그 사례다.

---

#### A-2. ★ 문면 변경에 따른 **보류·재측정 표기** (리더 지시)

사용자 확정: `map.png` 캡션 **`주최측 배치도 (코스콤지부가 위치 표시)` → `배치도`**.

| 본문 항목 | 새 상태 | 사유 |
|---|---|---|
| A절 문안 게이트 — **`map.png` 캡션 축자 대조** | ⛔ **보류(회수)** | `EXPECTED-STRINGS.txt` 의 «map.png 캡션» 항목이 죽었다. 새 문면 확정 후 리더가 다시 뜬다 |
| A절 문안 게이트 — **산문 ④ 축자 대조** | ⛔ **보류(회수)** | ④가 캡션의 `주최측 배치도` 를 부르고 있어 **함께 재작성 중**이다 |
| A절 문안 게이트 — `official` 캡션 · `alt` 2건 · 산문 ⑤ (**4건**) | ✅ **유효** | 문면 변경 대상이 아니다 |
| §44 조건 **2**(캡션 머리 `주최측 배치도` 보존) | ⛔ **보류** | 조건 자체가 재작성 대상이다 |
| §44 «묶여 움직이는 쌍 1»(조건 2↔1) | ⛔ **보류** | 캡션에서 `주최측 배치도` 가 사라지면 **④가 가리킬 이름이 없어진다** — 재작성이 이 결속을 어떻게 다시 세우는지가 다음 게이트의 핵심이다 |
| §44 «쌍 2»(조건 9↔5 · `도로 위`·`길가`) | ✅ **유효** | 영향 없음 |
| **A-1 표의 ④ 행(110px)** | 🔁 **재측정 대상** | 문면이 바뀌면 최장 덩어리가 바뀐다. **`금융노조지부배치도의`(10자·311.1px)가 새 문면에도 남는지**가 관건이다 |
| **A-1 표의 캡션 1 행** | 🔁 **재측정 대상** | 22자 → 3자. 아래 A-3 에 **예측치**를 미리 실측해 두었다 |
| E절 «200% 넘침 0» · 360/390/1280 · CLS · `unoptimized` · `q=90` · 자산 픽셀 동일 · 404 · lint/tsc | ✅ **유효** | 문면과 무관 |

---

#### A-3. 신 캡션 문면 `배치도`(3자) — **미리 실측했다. 넘칠 수 없다**

같은 조건(루트 32px · `text-caption`)에서 고정폭 클론으로 측정:

| 슬롯 | `break-keep` 단독 | `break-keep break-words` | 높이 |
|---|---|---|---|
| **201px** (360 뷰포트 · 스크롤바 15) | **초과 0** | **초과 0** | 45px → **45px (변화 0)** |
| **161px** (320 뷰포트 · 최악) | **초과 0** | — | — |

min-content **77.8px** 이라 이 페이지에서 나올 수 있는 어떤 슬롯보다도 좁다. → **캡션 1 은 문면 변경 후 넘침 위험이 구조적으로 0** 이다.

##### 리더 질문에 대한 답 — **`figcaption` 둘 다에 붙이는 것이 맞다**

| 근거 | 실측 |
|---|---|
| **비용이 0 이다** | 캡션 1 **현행 22자**: `keep-all` 135px → `+break-word` **135px**(변화 **0**) · **신 문면 3자**: 45px → **45px**(변화 **0**) |
| **한쪽만 붙이면 근거가 문면에 매달린다** | 캡션 1 의 «안 넘친다»는 **지금 문면이 짧아서**다. 문면은 이 라운드에만 **두 번** 바뀌었다(22자 → 3자). 다음 사람이 문면을 늘리면 조용히 깨진다 |
| **`break-words` 는 발동 조건이 «달리 끊을 수 없을 때» 뿐이다** | 안 넘치는 7개 줄 전부에서 `keep-all` 과 `keep-all+break-word` 의 **높이·초과가 동일**했다(A-1 표) |

→ **리더의 조치(둘 다)가 옳다.** 재측정 때 «캡션 1 높이 변화 0» 을 확인하겠다는 약속은 **위 표로 미리 이행했다** — 현행 문면·신 문면 **둘 다 0** 이다.

---

#### A-4. ★★ 리더 체크리스트 **440**(배너 도메인) — **정정이 필요하다**

리더 전달: *"`docs.google.com` 은 `break-keep` 으로 못 막으니 **`break-all`** 이어야 하고, `break-keep` 으로 대체돼 있으면 **실패**"*.
**앞부분은 내 실측과 맞다. 뒷부분(처방)은 좁다.**

측정: 슬롯 **201px** · 루트 32px · 문자열 `docs.google.com`(라틴 15자·공백 0) · 고정폭 실물 박스

| `word-break` / `overflow-wrap` | Tailwind 표기 | 슬롯 초과 | 높이 |
|---|---|---|---|
| `normal` / `normal` | (없음) | **30px** | 45px |
| `keep-all` / `normal` | `break-keep` | **30px** | 45px |
| **`keep-all` / `break-word`** | **`break-keep break-words`** | **0** ✓ | 90px |
| `keep-all` / `anywhere` | — | **0** ✓ | 90px |
| **`break-all` / `normal`** | **`break-all`** | **0** ✓ | 90px |

같은 문자열을 `text-body` 급으로 재도 결과 방향은 같다(`break-keep` 단독 **76px 초과** → `break-keep break-words` **0** / `break-all` **0**).

**→ `break-words` 도 라틴 낱말을 막는다. `break-all` 만이 유일한 처방이 아니다.**
- 체크리스트 440 을 *"`break-all` 이어야 하고 `break-keep break-words` 면 실패"* 로 쓰면 **정상 구현을 «틀린 실패»로 반려한다.**
- **판정선을 «슬롯 초과 0» 으로 써야 한다.** 그러면 두 처방 다 통과한다.
- 둘 중에는 **`break-keep break-words` 를 권한다** — `break-all` 은 **넘치지 않는 짧은 라틴 낱말도 아무 데서나 끊는다**(예 `QR`·`LED`·`KDB`). `break-words` 는 **달리 끊을 수 없을 때만** 발동한다. 이 페이지는 `LED`·`KDB`·`QR`·`SC` 를 본문에 쓰므로 차이가 실제로 난다.

⚠ **`min-content` 폭으로 이 판정을 하지 마라 — 내가 처음에 그렇게 재서 틀릴 뻔했다.**
명세상 **`overflow-wrap: break-word` 는 min-content 크기에 영향을 주지 않는다**(`anywhere` 만 영향을 준다). 그래서 min-content 로 재면 `break-keep` 과 `break-keep break-words` 가 **모든 줄에서 같은 값**으로 나와 *"`break-words` 는 아무것도 안 한다"* 는 **거짓 결론**이 나온다.
→ **반드시 «고정폭 박스의 `scrollWidth − clientWidth`»로 재라.** A-1 표의 두 측정법 교차가 이것을 걸러냈다.

---

#### A-5. 결의대회 순서표 — 변경 예정 확인 (리더 지시 3)

리더가 별개 라운드 승인을 알렸다: **투쟁조끼 → 총파업머리띠** · **`20:30~` 이 `해산` 만 남음**.
본문 H절에 **현행 값 전문을 기준선으로 박아 두었다**(3열 · 데이터 16행 · 코스콤 열 6개 구간). 그 라운드 QA 는 따로 돈다.
★ **표가 바뀌면 §5.6 대로 텍스트 확대 200% 를 다시 재야 한다.** 현재 360·390·1280 에서 순서표의 문서 스크롤 기여는 **0** 이지만, **320px 급에서는 이미 블록 1 이 3~18px 을 밀고 있어**(본문 O-1) 여유가 크지 않다.

---

#### A-6. 부록 A 이후 갱신된 판정 요약

| | 1회차 | **부록 A 반영 후** |
|---|---|---|
| 통과 | 34 | **32** (문면 변경으로 2건 보류 이관) |
| 실패 | 2 | **1** — **F-1 은 리더가 소스에서 해소**(`page.tsx:300`·`:365`). **F-2(빌드↔소스)만 남고, 재빌드 시 함께 해소된다** |
| 보류(회수) | 0 | **2** — `map.png` 캡션 축자 · 산문 ④ 축자 |
| 재측정 대상 | 0 | **2** — 산문 ④ 넘침(문면 변경) · 캡션 1 넘침(A-3 에 예측 실측 완료) |
| 미검증 | 4 | **4** (U-1 핀치 · U-2 냉캐시 · U-3 회귀 · U-4 육안 2인째) |
| 범위 밖 관찰 | 3 | **3** |
| **리더 판정 필요** | 2 | **1** — L-QA-2(육안 2인). **L-QA-1(재기동 시점)은 리더가 확정했다** |
| **QA→리더 정정 제안** | — | **1** — 체크리스트 **440** 의 처방을 «`break-all` 필수» 가 아니라 «슬롯 초과 0» 으로 (A-4) |

**재빌드·재기동 알림을 받으면 다음을 돌린다**: 360·390·1280 × (기본·200%) 문서 가로 스크롤 · 줄별 슬롯 초과 8행 · **캡션 1 높이 변화 0** · 새 캡션/④ 문면 축자 3계층 게이트 · CLS · `q=90` 산출물 · 자산 404 · lint/tsc.

---

### 부록 B (2026-08-26 · **구현 전 사전 실측**) — 라운드 2 확정 문면 12건

> `EXPECTED-STRINGS.txt` 가 **라운드 2 확정본(A~L 12건)** 으로 교체됐다.
> **아직 구현되지 않은 문면까지 미리 쟀다** — 개발자가 클래스를 한 번에 맞출 수 있도록.
> 측정은 **동결된 현행 빌드 위에서 클론 박스**로 했으므로 빌드를 건드리지 않았다(측정 전후 `BUILD_ID`·sha256·PID 동일).

#### B-0. 측정 조건

루트 **32px**(200%) · `document.fonts.ready` 대기 후 · DPR 1 · **고정폭 실물 박스**의 `scrollWidth − clientWidth`
슬롯 3종: **216px**(360 실기기·스크롤바 0) · **201px**(360 데스크톱·스크롤바 15 = 디자이너 조건) · **161px**(320 최악)

##### ★ 측정법 교차 검증 — 구 산문 ④를 대조군으로 넣었다

| | 디자이너 §36.12-7 | **QA 실측** |
|---|---|---|
| 구 ④ `금융노조지부배치도의 「LED무대 2…」는 주최측 배치도의 무대3(LED)입니다.` · 슬롯 201 | **110px 넘침** | **110px** |

→ **내 측정법이 디자이너와 같은 값을 낸다는 것이 확인됐다.** (부록 A 의 ① 3px 불일치는 측정법 차이가 아니다 — 여전히 미확인.)

---

#### B-1. 문면 12건 × 슬롯 3종 — **슬롯 초과(px)**

`keep-all` = `break-keep` 단독 / `+bw` = `break-keep break-words` / `b-all` = `break-all`

| # | 문면 | 급(200% 실측) | 216 | 201 | 161 | +bw (전 슬롯) | b-all |
|---|---|---|---|---|---|---|---|
| **A** | `배치도` (신 map 캡션) | caption 30px | **0** | **0** | **0** | 0 | 0 |
| **B** | `금융노조지부배치도` | caption 30px | **17** | ★ **32** | ★ **72** | **0** | 0 |
| **E** | **산문 ④ 신 문면** | body 36px | **0** | **0** | ★ **37** | **0** | 0 |
| ref | 산문 ④ **구 문면**(대조군) | body 36px | 95 | **110** | 150 | 0 | 0 |
| **F** | 산문 ⑤ | body 36px | 0 | 0 | **0** | 0 | 0 |
| **G** | 상품권 조건 (64자) | body 36px | 0 | 0 | ★ **4** | **0** | 0 |
| **H** | 배너 제목 `참석 예비조사` | lead 40px | 0 | 0 | 0 | 0 | 0 |
| **I** | 배너 필수 문장 | body 36px | 0 | 0 | 0 | 0 | 0 |
| **J** | **배너 도메인 줄** | caption 30px | **15** | ★ **30** | ★ **70** | **0** | **0** |
| **J** | 같은 줄을 body 급으로 쓴다면 | body 36px | **61** | ★ **76** | ★ **116** | **0** | **0** |
| **K** | 식순 물품 수령 | body 36px | 0 | **7** | ★ **47** | **0** | 0 |
| **L** | 식순 `해산` | body 36px | 0 | 0 | 0 | 0 | 0 |

**높이 비용**(슬롯 201 · `keep-all` → `+bw`): A 45→45 · **B 45→90** · **E 367.2→367.2(변화 0)** · F 428.4→428.4 · G 612→612 · H 124→124 · I 244.8→244.8 · **J(caption) 135→180** · K 244.8→244.8 · L 61.2→61.2
→ **넘치지 않는 줄에서는 `break-words` 의 높이 비용이 정확히 0 이다**(9행 중 7행). 값이 바뀌는 것은 실제로 넘치던 B·J 뿐이다.

---

#### B-2. ★ 산문 ④ 신 문면 — **`break-words` 를 유지하라** (부록 A 의 «재측정 대상» 해소)

| | 구 문면 | **신 문면** |
|---|---|---|
| 문면 | `금융노조지부배치도의 「LED무대 2(산업은행 삼거리)」는 주최측 배치도의 무대3(LED)입니다.` | `「LED무대 2(산업은행 삼거리)」와 「무대3(LED)」는 같은 무대입니다.` |
| 글자수 | 53 | **42** |
| **최장 덩어리** | **`금융노조지부배치도의` 311.1px** | **`「무대3(LED)」는` 197.8px** |
| 슬롯 201 초과 | **110px** | **0** |
| 슬롯 161 초과 | 150px | ★ **37px** |

신 문면의 덩어리 전수(body 36px): `「무대3(LED)」는` **197.8** · `무대입니다.` 164.7 · `2(산업은행` 157.9 · `「LED무대` 138.8 · `삼거리)」와` 117.9 · `같은` 62.2
→ **최장 덩어리가 113.3px 줄었다.** 문면 재작성이 넘침 원인을 구조적으로 제거했다.

**판정**: 360·390·1280 에서는 `break-words` 없이도 **0** 이다. 그러나
- **320px 급에서 37px 넘친다** — §5.5 *"최악 조건에서 성립하는가"*
- **높이 비용이 0 이다**(367.2 → 367.2)
- ②③과 달리 ④는 **괄호·낫표·라틴이 섞여** 앞으로도 덩어리가 길어지기 쉽다

→ **`mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink` 를 그대로 유지할 것을 권고한다.** 빼야 할 근거가 없다.

---

#### B-3. ★★ 배너 도메인 줄(J) — **체크리스트 440 의 처방을 «슬롯 초과 0» 으로 써 달라**

문면 `외부 링크(새 창) · docs.google.com` 의 덩어리는 `docs.google.com`(**라틴 15자·공백 0**) 하나다.

| 처방 | caption 급 슬롯 201 | body 급 슬롯 201 | 판정 |
|---|---|---|---|
| (없음) `normal` | 30px 초과 | — | ✗ |
| `break-keep` 단독 | **30px 초과** | **76px 초과** | ✗ **리더 지적대로 못 막는다** |
| **`break-keep break-words`** | **0** ✓ | **0** ✓ | **통과** |
| `break-keep` + `overflow-wrap:anywhere` | 0 ✓ | — | 통과 |
| **`break-all`** | **0** ✓ | **0** ✓ | **통과** |

**→ `break-all` 만이 유일한 처방이 아니다. `break-words` 도 라틴 낱말을 끊는다.**
체크리스트 440 을 *"`break-all` 이어야 하고 `break-keep break-words` 면 실패"* 로 쓰면 **정상 구현을 «틀린 실패»로 반려한다.**

**권고**: 판정선을 **«슬롯 초과 0»** 으로 쓰고, 처방은 **`break-keep break-words` 를 우선**한다.
근거 — `break-all` 은 **넘치지 않는 짧은 라틴 낱말도 아무 데서나 끊는다.** 이 페이지 본문에는 `LED`·`KDB`·`QR`·`SC`·`IBK`·`KB` 가 있고, 배너 줄에도 `QR` 이 온다(문면 I). `break-words` 는 **달리 끊을 수 없을 때만** 발동해 그 부작용이 없다.

##### ⚠ 이 판정을 `min-content` 폭으로 하지 마라 — 내가 처음에 그렇게 재서 틀릴 뻔했다

명세상 **`overflow-wrap: break-word` 는 min-content 크기에 영향을 주지 않는다**(`anywhere` 만 영향을 준다). min-content 로 재면 `break-keep` 과 `break-keep break-words` 가 **모든 줄에서 같은 값**으로 나와 *"`break-words` 는 아무것도 안 한다"* 는 **거짓 결론**이 나온다.
→ **반드시 «고정폭 박스의 `scrollWidth − clientWidth`»로 재라.** 부록 A·B 는 전부 그 방법이다.

---

#### B-4. 식순 물품 수령(K) — **문구가 길어져도 레이아웃 영향 0.** 실측으로 확인했다

`투쟁조끼`(4자) → `총파업머리띠`(6자)는 덩어리를 **103.7px → 163.3px** 로 키운다. 그런데 표 구조가 그것을 흡수한다:

| 조상 | 클래스 | `overflow-x` | 폭 | `scrollWidth` |
|---|---|---|---|---|
| `<table>` | **`w-full table-fixed`** | visible | 201 | **378** |
| 부모 `<div>` | **`overflow-x-auto`** | **auto** | 201 | 378 |
| 카드 | `rounded-panel … p-5` | visible | 281 | 281 |

**`table-fixed` + `w-full` 이 표를 슬롯에 못박고, `overflow-x-auto` 래퍼가 넘침을 카드 «안의» 가로 스크롤로 받는다.** 그래서 문서 가로 스크롤에 기여가 없다.

**실측 스왑**(현행 셀의 텍스트 노드에서 `투쟁조끼` → `총파업머리띠` 로 바꿔 재측정):

| | 문서 가로 스크롤 | 표 폭 | 셀 폭 | 셀 내부 초과 | 섹션 초과 |
|---|---|---|---|---|---|
| 전(`투쟁조끼`) | **0** | 201 | 46.6 | 171 | 0 |
| 후(`총파업머리띠`) | **0** | 201 | 46.6 | **171** | 0 |

**모든 값이 동일하다.** 셀의 `scrollWidth`(218px)를 정하는 덩어리가 `총파업머리띠,`(163.3px)보다 넓은 다른 조각이라 최댓값이 바뀌지 않았다.
→ **K·L 변경은 200% 레이아웃 회귀 위험이 없다.** 다만 §5.6 대로 **열 수가 바뀌면(지금 3열) 이야기가 달라진다** — 이번 변경은 열 수를 안 건드린다는 전제다.

---

#### B-5. 개발자에게 넘기는 클래스 권고 (실측 근거 포함)

| 문면 | 권고 클래스 | 근거 |
|---|---|---|
| **A** map 캡션 `배치도` | `mt-3 break-keep break-words text-caption text-ink` | 초과 0 이지만 **캡션 2와 형태를 맞춘다.** 높이 비용 0(45→45). 근거가 «지금 문면이 3자라서»에 매달리지 않게 한다 |
| **B** official 캡션 | `mt-3 break-keep break-words text-caption text-ink` | **`break-words` 필수** — 없으면 201에서 32px · 161에서 72px |
| **E** 산문 ④ 신 문면 | `mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink` (**현행 유지**) | 320급 37px · 높이 비용 0 |
| **F** 산문 ⑤ | 같음 (**현행 유지**) | 전 슬롯 0 |
| **G** 상품권 조건 | `break-keep break-words` 포함 | 161에서 4px · 비용 0 |
| **H** 배너 제목 | `break-keep` 로 충분 | 전 슬롯 0 |
| **I** 배너 필수 문장 | `break-keep` 로 충분 | 전 슬롯 0 |
| **J** 배너 도메인 줄 | **`break-keep break-words` 필수** | 없으면 caption급 30px · body급 76px. `break-all` 도 되지만 `QR`·`LED` 를 아무 데서나 끊는다 |
| **K·L** 식순 | 현행 표 구조 그대로 | 스왑 실측 결과 영향 0 |

---

#### B-6. 부록 B 시점의 미검증·보류 갱신

| 항목 | 상태 |
|---|---|
| 부록 A 의 «산문 ④ 재측정 대상» | ✅ **해소** — B-2 |
| 부록 A 의 «캡션 1 재측정 대상» | ✅ **해소** — A-3 · B-1(A행) |
| 문안 축자 3계층 게이트 (신 A~L 12건) | 🔁 **재빌드 후 실행 대상.** 지금은 **문면 폭만** 쟀고 **산출물 대조는 못 했다**(구현 전) |
| G·H·I·J·K·L 의 **급(font-size) 가정** | ⚠ **미검증 전제** — 구현이 아직 없어 `text-caption`/`text-body`/`text-lead` 중 무엇을 쓸지 모른다. **B-1 은 3개 급을 다 재 두었으니** 구현이 정해지면 해당 행을 읽으면 된다 |
| U-1 핀치 · U-2 냉캐시 · U-4 육안 2인째 | 변동 없음 |

---

### 부록 C (2026-08-26 · 리더 판정 반영 + **부록 B-3 자체 정정**)

> 입력: 리더 판정 4건(L-QA-1 · L-QA-2 · 440 정정 채택 · min-content 불일치 기록 지시) · `dev1` 회신 2건.
> 빌드는 여전히 동결이다 — 측정 전후 `BUILD_ID 7cBCxEplj7YSM8vHHeK-h` · 프리렌더 sha256 `4e3fd5d5…` · PID 78347 **불변**.

---

#### C-1. ★★ **부록 B-3 의 측정법 경고를 정정한다 — 디자이너가 옳았다**

부록 B-3 에서 나는 이렇게 적었다:
> *"`overflow-wrap: break-word` 는 min-content 크기에 영향을 주지 않는다. min-content 로 재면 거짓 결론이 난다."*

**이 문장은 반만 맞았다.** 두 사람이 «min-content» 라는 **같은 이름으로 다른 양**을 재고 있었다.

| 정의 | 방법 | 산문 ④ 구 문면 `keep-all` → `+break-word` |
|---|---|---|
| **A. 디자이너 §38.3** | **`width: 0` 요소의 `scrollWidth`** | **311 → 31** |
| **B. 내 부록 B** | `width: min-content` 요소의 rect | **311.1 → 311.1** |
| **C. 참값(판정에 쓴 것)** | 고정폭 **201px** 박스의 `scrollWidth − clientWidth` | **110px 초과 → 0** |

전수 대조(Chrome 151 · 루트 32px):

| 대상 | A `keep-all` | A `+bw` | B `keep-all` | B `+bw` | **C 슬롯201 초과** |
|---|---|---|---|---|---|
| 산문 ④ 구 문면 | 311 | **31** | 311.1 | 311.1 | **110 → 0** |
| 산문 ④ 신 문면 | 198 | 31 | 197.8 | 197.8 | 0 → 0 |
| 상품권 조건 | **165** | **31** | 164.7 | 164.7 | 0 → 0 |
| 캡션 2 | 233 | **26** | 233.4 | 233.4 | **32 → 0** |
| 배너 도메인 줄 | 231 | **26** | 230.6 | 230.6 | **30 → 0** |

##### 결론 — **A(디자이너 방식)가 옳고, B(내 방식)를 쓰면 안 된다**

1. **`break-keep` 단독 열에서는 A 와 B 가 같다**(311 ↔ 311.1 · 233 ↔ 233.4 · 165 ↔ 164.7). 반올림 차이뿐이다.
2. **`+break-words` 열에서만 갈린다.** A 는 **실제로 렌더될 수 있는 최소 폭**(31·26)을, B 는 **CSS 내재 min-content 크기**를 낸다. 명세상 `overflow-wrap: break-word` 는 내재 크기에 영향을 주지 않으므로 **B 는 «스펙상 맞는 값»이지만 «질문에 대한 답»이 아니다.**
3. **참값 C 와 부호가 맞는 것은 A 다.** `A ≤ 슬롯` 이면 초과 0 이고, 5행 전부에서 그렇다. **B 로 판정하면 `break-words` 가 걸려 있어도 «넘친다»는 거짓 실패**가 난다(④ 구 문면 311.1 > 201 인데 실제 초과는 0).
4. **리더가 인용한 «165px → 31px»(§38.4 상품권 문장)도 내 측정과 정확히 일치한다** — A 방식으로 **165 → 31**.

→ **디자이너 §38.3 의 *"눈으로 세지 말고 `scrollWidth`(width:0 상태의 min-content)를 재라. 그것이 유일한 참값이다"* 는 옳다.**
→ **부록 B-3 의 «min-content 로 재지 마라» 는 «`width: min-content` 로 재지 마라» 로 좁혀 읽어야 한다.** `width: 0` 의 `scrollWidth` 는 써도 된다 — 오히려 그것이 표준이다.
→ ⚠ **불일치는 여기서 닫는다. 리더가 «지금 가리지 않는다»고 했으나 결정적 증거가 나왔으므로 열어 두지 않는다.** 두 방식이 같은 판정을 내는 이유까지 위에 적었다.

##### 이 정정이 바꾸는 것 / 안 바꾸는 것

| | |
|---|---|
| **안 바뀐다** | **본문·부록 A·부록 B 의 모든 판정.** 전부 **C(고정폭 박스)** 로 냈다. 부록 B-1 의 «슬롯 216/201/161 초과» 표도 전부 C 다 |
| **바뀐다** | 부록 B-3 의 «측정 함정» 문구. **«min-content 금지»가 아니라 «`width:min-content` 금지»** 다 |
| **권고 측정법** | ① 판정은 **고정폭 슬롯 박스의 `scrollWidth − clientWidth`** ② 여유 계산은 **`width:0` 의 `scrollWidth`** ③ **`width:min-content` 는 `break-words` 가 걸린 줄에 쓰지 마라** |

---

#### C-2. L-QA-2(체크리스트 422 «육안 2인») — **충족. 닫는다**

| 관찰자 | 방법 | 결과 |
|---|---|---|
| **1인째 = QA(`qa1`)** | `branch-layout-2.png` 을 **624 CSS px 로 축소 → 3배 확대** 판독 | `코스콤(한국증권전산)지부` **읽힘** · 위치가 `alt` 진술과 일치 |
| **2인째 = 리더** | **동일 방법**(624px 축소 → 3배 확대) · 독립 관찰 | `LED무대 2 (산업은행 삼거리)` · `한국산업은행지부` · **`코스콤(한국증권전산)지부` 읽힘** · 위치 일치(`한국산업은행지부` 다음 줄 · `SC제일은행지부` 오른쪽) · 사이드바 `코스콤(1)`·`산업은행 인도` 도 읽힘 |

★ **⚠ 이 통과를 «실기기에서 읽힌다»로 인용하지 마라.** 두 관찰 모두 **«렌더 축소 후 확대 판독»** 이고 **«실기기 육안»이 아니다.** 실제 화면의 글자 높이는 **약 8.8px**(§36.12-3)이고, 그 크기를 맨눈으로 읽는 것은 **여전히 미검증**이다(본문 U-4 → 방법 한정으로 존치).
→ 본문 G절·미검증 U-4 는 **«2인 충족 · 단 방법은 렌더 확대 판독»** 으로 갱신한다.

---

#### C-3. 체크리스트 440 — **리더가 정정을 채택했다. 확정 문면을 기록한다**

| | 확정 |
|---|---|
| **판정선** | **«슬롯 초과 0».** 처방을 문자열로 고정하지 않는다 |
| 처방 우선순위 | **`break-keep break-words`** |
| **예외 — 도메인 줄만 `break-all`** | 근거는 «필수»가 아니라 **기존 선례 승계**(`WayfindingBlock` · `QrAttendanceCard` · 온누리 카드가 전부 도메인 줄에 쓴다) |
| ⚠ 금지 | **`break-all` 을 다른 줄로 넓히지 마라** — 넘치지도 않는 `QR`·`LED`·`KDB`·`SC` 를 아무 데서나 끊는다. **배너 필수 문장에 `QR` 이 온다** |

**QA 판정 방식**: 도메인 줄이 `break-all` 이든 `break-keep break-words` 든 **초과 0 이면 통과**로 적는다. 다만 **선례 승계가 지시이므로, `break-all` 이 아닌 다른 값이면 «통과(설계 지시와 다름)»으로 리더에게 보고**한다 — 실패로 적지 않는다.

---

#### C-4. F-1 수정 요청 회수 · 빌드↔소스 차이 재확정

**`dev1` 에게 보낸 F-1 수정 요청을 회수했다.** 사유: 리더가 16:28:15 에 이미 고쳤고, `dev1` 은 이 라운드에서 파일에 손대지 않았다.
`dev1` 회신으로 확인된 사실 — **F-1 과 F-2 는 같은 원인**이다:

| | 소스 | 3000 이 내주는 것 |
|---|---|---|
| `figcaption` ×2 (`page.tsx:300`·`:365`) | `break-keep break-words` | **`break-keep` 만** |
| 산문 ⑤ (`:545`) | `break-keep break-words` | **`break-keep` 만** |
| 산문 ④ (`:517`) | `break-keep break-words` | **동일** ← 그래서 ④만 내 측정이 소스와 맞았다 |

→ **본문 실패 F-1 을 «미수정 결함»이 아니라 «F-2 와 동일한 빌드 지연»으로 재분류한다. 실패는 실질 1건(F-2)이고, 재빌드 1회로 해소된다.**
⚠ **재분류가 F-1 의 실측을 무효화하지 않는다** — 캡션 2 의 32.4px 초과는 **그 빌드에서 실제로 일어난 일**이고, `break-words` 가 필요하다는 근거로 그대로 선다.

---

#### C-5. O-1(320px + 200% 가로 스크롤) — **FOLLOWUPS 이관 확정**

리더 승인. 선언 시험폭(360·390·1280) 밖이라 **이번 게시를 막지 않는다.**
이관할 때 **원인 특정 결과를 함께 넘긴다**: `clientWidth 305` → **18px** / `clientWidth 320` → **3px** · 원인은 **블록 1 `<dl>` 의 `dd` 3칸**(`참석 시간`·`본대회`·`장소`) · **블록 2 를 숨겨도 값이 그대로**라 이번 작업과 무관.

---

#### C-6. 재빌드 후 회귀 측정 계획 — **리더 예고 7항목 + QA 항목**

재빌드·재기동은 **`dev2` 완료 후 리더가 1회** 수행하고 **리더가 직접 알린다.**
⚠ **그때 측정 대상은 «블록 2 단독»이 아니다** — 배너 신규 + 순서표 변경 + 캡션/④ 문면 교체가 함께 실린다.
→ **넘침이 나오면 `display:none` 격리로 기여분을 갈라 블록 2 몫을 분리한다**(본문 O-1 에서 쓴 방법).

| # | 항목 | 기준 |
|---|---|---|
| **R-1** | 캡션 1 이 22자 → 3자(`배치도`) | 200%에서 **3줄 135px → 1줄 45px**(디자이너 예측) 확인. 내 사전 실측은 **45px**(부록 B-1 A행)이라 일치 예상. `mt-3`:`mb-6` = **1:2** 귀속 비율 재확인 |
| **R-2** | ★ **캡션 1 의 `break-words` 높이 변화 0** | 리더가 «둘 다 붙인다»를 정당화한 근거다. **0 이 아니면 그 근거가 틀린 것.** 내 사전 실측은 현행 22자 135→135 · 신 문면 45→45 (부록 A-3) |
| **R-3** | 배너가 새 최상단 요소 — `18:30` 이 **360×640 안에 남는지** | **`today` phase 를 반드시 함께 잰다**(여유 30.1px 예측 · 빠듯). ⚠ **`past` 는 배너가 `null`** |
| **R-4** | 배너 도메인 줄 | **판정선 = 슬롯 초과 0**(C-3). `break-all` 이 아니면 «통과(설계 지시와 다름)»으로 보고 |
| **R-5** | ★ 접근성 이름(체크리스트 448) | **`aria-label`·`title` 이 `null` 인 것만 보고 넘어가지 않는다.** **계산된 접근성 이름**에 `당일 QR 출석체크는 따로 해야 합니다.` 가 **포함되는지** 확인 |
| **R-6** | 순서표 | 본문 H절 기준선 대비 **3열 · 16행 · `rowSpan` 합 16** 유지 + **200% 재측정**(§5.6 — 내용이 줄어도 잰다) |
| **R-7** | 문안 3계층 게이트 | 새 `EXPECTED-STRINGS.txt` **A~L 12건** 축자. `grep -c` 금지 · `alt` 는 속성으로 따로 |
| **R-8** | (QA) F-2 해소 확인 | 산출물의 `figcaption`×2 · 산문 ⑤ 가 **`break-keep break-words`** 인지 — 위치 기준 대조(문자열 존재 검사로는 안 갈린다) |
| **R-9** | (QA) 회귀 | 360·390·1280 × (기본·200%) 넘침 · 줄별 슬롯 초과 · CLS · **`q=90` 산출물**(`q=100`→400 대조군 포함) · 자산 404 3건 · 픽셀 동일 · `lint`/`tsc` |
| **R-10** | (QA) 측정 환경표 | 루트 글꼴 실측 · `innerWidth − clientWidth` · `visibilityState` · rAF · `BUILD_ID`·자산 해시 **측정 전후** |

---

#### C-7. 부록 C 시점 판정 요약

| | 값 |
|---|---|
| 통과 | **32** (문면 변경 보류 2건 제외) |
| **실패** | **1** — **F-2(빌드↔소스 3곳)**. F-1 은 C-4 로 F-2 에 흡수 재분류 |
| 보류(회수) | 2 — `map.png` 캡션 축자 · 산문 ④ 축자 |
| 재측정 대상 | **0** — 부록 B 에서 2건 다 해소(사전 실측 완료) |
| 미검증 | **3** — U-1 실기기 핀치 · U-2 냉캐시 후보 선택 · **U-4 «실기기 육안»**(2인 충족했으나 방법이 렌더 확대 판독) |
| 범위 밖 관찰 | 3 (O-1 은 FOLLOWUPS 이관 확정) |
| 리더 판정 대기 | **0** — L-QA-1·L-QA-2 둘 다 닫혔다 |
| QA 자체 정정 | **1** — 부록 B-3 측정법 경고(C-1) |

**게시 블로커는 없다.** 남은 실패 F-2 는 **소스가 이미 옳고 재빌드 1회로 해소**된다.

---

### 부록 D (2026-08-26 · **슬롯 가정 정정**) — 자리가 정해지고 보니 내 B-1 표의 슬롯이 틀렸다

> `dev2` 가 상품권 문장(G)을 **`QrAttendanceCard.tsx`** 에 넣었다(소스 확인). 그 자리의 **실제 슬롯을 재 보니 내가 부록 B-1 에서 쓴 슬롯과 다르다.**
> 빌드는 여전히 동결(`BUILD_ID`·sha256·PID 불변)이고, 측정은 동결 빌드 위 클론 박스다.

#### D-1. ★ 이 페이지에는 **슬롯이 두 종류** 있다 — B-1 은 한 종류만 썼다

| 자리 | 구조 | 360·sb0 | **360·sb15** | 320·sb15 |
|---|---|---|---|---|
| **카드 안** (`rounded-panel … p-5`) | 컨테이너 `px-4` **+ 카드 `p-5`** | 216 | **201** | 161 |
| **카드 밖** (컨테이너 `px-4` 만) | 컨테이너 `px-4` | 296 | **281** | 241 |

**차이는 `p-5` 양쪽 = 80px** 이다(루트 32px 기준).

**실측으로 확인**:
- 블록 2 = **카드 안** — `rounded-panel shadow-card mt-6 bg-bg p-5 md:p-8` · `figure` 폭 **201**
- **QR 출석체크 섹션 = 카드 «밖»** — `rounded-panel` **없음**(전수 검색 0건) · `figure` 폭 **281** · 그 안의 기존 `<p>` 3개 폭도 전부 **281**

⚠ **부록 B-1 은 슬롯 216/201/161(= 카드 «안»)만으로 쟀다.** 블록 2 문면(A·B·E·F)은 실제로 카드 안이라 맞지만, **아직 자리가 없던 G·H·I·J 에는 그 슬롯을 그냥 갖다 썼다.** 그것이 틀렸다.

---

#### D-2. **정정 — G(상품권 조건)는 실제 자리에서 모든 뷰포트에서 초과 0**

측정: `width:0` `scrollWidth` = **165**(`keep-all`) / **31**(`+break-words`)

| 슬롯 | 296 | **281 (실제 자리)** | 241 | 216 | 201 | 161 |
|---|---|---|---|---|---|---|
| `keep-all` 단독 초과 | 0 | **0** | **0** | 0 | 0 | **4** |

★ **`4px 초과` 는 슬롯 161 = «카드 안 · 320급» 값이고, G 는 카드 안에 있지 않다.**
G 의 실제 자리에서 320급 슬롯은 **241** 이고 거기서도 **초과 0** 이다(min 165 ≪ 241).

→ **정정**: 부록 B-1·B-5 가 G 에 붙인 근거 *"161에서 4px 초과"* 는 **실제 자리에 해당하지 않는다.**
→ **`break-keep break-words` 자체는 그대로 둬도 된다** — 높이 비용이 **0**(612 → 612)이고 형태 일관성 이득이 있다. **다만 «넘치니까 필요하다»가 아니라 «비용 0 인 보험»으로 근거를 바꿔야 한다.**
⚠ `QrAttendanceCard.tsx` 소스 주석이 내 B-1 수치를 *"161(320급)에서 4px 초과"* 로 인용하고 있다. **그 주석의 근거 문구를 고쳐야 한다** — 다음 사람이 «넘치던 줄»로 읽으면 자리를 옮길 때 잘못 판단한다.

---

#### D-3. ★★ **배너 J(도메인 줄) — 처방 필요 여부가 «배너에 카드가 있느냐»로 갈린다**

`외부 링크(새 창) · docs.google.com` · `width:0` `scrollWidth` = **231**(caption급) / **277**(body급)

| 배너 구조 | 급 | 296 | **281** | **241 (320급)** | 216 | **201** |
|---|---|---|---|---|---|---|
| **카드 밖** | caption | 0 | **0** | **0** | — | — |
| **카드 밖** | body | 0 | **0** | ★ **36** | — | — |
| **카드 안** | caption | — | — | — | 15 | ★ **30** |
| **카드 안** | body | — | — | — | 61 | ★ **76** |

**판정선 «슬롯 초과 0»(체크리스트 440 확정) 기준으로:**

| 배너가… | 도메인 줄 급 | `break-*` 처방 |
|---|---|---|
| **카드 밖** | **caption** | **없어도 초과 0** — 그래도 선례 승계로 붙이는 것은 무해 |
| **카드 밖** | body | ★ **필요**(320급 36px) |
| **카드 안** | caption | ★ **필요**(201에서 30px) |
| **카드 안** | body | ★ **필요**(201에서 76px) |

→ **4경우 중 3경우에서 필요하다.** 어느 구조든 **`break-all`(선례 승계) 또는 `break-keep break-words` 를 붙이면 전부 0** 이므로, **붙이는 것이 안전한 기본값**이다.
→ ⚠ **QA 는 «클래스가 있는가»가 아니라 «그 자리의 실제 슬롯에서 초과 0인가»로 판정한다**(440 확정 판정선). 재측정 때 **배너의 실제 슬롯을 먼저 재고** 위 표의 해당 행을 읽는다.

**H(배너 제목)·I(배너 필수 문장)** — 두 구조·전 슬롯에서 **초과 0**(H `width:0` 137 · I 156). 처방 불필요.

---

#### D-4. 이 정정이 남기는 규율

> **«문면의 폭»만 재고 «그 문면이 앉을 슬롯»을 확인하지 않으면, 맞는 숫자로 틀린 판정을 한다.**
> 이 페이지는 **같은 뷰포트에서 슬롯이 201 과 281 두 가지**다(카드 `p-5` 80px 차이). 구현 전 사전 실측은 **자리가 미정이라 슬롯도 미정**이므로, **후보 슬롯을 전부 재 두거나 «어느 슬롯 기준인지»를 표에 명시해야 한다.**
> 부록 B-1 은 명시하지 않았다 — 그래서 개발자가 카드 밖 자리에 카드 안 수치를 인용했다.

→ **부록 B-1 표는 «카드 안 기준»으로 읽어라.** 카드 밖 자리는 **이 부록 D 의 296/281/241 열**을 쓴다.
→ 재측정(R-4)에 **«배너·상품권 문장의 실제 슬롯을 먼저 실측한다»** 를 선행 조건으로 추가한다.

---

### 부록 E (2026-08-26 · 리더 판정 반영 + **배너 사전 실측** + 측정 실패 1건 자기 기록)

> 빌드 동결 유지: `BUILD_ID 7cBCxEplj7YSM8vHHeK-h` · 프리렌더 sha256 `4e3fd5d5…` · PID 78347 **불변**.
> `page.tsx` mtime 은 **16:57:30** 으로 움직였다(`dev2` 작업 중). **아래는 전부 «동결 빌드 위 프로브» 이거나 «소스 직접 확인» 이다.**

---

#### E-1. 리더 판정 반영 — `width:0` `scrollWidth` 를 **프로젝트 표준 측정법**으로 확정

리더가 부록 C-1 을 채택하고 **하네스 승격 대상**으로 올렸다. 리포트 쪽 기록:

| | 확정 |
|---|---|
| **표준 측정법** | **`width:0` 요소의 `scrollWidth`**(디자이너 §38.3 · 체크리스트 455) |
| 부록 B-3 의 경고 | **«`width:min-content` 로 재지 마라»** 로 좁혀 읽는다 |
| 판정에 쓰는 값 | **그 자리 슬롯 폭 박스의 `scrollWidth − clientWidth`** |

★ **이번 건의 성격은 §5.5(«같은 정의로 다른 값» — 스크롤바 오염)와 다르다.** 여기서는 **두 측정이 각자 정확했고 «이름»만 겹쳤다**(`min-content`). 리더가 별도 규율 후보로 세운 문장:
> **측정값을 보고할 때 «무엇을 쟀나»가 아니라 «어떻게 쟀나»를 함께 적는다. `min-content`·`표시 폭`·`슬롯` 은 구현이 여럿인 낱말이다.**

##### ★ R-8 함정의 계보 — 리더 요청으로 연결을 적어 둔다

**R-8**(*"`break-keep break-words` 의 «문자열 존재»만 보면 산문 ④가 이미 갖고 있어 «있다»가 나온다 → 요소 순서 대조로 재야 한다"*)는 이 프로젝트의 **`grep -c` 사고와 같은 계열**이다:

| 사고 | 무엇을 셌나 | 왜 틀렸나 |
|---|---|---|
| **`grep -c`**(전례) | 매칭된 **줄 수** | 미니파이 산출물은 **한 줄**이라 무엇을 세든 **1** |
| **R-8**(이번) | 클래스 문자열의 **존재 여부** | 같은 클래스를 **여러 요소가 공유**해 «누가 갖고 있나»를 못 가린다 |

→ **공통 규율: «세는 방법이 질문에 맞는가»를 먼저 본다.** 질문이 *"몇 번 나오나"* 면 `grep -o | wc -l`, *"어느 요소가 갖고 있나"* 면 **위치 기준 대조**다. **둘 다 «있다/없다»로는 안 갈린다.**

---

#### E-2. ⚠ 배송 오류 1건 — 부록 B 클래스 권고를 **`dev1` 에게 보냈다**(담당은 `dev2`)

부록 B-5 의 G~L 클래스 권고를 *"네가 지금 구현 중인 문면들"* 이라며 **`dev1`** 에게 보냈다. **과업 #7(배너·식순)은 `dev2` 담당**이고 `dev1` 은 리더가 라운드를 종료시킨 상태였다.
→ **부록 D 의 정정분(슬롯 · J 필요 여부 · H·I 불필요)은 `dev2` 에게 직접 보냈고, 나머지도 이 부록으로 닿게 했다.**
★ **기록으로 남기는 이유**: *"클래스는 쓰기 «전»에 닿아야 값을 한다"* — 사전 실측의 값어치는 **도착 시점**에 달려 있다. 수신자를 틀리면 측정이 옳아도 쓸모가 준다.

---

#### E-3. 블록 2 소스 — **직접 확인했다. 최종본이다**(`dev1` 진술 검증)

`dev1` 진술을 그대로 받지 않고 소스를 열어 대조했다:

| 항목 | 소스 | 판정 |
|---|---|---|
| `figcaption` ×2 | `page.tsx:350`·`:415` — **`mt-3 break-keep break-words text-caption text-ink`** | ✓ |
| map 캡션 문면 | `:351` — **`배치도`** | ✓ 신 문면 |
| official 캡션 문면 | `:416` — `금융노조지부배치도` | ✓ |
| 산문 ④ 문면 | `:605` — **`「LED무대 2(산업은행 삼거리)」와 「무대3(LED)」는 같은 무대입니다.`** | ✓ 신 문면 축자 |
| 산문 ④ 클래스 | `:604` — `mt-1 max-w-[var(--container-prose)] break-keep break-words text-body text-ink` | ✓ |
| 산문 ⑤ 문면·클래스 | `:633` / `:632` — 축자 + `break-keep break-words` | ✓ |

→ **부록 B-2 에서 «신 문면» 으로 잰 것이 소스의 현재 상태와 맞다.** 블록 2 는 **소스 = 최종본이고 남은 것은 빌드에 싣는 것뿐**이다(F-2).

---

#### E-4. ★ 배너(`PreSurveyBanner.tsx`) 사전 실측 — **슬롯이 «세 번째 값» 215px 이다**

부록 D-3 은 배너 구조를 «카드 안/밖» 두 경우로만 나눴다. **실제는 그 둘 중 어느 것도 아니다:**

```
page.tsx:137   <PreSurveyBanner/>        ← 블록 1 카드(:144) «앞» = 컨테이너 직속
PreSurveyBanner:104   <a class="rounded-card … block border bg-bg p-4">   ← 자기 카드를 «직접» 진다
```

**컨테이너 콘텐츠 281 − `p-4` 양쪽 64 − `border` 양쪽 2 = 215px.**
(⚠ 블록 1·2 카드는 `p-5`(80px)라 201 이다. **배너는 `p-4` 라 14px 더 넓다.**)

##### 측정 환경 검산 (§5.5)

| 항목 | 값 | 판정 |
|---|---|---|
| 컨테이너 콘텐츠 폭 | **281** | — |
| **검산: 블록 2 슬롯 실측** | **201** (기대 201) | ✓ **일치 — 이 환경에서 참값이 나온다** |
| 배너 바깥폭 / 안쪽 슬롯 | 281 / **215** | — |

##### 실측 (루트 32px · 슬롯 215 = 360·sb15)

| 줄 | 구현 클래스 | `width:0` | **슬롯 215 초과** |
|---|---|---|---|
| **제목(H)** `참석 예비조사` | `block break-keep break-words text-body font-bold text-primary` | 31 | **0** ✓ |
| **필수문장(I)** `당일 QR 출석체크는 따로 해야 합니다.` | `mt-1 block break-keep break-words text-body text-ink` | 31 | **0** ✓ |
| **도메인(J)** `외부 링크(새 창) · docs.google.com` | `mt-1.5 block break-all text-caption text-ink-muted` | — | **0** ✓ |

##### ★★ 도메인 줄 처방 대조 — **디자이너 «16px» 예측이 정확히 재현됐다**

| 처방 | 슬롯 **230**(360·sb0) | 슬롯 **215**(360·sb15) | 슬롯 **175**(320급) |
|---|---|---|---|
| 처방 없음 | 1 | ★ **16** | **56** |
| `break-keep` 단독 | 1 | ★ **16** | **56** |
| `break-keep break-words` | **0** ✓ | **0** ✓ | **0** ✓ |
| **`break-all` (현행 구현)** | **0** ✓ | **0** ✓ | **0** ✓ |

★ **`width:0` `scrollWidth` = 231 · 슬롯 215 → 231 − 215 = 16.** 디자이너 §37.7 의 **16px** 과 **정확히 일치**한다.
→ **디자이너의 `width:0` 방식이 참값을 낸다는 것이 이 건에서 다시 확인됐다**(E-1).
→ **체크리스트 440 예비 판정: 현행 `break-all` = 초과 0 → 통과.** `break-keep break-words` 도 0 이라 **440 정정(«판정선 = 슬롯 초과 0»)이 실측으로 뒷받침된다.**
→ ⚠ **`break-all` 을 이 줄 «밖»으로 넓히면 안 되는 근거도 소스 주석에 이미 들어가 있다**(`PreSurveyBanner.tsx:134-137` — *"이 줄에 `break-all` 을 쓰지 마라 — `QR` 이 온다"*). `dev2` 가 채택했다.

##### ⚠ 이 실측의 한계 — **프로브다. 재빌드 후 실물로 다시 잰다**

- 동결 빌드에 배너가 없어 **같은 클래스의 합성 프로브**로 쟀다. 실물 DOM 이 아니다
- **제목 줄의 `ExternalLinkIcon`(`size-4` = 32px)을 넣지 않았다.** 제목 `width:0` 이 31px 이라 여유가 크지만, **아이콘 포함 실물 측정은 R-4 에서 한다**
- `phase === "today"` 변형은 **테두리 색만** 바꾸므로 레이아웃 영향 0 으로 본다 — **이것도 R-3 에서 실물 확인**

---

#### E-5. ⚠ **내 측정 실패 1건 — 검산이 걸러냈다. 그대로 적는다**

배너 프로브 1차 시도에서 `<a>` 에 **`position:absolute` 를 직접 걸었다.** 그러면 `block` 이어도 **shrink-to-fit** 이 되어 폭이 콘텐츠 폭으로 잡힌다.
결과: **`배너안쪽슬롯 = 0`**, 파생 슬롯이 `0 / 15 / −40` 으로 나왔고 그 위에서 나온 «초과 31·16·36» 은 **전부 무의미**했다.

**어떻게 걸렀나**: §5.5 대로 **환경표를 먼저 봤다** — `안쪽슬롯 0` 은 CSS 상 나올 수 없는 값이다. 2차 시도에서 **래퍼를 절대배치하고 폭을 명시 · 프로브는 `static`** 으로 바꾸고, **«블록 2 슬롯이 201 로 나오는가»를 검산 기준**으로 붙였다. 201 이 나온 뒤에야 숫자를 채택했다.

★ **규율 재확인**: *"환경표가 기대와 다르면 그 위의 숫자를 전부 버린다."* 그리고 **검산 기준을 «이미 아는 값»으로 잡아야** 이런 것이 걸린다 — 이번에는 **이전 회차에 확정해 둔 «블록 2 슬롯 201»** 이 그 역할을 했다.

---

#### E-6. 부록 E 시점 요약

| | 값 |
|---|---|
| 실패 | **1** — F-2(빌드↔소스). 소스는 전부 최종본이고 **재빌드 1회로 해소** |
| 게시 블로커 | **0** |
| 리더 판정 대기 | **0** |
| QA 자체 정정 | **3** — C-1(측정법) · D-2(슬롯) · **E-5(프로브 환경 오류)** |
| 예비 통과(재빌드 후 실물 재확인 필요) | **3** — 배너 H·I·J 슬롯 215 초과 0 |
| 미검증 | 3 — U-1 실기기 핀치 · U-2 냉캐시 · U-4 실기기 육안 |

**R-1~R-10 은 그대로 유효하고, R-4 에 «배너 실물 슬롯 재확인 + 아이콘 포함» 을 추가한다.**

---

### 부록 F (2026-08-26 17:03 · **사고 기록**) — «구 서버 + 신 자산» 이 실제로 터졌다

> §5.5 가 *"서버와 자산이 따로 갈리는 구간이 실재한다 — 구 서버 + 신 자산은 **양쪽 다 정상으로 보이면서 조합만 틀리고, `BUILD_ID` 대조로도 안 잡힌다**"* 라고 경고한 바로 그것이 **이 회차 측정 도중에 발생했다.**
> 이 절은 **가설이 아니라 관측 기록**이다.

#### F-1. 무엇이 일어났나

**17:02:41 에 `next build` 가 완료됐고, 서버는 재기동되지 않았다**(PID **78347**, 기동 **16:09:09** 그대로 · 빌드 프로세스는 관측 시점에 이미 종료).

| 대상 | 값 |
|---|---|
| `BUILD_ID` | `7cBCxEplj7YSM8vHHeK-h` → **`7Q83JRa1kB-cMZaVythRF`**(mtime **17:02:41**) |
| **디스크** 프리렌더 sha256 | **`2b95a16e2fc56245ffa7…`** — 신 내용 |
| **서버 응답** sha256 | **`4e3fd5d585970c338a33…`** — **구 내용**(71,341 B · 16:10 빌드) |
| 서버 응답의 `>배치도<` | **0** (구 캡션 상태) |
| 디스크 프리렌더의 `>배치도<` | **1** (신 캡션) |

#### F-2. ★★ 실제 손상 — **CSS 404. 라이브 페이지가 스타일 없이 렌더된다**

서버가 내주는 HTML 이 부르는 정적 자산 **10건을 전수 요청**한 결과:

```
200  /_next/static/chunks/0cz1d0mv5g_q7.js        200  /_next/static/chunks/2gefo9ja1l2mo.js
200  /_next/static/chunks/0jvhpaew_uadu.js        200  /_next/static/chunks/3fntmmi971322.js
200  /_next/static/chunks/0lo-6m8wk9y39.js        404  /_next/static/chunks/3rbvg9yf5uf2u.css   ← ★
200  /_next/static/chunks/0x2xtjf9k0dvm.js        200  /_next/static/chunks/turbopack-1tg25lujh-urf.js
200  /_next/static/chunks/1ct2uo35_fr2j.js
200  /_next/static/chunks/1d8durn3f0db4.js
```

**JS 9건은 200 인데 CSS 1건만 404 다.** 디스크에는 새 이름 **`1zd0is_btk77_.css`** 만 있다.
→ **JS 청크는 이름이 겹쳐 살아남았고 CSS 만 해시가 갈렸다.** 그래서 **«거의 정상»처럼 보이는데 화면 전체가 무너지는** 조합이 됐다.

##### 왜 `BUILD_ID` 대조로 못 잡나

**서버는 자기 옛 `BUILD_ID` 와 옛 매니페스트를 메모리에 들고 있어 «자기 기준으로는 완전히 일관»** 하다. 디스크와 대조해야만 갈리는데, 그 대조는 **자산을 실제로 요청해 봐야** 나온다.
→ **잡아낸 것은 §5.5 의 «측정 전 정적 자산 전수 200» 스윕 하나다.** 그 항목이 없었으면 **스타일 빠진 화면을 «레이아웃 결함»으로 판정**했을 것이다.

#### F-3. 조치 — **재빌드 불필요. 재기동만 하면 된다**

디스크의 새 프리렌더는 **완전하고 정확하다**(전수 확인):

| 문면 | 새 프리렌더 |
|---|---|
| `>배치도<` | **1** ✓ |
| `「LED무대 2(산업은행 삼거리)」와 「무대3(LED)」는 같은 무대입니다.` | 2 ✓ |
| `코스콤지부 집결자리는 도로 위이고…` | 2 ✓ |
| `참석 예비조사` / `당일 QR 출석체크는 따로 해야 합니다.` | 2 / 2 ✓ |
| `docs.google.com` | 4 ✓ |
| `투쟁용품 수령 (총파업머리띠, 손피켓, 우천 시 우의 등)` | 3 ✓ |
| `참석명단 작성(지부천막)과…` / `금융노조지부배치도` | 2 / 2 ✓ |

그리고 **새 프리렌더가 부르는 자산 10건이 디스크에 전부 존재**한다(CSS 포함).
→ **서버 재기동 1회로 불일치가 사라진다.** §5.5 빌드 동결 규율상 **QA 가 서버를 건드리지 않았고, 리더에게 신호를 요청했다.**

⚠ **재기동 전 브라우저 새로고침 금지** — 열려 있는 탭은 옛 CSS 를 메모리에 들고 있어 아직 정상으로 보인다. 새로고침하면 스타일이 빠진다.

#### F-4. 기존 측정값에 미치는 영향 — **없다. 근거를 남긴다**

부록 A~E 의 모든 측정은 **17:02:41 이전**이다. 그것을 **사후에 증명할 수 있는 이유**:

> 각 측정의 환경표에 **슬롯 실측**(블록 2 = **201**)과 **루트 글꼴 실측**(**12px**/200% 시 **32px**)을 붙였고 **전부 기대값과 맞았다.**
> **CSS 가 죽으면 `px-4`·`p-5`·`text-*`·`html{font-size:75%}` 가 전부 사라져 201 도 12px 도 나올 수 없다.**
> → **검산 통과 자체가 «그 시점에 스타일시트가 살아 있었다»의 증거**다.

★ **이것이 §5.5 «검산 기준을 이미 아는 값으로 잡아라»의 두 번째 값어치다** — 측정 당시에는 «참값이 나오는가»를 보증하고, **사후에는 «그때 환경이 건전했는가»를 되짚는 근거**가 된다.

#### F-5. 이 사고가 남기는 규율 3가지

| # | |
|---|---|
| **1** | **«빌드 완료 ≠ 배포 완료».** `next start` 는 **기동 시점의 프리렌더·매니페스트·`next.config.ts`** 를 들고 있다. **빌드만 돌리면 디스크와 서버가 갈린다.** 이 프로젝트의 «빌드 교체 사고 3회» 계보에 **한 건 더** 붙는다 |
| **2** | **§5.5 «정적 자산 전수 200» 은 장식이 아니다.** 이번엔 **10건 중 1건(CSS)만** 404 였고 그 1건이 화면 전체를 바꾼다. **«대부분 200» 은 통과가 아니다** |
| **3** | ★ **JS 와 CSS 는 따로 갈릴 수 있다.** 콘텐츠 해시라 **바뀐 파일만 이름이 바뀐다** — 그래서 «자산이 통째로 갈리는» 형태가 아니라 **«한두 개만 갈리는»** 형태로 온다. 표본이 아니라 **전수**로 확인해야 하는 이유다 |

#### F-6. 상태

**측정 중단.** 재기동 신호를 받으면 **R-1~R-10** 을 돌린다. 그때는 측정 대상이 **블록 2 + 배너 + 순서표 + 상품권 문장**이므로 넘침 발생 시 **`display:none` 격리로 기여분을 가른다.**
**재기동 후 측정 전에 «정적 자산 전수 200» 을 다시 돌린다 — 이번 사고가 그것이 필수임을 보였다.**

---

#### F-7. ★★ 원인이 밝혀졌다 — **내가 잰 CSS 404 는 «증상»이고, 원인은 리더 쪽에 있었다** [리더 회신 병합]

리더가 `VERDICT-LEDGER.md` **§12** 에 기록한 것과 **같은 사고의 두 얼굴**이다. 한 항목으로 묶는다.

| | |
|---|---|
| **원인**(리더 §12) | 1차 재빌드 후 띄운 서버(**78347**)를 **정지하지 않은 채** 2차 재빌드 후 `npm run start` 를 다시 띄웠다. → **`EADDRINUSE` 로 즉시 죽었는데 종료코드가 `0`** 이었다. **실패 신호가 없었다.** 그래서 «내가 방금 띄웠다고 믿은 서버가 실은 안 떴다» |
| **증상**(내 F-2) | 낡은 프로세스가 계속 응답 → 서버 HTML 이 **없어진 CSS 해시**를 부른다 → **404** → 라이브 페이지가 **스타일 없이** 렌더 |

★ **믿음의 출처가 다르다.** §5.5 의 종전 기록은 *"어제 서버가 살아 있었다"*(잊고 있었다)인데, **이번은 «방금 띄웠다고 믿었다»**(틀린 확신)다. **후자가 더 위험하다 — 확인할 이유가 없다고 느끼기 때문이다.**

##### ★ 확인 3종 — **재기동 뒤에는 이 셋을 본다** (리더 §12 + 내 F-2 합본)

| # | 확인 | 왜 |
|---|---|---|
| ① | **서버 PID 가 기동 «전후»로 달라졌는가** (`lsof -nP -iTCP:<port> -sTCP:LISTEN -t`) · 로그에 **`EADDRINUSE` 0건** | ⚠ **종료코드 0 을 «성공»으로 읽지 마라** — `npm run start` 는 실패해도 0 을 낸다 |
| ② | ★★ **서버 응답 sha256 ↔ 디스크 프리렌더 sha256** | **가장 강하다.** `BUILD_ID` 는 서버가 **«자기 값»** 을 내므로 **자기모순을 못 잡지만**, sha256 대조는 **두 출처를 맞대므로** 잡는다 |
| ③ | **정적 자산 전수 200** | 이번 사고를 **실제로 잡아낸 것**. «대부분 200» 은 통과가 아니다 |

→ **부록 G-0 측정 환경표에 «서버 PID 기동 전후 대조» 를 항목으로 넣었다**(PID 78347 정지 → **83617** 기동 확인).
→ 이 세 줄은 **§5.5 «구 서버 + 신 자산» 계보의 확장**이다. `doc-commit` 때 리더 §12 와 함께 올린다.

#### F-8. 측정값 유효성 논증 — **리더 채택** [기록]

부록 A~E 의 모든 수치가 사고 «이전»이라는 것을 **사후에 증명한 방법**:

> 각 측정의 환경표에 **슬롯 실측**(블록 2 = **201**)과 **루트 글꼴 실측**(**12px** / 200% 시 **32px**)을 붙였고 전부 기대값과 맞았다.
> **CSS 가 죽으면 `px-4`·`p-5`·`text-*`·`html{font-size:75%}` 가 전부 사라져 201 도 12px 도 나올 수 없다.**
> → **검산 통과 자체가 «그 시점에 스타일시트가 살아 있었다»의 증거**다.

★ **검산 기준은 두 번 값을 한다** — 측정 당시에는 «참값이 나오는가»를 보증하고, **사후에는 «그때 환경이 건전했는가»를 되짚는 근거**가 된다. 그러려면 **검산 기준이 «이미 아는 값»이어야** 한다(이번엔 이전 회차에 확정한 «블록 2 슬롯 201»).

---

### 부록 G (2026-08-26 17:06~17:14 · **재기동 후 회귀 측정 R-1~R-10**) — 결론: **통과**

#### G-0. 측정 환경표 (§5.5 · §5.6)

| 항목 | 값 |
|---|---|
| 도구 | Playwright MCP (Chromium 151.0.7922.175 · headful · **새 탭**) |
| **★ 서버 PID — 기동 전후 대조**(F-7 ① 신설) | 사고 시 **78347** → **정지 확인** → 재기동 **83617**(17:03:52). **PID 가 실제로 바뀌었다** · `EADDRINUSE` 0건 |
| `BUILD_ID` | **`7Q83JRa1kB-cMZaVythRF`** — **측정 전후 동일** |
| **서버 응답 ↔ 디스크 프리렌더** | **sha256 `2b95a16e2fc56245ffa7…` 양쪽 동일**(73,768 B) |
| **★ 정적 자산 전수** | **10건 전부 200** (신 CSS `1zd0is_btk77_.css` 포함) — 부록 F 사고 재발 없음 |
| **빌드 ↔ 소스** | 빌드 이후 수정된 소스 **0건** |
| 루트 글꼴 실측 | **12px** (200% 정의 = `html{font-size:32px}`) |
| `visibilityState` / rAF / `document.fonts.status` | `visible` / 발화 / **`loaded`** |
| DPR / `maxTouchPoints` | 1 / 0 |
| `innerWidth − clientWidth` | 360→**15** · 390→**15** · 1280→**15** (이번 회차는 전 구간 15px 로 일정) |
| 슬롯 실측 | 블록 2: 360→**201** · 390→**231** · 1280→**624** / 배너 안쪽: 360·200%→**215** |

---

#### G-1. R-8 — **F-2 해소 확인. «위치 기준» 으로 갈랐다**

⚠ **문자열 존재 검사로는 안 갈린다**(같은 클래스를 여러 요소가 공유한다). **블록 2 요소를 순서대로** 떴다:

| # | 요소 | class | 내용 |
|---|---|---|---|
| 1 | `figcaption` | `mt-3 break-keep **break-words** text-caption text-ink` | `배치도` |
| 2 | `figcaption` | `mt-3 break-keep **break-words** text-caption text-ink` | `금융노조지부배치도` |
| 3 | `p` | `break-keep break-words text-lead text-ink` | ① |
| 4~7 | `p` | `mt-1/mt-3 max-w-[…] break-keep **break-words** text-body text-ink` | ②③④⑤ |
| 8 | `p` | `mt-1 break-keep break-words text-body text-ink` | ⑥ |

→ **`figcaption` 2곳 · 산문 ⑤ 전부 `break-words` 가 산출물에 실렸다. F-2 해소.**

#### G-2. R-9 — 문서 가로 스크롤 **6개 조합 전부 0**

| 뷰포트 | 기본 배율 | **200%** |
|---|---|---|
| **360** | **0** | **0** |
| **390** | **0** | **0** |
| **1280** | **0** | **0** |

**줄 단위 슬롯 초과도 전 구간 0** — 캡션 2개 · 산문 6줄 · 배너 3줄 전부(360·390·1280 × 기본·200%).
**기여분 격리**(200% · 360): 배너 · 블록 2 카드 · 순서표 · QR · 블록 1 섹션을 **하나씩 `display:none`** 해도 **전부 0**.

#### G-3. R-1 / R-2 — 캡션 1 문면 교체 결과

| | 200% · 슬롯 201 |
|---|---|
| 캡션 1 `배치도` | 초과 **0** · 높이 **45px**(1줄) |
| 캡션 2 `금융노조지부배치도` | 초과 **0** · 높이 **90px**(2줄 — `break-words` 가 실제로 발동) |

★ **R-2 판정: 캡션 1 에서 `break-words` 를 빼도 높이 45 → 45, 초과 0 → 변화 0.**
→ **리더가 «둘 다 붙인다»에 쓴 근거가 실물로 성립한다.** (부록 A-3 의 사전 실측과 일치)
종전 22자 캡션은 200%에서 **3줄 135px** 이었고 지금은 **1줄 45px** — **90px 이 줄었다**(디자이너 예측대로). 간격 비율은 1280 실측 `그림→캡션 9px : 캡션→다음 그림 18px` = **1:2 유지** ✓

#### G-4. R-3 — 배너 신설 후 `18:30` 이 360×640 안에 남는가

| phase | hero `18:30` bottom | 뷰포트(640) 여유 | 판정 |
|---|---|---|---|
| **`upcoming`**(실물) | 579.9 | **60.1px** | ✓ **디자이너 예측 60.1px 과 정확히 일치** |
| **`today`**(프로브) | 606.9 | **33.1px** | ✓ 뷰포트 안 (디자이너 예측 30.1px · **3px 차**) |
| **`past`** | — | — | ✓ **배너가 `null`** — `PreSurveyBanner.tsx:82` `if (phase === "past") return null;` 소스 확인 |

⚠ **`today` 는 프로브다**: 서버 날짜를 바꿀 수 없어 **배지 `<p class="mt-4"><span class="rounded-full bg-primary px-3 py-1 text-caption font-bold text-white">오늘</span></p>` 를 삽입하고 `h1` 을 `mt-4`→`mt-3` 으로** 바꿔 쟀다(소스 `page.tsx:97-105` 그대로). 밀림 **27px**. 복원 후 579.9 로 되돌아온 것을 확인했다.
디자이너와 **3px 차이**가 나지만 **둘 다 «뷰포트 안»** 이라 판정은 갈리지 않는다. (부록 A-1 의 ① 8px vs 5px 와 같은 방향 — 디자이너 수치가 조금씩 크다.)

#### G-5. R-4 — 배너 도메인 줄 (체크리스트 440)

**판정선 = «슬롯 초과 0»**(리더 확정). 200% · 배너 슬롯 **215px**:

| 처방 | 초과 | 높이 |
|---|---|---|
| **`break-all`(현행 구현)** | **0** ✓ | 135px |
| `break-keep break-words`(대안) | **0** ✓ | 135px |
| **처방 제거** | ★ **16px** | 90px |

★ **«16px» 이 디자이너 §37.7 예측·내 부록 E-4 프로브와 정확히 일치**했다.

##### 배너 슬롯 — **리더 추산 ≈217px, 실측 215px.** 차이는 `border` 다

리더 추산: `345 − px-4(64) = 281` → `− p-4(64)` = **217**.
실측 **215** — **`border` 1px 양쪽 2px** 이 빠졌다(`<a class="… block border …">`). **판정은 갈리지 않는다**(둘 다 «카드 안 201 과 카드 밖 281 사이»이고 처방 필요 구간).
★ 그래도 적어 두는 이유: **이 페이지에는 이제 슬롯이 «네 종류»다** — 카드 밖 **281** · 블록1·2 카드(`p-5`) **201** · 배너(`p-4`+`border`) **215** · 순서표 셀(`table-fixed`) **46.6**. 부록 D-4 의 규율(«어느 슬롯 기준인지 명시하라»)이 여기서 다시 걸린다.
→ **440 통과.** 그리고 **정정(«둘 다 통과»)이 실물로 재확인**됐다. 현행은 선례 승계대로 `break-all` 이다.
배너 3줄 전부 초과 0 · 제목/필수문장은 `break-keep break-words`(=`QR` 을 끊지 않는다) ✓

#### G-6. R-5 — 접근성 이름 (체크리스트 448) · **AX 트리에서 직접 읽었다**

```
link "참석 예비조사 당일 QR 출석체크는 따로 해야 합니다. 외부 링크(새 창) · docs.google.com"
  /url: https://docs.google.com/forms/d/e/1FAIpQLScWKY74TnGSHJGLjfdt5k7lkP_EMHaYQAVJnchfW9WdAm4KhA/viewform
```
→ **계산된 접근성 이름에 `당일 QR 출석체크는 따로 해야 합니다.` 가 포함된다** ✓
⚠ `aria-label`·`title` 은 **없다**(내용에서 계산된다). **속성이 `null` 인 것만 보고 실패로 적으면 틀린 판정**이 된다 — 리더 지적대로 계산된 이름을 봤다.
`target="_blank"` · `rel="noopener noreferrer"` ✓ · href 는 §45-1 에서 검증된 그 URL ✓

#### G-7. R-6 — 순서표 (AX 트리)

| 항목 | 값 |
|---|---|
| 열 | **3** (`시간` / `금융노조 공식 순서` / `코스콤 조합원 일정`) ✓ |
| 데이터 행 | **16** ✓ (기준선과 동일) |
| K 물품 수령 | `투쟁용품 수령 (**총파업머리띠**, 손피켓, 우천 시 우의 등)` ✓ |
| L 20:30 | `20:30~**해산**` ✓ (종전 `투쟁용품 반납 및 해산 · 투쟁용품 반납 (투쟁조끼) · 집회장소에서 반납` → **`해산` 만**) |
| caption | `※ 상황에 따라 식순 변경 가능` ✓ |
| 200% 재측정(§5.6) | **문서 넘침 기여 0** — 표는 `w-full table-fixed` + 부모 `overflow-x-auto` 로 카드 안에서 받는다 |

#### G-8. R-7 — 문안 3계층 게이트 **A~L 12건**

| | 결과 |
|---|---|
| 계층 ① 프리렌더 본문 | **12건 전부 출현** |
| 계층 ② 속성 텍스트 | `alt` 2건(C·D) **완전일치 1건씩** ✓ |
| 계층 ③ 위치 기준 태그 경계 | `>배치도<` **1** · `>금융노조지부배치도<` **1** · `>참석 예비조사<` **1** · `>당일 QR 출석체크는 따로 해야 합니다.<` **1** · `>해산<` **1** |

⚠ **측정 아티팩트 1건 — 결함 아님**: J(도메인 줄)가 «원시 소스 출현 0» 으로 나왔다. 원인은 **React 텍스트 분리 주석**이다:
```
외부 링크(새 창) · <!-- -->docs.google.com
```
같은 패턴이 기존 `map.naver.com` 줄에도 있다. **계층 ①(본문 1회) 과 AX 트리가 실물을 증명**하므로 통과로 적는다.

**금지 목록**(§44-6) 본문+속성 **0건** · **무수정 회귀 10건 전부 1회** · `map` `alt` 안 `코스콤지부` **0** / `코스콤 로고` **1** · `official` `alt` 가 `배치도` 로 시작하지 않음 ✓
**주석기호**: 섹션별 **3·1·2·5·2 = 13** — **1회차 기준선 13과 동일(증가 0)** · **블록 2 = 1개** ✓(체크리스트 432)
`인증샷` 1회는 **`QrAttendanceCard` 의 주최측 문안 전사**(기존·§44-8 인정) — **오탐, 위반 아님**.

##### ★ 결속 검사 — **쌍 1 은 «깨진» 것이 아니라 «설계가 바뀐» 것이다**

| 결속 | 결과 |
|---|---|
| **쌍 2**(조건 9↔5) `도로 위`·`길가` | 본문 1·1 / `map` `alt` 1·1 → **성립** ✓ |
| **쌍 1**(조건 2↔1) 캡션 머리 `주최측 배치도` ↔ 산문 ④ | 본문 `주최측 배치도` **1회**(지도 범례에만) |

★ **체크리스트 435 는 구 문면 기준이라 이제 적용되지 않는다.** 캡션이 `배치도` 로 바뀌고 산문 ④가 **`「LED무대 2(산업은행 삼거리)」와 「무대3(LED)」는 같은 무대입니다.`** 로 재작성되면서 **④가 캡션의 낱말로 그림을 부르지 않게 됐다.** 두 낫표 이름을 직접 등치시키는 방식이라 **캡션에 의존하지 않는다** — 결속 자체가 필요 없어졌다.
→ **판정: 해당 없음(설계 변경으로 소멸).** 실패로 적지 않는다. ⚠ **다만 «캡션 머리를 보존하라»(§44 조건 2)도 함께 죽었으므로, 그 조건을 근거로 캡션을 되돌리려는 시도가 나오면 이 절을 가리켜라.** 그 조건은 **사용자 지시로 죽은 것**이고, 살아 있는 절처럼 인용되면 **사용자가 걷어낸 문면이 되살아난다**(리더 확정 · 검증자 §47 동일 판정).

##### ★★ 그런데 결속은 «사라진» 것이 아니라 **«옮겨 갔다»** — 회귀 대상이 바뀐다 [검증자 §47 단서 · 리더 지시로 존치]

④는 이제 **캡션이 아니라 «그림 안 문자»에 걸린다.** 두 낫표 `「LED무대 2(산업은행 삼거리)」`·`「무대3(LED)」` 는 **`branch-layout-2.png` 와 `rally-layout-2.png` 안에 인쇄된 글자의 전사**다(§44-6 — 지명은 «그림 안 문자의 전사»로만 쓴다).

⚠ **그래서 다음 회귀 항목이 생긴다:**
> **이미지가 교체되면 ④의 두 낫표 이름을 그림에서 다시 대조해야 한다.**
> 캡션을 아무리 봐도 안 걸린다 — **대조 대상이 문서가 아니라 이미지 안의 픽셀**이다.

★ 이것은 §44-5 «묶여 움직이는 쌍» 이 **없어진 것이 아니라 상대가 바뀐 것**이다. 종전 쌍 1(캡션 ↔ ④)은 **문자열 대조로 자동 검사할 수 있었는데**, 새 결속(그림 안 문자 ↔ ④)은 **육안·판독으로만 검사된다.** **검사 비용이 올라갔다는 사실을 다음 사람이 알아야 한다.**
(쌍 2 — `도로 위`·`길가` ↔ `map.png` `alt` — 는 **여전히 문자열 대조로 검사된다.** 이번 회차 통과 ✓)

#### G-9. R-9 나머지 · 자산 · 정적 검사

| 항목 | 결과 |
|---|---|
| **CLS** | **0.00000** · `figure`/배너 높이 로드 전후 동일(293.9 / 425.9 / 96.3) |
| 깨진 이미지 / `alt` 없는 이미지 | **0 / 0** |
| **`q=90` 산출물** | 직접 요청 **200**(230,002 B) · `q=75` 200(131,772 B) · ★ **`q=100` → 400**(허용목록 작동 증명) · `srcset` `q=90` **9개** |
| 구판 자산 | `rally-layout.png` **404** · `official.jpeg` **404** · `official.png` **404** |
| 현행 자산 | `rally-layout-2.png` 200 · `branch-layout-2.png` **200 / 51,466 B**(`/_next/image` 미경유 = `unoptimized` 실효) · `qr-guide-2.jpg` 200 |
| **픽셀 동일** | `_workspace/official.png` ↔ 배포본 **다른 바이트 0**/6,038,955 · `map.png` ↔ 배포본 **0**/5,210,208 |
| `npm run lint` / `npx tsc --noEmit` | **exit 0 / exit 0** |
| 1280 간격 | `그림→캡션 9px : 캡션→다음 그림 18px` = **1:2** ✓ |

---

#### G-10. 최종 판정

| | |
|---|---|
| **실패** | **0** — F-2 는 재빌드·재기동으로 해소(G-1) |
| **게시 블로커** | **0** |
| 리더 판정 대기 | **0** |
| **미검증 3건(존치)** | **U-1** 실기기 핀치 4배 판독 · **U-2** 냉캐시 모바일 `srcset` 후보 선택 · **U-4** 실기기 «맨눈» 판독(8.8px) — 422 는 «렌더 확대 판독» 2인으로 충족했으나 방법이 다르다 |
| **프로브 1건(존치)** | **R-3 `today`** — 서버 날짜를 바꿀 수 없어 배지 삽입으로 쟀다. 여유 **33.1px**(디자이너 30.1px). **실물 `today` 는 당일에만 관측 가능** |
| 범위 밖(FOLLOWUPS) | **O-1** 320px급 200% 가로 스크롤 3~18px(원인: 블록 1 `<dl>` `dd` 3칸 · 블록 2 무관) |
| QA 자체 정정 | **4** — C-1 측정법 · D-2 슬롯 · E-5 프로브 환경 · **G-11 아래** |

#### G-11. ⚠ 자체 정정 4번째 — **섹션 경계 문자열이 유일하지 않게 됐다**

1회차에 블록 2 의 `※` 개수를 `본문.indexOf("코스콤지부 집결 위치") ~ indexOf("QR 출석체크")` 로 잘라 셌다.
**배너가 생기면서 `QR 출석체크` 가 배너 문장(`당일 QR 출석체크는 따로…`)에 더 «먼저» 등장**해 `i1 < i0` 가 되고 **슬라이스가 빈 문자열**이 됐다. 그래서 «블록 2 ※ = 0» 이라는 **거짓 값**이 나왔다.
→ **`<section>` 태그 경계로 다시 세어 «블록 2 = 1» 을 얻었고 AX 트리로 교차 확인**했다.
★ **이것도 R-8·`grep -c` 와 같은 계열이다** — *«경계·계수 방법이 질문에 맞는가»*. **텍스트 좌표로 자르는 방법은 새 콘텐츠가 들어오면 조용히 깨진다. 구조(태그)로 잘라야 한다.**

---

### 부록 H (2026-08-27 · 라운드 3·4·5 회귀) — 결론: **통과. 다만 «today 여유 14.7px» 을 리더 판단으로 올린다**

> ⚠ **검증자(verifier1)가 주간 한도로 종료돼 최종 게이트가 없다. 이 회귀가 유일한 게이트다.**
> 대상: **R-1** 배너 부제 신설 · **R-2·R-3** QR 링크 카드 제목 교체 + 안심 문장 신규 + 설명 교체 · **R-5** 식순 출석체크 note 2곳

#### H-0. 측정 환경표 (§5.5 · §5.6 · F-7 확인 3종)

| 항목 | 값 |
|---|---|
| 도구 | Playwright MCP (Chromium 151 · headful) |
| **① 서버 PID** | **15487**(2026-08-27 16:08:36 기동) · 종전 15186 정지 · `EADDRINUSE` 0 · **측정 전후 동일** |
| **② 서버 응답 ↔ 디스크 프리렌더** | 측정 시작 **`ac8a87da75b940c072571cc8` 양쪽 일치** · 측정 종료 **`bdc7ec6be5aedc17d5e86669` 양쪽 일치** (→ H-1) |
| **③ 정적 자산** | **10건 전수 200** · 측정 전후 동일 |
| `BUILD_ID` | **`ejlb7SD1zUGHc9UqIPonV`** · 측정 전후 동일 |
| `build-manifest` mtime / 빌드 이후 수정 소스 | 16:08:33 / **0건** |
| 루트 글꼴 실측 | **12px** (200% = `html{font-size:32px}`) |
| `visibilityState` / rAF / `fonts.status` | `visible` / 발화 / **`loaded`** |
| `innerWidth − clientWidth` | 360→15 · 390→15 · 1280→15 |
| **오늘 phase** | **`upcoming`**(집회 2026-08-28 · `daysUntilKst` = 1). **`today` 는 내일이다** |

---

#### H-1. ⚠ **자체 정정 5번째 — 내 F-7 «확인 3종» 의 ②에 오탐 모드가 있다**

측정 **전후**로 프리렌더 sha256 이 **`ac8a87da…` → `bdc7ec6b…`** 로 바뀌었다. §5.5 는 *"측정 전후 해시가 다르면 그 회차는 무효"* 라 **회차를 버릴 뻔했다.** 원인을 갈랐다:

| | 측정 전 | 측정 후 |
|---|---|---|
| 전체 바이트 | 74,400 | **74,400**(동일) |
| **가시 마크업 sha256**(`<script>` 제거) | **`db81eed2f9504b049782bc23`** (29,941자) | **`db81eed2f9504b049782bc23`** (동일) ✓ |
| 차이 구간 | **RSC flight 페이로드 내부 숫자 77자** — `,4608]}` → `,4256]}` / `,4192]}` | |

**Next.js 가 RSC 페이로드에 시간에 따라 변하는 캐시 수치를 넣는다.** 같은 빌드·같은 프로세스인데 **요청 시각만 달라도 해시가 바뀐다.**

##### → F-7 확인 3종을 이렇게 고쳐 읽어라

| | 상태 |
|---|---|
| **«서버 응답 sha256 == 디스크 프리렌더 sha256» (같은 시각 대조)** | ✅ **여전히 가장 강하다.** 이번에도 **두 시각 모두 일치**했다 — 둘이 **함께** 흔들렸을 뿐 어긋난 적이 없다 |
| **«측정 전후 sha256 동일» 을 빌드 동결 기준으로 쓰기** | ❌ **오탐 난다.** 이번이 그 사례다 |
| **빌드 동결의 참 기준** | **`BUILD_ID`** + **`build-manifest` mtime** + **«빌드보다 새 소스 0건»** · 콘텐츠 동결까지 보려면 **`<script>` 제거 후 해시** |

★ **부록 F-7 은 «두 출처를 맞대라» 가 요점이었고 그 부분은 그대로 옳다.** 틀린 것은 **«같은 해시가 시간이 지나도 유지된다»는 암묵 가정**이다. **대조는 «두 출처 사이»에 하는 것이지 «두 시각 사이»에 하는 것이 아니다.**

---

#### H-2. ★★ R-1 — `18:30` × 360×640. **선언 판정선 통과**

> ⚠⚠ **이 절은 [정정됨 2026-08-27]. 아래 표의 «14.7px» 은 스크롤바 15 조건(데스크톱)의 값이고, 실기기 참값은 «64.7px» 이다. 정정 근거와 참값 표는 H-2-정정(바로 아래)에 있다. 이 표는 회수 표기로 남긴다 — 지우면 «왜 두 값이 나왔나»를 다음 사람이 못 따라간다.**

| phase | `18:30` 아래끝 | 640 대비 여유 | 판정 |
|---|---|---|---|
| **`upcoming`**(지금 라이브) | 598.3 | **41.7px** | ✓ |
| **`today`**(프로브) | **625.3** | ★ **14.7px** | ✓ 뷰포트 안 |
| **`past`** | — | — | ✓ 배너 `null`(`PreSurveyBanner.tsx:82` 소스) |

디자이너 예측 **11.7px** ↔ 실측 **14.7px**(3px 차 · **지난 회차 30.1 vs 33.1 과 같은 방향·같은 폭**).

##### 부제 기여분 격리 (`display:none`) — **교차 검증까지 됐다**

| | `18:30` 아래끝 |
|---|---|
| `upcoming` · 부제 **숨김** | **579.9** ← **부록 G-4 의 `upcoming` 값과 정확히 일치**(회차 간 교차 검증 ✓) |
| `upcoming` · 부제 있음 | 598.3 |
| **부제 기여** | ★ **18.4px** |

→ **`today` 여유(14.7px)보다 부제 기여(18.4px)가 크다.** 부제가 없었다면 `today` 여유는 **33.1px**(부록 G-4 실측과 일치).

##### 뷰포트 높이 민감도 — **`today` 는 626px 부터 잘린다**

| 높이 | `today` 여유 | `upcoming` 여유 |
|---|---|---|
| **640**(선언 판정선) | **+14.7** ✓ | +41.7 ✓ |
| 620 | **−5.3** ✗ | +21.7 ✓ |
| 600 | −25.3 ✗ | **+1.7** ✓ |
| 580 | −45.3 ✗ | −18.3 ✗ |

⚠ **실기기 주소창이 layout viewport 를 깎는다.** 안드로이드 크롬은 **툴바가 보이는 상태로 첫 로드**되고 그때 가용 높이는 640 보다 작다(기기·브라우저별 60~120px). **그 조건의 `today` 에서는 `18:30` 이 첫 화면 밖으로 나간다.**

★ **선언 판정선(360×640) 밖이라 실패로 올리지 않는다.** 다만 **내일이 `today`** 이므로 가정이 아니다 → **리더 판단 항목으로 분리**(H-7).

---

#### H-2-정정. ★★ **위 수치는 스크롤바에 오염됐다. 실기기 참값은 `today` 여유 64.7px** [2026-08-27 · QA 자체 정정 6번째]

같은 값을 두 번 재서 **50px 차이**(598.3 vs 548.3)가 났다. §5.5 대로 **어느 쪽도 쓰지 않고 원인을 팠다.**

##### 원인 — **헤더가 두 줄로 접힌다. 방아쇠는 스크롤바다**

`header > div` 가 `flex-wrap` 이다. 실측 분해:

```
헤더 자식 폭 합   207.0(지부명 링크) + 108.2(글자크기 컨트롤) = 315.2
column-gap                                                  + 12
필요 폭                                                       327.2
컨테이너 좌우 패딩(px-4)                                       + 24
→ ★ 한 줄을 유지하려면 clientWidth ≥ 351.2px
```

| 조건 | `clientWidth` | 헤더 콘텐츠폭 | **헤더** | `18:30` 아래끝 |
|---|---|---|---|---|
| **스크롤바 0**(실기기 360 · **참값**) | **360** | 336 ≥ 327.2 | **68px · 한 줄** | **548.3** |
| 스크롤바 15(데스크톱) | 345 | 321 **< 327.2** | **118px · 두 줄** | **598.3** |

**차이 50px = 헤더 한 줄분.** `html{width:calc(100% - 15px)}` 로 **재현**했고 되돌리자 복귀했다.
★ **§5.5 가 경고한 폭 오염이다.** 이 프로젝트 규율상 **실기기는 오버레이 스크롤바(0)** 이므로 **참값은 스크롤바 0 쪽**이고, **H-2 본표는 전부 스크롤바 15 조건**이었다.

##### 정정된 4조합 — **전부 스크롤바 0(실기기 참값) · `scrollY 0` 검증 · 3초간 값 불변**

| | `18:30` 아래끝 | **640 여유** | 580 여유(툴바 60 가정) |
|---|---|---|---|
| `upcoming` · 부제 있음 **(라이브)** | 548.3 | **+91.7** | +31.7 |
| **`today` · 부제 있음 (2026-08-28)** | **575.3** | ★ **+64.7** | **+4.7** |
| `upcoming` · 부제 숨김 | 529.9 | +110.1 | +50.1 |
| `today` · 부제 숨김 | 556.9 | +83.1 | +23.1 |

**부제 기여 18.4px 는 그대로다**(548.3−529.9 · 575.3−556.9 둘 다 18.4) — 그 격리 결과는 **오염과 무관하게 유효**하다.

##### 실기기 가용 높이 — **못 잰다. 확정**

| 지표 | 값 |
|---|---|
| `clientHeight` / `innerHeight` / `visualViewport.height` | **640 / 640 / 640** |
| **`100dvh` / `100svh` / `100lvh`** | **640 / 640 / 640** |

★ **`svh` 와 `lvh` 가 같다는 것이 결정적이다** — 실기기라면 «툴바 보임(svh)» 과 «툴바 숨김(lvh)» 이 갈려야 한다. **데스크톱 크로미움에는 그 구분 자체가 없다.** → 실기기 가용 높이는 **미검증(측정 불가)** 으로 확정하고 후속으로 넘긴다.

##### ★★ 새 발견 — **첫 화면 예산에 «50px 절벽»이 있다** (후속 별도 항목 권고)

`clientWidth < 351.2px` 이면 헤더가 두 줄이 되고 **그 아래 전부가 50px 내려간다.**

| 기기 폭 | 헤더 | `today` `18:30` 아래끝 |
|---|---|---|
| 390 · 375 · **360** | 한 줄 | **575.3** (360 은 절벽에서 **8.8px 위** — 아슬아슬) |
| **320**(iPhone SE 1세대급) | **두 줄** | **625.3** |

⚠ 방아쇠는 **지부명 링크(207px) + 글자크기 컨트롤(108.2px)** 이고 **둘 다 글꼴·문자열 길이에 따라 변한다** — **문면이 한 글자만 늘어도 절벽이 이동한다.**
→ 이것은 **측정 불가 항목이 아니라 지금 잴 수 있고 고칠 수 있는 것**이다. 실기기 주소창 항목과 **분리해서** 후속에 올리기를 권한다.

##### 3px 계통차(디자이너 예측 ↔ QA 실측) — 원인 추적

배지 블록 분해(실측): `p.mt-4` margin **12px** + `p` 높이 **18px** − `h1` 마진차(`mt-4` 12 → `mt-3` 9 = **3px**) = **밀림 27px** ✓ (실측과 일치)

★ **`p` 높이가 18px 인 이유**: 배지 `<span>` 이 **`display: inline`** 이고 `padding: 3px 9px` 인데 — **인라인 요소의 세로 패딩은 줄 상자 높이를 늘리지 않는다.** `<p>` 높이는 자기 `line-height: 18px` 이 정한다(span 자체 rect 는 **19px** 로 줄 상자를 넘치지만 **레이아웃을 밀지 않는다**).
→ 디자이너 수치가 매번 **3px 큰** 것은 **배지를 21px 로 계산**(세로 패딩이 밀 것으로 봄)한 것으로 보인다. **인라인 패딩 함정**이고, 지난 회차 3px 과 이번 3px 이 **같은 값**인 것이 이것으로 설명된다.
⚠ **단정하지 않는다** — 디자이너 산식을 직접 보지 못했다. **«우리 실측은 27px, 인라인 세로 패딩은 레이아웃을 밀지 않는다»** 까지가 QA 가 보증하는 범위다.

##### 이 정정이 바꾸는 것 / 안 바꾸는 것

| | |
|---|---|
| **바뀐다** | H-2 의 `today` 여유 **14.7 → 64.7px** · 뷰포트 민감도 표(626px 잘림선 → **576px**) · H-7 «리더 판단 항목» 의 긴급도 |
| **안 바뀐다** | **부제 기여 18.4px** · H-4 문안 게이트 16건 · H-5 넘침 6조합 0 · H-3 접근성 이름 · H-6 회귀 전부 — **스크롤바 조건과 무관하거나 두 조건 모두에서 0** 이다 |

★ **왜 이 오염이 «폭» 이 아니라 «높이» 판정을 틀리게 했나** — §5.5 는 폭 오염을 폭 판정의 문제로 적었다. **이번엔 폭 오염이 `flex-wrap` 을 통해 높이로 번졌다.** 스크롤바 15px → 헤더 콘텐츠폭 −15 → 줄바꿈 → **높이 +50**. **폭 오염은 폭만 틀리게 하지 않는다.**

---

#### H-3. R-2·R-3 — QR 링크 카드. **접근성 이름 낭독 순서가 설계대로다**

**AX 트리에서 직접 읽은 계산된 이름**:
```
link "손피켓 QR인증 바로하기 손피켓이 없어도 이 링크로 인증할 수 있습니다.
      손피켓의 QR을 찍으면 나오는 출석체크 페이지와 같습니다. 지정된 출석 시간에만 체크됩니다.
      외부 링크(새 창) · prpage153.mycafe24.com"
  /url: https://prpage153.mycafe24.com/bank701/index.php
```
★ **안심 문장이 제목 «바로 다음»** — 검증 §50-3 이 지목한 위험(*제목만 스캔하고 건너뛰는 경로*)에 닿는 자리다. **통과.**
`aria-label` **`null`** · `title` **`null`** → 이름이 **내용에서 계산**됐음이 뒷받침된다 · `target="_blank"` · `rel="noopener noreferrer"` ✓

**배너 계산 이름**: `참석 예비조사 사내게시판과 SMS로 안내한 설문조사입니다. 당일 QR 출석체크는 따로 해야 합니다. 외부 링크(새 창) · docs.google.com` — **제목 → 부제 → 경고 → 도메인** ✓ (속성 둘 다 `null`)

---

#### H-4. 문안 게이트 **16건**(I-2·M·N·O 신설 포함)

계층 ① 프리렌더 본문 **16건 전부 출현** · 계층 ② `alt` 2건 **속성 완전일치** · 계층 ③ 위치 기준:

| 태그 경계 완전일치 | 개수 |
|---|---|
| `>손피켓 QR인증 바로하기<` · `>손피켓이 없어도 이 링크로 인증할 수 있습니다.<` · `>사내게시판과 SMS로 안내한 설문조사입니다.<` · `>배치도<` · `>참석 예비조사<` · `>해산<` | **각 1** |
| `>금융노조 출석QR코드<` | **2**(시작·종료) ✓ |

##### ★★ 리더가 예고한 부분문자열 함정 — **3방법 대조로 갈랐다**

구 설명 `QR을 찍으면 나오는 출석체크 페이지와 같습니다. 지정된 출석 시간에만 체크됩니다.` 는 **신 문면의 부분문자열**이다(앞에 `손피켓의 ` 만 붙었다).

| 방법 | 결과 |
|---|---|
| 단순 개수 | **2** ← ★ **«남아 있다»로 오판한다** |
| 부정 후방탐색 `(?<!손피켓의 )` | **0** ✓ |
| **태그 경계 완전일치** `>…<` | **0** ✓ |
| 참고: 신 문면 `손피켓의 …` | 2 |

→ **구 설명 완전 제거 확인.** 이것도 **`grep -c`·R-8·G-11 과 같은 계열**이다 — *«세는 방법이 질문에 맞는가»*.

**사라져야 하는 것** 태그 경계 **전부 0**: `>QR 인증 바로 하기<` · `>담당 운영위원 및 금융노조 출석QR코드<` · `>주최측 배치도 (코스콤지부가 위치 표시)<` · `>투쟁조끼<`. **`담당 운영위원` 은 페이지 어디에도 0회.**
**순서**(DOM 위치): 배너 `제목→부제→경고→도메인` ✓ · QR 카드 `제목→안심→설명→도메인` ✓

---

#### H-5. 넘침 · 레이아웃

| 뷰포트 | 기본 | **200%** |
|---|---|---|
| 360 / 390 / 1280 | **0 / 0 / 0** | **0 / 0 / 0** |

**줄 단위 슬롯 초과 전 구간 0** — 배너 4줄 · QR 카드 4줄 · 캡션 2 · 산문 6 · 상품권 · 폐회 블록.
**기여분 격리**(200%·360): 배너 · 블록2 카드 · QR 섹션 · 순서표 · 블록1 을 하나씩 숨겨도 **전부 0**.

##### ★ 슬롯이 이제 **다섯 종류**다 (200% · 360 · sb15 기준)

| 자리 | 슬롯 |
|---|---|
| 카드 밖(컨테이너 `px-4`) | **281** |
| 블록1·2 카드(`p-5`) | **201** |
| 배너(`p-4` + `border`) | **215** |
| **QR 링크 카드(`p-4` · border 없음)** | **217** |
| 순서표 셀(`table-fixed`) | **46.6** |

**CLS 0.00000** · `figure`/배너/QR 카드 높이 로드 전후 동일(293.9 / 425.9 / **114.6** / **125.3**) · 깨진 이미지 **0** · `alt` 없는 이미지 **0**(총 22개)
1280 간격 `그림→캡션 9 : 캡션→다음 그림 18` = **1:2** ✓

---

#### H-6. 회귀

| 항목 | 결과 |
|---|---|
| **순서표** | **3열** · 데이터 **16행** · **코스콤 열 rowSpan 합 16** ✓(리더 기준) · 시간 열 합 16 · caption `※ 상황에 따라 식순 변경 가능` |
| 식순 note 2곳 | **`금융노조 출석QR코드`** ×2 (구 `담당 운영위원 및 …` 0) ✓ |
| 식순 물품·해산 | `투쟁용품 수령 (총파업머리띠, 손피켓, 우천 시 우의 등)` · `20:30~해산` ✓ |
| 무수정 회귀 문자열 | **10건 전부 1회** |
| 지도 범례 | **7행 그대로** ✓ |
| 주석기호 | 섹션별 **3·1·2·5·2 = 13** — **기준선과 동일(증가 0)** · 블록 2 **1개** ✓ |
| 블록 2 포커스 가능 요소 | **0**(확대 UI 0 유지) |
| `alt` 규칙 | `map alt` 안 `코스콤지부` **0** / `코스콤 로고` **1** · `도로 위`·`길가` 각 1 · `official alt` 가 `배치도` 로 시작하지 않음 |
| 자산 | 구판 3건 **404** · 현행 3건 **200**(`branch-layout-2.png` 51,466 B · `/_next/image` 미경유) |
| `q=90` | 직접 요청 **200** · **`q=100` → 400**(허용목록 작동) · `srcset` `q=90` **9개** |
| `lint` / `tsc` | **exit 0 / exit 0** |
| 제목 레벨 | `h2 → h5`(`지도 데이터`) — **네이버 위젯 내부 · 기존 상태** |
| `인증샷` 1회 | **`QrAttendanceCard` 의 주최측 문안 전사** — 기존·§44-8 인정 · **오탐, 위반 아님** |

---

#### H-7. 판정

| | |
|---|---|
| **실패** | **0** |
| **게시 블로커** | **0** |
| **★ 리더 판단 항목** | ~~1 — `today` 여유 14.7px~~ → **[정정 2026-08-27] 실기기 참값은 `today` 여유 +64.7px**(H-2-정정). 선언 판정선 통과이고 **여유가 넉넉하다.** 부제(18.4px)를 지울 이유가 없다 — **«효과 없음»이 아니라 «필요 없음»** 이다 |
| **QA 자체 정정** | **6번째** — H-1(전후 해시 대조의 오탐 모드) · **H-2-정정(스크롤바 → 헤더 줄바꿈 → 높이 50px 오염)** |
| **★ 후속 신규 권고** | **1** — **«첫 화면 50px 절벽»**: `clientWidth < 351.2px` 이면 헤더가 두 줄이 되고 아래 전부가 50px 내려간다. **360px 기기는 절벽에서 8.8px 위** · **320px 기기는 이미 아래**. 방아쇠(지부명 207px + 글자크기 컨트롤 108.2px)가 **문면 길이에 따라 움직인다** → **측정 가능·수정 가능**하므로 «실기기 주소창»(측정 불가)과 **분리해서** 올릴 것을 권고 |
| **미검증(존치)** | U-1 실기기 핀치 · U-2 냉캐시 `srcset` · U-4 실기기 맨눈 판독 · **실기기 가용 높이**(`svh`==`lvh`==`dvh`==640 으로 측정 불가 확정) · **R-3 `today` 는 프로브**(실물은 **2026-08-28 당일**에만 관측 가능) |
| FOLLOWUPS | O-1 320급 200% 가로 스크롤(블록 1 `<dl>` 원인 · 이번 변경 무관) |

---

### 부록 I (2026-08-27 · `#20` 헤더 50px 절벽 수정 검증 + 전 페이지 헤더 회귀) — 결론: **#20 통과. 신규 발견 2건**

#### I-0. 측정 환경표 (F-7 확인 3종)

| 항목 | 값 |
|---|---|
| **① 서버 PID** | **21419**(2026-08-27 17:15:34 기동) · 종전 20846 정지 · `EADDRINUSE` 0 · 측정 전후 동일 |
| **② 응답 ↔ 디스크 프리렌더** | **`854292ac5b7851f5` 일치** |
| **③ 정적 자산** | **10건 전수 200** |
| `BUILD_ID` / 빌드 이후 수정 소스 | `-JYhFEjkfOrJ2bkWCuq0d` / **0건** |
| 루트 글꼴 / `fonts.status` | **12px** / `loaded` |
| 뷰포트 조작 | **`browser_resize`(실제 뷰포트)만 사용** — 요소 폭 변경 금지(미디어 쿼리 미발동) |
| 줄바꿈 판정 | **두 자식의 `getBoundingClientRect().top` 이 다른가** — 행 높이 프록시 쓰지 않음 |

**소스 변경 3곳 직접 확인**: `SiteHeader.tsx:68` `gap-x-2` · `FontScaleControl.tsx:111` `gap-1.5 sm:gap-2` · `:126` `w-20 sm:w-24 md:w-28`

---

#### I-1. `#20` 절벽 수정 — **통과. 리더 실측 전부 재현**

| 뷰포트 | `clientWidth` | 헤더 | 한줄최소 | 여유 | 기본 doc | **200% doc** |
|---|---|---|---|---|---|---|
| 320 | 305 | **2줄**(118) | 330.2 | −25.2 | **0** | 18 ← **O-1**(블록1 `<dl>`) |
| **360** | **345**(sb 15) | **1줄**(68) | 330.2 | **+14.8** | **0** | **0** |
| 390 | 375 | 1줄(68) | 330.2 | +44.8 | **0** | **0** |
| 412 | 397 | 1줄(68) | 330.2 | +66.8 | **0** | **0** |
| 768 | 768 | 1줄(77) | 432.2 | +335.8 | **0** | **0** |
| 1280 | 1280 | 1줄(77) | 432.2 | +847.8 | **0** | **0** |

**예산 실측 = 로고 207.0 + 컨트롤 93.2 + `column-gap` 6 + `px-4` 24 = 330.2** — 소스 주석 표와 **소수점까지 일치** ✓

★★ **오염 조건 소멸 확인** — **`clientWidth` 345(데스크톱 스크롤바 15)에서 한 줄**이다. 종전 절벽 351.2 에서는 이 조건이 두 줄이었고 그것이 부록 H-2 오염(14.7 vs 64.7)의 원인이었다.
⚠ **«360 여유 29px» 은 `clientWidth` 360(스크롤바 0) 기준**이고 **스크롤바 15 조건에서는 14.8px** 이다. 둘 다 참이고 판정(한 줄)은 같다 — **예산표에 조건을 함께 적어야** 다음 사람이 안 헷갈린다.

##### `sm`(640) 경계 복원 ✓

| | 슬라이더 | 컨트롤 gap | 컨트롤 폭 | `matchMedia(min-width:640px)` |
|---|---|---|---|---|
| 630 | **60** | 4.5px | 93.2 | **false** |
| 660 | **72** | **6px** | **108.2** | **true** |
| 768(md) | **84** | 6px | 156.2 | md **true** |

**640 이상에서 종전 값으로 정확히 복원**된다 ✓ — `matchMedia` 로 **발동 자체**를 확인했다.

##### 슬라이더 터치 대상·조작성 ✓

**60 × 44** (폭도 44 이상) · `aria-label="글자 크기"` · `min 75 / max 130 / step 5` · 포커스 표시 `outline 3px #093389`
**실제 키 입력으로 조작 확인**: `ArrowRight` → 값 75→80 · 루트 **12 → 12.8px** ✓

##### ⚠ 슬라이더 최대(130%)에서 헤더가 두 줄이 된다 — **정상. 다만 예산표에 조건이 필요하다**

360 · 슬라이더 **130%** → 루트 **20.8px** → 로고 236.2 · 컨트롤 143.8 · gap 10.4 · px 41.6 → **한줄최소 432px** → **두 줄**(여유 −87).
**가로 스크롤 0** · 슬라이더 높이 **44 유지** → **결함 아님**(설계된 `flex-wrap` 대체동작).

★ **소스 주석의 예산표는 «루트 12px» 전용이다.** 그런데 **슬라이더 자신이 헤더를 넓히는 당사자**다.
→ **«슬라이더 130% 에서 절벽은 432px»** 한 줄을 표에 붙이면 «12px 표»를 전 배율로 오해하지 않는다.

---

#### I-2. ★ 신규 발견 — **200% 가로 스크롤 2건. 둘 다 헤더 무관·기존**

**헤더를 `display:none` 해도 값이 그대로**임을 먼저 확인해 `#20` 과 무관함을 갈랐다.

| 페이지 | 200% doc | 원인 요소 | 슬롯 대비 |
|---|---|---|---|
| **`/`** | **61px** | `<p class="font-display text-hero text-balance break-keep text-white md:text-hero-lg">`<br>문면 **`8/28(금) 18:30 결의대회 참석안내`** | cw 201 / sw **334** → **+133** |
| **`/bargaining-2026`** | **34px** | `<p class="font-display text-hero text-primary">`<br>문면 **`96.05%`** | cw 185 / sw **299** → **+114** |

##### 처방 — **`break-words` 하나. 실측으로 확인했다**

`width:0` `scrollWidth`(§38.3 방식) · 홈 히어로 · 루트 32px(`text-hero` = **80px**):

| 조합 | 최장 덩어리 |
|---|---|
| `break-keep` 단독(현행) | **334** |
| **`normal`(클래스 없음)** | **334** ← ★ |
| **`break-keep break-words`** | **75** ✓ |

실제로 `overflow-wrap: break-word` 를 얹으니 **요소 초과 0 · 문서 스크롤 0**.

★★ **`break-keep` 이 원인이 아니다** — 빼도 334 다. **`8/28(금)`·`96.05%` 는 숫자·괄호·기호라 끊을 자리가 자체적으로 없다.**
→ **§38.2(«문자 종류가 처방을 가른다»)의 세 번째 경우**다: 한글(공백 0) → `break-words` · 라틴 도메인 → `break-all`/`break-words` · **숫자·기호 덩어리 → `break-words`**(`break-keep` 유무와 무관).

★ **이 발견의 의미**: **«200% 가로 스크롤 0» 규율이 결의대회 페이지에만 적용돼 있었다**(FOLLOWUPS #10·#11 이 그 페이지에서 나왔다). **홈·임단협은 그 게이트를 통과한 적이 없다.** → **후속 별도 항목** 권고.

##### ⚠ 오귀인 1건 — 내가 처음 지목한 탭 스트립은 범인이 아니었다

`HomeTabs` 버튼들이 뷰포트를 **606px 나 넘는 것**이 먼저 보여 그쪽을 의심했다. 그러나 **부모가 `overflow-x: auto`**(cw 266 / sw 919)라 **문서를 밀지 않는다** — 숨겨도 61px 그대로였다.
★ **«요소가 뷰포트를 넘는다» ≠ «문서가 가로 스크롤한다».** 넘치는 요소 목록은 **후보이지 원인이 아니다.** 원인은 **`display:none` 격리**로만 갈린다. (본문 O-1·부록 G 에서 쓴 방법과 같다.)

---

#### I-3. 리더 자기보고 3건에 대한 QA 회신

| # | 리더 관찰 | QA 회신 |
|---|---|---|
| **1** | `de.style.width` 로 폭을 바꿔 `sm:` 복원을 쟀더니 미디어 쿼리가 안 걸렸다 | ✅ **맞다.** 나는 `browser_resize`(실제 뷰포트)만 썼고 **`matchMedia` 로 발동 자체를 확인**했다(630 `false` / 660 `true`) |
| **2** | 내가 남긴 잔여 스타일을 내가 다시 쟀다 | ✅ **규율에 명시적으로 없다. 올릴 값이 있다** — 아래 |
| **3** | «줄바꿈 = 행 높이 > 60px» 휴리스틱이 틀렸다 | ✅ **맞다.** 나도 **자식 `top` 비교**로 쟀다. 이번 실측만 봐도 headerH 가 **68 / 77 / 118 / 144.8 / 195.5 / 227.5** 로 널뛴다 — 높이 프록시는 배율·브레이크포인트에서 즉시 깨진다 |

##### ★ 규율 제안 — «측정 전에 내가 남긴 것을 지운다» (§5.6 의 다른 축)

§5.6 은 *«환경이 **잴 수 있는** 상태인가»*(`visibilityState`·rAF)를 세웠다. 이것은 *«환경이 **깨끗한** 상태인가»* 로 **같은 계열의 다른 축**이다.
QA 도 같은 것에 걸렸다 — **부록 E-5**(프로브에 `position:absolute` 를 걸어 shrink-to-fit).

★ **범위가 DOM 스타일보다 넓다.** 이번에 슬라이더를 **130% 까지 올려** 봤는데 그 값이 **`localStorage: koscomlabor:font-scale`** 에 저장된다. **정리하지 않았으면 이후 «전 페이지» 측정이 130% 로 오염**될 뻔했다(실제로 복원 후 `75` 확인).

> **제안 문면**
> **측정 전후로 «내가 남긴 것»을 지우고 그 사실을 확인한다** — 인라인 스타일 · 주입 `<style>` · 삽입 프로브 · **영속 상태(`localStorage`·쿠키)** · **스크롤 위치**.
> **정리 확인은 «값으로» 한다** — *«지웠다»는 믿음이 아니라 `잔여 0`·`복원값 일치` 라는 수치로.*

⚠ **스크롤 위치**를 넣은 이유: 부록 H 측정 중 **앞선 CLS 테스트가 남긴 스크롤 때문에** `hero` 아래끝이 **−1833.7** 로 나왔다. 첫 화면 판정에 쓸 수 없는 값이었고, **CSS 상 불가능한 값**이라 걸렀다.

---

#### I-4. 판정

| | |
|---|---|
| **`#20` 수정** | ✅ **통과** — 6개 폭 × 기본·200% 에서 헤더 의도대로 · 가로 스크롤 0(320·200% 의 18px 은 기존 O-1) |
| **실패** | **0** |
| **신규 발견** | **2** — `/` 200% **61px** · `/bargaining-2026` 200% **34px**. **둘 다 헤더 무관·기존** · 처방 `break-words` 확인됨 → **후속 별도 항목 권고** |
| **예산표 보강 권고** | **1** — 주석 표에 **①스크롤바 조건**(345 vs 360) **②슬라이더 130% 절벽 432px** 을 함께 적을 것 |
| **QA 자체 정정** | **7번째** — 슬라이더 조작을 **합성 이벤트**로 재서 «루트 글꼴이 안 따라온다»는 **거짓 실패**가 났다. React 는 자체 이벤트 체계라 `.value` 직접 설정 + `dispatchEvent` 로는 핸들러가 안 돈다. **실제 키 입력**(`browser_press_key`)으로 정상 확인 |
| **미검증** | **상세 페이지**(`/news/[id]`·`/notices/[id]`·`/education/[id]`) — 실제 id 가 필요해 못 봤다. ⚠ **헤더 결론은 페이지 무관하게 성립한다**(같은 컴포넌트·같은 컨테이너·예산이 페이지 내용과 무관). **페이지 «내용»발 넘침만 미검증**이다 |

---

#### I-5. 측정 «후» 환경 확인에서 이상 2건 — **둘 다 해소. 그 과정이 H-1 을 한 겹 더 밝힌다**

측정을 마치고 F-7 3종을 다시 돌렸더니 두 값이 튀었다. **판정 전에 둘 다 원인을 확인했다.**

##### ① 디스크 프리렌더 sha256 이 `e3b0c44298fc1c14…` 로 나왔다 — **빈 문자열의 해시다**

파일이 사라진 줄 알았으나 **파일은 74,419바이트로 멀쩡했다.** 원인은 **Next 의 응답 캐시 라이트백 순간에 읽은 것**이다.
연속 3회 재측정: **서버 `9ecce10e265a46e0` ↔ 디스크 `9ecce10e265a46e0`, 3회 모두 동일 · 74,419 B.**

★★ **H-1 의 «전후 해시 대조 오탐»에 두 번째 모드가 있다.**

| 오탐 모드 | 증상 | 대응 |
|---|---|---|
| **(H-1) RSC 캐시 수치 표류** | 같은 빌드인데 **시각이 다르면** 해시가 다르다 | «전후 비교» 대신 **같은 시각 서버↔디스크 대조** |
| **(I-5) 라이트백 중 읽기** | **빈 해시·부분 해시**가 나온다 | **2~3회 읽어 «안정»을 요구**한다. 1회 값으로 판정하지 않는다 |

→ **F-7 ② 를 이렇게 읽어라**: *«서버 응답 sha256 == 디스크 프리렌더 sha256» 을 **같은 시각에, 값이 안정될 때까지 2~3회** 확인한다.*
⚠ **`e3b0c44298fc1c14…` 는 «빈 문자열의 sha256» 이다** — 이 값이 보이면 **파일이 없는 것이 아니라 «빈 것을 읽은 것»** 을 먼저 의심하라. 알아 두면 5초에 갈린다.

##### ② «빌드 이후 수정된 소스 1건» — `SiteHeader.tsx`. **전부 주석이다**

`git diff` 를 코드/주석으로 갈랐다: **비주석 변경은 `gap-x-4` → `gap-x-2` 한 줄뿐**이고 그것은 **이미 빌드에 실려 있다** — 서버가 내주는 HTML 에서 위치 기준으로 확인했다:

```
산출물: class="mx-auto flex … justify-between gap-x-2 gap-y-2 px-4 md:px-8"
소스   SiteHeader.tsx:75  className="mx-auto flex … justify-between gap-x-2 gap-y-2 px-4 md:px-8"
```
나머지 **33줄 추가는 예산표 주석**이다. → **산출물 ↔ 소스 불일치 없음. 측정 유효.**

★ 그리고 그 주석에 **내가 I-1 에서 권고한 두 가지가 이미 들어가 있다**:
- **«이 표는 «루트 12px» 전용 · 130%(루트 20.8px)에서 절벽은 432px»**
- **«여유는 조건과 함께 읽어라 — `clientWidth` 360 → 29px / 345 → 14.8px, 둘 다 참이고 판정은 같다»**

→ **I-4 의 «예산표 보강 권고 1건» 은 이행 완료로 회수한다.** 남은 권고는 **신규 발견 2건(후속 별도 항목)** 뿐이다.

---

## §52 QA (2026-08-29 · 9.4 총파업)

**대상**: 신규 `src/app/strike-2026-09-04/page.tsx` · `src/components/home/StrikeBanner.tsx` · `src/lib/strike.ts` /
변경 `src/app/page.tsx` · `src/app/bargaining-2026/page.tsx` · `src/lib/struggleSchedule.ts` · `src/lib/routes.ts` · `HeroPanel.tsx` /
삭제 `src/components/home/RallyBanner.tsx`

**1차 목록**: 디자이너 스펙 QA **461~485**(§52.16 · §52.18-8 · §52.20-4).
⚠ 리더 지시문은 «456~485» 라고 적었으나 **§52 가 만든 항목은 461 부터**다(§52.16 머리: *"§37.14-6 의 460 에 이어서"*). 456~460 은 §37 소관이라 이번 범위 밖으로 뒀다.

### 요약: 통과 **31** | 실패 **1** | 경고 **2** | 스펙 모순 **2**(리더 판단) | 미검증 **2**

---

### §52-QA-0 측정 환경표 (`union-qa-testing` §5.5 · §5.6 · §5.7)

| 항목 | 값 |
|------|-----|
| 측정일 | **2026-08-29** |
| 도구 | **Playwright MCP (Chromium)** · **프로덕션 standalone 서버** `node .next/standalone/server.js` @ `127.0.0.1:3399` |
| `BUILD_ID` | `4uAFt0k66BbcCvZcdnNWl` — **측정 전후 동일** |
| `.next/build-manifest.json` mtime | `2026-08-29T08:12:39` — **측정 전후 동일** |
| 빌드보다 새로운 소스 파일 | **0건** — 측정 전후 동일 (§5.7 «빌드 동결의 참 기준» 3종 전부) |
| **확인 ①** 프로세스 | `lsof` PID **1201**(신규 기동) · 기동 로그 `EADDRINUSE` **0건** |
| **확인 ②** 두 «출처» 대조 | 서버응답 sha256 **`779369a094ade52c`** == 디스크 프리렌더 **`779369a094ade52c`**. **같은 시각에 측정 전 3회 · 측정 후 3회 — 6회 모두 동일** (`<script>…</script>` 제거 후 해시 · §5.7 오탐 2종 회피) |
| **확인 ③** 정적 자산 | `_next/static` **10** + `_next/image` **2** + 폰트 CSS **1** = **13/13 전부 200** |
| **`innerWidth − clientWidth`** | **15** (클래식 스크롤바 · 전 뷰포트 동일) |
| `visibilityState` / rAF | `visible` / **1.5초 내 발화** (§5.6) |
| 폰트 | `await document.fonts.ready` 이후에만 측정 |
| 루트 폰트 | 기본 **12px**(`html{font-size:75%}`) · **«200%» = 32px**(이 프로젝트 관행값 — 15·19·25회차와 동일) |
| **정리 확인(§5.8.4)** | 인라인 root `style` = `""`(제거 확인) · computed root **12px** · **`localStorage` 키 0개** · 삽입 프로브 **0** · 주입 `<style>` **0** — 전부 **«값으로»** 확인 |
| 반응형 분기 | **실제 뷰포트 리사이즈**로만 판정(§5.8.4-② — `style.width` 트릭 미사용) |
| 정적 검사 | `npx tsc --noEmit` **exit 0** · `npm run lint` **exit 0** · `next build` **성공**(10/10 프리렌더) |

⚠ **스크롤바 15px 오염을 «보정한 회차»를 함께 넣었다**(§5.5). 데스크톱 컨텍스트에서 뷰포트 360 은 `clientWidth` **345** 라 실기기(오버레이 스크롤바 · 0)와 다르다.
→ **뷰포트 375 로 재서 `clientWidth` 360 을 만든 회차**를 별도 행으로 뒀다. **두 조건 모두 통과**이므로 판정은 갈리지 않는다.

---

### §52-QA-1 실패 — **1건**

| # | 분류 | 위치 | 실측 | 기대 | 측정 방법 | 수정 주체 |
|---|------|------|------|------|----------|----------|
| **F1** | **세로 예산 (QA 465)** | `src/app/strike-2026-09-04/page.tsx:225-237`(배지 `<p class="mt-4">` + `<h1>` `mt-3`) · 기여 요인 `:242` 개요 카드 `p-5` · `:257` `dl` | **`today` 에서 대형 `10시 30분` 하단 `645.34px`** → 판정선 **640 을 5.34px 초과** | **첫 화면 안에 완전히** | `clientWidth 360 / clientHeight 640`(뷰포트 375×640) · `document.fonts.ready` 후 · `p.getBoundingClientRect().bottom` (`<time datetime="2026-09-04T10:30:00+09:00">` 의 `closest('p')`) | ★ **개발자 아님 — 디자이너·리더 판정** |

**F1 상세 — 값 + 방법 + 기준(§5.7)**

| phase | 대형 `10시 30분` 하단 | 640 대비 | 비고 |
|---|---|---|---|
| `upcoming`(오늘의 실제 상태) | **618.34px** | 여유 **21.66px** | 통과. **여유가 두 자릿수 초반이다 — 문면·여백을 한 줄이라도 늘리면 넘는다** |
| **`today`**(9/4 당일) | **645.34px** | ★ **−5.34px** | **실패** |

- **`today` 측정 방법**: 서버가 `today` 에 내보내는 마크업을 DOM 으로 재구성했다 —
  `<p class="mt-4"><span class="rounded-full bg-primary px-3 py-1 text-caption font-bold text-white">오늘</span></p>` 를 `<h1>` **앞**에 삽입하고 `h1` 의 `mt-4` → `mt-3` 으로 교체(소스 `page.tsx:225-234` 와 `RallyStatus.tsx:31-42` 의 `phase==="today"` 분기를 그대로 옮긴 것).
  **복원 후 618.34 로 정확히 되돌아온 것을 값으로 확인**했고 **프로브 잔존 0**이다(§5.8.4-①).
- **개발자 실측(645)과 일치**한다. 독립 측정이 같은 값을 냈다.
- **디자이너 §52.12 예측(603 / 여유 37)은 15px 틀렸다.** 개발자가 이미 원인을 갈랐다(개요 카드 실측 188 vs 예측 167).
- ⚠ **처방을 QA 가 정하지 않는다.** 여백을 깎는 것은 표면 언어(`p-5`)와 §52.2 의 `dl` 처방을 건드리므로 디자이너 소관이고, «문장을 깎는 것»은 §5.7 이 명시로 금지한다(*"세로가 걸리면 문장이 아니라 레이아웃을 먼저 줄인다"*).

---

### §52-QA-2 ★ 스펙 모순 — **2건. 리더 판단을 요청한다**

이 둘은 **구현 결함이 아니다.** 문서끼리 어긋나 있고, **그대로 두면 최종 게이트에서 «거짓 실패» 가 난다.**

| # | 항목 | 실측 | 문서 A | 문서 B | 판정 요청 |
|---|------|------|--------|--------|----------|
| **C1** | **`※` 개수** | 렌더 텍스트에 **`※` 2개**(종류 1 · `※ 세부 프로그램은 조정될 수 있음.` 이 `<caption>` 과 표 아래 `<p>` 에 각 1) | **리더 지시문**: *"`※` 는 **렌더에 1개**"* | **QA 468**: *"정확히 **2개**(같은 문자열 2곳) · 3개면 실패"* · **검증 §51-9(3)**: *"표 위·아래 **2곳** 배치를 승인한다"* · **디자이너 §52.7-4**: *"**종류 1 · 출현 2**"* | **구현은 B(2개)를 따랐다.** D-10 조건 1 의 *"이 페이지의 `※` 는 원문 단서 **1개**"* 는 **«종류»** 를 말한 것으로 읽힌다(§52.7-4 가 그렇게 해석했다). **리더 지시문의 «렌더에 1개» 가 오기라면 회수**해 달라 |
| **C2** | **`추후 안내`** | 신설 페이지 렌더에 **1건** — `방법과 시각은 **추후 안내**합니다.` | **검증 §51-11 금지 목록**: `확인 중`·`반영하겠습니다`·**`추후 안내`** → 신설 페이지 기대 **0** | **D-10 확정 문면**이 그 문자열을 **포함**한다. **D-11 이 금지어를 5개로 다시 열거하면서 `추후 안내` 를 뺐다**(`확인 중`·`확인되는 대로`·`반영하겠습니다`·`준비 중`·`업데이트 예정`) | **§51-11 의 그 행은 근거가 죽었다**(D-4 개정 → §52-4 → D-10 순으로 뒤집혔다). **회수하거나 «기대 1» 로 고쳐 달라** — 안 고치면 최종 게이트가 **정상 문면을 실패로 올린다**(§5.8-③ «정당한 출현이 사라져야 하는 것 목록에 섞이는» 선례와 같은 형태) |

---

### §52-QA-3 경고 — **2건 (실패 아님)**

| # | 위치 | 내용 | 권고 |
|---|------|------|------|
| **W1** | `src/components/rally/PreSurveyBanner.tsx:69·71·78·94` | 주석 **4곳**이 **삭제된 `RallyBanner`** 를 인용한다(*"`RallyBanner` 를 근거로 … 일반화하지 마라"* · *"`RallyBanner` 는 안내 페이지로 가는 입구라 `past` 에도 참이지만"* · *"날짜 계산은 호출부가 `rallyPhase()` 로 넘긴다(`RallyBanner` 패턴)"* · *"`RallyBanner` 와 같은 규칙"*). **그 파일은 이제 없다** — 다음 사람이 찾으러 갔다가 못 찾는다 | **개발자가 리더 판정으로 넘긴 항목이다.** 그 파일은 «고치지 마라» 규율과 문자열 차분에 걸리므로 **QA 가 수정을 요구하지 않는다.** 다만 **«근거가 소멸했는데 판정이 안 고쳐졌다» 계열**이므로 리더가 처분을 정해 달라 |
| **W2** | `src/lib/routes.ts:178` | `ROUTES.rally0828` 의 **소스 내 참조가 0건**이 됐다(전수 grep: 정의 1 · 사용 0). 지금 `/rally-2026-08-28` 을 살리는 것은 **파일시스템 라우트뿐**이고 상수는 죽은 값이다 | ⚠ **실패로 올리지 않는다 — D-9 가 «의도된 상태»로 못박았다**(QA 482). 다만 **«상수도 죽었다»는 것은 주석에 없다.** `routes.ts:185` 주석은 «도달 경로 0»만 말한다. 한 줄 보강을 권고한다 |

---

### §52-QA-4 통과 — 실측표

#### (A) 텍스트 확대 200% · 문서 가로 스크롤 · 표 셀 넘침 (QA 461·462·463·464)

**측정 정의**: `documentElement.scrollWidth − documentElement.clientWidth` / 식순 표 **40칸 전수**의 `td.scrollWidth − td.clientWidth` 최대값 / `getComputedStyle(dl).gridTemplateColumns` 의 트랙 수.

| 뷰포트 | `clientWidth` | 기본 문서 | **200% 문서** | **200% td 넘침(40칸 최대)** | `dl` 트랙 기본 / 200% | `md:` |
|---|---|---|---|---|---|---|
| 360×640 | **345** | 0 | **0** | **0** | 1열(291px) / 1열(201px) | false |
| **375×640** ★스크롤바 보정(실기기 등가) | **360** | 0 | **0** | **0** | 1열(306px) / 1열(216px) | false |
| 390×640 | 375 | 0 | **0** | **0** | 1열(321px) / 1열(231px) | false |
| 412×640 | 397 | 0 | **0** | **0** | 1열(343px) / 1열(253px) | false |
| 768×1024 | 753 | 0 | **0** | **0** | 2열 / 2열 | **true** |
| 1280×800 | 1265 | 0 | **0** | **0** | 2열 / 2열 | **true** |

- **선언 뷰포트 5종 × 2배율 = 10조합 + 보정 1종 × 2 = 12조합 전부 0.** **QA 463(디자이너 미측정분 390·412·768) 해소.**
- **QA 464 통과**: `dl` 이 360·375·390·412 에서 **실제 조판으로 1트랙**이다(클래스 문자열이 아니라 `gridTemplateColumns` 계산값으로 확인). 768·1280 에서만 2트랙.
- **`md:` 는 루트 32px 에서도 768 에서 `true`** — 미디어 쿼리의 `rem` 이 루트를 안 따른다는 §52.2-1 재확인.
- **홈(`/`) 도 같은 6조건에서 문서 스크롤 기본·200% 전부 0.**
  ⚠ 768·200% 에서 **탭 스트립 버튼 3개가 뷰포트를 넘지만** 부모가 `overflow-x:auto` 라 **문서를 밀지 않는다**(`docScroll` 0). **QA 461 이 명시로 «실패 아님»** 이라 한 그 경우다.

#### (B) 배너 부제 결속 (QA 476·477·485)

**측정 방법**: 텍스트 노드를 **문자별 `Range.getClientRects()[0].top`** 으로 버킷팅해 줄을 복원했다. **«행 높이» 프록시 미사용**(§5.8.4-③).

| `clientWidth` | 부제 슬롯 기본/200% | 기본 줄 수 | **200% 첫 줄** | 200% 줄 수 | **`전` 단독 줄** |
|---|---|---|---|---|---|
| **345**(뷰포트 360) | 291 / **201** | **1줄** | **`전 조합원 `** | 5 | **0** |
| **360**(뷰포트 375) | 306 / **216** | **1줄** | **`전 조합원 집결 `** | 5 | **0** |
| **375**(뷰포트 390) | 321 / **231** | **1줄** | **`전 조합원 집결 `** | 5 | **0** |
| **397**(뷰포트 412) | 343 / **253** | **1줄** | **`전 조합원 집결 `** | 3 | **0** |

- `clientWidth 345` 조판이 **디자이너 §52.18-1(2)·개발자 실측과 문자 단위로 일치**한다: `전 조합원` / `집결 10:30 ·` / `세종대로` / `(광화문역·` / `시청역)`.
- **QA 476 통과** — 기본 3뷰포트 전부 한 줄 · 200% 첫 줄이 항상 `전 조합원` 으로 시작 · `전` 한 글자 줄 0.
- **QA 477·485 통과** — computed `text-wrap`: **제목 `balance`(1)** · **부제 `wrap`(0)**. 소스에서도 부제 클래스(`StrikeBanner.tsx:144`)에 `text-balance` 0건, 제목(`:112` hero · `:113` panel) 각 1건.
- **QA 466 통과** — hero·panel **두 표면 모두** 제목에 `break-keep break-words` + `text-balance`. 200% 360 에서 제목 넘침 **0**.

#### (C) 축자 문면 — **렌더 텍스트 기준** (기대 대비 실측)

**계수 방법**: 프로덕션 응답 HTML → `<script>`·`<style>`·주석 제거 → `<head>` 분리 → **태그 전부 제거(`<wbr>` 포함)** → 엔티티 디코드 → 부분문자열 카운트. **`grep -c` 미사용.** `<title>`(요소 텍스트)과 `meta[content]`(속성)는 **따로** 셌다.

| 문자열 | 기대 | 실측 |
|---|---|---|
| `당일 QR 출석체크가 있습니다. 방법과 시각은 추후 안내합니다.` | 1 | **1** ✓ |
| `세종대로 (광화문역, 시청역)` (원문 축자) | 1 | **1** ✓ |
| `※ 세부 프로그램은 조정될 수 있음.` | 2 (§52.7-4) | **2** ✓ · `※` 문자 총 **2** · 종류 **1** |
| `김동명 한국노총 위원장 외` | 1 | **1** ✓ (「외」·어순 보존) |
| `윤석구 금융노조 위원장` | 1 | **1** ✓ |
| `2026년 9월 4일(금) 11시` | 1 | **1** ✓ |
| `금융노조 전 조합원` · `지부 위원장 및 전체상임간부` · `10시 30분` | 각 1 | 각 **1** ✓ |
| **`~`** (시간 구분자) | **0** | **0** ✓ |
| `10:30-11:00` (`<wbr>` 가 갈라 놓은 자리) | 1 | **1** ✓ — **태그 제거 후 재결합 확인** |
| 식순 20행 전수 | 20 | **20행 전수 원문 축자 일치**(`content-strike-20260904.md` 96~118행과 문자 단위 대조) · `-` 구분자 **20행 전부 보존** · `14:20` 단독 행 ✓ |

**QA 480 `metadata` — 글자 단위 일치 ✓**
- `<title>`(요소 텍스트, 42자): `9/4(금) 총파업 참석안내 — 전국금융산업노동조합 코스콤(한국증권전산)지부` == §52.18-7
- `meta[name=description]`(속성, 60자): `2026년 9월 4일(금) 11시 · 세종대로 (광화문역, 시청역). 전 조합원 집결은 10시 30분입니다.` == §52.18-7
- 두 계층을 **분리해서** 셌다(태그 제거 방식이면 `<title>` 이 본문에 섞인다).

**금지 목록 — «기대 개수» 판정 (§51-11 · §52-4)**

| 문자열 | 신설 페이지 기대 | 실측 | 판정 |
|---|---|---|---|
| `총파업(안)`·`(안)`·`본대회`·`14:20 종료`·`~14:20`·`예정`·`계획` | 0 | **0** | ✓ |
| `확인 중`·`확인되는 대로`·`반영하겠습니다`·`준비 중`·`업데이트 예정` | 0 | **0** | ✓ |
| `배정되지 않았습니다`·`아직 배정`·`지부 공지로` | 0 | **0** | ✓ |
| `prpage153`·`18:30~19:30`·`20:00~21:00`·`손피켓`·`QR인증 바로하기`·`인증샷`·`수기접수`·`상품권`·`5만원`·`지정된 출석 시간` | 0 | **0** | ✓ **조건 13 이행** |
| `투쟁조끼`·`머리띠`·`위치서비스`·`임금피크제`·`종일`·`오전` | 0 | **0** | ✓ |
| `집결 장소와 시간은 지부 공지로 별도 안내합니다` | 0 (조건 9 이행 후) | **0** | ✓ |
| **`대오`** | — | **1** | ✓ **정당한 출현** — 식순 첫 행 원문 축자 **`대오정비`**. D-1(코스콤 «대오») 과 무관 |
| **`11시`** | — | **2** | ✓ **정당** — 본문 개요 축자 1 + `meta[description]` 1(§52.18-7 승인분) |
| **`추후 안내`** | §51-11=0 / D-10=1 | **1** | ★ **C2 참조 — 문서 모순** |

**저장소 전체(§51-11 «기대 0 아님» 행) — 정당한 출현 보존 확인**: `prpage153.mycafe24.com` **1**(`routes.ts` `EXTERNAL_LINKS.unionAttendance`) · `18:30~19:30`·`20:00~21:00`(`QrAttendanceCard`) · `투쟁조끼`(`RallySchedule` 주석) — **전부 그대로 살아 있다. 지워지지 않았다.**
`/bargaining-2026` 의 `계획` 1 · `1차` 1 · `2차` 3 · `임금피크제` 1, 홈의 `준비 중` 4(방명록·게시판) 는 **전부 기존 콘텐츠**이고 이번 라운드 산물이 아니다.

#### (D) 정합 — 라우팅 · 배너 · 카드 · 주석

| # | 항목 | 실측 |
|---|---|---|
| **QA 478** | `/bargaining-2026` 카드 | 8/28 카드 **`<a>` 0 · `<svg>` 0 · `hover:` 0 · `shadow-card-hover` 0** (렌더 HTML 의 해당 `<li>` 전수) · `href="/rally-2026-08-28"` **페이지 전체 0** · 9/4 카드 `참석 안내 보기` **1** → `/strike-2026-09-04` · 페이지 전체 `참석 안내 보기` **1** ✓ |
| **QA 479** | 카드 두 줄 위계 | `meta` = `mt-1 block text-caption text-ink-muted`(`서울 세종대로`) · `detail` = `mt-2 block text-body text-ink`(`전 조합원 집결은 10시 30분입니다.`) — **클래스 문자열 실측** · `meta` 값에 `11시`·`오전`·`종일` **0** ✓ |
| **QA 470** | 배너 1개 | 홈에 `section[aria-label="총파업 참석 안내"]` **1개** · `RallyBanner` **렌더 0**(파일 삭제 확인) · hero/panel 동시 렌더 **0**. 분기 3갈래(`urgent`/`upcoming·today`/`past`) 전부 **정확히 1개**를 낸다(`page.tsx:146-156` 코드 대조) — 죽은 분기 0 |
| **QA 469** | 배너 문면 | 제목 `9/4(금) 총파업 참석안내` · 부제 `전 조합원 집결 10:30 · 세종대로(광화문역·시청역)` · CTA `참석 안내 보기` — **D-8 축자와 문자 단위 일치**(띄어쓰기·가운뎃점 포함) |
| **QA 471** | QR 줄 형태 | `</section><p class="mt-section break-keep break-words text-body text-ink md:mt-section-lg">당일 QR…</p><section` — **`<section>` 밖 · `<p>` 1개 · 단일 텍스트 노드 · `href` 0 · 면/테두리/그림자 0 · `※` 미부착 · 두 문장 분리 0** ✓ (D-10 조건 4건 전부) |
| **QA 475** | 삽입 지점 | `<main>` 안 **빈 요소 0건**(텍스트·이미지 없는 `div/section/p/span/li` 전수 스캔) · 플레이스홀더 0 |
| **QA 481** | 조건 17 주석 **두 자리** | **(가)** `page.tsx:29-43` 파일 머리(코스콤 위치는 왜 없는가) · **(나)** `page.tsx:330-341` QR 주석 블록. **주석 종료 `*/}`(:361)과 QR `<p>`(:362) 사이에 다른 요소 0** — 인접 확인. 각자 자기 상태만 말하고 상대 자리를 **가리키기만** 한다 ✓ **한 덩어리 아님** |
| **QA 483** | 죽은 D-14 문면 | 소스 전수에서 `같은 줄` **4건** — 그중 §52 관련 2건(`page.tsx:296` · `StrikeBanner.tsx:140`)은 **둘 다 «죽었다 · 인용하지 마라» 표식**이다(§52.20-0 이 *"이름으로 지목한다"* 를 요구한 그 형태). **살아 있는 인용 0** ✓. 나머지 2건은 §52 무관(`page.tsx:61` `RALLY_PAST_NOTE` · `RallySchedule.tsx:338` `ml-1.5`). 대체 근거 **«첫 줄이 `전 조합원`»**(`StrikeBanner.tsx:138`) · **«대상 캡션이 대형 수치 위»**(`page.tsx:299`) 존재 ✓ |
| **QA 484** | 주석 분리 | 부제 위가 **별개 JSX 주석 블록 2개** — `:121-129` 처방(`text-balance` 금지 + 실측 근거) / `:130-142` 판정(갈리는 것이 정상 + 근거). **문단 갈림 확인** ✓ |
| **QA 482** | 8/28 나가는 길 | `/rally-2026-08-28` **HTTP 200** · `SiteHeader` **1**(`:98`) · `ROUTES.bargaining` 복귀 링크 **2**(`:104`·`:749`) ✓. ⚠ **고아 라우트는 D-9 가 못박은 의도된 상태다 — 실패로 올리지 않았다** |
| **라우팅 전수** | 생산자↔소비자 | `src/app` 하위 page **8개** ↔ 코드 내 모든 내부 링크. `ROUTES` 사용처 전수 대조: `post`6·`homeSection`5·`bargaining`5·**`strike0904`4**·`notice`2·`home`1·`admin`1 · **`rally0828` 0**(→ W2). 문자열 리터럴 `href="/…"` 2건은 `/docs/2026-imdantu-struggle-plan.pdf`(실존 ✓)·폰트 CSS(실존 ✓). **깨진 링크 0** |
| **`RallyBanner` 삭제** | 잔존 참조 | 파일 **없음** ✓ · **코드 참조 0** ✓ · 문자열 `8/28(금) 18:30 결의대회 참석안내` **소스 전체 0** ✓(D-12 의 삭제 근거 이행) · 주석 참조 9건(그중 W1 의 4건이 문제) |
| **조건 11 주석** | 전제 소멸 반영 | `bargaining-2026/page.tsx:29-33` **갱신됨**(*"이 전제는 2026-08-29 에 소멸했다"*) · `HeroPanel.tsx:40-48` **갱신됨**(*"9/4 를 말할 승인 문자열이 없다" 를 이름으로 지목해 폐기*) ✓ |
| **단일 출처 가드** | ★ **발동 경로까지 실측**(§5.5 *"조건문은 발동 절차와 짝이어야 한다"*) | `STRIKE_DATE` 를 뺀 스텁 배열로 `strike.ts` 를 격리 실행 → **`[strike] STRIKE_DATE(2026-09-04) 가 STRUGGLE_SCHEDULE 에 없습니다` 가 실제로 출력됐고, 렌더는 막지 않았다**(`phase` 계산 정상). 실제 배열로는 **경고 0**. 프로덕션 번들에 문자열 **8회 잔존**(트리셰이킹 안 됨) ✓ |
| **`strikePhase()` 경계** | KST 경계 4점 | `09-03 23:00`→`upcoming` · `09-04 00:10`→`today` · `09-04 23:50`→`today` · `09-05 00:10`→`past` ✓ 하드코딩 0 |
| **타입 우회** | `as any`/`@ts-ignore` 등 | 이번 라운드 파일에 **0건**(저장소 전체 1건은 `src/lib/api/admin.ts:124` 의 `as unknown` — 기존분) |

#### (E) 접근성

| 항목 | 실측 |
|---|---|
| **QA 472 대비** | §52.13 **8행 전부 `check-contrast.mjs` 재실행값과 일치**(17.40 / 7.56 / 11.37 / 11.37 / 9.23 / 7.23 / 4.83 / 1.24). **렌더 실측 색 조합은 3종뿐** — `#1a1a1a`·`#4b5563`·`#093389` on `#ffffff`(+배너 `#ffffff`·`#d9e9ff` on `#093389`). 테두리는 `#e5e7eb` **1종**(표 행 구분선 = §16.5 허용 장식 용도). **신규 색 0 · 신규 토큰 0** ✓ |
| **QA 473 접근성 이름** | 계산된 이름(Playwright a11y 트리): 복귀 링크 ×2 = **`26년 임단협 투쟁 안내로 돌아가기`**(`←` 는 `aria-hidden` 이라 이름에서 빠진다) · 배너 CTA = **`참석 안내 보기`**. **`aria-label` 0 · `title` 0** — 내부 텍스트가 이름을 진다(`union-webapp-dev §8`) ✓ |
| **QA 474 랜드마크** | 신설 페이지 `<section>` **3개 전부 `aria-labelledby`** → 화면 헤딩 `개요`·`집결시간`·`총파업 식순`. 홈 배너는 **화면 헤딩이 없어 `aria-label="총파업 참석 안내"`** — 사이트 규칙(헤딩 있으면 `labelledby`, 없으면 `label`) 준수 ✓ |
| 헤딩 위계 | `h1` → `h2`·`h2`·`h2` — **건너뜀 0** ✓ (`SiteHeader asHeading={false}` 로 상세 페이지 h1 충돌 없음) |
| 터치 대상 | 복귀 링크 2개 **164×44 / 202.2×44**(`min-height: 44px` 고정 px) · 배너 CTA **147.4×44** — 44×44 이상 ✓ |
| `:focus-visible` | **실제 포커스 후 전이 완료(400ms) 시점 측정**: 복귀 링크 `#093389 3px solid offset 2px` on `#ffffff` = **11.37** · 배너 CTA(딥블루 면) `#ffffff 3px solid offset 2px` on `#093389` = **11.37**. 둘 다 UI 3:1 통과 ✓ |
| 표 시맨틱 | `<table>` 1 · `<caption>` 1(`※` 단서를 진다) · `<th scope="col">` **2** · `<tbody><tr>` **20** · 비고는 내용 셀 둘째 줄(`<span class="block">`) — 스크린리더에서 `총파업 선언 및 대회사 윤석구 금융노조 위원장` 으로 한 셀에 읽힌다 ✓ |
| 콘텐츠 은폐 | 탭·아코디언·«더 보기» **0** · 20행 전부 펼쳐짐 · `document.getAnimations()` **0**(등장 애니메이션 없음) ✓ (§0.4) |
| `div onClick` 류 | 비대화형 요소의 클릭 핸들러 **0** |

---

### §52-QA-5 미검증 — **2건 (통과로 적지 않는다)**

| # | 항목 | 사유 |
|---|------|------|
| **U1** | **실기기 가용 높이** | `100svh == 100lvh == 640` 이라 **이 환경에는 «툴바 보임/숨김» 구분이 없다**(§5.8.3 판별법). `clientHeight`·`innerHeight`·`visualViewport.height` 가 전부 640 을 내지만 **그것은 «측정됐다»가 아니다.** → **F1 의 `today` −5.34px 과 `upcoming` 여유 +21.66px 은 «선언 판정선 360×640» 기준값**이고, **실기기에서 브라우저 툴바가 먹는 높이는 못 쟀다.** 실기기에서는 `upcoming` 도 첫 화면 밖일 수 있다 |
| **U2** | **`today`·`past` 의 «서버 렌더» 실물** | 오늘(2026-08-29)은 `upcoming` 이라 서버가 `today`/`past` 마크업을 내지 않는다. F1 의 `today` 값은 **소스 분기를 그대로 옮긴 DOM 재구성**이고, `past`(배지 `완료` + 배너 `panel` 최상단 + 미니달력 `null`)의 **실제 렌더는 확인하지 못했다.** ⚠ D-13 이 등재한 «9/5 부터 최상단이 `panel` 하나» 는 **코드 대조로만 확인**했다 |

---

### §52-QA-6 ★ 이번 회차에 내가 걸릴 뻔한 «세는 방법» — 기록

**`:focus-visible` 아웃라인 색을 `rgb(91, 119, 176)` 으로 잴 뻔했다** — 스펙은 `outline-white`(#ffffff) 인데.
`focus()` 직후 **rAF 2회(≈32ms)** 에 `getComputedStyle` 을 읽은 것이 원인이다.
**Tailwind v4 의 `transition-colors` 는 `outline-color` 를 포함한다**(실측 `transition-property` = `color, background-color, border-color, **outline-color**, …`).
`duration-150` 이라 그 시점은 **전이 중간값**이었다. **400ms 대기 후 참값 `rgb(255, 255, 255)`.**

→ 그대로 적었으면 *"딥블루 면 위 아웃라인이 #5B77B0 이라 대비 미달"* 이라는 **거짓 실패**가 났다.
★ 이것은 §5.6(«측정 «전» 환경이 잴 수 있는 상태인가»)의 **시간 축 판**이다 — 환경도 프록시도 아니고, **«아직 그 값이 아니다»** 다.
**전이가 걸린 속성은 `transitionend` 또는 `duration` 초과 대기 후에 읽는다.** 이 프로젝트의 «세는 방법이 질문에 안 맞는» 사례 **여덟 번째**로 기록한다.
