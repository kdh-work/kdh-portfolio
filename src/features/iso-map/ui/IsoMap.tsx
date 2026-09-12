"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { ISO_DEFAULT_YAW_DEG } from "../scene/projection";
import {
  CARD_FONT,
  buildIsoPinCard,
  buildIsoPins,
  padViewBoxForLabels,
} from "../scene/pins";
import type { IsoPin, IsoPinCard } from "../scene/pins";
import { fitTextToWidth } from "../scene/text";
import type {
  IsoEdge,
  IsoNode,
  IsoScene,
  IsoViewBox,
  IsoViewMode,
} from "../scene/types";
import { truncateLabel } from "./labels";
import { useMapViewport } from "./useMapViewport";
import { useYawDrag } from "./useYawDrag";
import styles from "./IsoMap.module.css";

/**
 * 아이소메트릭 맵 렌더러.
 *
 * 도메인을 전혀 모른다 — 완성된 `IsoScene` 을 받아 그리고, 클릭한 노드를 그대로
 * 돌려줄 뿐이다. 어떤 자원이 어디에 놓이는지, 클릭하면 어디로 가는지는 씬을
 * 만든 쪽이 정한다.
 */
type Props = {
  scene: IsoScene;
  title?: string;
  viewMode: IsoViewMode;
  zoom: number;
  onViewModeChange: (mode: IsoViewMode) => void;
  onZoomChange: (zoom: number) => void;
  /** 지면 회전각(도). `flat` 에서는 쓰이지 않는다. */
  yawDeg?: number;
  onYawChange?: (deg: number) => void;
  /**
   * 시점에 무관한 고정 프레임. 회전하면 콘텐츠의 화면 크기가 바뀌는데, 씬이
   * 계산한 viewBox 를 그대로 쓰면 드래그하는 동안 캔버스가 커졌다 작아진다.
   */
  frame?: IsoScene["viewBox"];
  /**
   * 강조 상태를 바깥에서 들고 있는다 — SVG 와 WebGL 렌더러가 같은 강조를
   * 공유해야 토글이 진짜 A/B 비교가 된다.
   */
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
  /** 렌더러 선택. WebGL 은 3D 에서만 고를 수 있다. */
  rendererMode?: "svg" | "webgl";
  onRendererModeChange?: (mode: "svg" | "webgl") => void;
  /** WebGL 렌더러. 주어지면 SVG 대신 이것을 캔버스 자리에 그린다. */
  webglCanvas?: ReactNode;
  /** 바닥 격자 표시 여부 */
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  emptyMessage?: string;
  /** 노드에 커서·버튼 롤을 부여할지 여부 */
  clickable?: boolean;
  onNodeClick?: (node: IsoNode) => void;
  /**
   * 뷰포트 높이(px). **높이는 CSS 로 고정한다** — SVG 의 intrinsic 크기가 높이를
   * 정하게 두면 회전·확대마다 컨테이너가 늘었다 줄었다 해서 페이지 전체가 밀린다.
   */
  canvasHeight?: number;
};

const VIEW_MODE_OPTIONS: { key: IsoViewMode; label: string }[] = [
  { key: "isometric", label: "3D" },
  { key: "flat", label: "2D" },
];

/**
 * 자원 이름을 어디에 두는가.
 * - `pin`: 지지대로 들어 올린 화면 수평 칩 (콜아웃)
 * - `text`: 박스 윗면에 직접 얹는 글자
 * - `none`: 아무것도 적지 않는다 — 배치와 연결만 보고 싶을 때
 */
type IsoLabelMode = "pin" | "text" | "none";

const LABEL_MODE_OPTIONS: { key: IsoLabelMode; label: string }[] = [
  { key: "pin", label: "핀" },
  { key: "text", label: "텍스트" },
  { key: "none", label: "가리기" },
];

/** 단계 회전 버튼이 한 번에 도는 각도. */
const ROTATE_STEP_DEG = 15;

const normalizeDeg = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

