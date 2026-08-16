import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "전국금융산업노동조합 코스콤지부",
  description: "전국금융산업노동조합 코스콤지부 공식페이지 — 공지사항과 금융노조 소식을 전합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
