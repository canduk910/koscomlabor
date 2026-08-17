import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AdminApp } from "@/components/admin/AdminApp";

/**
 * 관리자 화면 (스펙 §14) — noindex (검색 비노출).
 * 공개 헤더·푸터 유지 + 헤더 아래 "관리자" 배지 (§14.2).
 * 인증·데이터는 전부 클라이언트(AdminApp)에서 세션 쿠키 기반으로 처리.
 */
export const metadata: Metadata = {
  title: "관리자 — 전국금융산업노동조합 코스콤(한국증권전산)지부",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        {/* §16.14-1: 컨테이너는 `max-w-admin`(48rem) — 공개 화면용 `max-w-page` 가 60rem 로
            넓어졌으므로 그대로 두면 w-full 입력 필드가 896px 로 늘어나 폼 조작성이 나빠진다.
            admin 은 재설계 대상이 아니며 종전 폭(768px)을 보존하는 것이 §16 의 규정이다. */}
        <div className="mx-auto mt-4 w-full max-w-admin px-4 md:px-6">
          <h1 className="inline-flex items-center rounded bg-primary-soft px-2 py-0.5 text-caption font-bold text-primary">
            관리자
          </h1>
          <AdminApp />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
