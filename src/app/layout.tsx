import type { Metadata, Viewport } from "next";
import { LightboxProvider } from "@/components/media/Lightbox";
import { profile } from "@/content/profile";
import "./globals.css";

export const metadata: Metadata = {
  title: `${profile.name} — ${profile.role}`,
  description: profile.lede,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // WebView 에서 노치 영역까지 그려야 하므로 safe-area 값을 직접 다룬다.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* precedence 를 주면 React 가 이 링크를 위치가 아니라 href 로 찾는다.
            호스팅(Netlify 등)이 <head> 에 주석·메타·줄바꿈을 끼워 넣어도 하이드레이션이 어긋나지 않는다. */}
        <link
          rel="stylesheet"
          precedence="default"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <LightboxProvider>{children}</LightboxProvider>
      </body>
    </html>
  );
}
