import { EXTERNAL_LINKS, ONNURI_GUIDE_DISPLAY_HOST } from "@/lib/routes";
import { ExternalLinkIcon, SearchIcon } from "@/components/ui/icons";

/**
 * 디지털온누리 외부 링크 카드 (스펙 §16.9.7 — §15.7 위치·색 체계 계승, 표면만 교체).
 *
 * ⚠ **제목·설명·아이콘이 2026-08-25 에 사용자 지정으로 교체됐다.**
 *   제목  `디지털온누리 사용 가이드` → `디지털온누리 가맹점 스마트 검색`
 *   설명  `코스콤 조합원 대상 안내 · 외부 페이지가 …` → `브랜드/상품유형별 … 가맹점 검색에이전트`
 *   아이콘 `BookIcon`(책) → `SearchIcon`(돋보기) — 카드가 «가이드» 에서 «검색 서비스» 가 됐다.
 * **«새 창» 고지는 사라지지 않았다 — 메타 줄로 옮겼다**(아래 주석).
 * 파일명·식별자(`OnnuriGuideCard`·`EXTERNAL_LINKS.onnuriGuide`)는 **그대로 뒀다** —
 * 링크 대상이 같고, 이름만 바꾸면 참조가 흩어져 «한 출처» 가 깨진다.
 * - 카드 전체가 단일 <a> 블록, 새 창 열림 (target=_blank + noopener noreferrer)
 * - 외부 이동 표시 3중 병행: ↗ 아이콘 + "외부 링크(새 창)" 문구 + 접근성 이름
 *   (설명이 <a> 내부 텍스트이므로 접근성 이름에 자동 포함 — 스펙 §9.2)
 * - 설명은 tint 배경 위이므로 ink-muted 금지 → --color-ink (15.58:1)
 * - 제목·아이콘·hover 아웃라인은 --color-accent-strong (#7a3806, 7.84 / 8.77)
 * - 포커스 링만 사이트 전역 파랑(--color-primary, 10.18) 유지 — 키보드 사용자 일관성 (§9.2)
 * - 적색·"긴급" 배지·전폭 배경 금지 (긴급 배너와의 위계 구분 — 스펙 §8·§9)
 * - 설명·메타 말줄임 금지 — 새 창 안내가 잘리면 3중 병행이 깨진다 (여러 줄 흘림 허용)
 *
 * §16.5 표면 규칙 — **되살리지 말 것** (현행 3중 위반의 시정):
 * - `shadow-card` 제거: L3 강조 면은 **배경색이 분리 수단**이다
 * - 좌측 4px accent 보더 제거: #ec6d1e 는 tint 인접면에서 2.78 로 의미 UI 자격이 없어
 *   순수 장식이었다. 의미는 아이콘 + 오렌지 제목 + 문구가 전달하므로 **정보 손실 0**
 * - radius 는 rounded-panel(24px) — 종전 rounded-card 와 픽셀 동일(토큰 의미 재정렬, §16.4)
 */
export function OnnuriGuideCard() {
  return (
    <a
      href={EXTERNAL_LINKS.onnuriGuide}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-panel ease-out-soft group flex min-h-touch items-center gap-4 bg-accent-tint p-5 transition-transform duration-200 hover:outline-2 hover:outline-accent-strong focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5 md:p-6"
    >
      <SearchIcon className="size-6 shrink-0 text-accent-strong" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold text-accent-strong group-hover:underline md:text-lead">
          {/* ★ **문면은 사용자가 지정했다**(2026-08-25) — 한 글자도 바꾸지 마라 */}
          디지털온누리 가맹점 스마트 검색
        </span>
        {/*
          ★ **설명 줄도 사용자 지정 문면이다**(2026-08-25).
          종전: `코스콤 조합원 대상 안내 · 외부 페이지가 새 창에서 열립니다`.

          ⚠⚠ **종전 줄이 «새 창» 고지를 지고 있었다.** 그대로 갈아 끼우면
          **외부 이동 3중 병행(↗ 아이콘 + 문구 + 접근성 이름)이 2중으로 떨어진다.**
          그래서 «새 창» 은 **아래 메타 줄로 옮겼다** — 이 사이트의 다른 외부 링크 카드
          (`WayfindingBlock`·QR 인증 카드)가 이미 쓰는 `외부 링크(새 창) · 도메인` 형식이다.
          **채널은 3개 그대로이고 카드 3장의 형식이 오히려 같아졌다.**

          ⚠ **`break-keep` 을 넣지 마라.** `브랜드/상품유형별`·`오프라인/온라인` 은
          어절이 길어 `/` 가 유일한 줄바꿈 기회다. 어절 유지를 걸면 카드 밖으로 나간다.
        */}
        <span className="mt-1 block text-caption font-normal text-ink">
          브랜드/상품유형별 오프라인/온라인 가맹점 검색에이전트
        </span>
        {/*
          목적지 주소 (§20.12) — **추가만 했다. 위 2줄은 문구·클래스 그대로다.**
          도메인만 쓰는 이유: 전체 URL 은 360px 카드 안(197px)에서 28px 넘치고, URL 은 공백이
          없어 어절 줄바꿈이 안 되므로 카드 밖으로 삐져나간다(§20.12.1 실측).
          `https://` 는 이 사이트 모든 외부 링크에 공통이라 변별 정보가 0이다.
          문자열은 `href` 에서 파생한다 — 링크가 바뀌었는데 화면에 옛 주소가 남으면
          "클릭 전에 목적지를 알려준다"는 목적을 정면으로 배신한다(§20.12.6).
          색은 카드의 링크 색과 같은 accent-strong(#7a3806 on #fdf0e7 = 7.84 AAA) —
          tint 면 위 ink-muted 는 §16.9.7 이 금지한 조합이다.
          `break-all` 은 텍스트 확대 200%(15px→30px) 에서 카드 밖으로 나가지 않게 하는 보험이다.
          **`truncate`·말줄임 금지** — 주소가 잘리면 표시하는 의미가 사라진다.
          `aria-hidden`: 카드 전체가 단일 <a> 라 내부 텍스트가 전부 접근성 이름에 들어간다.
          도메인이 섞이면 스크린리더가 문자 단위로 끊어 읽어 낭독이 장황해진다 —
          숨긴 것은 콘텐츠가 아니라 `href` 의 시각적 사본이므로 §0.4 은폐와 무관하다.
        */}
        <span className="mt-1 block break-all text-caption text-accent-strong">
          {/*
            ★ **«외부 링크(새 창)» 은 `aria-hidden` 밖에 둔다** — 스크린리더가 읽어야 한다.
            설명 줄이 지고 있던 «새 창» 고지가 이리로 왔기 때문이다(위 주석).
            **도메인만** 숨긴다: 아래 `aria-hidden` 의 근거는 «낭독이 장황해진다» 이지
            «새 창 고지를 숨겨도 된다» 가 아니다. 둘을 한 덩어리로 묶지 마라.
          */}
          외부 링크(새 창)
          <span aria-hidden="true"> · {ONNURI_GUIDE_DISPLAY_HOST}</span>
        </span>
      </span>
      <ExternalLinkIcon className="size-5 shrink-0 text-accent-strong" />
    </a>
  );
}
