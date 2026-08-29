import { ExternalLinkIcon } from "@/components/ui/icons";
import { EXTERNAL_LINKS, PRE_SURVEY_DISPLAY_HOST } from "@/lib/routes";
import type { RallyPhase } from "@/lib/rally";

/**
 * 참석 예비조사 배너 — `/rally-2026-08-28` 최상단. 대회 «전»에 참석 가능 여부를 묻는 구글 폼으로 보낸다.
 * 실측·기각안·판정 근거는 디자인 스펙 §37 · 검증 §45 에 있다.
 *
 * ⚠ 이름을 `AttendanceBanner` 로 바꾸지 마라 — 이 페이지의 유일한 위험이 «참석 조사 ↔ QR 출석체크» 혼동이라
 *   코드 이름에서도 «출석»과 «조사»를 가른다(§37.9).
 * ⚠ `aria-label`·`<section aria-label>`·래퍼 `<div>` 를 붙이지 마라 — 접근성 이름은 내부 텍스트가 지고,
 *   붙이면 아래 경고 줄이 링크 낭독에서 사라진다(§37.13 · §45-11 조건 10). `mt-6` 은 `<a>` 에 직접 준다.
 * ⚠ `title` 도 붙이지 마라. **다만 기전이 다르다** — 이름을 «대체»하는 `aria-label` 과 달리 `title` 은
 *   이름을 못 덮고 **설명이 덧붙어** 세 줄이 네 조각이 되고, 터치·키보드에서는 뜨지도 않는다.
 *   *"`title` 은 이름을 안 덮는데?"* 로 이 금지를 뒤집지 마라(§37.13-2).
 * ⚠ 남색으로 채우거나 필 버튼·`rounded-panel` 로 바꾸지 마라 — 면이 «이것이 바로 그 행동이다» 라고 먼저 말해
 *   문안이 막은 혼동을 형태가 되살린다. 흰 면 + `border-primary` 가 설계값이다(§37.2·§37.3·§45-15).
 *
 * ★ `past` 는 «숨김»이 아니라 «렌더 금지»다(§37.6) — 지난 대회의 참석 예비조사 배너는 조합원에게 **«아직
 * 참석 신청을 받는다»로 읽혀 거짓이 된다.** 홈 배너(`StrikeBanner`)가 `past` 에도 남는 것과 갈리는 축은
 * 표면이 아니라 **그 면이 «입구»인가 «행동 요청»인가**다(§45-15(4)) — 홈 배너를 근거로 «이 프로젝트는
 * 배너를 숨기지 않는다»로 일반화하지 마라. 판정을 호출부가 아니라 컴포넌트 안에 두는 이유는 어디에 갖다
 * 붙여도 거짓이 될 수 없게 하려는 것이다.
 * 날짜는 호출부가 `rallyPhase()` 로 넘긴다 — 컴포넌트는 시간을 모른다.
 */
