import { ExternalLinkIcon } from "@/components/ui/icons";
import { NAVER_DIRECTIONS_DISPLAY_HOST, WAYFINDING } from "@/lib/routes";

/**
 * 오시는 길 — **길찾기 링크 카드 + 교통 안내가 한 컴포넌트**다(§29 · 검증 요구 118·135·137).
 * 블록 1 `<dl>` 아래와 지도 섹션 끝, 두 곳에 렌더된다(조합원은 둘 중 하나만 읽어도 손해가 없다).
 *
 * ⚠ **둘을 갈라 두지 마라** — 네이버 화면 상단의 `자동차` 탭 때문에 «교통 안내 없는 링크»는
 *   그 자체로 위험이다(집회 당일 인근 도로는 통제된다). 한 컴포넌트면 그 자리를 만들 방법이 없다.
 * ⚠ **교통 안내를 링크 `<a>` 안에 넣지 마라** — 접근성 이름이 오염되고 눌렀을 때 네이버로 간다.
 * ⚠ **컨테이너에 테두리·배경을 주지 마라** — 링크 카드가 이미 테두리라 카드 안의 카드가 된다.
 * ⚠ **헤딩을 만들지 마라**(§29.1.2) — 별도 섹션 금지(요구 121)이고 두 곳 렌더라 헤딩이 2개 생긴다.
 */
export function WayfindingBlock({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      {/* 길찾기 링크 카드 (§24.5·§24.6). 외부 이동 3중 병행(§14.1) = ↗ 아이콘 + 메타 문구 + 접근성 이름.
          ⚠ `href` 에 `EXTERNAL_LINKS.naverDirections` 를 직접 쓰지 마라 — 같은 URL 이 두 이름이 되면
            «한쪽만 고쳐진다»가 상수 층에서 되살아난다(요구 78·112).
          ⚠ ↗ 를 텍스트 문자로 쓰지 마라(서체마다 위치·크기가 튄다).
          ⚠ 필 버튼 모양·오렌지(accent)를 쓰지 마라 — 필은 페이지 «안» 조작의 형태이고 오렌지는 CI 전용이다.
          ⚠ 보조 문구를 ink-muted 로 흐리지 마라. ⚠ 이 링크가 내장 지도·안내를 대체하지 않는다(요구 77) */}
      <a
        href={WAYFINDING.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-card ease-out-soft group block border border-border-strong bg-bg p-4 transition-colors duration-150 hover:outline-2 hover:outline-primary focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        {/* 카드 어디에 hover 해도 제목에 밑줄이 뜬다(§16.9.7) */}
        <span className="block break-keep text-body font-bold text-primary group-hover:underline">
          네이버 지도로 길찾기
          <ExternalLinkIcon className="ml-1 inline size-4 align-[-2px]" />
        </span>
        <span className="mt-1 block break-keep text-caption text-ink">
          도착지는 국회의사당역 3번 출구입니다. 출발지를 입력하면 경로가 나옵니다.
        </span>
        {/* URL 전체를 노출하지 않는다 — 네이버 내부 인코딩이라 판독 가치가 0이다(§24.6).
            ⚠ `break-all` 을 빼거나 `truncate` 로 바꾸지 마라 — 도메인은 공백 없는 덩어리라
              텍스트 확대에서 카드 밖으로 나간다(union-design-system §0.8) */}
        <span className="mt-1.5 block break-all text-caption text-ink-muted">
          외부 링크(새 창) · {NAVER_DIRECTIONS_DISPLAY_HOST}
        </span>
      </a>

      {/* 교통 안내 — 위계를 색·크기가 아니라 굵기와 순서로 세운다(§29.4).
          ⚠ 적색·배지·아이콘·밑줄·형광을 쓰지 마라(대형 수치·색 강조는 요구 114·125 로 금지).
          ① 소제목 역할 — ⚠ `text-lead` 로 키우지 마라. 블록 1 폭에서 2줄이 되어 무거워진다 */}
      <p className="mt-3 break-keep text-body font-bold text-ink">
        지하철 {WAYFINDING.line} {WAYFINDING.station} {WAYFINDING.exit}
      </p>

      {/* ② ★ 이 블록의 존재 이유다(요구 107·138 — 1급 확인). 본문 3문장 중 유일한 semibold 다.
          ⚠ 생략하지 마라 — "9호선 일반"만 남으면 아는 사람만 아는 표기가 된다.
          ⚠ `급행을 탔다면 여의도역에서 갈아타세요` 를 덧붙이지 마라 — 환승 절차 미확인(요구 111).
          ⚠ 최근접역이 급행 정차역으로 바뀌면 즉시 거짓이 된다. 역 이름만 치환하지 마라
            (그래서 `expressSkipsStation` 에 매달아 두었다 — `routes.ts` 주석 참조) */}
      {WAYFINDING.expressSkipsStation ? (
        <p className="mt-2 break-keep text-body font-semibold text-ink">
          ※ 급행은 {WAYFINDING.station}에 서지 않습니다. 일반열차를 이용해 주세요.
        </p>
      ) : null}

      {/* ③ 2급 확정 사실 + 행동 지시.
          ⚠ 통제 구간명·시각을 쓰지 마라(요구 117 — 미확인). 유보형으로 약화하지도 마라(확정 사항이다) */}
      <p className="mt-2 break-keep text-body text-ink">
        ※ 집회 당일 인근 도로가 통제됩니다. 지하철 또는 도보로 와 주세요.
      </p>

      {/* ④ **예상**이다. 캡션 크기인 것은 "덜 중요해서"가 아니라 "확정도가 낮아서"다(③과의 크기 차이가 그 구분).
          ⚠ `버스는 운행하지 않습니다` 류 단정형으로 고치지 마라 — 노선 운행 여부 미확인(요구 109·116).
          ⚠ 주차 관련 문장을 넣지 마라(요구 110). ⚠ ink-muted 로 흐리지 마라 */}
      <p className="mt-1 break-keep text-caption text-ink">
        버스·자가용은 늦어지거나 접근이 어려울 수 있습니다.
      </p>
    </div>
  );
}
