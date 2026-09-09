/**
 * 투영 유틸. 아이소메트릭(3D)과 평면도(2D) 두 모드를 지원한다.
 *
 * 아이소메트릭은 3D 렌더링이 아니라 순수 아핀 변환이므로 Three.js 같은 WebGL
 * 런타임 없이 SVG 좌표계에서 그대로 계산할 수 있다. 이 파일은 그 변환과
 * 박스 path 생성만 담당한다 (Vue/DOM 의존 없음).
 *
 *   isometric: x = (gx·cosθ - gy·sinθ) * unit * SPAN_X
 *              y = (gx·sinθ + gy·cosθ) * unit * SPAN_Y - z * heightUnit
 *   flat:      x = gx * unit
 *              y = gy * unit * flatDepthScale        (z 무시)
 *
 * θ(`yawDeg`)는 지면 회전각이고 기본값 45° 에서 예전의 cos30/sin30 상수와 정확히
 * 같아진다. 시점을 돌리는 데 WebGL 이 필요 없는 이유는 회전 후에도 이것이 여전히
 * 아핀 변환이기 때문이다.
 *
 * 다만 각도에 **딸려 오는 것**이 네 개 있고, 넷 다 축의 화면 방향(`groundAxes`)
 * 에서 유도한다. 시점이 고정이던 동안은 전부 상수로 적혀 있었다.
 *
 *   1. 가시면      — 축의 화면 y 성분 부호로 어느 측면이 보이는지 정한다
 *   2. 정렬 키     — painter's algorithm 의 깊이(`depthAt`)
 *   3. 바닥 글자   — 전단 행렬의 두 열이 두 축의 정규화 방향이다
 *   4. 이름 놓을 변 — 어댑터가 가장 앞이면서 가장 수평인 변을 고른다
 *
 * 평면도에서는 겹침 자체가 생기지 않고 글자도 눕지 않는다.
 */
import type {
  IsoBox,
  IsoBoxFaces,
  IsoFloorAxis,
  IsoGridPoint,
  IsoProjectionConfig,
  IsoScreenPoint,
  IsoViewMode,
} from './types';

export const ISO_COS30 = Math.cos(Math.PI / 6);
export const ISO_SIN30 = 0.5;

/** 그리드 축이 화면에서 기울어진 각도 — 컨테이너 라벨을 축에 맞춰 눕힐 때 쓴다. */
export const ISO_AXIS_ANGLE_DEG = 30;

/**
 * 기본 시야각(도). 이 값에서 아래 일반식이 기존 아이소메트릭 상수와 정확히 같아진다.
 * 0 이면 +gx 가 화면 오른쪽 수평, 90 이면 +gy 가 화면 왼쪽 수평이다.
 */
export const ISO_DEFAULT_YAW_DEG = 45;

/*
 * 지면 회전(yaw)을 일반화한 축측 투영.
 *
 *   x = (gx·cosθ − gy·sinθ) · unit · SPAN_X
 *   y = (gx·sinθ + gy·cosθ) · unit · SPAN_Y − z · heightUnit
 *
 * θ = 45° 를 넣으면 (gx−gy)/√2 · SPAN_X = (gx−gy)·cos30 이 되도록 두 배율을
 * 잡았다. 즉 기존 도식은 이 함수족의 한 점이고, θ 만 바꾸면 같은 코드로 시점이
 * 돌아간다. WebGL 없이 회전이 되는 이유는 이것이 여전히 아핀 변환이기 때문이다.
 */
const SPAN_X = ISO_COS30 * Math.SQRT2;
const SPAN_Y = ISO_SIN30 * Math.SQRT2;

const yawOf = (config: IsoProjectionConfig): number =>
  ((config.yawDeg ?? ISO_DEFAULT_YAW_DEG) * Math.PI) / 180;

