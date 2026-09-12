/**
 * 아이소메트릭 맵의 **프로바이더 무관** 장면 모델.
 *
 * 이 모듈은 AWS·VPC·서브넷 같은 도메인 개념을 전혀 모른다. 도메인 어댑터가
 * 화면 좌표까지 계산해 `IsoScene` 을 만들면, 렌더러는 그것을 그리기만 한다.
 * 다른 프로바이더나 다른 자원 관계도를 그리려면 어댑터만 새로 쓰면 된다.
 */

/** 그리드(지면) 좌표. gx 는 화면 오른쪽 아래, gy 는 화면 왼쪽 아래로 투영된다. */
export interface IsoGridPoint {
  gx: number;
  gy: number;
  z: number;
}

/** 투영 후 화면 좌표(px). */
export interface IsoScreenPoint {
  x: number;
  y: number;
}

/** 화면 좌표계의 사각 창. 캔버스 프레임과 카드를 가두는 창이 같은 모양이다. */
export interface IsoViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * 투영 방식.
 * - `isometric`: 아이소메트릭 3D. z 가 높이로 드러나고 박스가 3면으로 보인다.
 * - `flat`: 위에서 내려다본 2D 평면도. z 는 무시되고 박스는 사각형 하나가 된다.
 */
export type IsoViewMode = 'isometric' | 'flat';

export interface IsoProjectionConfig {
  mode: IsoViewMode;
  /** 그리드 1칸의 화면 폭 기준 단위(px). 확대/축소는 이 값으로만 조정한다. */
  unit: number;
  /**
   * 지면 회전각(도). 생략하면 기본 아이소메트릭 시점(45°)이다.
   *
   * 시점을 돌리는 것이 이 값 하나로 끝나는 이유는 아이소메트릭이 3D 렌더링이
   * 아니라 아핀 변환이기 때문이다. 대신 각도에 딸려 오는 것이 있다 —
   * 가시면 선택, painter's algorithm 정렬 키, 바닥 글자의 전단 행렬, 구획 이름이
   * 놓일 변. 넷 다 축의 화면 방향에서 유도되므로 `projection.ts` 안에서 처리된다.
   * `flat` 에서는 무시된다.
   */
  yawDeg?: number;
  /** z 1단위의 화면 높이(px). `isometric` 에서만 쓰인다. */
  heightUnit: number;
  /**
   * `flat` 에서 gy 축에 적용할 압축 비율. 아이소메트릭은 gy 를 sin30(=0.5) 으로
   * 압축하므로, 평면도에서 같은 값을 쓰면 행 간격이 과하게 벌어진다.
   */
  flatDepthScale: number;
}

/**
 * 바닥에 눕힌 글자가 **흐르는 그리드 방향**.
 *
 * 시점이 고정이던 동안은 'gx' 와 'gy' 두 개로 충분했다. 시점이 돌면 어느
 * 방향이 화면에서 왼쪽→오른쪽으로 읽히는지가 바뀌므로 음의 방향도 필요하다.
 */
export type IsoFloorAxis = 'gx' | '-gx' | 'gy' | '-gy';

/**
 * 색 계열. 렌더러는 이 값만 보고 디자인 토큰을 고르므로, 도메인 자원 유형과
 * 표현 색이 분리된다.
 */
export type IsoTone = 'blue' | 'green' | 'orange' | 'gray' | 'light-gray';

/** 렌더러가 그대로 쓸 수 있게 해석된 라벨 배치. */
export interface IsoLabelAnchor {
  x: number;
  y: number;
  /**
   * SVG transform. 바닥에 새겨진 글자는 회전만으로는 안 되고 전단(shear)까지
   * 필요하므로 rotate 각도가 아니라 완성된 matrix 문자열을 넘긴다.
   * 수평 라벨과 평면도에서는 빈 문자열.
   */
  transform: string;
  textAnchor: 'start' | 'middle' | 'end';
}

/** 그리드 공간의 직육면체. */
export interface IsoBox {
  gx: number;
  gy: number;
  /** gx 방향 길이 */
  width: number;
  /** gy 방향 길이 */
  depth: number;
  /** 바닥 z */
  z: number;
  /** 두께 */
  height: number;
}

/** 투영된 직육면체의 가시면. `flat` 에서는 left/right 가 빈 문자열이다. */
export interface IsoBoxFaces {
  top: string;
  left: string;
  right: string;
  /** painter's algorithm 정렬 키 (작을수록 뒤) */
  depthKey: number;
  /** 상단면 중심 — 라벨 기준점 */
  topCenter: IsoScreenPoint;
  /** 상단면 뒤쪽 꼭짓점 (gx·gy 최소) */
  topBack: IsoScreenPoint;
  /** 상단면 화면 왼쪽 꼭짓점 (gy 최대) */
  topLeft: IsoScreenPoint;
  /** 상단면 화면 오른쪽 꼭짓점 (gx 최대) */
  topRight: IsoScreenPoint;
}

/** 두께가 있는 컨테이너 판. 자원을 얹는 바닥 역할. */
export interface IsoSlab {
  id: string;
  tone: IsoTone;
  label: string;
  faces: IsoBoxFaces;
  /** 라벨이 필요 없는 판은 null */
  labelAnchor: IsoLabelAnchor | null;
}

/**
 * 바닥에 그려지는 구획 경계.
 *
 * 두께 없는 데칼이라 z 층을 늘리지 않지만, 화면에서는 굵은 컬러 레일로 그려져
 * 낮은 담장처럼 읽힌다. 라벨은 레일 위 탭에 얹혀 바닥 평면에 새겨진다.
 */
