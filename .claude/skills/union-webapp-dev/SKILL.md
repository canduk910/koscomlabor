---
name: union-webapp-dev
description: "노조 공식페이지 구현 표준. Next.js + Tailwind + TypeScript로 페이지·컴포넌트·콘텐츠 기능을 구현하거나 수정할 때 반드시 사용할 것. 프로젝트 초기 세팅, 폴더 구조, 콘텐츠 데이터 규약(verified 메타데이터), 코딩 규칙 포함. '구현해줘', '만들어줘', '페이지 추가', '버그 수정' 요청 포함."
---

# Union Webapp Dev — Next.js 구현 표준

전국금융산업노동조합 코스콤지부 공식페이지의 기술 표준. 이 프로젝트의 특수성은 두 가지다: (1) 콘텐츠는 **검증 승인된 것만** 게시된다, (2) 디자인은 **스펙의 토큰 값 그대로** 구현한다.

## 1. 기술 스택

- **Next.js (App Router) + TypeScript (strict) + Tailwind CSS** — 최신 안정 버전
- 콘텐츠 중심 사이트이므로 서버 컴포넌트를 기본으로 하고, 상호작용이 필요한 부분만 `"use client"`
- 초기에는 DB 없이 파일 기반 콘텐츠(`content/`)로 시작한다. 배포 요건이 정해지기 전에는 정적 내보내기 가능성을 열어둔다(서버 전용 기능 도입 시 리더에게 보고)

프로젝트가 비어 있으면 초기 세팅: `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir`

## 2. 폴더 구조

```
src/
├── app/           # 라우팅. page.tsx는 조립만, 로직은 lib/로
├── components/    # 재사용 컴포넌트 (ui/ 기본요소, notice/ 등 도메인별)
├── lib/           # 콘텐츠 로딩, 유틸, 타입 정의
content/           # 게시 콘텐츠 (markdown + frontmatter)
├── notices/       # 공지
├── news/          # 소식
└── pages/         # 상시 정보 (소개, 규약 등)
```

## 3. 콘텐츠 데이터 규약 — verified 게이트

게시 콘텐츠는 `content/` 하위 markdown 파일로 관리하며, frontmatter 스키마는 다음과 같다:

```yaml
---
title: "2026년 임금협약 잠정합의 안내"
date: 2026-08-16          # 게시일 (ISO 형식)
category: notice           # notice | news | page
urgent: false              # 긴급(기한 있는 행동 필요) 여부
deadline: 2026-08-30       # 선택 — 행동 기한
source: "금융노조 본조 발표문"  # 출처 표기
verified: true             # fact-verifier 승인 여부
verified_date: 2026-08-16
verifier_report: _workspace/01_verifier_factcheck.md
---
```

**콘텐츠 로더는 `verified: true`가 아닌 파일을 프로덕션 목록에서 제외한다.** 이것이 "잘못된 정보를 조합원에게 전달하지 않는다"는 원칙의 코드 수준 방어선이다. 로더 구현 시 이 필터를 반드시 포함하고, 개발 모드에서는 미검증 콘텐츠를 "미검증" 배지와 함께 표시해도 된다.

콘텐츠 원문은 구현 중 축약·의역하지 않는다. 렌더링 형식 변환(마크다운→HTML)만 허용된다.

## 4. 코딩 규칙

- **타입 우회 금지**: `any`, `@ts-ignore`, 근거 없는 `as` 캐스팅 금지. 외부 데이터(frontmatter 등)는 파싱 지점에서 명시적으로 검증/변환한다. 우회된 타입은 빌드를 통과시키고 런타임에 조합원 앞에서 터진다.
- **디자인 토큰 준수**: 색상·크기·간격은 스펙이 정의한 토큰(Tailwind theme 확장 또는 CSS 변수)만 사용한다. 하드코딩 hex/px가 필요해지면 디자이너에게 토큰 추가를 요청한다.
- **시맨틱 마크업**: 이동은 `<Link>`/`<a>`, 동작은 `<button>`. 제목 레벨은 순서대로. 모든 이미지에 `alt`. `div onClick` 금지.
- **날짜 처리**: 표기 변환(요일 계산 등)은 반드시 라이브러리/Intl로 계산한다. 수동 계산 요일 표기는 오보 사고의 단골 원인이다.
- 링크 경로는 문자열 하드코딩 대신 `src/lib/routes.ts`의 상수를 사용한다 — QA의 라우팅 교차 검증을 구조적으로 단순화한다.

## 5. 작업 절차

1. 구현 전: 디자인 스펙(`_workspace/02_designer_spec.md`)과 검증 리포트를 읽는다. 스펙 모호 시 임의 해석하지 말고 질의한다
2. 모듈 단위로 구현하고, **모듈 하나가 끝날 때마다** 리더에게 보고하여 incremental QA를 받는다
3. QA 실패 항목 수정 시: 지목된 `파일:라인`만 고치는 게 아니라, 같은 패턴이 다른 곳에도 있는지 grep으로 확인해 함께 고친다
4. 구현 요약을 `_workspace/03_developer_impl.md`에 기록한다: 구현 범위, 미구현 항목과 사유, 기술적 결정(왜 이렇게 했는지)

## 6. 자가 검증 (QA에 넘기기 전 최소선)

```bash
npx tsc --noEmit && npm run lint && npm run build
```

이 3개를 통과시킨 후 QA를 요청한다. 컴파일도 안 되는 코드를 QA에 넘기는 것은 팀 전체의 시간 낭비다. 단, 통과가 정상 동작을 의미하지 않음을 기억하라 — 경계면 검증은 QA가 한다.