/** 지면 두 축이 화면에서 향하는 방향(정규화 전). 가시면·정렬·라벨이 모두 이걸 본다. */
export const groundAxes = (
  config: IsoProjectionConfig
): { ex: IsoScreenPoint; ey: IsoScreenPoint } => {
  if (config.mode === 'flat') {
    return {
      ex: { x: config.unit, y: 0 },
      ey: { x: 0, y: config.unit * config.flatDepthScale },
    };
  }
  const yaw = yawOf(config);
  return {
    ex: {
      x: Math.cos(yaw) * config.unit * SPAN_X,
      y: Math.sin(yaw) * config.unit * SPAN_Y,
    },
    ey: {
      x: -Math.sin(yaw) * config.unit * SPAN_X,
      y: Math.cos(yaw) * config.unit * SPAN_Y,
    },
  };
};

/**
 * 바닥 구획의 이름을 놓을 변을 고른다. 두 조건으로 정한다.
 *
 *  1. **앞에 있는 변** — 바깥 법선이 관측자 쪽(화면 아래)을 향하는 변. 네 변 중
 *     정확히 두 개가 해당한다. 앞이어야 안쪽 박스가 이름을 가리지 않는다.
 *  2. **더 수평인 변** — 그 둘 중 화면에서 수평에 가까운 쪽. 글자가 눕는 각도가
 *     완만해져 읽힌다. 이 규칙 덕분에 어느 시야각에서도 글자가 수직에 가까워지지
 *     않는다(전 구간에서 수평 대비 30° 이내).
 *
 * 변 인덱스는 `buildFloorQuad` 가 쓰는 [back, right, front, left] 순회 기준이고,
 * 변 i 는 corner[i] → corner[i+1] 이다. 평면도는 시점이 없으므로 관례대로 상단 변.
 *
 * **SVG 렌더러와 WebGL 렌더러가 이 함수를 공유한다.** 규칙이 두 곳에 적히면
 * 시야각을 돌릴 때 두 화면의 이름 위치가 어긋난다.
 */
export interface IsoFloorEdgeChoice {
  /** [back, right, front, left] 순회에서의 변 인덱스 */
  edge: number;
  /** 글자 방향이 그 변의 순회 방향과 같은지 */
  alongTraversal: boolean;
  /** 글자가 흐르는 그리드 방향 */
  axis: IsoFloorAxis;
}

const FLIP_AXIS: Record<IsoFloorAxis, IsoFloorAxis> = {
  gx: '-gx',
  '-gx': 'gx',
  gy: '-gy',
  '-gy': 'gy',
};

export const pickFloorEdge = (
  config: IsoProjectionConfig
): IsoFloorEdgeChoice => {
  const { ex, ey } = groundAxes(config);

  if (config.mode === 'flat') {
    return { edge: 0, alongTraversal: true, axis: 'gx' };
  }

  /* 변마다 진행 축과 바깥 법선이 정해져 있다. */
  const edges = [
    { edge: 0, along: ex, outward: { x: -ey.x, y: -ey.y }, axis: 'gx' as const },
    { edge: 1, along: ey, outward: ex, axis: 'gy' as const },
    { edge: 2, along: { x: -ex.x, y: -ex.y }, outward: ey, axis: '-gx' as const },
    {
      edge: 3,
      along: { x: -ey.x, y: -ey.y },
      outward: { x: -ex.x, y: -ex.y },
      axis: '-gy' as const,
    },
  ];

  const near = edges.filter((item) => item.outward.y > 0);
  const candidates = near.length > 0 ? near : edges;

  /** 수평에 가까운 정도 (1 이면 완전 수평) */
  const horizontality = (v: IsoScreenPoint) => {
    const length = Math.hypot(v.x, v.y);
    return length === 0 ? 0 : Math.abs(v.x) / length;
  };

  const best = candidates.reduce((winner, item) =>
    horizontality(item.along) > horizontality(winner.along) ? item : winner
  );

  /* 글자가 왼쪽 → 오른쪽으로 읽히도록 방향을 맞춘다. */
  const alongTraversal = best.along.x >= 0;

  return {
    edge: best.edge,
    alongTraversal,
    axis: alongTraversal ? best.axis : FLIP_AXIS[best.axis],
  };
};