export interface IsoZone {
  id: string;
  tone: IsoTone;
  label: string;
  /** 구획 외곽선 path (아이소메트릭에서는 모서리를 둥글린 평행사변형) */
  floor: string;
  labelAnchor: IsoLabelAnchor;
  /**
   * 라벨을 얹을 탭. 라벨과 같은 transform 을 쓰므로 렌더러는 그대로 그리면 된다.
   * null 이면 탭 없이 바닥에 직접 새긴다 (가장 바깥 구획).
   */
  labelPlate: IsoLabelPlate | null;
  /** 경계를 파선으로 그릴지 여부 */
  dashed: boolean;
  /** 바깥 컨테이너 — 레일을 굵게, 라벨을 크게 */
  outer: boolean;
}

/** 라벨 탭. 변환 전(로컬) 화면 좌표. */
export interface IsoLabelPlate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 확장한 핀이 줄 단위로 보여줄 상세 정보.
 *
 * 렌더러는 문자열만 그린다 — 어떤 항목을 몇 개 넣을지, 값이 없을 때 무엇을
 * 적을지는 도메인을 아는 어댑터가 정한다.
 */
export interface IsoNodeDetail {
  label: string;
  value: string;
}

/** 자원 박스. */
export interface IsoNode {
  id: string;
  /**
   * 도메인 자원 유형. 렌더러는 해석하지 않고 클릭 이벤트로 그대로 되돌려준다.
   * 라우팅 같은 도메인 판단은 호출하는 쪽이 한다.
   */
  kind: string;
  tone: IsoTone;
  name: string;
  /** 박스 안 보조 라벨 (CIDR, 자원 유형 등) */
  subLabel?: string;
  /** 스크린리더용 유형 이름 */
  kindLabel?: string;
  /** 핀을 눌러 펼쳤을 때 보여줄 항목들. 비어 있으면 펼치지 않는다. */
  details?: IsoNodeDetail[];
  faces: IsoBoxFaces;
  /** 강조 시 함께 살릴 노드 id (전이 연결 포함) */
  relatedIds: string[];
}

export interface IsoEdge {
  id: string;
  sourceId: string;
  targetId: string;
  dashed: boolean;
  path: string;
}

/** 렌더러 하단에 표시할 범례 항목. */
export interface IsoLegendItem {
  id: string;
  tone: IsoTone;
  label: string;
}

/* ────────────────────────────────────────────────────────────────
 * 투영 전(그리드 공간) 장면
 *
 * 위의 `IsoScene` 은 **이미 화면 좌표로 투영된** path 뭉치다. SVG 렌더러에는
 * 그것이 곧 그릴 것 자체지만, WebGL 렌더러에는 쓸 수 없다 — 투영은 카메라가
 * 하므로 렌더러가 필요한 것은 투영 **전**의 3D 기하다.
 *
 * 그래서 어댑터가 같은 레이아웃을 두 형태로 내보낸다. 레이아웃 계산은 한 번만
 * 하므로 두 렌더러가 같은 배치를 그린다 — 비교의 전제다.
 *
 * 좌표는 그리드 단위 그대로다(gx, gy, z). 배율·시점은 카메라가 정한다.
 * ──────────────────────────────────────────────────────────────── */

/** 부피가 있는 직육면체 — 자원 박스와 VPC 바닥판. */
export interface IsoSolidBox {
  id: string;
  /** 도메인 자원 유형. 렌더러는 해석하지 않고 클릭 시 그대로 돌려준다. */
  kind: string;
  tone: IsoTone;
  name: string;
  subLabel?: string;
  kindLabel?: string;
  box: IsoBox;
  /** 강조 시 함께 살릴 노드 id */
  relatedIds: string[];
}

/** 두께 없는 바닥 구획. 이름이 들어갈 자리만큼 윤곽선을 비운다. */
export interface IsoSolidZone {
  id: string;
  tone: IsoTone;
  label: string;
  outer: boolean;
  box: Omit<IsoBox, 'height'>;
}

/** 그리드 공간 폴리라인. 투영은 카메라가 한다. */
export interface IsoSolidEdge {
  id: string;
  sourceId: string;
  targetId: string;
  dashed: boolean;
  points: IsoGridPoint[];
}

export interface IsoSolidScene {
  /** 자원 박스 */
  boxes: IsoSolidBox[];
  /** 바닥판 (VPC) */
  slabs: IsoSolidBox[];
  zones: IsoSolidZone[];
  edges: IsoSolidEdge[];
  /** 콘텐츠가 차지하는 그리드 범위 — 카메라 프레이밍에 쓴다. */
  extent: { gx: number; gy: number; width: number; depth: number };
}

export interface IsoScene {
  slabs: IsoSlab[];
  zones: IsoZone[];
  nodes: IsoNode[];
  edges: IsoEdge[];
  legend: IsoLegendItem[];
  /** 헤더에 표시할 요약 문구 (예: "서브넷 6 · 라우팅테이블 3") */
  summary: string;
  /** 인트린식 크기 — viewBox 와 width/height 를 같게 두어 라벨 크기를 고정한다. */
  viewBox: IsoViewBox;
  /**
   * 바닥판 위 격자선. **항상 계산해서 실어 보내고 보일지는 렌더러가 정한다** —
   * 표시 여부는 투영이 아니라 표현의 문제라 `IsoProjectionConfig` 에 넣지 않았다.
   */
  floorGrid: string[];
  /**
   * 같은 레이아웃의 투영 전 형태. WebGL 렌더러만 쓴다.
   *
   * SVG 렌더러는 이 필드를 보지 않는다. 어댑터를 두 벌 두지 않으려고 한 장면에
   * 실어 보낸다 — 레이아웃이 한 곳에서만 계산되는 것이 두 렌더러를 비교하는
   * 전제이기 때문이다.
   */
  solid: IsoSolidScene;
}
