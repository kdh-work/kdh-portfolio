import { fitTextToWidth } from "../scene/text";

/**
 * 박스 위 이름 줄임. **두 렌더러가 같은 함수를 쓴다** — 한쪽만 자르면 긴 이름에서
 * 라벨이 이웃과 겹쳐 두 화면이 달라 보인다(WebGL 에서 실제로 겹쳤다).
 *
 * 기준이 글자 수(16자)에서 **폭**으로 바뀌었다. 글자 수로 자르면 라틴 이름은 박스가
 * 남는데도 잘리고 한글 이름은 같은 글자 수여도 두 배 가까이 넓어 박스를 넘는다.
 * 실제로 2D 에서 가장 긴 이름이 88px 이라 82px 짜리 박스를 넘쳐 났다 — 3D 는
 * 마름모라 덜 드러나지만 2D 는 사각형이라 글자가 변을 넘는 것이 그대로 보인다.
 *
 * 쓸 수 있는 폭은 레이아웃이 노드에 실어 보낸다(`IsoNode.labelMaxWidth`). 렌더러는
 * 박스의 그리드 치수를 모르고 완성된 경로만 받으므로 스스로 계산할 수 없다.
 */
export const NODE_FONT = { name: 11, sub: 10 } as const;

export const fitNodeLabel = (
  text: string,
  fontSize: number,
  maxWidth: number,
): string => fitTextToWidth(text, fontSize, maxWidth);
