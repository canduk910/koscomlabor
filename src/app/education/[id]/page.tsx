import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/api/posts";
import { toPostDetailView } from "@/lib/postView";
import { ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PostArticle } from "@/components/board/PostArticle";

interface EducationPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 노동교육 상세 (§15.6R-G) — `notices/[id]`·`news/[id]` 와 동일 구조.
 * 링크형 교육 게시물은 카드에서 외부로 직행하므로 이 라우트는 **작성형 교육 게시물과
 * 직접 URL 접근·공유를 위한 경로**다. 미존재·삭제·분류 불일치 id는 404.
 * ISR revalidate 60초.
 */
export const revalidate = 60;

export async function generateMetadata({ params }: EducationPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getPost(id);
  if (!result.ok || result.data.category !== "education") return {};
  return { title: `${result.data.title} — 전국금융산업노동조합 코스콤(한국증권전산)지부` };
}

export default async function EducationDetailPage({ params }: EducationPageProps) {
  const { id } = await params;
  const result = await getPost(id);
  if (!result.ok || result.data.category !== "education") notFound();

  return (
    <>
      <SiteHeader asHeading={false} />
      <main className="flex-1">
        <PostArticle
          post={toPostDetailView(result.data)}
          backHref={ROUTES.homeSection("education")}
        />
      </main>
      <SiteFooter />
    </>
  );
}
