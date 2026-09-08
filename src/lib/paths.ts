/** next.config.ts 의 basePath. 루트 배포에서는 빈 문자열. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * public/ 아래 정적 파일의 절대 경로에 basePath 를 붙인다.
 * next/link 와 CSS·JS 번들 경로는 Next.js 가 알아서 붙이지만, next/image 의 src 와 일반 <a href> 는 붙이지 않는다.
 */
export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