export const projectIso = (
  { gx, gy, z }: IsoGridPoint,
  config: IsoProjectionConfig
): IsoScreenPoint => {
  const { mode, unit, heightUnit, flatDepthScale } = config;
  if (mode === 'flat') {
    return { x: gx * unit, y: gy * unit * flatDepthScale };
  }
  const { ex, ey } = groundAxes(config);
  return {
    x: gx * ex.x + gy * ey.x,
    y: gx * ex.y + gy * ey.y - z * heightUnit,
  };
};

/**
 * 화면 좌표를 **지면 좌표로 되돌린다** (z 를 아는 경우).
 *
 * 투영이 아핀이므로 역이 존재한다. 화면 네 꼭짓점을 되돌리면 "지금 보이는 화면이
 * 그리드의 어느 범위인지" 가 나오고, 그 범위만큼만 배경 격자를 그리면 된다.
 * 없으면 격자를 넉넉히 그려 놓고 잘라내는 수밖에 없다.
 */
export const unprojectGround = (
  screen: IsoScreenPoint,
  z: number,
  config: IsoProjectionConfig
): { gx: number; gy: number } => {
  if (config.mode === 'flat') {
    return {
      gx: screen.x / config.unit,
      gy: screen.y / (config.unit * config.flatDepthScale),
    };
  }

  const { ex, ey } = groundAxes(config);
  const determinant = ex.x * ey.y - ex.y * ey.x;
  if (determinant === 0) return { gx: 0, gy: 0 };

  /* 높이 항을 먼저 걷어내면 지면 2×2 연립방정식이 된다. */
  const sx = screen.x;
  const sy = screen.y + z * config.heightUnit;

  return {
    gx: (sx * ey.y - sy * ey.x) / determinant,
    gy: (sy * ex.x - sx * ex.y) / determinant,
  };
};

/**
 * 관측자에게 가까워지는 방향의 깊이. painter's algorithm 정렬 키이자,
 * 어느 면·어느 변이 앞인지 판단하는 기준이다.
 *
 * 화면 y 가 커지는 쪽이 앞이므로 두 축의 화면 y 성분을 그대로 쓴다.
 * θ = 45° 에서는 (gx + gy) 에 비례해 기존 정렬과 같아진다.
 */
export const depthAt = (
  gx: number,
  gy: number,
  config: IsoProjectionConfig
): number => {
  const { ex, ey } = groundAxes(config);
  return gx * ex.y + gy * ey.y;
};

const toPath = (points: IsoScreenPoint[]): string =>
  `${points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ')} Z`;

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * 박스를 SVG path 로 변환한다.
 * 아이소메트릭에서는 가시 3면, 평면도에서는 상단면 하나만 나온다
 * (평면도는 z 를 무시하므로 측면이 면적 0 으로 붕괴한다).
 */
