import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerifiedNotices, getVerifiedPost } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PostArticle } from "@/components/board/PostArticle";

interface NoticePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 공지사항 상세 — verified 게시물만 정적 생성.
 * dynamicParams=false: generateStaticParams에 없는 slug(미검증·미존재)는 404.
 */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getVerifiedNotices().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: NoticePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getVerifiedPost("notice", slug);
  if (post === null) return {};
  return { title: `${post.title} — 전국금융산업노동조합 코스콤지부` };
}

export default async function NoticeDetailPage({ params }: NoticePageProps) {
  const { slug } = await params;
  const post = getVerifiedPost("notice", slug);
  if (post === null) notFound();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <PostArticle post={post} backHref={ROUTES.homeTab("notices")} />
      </main>
      <SiteFooter />
    </>
  );
}
