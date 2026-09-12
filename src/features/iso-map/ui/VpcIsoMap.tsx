"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { IsoNode, IsoViewMode } from "../scene/types";
import type { IsoVpcSource } from "../vpc/sourceTypes";
import { ISO_DEFAULT_YAW_DEG } from "../scene/projection";
import { buildIsoVpcLayout } from "../vpc/buildVpcLayout";
import { IsoMap } from "./IsoMap";

/**
 * WebGL 렌더러는 **지연 로드**한다. three 코어만 gzip 약 150KB 로, 이 프로젝트의
 * 나머지 전부보다 무겁다. 토글을 누르기 전까지는 내려받지 않으므로 SVG 판으로
 * 들어오는 방문자는 값을 치르지 않는다. `ssr: false` 인 이유는 WebGL 컨텍스트가
 * 브라우저에만 있기 때문이다 — 정적 내보내기에는 영향이 없다.
 */
const IsoMapThree = dynamic(
  () => import("./three/IsoMapThree").then((module) => module.IsoMapThree),
  { ssr: false, loading: () => <p className="sr">WebGL 렌더러 불러오는 중</p> },
);

/**
 * VPC 자원 맵을 아이소메트릭 렌더러에 물리는 어댑터 래퍼.
 *
 * 렌더러(`IsoMap`)는 도메인을 모르므로, 응답을 씬으로 바꾸는 일과 노드 클릭을
 * 도메인 동작으로 옮기는 일은 여기서 한다. 경계를 이 파일 하나로 좁혀 두면
 * 다른 자원 관계도가 필요해질 때 이 래퍼만 새로 쓰면 된다.
 */
type Props = {
  source: IsoVpcSource | null;
  title?: string;
  /** 처음 배율. 메인 페이지 미리보기는 조금 작게 시작한다. */
  initialZoom?: number;
  /** 뷰포트 높이(px). 미리보기는 낮게, 데모 페이지는 넉넉하게 잡는다. */
  canvasHeight?: number;
  onNodeClick?: (node: IsoNode) => void;
};

const BASE_UNIT = 34;
const BASE_HEIGHT_UNIT = 44;

/**
 * 2D 에서 gy 축 압축 비율. 아이소메트릭이 gy 를 sin30(0.5)으로 압축하므로
 * 같은 그리드를 평면에 그대로 펼치면 행 간격이 과해진다. 0.72 는 라벨 두 줄이
 * 들어가는 박스 높이(약 37px)를 확보하는 최소치에 가깝다.
 */
const FLAT_DEPTH_SCALE = 0.72;

/**
 * 고정 프레임을 구할 때 훑는 각도. 회전하면 콘텐츠의 화면 크기가 최대 ±17%
 * 변하는데, 매 각도의 viewBox 를 그대로 쓰면 드래그하는 동안 캔버스가 출렁인다.
 * 30° 간격이면 그 사이 각도의 크기가 표본 사이를 벗어나지 않는다.
 */
const FRAME_SAMPLE_STEP_DEG = 30;

