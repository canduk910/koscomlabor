import Link from "next/link";
import type { PostListItem } from "@/lib/postView";
import { ROUTES } from "@/lib/routes";
import { UrgentBadge } from "@/components/ui/UrgentBadge";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * 히어로 패널 (스펙 §16.11.1 — §11.4 대체).
 *
 * 페이지의 **유일한 강조 면**이다(§0.2-5): 딥블루 면 + shadow-hero 부양 + 큰 단문.
 * - 모드 1: verified+urgent 최신 1건 바인딩 (배지+게시일 / hero 제목 40·64px / CTA 필 버튼)
 * - 모드 2: 폴백 (urgent 0건) — **단문 메시지 1줄.** 문구는 사용자 지정 문자열 그대로이며
 *   신규 카피를 만들지 않는다.
 *
 * §16 에서 폐기한 것 (되살리지 말 것):
 * - **장식 원형(--color-primary-bright)**: 3.89:1 장식이 텍스트와 겹치는 기하 문제로 이미
 *   모드 2 에서 미렌더 예외였다. 폐기하면 `relative overflow-hidden`·`z-10` 래퍼도 불필요해진다.
 * - **흰 액센트 바(h-1 w-16)**: 선 요소 감축(§16.5). 제목–CTA 간 32/40px 여백이 구분을 담당.
 * - **모드 2 의 지부명 2줄 록업**: ① 헤더 h1 과 문자열이 완전 중복 ② 한 화면에 하나의
 *   메시지(§0.2-2) ③ nowrap 록업이 360px 에서 약 9.6px 넘쳐 잘리던 결함이 구조적으로 소멸한다
 *   (§16.11.1 검산). 단문은 자동 줄바꿈되며 40px 기준 360px 에서 2줄이다.
 *
 * 제목 요소: 모드 1 은 h2 유지(실제 콘텐츠 제목·페이지 1순위 정보), 모드 2 는 <p>
 * (§15.9.1 계승 — 헤딩 아웃라인이 `h1 지부명 → h2×4 섹션` 목차로 남는다).
 * 자간·굵기는 --text-hero / --text-hero-lg 토큰에 내장되어 있다(§16.3.1 — 클래스 중복 불요).
 */
export function HeroPanel({ post }: { post: PostListItem | null }) {
  /*
   * ★ **urgent 공지가 없으면 아무것도 렌더하지 않는다**(§36.2 · 2026-08-21).
   *
   * 종전에는 모드 2(`26년 임단협 투쟁 안내` + `/bargaining-2026` CTA)가 폴백이었는데
   * **사용자가 그것을 삭제하라고 지시**했다. 빈 `<section>` 을 남기면 **딥블루 면만 덩그러니
   * 남으므로** 컴포넌트째 사라지는 것이 맞다.
   *
   * 히어로 자리를 무엇이 채우는지는 **호출부가 정한다**(`src/app/page.tsx`):
   *   urgent 있음                 → 이 컴포넌트(공지)  + `StrikeBanner surface="panel"` 이 아래
   *   urgent 없음 · 9/4 전·당일    → `StrikeBanner surface="hero"` 가 이 자리에
   *   urgent 없음 · 9/4 이후       → **비운다** → 최상단은 `StrikeBanner surface="panel"` 하나가 된다
   *
   * ⚠⚠ **2026-08-29 에 전제가 바뀌었다 — 종전 주석을 인용하지 마라.**
   * 종전에는 *"**9/4 를 말할 승인 문자열이 없으므로 만들지 않는다**"* 였고, 그래서 8/28 이 지나면
   * 히어로를 비워 **미니달력이 9/4 를 이어받게** 하는 것이 설계였다. **이 라운드가 그 문자열을
   * 만들었다** — 리더 D-8 확정 문면(`9/4(금) 총파업 참석안내`)과 `/strike-2026-09-04` 가 생겼고,
   * 8/28 배너는 파일째 내려갔다(D-6·D-12).
   *
   * ⚠ 그리고 *"날짜가 지나면 페이지가 스스로 옳아진다"* 는 **9/4 에는 성립하지 않는다**(§52.10-1) —
   * 9/4 가 `STRUGGLE_SCHEDULE` 의 **마지막 일정**이라 그날이 지나면 미니달력조차 렌더되지 않는다.
   * 이어받을 것이 없다. 근거와 처분은 `src/app/page.tsx` 의 결정표 주석에 있다.
   */
  if (post === null) return null;
  return (
    <section
      aria-label="주요 소식"
      className="rounded-panel bg-primary shadow-hero p-5 md:rounded-panel-lg md:p-12"
    >
      {post !== null ? (
        <>
          <p className="flex flex-wrap items-center gap-3">
            <UrgentBadge withIcon />
            <time dateTime={post.publishedAt} className="text-caption text-primary-soft">
              {post.dateLabel}
            </time>
          </p>
          {/* §12.2·§16.3.4: 히어로 표제 — Gmarket Sans Bold 700, 자간 -0.03em(토큰 내장) */}
          <h2 className="font-display mt-5 line-clamp-3 text-hero text-white md:mt-6 md:text-hero-lg">
            {post.title}
          </h2>
          <p className="mt-8 md:mt-10">
            <Link
              href={ROUTES.notice(post.id)}
              className="font-display ease-out-soft inline-flex min-h-touch items-center gap-2 rounded-full bg-white px-7 text-body font-medium tracking-[-0.01em] text-primary transition-colors duration-150 hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              자세히 보기
              <ArrowRightIcon className="size-5" />
            </Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
