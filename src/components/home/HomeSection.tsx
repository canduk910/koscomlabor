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
 * 섹션 프레임 (스펙 §16.11.3 — §15.3 의 시각 갱신판). 4개 섹션이 완전히 동일한 프레임을 쓴다.
 * "같은 급의 섹션 4개"가 한눈에 읽히는 것이 이 컴포넌트의 유일한 목적이다.
 *
 * - **액센트 바(`h-1 w-16 bg-primary`) 폐기** — 되살리지 말 것: ① 72/120px 섹션 간격이
 *   3.0~4.3배 비율로 소속을 이미 확정한다(§16.7.2) ② 4px 실선 × 4섹션 반복은 "구분은 여백으로"
 *   (§0.2-3)와 정면 충돌하고 템플릿 인상을 준다 ③ 히어로의 흰 액센트 바도 폐기했으므로
 *   "동일 기하 재사용" 명분이 소멸했다
 * - 제목 `text-h2 md:text-h1`(24 / 36px, 700): 모바일 24px 유지 — 히어로 표제가 40px 이므로
 *   36px 이면 위계가 흐려진다. md+ 는 히어로 64px 이라 36px 이 안전하다
 * - `aria-labelledby` 로 h2 를 참조 — 접근성 이름이 화면 제목과 영구히 일치한다(§15.9.1)
 * - `scroll-mt-6 md:scroll-mt-8`: 앵커 도착 시 제목이 뷰포트 최상단에 붙지 않게 한다.
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
      <h2 id={headingId} className="text-h2 text-ink md:text-h1">
        {label}
      </h2>
      <div className="mt-6 md:mt-7">{children}</div>
    </section>
  );
}
