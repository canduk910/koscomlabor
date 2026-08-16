import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "전국금융산업노동조합 코스콤지부",
  description: "전국금융산업노동조합 코스콤지부 공식페이지 — 공지사항과 금융노조 소식을 전합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      {/* Pretendard Variable 다이나믹 서브셋 — 셀프호스팅(스펙 §11.2 방식 A, 외부 CDN 미사용).
          React가 <head>로 호이스팅한다. 자산은 scripts/sync-pretendard.mjs(postinstall)가 동기화.
          no-css-tags 예외: 서브셋 CSS는 92개 unicode-range 폰트를 참조하는 정적 자산으로,
          번들 import 대상이 아니라 public/ 정적 서빙이 스펙 지정 방식이다 */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/fonts/pretendard/pretendardvariable-dynamic-subset.css"
        precedence="default"
      />
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