export const buildBoxFaces = (
  box: IsoBox,
  config: IsoProjectionConfig
): IsoBoxFaces => {
  const { gx, gy, width, depth, z, height } = box;
  const topZ = z + height;

  const at = (px: number, py: number, pz: number) =>
    projectIso({ gx: px, gy: py, z: pz }, config);

  const isFlat = config.mode === 'flat';
  const { ex, ey } = groundAxes(config);

  /*
   * 어느 측면이 보이는가.
   *
   * 시점이 고정이던 동안은 "gx 최대면 + gy 최대면" 으로 못 박아 둘 수 있었지만,
   * 시점이 돌면 사분면마다 바뀐다. 판단 기준은 축의 화면 y 성분 부호다 —
   * 양수면 그 축이 관측자 쪽(화면 아래)으로 향하므로 최대쪽 면이 보인다.
   */
  const gxFaceAtMax = ex.y > 0;
  const gyFaceAtMax = ey.y > 0;

  const gxFace = gxFaceAtMax ? gx + width : gx;
  const gyFace = gyFaceAtMax ? gy + depth : gy;

  /* 상단면 네 꼭짓점은 그리드 순서 그대로 두고, 라벨 기준점만 화면 기준으로 고른다. */
  const topCorners = [
    { p: at(gx, gy, topZ), gx, gy },
    { p: at(gx + width, gy, topZ), gx: gx + width, gy },
    { p: at(gx + width, gy + depth, topZ), gx: gx + width, gy: gy + depth },
    { p: at(gx, gy + depth, topZ), gx, gy: gy + depth },
  ];

  const byScreen = (
    pick: (a: IsoScreenPoint, b: IsoScreenPoint) => boolean
  ): IsoScreenPoint =>
    topCorners.reduce((best, item) => (pick(item.p, best) ? item.p : best), topCorners[0]!.p);

  return {
    top: toPath(topCorners.map((corner) => corner.p)),
    /* gy 쪽 측면 — 기본 시야각에서 화면 왼쪽에 온다 */
    left: isFlat
      ? ''
      : toPath([
          at(gx, gyFace, topZ),
          at(gx + width, gyFace, topZ),
          at(gx + width, gyFace, z),
          at(gx, gyFace, z),
        ]),
    /* gx 쪽 측면 — 기본 시야각에서 화면 오른쪽에 온다 */
    right: isFlat
      ? ''
      : toPath([
          at(gxFace, gy, topZ),
          at(gxFace, gy + depth, topZ),
          at(gxFace, gy + depth, z),
          at(gxFace, gy, z),
        ]),
    depthKey: depthAt(gx + width / 2, gy + depth / 2, config),
    topCenter: at(gx + width / 2, gy + depth / 2, topZ),
    // 가장 뒤(화면 위) / 가장 왼쪽 / 가장 오른쪽 꼭짓점. 시점이 돌면 어느
    // 그리드 꼭짓점인지 바뀌므로 그리드가 아니라 화면 좌표로 고른다.
    topBack: byScreen((a, b) => a.y < b.y),
    topLeft: byScreen((a, b) => a.x < b.x),
    topRight: byScreen((a, b) => a.x > b.x),
  };
};

/**
 * 글자를 바닥 평면에 눕히는 SVG transform.
 *
 * `rotate()` 는 글자를 기울이기만 할 뿐 글자 자체는 정면을 향한 채라 바닥에
 * 놓인 것처럼 보이지 않는다. 바닥에 **새겨진** 느낌을 내려면 글자의 로컬
 * x/y 축을 각각 바닥의 두 축으로 보내는 선형변환(회전 + 전단 + 압축)이 필요하다.
 *
 *   axis 'gx' : 로컬 x → +gx(화면 오른쪽 아래), 로컬 y(아래) → +gy(왼쪽 아래)
 *   axis 'gy' : 로컬 x → -gy(오른쪽 위),        로컬 y(아래) → +gx(오른쪽 아래)
 *
 * 변환은 앵커 (x, y) 를 고정점으로 삼는다 — `rotate(deg, cx, cy)` 와 같은 방식이라
 * 렌더러가 text 의 x/y 를 그대로 두어도 되고 bbox 계산도 유효하게 남는다.
 */
