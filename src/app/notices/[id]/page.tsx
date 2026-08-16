import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/api/posts";
import { toPostDetailView } from "@/lib/postView";
import { ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PostArticle } from "@/components/board/PostArticle";

interface NoticePageProps {
  params: Promise<{ id: string }>;
}

/**
 * 공지사항 상세 — DB(API) 기반, id는 uuid (§15-7 슬러그→id 전환 승인).
 * ISR revalidate 60초. 미존재·삭제된 id는 404.
 */
export const revalidate = 60;

export async function generateMetadata({ params }: NoticePageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getPost(id);
  if (!result.ok || result.data.category !== "notice") return {};
  return { title: `${result.data.title} — 전국금융산업노동조합 코스콤(한국증권전산)지부` };
}

export default async function NoticeDetailPage({ params }: NoticePageProps) {
  const { id } = await params;
  const result = await getPost(id);
  if (!result.ok || result.data.category !== "notice") notFound();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <PostArticle post={toPostDetailView(result.data)} backHref={ROUTES.homeTab("notices")} />
      </main>
      <SiteFooter />
    </>
  );
}
