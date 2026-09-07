import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Netlify Drop 등 정적 호스팅용. `next build` 결과가 out/ 에 순수 HTML·CSS·JS 로 나온다.
  // 서버 API 라우트를 추가하게 되면 이 옵션은 제거하고 Netlify 의 Next.js 런타임으로 배포한다.
  output: "export",
  // 정적 호스팅(GitHub Pages 등)으로도 내보낼 수 있도록 이미지 최적화를 끈다.
  // Vercel 전용으로만 쓸 경우 이 옵션을 지우면 자동 최적화가 켜진다.
  images: { unoptimized: true },
};

export default nextConfig;
