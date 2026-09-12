/**
 * resource-map 응답을 아이소메트릭 씬으로 변환한다.
 *
 * 레이아웃은 범용 그래프 레이아웃이 아니라 **템플릿 기반**이다. VPC 구조는 계층이
 * 고정적이므로(VPC → 가용영역 → 서브넷, 라우팅테이블/네트워크는 별도 레인) 레인을
 * 고정해두고 레인 내부 순서만 정렬한다. 순서는 barycenter(연결된 상대 노드의 평균
 * 위치) 휴리스틱으로 정해 엣지 교차를 줄인다 — dagre 의 교차 감소 단계와 같은
 * 발상이지만 레이어가 3개로 고정이라 의존성 없이 계산할 수 있다.
 *
 * 3D·2D 가 **같은 그리드를 공유**한다. 서브넷을 가로로 늘어놓으면 어느 서브넷이
 * 어느 라우팅 테이블로 가는지 선을 따라갈 수 없어서(옆 박스를 지나간다), 두 모드
 * 모두 서브넷을 한 열에 세로로 쌓고 가용영역으로 묶는다. 계층이 좌→우 한 방향으로만
 * 흐르므로 연결선이 박스를 관통하지 않는다.
 */
import {
  boxEntryAnchor,
  boxExitAnchor,
  buildBoxFaces,
  elbowGridPoints,
  buildElbowPath,
  buildFloorQuad,
  collectPathBounds,
  floorTextTransform,
  projectIso,
  unprojectGround,
  pickFloorEdge,
  transformedRectCorners,
} from '../scene/projection';
import type { IsoPathGap } from '../scene/projection';
import { estimateTextWidth, fitTextToWidth } from '../scene/text';
import type {
  IsoBox,
  IsoEdge,
  IsoFloorAxis,
  IsoLabelAnchor,
  IsoLabelPlate,
  IsoNode,
  IsoProjectionConfig,
  IsoScene,
  IsoScreenPoint,
  IsoGridPoint,
  IsoSlab,
  IsoSolidEdge,
  IsoSolidScene,
  IsoSolidZone,
  IsoTone,
  IsoZone,
} from '../scene/types';
import type { IsoVpcSource } from './sourceTypes';

/** 이 어댑터가 다루는 계층. 구획 id 와 색 배정에 함께 쓰인다. */
type VpcLayer = 'vpc' | 'availabilityZone' | 'routeTable' | 'network';

/** 도메인 계층 → 색 계열. 렌더러는 색 계열만 알고 계층 이름은 모른다. */
const LAYER_TONE: Record<VpcLayer, IsoTone> = {
  vpc: 'gray',
  availabilityZone: 'blue',
  routeTable: 'green',
  network: 'orange',
};

const LAYER_LABEL = {
  vpc: 'VPC',
  subnet: '서브넷',
  routeTable: '라우팅 테이블',
  network: '네트워크 자원',
} as const;

/** 그리드 단위 치수. 1 = projection unit 1칸. */
const GRID = {
  /**
   * 자원 박스 폭.
   *
   * 2.4(=82px) 였는데 3.4(=116px)로 넓혔다. 박스 위에 이름을 얹는 `text` 모드에서
   * 가장 긴 이름이 88px 이라 82px 짜리 박스를 넘쳐 났다 — 3D 는 마름모라 덜
   * 드러났지만 2D 는 사각형이라 글자가 변을 넘는 것이 그대로 보인다.
   *
   * 값을 정한 기준은 실측 폭이 아니라 **말줄임이 쓰는 추정 폭**이다. 추정식은
   * 라틴을 글자 크기의 0.58 배로 보는데 실제 렌더는 0.49 배라 약 19% 과대평가한다.
   * 실측에 맞춰 폭을 정하면 잘릴 이유가 없는 이름이 잘린다 — 16자 이름의 추정
   * 폭(102px)이 들어가고도 남게 잡아야 한다.
   *
   * 3D·2D 가 같은 그리드를 공유하므로 한쪽만 넓힐 수는 없다. 핀 모드에서는 칩이
   * 박스 크기와 무관하니 이 값이 이름을 좌우하지 않고, 넓어진 만큼 레인 간격도
   * 함께 밀려 비례는 유지된다.
   */
  nodeWidth: 3.4,
  nodeDepth: 1.5,
  /**
   * 박스 높이는 낮게 유지한다. 아이소메트릭에서는 박스가 높을수록 뒤쪽(화면 위쪽)
   * 행을 가리므로, 높이를 키우면 그만큼 행 간격도 같이 키워야 한다.
   */
  nodeHeight: 0.6,
  /** 노드가 gy 방향으로 반복되는 간격 (서브넷·라우팅테이블·네트워크 공통) */
  stackPitchY: 2.1,
  /**
   * 가용영역 그룹 사이 간격.
   * 구획은 내용물 바깥으로 `zonePad` 만큼 넓어지므로, 이 값이 `zonePad * 2` 보다
   * 작으면 이웃 구획의 레일이 서로 겹친다. 라벨이 하단 모서리에 붙으므로
   * 레일 사이에 눈에 보이는 여백까지 남긴다.
   */
  azGapY: 3,
  laneStartX: 1,
  rowStartY: 1,
  /** 가용영역 구획 → 라우팅테이블 레인 */
  routeTableLaneGap: 3.2,
  /** 라우팅테이블 레인 → 네트워크 레인 (VPC 밖) */
  networkLaneGap: 3.6,
  /**
   * 구획 레일이 내용물 바깥으로 두는 여백.
   *
   * 0.55 였는데 0.8 로 넓혔다. 구획 이름이 아래 변의 빈 구간에 들어가므로 변이
   * 이름보다 충분히 길어야 한다 — 0.55 에서는 아래 변(119px)이 이름(약 96px)과
   * 거의 같아서 모서리 곡선까지 이름이 밀려 나왔다.
   */
  zonePad: 0.8,
  vpcSlabPad: 0.9,
  vpcSlabHeight: 0.3,
} as const;