export function IsoMap({
  scene,
  title = "자원 관계도",
  viewMode,
  zoom,
  onViewModeChange,
  onZoomChange,
  yawDeg,
  onYawChange,
  frame,
  hoveredId,
  onHoverChange,
  rendererMode = "svg",
  onRendererModeChange,
  webglCanvas,
  showGrid,
  onShowGridChange,
  emptyMessage = "표시할 자원이 없습니다.",
  clickable = false,
  onNodeClick,
  canvasHeight,
}: Props) {
  const setHoveredId = onHoverChange;

  /** 3D 에서만 회전한다 — 평면도에는 시점이 없다. */
  const rotatable = viewMode === "isometric" && !!onYawChange;

  /**
   * 이름 표시 방식. 격자와 같은 이유로 렌더러가 직접 들고 있는다 — 씬은 이름과
   * 앵커만 담고, 그것을 박스 위에 얹을지 핀으로 띄울지는 그리는 쪽의 문제다.
   */
  const [labelMode, setLabelMode] = useState<IsoLabelMode>("pin");

  /**
   * 실제로 적용되는 이름 표시 방식.
   *
   * **평면도는 늘 텍스트다.** 핀이 풀어 주는 문제 — 마름모 윗면 위에서 글자가
   * 한쪽으로 쏠려 보이는 것, 박스 폭이 이름 길이를 떠안는 것 — 가 2D 에는 없다.
   * 박스가 반듯한 사각형이라 글자가 그 안에 그대로 들어가고, 오히려 핀을 세우면
   * 칩이 박스 위를 덮어 더 어수선하다.
   *
   * 고른 값(`labelMode`)은 그대로 두어 3D 로 돌아가면 되살아난다.
   */
  const effectiveLabelMode: IsoLabelMode =
    viewMode === "flat" && labelMode === "pin" ? "text" : labelMode;

  /**
   * 지금 고를 수 있는 표시 방식.
   *
   * 평면도에서는 핀을 뺀다. 가리기까지 함께 감추면 2D 에서 라벨을 끌 방법이
   * 사라지므로, 못 쓰는 항목 하나만 덜어 낸다.
   */
  const labelModeOptions =
    viewMode === "flat"
      ? LABEL_MODE_OPTIONS.filter((option) => option.key !== "pin")
      : LABEL_MODE_OPTIONS;

  /**
   * 실제로 그릴 프레임. 회전 중에는 콘텐츠 크기가 계속 변하므로 고정 프레임을
   * 받아 쓴다. 콘텐츠는 그 안에서 돌기만 한다.
   *
   * 라벨 층 여백은 **표시 방식과 상관없이 항상** 붙인다. 칩은 앵커보다 위에
   * 서므로 도식만 감싼 프레임으로는 맨 뒷줄 자원의 칩이 잘리는데, 그렇다고
   * 핀일 때만 넓히면 텍스트·가리기로 바꾸는 순간 캔버스가 52px 줄면서 도식이
   * 그만큼 위로 뛴다. 보던 자리가 어긋나는 것이 여백이 조금 남는 것보다 나쁘다.
   */
  const box = useMemo(
    () => padViewBoxForLabels(frame ?? scene.viewBox),
    [frame, scene.viewBox],
  );

  /* 배율과 맵 안에서의 이동. 배율은 씬이 아니라 이 뷰포트에 걸린다. */
  const view = useMapViewport({
    zoom,
    onZoomChange,
    content: { width: box.width, height: box.height },
  });

  /*
   * 끌어서 회전 — WebGL 렌더러와 같은 훅을 쓴다.
   *
   * **Space 를 쥐고 있으면 회전을 끈다.** 같은 pointerdown 이 SVG → 뷰포트 순으로
   * 올라오므로 그냥 두면 회전이 먼저 잡아채 이동이 되지 않는다.
   */
  const drag = useYawDrag<SVGSVGElement>(
    yawDeg,
    onYawChange,
    rotatable && !view.spaceHeld,
  );

  /*
   * 프레임 크기나 보기 방식이 바뀌면 가운데로 되돌린다. 배율 변경은 보던 지점을
   * 유지해야 하므로 여기서 건드리지 않는다 — 훅 안의 앵커 보정이 맡는다.
   */
  useLayoutEffect(() => {
    view.center();
  }, [box.width, box.height, viewMode, view.center]);

  /** 바깥 판(맨 뒤)과 안쪽 판을 나눠 구획 선을 그 사이에 깐다. */
  const outerSlabs = useMemo(() => scene.slabs.slice(0, 1), [scene.slabs]);
  const innerSlabs = useMemo(() => scene.slabs.slice(1), [scene.slabs]);

  /**
   * painter's algorithm — 뒤(깊이가 작은 쪽)부터 그린다.
   * 깊이가 같은 노드는 id 로 갈라 순서를 결정적으로 만든다. 회전 각도에 따라
   * 깊이가 부동소수점 수준에서만 다를 수 있어, 보조 키가 없으면 같은 화면에서
   * 순서가 흔들린다.
   */
  const sortedNodes = useMemo(
    () =>
      [...scene.nodes].sort(
        (a, b) =>
          a.faces.depthKey - b.faces.depthKey || a.id.localeCompare(b.id),
      ),
    [scene.nodes],
  );

  const relatedIdSet = useMemo<Set<string> | null>(() => {
    if (!hoveredId) return null;
    const node = scene.nodes.find((item) => item.id === hoveredId);
    if (!node) return null;
    return new Set([node.id, ...node.relatedIds]);
  }, [hoveredId, scene.nodes]);

  /* ────────────────────────── 콜아웃 핀 ──────────────────────────
     이름을 박스 평면에서 떼어 내 지지대 끝 칩에 담는다. 배치 계산은 장면
     계층(`scene/pins.ts`)이 하고 여기서는 그리기만 한다. */

  /**
   * 핀 배치.
   *
   * `box` 를 넘기는 것은 가장자리 자원의 긴 이름이 캔버스 밖으로 잘리지 않게
   * 하기 위해서다. 각도가 바뀌면 앵커가 움직이므로 회전 중에도 다시 계산되는데,
   * 노드 수만큼의 사각형 겹침 검사라 씬 재계산에 묻힌다.
   */
  const pins = useMemo(
    () => (effectiveLabelMode === "pin" ? buildIsoPins(scene.nodes, box) : []),
    [effectiveLabelMode, scene.nodes, box],
  );

  const nodeById = useMemo(
    () => new Map(scene.nodes.map((node) => [node.id, node])),
    [scene.nodes],
  );

  /*
   * 펼친 핀은 **한 번에 하나만** 둔다. 여러 장이 동시에 떠 있으면 카드끼리
   * 겹쳐 도식을 덮고, 어느 것을 닫아야 할지도 매번 판단해야 한다.
   */
  const [openPinId, setOpenPinId] = useState<string | null>(null);
  const closePin = useCallback(() => setOpenPinId(null), []);

  /**
   * 지금 화면에 **실제로 보이는 범위** — SVG 좌표.
   *
   * 카드를 프레임 안으로만 밀어 넣는 것으로는 모자라다. 배율이 맞춤보다 크면
   * SVG 가 뷰포트보다 커서, 프레임 안이어도 스크롤 밖이면 잘려 보인다. 펼친
   * 카드는 통째로 보여야 뜻이 있으므로 보이는 창을 기준으로 앉힌다.
   *
   * 스크롤 값만으로 계산하지 않고 두 사각형을 실측하는 이유는, SVG 가 뷰포트보다
   * 작을 때는 스크롤이 0 인 채 `margin: auto` 가 가운데로 밀어 두기 때문이다.
   */
  const [visibleBox, setVisibleBox] = useState<IsoViewBox | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /** 뷰포트 훅과 핀 계산이 같은 엘리먼트를 봐야 한다. */
  const setSvgEl = useCallback(
    (element: SVGSVGElement | null) => {
      svgRef.current = element;
      view.setContentEl(element);
    },
    [view.setContentEl],
  );

  const measureVisibleBox = useCallback(() => {
    const viewport = view.viewportRef.current;
    const svg = svgRef.current;
    if (!viewport || !svg) {
      setVisibleBox(null);
      return;
    }

    const svgRect = svg.getBoundingClientRect();
    const scale = svgRect.width / box.width;
    if (!scale) {
      setVisibleBox(null);
      return;
    }

    const viewRect = viewport.getBoundingClientRect();
    setVisibleBox({
      minX: box.minX + (viewRect.left - svgRect.left) / scale,
      minY: box.minY + (viewRect.top - svgRect.top) / scale,
      width: viewRect.width / scale,
      height: viewRect.height / scale,
    });
  }, [box, view.viewportRef]);

  /** 창이 달라지는 계기 — 스크롤은 뷰포트의 `onScroll` 이 맡는다. */
  useLayoutEffect(() => {
    measureVisibleBox();
  }, [measureVisibleBox, zoom, yawDeg, openPinId]);

  useEffect(() => {
    const onResize = () => measureVisibleBox();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureVisibleBox]);

  /*
   * 도식 자체가 달라지면 닫는다. 표시 방식을 바꾸면 핀이 사라지고, 3D/2D 를
   * 바꾸면 배치가 통째로 달라져 카드가 엉뚱한 자리에 남는다. 회전과 배율은
   * 앵커만 따라 움직이므로 열어 둔 채로 둔다.
   */
  useEffect(() => {
    closePin();
  }, [labelMode, viewMode, closePin]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePin();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePin]);

  const openCard = useMemo<IsoPinCard | null>(() => {
    if (effectiveLabelMode !== "pin" || !openPinId) return null;
    const node = nodeById.get(openPinId);
    if (!node?.details?.length) return null;

    return buildIsoPinCard(
      node,
      { zoom, view: visibleBox ?? box },
      clickable ? "상세 화면 열기" : null,
    );
  }, [effectiveLabelMode, openPinId, nodeById, zoom, visibleBox, box, clickable]);

  /**
   * 핀 클릭 — 펼치거나 접는다.
   *
   * 곧바로 상세 화면으로 보내지 않는 이유는 **선택지가 늘었기** 때문이다. 이름만
   * 보고 다른 화면으로 건너뛰는 것보다, 그 자리에서 몇 줄 더 확인하고 필요할 때만
   * 건너가는 편이 맞다. 자원 박스를 누르면 여전히 바로 상세로 간다.
   */
  const togglePin = (pin: IsoPin) => {
    // 돌리려던 드래그가 펼치기로 오해되지 않게 삼킨다
    if (drag.movedRef.current) return;
    const node = nodeById.get(pin.id);
    if (!node) return;
    if (!node.details?.length) {
      onNodeClick?.(node);
      return;
    }
    setOpenPinId((current) => (current === pin.id ? null : pin.id));
  };

  const openCardDetail = () => {
    const node = openPinId ? nodeById.get(openPinId) : null;
    if (!node) return;
    setOpenPinId(null);
    onNodeClick?.(node);
  };

  const isNodeActive = (id: string) => relatedIdSet?.has(id) ?? false;
  const isNodeDimmed = (id: string) => !!relatedIdSet && !relatedIdSet.has(id);

  const isEdgeActive = (edge: IsoEdge) =>
    !!relatedIdSet &&
    relatedIdSet.has(edge.sourceId) &&
    relatedIdSet.has(edge.targetId);

  const isEdgeDimmed = (edge: IsoEdge) => !!relatedIdSet && !isEdgeActive(edge);

  const cx = (...names: (string | false | undefined)[]) =>
    names.filter(Boolean).join(" ");

  /** 박스 3면. 평면도에서는 측면이 면적 0 으로 붕괴하므로 건너뛴다. */
  const renderFaces = (faces: IsoNode["faces"]) => (
    <>
      {faces.left && (
        <>
          <path d={faces.left} className={cx(styles.face, styles.faceLeft)} />
          <path d={faces.right} className={cx(styles.face, styles.faceRight)} />
        </>
      )}
      <path d={faces.top} className={cx(styles.face, styles.faceTop)} />
      {faces.left && (
        <>
          <path d={faces.left} className={cx(styles.shade, styles.shadeLeft)} />
          <path d={faces.right} className={cx(styles.shade, styles.shadeRight)} />
        </>
      )}
    </>
  );

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.title}>{title}</span>
          {scene.summary && <span className={styles.summary}>{scene.summary}</span>}
        </div>

        <div className={styles.controls}>
          <div className={styles.group} role="group" aria-label="보기 방식">
            {VIEW_MODE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={cx(
                  styles.toggle,
                  viewMode === option.key && styles.toggleActive,
                )}
                aria-pressed={viewMode === option.key}
                onClick={() => onViewModeChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.group} role="group" aria-label="이름 표시 방식">
            {labelModeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={cx(
                  styles.toggle,
                  effectiveLabelMode === option.key && styles.toggleActive,
                )}
                aria-pressed={effectiveLabelMode === option.key}
                onClick={() => setLabelMode(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.group}>
            <button
              type="button"
              className={cx(styles.toggle, showGrid && styles.toggleActive)}
              aria-pressed={showGrid}
              onClick={() => onShowGridChange(!showGrid)}
            >
              격자
            </button>
          </div>

          {onRendererModeChange && viewMode === "isometric" && (
            <div className={styles.group} role="group" aria-label="렌더러">
              {(["svg", "webgl"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cx(
                    styles.toggle,
                    rendererMode === mode && styles.toggleActive,
                  )}
                  aria-pressed={rendererMode === mode}
                  onClick={() => onRendererModeChange(mode)}
                >
                  {mode === "svg" ? "SVG" : "WebGL"}
                </button>
              ))}
            </div>
          )}

          {rotatable && (
            <div className={styles.group}>
              <label className={styles.rotateLabel} htmlFor="iso-yaw">
                시점
              </label>
              {/*
                감기는 단계 버튼. **각도는 순환하는 값이라 선형 슬라이더로는 양 끝을
                이을 수 없다** — `<input type="range">` 가 값을 min/max 로 잘라내
                0° 에서 왼쪽으로 밀어도 359° 로 넘어가지 않는다. 정규화가 음수를
                반대쪽으로 이어주므로 이 버튼은 그 경계를 지난다.
              */}
              <button
                type="button"
                className={styles.rotateStep}
                aria-label={`반시계 방향으로 ${ROTATE_STEP_DEG}도 회전`}
                onClick={() =>
                  onYawChange?.(normalizeDeg((yawDeg ?? 0) - ROTATE_STEP_DEG))
                }
              >
                &#8634;
              </button>
              <input
                id="iso-yaw"
                type="range"
                className={styles.rotateRange}
                min={0}
                max={359}
                step={1}
                value={normalizeDeg(yawDeg ?? 0)}
                aria-valuetext={`${normalizeDeg(yawDeg ?? 0)}도`}
                onChange={(event) => onYawChange?.(Number(event.target.value))}
              />
              <button
                type="button"
                className={styles.rotateStep}
                aria-label={`시계 방향으로 ${ROTATE_STEP_DEG}도 회전`}
                onClick={() =>
                  onYawChange?.(normalizeDeg((yawDeg ?? 0) + ROTATE_STEP_DEG))
                }
              >
                &#8635;
              </button>
              <button
                type="button"
                className={styles.toggle}
                onClick={() => onYawChange?.(ISO_DEFAULT_YAW_DEG)}
                disabled={normalizeDeg(yawDeg ?? 0) === ISO_DEFAULT_YAW_DEG}
              >
                기본 시점
              </button>
            </div>
          )}

          {/*
            배율은 Figma 관례를 따른다 — `[−] 값 [+]` 에 값은 좌우로 끌어 연속
            조절하고, 끌지 않고 누르면 100% 로 돌아온다. 정지 배율 몇 개를 버튼으로
            고르던 방식은 10%~400% 범위를 감당하지 못한다.
          */}
          <div className={styles.group}>
            <div className={styles.zoom} role="group" aria-label="배율">
              <button
                type="button"
                className={styles.zoomStep}
                aria-label="축소"
                disabled={zoom <= view.zoomMin}
                onClick={() => view.stepZoom(-1)}
              >
                &minus;
              </button>
              <button
                type="button"
                className={cx(
                  styles.zoomValue,
                  view.scrubbing && styles.zoomValueActive,
                )}
                role="slider"
                aria-label="배율"
                aria-valuenow={Math.round(zoom * 100)}
                aria-valuemin={Math.round(view.zoomMin * 100)}
                aria-valuemax={Math.round(view.zoomMax * 100)}
                aria-valuetext={`${Math.round(zoom * 100)}%`}
                data-zoom-value
                onPointerDown={view.startScrub}
                onKeyDown={view.onValueKeyDown}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className={styles.zoomStep}
                aria-label="확대"
                disabled={zoom >= view.zoomMax}
                onClick={() => view.stepZoom(1)}
              >
                +
              </button>
            </div>
            {/* 스크롤바가 없으므로 큰 맵은 이 버튼 없이 한눈에 볼 방법이 없다. */}
            <button type="button" className={styles.toggle} onClick={view.fit}>
              맞춤
            </button>
          </div>
        </div>
      </header>

      {/*
        도식이 놓이는 뷰포트. 스크롤바를 두지 않고(`overflow: hidden`) 바깥은
        Space + 드래그·Space + 휠·맞춤 버튼으로 본다.
      */}
      <div
        ref={view.viewportRef}
        className={cx(
          styles.canvas,
          view.spaceHeld && styles.canvasPannable,
          view.panning && styles.canvasPanning,
        )}
        style={
          canvasHeight
            ? ({ "--iso-map-canvas-height": `${canvasHeight}px` } as CSSProperties)
            : undefined
        }
        title="Space + 드래그로 이동, Space + 휠로 확대·축소"
        onScroll={measureVisibleBox}
        onPointerEnter={view.onPointerEnter}
        onPointerLeave={view.onPointerLeave}
        onPointerDown={(event) => {
          if (view.spaceHeld) view.startPan(event);
        }}
      >
        {scene.nodes.length === 0 ? (
          <div className={styles.placeholder}>{emptyMessage}</div>
        ) : webglCanvas ? (
          /*
            WebGL 판도 같은 뷰포트 안에 놓는다. Space 를 쥐는 동안에는 포인터를
            먹지 않게 해 이동이 회전보다 먼저 잡히도록 한다 — SVG 판에서 회전 훅을
            끄는 것과 같은 일이다.
          */
          <div
            ref={view.setContentEl}
            className={cx(styles.webglHost, view.spaceHeld && styles.inert)}
          >
            {webglCanvas}
          </div>
        ) : (
          <svg
            ref={setSvgEl}
            width={box.width * zoom}
            height={box.height * zoom}
            viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
            className={cx(
              styles.svg,
              rotatable && styles.svgRotatable,
              drag.dragging && styles.svgDragging,
            )}
            role="img"
            aria-label={title}
            onMouseLeave={() => setHoveredId(null)}
            onClick={closePin}
            {...drag.handlers}
          >
            {/* 배경 격자는 맨 뒤다 — 바닥판 위에서는 판에 가려지고 그 바깥에서만
                보여, 도식이 모눈종이 위에 놓인 것처럼 읽힌다. */}
            {showGrid && (
              <g className={styles.floorGrid} aria-hidden="true">
                {scene.floorGrid.map((line) => (
                  <path key={line} d={line} />
                ))}
              </g>
            )}

            {/*
              바닥 페인트 순서: 바깥 판 → 바닥 구획 → 안쪽 판.
              구획은 두께 없는 선이라 위에 올라오는 것에 가려져야 한다.
            */}
            <g>
              {outerSlabs.map((slab) => (
                <g key={slab.id} className={styles[`tone-${slab.tone}`]}>
                  {renderFaces(slab.faces)}
                </g>
              ))}
            </g>

            <g>
              {scene.zones.map((zone) => (
                <path
                  key={zone.id}
                  d={zone.floor}
                  className={cx(
                    styles.zone,
                    styles[`tone-${zone.tone}`],
                    zone.dashed && styles.zoneDashed,
                    zone.outer && styles.zoneOuter,
                  )}
                />
              ))}
            </g>

            <g>
              {innerSlabs.map((slab) => (
                <g key={slab.id} className={styles[`tone-${slab.tone}`]}>
                  {renderFaces(slab.faces)}
                </g>
              ))}
            </g>

            <g>
              {scene.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.path}
                  className={cx(
                    styles.edge,
                    edge.dashed && styles.edgeDashed,
                    isEdgeActive(edge) && styles.edgeActive,
                    isEdgeDimmed(edge) && styles.edgeDimmed,
                  )}
                />
              ))}
            </g>

            <g>
              {sortedNodes.map((node) => (
                <g
                  key={node.id}
                  className={cx(
                    styles.node,
                    styles[`tone-${node.tone}`],
                    isNodeActive(node.id) && styles.nodeActive,
                    isNodeDimmed(node.id) && styles.nodeDimmed,
                    clickable && styles.nodeClickable,
                  )}
                  data-node-id={node.id}
                  role={clickable ? "button" : "group"}
                  tabIndex={0}
                  aria-label={`${node.kindLabel ?? ""} ${node.name}`.trim()}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onFocus={() => setHoveredId(node.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => {
                    // 돌리려던 드래그가 상세 열기로 오해되지 않게 삼킨다
                    if (drag.movedRef.current) return;
                    onNodeClick?.(node);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onNodeClick?.(node);
                  }}
                >
                  {/* 자식을 여럿 두면 SSR 이 텍스트 사이에 분리 주석을 넣는데,
                      SVG <title> 은 내용을 순수 텍스트로 파싱해 그 주석을 담을 수
                      없어 하이드레이션이 어긋난다. 문자열 하나로 합쳐 넘긴다. */}
                  <title>
                    {node.subLabel ? `${node.name} · ${node.subLabel}` : node.name}
                  </title>

                  {renderFaces(node.faces)}

                  {/* 이름을 박스에 직접 얹는 것은 `text` 모드뿐이다. 핀 모드는
                      아래 핀 층이, 가리기는 아무것도 그리지 않는다. */}
                  {effectiveLabelMode === "text" && (
                    <>
                      <text
                        x={node.faces.topCenter.x}
                        y={node.faces.topCenter.y - 2}
                        className={styles.nodeLabel}
                        textAnchor="middle"
                      >
                        {truncateLabel(node.name)}
                      </text>
                      {node.subLabel && (
                        <text
                          x={node.faces.topCenter.x}
                          y={node.faces.topCenter.y + 11}
                          className={styles.nodeSubLabel}
                          textAnchor="middle"
                        >
                          {truncateLabel(node.subLabel)}
                        </text>
                      )}
                    </>
                  )}
                </g>
              ))}
            </g>

            {/* 판 라벨은 박스보다 위에 그려야 가려지지 않는다 */}
            <g>
              {scene.slabs.map((slab) =>
                slab.labelAnchor ? (
                  <text
                    key={`${slab.id}-label`}
                    x={slab.labelAnchor.x}
                    y={slab.labelAnchor.y}
                    textAnchor={slab.labelAnchor.textAnchor}
                    transform={slab.labelAnchor.transform || undefined}
                    className={styles.slabLabel}
                  >
                    {slab.label}
                  </text>
                ) : null,
              )}
            </g>

            {/*
              구획 이름: 바닥 평면에 새겨진 것처럼 눕는다.
              안쪽 구획은 경계 레일 위 불투명 탭에 얹혀 박스에 가리지 않는다.
            */}
            <g>
              {scene.zones.map((zone) => (
                <g
                  key={`${zone.id}-label`}
                  className={cx(
                    styles[`tone-${zone.tone}`],
                    zone.outer && styles.zoneLabelOuter,
                  )}
                >
                  {zone.labelPlate && (
                    <rect
                      x={zone.labelPlate.x}
                      y={zone.labelPlate.y}
                      width={zone.labelPlate.width}
                      height={zone.labelPlate.height}
                      transform={zone.labelAnchor.transform || undefined}
                      rx="3"
                      className={styles.zonePlate}
                    />
                  )}
                  <text
                    x={zone.labelAnchor.x}
                    y={zone.labelAnchor.y}
                    textAnchor={zone.labelAnchor.textAnchor}
                    transform={zone.labelAnchor.transform || undefined}
                    className={styles.zoneLabel}
                  >
                    {zone.label}
                  </text>
                </g>
              ))}
            </g>

            {/*
              콜아웃 핀.

              박스 위에 글자를 얹는 대신 지지대로 들어 올려 화면 수평 칩에 담는다.
              박스 크기가 이름 길이를 떠안지 않게 되고, 마름모 윗면 위에서 글자가
              한쪽으로 쏠려 보이던 것도 사라진다.

              핀 층은 **맨 마지막**에 그린다. 칩이 불투명해야 읽히는데 앞줄 박스보다
              먼저 그리면 그 박스에 가려지기 때문이다.
            */}
            {pins.length > 0 && (
              <g>
                {pins.map((pin) =>
                  pin.id === openPinId ? null : (
                    <g
                      key={`${pin.id}-pin`}
                      className={cx(
                        styles.pin,
                        styles[`tone-${pin.tone}`],
                        isNodeActive(pin.id) && styles.pinActive,
                        isNodeDimmed(pin.id) && styles.pinDimmed,
                      )}
                      onClick={(event) => {
                        // 빈 바닥 클릭으로 닫는 처리가 SVG 에 있으므로 멈춘다
                        event.stopPropagation();
                        togglePin(pin);
                      }}
                      onMouseEnter={() => setHoveredId(pin.id)}
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
                      />
                      <circle
                        cx={pin.anchor.x}
                        cy={pin.anchor.y}
                        r="2.75"
                        className={styles.pinDot}
                      />
                      <rect
                        x={pin.chip.x}
                        y={pin.chip.y}
                        width={pin.chip.width}
                        height={pin.chip.height}
                        rx="4"
                        className={styles.pinChip}
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
                  ),
                )}
              </g>
            )}

            {/*
              펼친 핀 — 상세 카드.

              핀 층보다 뒤에 둬서 다른 칩 위에 얹힌다. 그룹에 걸린 변환이
              `scale(1/배율)` 이라 카드는 배율과 무관하게 같은 크기로 보인다.
              카드 안을 누른 것이 SVG 까지 올라가면 곧바로 닫히므로 멈춘다.
            */}
            {openCard && (
              <g
                className={styles[`tone-${openCard.tone}`]}
                transform={openCard.transform}
                onClick={(event) => event.stopPropagation()}
              >
                <line
                  x1="0"
                  y1="0"
                  x2={openCard.tip.x}
                  y2={openCard.tip.y}
                  className={styles.pinStem}
                />
                <circle cx="0" cy="0" r="2.75" className={styles.pinDot} />

                <rect
                  x={openCard.x}
                  y={openCard.y}
                  width={openCard.width}
                  height={openCard.height}
                  rx="6"
                  className={styles.pinCard}
                />

                <text
                  x={openCard.x + 14}
                  y={openCard.kindY}
                  className={styles.pinCardKind}
                >
                  {openCard.kindLabel}
                </text>
                <text
                  x={openCard.x + 14}
                  y={openCard.nameY}
                  className={styles.pinCardName}
                >
                  {fitTextToWidth(
                    openCard.name,
                    CARD_FONT.name,
                    openCard.titleMaxWidth,
                  )}
                </text>

                <line
                  x1={openCard.x + 10}
                  y1={openCard.headRuleY}
                  x2={openCard.x + openCard.width - 10}
                  y2={openCard.headRuleY}
                  className={styles.pinCardRule}
                />

                {openCard.rows.map((row) => (
                  <g key={row.label}>
                    <text
                      x={openCard.labelX}
                      y={row.y}
                      className={styles.pinCardLabel}
                    >
                      {fitTextToWidth(
                        row.label,
                        CARD_FONT.label,
                        openCard.labelMaxWidth,
                      )}
                    </text>
                    <text
                      x={openCard.valueX}
                      y={row.y}
                      textAnchor="end"
                      className={styles.pinCardValue}
                    >
                      {fitTextToWidth(
                        row.value,
                        CARD_FONT.value,
                        openCard.valueMaxWidth,
                      )}
                    </text>
                  </g>
                ))}

                {openCard.action && (
                  <>
                    <line
                      x1={openCard.x + 10}
                      y1={openCard.action.ruleY}
                      x2={openCard.x + openCard.width - 10}
                      y2={openCard.action.ruleY}
                      className={styles.pinCardRule}
                    />
                    {/* 투명한 판을 글자 위에 덮어 줄 전체를 누를 수 있게 한다.
                        글자만 대상으로 두면 자간 사이가 구멍이 나 눌러도 반응이
                        없는 자리가 생긴다. */}
                    <g className={styles.pinCardAction} onClick={openCardDetail}>
                      <rect
                        x={openCard.x + 4}
                        y={openCard.action.ruleY + 2}
                        width={openCard.width - 8}
                        height={26}
                        rx="4"
                        className={styles.pinCardHit}
                      />
                      <text x={openCard.x + 14} y={openCard.action.y}>
                        {openCard.action.label}
                      </text>
                      <text
                        x={openCard.x + openCard.width - 14}
                        y={openCard.action.y}
                        textAnchor="end"
                      >
                        &#8599;
                      </text>
                    </g>
                  </>
                )}

                <g className={styles.pinCardClose} onClick={closePin}>
                  <title>닫기</title>
                  <circle
                    cx={openCard.close.x}
                    cy={openCard.close.y}
                    r="10"
                    className={styles.pinCardHit}
                  />
                  <text
                    x={openCard.close.x}
                    y={openCard.close.y + 5}
                    textAnchor="middle"
                  >
                    &#215;
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}
      </div>

      {/*
        조작 안내.

        드래그와 수정 키는 **화면에 흔적이 남지 않는 조작**이라, 안내가 없으면
        회전과 이동은 존재 자체를 모른 채 지나간다. 캔버스의 `title` 툴팁만으로는
        부족하다 — 툴팁은 이미 "끌어도 되는지" 궁금해 커서를 올려 본 사람에게만
        뜬다. 회전은 3D 에서만 뜻이 있으므로 2D 에서는 뺀다. 못 하는 조작을 적어
        두면 안내가 아니라 오해가 된다.
      */}
      <footer className={styles.footer}>
        {scene.legend.length > 0 && (
          <div className={styles.legend}>
            {scene.legend.map((item) => (
              <span key={item.id} className={styles.legendItem}>
                <i
                  className={cx(styles.legendSwatch, styles[`tone-${item.tone}`])}
                  aria-hidden="true"
                />
                {item.label}
              </span>
            ))}
          </div>
        )}

        <div className={styles.hint}>
          {[
            { label: "확대·축소", keys: ["Space", "휠"] },
            { label: "맵 안에서 이동", keys: ["Space", "드래그"] },
            ...(rotatable ? [{ label: "회전", keys: ["드래그"] }] : []),
          ].map((item) => (
            <span key={item.label} className={styles.hintItem}>
              <b>{item.label}</b>
              <span className={styles.hintKeys}>
                {item.keys.map((key, index) => (
                  <span key={key} className={styles.hintKey}>
                    {index > 0 && <span aria-hidden="true">+</span>}
                    <kbd className={styles.key}>{key}</kbd>
                  </span>
                ))}
              </span>
            </span>
          ))}
        </div>
      </footer>
    </section>
  );
}
