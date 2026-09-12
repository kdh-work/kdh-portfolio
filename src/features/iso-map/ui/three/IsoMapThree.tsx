"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  ISO_SIN30,
  pickFloorEdge,
  projectIso,
} from "../../scene/projection";
import type { IsoPin } from "../../scene/pins";
import type {
  IsoLabelMode,
  IsoScene,
  IsoSolidScene,
  IsoTone,
} from "../../scene/types";
import {
  cameraDirection,
  frustumHalfExtent,
  heightScale,
  PIXELS_PER_UNIT,
} from "./camera";
import { createFloorText } from "./floorText";
import { railGeometry, railPolyline } from "./rail";
import { readTonePalette, SHADE, type TonePalette } from "./tones";
import { NODE_FONT, fitNodeLabel } from "../labels";
import { useYawDrag } from "../useYawDrag";
import styles from "./IsoMapThree.module.css";

/**
 * 같은 장면의 WebGL 렌더러. SVG 판을 대체하지 않고 나란히 두어 비교한다.
 *
 * 입력은 어댑터가 내보낸 **투영 전** 장면(`IsoScene.solid`)이다. 위쪽 `nodes`/
 * `zones` 는 이미 화면 좌표 path 라 여기서는 쓸 수 없다. 레이아웃은 한 곳에서만
 * 계산되므로 두 렌더러가 같은 배치를 그린다.
 *
 * 카메라는 `camera.ts` 의 유도대로 맞춰 SVG 투영과 수식이 일치한다(오차 1e-13 px).
 */

type Props = {
  /**
   * 투영 전 장면. **시야각·배율과 무관**하므로 바깥에서 한 번만 만들어 넘긴다 —
   * 매 프레임 새 객체가 오면 지오메트리와 캔버스 텍스처를 다시 굽는다(구획 5개 ×
   * 프레임마다 5장이었다).
   */
  solid: IsoSolidScene;
  /**
   * SVG 판과 **같은 프레임**. 크기뿐 아니라 원점(minX/minY)까지 받는다 —
   * 그래야 두 렌더러가 콘텐츠를 같은 픽셀에 놓는다.
   */
  frame: IsoScene["viewBox"];
  /**
   * 화면 배율. SVG 판이 `width`/`height` 에만 곱하는 것과 같은 뜻이다 —
   * 여기서는 렌더 버퍼를 그만큼 키우므로 확대해도 면이 흐려지지 않는다.
   * 글자는 HTML 오버레이라 CSS 로 함께 키운다.
   */
  zoom?: number;
  unit: number;
  heightUnit: number;
  yawDeg: number;
  onYawChange?: (deg: number) => void;
  /**
   * 이름 표시 방식. SVG 판과 **같은 값**을 받는다 — 한쪽만 핀이고 다른 쪽은 박스
   * 위 텍스트면 렌더러 토글이 A/B 비교가 아니라 딴 물건 비교가 된다.
   */
  labelMode: IsoLabelMode;
  /**
   * 해석된 핀 배치. 래퍼가 SVG 판과 나눠 쓰라고 계산해 넘긴다.
   *
   * 핀을 `CSS2DObject` 로 매달 수 없는 이유가 여기 있다 — 칩의 세로 위치는 이미
   * 놓인 칩과의 겹침에 따라 지지대 단계만큼 올라가므로 **투영 결과를 보고서야**
   * 정해진다. 3D 점에 매다는 오버레이로는 그 조정을 표현할 수 없어, 핀 층만은
   * 화면 좌표를 직접 쓰는 오버레이로 그린다.
   */
  pins: IsoPin[];
  /** 바닥 격자 표시 여부 */
  showGrid: boolean;
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
  onNodeClick?: (id: string) => void;
};