export const floorTextMatrix = (
  at: IsoScreenPoint,
  axis: IsoFloorAxis,
  config: IsoProjectionConfig
): [number, number, number, number, number, number] => {
  const mode = config.mode;
  /*
   * 행렬의 두 열은 지면 두 축의 **정규화된** 화면 방향이다. 전에는 시점이
   * 고정이라 cos30/sin30 을 그대로 적어 뒀지만, 시점이 돌면 축 방향에서 유도해야
   * 한다. 기본 시야각에서는 아래 계산이 예전 상수와 같은 값을 낸다.
   *
   *   axis 'gx' : 로컬 x → +gx, 로컬 y(아래) → +gy
   *   axis 'gy' : 로컬 x → -gy, 로컬 y(아래) → +gx
   */
  const [a, b, c, d]: [number, number, number, number] = (() => {
    if (mode === 'flat') return [1, 0, 0, 1];

    const { ex, ey } = groundAxes(config);
    const unitOf = (v: IsoScreenPoint): IsoScreenPoint => {
      const length = Math.hypot(v.x, v.y);
      return length === 0 ? { x: 1, y: 0 } : { x: v.x / length, y: v.y / length };
    };
    const ux = unitOf(ex);
    const uy = unitOf(ey);

    /*
     * 네 방향 모두 행렬식이 양수라 글자가 거울처럼 뒤집히지 않는다.
     * (로컬 x, 로컬 y) 를 (글자가 흐르는 방향, 그 오른쪽 90°) 로 보낸다.
     */
    switch (axis) {
      case 'gx':
        return [ux.x, ux.y, uy.x, uy.y];
      case '-gx':
        return [-ux.x, -ux.y, -uy.x, -uy.y];
      case 'gy':
        return [uy.x, uy.y, -ux.x, -ux.y];
      case '-gy':
        return [-uy.x, -uy.y, ux.x, ux.y];
    }
  })();

  // M·(x, y) + t = (x, y) 를 만족하는 평행이동
  return [a, b, c, d, at.x - (a * at.x + c * at.y), at.y - (b * at.x + d * at.y)];
};

export const floorTextTransform = (
  at: IsoScreenPoint,
  axis: IsoFloorAxis,
  config: IsoProjectionConfig
): string => {
  if (config.mode === 'flat') return '';

  const [a, b, c, d, e, f] = floorTextMatrix(at, axis, config);
  return `matrix(${round(a)} ${round(b)} ${round(c)} ${round(d)} ${round(e)} ${round(f)})`;
};

/** 변환된 사각형의 네 꼭짓점. 전단된 라벨의 bbox 계산에 쓴다. */
export const transformedRectCorners = (
  rect: { x: number; y: number; width: number; height: number },
  at: IsoScreenPoint,
  axis: IsoFloorAxis,
  config: IsoProjectionConfig
): IsoScreenPoint[] => {
  const [a, b, c, d, e, f] = floorTextMatrix(at, axis, config);

  const corners: [number, number][] = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ];

  return corners.map(([x, y]) => ({ x: a * x + c * y + e, y: b * x + d * y + f }));
};

/**
 * 바닥 평면(z 고정)에 놓인 사각형. 구획 외곽선처럼 두께가 없는 면에 쓴다.
 * 모서리를 둥글려 볼륨(각진 박스)과 구획(둥근 윤곽)이 한눈에 구분되게 한다.
 */
export const buildFloorQuad = (
  box: Omit<IsoBox, 'height'>,
  config: IsoProjectionConfig,
  cornerRadius = 14,
  /** 이름을 새길 자리만큼 윤곽선을 비운다. 변 인덱스는 [back, right, front, left] 순서다. */
  gap?: IsoPathGap
): {
  path: string;
  back: IsoScreenPoint;
  right: IsoScreenPoint;
  front: IsoScreenPoint;
  left: IsoScreenPoint;
} => {
  const { gx, gy, width, depth, z } = box;
  const at = (px: number, py: number) =>
    projectIso({ gx: px, gy: py, z }, config);

  const back = at(gx, gy);
  const right = at(gx + width, gy);
  const front = at(gx + width, gy + depth);
  const left = at(gx, gy + depth);

  return {
    path: roundedQuadPath([back, right, front, left], cornerRadius, gap),
    back,
    right,
    front,
    left,
  };
};

/**
 * 한 변에 낼 빈 구간. 이름을 새길 자리만큼 윤곽선을 실제로 끊는다.
 *
 * 글자 뒤에 판이나 외곽선을 깔아 **가리는** 방법은 두 가지를 못 피한다 —
 * 글자 모양을 따라가는 외곽선은 획 사이로 선이 비치고, 어느 쪽이든 덮는 색이
 * 뒤에 무엇이 있는지에 의존한다. 선을 끊어 두면 가릴 것 자체가 없다.
 */
