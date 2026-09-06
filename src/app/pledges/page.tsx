import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPledges } from "@/lib/api/pledges";
import { PLEDGE_DASHBOARD_NAME } from "@/lib/pledges";
import { ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon, ConstructionIcon } from "@/components/ui/icons";
import { PledgeBoard } from "@/components/pledges/PledgeBoard";

/**
 * 공약 이행 현황 전체보기 (사용자 지시 2026-09-06).
 *
 * ★★ **이 페이지는 대시보드를 통해서만 들어온다**(사용자 확정 2026-09-06). 두 장치가 그것을 진다:
 *   ① 관리자가 «비공개»로 두면 **404** 다 — 주소를 알아도 열리지 않는다
 *   ② `noindex` 라 **검색으로 발견되지 않는다**
 *   ⛔ 어느 하나도 빼지 마라. 링크가 메인 상황판 하나뿐이라는 사실만으로는
 *     «대시보드를 통해서만»이 성립하지 않는다 — 주소는 공유되고 검색엔진은 기어 다닌다.
 *
 * ★ **«비공개»(404)와 «통신 실패»(안내 문구)를 갈라라.** 서버가 죽었을 때 「없는 페이지」를
 *   보여주면 조합원은 페이지가 «폐지됐다»고 읽는다. 404 는 우리가 «알고» 닫았을 때만이다.
 *
 * ⚠ API 미설정·실패 시 **가짜 목록을 만들지 않는다** — 왜 비었는지 정직하게 말한다(§15.6R-H).
 */
// ⛔ 이 줄을 지워 404 를 고치려 하지 마라 — 지우면 `s-maxage=31536000` 이 붙어
//   **재배포 전까지 영구 404** 가 된다. 낡은 404 를 막는 것은 `next.config.ts` 의 `expireTime` 이다.
export const revalidate = 60;

export const metadata: Metadata = {
  title: `${PLEDGE_DASHBOARD_NAME} — 전국금융산업노동조합 코스콤(한국증권전산)지부`,
  description: "코스콤 Dream 프로젝트 공약의 이행 상황을 달성·협의중·미달성으로 공개합니다.",
  // ⛔ 지우지 마라 — 위 머리 주석 ②. 「대시보드를 통해서만 진입」의 절반이다.
  // ⚠ **«비공개로 빌드 → 공개로 ISR 재생성» 된 응답에는 `nofollow` 가 빠지고 `noindex` 만 남는다**
  //   (실측 2026-09-06 · 정상 빌드된 `/admin` 은 `noindex, nofollow`). **고장이 아니다** —
  //   검색 비노출을 지는 것은 `noindex` 이고 그것은 두 경우 모두 붙는다. 여기를 손대지 마라.
  robots: { index: false, follow: false },
};

export default async function PledgesPage() {
  const result = await listPledges();

  // 비공개 = 우리가 «알고» 닫은 상태 → 404. 통신 실패는 여기서 걸리지 않는다(아래 안내로 간다)
  if (result.ok && !result.data.published) notFound();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <div className="mx-auto mt-8 w-full max-w-page px-4 pb-16 md:mt-14 md:px-8">
          {/* 이름은 `PLEDGE_DASHBOARD_NAME` 하나에서 온다 — 메인 대시보드와 «같은 글자»여야
              「전체보기」로 넘어온 사람이 같은 것으로 읽는다. 리터럴을 적지 마라.
              ⚠ `break-keep break-words` 를 빼지 마라(19자 · 200% 확대 §0.8) */}
          <h1 className="break-keep break-words text-title text-ink md:text-h1">
            {PLEDGE_DASHBOARD_NAME}
          </h1>
          <p className="mt-4 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
            {/* 공약집 표제(「핵심공약 — 코스콤 Dream 프로젝트」)에서 가져온 이름이다.
                ⛔ 여기서 이행 여부를 «설명»하지 마라 — 판정은 상태 배지와 비고가 한다 */}
            코스콤 Dream 프로젝트 공약의 이행 상황입니다.
          </p>

          {result.ok ? (
            <PledgeBoard pledges={result.data.pledges} />
          ) : (
            <div className="rounded-card mt-8 border border-border-strong bg-surface px-4 py-12 text-center">
              <ConstructionIcon className="mx-auto size-10 text-border-strong" />
              <p className="mt-4 text-body font-semibold text-ink">
                공약 현황을 불러오지 못했습니다
              </p>
              <p className="mt-2 break-keep break-words text-caption text-ink-muted">
                {result.message}
              </p>
            </div>
          )}

          <p className="mt-12 md:mt-16">
            <Link
              href={ROUTES.home}
              className="ease-out-soft inline-flex min-h-touch items-center gap-2 text-body font-semibold text-primary transition-colors duration-150 hover:underline focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              <ArrowLeftIcon className="size-5" />
              메인으로 돌아가기
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
