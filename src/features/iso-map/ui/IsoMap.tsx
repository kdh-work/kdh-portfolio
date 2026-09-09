"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { ISO_DEFAULT_YAW_DEG } from "../scene/projection";
import type { IsoEdge, IsoNode, IsoScene, IsoViewMode } from "../scene/types";
import { truncateLabel } from "./labels";
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
};

const VIEW_MODE_OPTIONS: { key: IsoViewMode; label: string }[] = [
  { key: "isometric", label: "3D" },
  { key: "flat", label: "2D" },
];

export const ZOOM_LEVELS = [0.7, 0.85, 1, 1.25, 1.5] as const;

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
}: Props) {
  const setHoveredId = onHoverChange;

  /** 3D 에서만 회전한다 — 평면도에는 시점이 없다. */
  const rotatable = viewMode === "isometric" && !!onYawChange;

  /* 끌어서 회전 — WebGL 렌더러와 같은 훅을 쓴다. */
  const drag = useYawDrag<SVGSVGElement>(yawDeg, onYawChange, rotatable);

  /**
   * 실제로 그릴 프레임. 회전 중에는 콘텐츠 크기가 계속 변하므로 고정 프레임을
   * 받아 쓴다. 콘텐츠는 그 안에서 돌기만 한다.
   */
  const box = frame ?? scene.viewBox;

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
              <input
                id="iso-yaw"
                type="range"
                className={styles.rotateRange}
                min={0}
                max={359}
                step={1}
                value={Math.round(yawDeg ?? 0)}
                aria-valuetext={`${Math.round(yawDeg ?? 0)}도`}
                onChange={(event) => onYawChange?.(Number(event.target.value))}
              />
              <button
                type="button"
                className={styles.toggle}
                onClick={() => onYawChange?.(ISO_DEFAULT_YAW_DEG)}
                disabled={Math.round(yawDeg ?? 0) === ISO_DEFAULT_YAW_DEG}
              >
                기본 시점
              </button>
            </div>
          )}

          <div className={styles.group} role="group" aria-label="배율">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className={cx(styles.toggle, zoom === level && styles.toggleActive)}
                aria-pressed={zoom === level}
                onClick={() => onZoomChange(level)}
              >
                {Math.round(level * 100)}%
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.canvas}>
        {scene.nodes.length === 0 ? (
          <div className={styles.placeholder}>{emptyMessage}</div>
        ) : webglCanvas ? (
          webglCanvas
        ) : (
          <svg
            width={box.width}
            height={box.height}
            viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
            className={cx(
              styles.svg,
              rotatable && styles.svgRotatable,
              drag.dragging && styles.svgDragging,
            )}
            role="img"
            aria-label={title}
            onMouseLeave={() => setHoveredId(null)}
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
          </svg>
        )}
      </div>

      {rotatable && (
        <p className={styles.hint}>
          도식을 끌어 시점을 돌릴 수 있습니다. 슬라이더에 초점을 두면 방향키로도
          움직입니다.
        </p>
      )}

      {scene.legend.length > 0 && (
        <footer className={styles.legend}>
          {scene.legend.map((item) => (
            <span key={item.id} className={styles.legendItem}>
              <i
                className={cx(styles.legendSwatch, styles[`tone-${item.tone}`])}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </footer>
      )}
    </section>
  );
}