export interface IsoPathGap {
  /** 빈 구간을 낼 변. `points[edge] → points[edge + 1]` 이다. */
  edge: number;
  /** `points[edge]` 에서부터의 거리 */
  from: number;
  to: number;
}

/**
 * 닫힌 다각형의 모든 모서리를 2차 베지어로 라운딩한다.
 * `gap` 을 주면 그 변의 해당 구간을 비운 **열린** path 가 된다.
 */
export const roundedQuadPath = (
  points: IsoScreenPoint[],
  radius: number,
  gap?: IsoPathGap
): string => {
  const count = points.length;
  if (count < 3) return toPath(points);

  /** 순환 인덱스 접근. count >= 3 을 위에서 확인했으므로 항상 값이 있다. */
  const nth = (index: number): IsoScreenPoint =>
    points[((index % count) + count) % count] as IsoScreenPoint;

  const edgeLength = (index: number) => {
    const from = nth(index);
    const to = nth(index + 1);
    return Math.hypot(to.x - from.x, to.y - from.y);
  };

  // 가장 짧은 변의 절반을 넘지 않게 잘라 모서리가 서로 먹지 않도록 한다.
  const shortest = Math.min(...points.map((_, index) => edgeLength(index)));
  const r = Math.min(radius, shortest / 2);

  const corner = (index: number) => ({
    enter: shiftToward(nth(index), nth(index - 1), r),
    exit: shiftToward(nth(index), nth(index + 1), r),
    point: nth(index),
  });

  const arc = (index: number) => {
    const c = corner(index);
    return ` L${round(c.enter.x)} ${round(c.enter.y)} Q${round(c.point.x)} ${round(c.point.y)} ${round(c.exit.x)} ${round(c.exit.y)}`;
  };

  if (!gap) {
    let path = '';
    for (let index = 0; index < count; index += 1) {
      const c = corner(index);
      path += index === 0 ? 'M' : ' L';
      path += `${round(c.enter.x)} ${round(c.enter.y)}`;
      path += ` Q${round(c.point.x)} ${round(c.point.y)} ${round(c.exit.x)} ${round(c.exit.y)}`;
    }
    return `${path} Z`;
  }

  /*
   * 빈 구간이 있는 경우.
   *
   * 시작점은 빈 구간의 끝(gapTo), 거기서 변을 따라 다음 모서리로 가고, 나머지
   * 모서리를 차례로 돌아 같은 변으로 되돌아와 빈 구간의 시작(gapFrom)에서 멈춘다.
   * 빈 구간은 직선 구간 안으로 제한한다 — 모서리 곡선까지 먹으면 구획의 각이
   * 사라져 어느 영역인지 읽히지 않는다.
   */
  const edge = ((gap.edge % count) + count) % count;
  const length = edgeLength(edge);
  const start = nth(edge);
  const end = nth(edge + 1);
  const direction =
    length === 0
      ? { x: 0, y: 0 }
      : { x: (end.x - start.x) / length, y: (end.y - start.y) / length };

  const clamp = (value: number) => Math.min(Math.max(value, r), length - r);
  const gapFrom = clamp(Math.min(gap.from, gap.to));
  const gapTo = clamp(Math.max(gap.from, gap.to));

  const pointAt = (distance: number) => ({
    x: start.x + direction.x * distance,
    y: start.y + direction.y * distance,
  });

  const gapEnd = pointAt(gapTo);
  const gapStart = pointAt(gapFrom);

  let path = `M${round(gapEnd.x)} ${round(gapEnd.y)}`;
  // 빈 구간 다음 모서리부터 한 바퀴 돌아 이 변의 시작 모서리까지
  for (let step = 1; step <= count; step += 1) {
    path += arc(edge + step);
  }
  path += ` L${round(gapStart.x)} ${round(gapStart.y)}`;

  return path;
};

/** 박스의 gx 최대면 중심 (연결선 출발점). */
export const boxExitAnchor = (box: IsoBox): IsoGridPoint => ({
  gx: box.gx + box.width,
  gy: box.gy + box.depth / 2,
  z: box.z + box.height / 2,
});

