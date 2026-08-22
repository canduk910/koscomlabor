import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "전국금융산업노동조합 코스콤(한국증권전산)지부",
  description:
    "전국금융산업노동조합 코스콤(한국증권전산)지부 공식페이지 — 공지사항과 금융노조 소식을 전합니다.",
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
      {/*
        글자 크기 **선반영**(§ `FontScaleControl`). 저장값을 **페인트 전에** `<html>` 에 얹는다 —
        `useEffect` 로 미루면 기본 크기로 한 번 그려졌다가 바뀌어 **화면이 튄다**(FOUC).
        ⚠ 키 문자열은 `FontScaleControl.STORAGE_KEY` 와 **반드시 같아야 한다.** 한쪽만 고치면
        설정이 조용히 무시된다(에러가 나지 않아 더 위험하다).
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var v=localStorage.getItem('koscomlabor:font-scale');" +
            "if(v){v=Math.min(130,Math.max(90,parseInt(v,10)||100));" +
            "document.documentElement.style.fontSize=v+'%'}}catch(e){}",
        }}
      />
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
