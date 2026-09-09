import * as THREE from "three";

/**
 * 바닥 구획 레일을 3D 로 만든다.
 *
 * SVG 에서는 굵은 `stroke` 한 줄이면 되지만 WebGL 에는 선 굵기가 없다 —
 * `LineBasicMaterial.linewidth` 는 대부분의 플랫폼에서 무시되고 항상 1px 로
 * 그려진다. 5px 짜리 레일을 그리려면 **띠(ribbon) 메시**를 직접 만들어야 한다.
 * WebGL 로 옮기면서 늘어난 일 중 가장 눈에 띄는 항목이다.
 *
 * 좌표는 그리드 공간(gx, gy)이고 바닥 평면에 눕는다. 모서리 라운딩과 이름 자리의
 * 빈 구간까지 SVG 판과 같은 규칙으로 처리한다.
 */

export interface RailGap {
  /** [back, right, front, left] 순회에서의 변 인덱스 */
  edge: number;
  /** 그 변의 시작 꼭짓점에서부터의 거리 (그리드 단위) */
  from: number;
  to: number;
}

interface Vec2 {
  x: number;
  y: number;
}

const CORNER_SEGMENTS = 6;

/** 2차 베지어 한 점 */
const quadAt = (a: Vec2, control: Vec2, b: Vec2, t: number): Vec2 => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
  };
};

const shiftToward = (from: Vec2, toward: Vec2, distance: number): Vec2 => {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { ...from };
  const step = Math.min(distance, length / 2);
  return { x: from.x + (dx / length) * step, y: from.y + (dy / length) * step };
};

/**
 * 모서리를 둥글린 사각 폴리라인. `gap` 을 주면 그 구간을 비운 **열린** 선이 된다.
 * SVG 의 `roundedQuadPath` 와 같은 순서·같은 규칙이다.
 */
export const railPolyline = (
  box: { gx: number; gy: number; width: number; depth: number },
  cornerRadius: number,
  gap?: RailGap,
): Vec2[] => {
  const corners: Vec2[] = [
    { x: box.gx, y: box.gy },
    { x: box.gx + box.width, y: box.gy },
    { x: box.gx + box.width, y: box.gy + box.depth },
    { x: box.gx, y: box.gy + box.depth },
  ];

  const nth = (index: number) => corners[((index % 4) + 4) % 4]!;
  const edgeLength = (index: number) => {
    const a = nth(index);
    const b = nth(index + 1);
    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  const shortest = Math.min(...[0, 1, 2, 3].map(edgeLength));
  const r = Math.min(cornerRadius, shortest / 2);

  /** 모서리 i 의 진입·진출점과 그 사이 호 */
  const cornerArc = (index: number): Vec2[] => {
    const corner = nth(index);
    const enter = shiftToward(corner, nth(index - 1), r);
    const exit = shiftToward(corner, nth(index + 1), r);
    const arc: Vec2[] = [];
    for (let step = 0; step <= CORNER_SEGMENTS; step += 1) {
      arc.push(quadAt(enter, corner, exit, step / CORNER_SEGMENTS));
    }
    return arc;
  };

  if (!gap) {
    /* 닫힌 선 — 네 모서리 호를 차례로 잇고 시작점으로 돌아온다. */
    const points: Vec2[] = [];
    for (let index = 0; index < 4; index += 1) points.push(...cornerArc(index));
    points.push(points[0]!);
    return points;
  }

  const edge = ((gap.edge % 4) + 4) % 4;
  const start = nth(edge);
  const end = nth(edge + 1);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const direction =
    length === 0
      ? { x: 0, y: 0 }
      : { x: (end.x - start.x) / length, y: (end.y - start.y) / length };

  /* 빈 구간은 직선 구간 안으로 제한한다 — 모서리 곡선까지 먹으면 각이 사라진다. */
  const clamp = (value: number) => Math.min(Math.max(value, r), length - r);
  const gapFrom = clamp(Math.min(gap.from, gap.to));
  const gapTo = clamp(Math.max(gap.from, gap.to));
  const at = (distance: number): Vec2 => ({
    x: start.x + direction.x * distance,
    y: start.y + direction.y * distance,
  });

  const points: Vec2[] = [at(gapTo)];
  for (let step = 1; step <= 4; step += 1) points.push(...cornerArc(edge + step));
  points.push(at(gapFrom));
  return points;
};

/**
 * 폴리라인을 바닥에 눕힌 띠 메시로 만든다.
 * 점마다 진행 방향의 법선으로 ±폭/2 만큼 벌려 사각형을 잇는다.
 */
export const railGeometry = (
  points: Vec2[],
  width: number,
  height: number,
): THREE.BufferGeometry => {
  const half = width / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  const tangentAt = (index: number): Vec2 => {
    const prev = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy);
    return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
  };

  points.forEach((point, index) => {
    const tangent = tangentAt(index);
    /* 바닥 평면(x-z)에서의 법선 */
    const nx = -tangent.y;
    const nz = tangent.x;
    positions.push(point.x + nx * half, height, point.y + nz * half);
    positions.push(point.x - nx * half, height, point.y - nz * half);

    if (index > 0) {
      const a = (index - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};
