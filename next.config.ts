import type { NextConfig } from "next";

/**
 * GitHub Pages 는 사이트를 `https://<계정>.github.io/<저장소>/` 하위 경로에 둔다.
 * 저장소 이름이 바뀌면 이 값만 고친다. 루트 도메인(Vercel, 사용자 도메인)으로 옮기면 "" 로 비운다.
 */
const basePath = "/kdh-portfolio";

/**
 * 개발 서버에서 루트(`localhost:3000`)로 들어오면 사이트 경로로 보낸다.
 *
 * `basePath` 때문에 개발 중에도 주소가 `localhost:3000/kdh-portfolio/` 라, 루트만
 * 열면 404 가 난다. 매번 경로를 붙여 치는 대신 한 번 넘겨 준다.
 *
 * **`basePath` 를 개발에서만 비우는 방식은 쓰지 않는다.** 그러면 배포와 경로
 * 구조가 달라져, 하위 경로에서만 드러나는 문제(정적 파일 경로에 basePath 가 빠진
 * 경우 등)를 로컬에서 잡을 수 없다. 경로는 그대로 두고 입구만 넓힌다.
 *
 * **키 자체를 개발에서만 만든다.** 정적 내보내기에는 리다이렉트를 적용할 서버가
 * 없어서 Next 가 빌드 때 경고를 내는데, 빈 배열을 돌려주는 것으로는 사라지지
 * 않는다 — `redirects` 가 설정에 **있는지**를 보고 경고하기 때문이다.
 *
 * `basePath: false` 는 이 규칙의 `source` 에 basePath 를 붙이지 말라는 뜻이다.
 * 붙으면 `/kdh-portfolio` 가 source 가 되어 정작 루트를 잡지 못한다.
 */
const devRootRedirect: Pick<NextConfig, "redirects"> =
  process.env.NODE_ENV === "development"
    ? {
        redirects: async () => [
          {
            source: "/",
            destination: `${basePath}/`,
            basePath: false,
            permanent: false,
          },
        ],
      }
    : {};

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
  ...devRootRedirect,
};

export default nextConfig;
