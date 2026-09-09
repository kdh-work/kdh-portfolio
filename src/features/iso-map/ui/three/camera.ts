import { ISO_COS30, ISO_SIN30 } from "../../scene/projection";

/**
 * SVG 투영과 **같은 그림**을 내는 직교 카메라 파라미터.
 *
 * 아이소메트릭은 원근이 없으므로 3D 로 옮길 때도 직교(orthographic) 카메라다.
 * 문제는 "SVG 와 같아 보이게" 가 아니라 "수식이 같아지게" 맞추는 것이다. 아래는
 * 그 유도다.
 *
 * 그리드 → 월드 축 대응은 gx→x, gy→z, 높이→y 로 둔다(three.js 는 y 가 위).
 * 방위각 α, 고각 φ 에 놓인 직교 카메라에서 월드 벡터 v 의 화면 좌표는
 *
 *   screen_x =  v.x·cosα − v.z·sinα
 *   screen_y = (v.x·sinα + v.z·cosα)·sinφ − v.y·cosφ        (화면 y 는 아래로 증가)
 *
 * SVG 투영은
 *
 *   x = (gx·cosθ − gy·sinθ) · unit · SPAN_X
 *   y = (gx·sinθ + gy·cosθ) · unit · SPAN_Y − z · heightUnit
 *
 * 두 식을 항별로 맞추면
 *
 *   α = θ                                    (방위각은 그대로 시야각)
 *   sinφ = SPAN_Y / SPAN_X = tan30°          → φ = 35.264°, 즉 **진짜 아이소메트릭**
 *   1 월드 단위 = unit · SPAN_X px           (직교 프러스텀 크기로 지정)
 *
 * 마지막 항이 어긋난다. 위 값에서 `SPAN_X · cosφ` 는 정확히 1 이므로 카메라가
 * 만드는 높이 배율은 `unit` 인데, SVG 는 `heightUnit`(44)을 쓴다. unit 이 34 이니
 * 원본 도식은 진짜 아이소메트릭보다 박스를 1.29 배 높게 그려 온 것이다 — 의도된
 * 과장이다. 그래서 월드로 올릴 때 높이만 그 비율로 늘린다.
 */

/** SVG 투영의 두 축 배율. `projection.ts` 와 같은 값이어야 한다. */
const SPAN_X = ISO_COS30 * Math.SQRT2;
const SPAN_Y = ISO_SIN30 * Math.SQRT2;

/** 고각. sinφ = SPAN_Y / SPAN_X = tan30° → 35.264°, 표준 아이소메트릭 고각이다. */
export const ISO_ELEVATION_RAD = Math.asin(SPAN_Y / SPAN_X);

/** 1 그리드 단위가 차지하는 화면 폭(px) 계수. `unit` 에 곱한다. */
export const PIXELS_PER_UNIT = SPAN_X;

/**
 * 그리드 z(높이)를 월드 y 로 올릴 때의 배율.
 *
 * `SPAN_X · cosφ === 1` 이므로 카메라 자체의 높이 배율은 `unit` 이다. SVG 가
 * 쓰는 `heightUnit` 과의 비율만큼 월드에서 늘려야 두 렌더러의 박스 높이가 같다.
 */
export const heightScale = (unit: number, heightUnit: number): number =>
  heightUnit / unit;

/** 방위각·고각에서 카메라 위치 방향(단위 벡터). 거리는 직교라 그림에 영향이 없다. */
export const cameraDirection = (
  yawDeg: number
): { x: number; y: number; z: number } => {
  const yaw = (yawDeg * Math.PI) / 180;
  const cosPhi = Math.cos(ISO_ELEVATION_RAD);
  return {
    x: Math.sin(yaw) * cosPhi,
    y: Math.sin(ISO_ELEVATION_RAD),
    z: Math.cos(yaw) * cosPhi,
  };
};

/**
 * 직교 프러스텀 반폭·반높이. 캔버스 픽셀 크기와 배율에서 나온다.
 * 이 값이 "1 월드 단위 = unit · SPAN_X px" 를 성립시킨다.
 */
export const frustumHalfExtent = (
  widthPx: number,
  heightPx: number,
  unit: number
): { halfWidth: number; halfHeight: number } => {
  const pixelsPerWorldUnit = unit * PIXELS_PER_UNIT;
  return {
    halfWidth: widthPx / pixelsPerWorldUnit / 2,
    halfHeight: heightPx / pixelsPerWorldUnit / 2,
  };
};