/** 박스의 gx 최소면 중심 (연결선 도착점). */
export const boxEntryAnchor = (box: IsoBox): IsoGridPoint => ({
  gx: box.gx,
  gy: box.gy + box.depth / 2,
  z: box.z + box.height / 2,
});

/**
 * 그리드 공간에서 직교 엘보(gx → gy → gx)로 이어진 경로를 투영하고
 * 꺾이는 지점을 둥글게 처리한다.
 *
 * `midGx` 로 수직 구간이 지나갈 gx 를 지정할 수 있다. 출발 노드들이 gx 를
 * 공유하는 배치(평면도)에서는 기본값(중간점)을 쓰면 모든 수직 구간이 한 x 에
 * 겹쳐 어느 선이 어디로 가는지 구분할 수 없다.
 */
/**
 * 엘보의 **그리드 공간** 꼭짓점. 투영 전 좌표라 WebGL 렌더러도 이걸 쓴다.
 * SVG 경로와 3D 선이 같은 점을 쓰므로 두 렌더러의 연결선이 어긋나지 않는다.
 */
export const elbowGridPoints = (
  from: IsoGridPoint,
  to: IsoGridPoint,
  midGx?: number
): IsoGridPoint[] => {
  const midX = midGx ?? (from.gx + to.gx) / 2;
  return [
    from,
    { gx: midX, gy: from.gy, z: from.z },
    { gx: midX, gy: to.gy, z: to.z },
    to,
  ];
};

export const buildElbowPath = (
  from: IsoGridPoint,
  to: IsoGridPoint,
  config: IsoProjectionConfig,
  cornerRadius = 8,
  midGx?: number
): string => {
  const points = dedupe(
    elbowGridPoints(from, to, midGx).map((point) => projectIso(point, config))
  );

  return roundedPolylinePath(points, cornerRadius);
};

const dedupe = (points: IsoScreenPoint[]): IsoScreenPoint[] =>
  points.filter((point, index) => {
    const prev = points[index - 1];
    if (!prev) return true;
    return Math.abs(point.x - prev.x) > 0.5 || Math.abs(point.y - prev.y) > 0.5;
  });

/** 폴리라인의 내부 꼭짓점을 2차 베지어로 라운딩한다. */
export const roundedPolylinePath = (
  points: IsoScreenPoint[],
  radius: number
): string => {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';

  if (points.length === 2) {
    return `M${round(first.x)} ${round(first.y)} L${round(last.x)} ${round(last.y)}`;
  }

  let path = `M${round(first.x)} ${round(first.y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    if (!prev || !corner || !next) continue;

    const enter = shiftToward(corner, prev, radius);
    const exit = shiftToward(corner, next, radius);

    path += ` L${round(enter.x)} ${round(enter.y)}`;
    path += ` Q${round(corner.x)} ${round(corner.y)} ${round(exit.x)} ${round(exit.y)}`;
  }

  path += ` L${round(last.x)} ${round(last.y)}`;

  return path;
};

/** `origin` 에서 `target` 방향으로 `distance` 만큼(선분 길이의 절반을 넘지 않게) 이동. */
const shiftToward = (
  origin: IsoScreenPoint,
  target: IsoScreenPoint,
  distance: number
): IsoScreenPoint => {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return origin;

  const step = Math.min(distance, length / 2);
  return {
    x: origin.x + (dx / length) * step,
    y: origin.y + (dy / length) * step,
  };
};

/** path 문자열에서 좌표를 뽑아 bbox 를 누적한다. viewBox 자동 맞춤용. */
export const collectPathBounds = (
  path: string,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void => {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers) return;

  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = Number(numbers[index]);
    const y = Number(numbers[index + 1]);
    if (x < bounds.minX) bounds.minX = x;
    if (x > bounds.maxX) bounds.maxX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (y > bounds.maxY) bounds.maxY = y;
  }
};