/**
 * 콘텐츠 바깥 여백.
 *
 * 고정 px 로 두면 배율을 올렸을 때 도식만 커지고 여백은 그대로라 비율이 달라
 * 보인다. 그리드 단위에 비례시켜 어느 배율에서나 같은 여유로 보이게 한다.
 */
const viewBoxPad = (config: IsoProjectionConfig) => ({
  x: config.unit * 1.7,
  y: config.unit * 1.3,
});
/**
 * 박스 안 라벨 양옆에 남겨 둘 여백(px).
 *
 * 3D 는 윗면이 마름모라 가운데 높이에서만 폭이 온전하고 위아래로 갈수록 좁아진다.
 * 여백을 이만큼 두면 두 줄짜리 라벨도 마름모 안에 남는다.
 */
const NODE_LABEL_INSET = 12;

/** 박스 안 라벨이 쓸 수 있는 폭(px). 박스 폭에서 좌우 여백을 뺀 값이다. */
const labelMaxWidth = (config: IsoProjectionConfig) =>
  GRID.nodeWidth * config.unit - NODE_LABEL_INSET;

/** 구획 이름 글자 크기. 바깥(VPC)만 키운다. */
const ZONE_LABEL_FONT = { inner: 11, outer: 15 } as const;

/**
 * 구획 레일의 모서리 라운딩 반지름.
 *
 * 이름을 넣을 빈 구간이 이 값에 의존한다 — 레일은 꼭짓점에 닿지 않고 이
 * 반지름만큼 앞에서 휘므로, 빈 구간은 그 직선 구간 안에 들어가야 한다.
 * 14 였는데 10 으로 줄여 직선 구간을 8px 벌었다. 10 도 각진 볼륨과 구분될 만큼
 * 충분히 둥글다.
 */
const ZONE_CORNER_RADIUS = 10;

/** 이름 양옆으로 레일을 더 비우는 여백(px). 글자가 레일 끝에 붙지 않게 한다. */
const LABEL_GAP_PAD = 6;

/**
 * 배경 격자를 `viewBox` 보다 얼마나 더 넓게 그릴지 (비율).
 * 렌더러는 회전 대비로 `viewBox` 보다 큰 프레임을 쓰므로 그만큼 여유가 필요하다.
 */
const GRID_MARGIN = 0.25;

const round2 = (value: number) => Math.round(value * 100) / 100;

interface PlacedNode {
  node: IsoNode;
  box: IsoBox;
  /** 강조 전파를 같은 계층으로 되돌리지 않기 위한 표식 */
  layer: 'subnet' | 'routeTable' | 'network';
  /**
   * 직접 연결된 노드 id. 인접 관계는 레이아웃 계산에만 쓰이고 렌더러에는
   * 전이 연결까지 합친 `node.relatedIds` 만 넘어간다.
   */
  adjacentIds: string[];
}

/** 가용영역 하나가 차지하는 gy 구간과 그 안의 서브넷. */
interface AzGroup {
  availabilityZone: string;
  box: Omit<IsoBox, 'height'>;
}

