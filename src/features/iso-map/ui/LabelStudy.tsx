import {
  buildBoxFaces,
  buildFloorQuad,
  floorTextTransform,
} from "../scene/projection";
import type {
  IsoBox,
  IsoProjectionConfig,
  IsoScreenPoint,
} from "../scene/types";
import { labelStudy } from "@/content/isoMap";
import styles from "./LabelStudy.module.css";

/**
 * 구획 라벨을 어디에 둘 것인가 — 검토한 배치안.
 *
 * 도식을 이미지로 굽지 않고 **관계도가 쓰는 것과 같은 투영 함수**로 그린다.
 * 투영이나 그리드 상수를 고치면 이 검토 도식도 함께 움직이므로, 설명과 화면이
 * 어긋날 수 없다.
 */

/* 관계도와 같은 배율·치수를 쓴다. 검토 도식이 실제와 다른 조건이면 비교가 무의미하다. */
const config: IsoProjectionConfig = {
  mode: "isometric",
  unit: 34,
  heightUnit: 44,
  flatDepthScale: 0.72,
};

/** 관계도의 가용영역 구획과 같은 치수 (nodeWidth 2.4 · zonePad 0.8 · 서브넷 2개) */
const ZONE = { gx: 0, gy: 0, width: 4, depth: 4.7, z: 0.3 };
const NODES: IsoBox[] = [
  { gx: 0.8, gy: 0.8, width: 2.4, depth: 1.5, z: 0.3, height: 0.6 },
  { gx: 0.8, gy: 2.9, width: 2.4, depth: 1.5, z: 0.3, height: 0.6 },
];
const SLAB = { gx: -0.9, gy: -0.9, width: 5.8, depth: 6.5, z: 0 };

const CORNER_RADIUS = 10;
const FONT = 11;
const PAD = { x: 8, y: 5 };
/** 이름 양옆으로 레일을 더 비우는 여백 — 어댑터의 `LABEL_GAP_PAD` 와 같다. */
const GAP_PAD = 6;
const LABEL = "ap-northeast-2a";

/** 어댑터와 같은 폭 근사 (전각은 글자 크기, 라틴은 0.58 배) */
const textWidth = [...LABEL].reduce(
  (width, char) =>
    width + ((char.codePointAt(0) ?? 0) > 0x1100 ? FONT : FONT * 0.58),
  0,
);
const TEXT_W = textWidth;
const PLATE_W = textWidth + PAD.x * 2;
const PLATE_H = FONT + PAD.y * 2;

/** +gx 화면 방향 단위벡터 (아이소메트릭에서 (cos30, sin30)) */
const GX_DIR = { x: Math.cos(Math.PI / 6), y: 0.5 };

const round = (value: number) => Math.round(value * 100) / 100;

type Quad = ReturnType<typeof buildFloorQuad>;

/** 구획 왼쪽 꼭짓점에서 아래 변(+gx)을 따라 이동한 점 */
const along = (quad: Quad, distance: number): IsoScreenPoint => ({
  x: quad.left.x + GX_DIR.x * distance,
  y: quad.left.y + GX_DIR.y * distance,
});

type Placement = {
  /** 명판 왼쪽 위 (변환 전 로컬 좌표) */
  plate: { x: number; y: number } | null;
  /** 글자 기준선 */
  at: IsoScreenPoint;
  /** 명판 대신 글자 외곽선으로 레일을 가리는 안 */
  halo?: boolean;
  /** 명판을 계열 색으로 칠할지 (아니면 진한 탭) */
  tinted?: boolean;
};

/* CSS 모듈의 클래스 조회는 `noUncheckedIndexedAccess` 아래에서 undefined 가 섞이므로 좁혀서 넘긴다. */
const labelClass = (placement: Placement): string | undefined => {
  if (placement.halo) return styles.labelHalo;
  // 진한 탭 위에는 흰 글자, 그 밖에는 계열 색 글자
  return placement.plate && !placement.tinted
    ? styles.labelOnSolid
    : styles.label;
};

/** 아래 변의 길이 */
const edgeLength = (quad: Quad) =>
  Math.hypot(quad.front.x - quad.left.x, quad.front.y - quad.left.y);

/** 글자를 변 가운데에 놓을 때 왼쪽 꼭짓점에서 들어가는 거리 */
const centeredInset = (quad: Quad, width: number) =>
  Math.max(0, (edgeLength(quad) - width) / 2);

