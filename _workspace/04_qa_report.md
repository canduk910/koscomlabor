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