export const buildIsoVpcLayout = (
  source: IsoVpcSource | null | undefined,
  config: IsoProjectionConfig
): IsoScene => {
  const subnetGroups = (source?.subnetGroupList ?? []).filter(
    (group) => (group.subnetList?.length ?? 0) > 0
  );
  const routeTables = source?.routeTableResourceMapList ?? [];

  /* ---------------- 1. 서브넷: 가용영역별로 한 열에 세로 적층 ---------------- */
  const subnetPlacements = new Map<string, PlacedNode>();
  const azGroups: AzGroup[] = [];

  let cursorY = GRID.rowStartY;

  subnetGroups.forEach((group) => {
    const subnets = group.subnetList ?? [];
    const groupStartY = cursorY;

    subnets.forEach((subnet, index) => {
      const box: IsoBox = {
        gx: GRID.laneStartX,
        gy: groupStartY + index * GRID.stackPitchY,
        width: GRID.nodeWidth,
        depth: GRID.nodeDepth,
        z: GRID.vpcSlabHeight,
        height: GRID.nodeHeight,
      };

      subnetPlacements.set(subnet.subnetId, {
        box,
        layer: 'subnet',
        node: {
          id: subnet.subnetId,
          kind: 'subnet',
          tone: LAYER_TONE.availabilityZone,
          kindLabel: LAYER_LABEL.subnet,
          name: subnet.name ?? subnet.subnetId,
          subLabel: subnet.cidrBlock ?? undefined,
          labelMaxWidth: labelMaxWidth(config),
          faces: buildBoxFaces(box, config),
          relatedIds: [],
        },
        adjacentIds: subnet.routeTableId ? [subnet.routeTableId] : [],
      });
    });

    const spanDepth =
      Math.max(0, subnets.length - 1) * GRID.stackPitchY + GRID.nodeDepth;

    azGroups.push({
      availabilityZone: group.availabilityZone,
      box: {
        gx: GRID.laneStartX - GRID.zonePad,
        gy: groupStartY - GRID.zonePad,
        width: GRID.nodeWidth + GRID.zonePad * 2,
        depth: spanDepth + GRID.zonePad * 2,
        z: GRID.vpcSlabHeight,
      },
    });

    cursorY = groupStartY + spanDepth + GRID.azGapY;
  });

  const subnetBoxes = [...subnetPlacements.values()].map((placed) => placed.box);
  const subnetSpanStart = subnetBoxes.length
    ? Math.min(...subnetBoxes.map((box) => box.gy))
    : GRID.rowStartY;
  const subnetSpanEnd = subnetBoxes.length
    ? Math.max(...subnetBoxes.map((box) => box.gy + box.depth))
    : GRID.rowStartY + GRID.nodeDepth;

  /* ----------------------------------------------------------------
   * 2. 네트워크 자원 수집
   *
   * 기준은 `networkResourceMapList` 다 — 이게 VPC 의 네트워크 자원 목록이고,
   * 어느 라우팅 테이블도 참조하지 않는 자원까지 들어 있다. `connectWith` 만으로
   * 역산하면 그런 자원이 화면에서 사라진다.
   *
   * `connectWith` 는 **연결선**을 만드는 데만 쓴다. 목록에 없는 대상이 라우트에
   * 잡혀 있으면 끊긴 선이 되므로 노드로 함께 채워 넣는다.
   * ---------------------------------------------------------------- */
  const networkResources = new Map<
    string,
    { id: string; name?: string | null; type: string }
  >();

  (source?.networkResourceMapList ?? []).forEach((resource) => {
    networkResources.set(resource.id, resource);
  });

  const networkToRouteTables = new Map<string, string[]>();

  routeTables.forEach((routeTable) => {
    (routeTable.connectWith ?? []).forEach((target) => {
      if (target.state !== 'active') return;
      if (!networkResources.has(target.id)) {
        networkResources.set(target.id, target);
      }
      const owners = networkToRouteTables.get(target.id) ?? [];
      owners.push(routeTable.routeTableId);
      networkToRouteTables.set(target.id, owners);
    });
  });

  /* ---------------- 3. 레인 gx ---------------- */
  const azZoneEndX = azGroups.length
    ? Math.max(...azGroups.map((group) => group.box.gx + group.box.width))
    : GRID.laneStartX + GRID.nodeWidth;
  const routeTableLaneX = azZoneEndX + GRID.routeTableLaneGap;
  const networkLaneX = routeTableLaneX + GRID.nodeWidth + GRID.networkLaneGap;

  /* ---------------- 4. 레인 내부 순서: barycenter 정렬 ---------------- */
  const orderedRouteTables = [...routeTables]
    .map((routeTable) => {
      const attached = [...subnetPlacements.values()].filter(
        (placed) => placed.adjacentIds[0] === routeTable.routeTableId
      );
      return {
        routeTable,
        barycenter: attached.length
          ? average(attached.map((placed) => placed.box.gy))
          : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.barycenter - b.barycenter);

  const centerY = (subnetSpanStart + subnetSpanEnd) / 2;
  const laneStartY = (count: number) =>
    centerY -
    ((Math.max(1, count) - 1) * GRID.stackPitchY + GRID.nodeDepth) / 2;

  const routeTablePlacements = new Map<string, PlacedNode>();
  const routeTableStartY = laneStartY(orderedRouteTables.length);

  orderedRouteTables.forEach(({ routeTable }, index) => {
    const box: IsoBox = {
      gx: routeTableLaneX,
      gy: routeTableStartY + index * GRID.stackPitchY,
      width: GRID.nodeWidth,
      depth: GRID.nodeDepth,
      z: GRID.vpcSlabHeight,
      height: GRID.nodeHeight,
    };

    const attachedSubnetIds = [...subnetPlacements.values()]
      .filter((placed) => placed.adjacentIds[0] === routeTable.routeTableId)
      .map((placed) => placed.node.id);

    const attachedNetworkIds = (routeTable.connectWith ?? [])
      .filter((connection) => connection.state === 'active')
      .map((connection) => connection.id);

    routeTablePlacements.set(routeTable.routeTableId, {
      box,
      layer: 'routeTable',
      node: {
        id: routeTable.routeTableId,
        kind: 'routeTable',
        tone: LAYER_TONE.routeTable,
        kindLabel: LAYER_LABEL.routeTable,
        name: routeTable.name ?? routeTable.routeTableId,
        subLabel: `서브넷 ${attachedSubnetIds.length}`,
        labelMaxWidth: labelMaxWidth(config),
        faces: buildBoxFaces(box, config),
        relatedIds: [],
      },
      adjacentIds: [...attachedSubnetIds, ...attachedNetworkIds],
    });
  });

  const orderedNetworks = [...networkResources.values()]
    .map((network) => {
      const ownerYs = (networkToRouteTables.get(network.id) ?? [])
        .map((id) => routeTablePlacements.get(id)?.box.gy)
        .filter((value): value is number => typeof value === 'number');
      return {
        network,
        barycenter: ownerYs.length
          ? average(ownerYs)
          : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.barycenter - b.barycenter);

  const networkPlacements = new Map<string, PlacedNode>();
  const networkStartY = laneStartY(orderedNetworks.length);

  orderedNetworks.forEach(({ network }, index) => {
    const box: IsoBox = {
      gx: networkLaneX,
      gy: networkStartY + index * GRID.stackPitchY,
      width: GRID.nodeWidth,
      depth: GRID.nodeDepth,
      // VPC 밖 — 맨바닥에 두어 "경계 외부" 임을 드러낸다.
      z: 0,
      height: GRID.nodeHeight,
    };

    networkPlacements.set(network.id, {
      box,
      layer: 'network',
      node: {
        id: network.id,
        // 네트워크 계층은 자원 유형이 섞여 있으므로 실제 유형을 그대로 넘긴다.
        kind: network.type,
        tone: LAYER_TONE.network,
        kindLabel: LAYER_LABEL.network,
        name: network.name ?? network.id,
        subLabel: network.type,
        labelMaxWidth: labelMaxWidth(config),
        faces: buildBoxFaces(box, config),
        relatedIds: [],
      },
      adjacentIds: networkToRouteTables.get(network.id) ?? [],
    });
  });

  /* ----------------------------------------------------------------
   * 5. 바닥 구획
   *
   * VPC / 가용영역(각각) / 라우팅 테이블 / 네트워크를 바닥 위 선으로 구분한다.
   * 두께 없는 데칼이라 층이 늘지 않는다. 가용영역이 곧 구획이므로 서브넷을
   * 감싸는 별도 판은 두지 않는다 — 레일 하나로 계층이 드러난다.
   * ---------------------------------------------------------------- */
  interface ZoneSpec {
    id: string;
    layer: VpcLayer;
    label: string;
    box: Omit<IsoBox, 'height'>;
  }

  const laneZoneBox = (
    laneX: number,
    boxes: IsoBox[],
    z: number
  ): Omit<IsoBox, 'height'> | null => {
    if (!boxes.length) return null;
    const gyStart = Math.min(...boxes.map((box) => box.gy));
    const gyEnd = Math.max(...boxes.map((box) => box.gy + box.depth));

    return {
      gx: laneX - GRID.zonePad,
      gy: gyStart - GRID.zonePad,
      width: GRID.nodeWidth + GRID.zonePad * 2,
      depth: gyEnd - gyStart + GRID.zonePad * 2,
      z,
    };
  };

  const routeTableZoneBox = laneZoneBox(
    routeTableLaneX,
    [...routeTablePlacements.values()].map((placed) => placed.box),
    GRID.vpcSlabHeight
  );
  const networkZoneBox = laneZoneBox(
    networkLaneX,
    [...networkPlacements.values()].map((placed) => placed.box),
    0
  );

  const innerSpecs: ZoneSpec[] = [
    ...azGroups.map((group) => ({
      id: `az-${group.availabilityZone}`,
      layer: 'availabilityZone' as const,
      label: group.availabilityZone,
      box: group.box,
    })),
    ...(routeTableZoneBox
      ? [
          {
            id: 'lane-route-table',
            layer: 'routeTable' as const,
            label: LAYER_LABEL.routeTable,
            box: routeTableZoneBox,
          },
        ]
      : []),
    ...(networkZoneBox
      ? [
          {
            id: 'lane-network',
            layer: 'network' as const,
            label: LAYER_LABEL.network,
            box: networkZoneBox,
          },
        ]
      : []),
  ];

  /* ---------------- 6. VPC 슬래브 — VPC 안쪽 구획을 감싼다 ---------------- */
  const enclosed = innerSpecs
    .filter((spec) => spec.layer !== 'network')
    .map((spec) => spec.box);

  const vpcGxStart = enclosed.length
    ? Math.min(...enclosed.map((box) => box.gx))
    : GRID.laneStartX;
  const vpcGxEnd = enclosed.length
    ? Math.max(...enclosed.map((box) => box.gx + box.width))
    : routeTableLaneX + GRID.nodeWidth;
  const vpcGyStart = enclosed.length
    ? Math.min(...enclosed.map((box) => box.gy))
    : subnetSpanStart;
  const vpcGyEnd = enclosed.length
    ? Math.max(...enclosed.map((box) => box.gy + box.depth))
    : subnetSpanEnd;

  const vpcBox: IsoBox = {
    gx: vpcGxStart - GRID.vpcSlabPad,
    gy: vpcGyStart - GRID.vpcSlabPad,
    width: vpcGxEnd - vpcGxStart + GRID.vpcSlabPad * 2,
    depth: vpcGyEnd - vpcGyStart + GRID.vpcSlabPad * 2,
    z: 0,
    height: GRID.vpcSlabHeight,
  };

  /* ---------------- 7. 구획 확정 (VPC + 안쪽) ---------------- */
  const zoneSpecs: ZoneSpec[] = [
    {
      id: 'zone-vpc',
      layer: 'vpc',
      label: source?.vpcResourceMap?.name ?? LAYER_LABEL.vpc,
      box: { ...vpcBox, z: GRID.vpcSlabHeight },
    },
    ...innerSpecs,
  ];

  const zoneLabelBoxes: {
    rect: IsoLabelPlate;
    at: IsoScreenPoint;
    axis: IsoFloorAxis;
  }[] = [];

  const zones: IsoZone[] = zoneSpecs.map((spec) => {
    const outer = spec.layer === 'vpc';

    /*
     * 두 번 만든다. 이름이 어디에 놓이는지 먼저 알아야 레일의 어느 구간을 비울지
     * 정할 수 있고, 이름 위치는 레일 꼭짓점에서 계산되기 때문이다. 첫 번째 결과의
     * 꼭짓점만 쓰고, 실제로 쓰는 path 는 빈 구간이 반영된 두 번째 것이다.
     */
    const outline = buildFloorQuad(spec.box, config, ZONE_CORNER_RADIUS);
    const placed = zoneLabel(outline, spec.label, outer, config);
    const quad = buildFloorQuad(
      spec.box,
      config,
      ZONE_CORNER_RADIUS,
      placed.gap
    );

    zoneLabelBoxes.push({
      rect: placed.bounds,
      at: { x: placed.anchor.x, y: placed.anchor.y },
      axis: placed.axis,
    });

    return {
      id: spec.id,
      tone: LAYER_TONE[spec.layer],
      label: spec.label,
      floor: quad.path,
      labelAnchor: placed.anchor,
      // 판을 깔지 않는다 — 레일 자체가 이름 자리에서 끊긴다.
      labelPlate: null,
      dashed: false,
      outer,
    };
  });

  const slabs: IsoSlab[] = [
    {
      id: source?.vpcResourceMap?.vpcId ?? 'vpc',
      tone: 'light-gray',
      label: source?.vpcResourceMap?.name ?? LAYER_LABEL.vpc,
      faces: buildBoxFaces(vpcBox, config),
      labelAnchor: null,
    },
  ];

  /* ----------------------------------------------------------------
   * 8. 엣지
   *
   * 한 계층의 노드가 gx 를 공유하므로 엘보의 수직 구간이 전부 같은 x 에 겹친다.
   * 그래서 **도착 노드마다 채널 x 를 하나씩** 배분한다. 어느 서브넷이 어느
   * 라우팅 테이블로 가는지 선을 눈으로 따라갈 수 있게 하는 핵심 장치이고,
   * "이 서브넷들은 모두 같은 라우팅 테이블로 간다" 가 다발로 읽히는 효과도 있다.
   * ---------------------------------------------------------------- */
  const channelAllocator = (
    laneStart: number,
    span: number,
    ids: string[]
  ): Map<string, number> =>
    new Map(
      ids.map((id, index) => [
        id,
        laneStart + (span * (index + 1)) / (ids.length + 1),
      ])
    );

  const routeTableChannelX = channelAllocator(
    azZoneEndX,
    GRID.routeTableLaneGap,
    orderedRouteTables.map(({ routeTable }) => routeTable.routeTableId)
  );

  const networkChannelX = channelAllocator(
    routeTableLaneX + GRID.nodeWidth,
    GRID.networkLaneGap,
    orderedNetworks.map(({ network }) => network.id)
  );

  const edges: IsoEdge[] = [];
  /* 같은 엘보의 그리드 공간 좌표. WebGL 렌더러가 이걸 쓴다. */
  const solidEdges: IsoSolidEdge[] = [];

  /** SVG path 와 그리드 폴리라인을 한 번에 만든다 — 두 렌더러가 같은 점을 쓴다. */
  const pushEdge = (
    id: string,
    sourceId: string,
    targetId: string,
    dashed: boolean,
    from: IsoGridPoint,
    to: IsoGridPoint,
    channelGx?: number
  ) => {
    edges.push({
      id,
      sourceId,
      targetId,
      dashed,
      path: buildElbowPath(from, to, config, undefined, channelGx),
    });
    solidEdges.push({
      id,
      sourceId,
      targetId,
      dashed,
      points: elbowGridPoints(from, to, channelGx),
    });
  };

  subnetPlacements.forEach((placed) => {
    const routeTableId = placed.adjacentIds[0];
    if (!routeTableId) return;
    const target = routeTablePlacements.get(routeTableId);
    if (!target) return;

    pushEdge(
      `${placed.node.id}__${routeTableId}`,
      placed.node.id,
      routeTableId,
      false,
      boxExitAnchor(placed.box),
      boxEntryAnchor(target.box),
      routeTableChannelX.get(routeTableId)
    );
  });

  routeTablePlacements.forEach((placed) => {
    placed.adjacentIds.forEach((adjacentId) => {
      const target = networkPlacements.get(adjacentId);
      if (!target) return;

      pushEdge(
        `${placed.node.id}__${adjacentId}`,
        placed.node.id,
        adjacentId,
        true,
        boxExitAnchor(placed.box),
        boxEntryAnchor(target.box),
        networkChannelX.get(adjacentId)
      );
    });
  });

  /* ---------------- 9. 전이 연결 집합 ---------------- */
  const allPlacements = [
    ...subnetPlacements.values(),
    ...routeTablePlacements.values(),
    ...networkPlacements.values(),
  ];
  const placementById = new Map(
    allPlacements.map((placed) => [placed.node.id, placed])
  );

  /*
   * 강조는 서브넷 → 라우팅테이블 → 네트워크 사슬을 따라 두 홉까지 퍼뜨리되,
   * **같은 계층으로는 되돌아가지 않는다.**
   *
   * 이 제약이 없으면 라우팅 테이블에 커서를 올렸을 때 두 번째 홉이 게이트웨이를
   * 거쳐 그 게이트웨이를 함께 쓰는 다른 라우팅 테이블까지 켠다. 서브넷도
   * 마찬가지로 같은 라우팅 테이블에 붙은 형제 서브넷이 전부 켜진다.
   */
  allPlacements.forEach((placed) => {
    const related = new Set<string>();

    placed.adjacentIds.forEach((firstHopId) => {
      related.add(firstHopId);

      (placementById.get(firstHopId)?.adjacentIds ?? []).forEach(
        (secondHopId) => {
          if (secondHopId === placed.node.id) return;
          if (placementById.get(secondHopId)?.layer === placed.layer) return;
          related.add(secondHopId);
        }
      );
    });

    placed.node.relatedIds = [...related];
  });

  /* ----------------------------------------------------------------
   * 9-1. 핀을 펼쳤을 때 보여줄 상세 항목
   *
   * **모든 배치가 끝난 뒤에** 채운다. 서브넷 항목에 라우팅 테이블 **이름**이
   * 들어가는데, 서브넷을 만드는 시점에는 아직 라우팅 테이블 노드가 없어서
   * 식별자밖에 쓸 수 없기 때문이다.
   *
   * 관계도가 이미 보여주는 것(이름·CIDR)을 되풀이하지 않고, 표를 열거나 상세
   * 화면으로 건너가야 알 수 있던 것 — 식별자, 소속 가용영역, 무엇에 붙어 있는지 —
   * 을 채운다. 값이 없으면 줄을 빼지 않고 대체 문구를 적는다. 줄 수가 자원마다
   * 들쭉날쭉하면 카드 높이가 달라져 비교하기 어렵다.
   * ---------------------------------------------------------------- */
  const subnetSourceById = new Map(
    subnetGroups.flatMap((group) =>
      (group.subnetList ?? []).map(
        (subnet) =>
          [subnet.subnetId, { subnet, availabilityZone: group.availabilityZone }] as const
      )
    )
  );

  /** 라우팅 테이블에 붙은 서브넷 수. 서브넷의 첫 인접이 곧 그 테이블이다. */
  const subnetCountByRouteTable = new Map<string, number>();
  subnetPlacements.forEach((placed) => {
    const routeTableId = placed.adjacentIds[0];
    if (!routeTableId) return;
    subnetCountByRouteTable.set(
      routeTableId,
      (subnetCountByRouteTable.get(routeTableId) ?? 0) + 1
    );
  });

  /** 노드 이름을 우선하고, 노드가 없는 대상은 식별자로 적는다. */
  const displayName = (id: string) => placementById.get(id)?.node.name ?? id;

  /** 목록은 두 개까지만 적고 나머지는 수로 줄인다 — 카드가 길어지면 못 읽는다. */
  const joinNames = (ids: string[]): string => {
    if (!ids.length) return '없음';
    const shown = ids.slice(0, 2).map(displayName).join(', ');
    return ids.length > 2 ? `${shown} 외 ${ids.length - 2}개` : shown;
  };

  subnetPlacements.forEach((placed, subnetId) => {
    const found = subnetSourceById.get(subnetId);
    const routeTableId = found?.subnet.routeTableId;

    placed.node.details = [
      { label: '서브넷 ID', value: subnetId },
      { label: 'CIDR', value: found?.subnet.cidrBlock ?? '-' },
      { label: '가용 영역', value: found?.availabilityZone ?? '-' },
      {
        label: '라우팅 테이블',
        value: routeTableId ? displayName(routeTableId) : '연결 없음',
      },
    ];
  });

  routeTablePlacements.forEach((placed, routeTableId) => {
    const connections = placed.adjacentIds.filter((id) =>
      networkPlacements.has(id)
    );

    placed.node.details = [
      { label: '라우팅 테이블 ID', value: routeTableId },
      {
        label: '연결 서브넷',
        value: `${subnetCountByRouteTable.get(routeTableId) ?? 0}개`,
      },
      { label: '연결 네트워크 자원', value: joinNames(connections) },
    ];
  });

  networkPlacements.forEach((placed, networkId) => {
    placed.node.details = [
      { label: '자원 ID', value: networkId },
      { label: '유형', value: networkResources.get(networkId)?.type ?? '-' },
      {
        label: '연결 라우팅 테이블',
        value: joinNames(networkToRouteTables.get(networkId) ?? []),
      },
    ];
  });

  /* ---------------- viewBox ---------------- */
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  slabs.forEach((slab) => {
    collectPathBounds(slab.faces.top, bounds);
    collectPathBounds(slab.faces.left, bounds);
    collectPathBounds(slab.faces.right, bounds);
  });
  zones.forEach((zone) => collectPathBounds(zone.floor, bounds));
  allPlacements.forEach((placed) => {
    collectPathBounds(placed.node.faces.top, bounds);
    collectPathBounds(placed.node.faces.left, bounds);
    collectPathBounds(placed.node.faces.right, bounds);
  });
  edges.forEach((edge) => collectPathBounds(edge.path, bounds));

  allPlacements.forEach((placed) => {
    includeTextBounds(
      bounds,
      placed.node.faces.topCenter.x,
      placed.node.faces.topCenter.y,
      // 화면에 실제로 나가는 것은 폭에 맞춰 잘린 이름이다 — 자르기 전 이름으로
      // 재면 긴 이름 하나가 캔버스를 쓸데없이 넓힌다.
      fitTextToWidth(placed.node.name, 11, placed.node.labelMaxWidth)
    );
  });

  // 구획 라벨은 전단되므로 변환된 네 꼭짓점을 넣어야 한다. 변환 전 사각형만
  // 넣으면 긴 이름이 캔버스 밖으로 잘려 나간다.
  zoneLabelBoxes.forEach(({ rect, at, axis }) => {
    transformedRectCorners(rect, at, axis, config).forEach((corner) => {
      if (corner.x < bounds.minX) bounds.minX = corner.x;
      if (corner.x > bounds.maxX) bounds.maxX = corner.x;
      if (corner.y < bounds.minY) bounds.minY = corner.y;
      if (corner.y > bounds.maxY) bounds.maxY = corner.y;
    });
  });

  const pad = viewBoxPad(config);
  const hasContent = Number.isFinite(bounds.minX);
  const viewBox = hasContent
    ? {
        minX: bounds.minX - pad.x,
        minY: bounds.minY - pad.y,
        width: bounds.maxX - bounds.minX + pad.x * 2,
        height: bounds.maxY - bounds.minY + pad.y * 2,
      }
    : { minX: 0, minY: 0, width: 320, height: 180 };

  /* ----------------------------------------------------------------
   * 배경 격자
   *
   * 바닥판 안이 아니라 **도식이 놓이는 공간 전체**를 덮는다. 지면(z = 0) 평면에
   * 1 그리드 간격으로 긋고 맨 뒤에 그리므로, 바닥판 위에서는 판에 가려지고
   * 그 바깥에서만 보인다 — 도식이 모눈종이 위에 놓인 것처럼 읽힌다.
   *
   * 범위는 `viewBox` 네 꼭짓점을 지면으로 역투영해서 구한다. 여유(`GRID_MARGIN`)를
   * 두는 이유는 렌더러가 회전 대비로 `viewBox` 보다 큰 프레임을 쓰기 때문이다.
   * 화면 밖 선은 viewBox 가 잘라내므로 보이지 않는다.
   * ---------------------------------------------------------------- */
  const floorGrid: string[] = [];
  if (hasContent) {
    const margin = {
      x: viewBox.width * GRID_MARGIN,
      y: viewBox.height * GRID_MARGIN,
    };
    const corners: IsoScreenPoint[] = [
      { x: viewBox.minX - margin.x, y: viewBox.minY - margin.y },
      { x: viewBox.minX + viewBox.width + margin.x, y: viewBox.minY - margin.y },
      {
        x: viewBox.minX + viewBox.width + margin.x,
        y: viewBox.minY + viewBox.height + margin.y,
      },
      { x: viewBox.minX - margin.x, y: viewBox.minY + viewBox.height + margin.y },
    ].map((corner) => corner);

    const ground = corners.map((corner) => unprojectGround(corner, 0, config));
    const gxFrom = Math.floor(Math.min(...ground.map((point) => point.gx)));
    const gxTo = Math.ceil(Math.max(...ground.map((point) => point.gx)));
    const gyFrom = Math.floor(Math.min(...ground.map((point) => point.gy)));
    const gyTo = Math.ceil(Math.max(...ground.map((point) => point.gy)));

    const line = (from: IsoGridPoint, to: IsoGridPoint) => {
      const a = projectIso(from, config);
      const b = projectIso(to, config);
      floorGrid.push(
        `M${round2(a.x)} ${round2(a.y)} L${round2(b.x)} ${round2(b.y)}`
      );
    };

    for (let gx = gxFrom; gx <= gxTo; gx += 1) {
      line({ gx, gy: gyFrom, z: 0 }, { gx, gy: gyTo, z: 0 });
    }
    for (let gy = gyFrom; gy <= gyTo; gy += 1) {
      line({ gx: gxFrom, gy, z: 0 }, { gx: gxTo, gy, z: 0 });
    }
  }

  const counts = {
    subnet: subnetPlacements.size,
    routeTable: routeTablePlacements.size,
    network: networkPlacements.size,
  };

  /* ----------------------------------------------------------------
   * 투영 전 장면
   *
   * 위에서 계산한 **같은 배치**를 그리드 좌표 그대로 한 번 더 내보낸다. 위쪽
   * `nodes`/`zones` 는 이미 화면 좌표 path 라 WebGL 이 쓸 수 없기 때문이다.
   * 레이아웃을 두 번 계산하지 않으므로 두 렌더러가 같은 배치를 그린다.
   * ---------------------------------------------------------------- */
  const solidZones: IsoSolidZone[] = zoneSpecs.map((spec) => ({
    id: spec.id,
    tone: LAYER_TONE[spec.layer],
    label: spec.label,
    outer: spec.layer === 'vpc',
    box: spec.box,
  }));

  const solidBoxes = allPlacements.map((placed) => ({
    id: placed.node.id,
    kind: placed.node.kind,
    tone: placed.node.tone,
    name: placed.node.name,
    subLabel: placed.node.subLabel,
    labelMaxWidth: placed.node.labelMaxWidth,
    kindLabel: placed.node.kindLabel,
    box: placed.box,
    relatedIds: placed.node.relatedIds,
  }));

  /** 카메라 프레이밍용 그리드 범위. 구획과 바닥판을 모두 감싼다. */
  const extentBoxes = [
    vpcBox,
    ...solidZones.map((zone) => zone.box),
    ...solidBoxes.map((item) => item.box),
  ];
  const extent = extentBoxes.length
    ? {
        gx: Math.min(...extentBoxes.map((box) => box.gx)),
        gy: Math.min(...extentBoxes.map((box) => box.gy)),
        width:
          Math.max(...extentBoxes.map((box) => box.gx + box.width)) -
          Math.min(...extentBoxes.map((box) => box.gx)),
        depth:
          Math.max(...extentBoxes.map((box) => box.gy + box.depth)) -
          Math.min(...extentBoxes.map((box) => box.gy)),
      }
    : { gx: 0, gy: 0, width: 1, depth: 1 };

  const solid: IsoSolidScene = {
    boxes: solidBoxes,
    slabs: [
      {
        id: source?.vpcResourceMap?.vpcId ?? 'vpc',
        kind: 'vpc',
        tone: 'light-gray',
        name: source?.vpcResourceMap?.name ?? LAYER_LABEL.vpc,
        // 바닥판에는 박스 위 라벨을 얹지 않는다 — 이름은 구획 레일에 새긴다.
        labelMaxWidth: 0,
        box: vpcBox,
        relatedIds: [],
      },
    ],
    zones: solidZones,
    edges: solidEdges,
    extent,
  };

  return {
    slabs,
    zones,
    nodes: allPlacements.map((placed) => placed.node),
    edges,
    legend: [
      { id: 'subnet', tone: LAYER_TONE.availabilityZone, label: LAYER_LABEL.subnet },
      { id: 'routeTable', tone: LAYER_TONE.routeTable, label: LAYER_LABEL.routeTable },
      { id: 'network', tone: LAYER_TONE.network, label: LAYER_LABEL.network },
    ],
    summary: [
      `${LAYER_LABEL.subnet} ${counts.subnet}`,
      `${LAYER_LABEL.routeTable} ${counts.routeTable}`,
      `${LAYER_LABEL.network} ${counts.network}`,
    ].join(' · '),
    viewBox,
    floorGrid,
    solid,
  };
};

/**
 * 구획 이름 배치.
 *
 * 라벨은 **자기 구획 레일 위에 얹혀** 있어야 어느 영역의 이름인지 읽힌다.
 * 레일의 하단 모서리(left → front 변, +gx 방향)를 따라 놓는다. 하단 모서리는
 * 관측자에게 가장 가까운 변이라 안쪽 박스가 아무리 솟아도 명판을 가리지 않는다.
 *
 * **변의 가운데에 놓는다.** 전에는 변의 왼쪽 끝(left 꼭짓점)에 맞췄는데, 구획
 * 레일은 모서리를 `ZONE_CORNER_RADIUS` 만큼 둥글리므로 꼭짓점에 닿지 않는다.
 * 꼭짓점에 맞추면 명판의 왼쪽이 곡선 구간 위에 얹히고 그 끝은 레일이 없는
 * 허공으로 나가 어색했다. 변의 가운데는 양쪽 필렛에서 가장 먼 자리다.
 *
 * 명판은 레일 중심선에 **걸치게** 둔다. 높이(약 21px)가 레일 굵기(5px)보다 훨씬
 * 크므로 레일을 완전히 덮어, 레일이 이름 자리에서 끊긴 것처럼 읽힌다. 글자
 * 외곽선(halo)만으로 가리면 획이 얇은 곳과 글자 사이 틈으로 레일이 비친다.
 *
 * 명판을 바닥 색으로 칠하면 배경에 의존하게 된다 — 가용영역 구획은 VPC 바닥판
 * 위에 있지만 네트워크 구획은 VPC 밖 캔버스 위에 있어 배경색이 다르다. 그래서
 * 렌더러가 자기 계열의 옅은 면색 + 1px 테두리로 칠한다. 배경이 무엇이든 같은
 * 모양으로 보이고, 계열 색 신호도 유지된다.
 *
 * 모든 구획이 같은 방식을 쓴다 — 바깥(VPC) 만 글자와 명판을 키운다.
 */
type Quad = {
  back: IsoScreenPoint;
  right: IsoScreenPoint;
  front: IsoScreenPoint;
  left: IsoScreenPoint;
};

/**
 * 고른 변의 실제 꼭짓점·길이·방향. 어느 변을 고를지는 씬 계층의
 * `pickFloorEdge` 가 정한다 — WebGL 렌더러와 같은 규칙을 쓰기 위해서다.
 * 여기서는 그 선택을 이 구획의 좌표로 옮기기만 한다.
 */
const resolveLabelEdge = (
  quad: Quad,
  config: IsoProjectionConfig
): {
  edgeStart: IsoScreenPoint;
  edgeEnd: IsoScreenPoint;
  edgeLength: number;
  direction: IsoScreenPoint;
  axis: IsoFloorAxis;
  gapEdge: number;
  alongTraversal: boolean;
} => {
  const choice = pickFloorEdge(config);
  const corners = [quad.back, quad.right, quad.front, quad.left];
  const start = corners[choice.edge]!;
  const end = corners[(choice.edge + 1) % 4]!;
  const length = Math.hypot(end.x - start.x, end.y - start.y);

  const edgeStart = choice.alongTraversal ? start : end;
  const edgeEnd = choice.alongTraversal ? end : start;
  const direction =
    length === 0
      ? { x: 1, y: 0 }
      : {
          x: (edgeEnd.x - edgeStart.x) / length,
          y: (edgeEnd.y - edgeStart.y) / length,
        };

  return {
    edgeStart,
    edgeEnd,
    edgeLength: length,
    direction,
    axis: choice.axis,
    gapEdge: choice.edge,
    alongTraversal: choice.alongTraversal,
  };
};

const zoneLabel = (
  quad: Quad,
  label: string,
  outer: boolean,
  config: IsoProjectionConfig
): {
  anchor: IsoLabelAnchor;
  /** viewBox·충돌 판정용 글자 상자. 화면에 판으로 그리지는 않는다. */
  bounds: IsoLabelPlate;
  /** 레일에서 비울 구간 */
  gap: IsoPathGap;
  axis: IsoFloorAxis;
} => {
  const fontSize = outer ? ZONE_LABEL_FONT.outer : ZONE_LABEL_FONT.inner;
  const textWidth = estimateTextWidth(label, fontSize);

  const chosen = resolveLabelEdge(quad, config);
  const { edgeStart, edgeEnd, edgeLength, direction, axis } = chosen;
  const gapEdgeIndex = chosen.gapEdge;
  const gapMeasuredFromEdgeStart = chosen.alongTraversal;

  /*
   * 글자를 변 가운데에 놓는다.
   *
   * 전에는 판 폭 기준으로 넣었는데, 판이 없으니 글자 폭만 쓴다. 판을 깔던 방식은
   * 글자 수에 비례해 판이 길어져서 긴 이름이면 변을 거의 다 채우는 덩어리가 됐고,
   * 그 경우 가운데 정렬도 포기해야 했다. 지금은 비우는 구간만 길어지므로 이름이
   * 길어져도 항상 가운데다.
   */
  const inset = Math.max(0, (edgeLength - textWidth) / 2);

  const origin = {
    x: edgeStart.x + direction.x * inset,
    y: edgeStart.y + direction.y * inset,
  };

  /*
   * 글자 기준선을 레일 중심선에 맞춘다. 전단 변환이 걸리므로 여기서는 변을 로컬
   * x 축으로 보고 계산한다. 0.34 는 대문자 높이의 절반에 가까운 값이다.
   */
  const at = { x: origin.x, y: origin.y + fontSize * 0.34 };

  /* 비울 구간 — 글자 양옆으로 여백을 조금 더 준다. */
  const spanFrom = inset - LABEL_GAP_PAD;
  const spanTo = inset + textWidth + LABEL_GAP_PAD;
  const gap: IsoPathGap = gapMeasuredFromEdgeStart
    ? { edge: gapEdgeIndex, from: spanFrom, to: spanTo }
    : { edge: gapEdgeIndex, from: edgeLength - spanTo, to: edgeLength - spanFrom };

  return {
    anchor: {
      ...at,
      transform: floorTextTransform(at, axis, config),
      textAnchor: 'start',
    },
    bounds: {
      x: at.x,
      y: at.y - fontSize,
      width: textWidth,
      height: fontSize + 4,
    },
    gap,
    axis,
  };
};

/** 텍스트 실측이 불가능한 SVG 이므로 글자 수로 폭을 추정해 bbox 에 반영한다. */
const includeTextBounds = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  centerX: number,
  centerY: number,
  text: string,
  fontSize = 11
): void => {
  const width = estimateTextWidth(text, fontSize);
  const left = centerX - width / 2;

  if (left < bounds.minX) bounds.minX = left;
  if (left + width > bounds.maxX) bounds.maxX = left + width;
  if (centerY - 12 < bounds.minY) bounds.minY = centerY - 12;
  if (centerY + 12 > bounds.maxY) bounds.maxY = centerY + 12;
};

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