/** SVG 판의 `.zone` stroke-width 와 같은 값(px). */
const RAIL_WIDTH_PX = { inner: 5, outer: 7 } as const;
/** SVG 판의 `ZONE_CORNER_RADIUS` 와 같은 값(px). */
const CORNER_RADIUS_PX = 10;
/** SVG 판의 `ZONE_LABEL_FONT` 와 같은 값(px). */
const ZONE_LABEL_PX = { inner: 11, outer: 15 } as const;
/** 이름 양옆 여백(px) — SVG 판의 `LABEL_GAP_PAD`. */
const LABEL_GAP_PAD_PX = 6;

const DIMMED_OPACITY = 0.3;

/**
 * 렌더 버퍼의 픽셀 수 상한.
 *
 * 버퍼는 캔버스의 CSS 크기 × 화면 배속(dpr)이라 **배율의 제곱으로 큰다.** 레티나
 * 에서 400% 는 8888 × 5716 = 5천만 픽셀이 되는데, 배율이 바뀔 때마다 이만한 버퍼를
 * 다시 잡느라 확대가 끊기고 드라이버에 따라서는 컨텍스트를 잃는다.
 *
 * 상한에 닿으면 배속을 낮춘다. 화질은 떨어지지만 그 지점은 이미 콘텐츠가 화면보다
 * 훨씬 크게 확대된 상태라 눈에 덜 띄고, 끊기는 쪽이 훨씬 크게 걸린다.
 */
const MAX_BUFFER_PIXELS = 16e6;
/** 이보다 낮추면 확대해 놓고도 계단이 보인다 — 그 전에 멈춘다. */
const MIN_PIXEL_RATIO = 0.75;

/**
 * 지면 두 축 중 화면에서 **가장 많이 압축되는** 배율. 배경 격자 범위를 시야각과
 * 무관하게 잡을 때, 이 값으로 나누면 어느 각도에서도 화면을 덮는다.
 */
const GRID_SPAN_MIN = ISO_SIN30 * Math.SQRT2;

/*
 * 바닥 데칼(구획 레일·바닥에 눕힌 이름)을 바닥판 위로 띄우는 높이(월드 단위).
 *
 * 구획은 개념상 바닥판 **상단면과 같은 평면**에 있다. 그대로 두면 두 면의 깊이가
 * 같아 z-fighting 이 나고, 시야각에 따라 레일과 글자가 얼룩덜룩 깨지거나 통째로
 * 사라진다(처음에 0.004 만 띄워 뒀다 — 100% 배율에서 0.17px 이라 부족했다).
 *
 * 띄우기만으로는 부족하다. 어느 높이든 각도에 따라 깊이 버퍼 정밀도가 달라지므로
 * `polygonOffset` 을 함께 준다 — 동일 평면 데칼을 위해 있는 기능이다.
 */
const DECAL_LIFT = { rail: 0.02, text: 0.035 } as const;

/** 동일 평면 데칼을 깊이 버퍼에서 관측자 쪽으로 당긴다. */
const decalOffset = <T extends THREE.Material>(material: T, strength: number): T => {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -strength;
  material.polygonOffsetUnits = -strength;
  return material;
};

const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(" ");

const toColor = (value: string) => new THREE.Color(value);

/** SVG 판의 `.shade` 처럼 검정을 덮어 음영을 만든다. */
const shaded = (base: string, amount: number) =>
  toColor(base).multiplyScalar(1 - amount);

