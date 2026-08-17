import { HOME_SECTIONS } from "@/lib/homeSections";
import { ArrowDownIcon } from "@/components/ui/icons";

/**
 * 섹션 바로가기 칩 (§15.4) — **활성 상태 변형을 만들지 말 것.**
 * 활성 표시가 곧 탭 은유이며, "지금 이것이 선택됨"이 보이면 나머지가 "안 보임"으로 읽힌다.
 */
const CHIP_CLASS =
  "inline-flex min-h-touch items-center gap-1.5 rounded-full border border-border-strong bg-bg px-3 text-body font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-tint hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-4";

interface SectionNavProps {
  /** 상단 여백 — 페이지가 주입한다(§15.2 간격표: 온누리 카드 → 내비 48px) */
  className: string;
}

/**
 * 섹션 바로가기 내비 (스펙 §15.4) — 폐기된 탭바의 대체물이 **아니다.**
 * 탭은 "고르지 않으면 안 보인다", 이 내비는 "전부 있고, 빨리 갈 수도 있다"다.
 *
 * 필수 규칙 (하나라도 어기면 탭으로 오독된다):
 * - **`"use client"` 금지 · JS 0** — 순수 `<a href="#id">` 프래그먼트 이동.
 *   `next/link` 를 쓰지 않는다: 같은 페이지 프래그먼트는 브라우저 네이티브 동작
 *   (스크롤 + 순차 포커스 시작점 이동)이 가장 정확하다
 * - **활성/선택 하이라이트 금지** — 스크롤 스파이도 금지. 4개 칩은 항상 동일한 외형
 * - **세그먼티드 컨트롤 외형 금지** — 각 칩은 독립된 아웃라인 칩(트랙·내부 채움 없음)
 * - **비sticky** — 문서 흐름에 둔다. 그래서 4개 타깃이 항상 아래에 있고 ↓ 아이콘이 언제나 참이다
 * - **조건부 렌더 금지** — 콘텐츠가 0건이어도 항상 렌더한다(구조가 상태에 따라 바뀌지 않는다)
 */
export function SectionNav({ className }: SectionNavProps) {
  return (
    <nav aria-label="페이지 섹션 바로가기" className={className}>
      <ul className="flex flex-wrap gap-2">
        {HOME_SECTIONS.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className={CHIP_CLASS}>
              {section.label}
              <ArrowDownIcon className="size-4 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
