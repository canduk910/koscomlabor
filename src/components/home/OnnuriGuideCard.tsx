import { EXTERNAL_LINKS } from "@/lib/routes";
import { BookIcon, ExternalLinkIcon } from "@/components/ui/icons";

/**
 * 디지털온누리 사용 가이드 외부 링크 카드 (스펙 §9 — 2026-08-16 CI 개정으로 accent 계열).
 * - 카드 전체가 단일 <a> 블록, 새 창 열림 (target=_blank + noopener noreferrer)
 * - 외부 이동 표시 3중 병행: ↗ 아이콘 + "새 창에서 열립니다" 문구 + 접근성 이름
 *   (설명이 <a> 내부 텍스트이므로 접근성 이름에 자동 포함 — 스펙 §9.2)
 * - 설명은 tint 배경 위이므로 ink-muted 금지 → --color-ink (15.58:1, 채택 #5)
 * - 좌측 보더 --color-accent (#ec6d1e — 장식 전용: tint 인접면 UI 미달이므로
 *   의미 전달 UI 아님. 카드의 의미는 아이콘+문구+배경 차이가 전달 — 스펙 §9.2)
 * - 제목·아이콘·hover 아웃라인은 --color-accent-strong (#7a3806, 채택 #17·#18)
 * - 포커스 링만 사이트 전역 파랑(--color-primary) 유지 — 키보드 사용자 일관성 (§9.2)
 * - 적색·"긴급" 배지·전폭 배경 금지 (긴급 배너와의 위계 구분 — 스펙 §8·§9)
 * - 설명 말줄임 금지 — 새 창 안내 문구가 잘리면 안 됨 (2줄 흘림 허용)
 */
export function OnnuriGuideCard() {
  return (
    <a
      href={EXTERNAL_LINKS.onnuriGuide}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-touch items-center gap-3 rounded-xl border-l-4 border-accent bg-accent-tint p-4 hover:outline-2 hover:outline-accent-strong focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-6"
    >
      <BookIcon className="size-6 shrink-0 text-accent-strong" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold text-accent-strong group-hover:underline">
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
