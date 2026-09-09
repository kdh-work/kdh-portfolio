import type { IsoTone } from "../../scene/types";
import styles from "../IsoMap.module.css";

/**
 * 계열 색을 **CSS 에서 읽어 온다.**
 *
 * WebGL 은 CSS 를 모르므로 색을 어딘가에 숫자로 적어야 하는데, TS 에 옮겨 적으면
 * SVG 판과 갈라진다. 두 렌더러의 스타일이 같아야 하므로, 실제 tone 클래스를 붙인
 * 요소를 만들어 계산된 커스텀 프로퍼티를 읽는다. 색의 원본은 여전히 CSS 하나다.
 */

export const TONES: IsoTone[] = [
  "blue",
  "green",
  "orange",
  "gray",
  "light-gray",
];

export interface TonePaint {
  /** 상단면 */
  face: string;
  /** 측면 (음영 전) */
  side: string;
  /** 외곽선·구획 레일 */
  line: string;
  /** 바닥에 새기는 이름 */
  label: string;
}

export type TonePalette = Record<IsoTone, TonePaint>;

/** SVG 판의 `.shade` 와 같은 값 — 측면에 덮는 검정 불투명도. */
export const SHADE = { gx: 0.12, gy: 0.05 } as const;

const FALLBACK: TonePaint = {
  face: "#eceff2",
  side: "#dfe4e9",
  line: "#6d7b8a",
  label: "#42505f",
};

/**
 * 계열별 색을 읽는다. `document` 가 필요하므로 브라우저에서만 호출한다.
 * 실패하면 회색 폴백을 쓴다 — 색을 못 읽어도 도식 구조는 보여야 한다.
 */
export const readTonePalette = (): TonePalette => {
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);

  const palette = {} as TonePalette;

  try {
    for (const tone of TONES) {
      const className = styles[`tone-${tone}`];
      probe.className = className ?? "";
      const computed = getComputedStyle(probe);
      const read = (name: string, fallback: string) =>
        computed.getPropertyValue(name).trim() || fallback;

      palette[tone] = {
        face: read("--iso-face", FALLBACK.face),
        side: read("--iso-face-side", FALLBACK.side),
        line: read("--iso-line", FALLBACK.line),
        label: read("--iso-label", FALLBACK.label),
      };
    }
  } finally {
    probe.remove();
  }

  return palette;
};

/** 캔버스 배경색 — 3D 캔버스도 SVG 캔버스와 같은 바닥색을 쓴다. */
export const readCanvasColor = (element: HTMLElement, fallback = "#f2f4f6") =>
  getComputedStyle(element).backgroundColor || fallback;