const placements: Record<string, (quad: Quad) => Placement> = {
  /** 꼭짓점에 왼쪽 끝을 맞춘다 — 곡선 구간에 걸린다 */
  corner: (quad) => ({
    plate: { x: quad.left.x, y: quad.left.y },
    at: { x: quad.left.x + PAD.x, y: quad.left.y + FONT },
  }),

  /** 모서리 라운딩만 없앤 안. 배치는 corner 와 같다. */
  square: (quad) => ({
    plate: { x: quad.left.x, y: quad.left.y },
    at: { x: quad.left.x + PAD.x, y: quad.left.y + FONT },
  }),

  /** 변 가운데에 계열 색 명판 — 이름이 길어지면 판도 같이 길어진다 */
  plate: (quad) => {
    const start = along(quad, centeredInset(quad, PLATE_W));
    const centerY = start.y + Math.max(0, PLATE_H / 2 - 4.5);
    return {
      plate: { x: start.x, y: centerY - PLATE_H / 2 },
      at: { x: start.x + PAD.x, y: centerY + FONT * 0.34 },
      tinted: true,
    };
  },

  /** 글자 외곽선만으로 레일을 가리기 */
  halo: (quad) => {
    const start = along(quad, centeredInset(quad, TEXT_W));
    return {
      plate: null,
      at: { x: start.x, y: start.y + FONT * 0.34 },
      halo: true,
    };
  },

  /** 채택안 — 레일 path 를 이름 자리에서 실제로 끊는다 */
  chosen: (quad) => {
    const start = along(quad, centeredInset(quad, TEXT_W));
    return {
      plate: null,
      at: { x: start.x, y: start.y + FONT * 0.34 },
    };
  },
};

/** 채택안에서 레일을 비울 구간. 어댑터와 같은 계산이다. */
const chosenGap = (quad: Quad) => {
  const length = edgeLength(quad);
  const inset = centeredInset(quad, TEXT_W);
  const from = inset - GAP_PAD;
  const to = inset + TEXT_W + GAP_PAD;
  // 다각형 순회는 front → left 라 거리를 뒤집어 넘긴다
  return { edge: 2, from: length - to, to: length - from };
};

function Stage({ variantId }: { variantId: string }) {
  const radius = variantId === "square" ? 0 : CORNER_RADIUS;
  const outline = buildFloorQuad(ZONE, config, radius);
  // 채택안만 레일에 빈 구간이 있다
  const quad =
    variantId === "chosen"
      ? buildFloorQuad(ZONE, config, radius, chosenGap(outline))
      : outline;
  const slab = buildFloorQuad(SLAB, config, 16);
  const faces = NODES.map((box) => buildBoxFaces(box, config));

  const place = placements[variantId];
  const placement = place ? place(outline) : null;
  const transform = placement
    ? floorTextTransform(placement.at, "gx", config)
    : "";

  /* 크롭. 모든 카드가 같은 프레임을 쓴다 — 프레임이 다르면 배치 차이를 비교할 수 없다.
     아래 변의 가운데를 중심으로, 양쪽 모서리 곡선이 함께 보이는 폭으로 잡는다. */
  const focus = {
    x: (outline.left.x + outline.front.x) / 2,
    y: (outline.left.y + outline.front.y) / 2,
  };
  const width = 205;
  const height = 132;

  return (
    <svg
      className={styles.stage}
      viewBox={`${round(focus.x - width / 2)} ${round(focus.y - height / 2)} ${width} ${height}`}
      role="img"
      aria-label={`${LABEL} 라벨 배치 예시`}
    >
      <path d={slab.path} className={styles.slab} />
      <path d={quad.path} className={styles.rail} />

      {faces.map((face, index) => (
        <g key={index}>
          <path d={face.left} className={styles.side} />
          <path d={face.right} className={styles.side} />
          <path d={face.top} className={styles.top} />
          <path d={face.left} className={styles.shadeLeft} />
          <path d={face.right} className={styles.shadeRight} />
        </g>
      ))}

      {placement && (
        <>
          {placement.plate && (
            <rect
              x={round(placement.plate.x)}
              y={round(placement.plate.y)}
              width={round(PLATE_W)}
              height={round(PLATE_H)}
              rx="2"
              transform={transform || undefined}
              className={placement.tinted ? styles.plateTinted : styles.plate}
            />
          )}
          <text
            x={round(placement.at.x)}
            y={round(placement.at.y)}
            transform={transform || undefined}
            textAnchor="start"
            className={labelClass(placement)}
          >
            {LABEL}
          </text>
        </>
      )}
    </svg>
  );
}

export function LabelStudy() {
  return (
    <div className={styles.root}>
      <p className={styles.lede}>{labelStudy.lede}</p>

      <ol className={styles.grid}>
        {labelStudy.variants.map((variant) => (
          <li
            key={variant.id}
            className={`${styles.card} ${variant.verdict === "chosen" ? styles.cardChosen : ""}`}
          >
            <div className={styles.shot}>
              <Stage variantId={variant.id} />
            </div>
            <h3 className={styles.title}>
              {variant.title}
              {variant.verdict === "chosen" && (
                <span className={styles.badge}>채택</span>
              )}
            </h3>
            <p className={styles.note}>{variant.note}</p>
          </li>
        ))}
      </ol>

      <p className={styles.closing}>{labelStudy.closing}</p>
    </div>
  );
}