export function VpcIsoMap({
  source,
  title,
  initialZoom = 1,
  canvasHeight,
  onNodeClick,
}: Props) {
  const [viewMode, setViewMode] = useState<IsoViewMode>("isometric");
  const [zoom, setZoom] = useState(initialZoom);
  const [yawDeg, setYawDeg] = useState(ISO_DEFAULT_YAW_DEG);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<"svg" | "webgl">("svg");
  const [showGrid, setShowGrid] = useState(false);

  /** 평면도에는 시점이 없으므로 WebGL 은 3D 에서만 쓴다. */
  const webgl = rendererMode === "webgl" && viewMode === "isometric";

  /**
   * **배율은 여기 없다.** 예전에는 `unit` 에 배율을 곱했는데, 글자 크기는 CSS 로
   * 고정돼 함께 줄지 않으므로 라벨에서 역산하는 노드 폭이 배율마다 달라졌다 —
   * 박스는 픽셀 폭을 유지하고 여백만 줄어, 배율을 바꿀 때마다 도식의 비례가
   * 어긋났다. 배율은 렌더러가 뷰포트에 건다(`width`/`height` 에만 곱한다).
   */
  const projection = useMemo(
    () => ({
      mode: viewMode,
      unit: BASE_UNIT,
      heightUnit: BASE_HEIGHT_UNIT,
      flatDepthScale: FLAT_DEPTH_SCALE,
    }),
    [viewMode],
  );

  const scene = useMemo(
    () => buildIsoVpcLayout(source, { ...projection, yawDeg }),
    [source, projection, yawDeg],
  );

  /*
   * 투영 전 장면은 배율·모드·시야각과 무관하다 — 그리드 좌표뿐이기 때문이다.
   * 그래서 한 번만 만들어 WebGL 렌더러에 넘긴다. 매번 새 객체를 주면 렌더러가
   * 같은 내용으로 지오메트리와 텍스처를 다시 굽는다.
   */
  const solid = useMemo(
    () =>
      buildIsoVpcLayout(source, {
        mode: "isometric",
        unit: BASE_UNIT,
        heightUnit: BASE_HEIGHT_UNIT,
        flatDepthScale: FLAT_DEPTH_SCALE,
      }).solid,
    [source],
  );

  /*
   * 시점에 무관한 프레임 **크기**.
   *
   * 각도별 viewBox 를 그대로 합집합하면 안 된다 — 회전 중심이 그리드 원점이라
   * 콘텐츠 중심까지 함께 돌기 때문에, 합집합은 도넛을 감싸는 커다란 상자가 되고
   * 콘텐츠는 그 한구석에 놓인다(1762px 까지 부풀었다).
   *
   * 필요한 것은 "어느 각도에서도 콘텐츠가 들어가는 크기" 하나뿐이다. 크기만
   * 각도를 훑어 최대치를 잡고, 위치는 아래에서 현재 콘텐츠 중심에 맞춘다.
   * 배율·모드가 바뀔 때만 다시 계산하므로 드래그 중에는 고정이다.
   */
  const frameSize = useMemo(() => {
    if (viewMode === "flat") return null;

    let width = 0;
    let height = 0;
    for (let deg = 0; deg < 360; deg += FRAME_SAMPLE_STEP_DEG) {
      const box = buildIsoVpcLayout(source, { ...projection, yawDeg: deg }).viewBox;
      width = Math.max(width, box.width);
      height = Math.max(height, box.height);
    }
    return width > 0 && height > 0 ? { width, height } : null;
  }, [source, projection, viewMode]);

  /** 고정 크기 프레임을 현재 콘텐츠 중심에 맞춘다 — 화면에서는 제자리에서 돈다. */
  const frame = useMemo(() => {
    if (!frameSize) return undefined;
    const centerX = scene.viewBox.minX + scene.viewBox.width / 2;
    const centerY = scene.viewBox.minY + scene.viewBox.height / 2;
    return {
      minX: centerX - frameSize.width / 2,
      minY: centerY - frameSize.height / 2,
      width: frameSize.width,
      height: frameSize.height,
    };
  }, [frameSize, scene.viewBox]);

  return (
    <IsoMap
      scene={scene}
      title={title}
      viewMode={viewMode}
      zoom={zoom}
      onViewModeChange={setViewMode}
      onZoomChange={setZoom}
      yawDeg={yawDeg}
      onYawChange={setYawDeg}
      frame={frame}
      hoveredId={hoveredId}
      onHoverChange={setHoveredId}
      rendererMode={rendererMode}
      onRendererModeChange={setRendererMode}
      showGrid={showGrid}
      onShowGridChange={setShowGrid}
      webglCanvas={
        webgl && frame ? (
          <IsoMapThree
            solid={solid}
            frame={frame}
            zoom={zoom}
            unit={projection.unit}
            heightUnit={projection.heightUnit}
            yawDeg={yawDeg}
            onYawChange={setYawDeg}
            showGrid={showGrid}
            hoveredId={hoveredId}
            onHoverChange={setHoveredId}
            onNodeClick={
              onNodeClick
                ? (id) => {
                    const node = scene.nodes.find((item) => item.id === id);
                    if (node) onNodeClick(node);
                  }
                : undefined
            }
          />
        ) : undefined
      }
      canvasHeight={canvasHeight}
      emptyMessage="이 VPC 에 표시할 서브넷·라우팅 테이블이 없습니다."
      clickable={!!onNodeClick}
      onNodeClick={onNodeClick}
    />
  );
}
