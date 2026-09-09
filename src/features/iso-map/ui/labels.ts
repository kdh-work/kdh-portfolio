/**
 * 박스 위 이름 줄임. **두 렌더러가 같은 함수를 쓴다** — 한쪽만 자르면 긴 이름에서
 * 라벨이 이웃과 겹쳐 두 화면이 달라 보인다(WebGL 에서 실제로 겹쳤다).
 */
export const NODE_LABEL_MAX = 16;

export const truncateLabel = (text: string, max = NODE_LABEL_MAX): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
