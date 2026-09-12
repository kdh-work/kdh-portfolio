/**
 * SVG 텍스트 폭 근사.
 *
 * SVG 는 렌더 전에 실측(`getComputedTextLength`)이 불가능하므로 레이아웃 단계에서
 * 쓸 수 있는 값이 없다. 그래서 글리프 폭을 글자 종류로 나눠 추정한다. 한글·한자
 * 같은 전각은 글자 크기와 거의 같은 폭을, 라틴·숫자는 약 0.58 배를 차지한다.
 * 라틴 기준 한 값으로 뭉뚱그리면 한글 라벨의 판이 글자보다 작아진다.
 *
 * **어댑터와 렌더러가 같은 추정식을 써야 한다.** 어댑터가 계산한 폭과 렌더러가
 * 판단한 말줄임 기준이 어긋나면, 안 잘려도 될 글자가 잘리거나 반대로 삐져나온다.
 * 그래서 어댑터 안의 지역 함수였던 것을 장면 계층으로 끌어올렸다 — 핀 칩과 상세
 * 카드도 같은 추정으로 폭을 잡는다.
 */
export const estimateTextWidth = (text: string, fontSize: number): number =>
  [...text].reduce(
    (width, char) =>
      width + (char.codePointAt(0)! > 0x1100 ? fontSize : fontSize * 0.58),
    0,
  );

const ELLIPSIS = "…";

/**
 * 주어진 폭에 맞춰 말줄임한다. **글자 수가 아니라 폭 기준**이다.
 *
 * 글자 수로 자르면(예: 16자) 라틴 이름은 자리가 남는데도 잘리고, 한글 이름은
 * 같은 글자 수여도 두 배 가까이 넓어 넘친다. 두 경우 모두 화면에서 바로 티가 난다.
 */
export const fitTextToWidth = (
  text: string,
  fontSize: number,
  maxWidth: number,
): string => {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;

  const ellipsisWidth = estimateTextWidth(ELLIPSIS, fontSize);
  const chars = [...text];
  let width = 0;
  let kept = 0;

  while (kept < chars.length) {
    const next = width + estimateTextWidth(chars[kept] ?? "", fontSize);
    if (next + ellipsisWidth > maxWidth) break;
    width = next;
    kept += 1;
  }

  // 한 글자도 못 넣을 만큼 좁으면 말줄임표라도 남긴다.
  return kept > 0 ? `${chars.slice(0, kept).join("")}${ELLIPSIS}` : ELLIPSIS;
};
