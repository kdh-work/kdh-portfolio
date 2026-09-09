import * as THREE from "three";

/**
 * 바닥에 새겨진 이름을 3D 로 만든다 — **캔버스 텍스처를 바닥 평면에 눕히는** 방식.
 *
 * 원본 문서가 Three.js 를 기각한 첫 번째 이유가 텍스트였다. WebGL 에서 글자를
 * 그리려면 글리프를 메시로 만들거나 아틀라스를 구워야 하는데, 한글은 글리프 수가
 * 많아 어느 쪽도 무겁다.
 *
 * 우회로는 2D 캔버스다. 캔버스는 브라우저의 폰트 스택을 그대로 쓰므로 한글이
 * 공짜로 나오고, 그 결과를 텍스처로 올리면 바닥에 눕히는 것도 된다. HTML 오버레이
 * (CSS2DRenderer)로는 이게 안 된다 — 오버레이는 항상 카메라를 정면으로 보므로
 * "바닥에 새겨진" 모양이 나오지 않는다. 그래서 이름은 텍스처, 박스 라벨은
 * 오버레이로 나눴다.
 *
 * 대신 잃는 것이 있다. 텍스처가 된 글자는 더 이상 글자가 아니다 — 선택도, 검색도,
 * 스크린리더도 닿지 않는다. SVG 판에서는 그냥 `<text>` 였다.
 */

/** SVG 판과 같은 폰트 스택. 캔버스가 브라우저 폰트를 그대로 쓴다. */
const FONT_STACK =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/** 텍스처 해상도 배수. 직교 카메라라 배율이 고정이므로 4배면 충분하다. */
const TEXTURE_SCALE = 4;

export interface FloorTextOptions {
  text: string;
  /** 화면에서 보일 글자 크기(px) — SVG 판과 같은 값을 넣는다 */
  fontPx: number;
  color: string;
  /** 1 월드 단위가 차지하는 화면 폭(px) */
  pixelsPerWorldUnit: number;
  /** 글자가 흐르는 바닥 방향 (월드 x-z 평면) */
  direction: { x: number; z: number };
  /** 글자 중심이 놓일 월드 좌표 */
  center: { x: number; y: number; z: number };
}

export interface FloorTextResult {
  mesh: THREE.Mesh;
  dispose: () => void;
}

export const createFloorText = ({
  text,
  fontPx,
  color,
  pixelsPerWorldUnit,
  direction,
  center,
}: FloorTextOptions): FloorTextResult | null => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  const font = `700 ${fontPx * TEXTURE_SCALE}px ${FONT_STACK}`;

  /* 폭을 실측한다 — SVG 는 실측이 불가능해 글자 종류로 근사했지만 캔버스는 잰다. */
  context.font = font;
  const measured = context.measureText(text);
  const textWidthPx = Math.max(1, measured.width / TEXTURE_SCALE);

  const padPx = fontPx * 0.35;
  const widthPx = textWidthPx + padPx * 2;
  const heightPx = fontPx * 1.6;

  canvas.width = Math.ceil(widthPx * TEXTURE_SCALE);
  canvas.height = Math.ceil(heightPx * TEXTURE_SCALE);

  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  /*
   * 색공간을 지정하지 않으면 캔버스 텍셀이 선형으로 해석돼, 렌더러가 sRGB 로
   * 내보낼 때 글자가 밝게 떠 버린다. SVG 판과 나란히 놓고 보면 바로 드러난다.
   */
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const worldWidth = widthPx / pixelsPerWorldUnit;
  const worldHeight = heightPx / pixelsPerWorldUnit;

  const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);

  /*
   * 평면을 바닥에 눕히고(X 축 -90°) 글자 방향으로 돌린다(월드 Y 축).
   * 오일러 순서에 기대지 않고 쿼터니언을 직접 합성한다 — 순서가 뒤바뀌면 글자가
   * 거울처럼 뒤집힌다.
   */
  const layFlat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2,
  );
  const spin = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.atan2(-direction.z, direction.x),
  );
  mesh.quaternion.copy(spin).multiply(layFlat);
  mesh.position.set(center.x, center.y, center.z);

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
};
