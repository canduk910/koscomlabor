import { ExternalLinkIcon } from "@/components/ui/icons";
import { NAVER_DIRECTIONS_DISPLAY_HOST, WAYFINDING } from "@/lib/routes";

/**
 * 오시는 길 — **길찾기 링크 카드 + 교통 안내가 한 컴포넌트**다(§29 · 검증 17회차 요구 118·135·137).
 *
 * ## 왜 한 컴포넌트인가 — 규율이 아니라 **구조로** 못박는다
 *
 * 검증 §17-6: *"교통 안내가 없는 길찾기 링크는 그 자체로 위험을 만든다"* —
 * 네이버 길찾기 화면 상단에 **`자동차` 탭이 노출**되고, 조합원이 한 번 누르면 자가용 경로가 나온다.
 * 집회 당일 인근 도로는 통제된다.
 *
 * **두 곳에 따로 두고 "잊지 말고 같이 고치자"는 규율에 맡기지 않는다.**
 * 이 컴포넌트 하나만 존재하면 **"교통 안내 없는 링크"를 만들 방법이 자체가 없다.**
 * 문자열·URL 이 한 벌이므로 요구 78(8/28 전 URL 재확인)도 **한 번의 수정으로 양쪽에 반영**된다.
 * `ZONE_STATUS` 를 단일 출처로 만든 것과 같은 원칙이다.
 *
 * ## 두 곳에 렌더된다 — 중복이 아니라 **다중 표면**
 *
 * - **블록 1 `<dl>` 아래**: *"언제 어디로 가야 하나"* 를 읽은 직후의 **"그래서 어떻게 가지?"**
 * - **지도 섹션 마지막**: 지도·범례로 위치를 확인한 직후의 같은 질문
 *
 * 조합원은 **둘 중 하나만 읽어도 손해가 없다.**
 *
 * ## 하지 말 것
 *
 * - **교통 안내를 링크 카드 `<a>` 안에 넣지 마라.** 카드 전체가 단일 링크라(§24.5.1)
 *   **교통 안내가 링크 텍스트가 되고 접근성 이름이 오염되며, 눌렀을 때 네이버로 간다.**
 *   컴포넌트가 카드를 감싸고 **교통 안내는 카드 밖 형제 요소**다.
 * - **컨테이너에 테두리·배경을 주지 마라** — 링크 카드가 이미 `border-2` 라 **카드 안의 카드**가 된다.
 *   묶는 것은 **근접성(간격)** 이다.
 * - **헤딩(`<h2>`/`<h3>`)을 만들지 마라**(§29.1.2): 별도 섹션 금지(요구 121)이고,
 *   두 곳에 렌더되므로 **같은 이름 헤딩이 아웃라인에 2개** 생긴다.
 *   `지하철 9호선 국회의사당역 5번 출구` 문장이 **소제목 역할**을 한다.
 */