export function PreSurveyBanner({ phase }: { phase: RallyPhase }) {
  /* «숨김»이 아니라 렌더 금지 — `hidden`·`display:none` 이 아니다 */
  if (phase === "past") return null;

  return (
    /* `today` 는 **테두리 색 하나만** 바꾼다(§37.5) — 글자는 한 글자도 건드리지 마라. 혼동 위험이 당일에
       최고조라 경고 줄을 작게·흐리게 하는 것은 정확히 반대 방향이다.
       ⚠ `border-border-soft` 로 낮추지 마라(UI 경계 3:1 미달 · `border-border-strong` 이 하한).
       ⚠ `hover:border-2` 로 바꾸지 마라 — `border` 는 박스 크기라 레이아웃이 1px 흔들린다(굵어 보이는
         효과는 바깥에 얹히는 `hover:outline-2` 가 낸다).
       ⚠ **`today` 에서 «지난 일»로 보이게 하지 마라** — 폼은 당일에도 유효하다. `완료` 배지·취소선 금지.
       ⚠ **hover·focus 링은 `today` 에서도 `primary` 그대로다** — 포커스 링은 접근성 요소이지 «무게»의 축이
         아니다 */
    <a
      href={EXTERNAL_LINKS.preSurvey}
      target="_blank"
      rel="noopener noreferrer"
      className={`rounded-card ease-out-soft group mt-6 block border bg-bg p-4 transition-colors duration-150 hover:outline-2 hover:outline-primary focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 ${phase === "today" ? "border-border-strong" : "border-primary"}`}
    >
      {/* 축자 문면(§45-10(1) · 사용자 지정). ⚠ `참석 등록`·`참석 신청`·`사전 등록` 으로 바꾸지 마라 — 혼동을
          정확히 반대 방향으로 민다(`예비` 가 «본 절차가 따로 있다»를 함의한다 · §45-3).
          ⚠ `text-lead` 로 키우지 마라 — QR 카드 제목과 같은 급이 된다. 위계는 굵기와 색이 진다.
          ⚠ **↗ 를 텍스트 문자로 쓰지 마라** — 서체마다 위치·크기가 튄다(SVG 재사용) */}
      <span className="block break-keep break-words text-body font-bold text-primary group-hover:underline">
        참석 예비조사
        <ExternalLinkIcon className="ml-1 inline size-4 align-[-2px]" />
      </span>

      {/* 출처 맥락 부제 — 이미 SMS 로 응답한 조합원이 알아보면 중복 응답을 막는다(§37.14 · §49-5).
          ⚠⚠ **배너는 이 4줄이 끝이다** — `today` 여유가 11.7px 라 무엇이든 한 줄 더 붙으면 대형 `18:30` 이
            첫 화면(360×640) 밖으로 나간다. 경고·도메인 줄은 게시 조건이라 뺄 후보는 이 부제뿐이다.
          ⚠ «이미 했으면 안 해도 된다»로 확대하지 마라 — 지부 운영 판단이고 우리에게 근거가 없다.
          ⚠ `mt-0.5` 를 키우지 마라 — 제목↔부제 : 부제↔경고 = 1:2 라야 부제가 제목에 소속된다.
          ⚠ `ink-muted` 로 흐리지 마라 — 안 읽히면 «중복 응답 방지» 효과가 0 이다.
          ⚠ `break-words` 는 필수다 — 최장 덩어리가 배너 슬롯을 넘친다(§38.1) */}
      <span className="mt-0.5 block break-keep break-words text-caption text-ink">
        사내게시판과 SMS로 안내한 설문조사입니다.
      </span>

      {/* ★★ **게시 조건 — 이 줄을 지우면 게시 불가다**(§45-10(2) 축자).
          ⚠ `별개입니다` 로 바꾸지 마라(관계만 말하고 행동을 안 말한다) · `당일` 을 빼지 마라(시점이 다른 것이
            혼동의 핵심) · `※` 를 붙이지 마라(단서가 아니라 카드 본문이고 이 페이지는 `※` 개수를 센다).
          ⚠ **`text-caption` 으로 낮추지 마라**(§37.3 근거 5) — 이 줄은 «링크가 무엇인지»가 아니라 **행동이
            갈리는 사실**이라 카드의 유일한 `text-body` 다. `WayfindingBlock` 의 보조 설명과 성격이 다르다.
          ⚠ `break-all` 을 쓰지 마라 — `QR` 이 `Q/R` 로 갈린다. 한글 줄은 `break-keep break-words` 다(§38.2) */}
      <span className="mt-1 block break-keep break-words text-body text-ink">
        당일 QR 출석체크는 따로 해야 합니다.
      </span>

      {/* 외부 이동 **3중 병행**(§14.1): ↗ 아이콘 + 도메인 표기 + 접근성 이름.
          ⚠ `truncate`(말줄임)로 바꾸지 마라 — 주소가 잘리면 표기하는 의미가 사라진다.
          ⚠ `break-all` 을 빼려면 슬롯을 «배너 «안»»에서 재라 — 이 줄은 배너 자신의 `p-4` 안이라 QA 부록 D 의
            «카드 밖» 값이 아니다. **같은 숫자가 두 계약을 가리킨다**(§37.7).
          ⚠ **판정선은 «슬롯 초과 0» 이지 특정 클래스가 아니다** — 클래스 이름을 근거로 반려·강제하지 마라 */}
      <span className="mt-1.5 block break-all text-caption text-ink-muted">
        외부 링크(새 창) · {PRE_SURVEY_DISPLAY_HOST}
      </span>
    </a>
  );
}