export function IsoMapThree({
  solid,
  frame,
  zoom = 1,
  unit,
  heightUnit,
  yawDeg,
  onYawChange,
  labelMode,
  pins,
  showGrid,
  hoveredId,
  onHoverChange,
  onNodeClick,
}: Props) {
  /* 끌어서 회전 — SVG 판과 같은 훅이라 조작감이 같다. */
  const drag = useYawDrag<HTMLDivElement>(yawDeg, onYawChange, !!onYawChange);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const labelHostRef = useRef<HTMLDivElement | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  /** 박스 id → 그 박스가 쓰는 재질들. 강조·흐리기에서 불투명도만 바꾼다. */
  const boxMaterialsRef = useRef(new Map<string, THREE.Material[]>());
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const disposablesRef = useRef<(() => void)[]>([]);
  const renderRef = useRef<() => void>(() => {});

  const palette = useRef<TonePalette | null>(null);
  /** 핀 층은 React 가 그리므로 색을 렌더 경로에서도 읽을 수 있어야 한다. */
  const [paletteState, setPaletteState] = useState<TonePalette | null>(null);

  const pixelsPerWorldUnit = unit * PIXELS_PER_UNIT;
  const hScale = heightScale(unit, heightUnit);

  /**
   * 구획 이름이 어느 변에 놓이는지는 시야각에 따라 바뀌지만, 값은 네댓 개뿐이다.
   * 매 프레임 레일과 텍스처를 다시 만들면 드래그가 버벅이므로, **선택이 실제로
   * 바뀔 때만** 다시 만든다.
   */
  const edgeChoice = useMemo(
    () =>
      pickFloorEdge({
        mode: "isometric",
        unit,
        heightUnit,
        flatDepthScale: 1,
        yawDeg,
      }),
    [unit, heightUnit, yawDeg],
  );
  /* 아래 effect 의 의존성은 **원시값**으로 둔다. 객체를 넣으면 시야각이 바뀔 때마다
     매 프레임 지오메트리와 캔버스 텍스처 5장을 다시 굽는다. */
  const edgeIndex = edgeChoice.edge;
  const edgeForward = edgeChoice.alongTraversal;

  /* ── 렌더러 · 씬 생성 (한 번) ──────────────────────────────────
   *
   * 아래 세 단계(생성 → 지오메트리 → 크기·카메라)는 **같은 종류의 effect 여야
   * 한다.** 섞으면 실행 순서가 선언 순서를 따르지 않는다 — 레이아웃 단계가 먼저
   * 통째로 돌고 그 다음 페인트, 그 뒤에 나머지가 돈다. 크기·카메라만 레이아웃
   * 단계로 옮겼더니 마운트 때 렌더러가 아직 없어 그대로 건너뛰었고, 의존성이
   * 그대로라 다시 불리지도 않아 캔버스가 빈 채로 남았다.
   */
  useLayoutEffect(() => {
    const host = hostRef.current;
    const labelHost = labelHostRef.current;
    if (!host || !labelHost) return;

    palette.current = readTonePalette();
    setPaletteState(palette.current);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.className = styles.canvas ?? "";

    const labelRenderer = new CSS2DRenderer({ element: labelHost });

    const threeScene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);

    rendererRef.current = renderer;
    labelRendererRef.current = labelRenderer;
    sceneRef.current = threeScene;
    cameraRef.current = camera;

    const render = () => {
      renderer.render(threeScene, camera);
      labelRenderer.render(threeScene, camera);
    };
    renderRef.current = render;

    return () => {
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      labelRendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  /* ── 지오메트리 구성 (장면·시야각 선택이 바뀔 때만) ──────────── */
  useLayoutEffect(() => {
    const threeScene = sceneRef.current;
    const paint = palette.current;
    if (!threeScene || !paint) return;

    /* 이전 내용 정리 */
    disposablesRef.current.forEach((dispose) => dispose());
    disposablesRef.current = [];
    boxMaterialsRef.current.clear();
    pickablesRef.current = [];
    threeScene.clear();

    const track = (dispose: () => void) => disposablesRef.current.push(dispose);

    const tonePaint = (tone: IsoTone) => paint[tone];

    /** 직육면체 — 상단면·측면 색과 1px 외곽선을 SVG 판과 같게 맞춘다. */
    const addBox = (
      id: string,
      tone: IsoTone,
      box: {
        gx: number;
        gy: number;
        width: number;
        depth: number;
        z: number;
        height: number;
      },
      pickable: boolean,
    ) => {
      const colors = tonePaint(tone);
      const geometry = new THREE.BoxGeometry(
        box.width,
        box.height * hScale,
        box.depth,
      );
      track(() => geometry.dispose());

      /* BoxGeometry 재질 순서: +x, -x, +y, -y, +z, -z.
         gx 면(±x)에 12%, gy 면(±z)에 5% — SVG 판의 좌·우면 음영과 같은 값이다.
         면마다 색을 미리 넣으므로 조명이 필요 없다(MeshBasicMaterial). */
      const side = colors.side;
      const materials = [
        shaded(side, SHADE.gx),
        shaded(side, SHADE.gx),
        toColor(colors.face),
        shaded(side, SHADE.gy),
        shaded(side, SHADE.gy),
        shaded(side, SHADE.gy),
      ].map((color) => new THREE.MeshBasicMaterial({ color, transparent: true }));
      materials.forEach((material) => track(() => material.dispose()));

      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.set(
        box.gx + box.width / 2,
        (box.z + box.height / 2) * hScale,
        box.gy + box.depth / 2,
      );
      mesh.userData.id = id;
      threeScene.add(mesh);

      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: toColor(colors.line),
        transparent: true,
      });
      track(() => edgeGeometry.dispose());
      track(() => edgeMaterial.dispose());
      const outline = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      outline.position.copy(mesh.position);
      threeScene.add(outline);

      boxMaterialsRef.current.set(id, [...materials, edgeMaterial]);
      if (pickable) pickablesRef.current.push(mesh);
    };

    /* 1. 배경 격자 — 도식이 놓이는 공간 전체를 덮는다.
          지면(y = 0)에 그리고 바닥판보다 먼저 넣으므로, 판 위에서는 깊이 버퍼가
          알아서 가려 준다.

          범위는 **시야각과 무관하게** 잡는다. 프레임을 매 각도 역투영하면 범위가
          각도마다 바뀌어 지오메트리를 다시 만들어야 하고, 그러면 같은 effect 에
          묶인 캔버스 텍스처 5장도 매 프레임 다시 구워진다. 프레임 대각선을 가장
          많이 압축되는 축(SPAN_Y)으로 나눈 정사각 범위면 어느 각도에서도 화면을
          덮는다. 화면 밖 선은 프러스텀이 잘라낸다. */
    if (showGrid) {
      const halfSpan =
        Math.hypot(frame.width, frame.height) / 2 / (unit * GRID_SPAN_MIN);
      const centerGx = solid.extent.gx + solid.extent.width / 2;
      const centerGy = solid.extent.gy + solid.extent.depth / 2;
      const gxFrom = Math.floor(centerGx - halfSpan);
      const gxTo = Math.ceil(centerGx + halfSpan);
      const gyFrom = Math.floor(centerGy - halfSpan);
      const gyTo = Math.ceil(centerGy + halfSpan);

      const points: number[] = [];
      for (let gx = gxFrom; gx <= gxTo; gx += 1) {
        points.push(gx, 0, gyFrom, gx, 0, gyTo);
      }
      for (let gy = gyFrom; gy <= gyTo; gy += 1) {
        points.push(gxFrom, 0, gy, gxTo, 0, gy);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      );
      const material = new THREE.LineBasicMaterial({
        color: toColor(paint["light-gray"].line),
        transparent: true,
      });
      track(() => geometry.dispose());
      track(() => material.dispose());
      threeScene.add(new THREE.LineSegments(geometry, material));
    }

    /* 2. VPC 바닥판 */
    solid.slabs.forEach((slab) => addBox(slab.id, slab.tone, slab.box, false));

    /* 3. 바닥 구획 레일 + 바닥에 눕힌 이름 */
    const cornerRadius = CORNER_RADIUS_PX / pixelsPerWorldUnit;

    solid.zones.forEach((zone) => {
      const colors = tonePaint(zone.tone);
      const fontPx = zone.outer ? ZONE_LABEL_PX.outer : ZONE_LABEL_PX.inner;
      const railWidth =
        (zone.outer ? RAIL_WIDTH_PX.outer : RAIL_WIDTH_PX.inner) /
        pixelsPerWorldUnit;

      /* 이름이 차지할 구간을 그리드 단위로 환산한다. 캔버스로 실측하기 전이므로
         SVG 판과 같은 근사(전각 = 글자 크기, 라틴 = 0.58 배)를 쓴다. */
      const textWidthPx = [...zone.label].reduce(
        (width, char) =>
          width + ((char.codePointAt(0) ?? 0) > 0x1100 ? fontPx : fontPx * 0.58),
        0,
      );
      const gapLength =
        (textWidthPx + LABEL_GAP_PAD_PX * 2) / pixelsPerWorldUnit;

      const corners = [
        { x: zone.box.gx, y: zone.box.gy },
        { x: zone.box.gx + zone.box.width, y: zone.box.gy },
        { x: zone.box.gx + zone.box.width, y: zone.box.gy + zone.box.depth },
        { x: zone.box.gx, y: zone.box.gy + zone.box.depth },
      ];
      const start = corners[edgeIndex]!;
      const end = corners[(edgeIndex + 1) % 4]!;
      const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
      const inset = Math.max(0, (edgeLength - gapLength) / 2);

      const railY = zone.box.z * hScale + DECAL_LIFT.rail;
      const points = railPolyline(zone.box, cornerRadius, {
        edge: edgeIndex,
        from: inset,
        to: inset + gapLength,
      });

      const geometry = railGeometry(points, railWidth, railY);
      const material = decalOffset(
        new THREE.MeshBasicMaterial({
          color: toColor(colors.line),
          transparent: true,
          opacity: zone.outer ? 1 : 0.85,
          /* 띠는 폴리라인 진행 방향에 따라 감기 방향이 뒤집힐 수 있다. 뒷면이
             걸러지면 레일이 통째로 사라지므로 양면을 그린다. */
          side: THREE.DoubleSide,
        }),
        1,
      );
      track(() => geometry.dispose());
      track(() => material.dispose());
      threeScene.add(new THREE.Mesh(geometry, material));

      /* 이름 — 빈 구간 가운데에 바닥으로 눕힌다 */
      const direction =
        edgeLength === 0
          ? { x: 1, z: 0 }
          : {
              x: (end.x - start.x) / edgeLength,
              z: (end.y - start.y) / edgeLength,
            };
      const flip = edgeForward ? 1 : -1;
      const midDistance = inset + gapLength / 2;
      const label = createFloorText({
        text: zone.label,
        fontPx,
        color: colors.label,
        pixelsPerWorldUnit,
        direction: { x: direction.x * flip, z: direction.z * flip },
        center: {
          x: start.x + direction.x * midDistance,
          y: zone.box.z * hScale + DECAL_LIFT.text,
          z: start.y + direction.z * midDistance,
        },
      });
      if (label) {
        decalOffset(label.mesh.material as THREE.Material, 2);
        /* 레일보다 나중에 그려 글자가 레일에 먹히지 않게 한다. */
        label.mesh.renderOrder = 1;
        threeScene.add(label.mesh);
        track(label.dispose);
      }
    });

    /* 4. 연결선 — 그리드 폴리라인을 그대로 3D 선으로 */
    solid.edges.forEach((edge) => {
      const positions = edge.points.flatMap((point) => [
        point.gx,
        point.z * hScale,
        point.gy,
      ]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      const material = edge.dashed
        ? new THREE.LineDashedMaterial({
            color: 0xb9c2cb,
            dashSize: 0.1,
            gapSize: 0.1,
            transparent: true,
          })
        : new THREE.LineBasicMaterial({ color: 0xb9c2cb, transparent: true });
      track(() => geometry.dispose());
      track(() => material.dispose());
      const line = new THREE.Line(geometry, material);
      if (edge.dashed) line.computeLineDistances();
      threeScene.add(line);
    });

    /* 5. 자원 박스 + 이름(HTML 오버레이)
          이름을 박스에 얹는 것은 `text` 모드뿐이다. 핀 모드는 아래 핀 층이,
          가리기는 아무것도 그리지 않는다. */
    solid.boxes.forEach((item) => {
      addBox(item.id, item.tone, item.box, true);

      if (labelMode !== "text") return;

      const wrapper = document.createElement("div");
      wrapper.className = styles.nodeLabel ?? "";
      /* SVG 판과 같은 표식을 남긴다 — 두 렌더러의 위치를 재서 비교할 수 있게. */
      wrapper.dataset.nodeId = item.id;
      const name = document.createElement("strong");
      name.textContent = fitNodeLabel(
        item.name,
        NODE_FONT.name,
        item.labelMaxWidth,
      );
      wrapper.appendChild(name);
      if (item.subLabel) {
        const sub = document.createElement("span");
        sub.textContent = fitNodeLabel(
          item.subLabel,
          NODE_FONT.sub,
          item.labelMaxWidth,
        );
        wrapper.appendChild(sub);
      }

      const object = new CSS2DObject(wrapper);
      object.position.set(
        item.box.gx + item.box.width / 2,
        (item.box.z + item.box.height) * hScale,
        item.box.gy + item.box.depth / 2,
      );
      object.userData.id = item.id;
      threeScene.add(object);
      track(() => {
        object.removeFromParent();
        wrapper.remove();
      });
    });

    renderRef.current();
  }, [
    solid,
    edgeIndex,
    edgeForward,
    hScale,
    pixelsPerWorldUnit,
    showGrid,
    frame.width,
    frame.height,
    unit,
    labelMode,
  ]);

  /* ── 카메라 · 크기 (시야각·배율·프레임이 바뀔 때) ──────────────
   *
   * **`useLayoutEffect` 여야 한다.** 배율이 바뀌면 React 는 컨테이너의 크기와 핀
   * 층의 `scale` 을 렌더 시점에 곧바로 커밋하는데, 캔버스 크기는 여기서 정한다.
   * `useEffect` 는 **페인트 뒤**에 돌므로 한 프레임 동안 캔버스만 옛 크기로 남아
   * 도식이 핀보다 작게 그려진다. 한 번이면 눈에 안 띄지만 휠이나 값 끌기처럼
   * 연속으로 배율이 바뀌면 매 프레임 어긋나 도식이 떨리고 핀이 제자리를 잃는다.
   *
   * WebGL 렌더는 동기라 페인트 전에 끝난다 — 레이아웃 단계에서 해도 안전하다.
   */
  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    const labelRenderer = labelRendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !labelRenderer || !camera) return;

    /* `updateStyle` 을 끄면 안 된다 — 버퍼는 dpr 배로 커지는데 CSS 크기가
       비어 있으면 레티나에서 캔버스가 두 배로 표시된다. */
    /* 버퍼를 배율만큼 키운다. 직교 창(아래 frustum)은 그대로라 콘텐츠가 그만큼
       크게, 그러면서도 또렷하게 그려진다. 다만 버퍼는 배율의 제곱으로 커지므로
       위 상한에 닿으면 배속을 낮춰 잡는다. */
    const cssWidth = frame.width * zoom;
    const cssHeight = frame.height * zoom;
    const deviceRatio = Math.min(window.devicePixelRatio, 2);
    const fitRatio = Math.sqrt(
      MAX_BUFFER_PIXELS / Math.max(1, cssWidth * cssHeight),
    );
    renderer.setPixelRatio(
      Math.max(MIN_PIXEL_RATIO, Math.min(deviceRatio, fitRatio)),
    );
    renderer.setSize(cssWidth, cssHeight);
    /* 라벨은 원래 크기로 배치하고 레이어를 통째로 확대한다 — 그래야 글자도
       SVG 판처럼 배율을 따라 커진다. */
    labelRenderer.setSize(frame.width, frame.height);

    const { halfWidth, halfHeight } = frustumHalfExtent(
      frame.width,
      frame.height,
      unit,
    );
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;

    /* 콘텐츠 가운데를 바라보게 둔다 — 회전은 제자리에서 일어난다. */
    const targetGrid = {
      gx: solid.extent.gx + solid.extent.width / 2,
      gy: solid.extent.gy + solid.extent.depth / 2,
      z: 0.3,
    };
    const target = new THREE.Vector3(
      targetGrid.gx,
      targetGrid.z * hScale,
      targetGrid.gy,
    );
    const direction = cameraDirection(yawDeg);
    camera.position.set(
      target.x + direction.x * 100,
      target.y + direction.y * 100,
      target.z + direction.z * 100,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);

    /*
     * 프레임 정렬.
     *
     * 카메라를 그대로 두면 바라보는 점이 캔버스 정중앙에 온다. 그런데 SVG 판의
     * 프레임은 **투영된 콘텐츠 경계**를 기준으로 잡혀 있어 정중앙이 아니다. 그대로
     * 두면 토글할 때 도식이 통째로 밀린다(측정해 보니 31px).
     *
     * 그래서 바라보는 점이 SVG 에서 놓이는 픽셀을 그대로 계산해, 그 차이만큼
     * 직교 창을 옮긴다. 배율이 아니라 위치만 건드리므로 두 렌더러의 크기는
     * 그대로 같다.
     */
    const projected = projectIso(targetGrid, {
      mode: "isometric",
      unit,
      heightUnit,
      flatDepthScale: 1,
      yawDeg,
    });
    const shiftX =
      (projected.x - frame.minX - frame.width / 2) / (unit * PIXELS_PER_UNIT);
    const shiftY =
      (projected.y - frame.minY - frame.height / 2) / (unit * PIXELS_PER_UNIT);

    camera.left = -halfWidth - shiftX;
    camera.right = halfWidth - shiftX;
    camera.top = halfHeight + shiftY;
    camera.bottom = -halfHeight + shiftY;
    camera.updateProjectionMatrix();

    renderRef.current();
  }, [frame, zoom, unit, heightUnit, yawDeg, solid.extent, hScale]);

  /* ── 강조 · 흐리기 ─────────────────────────────────────────── */
  useEffect(() => {
    const relatedIds = (() => {
      if (!hoveredId) return null;
      const node = solid.boxes.find((item) => item.id === hoveredId);
      if (!node) return null;
      return new Set([node.id, ...node.relatedIds]);
    })();

    boxMaterialsRef.current.forEach((materials, id) => {
      const dimmed = !!relatedIds && !relatedIds.has(id);
      materials.forEach((material) => {
        material.opacity = dimmed ? DIMMED_OPACITY : 1;
      });
    });

    renderRef.current();
  }, [hoveredId, solid.boxes]);

  /** 강조 집합 — 위 effect 가 재질에 쓰는 것과 같은 계산을 핀 층에도 쓴다. */
  const relatedIdSet = useMemo<Set<string> | null>(() => {
    if (!hoveredId) return null;
    const node = solid.boxes.find((item) => item.id === hoveredId);
    if (!node) return null;
    return new Set([node.id, ...node.relatedIds]);
  }, [hoveredId, solid.boxes]);

  /* ── 포인터 → 레이캐스터 ────────────────────────────────────
     SVG 는 DOM 이벤트로 공짜였던 부분이다. WebGL 에서는 광선을 직접 쏴야 한다. */
  const pick = (event: React.PointerEvent<HTMLDivElement>): string | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycasterRef.current.setFromCamera(pointer, camera);
    const hits = raycasterRef.current.intersectObjects(
      pickablesRef.current,
      false,
    );
    const id = hits[0]?.object.userData.id;
    return typeof id === "string" ? id : null;
  };

  /**
   * 포인터 아래의 핀 id. 핀 층은 캔버스 **위에 뜬 오버레이**라 레이캐스터가 닿지
   * 않는다 — 광선은 3D 물체만 맞히므로, 칩 위에 있어도 그 아래 박스(또는 허공)가
   * 잡힌다. 그래서 DOM 쪽을 먼저 보고, 핀 위라면 레이캐스터를 건너뛴다.
   */
  const pinUnderPointer = (target: EventTarget | null): string | null => {
    const element = target instanceof Element ? target : null;
    return element?.closest?.("[data-pin-id]")?.getAttribute("data-pin-id") ?? null;
  };

  return (
    <div
      className={cx(
        styles.root,
        onYawChange && styles.rotatable,
        drag.dragging && styles.dragging,
      )}
      style={{ width: frame.width * zoom, height: frame.height * zoom }}
      {...drag.handlers}
      onPointerMove={(event) => {
        drag.handlers.onPointerMove(event);
        /* 돌리는 중에는 강조를 건드리지 않는다 — 시점을 바꾸려던 동작이
           엉뚱한 자원을 켜고 끄면 방해가 된다. */
        if (drag.dragging) return;
        onHoverChange(pinUnderPointer(event.target) ?? pick(event));
      }}
      onPointerLeave={() => onHoverChange(null)}
      onClick={(event) => {
        if (drag.movedRef.current) return;
        const pinned = pinUnderPointer(event.target);
        if (pinned) {
          onNodeClick?.(pinned);
          return;
        }
        const id = pick(event as unknown as React.PointerEvent<HTMLDivElement>);
        if (id) onNodeClick?.(id);
      }}
    >
      <div ref={hostRef} className={styles.layer} />
      <div
        ref={labelHostRef}
        className={styles.labelLayer}
        style={{
          width: frame.width,
          height: frame.height,
          right: "auto",
          bottom: "auto",
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      />

      {/*
        콜아웃 핀.

        SVG 판과 **같은 배치**(래퍼가 계산해 넘긴 `pins`)를 같은 모양으로 그린다.
        viewBox 를 프레임과 같게 두면 핀 좌표를 변환 없이 그대로 쓸 수 있고,
        배율은 라벨 층과 마찬가지로 레이어를 통째로 확대해 건다.

        박스 이름을 `CSS2DObject`(HTML)로 두는 것과 달리 핀만 오버레이 SVG 인
        이유는 위 `pins` prop 주석에 있다 — 칩의 세로 위치가 투영 결과를 보고서야
        정해져 3D 점에 매달 수 없다. 어느 쪽이든 글자는 텍스처가 아니라 진짜
        글자로 남는다.
      */}
      {labelMode === "pin" && pins.length > 0 && (
        <svg
          className={styles.pinLayer}
          width={frame.width}
          height={frame.height}
          viewBox={`${frame.minX} ${frame.minY} ${frame.width} ${frame.height}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}
          aria-hidden="true"
        >
          {pins.map((pin) => {
            const paint = paletteState?.[pin.tone];
            const line = paint?.line ?? "currentColor";
            const active = relatedIdSet?.has(pin.id) ?? false;
            const dimmed = !!relatedIdSet && !active;

            return (
              <g
                key={`${pin.id}-pin`}
                className={cx(
                  styles.pin,
                  active && styles.pinActive,
                  !!onNodeClick && styles.pinClickable,
                )}
                data-pin-id={pin.id}
                opacity={dimmed ? DIMMED_OPACITY : 1}
              >
                <title>
                  {pin.subLabel ? `${pin.name} · ${pin.subLabel}` : pin.name}
                </title>
                <line
                  x1={pin.anchor.x}
                  y1={pin.anchor.y}
                  x2={pin.tip.x}
                  y2={pin.tip.y}
                  className={styles.pinStem}
                  stroke={line}
                />
                <circle
                  cx={pin.anchor.x}
                  cy={pin.anchor.y}
                  r="2.75"
                  className={styles.pinDot}
                  fill={line}
                />
                <rect
                  x={pin.chip.x}
                  y={pin.chip.y}
                  width={pin.chip.width}
                  height={pin.chip.height}
                  rx="4"
                  className={styles.pinChip}
                  stroke={line}
                />
                <text
                  x={pin.chip.x + pin.chip.width / 2}
                  y={pin.nameY}
                  textAnchor="middle"
                  className={styles.pinName}
                >
                  {pin.name}
                </text>
                {pin.subY !== null && (
                  <text
                    x={pin.chip.x + pin.chip.width / 2}
                    y={pin.subY}
                    textAnchor="middle"
                    className={styles.pinSub}
                  >
                    {pin.subLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