export function WayfindingBlock({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      {/*
        길찾기 링크 카드 — §24.5 승인본 **무수정 재사용**(요구 76 · §24.6 확정 URL).

        `href` 는 **`WAYFINDING.url` 을 쓴다.** `EXTERNAL_LINKS.naverDirections` 를 직접 참조하지 마라 —
        같은 URL 이 두 이름으로 존재하면 **이 컴포넌트가 구조로 막으려던 "한쪽만 고쳐진다"가
        상수 층에서 되살아난다.** 요구 78(URL 형식이 바뀌면 조용히 깨진다) 재확인 때
        누군가 `WAYFINDING.url` 을 고쳤는데 화면이 안 바뀌는 상황이 정확히 그것이다.
        역·출구·URL 이 **한 객체**에 있어야 요구 112(3구역 확정 시 최근접역 재판정)에서 한 곳만 고친다.

        외부 이동 **3중 병행**(§14.1): ↗ 아이콘 + 메타 문구 + 접근성 이름(카드 전체가 단일 `<a>` 라
        내부 텍스트가 접근성 이름에 자동 포함된다 — 별도 `sr-only` 불필요).
        **↗ 를 텍스트 문자로 쓰지 마라**(서체마다 위치·크기가 튄다). SVG 컴포넌트를 재사용한다.
        **아웃라인 필 버튼(§20.14.3) 모양을 쓰지 마라** — 그것은 우리 페이지 안에서 일어나는
        조작의 형태다. 외부 이동은 다르게 생겨야 한다. **오렌지(accent)도 쓰지 마라**(온누리·CI 전용).
        보조 문구를 **`ink-muted` 로 흐리지 마라** — "빈 화면이 떴다"를 막는 문장이라 읽어야 한다.
        **이 링크는 내장 지도·텍스트 안내를 대체하지 않는다**(요구 77 · §0.4).
      */}
      <a
        href={WAYFINDING.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-card ease-out-soft group block border border-border-strong bg-bg p-4 transition-colors duration-150 hover:outline-2 hover:outline-primary focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        {/* 카드 어디에 hover 해도 제목에 밑줄이 뜬다 — 온누리 카드와 같은 규칙(§16.9.7) */}
        <span className="block break-keep text-body font-bold text-primary group-hover:underline">
          네이버 지도로 길찾기
          <ExternalLinkIcon className="ml-1 inline size-4 align-[-2px]" />
        </span>
        <span className="mt-1 block break-keep text-caption text-ink">
          도착지는 국회의사당역 3번 출구입니다. 출발지를 입력하면 경로가 나옵니다.
        </span>
        {/* URL 전체를 노출하지 않는다 — 네이버 내부 인코딩이라 판독 가치가 0이다(§24.6) */}
        <span className="mt-1.5 block text-caption text-ink-muted">
          외부 링크(새 창) · {NAVER_DIRECTIONS_DISPLAY_HOST}
        </span>
      </a>

      {/*
        교통 안내 — **위계를 색·크기가 아니라 굵기와 순서로 세운다**(§29.4).
        대형 수치·색 강조가 금지돼 있고(요구 114·125) `18:30` 이 이 페이지의 유일한 대형 수치다.
        **적색·배지·아이콘·밑줄·형광 전부 금지.**

        ① 소제목 역할(700) — 헤딩을 대신한다. **`text-lead`(20px)로 키우지 마라**:
           블록 1 폭(273px)에서 2줄이 되어 무거워진다(실측). 18px 이면 1줄이다.
      */}
      <p className="mt-3 break-keep text-body font-bold text-ink">
        지하철 {WAYFINDING.line} {WAYFINDING.station} {WAYFINDING.exit}
      </p>

      {/*
        ② ★ **이 블록의 존재 이유다**(요구 107·138 — 1급 확인).
        서울시메트로9호선 공식 마크업으로 확인했다: 국회의사당역에는 `express` 클래스가 없다.
        **급행을 탄 조합원은 국회의사당역을 지나친다.**
        `9호선 일반` 만 쓰고 이 문장을 생략하면 **아는 사람만 아는 표기**가 되어 블록의 목적이 사라진다.
        **본문 3문장 중 유일한 semibold** — 셋 중 하나만 굵으면 그것이 읽힌다.

        ⚠ **`급행을 탔다면 여의도역에서 갈아타세요` 를 덧붙이지 마라** — **환승 절차 미확인**(요구 111).
        승강장·환승 구조를 모르는 채로 안내하면 조합원이 헤맨다.
        ⚠ 이 문장은 `WAYFINDING.expressSkipsStation` 에 매달려 있다 — 최근접역이 **여의도역**(급행 정차역)으로
        바뀌면 **즉시 거짓이 된다.** 역 이름만 치환하지 마라(`routes.ts` 주석 참조).
      */}
      {WAYFINDING.expressSkipsStation ? (
        <p className="mt-2 break-keep text-body font-semibold text-ink">
          ※ 급행은 {WAYFINDING.station}에 서지 않습니다. 일반열차를 이용해 주세요.
        </p>
      ) : null}

      {/*
        ③ 2급 확정 사실 + 행동 지시. **구간명·시각을 쓰지 마라**(요구 117 — 미확인).
        `통제될 수 있습니다` 같은 유보형으로 약화하지도 마라 — 경찰 협의를 거친 확정 사항이다.
      */}
      <p className="mt-2 break-keep text-body text-ink">
        ※ 집회 당일 인근 도로가 통제됩니다. 지하철 또는 도보로 와 주세요.
      </p>

      {/*
        ④ **예상**이다(요구 109·116). **`버스는 운행하지 않습니다` 같은 단정형으로 고치지 마라** —
        통제 대상은 도로이고 노선 운행 여부는 확인되지 않았다. **주차 관련 문장도 넣지 마라**(요구 110).

        15px 로 내리는 것은 *"덜 중요해서"가 아니라 "확정도가 낮아서"* 다 —
        ③은 2급 확정, ④는 예상이고 **크기 차이가 그 구분을 진다**(§20.0-5 확정도 시각 구분의 연장).
        **`ink-muted` 로 흐리지 마라** — 읽어야 하는 문장이다.
      */}
      <p className="mt-1 break-keep text-caption text-ink">
        버스·자가용은 늦어지거나 접근이 어려울 수 있습니다.
      </p>
    </div>
  );
}
