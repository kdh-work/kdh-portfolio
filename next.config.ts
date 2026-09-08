import type { NextConfig } from "next";

/**
 * GitHub Pages 는 사이트를 `https://<계정>.github.io/<저장소>/` 하위 경로에 둔다.
 * 저장소 이름이 바뀌면 이 값만 고친다. 루트 도메인(Vercel, 사용자 도메인)으로 옮기면 "" 로 비운다.
 */
const basePath = "/kdh-portfolio";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // GitHub Pages 등 정적 호스팅용. `next build` 결과가 out/ 에 순수 HTML·CSS·JS 로 나온다.
  // 서버 API 라우트를 추가하게 되면 이 옵션은 제거하고 서버가 있는 호스팅으로 옮긴다.
  output: "export",
  basePath,
  // /demo 를 demo/index.html 로 내보낸다. 확장자 없는 주소를 알아서 연결해 주지 않는 정적 호스팅에서도 동작한다.
  trailingSlash: true,
  // next/image 의 src 에는 basePath 가 자동으로 붙지 않으므로, 이미지 컴포넌트가 이 값을 읽어 직접 붙인다.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // 정적 호스팅에서는 이미지 최적화 서버가 없으므로 끈다.
  images: { unoptimized: true },
};

export default nextConfig;
