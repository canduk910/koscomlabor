import { EXTERNAL_LINKS } from "@/lib/routes";
import { BookIcon, ExternalLinkIcon } from "@/components/ui/icons";

/**
 * 디지털온누리 사용 가이드 외부 링크 카드 (스펙 §16.9.7 — §15.7 위치·색 체계 계승, 표면만 교체).
 * - 카드 전체가 단일 <a> 블록, 새 창 열림 (target=_blank + noopener noreferrer)
 * - 외부 이동 표시 3중 병행: ↗ 아이콘 + "새 창에서 열립니다" 문구 + 접근성 이름
 *   (설명이 <a> 내부 텍스트이므로 접근성 이름에 자동 포함 — 스펙 §9.2)
 * - 설명은 tint 배경 위이므로 ink-muted 금지 → --color-ink (15.58:1)
 * - 제목·아이콘·hover 아웃라인은 --color-accent-strong (#7a3806, 7.84 / 8.77)
 * - 포커스 링만 사이트 전역 파랑(--color-primary, 10.18) 유지 — 키보드 사용자 일관성 (§9.2)
 * - 적색·"긴급" 배지·전폭 배경 금지 (긴급 배너와의 위계 구분 — 스펙 §8·§9)
 * - 설명 말줄임 금지 — 새 창 안내 문구가 잘리면 안 됨 (2줄 흘림 허용)
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
      <BookIcon className="size-6 shrink-0 text-accent-strong" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold text-accent-strong group-hover:underline md:text-lead">
          디지털온누리 사용 가이드
        </span>
        <span className="mt-1 block text-caption font-normal text-ink">
          코스콤 조합원 대상 안내 · 외부 페이지가 새 창에서 열립니다
        </span>
      </span>
      <ExternalLinkIcon className="size-5 shrink-0 text-accent-strong" />
    </a>
  );
}
