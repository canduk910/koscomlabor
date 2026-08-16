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
        <div className="mx-auto mt-4 w-full max-w-page px-4 md:px-6">
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
