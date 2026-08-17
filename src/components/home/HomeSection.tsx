import type { ReactNode } from "react";
import type { HomeSectionId } from "@/lib/homeSections";

interface HomeSectionProps {
  id: HomeSectionId;
  /** 섹션 제목 — 반드시 HOME_SECTIONS 에서 파생한 값을 넘긴다 (§15.11 불변식) */
  label: string;
  /**
   * 상단 여백 — **페이지가 주입한다**(§15.3). 기본값을 두지 않는 이유: 첫 섹션만 여백이
   * 다르므로(§15.2 간격표) 기본값이 있으면 누락이 눈에 띄지 않는다.
   */
  className: string;
  children: ReactNode;
}

/**
 * 섹션 프레임 (스펙 §15.3) — 4개 섹션이 완전히 동일한 프레임을 쓴다.
 * "같은 급의 섹션 4개"가 한눈에 읽히는 것이 이 컴포넌트의 유일한 목적이다.
 *
 * - 액센트 바 `h-1 w-16 bg-primary`: 히어로 모드 1의 흰 바와 동일 기하(장식·aria-hidden)
 * - 제목 `text-h2 md:text-h1`: 모바일 24px — 히어로 록업(30.8px)보다 작아야 위계가 유지된다
 * - `aria-labelledby` 로 h2 를 참조 — 접근성 이름이 화면 제목과 영구히 일치한다(§15.9.1)
 * - `scroll-mt-6 md:scroll-mt-8`: 앵커 도착 시 액센트 바가 뷰포트 최상단에 붙지 않게 한다.
 *   헤더가 sticky 로 바뀌면 이 값은 무효 — 헤더 실측 높이 이상으로 재산정할 것(§15.9.2)
 * - `tabindex="-1"` 을 붙이지 않는다 — 프래그먼트 이동은 브라우저 기본 동작이 정확하다(§15.9.2)
 */
export function HomeSection({ id, label, className, children }: HomeSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`scroll-mt-6 md:scroll-mt-8 ${className}`}
    >
      <div aria-hidden="true" className="h-1 w-16 bg-primary" />
      <h2 id={headingId} className="mt-3 text-h2 text-ink md:text-h1">
        {label}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
