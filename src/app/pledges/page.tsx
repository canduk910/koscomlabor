import type { Metadata } from "next";
import Link from "next/link";
import { listPledges } from "@/lib/api/pledges";
import { ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ArrowLeftIcon, ConstructionIcon } from "@/components/ui/icons";
import { PledgeBoard } from "@/components/pledges/PledgeBoard";

/**
 * 공약 이행 현황 전체보기 (사용자 지시 2026-09-06).
 *
 * 메인의 요약 상황판이 유일한 진입점이다 — 메인에 43건을 전부 펼치지 않기로 한 것이
 * 이 페이지가 있는 이유다(사용자 확정). `ROUTES.pledges` 주석 참조.
 *
 * ⚠ API 미설정·실패 시 **가짜 목록을 만들지 않는다** — 왜 비었는지 정직하게 말한다(§15.6R-H).
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "공약 이행 현황 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  description: "코스콤 Dream 프로젝트 공약의 이행 상황을 달성·협의중·미달성으로 공개합니다.",
};

export default async function PledgesPage() {
  const result = await listPledges();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <div className="mx-auto mt-8 w-full max-w-page px-4 pb-16 md:mt-14 md:px-8">
          <h1 className="text-title text-ink md:text-h1">공약 이행 현황</h1>
          <p className="mt-4 max-w-[var(--container-prose)] break-keep break-words text-body text-ink">
            {/* 공약집 표제(「핵심공약 — 코스콤 Dream 프로젝트」)에서 가져온 이름이다.
                ⛔ 여기서 이행 여부를 «설명»하지 마라 — 판정은 상태 배지와 비고가 한다 */}
            코스콤 Dream 프로젝트 공약의 이행 상황입니다.
          </p>

          {result.ok ? (
            <PledgeBoard pledges={result.data} />
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
