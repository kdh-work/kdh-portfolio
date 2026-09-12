/**
 * 자원 이름을 **콜아웃 핀**으로 띄우는 배치.
 *
 * 이름을 박스 윗면에 직접 얹으면 세 가지가 계속 어긋난다.
 *
 *   1) 박스가 라벨 폭을 떠안는다 — 이름이 길수록 자원 박스를 넓혀야 하고,
 *      그러지 못하면 말줄임이 된다. 자원 크기가 이름 길이를 따라 변하는 셈이다.
 *   2) 윗면은 마름모라 글자를 가운데 두어도 좌우 여백이 비대칭으로 보인다.
 *   3) 회전하면 행 사이 세로 엇갈림이 줄어 라벨끼리 겹친다. 겹침을 피하려고
 *      보조 라벨을 감추고 이름을 좁히는 것은 정보를 버리는 회피다.
 *
 * 핀은 라벨을 박스 평면에서 **떼어 낸다**. 이름은 지지대 끝의 수평 칩에 놓이므로
 * 박스 크기와 무관해지고, 겹칠 때는 정보를 버리는 대신 지지대를 늘려 위로
 * 비켜 세운다.
 *
 * 이 모듈은 화면 좌표(px)만 다룬다 — 그리드도 도메인도 모른다. 렌더러가 이미
 * 투영해 둔 `faces.topCenter` 를 앵커로 받아 그 위에 칩을 쌓을 뿐이다.
 */
import { estimateTextWidth } from "./text";
import type { IsoNode, IsoScreenPoint, IsoTone, IsoViewBox } from "./types";

/** 핀 칩 글자 크기(px). 렌더러의 CSS 와 같아야 한다. */
export const PIN_FONT = { name: 11, sub: 10 } as const;

/** 칩 안쪽 여백(px). */
const CHIP_PAD = { x: 7, y: 4 } as const;
/** 이름 줄과 보조 줄이 차지하는 높이(px). */
const LINE = { name: 13, sub: 11 } as const;
/** 칩 위쪽 모서리에서 이름 베이스라인까지(px). */
const NAME_BASELINE = CHIP_PAD.y + 10;
/** 이름 베이스라인에서 보조 라벨 베이스라인까지(px). */
const SUB_BASELINE_GAP = 11;

/** 기본 지지대 길이(px) — 앵커에서 칩 아래 모서리까지. */
const BASE_STEM = 18;
/** 겹칠 때 지지대를 늘리는 한 단계(px). */
const STEM_STEP = 14;
/**
 * 지지대를 늘리는 최대 단계.
 *
 * 무한정 늘리면 라벨이 도식에서 한참 떨어져 어느 박스의 것인지 눈으로 잇지
 * 못한다. 한계에 닿으면 겹친 채로 두고, 대신 앞(화면 아래) 자원의 칩이 위에
 * 그려지도록 순서를 잡는다.
 */
const MAX_STEM_STEPS = 4;
/** 칩 사이에 남겨 둘 최소 간격(px). */
const CHIP_GAP = 6;

/** 라벨 층을 위해 캔버스에 더 붙이는 여백(px). */
export const LABEL_VIEW_PAD = { top: 52, side: 12 } as const;

export interface IsoPinChip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 렌더러가 그대로 그릴 수 있게 해석된 핀 하나. */
export interface IsoPin {
  /** 가리키는 노드의 id — 강조·클릭을 노드와 공유한다. */
  id: string;
  tone: IsoTone;
  name: string;
  subLabel?: string;
  /** 박스 윗면 중심 — 핀이 꽂히는 점. */
  anchor: IsoScreenPoint;
  /** 지지대 위 끝 = 칩 아래 모서리 중앙. */
  tip: IsoScreenPoint;
  chip: IsoPinChip;
  nameY: number;
  /** 보조 라벨이 없으면 null. */
  subY: number | null;
}

/**
 * 라벨 층까지 담는 캔버스.
 *
 * 칩은 앵커보다 위에 서므로 도식만 감싼 여백으로는 맨 뒷줄 자원의 칩이 잘린다.
 * **회전각에 무관한 상수**로 넓히는 것이 요점이다 — 실제 핀 높이를 재서 맞추면
 * 각도마다 캔버스가 달라져 돌리는 동안 도식이 출렁인다.
 *
 * **이름 표시 방식과 상관없이 항상 적용한다.** 핀일 때만 넓히면 텍스트나 가리기로
 * 바꾸는 순간 캔버스가 52px 줄면서 도식이 그만큼 위로 뛴다. 보던 자리가 어긋나는
 * 것이 여백이 조금 남는 것보다 나쁘므로, 셋 중 가장 넓은 핀 기준에 맞춰 둔다.
 */
export const padViewBoxForLabels = (box: IsoViewBox): IsoViewBox => ({
  minX: box.minX - LABEL_VIEW_PAD.side,
  minY: box.minY - LABEL_VIEW_PAD.top,
  width: box.width + LABEL_VIEW_PAD.side * 2,
  height: box.height + LABEL_VIEW_PAD.top,
});

const chipSize = (
  name: string,
  subLabel?: string,
): { width: number; height: number } => {
  const nameWidth = estimateTextWidth(name, PIN_FONT.name);
  const subWidth = subLabel ? estimateTextWidth(subLabel, PIN_FONT.sub) : 0;

  return {
    width: Math.max(nameWidth, subWidth) + CHIP_PAD.x * 2,
    height: CHIP_PAD.y * 2 + LINE.name + (subLabel ? LINE.sub : 0),
  };
};

const overlaps = (a: IsoPinChip, b: IsoPinChip): boolean =>
  a.x < b.x + b.width + CHIP_GAP &&
  b.x < a.x + a.width + CHIP_GAP &&
  a.y < b.y + b.height + CHIP_GAP &&
  b.y < a.y + a.height + CHIP_GAP;

/**
 * 노드마다 핀을 세운다.
 *
 * 앞(화면 아래)에 있는 자원부터 자리를 잡고, 이미 놓인 칩과 겹치는 핀만 지지대를
 * 한 단계씩 늘린다. 앞에서부터 채우는 이유는 뒤쪽 자원의 라벨이 위로 밀려나는
 * 편이 자연스럽기 때문이다 — 멀리 있는 것의 이름표가 더 높이 뜨는 셈이라 깊이와
 * 어긋나지 않는다. 반대로 채우면 앞줄 라벨이 뒷줄 박스 위로 올라타 가린다.
 *
 * @param viewBox 칩을 가둘 캔버스. 가장자리 자원의 긴 이름이 밖으로 잘리지
 *   않도록 좌우로만 밀어 넣는다. 세로로 밀면 지지대가 꺾여 어느 박스의
 *   라벨인지 읽기 어려워지므로 건드리지 않는다.
 */
export const buildIsoPins = (
  nodes: IsoNode[],
  viewBox: IsoViewBox,
): IsoPin[] => {
  const order = [...nodes].sort(
    (a, b) =>
      b.faces.topCenter.y - a.faces.topCenter.y ||
      a.faces.topCenter.x - b.faces.topCenter.x,
  );

  const placedChips: IsoPinChip[] = [];
  const pins: IsoPin[] = [];

  order.forEach((node) => {
    const subLabel = node.subLabel;
    const { width, height } = chipSize(node.name, subLabel);
    const anchor = node.faces.topCenter;

    const left = Math.min(
      Math.max(anchor.x - width / 2, viewBox.minX + 2),
      viewBox.minX + viewBox.width - width - 2,
    );

    let chip: IsoPinChip = { x: left, y: 0, width, height };
    for (let step = 0; step <= MAX_STEM_STEPS; step += 1) {
      chip = {
        x: left,
        y: anchor.y - (BASE_STEM + step * STEM_STEP) - height,
        width,
        height,
      };
      if (!placedChips.some((other) => overlaps(other, chip))) break;
    }
    placedChips.push(chip);

    pins.push({
      id: node.id,
      tone: node.tone,
      name: node.name,
      subLabel,
      anchor,
      // 칩이 캔버스 안으로 밀려 앵커가 칩 아래 모서리를 벗어난 경우, 지지대를
      // 수직으로 두면 허공에서 끝난다. 가장 가까운 모서리 위 점으로 붙여 비스듬한
      // 지시선이 되게 한다.
      tip: {
        x: Math.min(Math.max(anchor.x, chip.x + 6), chip.x + width - 6),
        y: chip.y + height,
      },
      chip,
      nameY: chip.y + NAME_BASELINE,
      subY: subLabel ? chip.y + NAME_BASELINE + SUB_BASELINE_GAP : null,
    });
  });

  // 겹침을 다 풀지 못한 경우를 대비해 위(뒤)에 있는 칩부터 그린다 — 앞 자원의
  // 이름이 위로 올라와야 가려도 덜 헷갈린다.
  return pins.sort((a, b) => a.chip.y - b.chip.y);
};

/* ================================================================
 * 펼친 핀 — 상세 카드
 *
 * 칩은 이름 한 줄이 전부라, 어느 가용영역에 있는지·무엇에 붙어 있는지 같은
 * 것을 알려면 표를 열거나 상세 화면으로 건너가야 했다. 핀을 누르면 그 자리에서
 * 카드로 펼쳐져 그만큼을 먼저 보여주고, 더 볼 것이 있으면 상세 화면으로 잇는다.
 *
 * **좌표계가 칩과 다르다.** 칩은 도식의 일부라 배율을 따라 함께 커지지만, 카드는
 * 도식 위에 뜬 UI 다. 같이 커지면 400% 에서는 카드 하나가 캔버스보다 넓어져
 * 어떻게 밀어 넣어도 잘린다. 그래서 카드 기하는 **화면 px** 로 계산하고, 렌더러가
 * 앵커에 `scale(1/배율)` 을 걸어 되돌린다 — 배율이 얼마든 카드는 같은 크기다.
 * ================================================================ */

/** 카드 글자 크기(px). 렌더러의 CSS 와 같아야 한다. */
export const CARD_FONT = {
  kind: 11,
  name: 13,
  label: 11,
  value: 12,
  action: 12,
} as const;

const CARD_PAD = 14;
/** 라벨과 값 사이 간격(px). */
const CARD_COL_GAP = 16;
const CARD_ROW_HEIGHT = 24;
/**
 * 카드 폭(px) — **내용과 무관한 고정값**이다.
 *
 * 예전에는 가장 긴 줄을 재서 폭을 정했다. 그러면 서브넷·라우팅 테이블·네트워크
 * 자원이 저마다 다른 폭으로 떠서, 핀을 옮겨 볼 때마다 카드가 늘었다 줄었다 한다.
 * 한 번에 하나만 뜨는 카드라 폭을 아낄 이유도 없으니, 가장 긴 값이 들어가고도
 * 남는 폭으로 고정해 어느 자원을 눌러도 같은 카드가 뜨게 한다.
 */
const CARD_WIDTH = 380;
/**
 * 카드가 최소한 담아야 할 항목 수.
 *
 * 높이도 같은 이유로 흔들리면 안 되는데, 항목 수는 자원 유형마다 다르다(서브넷 4,
 * 나머지 3). 가장 많은 쪽에 맞춰 바닥을 깔아 두면 유형을 오가도 카드 크기가 그대로다.
 */
const CARD_MIN_ROWS = 4;
/**
 * 카드와 맵 경계 사이에 반드시 남겨 둘 간격(px).
 *
 * 0 에 가깝게 두면 가장자리 자원의 카드가 맵 테두리에 딱 붙어, 카드가 맵 위에 뜬
 * 것이 아니라 테두리에 물려 잘린 것처럼 보인다. 실제로 잘리지 않아도 눈에는
 * 같은 인상이라, 붙지 않을 만큼은 떼어 놓는다.
 */
const CARD_VIEW_MARGIN = 12;

export interface IsoPinCardRow {
  label: string;
  value: string;
  /** 라벨과 값의 공통 베이스라인 */
  y: number;
}

/**
 * 좌표 규칙: `anchor` 와 `transform` 만 SVG 좌표계이고, **나머지 값은 전부
 * 앵커를 원점으로 하는 화면 px** 이다. 렌더러는 `transform` 을 건 그룹 안에서
 * 아래 값들을 그대로 쓰면 된다.
 */
export interface IsoPinCard {
  id: string;
  tone: IsoTone;
  /** 카드가 가리키는 점 (SVG 좌표) */
  anchor: IsoScreenPoint;
  /** 앵커로 옮기고 배율을 되돌리는 그룹 변환 */
  transform: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 지지대가 카드에 닿는 점 */
  tip: IsoScreenPoint;
  kindLabel: string;
  kindY: number;
  name: string;
  nameY: number;
  /** 머리글과 항목을 가르는 선 */
  headRuleY: number;
  rows: IsoPinCardRow[];
  labelX: number;
  /** 값은 오른쪽 정렬 — 자릿수가 다른 값들이 한 줄에서 흔들리지 않는다. */
  valueX: number;
  labelMaxWidth: number;
  valueMaxWidth: number;
  titleMaxWidth: number;
  /** 상세 화면으로 가는 줄. 이동할 곳이 없으면 null. */
  action: { label: string; y: number; ruleY: number } | null;
  /** 닫기 표식의 중심 */
  close: IsoScreenPoint;
}

export interface IsoPinCardOptions {
  /** 현재 배율. 카드를 이 값으로 나눠 화면상 크기를 고정한다. */
  zoom: number;
  /** 카드를 가둘 창 (SVG 좌표). 보통 지금 화면에 보이는 범위. */
  view: IsoViewBox;
}

/**
 * 펼친 핀의 카드를 앉힌다.
 *
 * 기본은 칩과 같은 자리 — 앵커 위 `BASE_STEM` 만큼 띄운 곳이다. 위쪽 여유가
 * 모자라면 **아래로 뒤집는다.** 창 안으로 밀어 넣기만 하면 카드가 자기 앵커를
 * 덮어 어느 자원의 것인지 사라지기 때문이다. 위아래 어느 쪽으로도 다 담기지
 * 않으면 그때는 덮더라도 창 안에 넣는다 — 절반만 보이는 것이 가장 나쁘다.
 */
export const buildIsoPinCard = (
  node: IsoNode,
  options: IsoPinCardOptions,
  actionLabel: string | null,
): IsoPinCard => {
  const details = node.details ?? [];
  const anchor = node.faces.topCenter;
  const zoom = options.zoom || 1;

  const width = CARD_WIDTH;

  const headBlock = CARD_PAD + 13 + 19;
  const rowsHeight = (count: number) => 8 + count * CARD_ROW_HEIGHT;
  const actionBlock = actionLabel ? 32 : CARD_PAD;
  const cardHeight = (rowCount: number) =>
    headBlock + 4 + rowsHeight(rowCount) + actionBlock;
  const height = Math.max(cardHeight(CARD_MIN_ROWS), cardHeight(details.length));

  /*
   * 창을 앵커 기준 화면 px 로 옮긴다. SVG 단위 차이에 배율을 곱하면 화면 px 이므로,
   * 이 한 번의 환산으로 아래 계산은 전부 카드와 같은 단위에서 돈다.
   */
  const view = {
    left: (options.view.minX - anchor.x) * zoom,
    top: (options.view.minY - anchor.y) * zoom,
    width: options.view.width * zoom,
    height: options.view.height * zoom,
  };

  /** 창보다 큰 카드는 밀어 넣을 자리가 없다 — 그때는 창 시작점에 붙인다. */
  const clamp = (value: number, min: number, span: number, size: number) =>
    size >= span ? min : Math.min(Math.max(value, min), min + span - size);

  const x = clamp(
    -width / 2,
    view.left + CARD_VIEW_MARGIN,
    view.width - CARD_VIEW_MARGIN * 2,
    width,
  );

  const above = -BASE_STEM - height;
  const flipped = above < view.top + CARD_VIEW_MARGIN;
  const y = clamp(
    flipped ? BASE_STEM : above,
    view.top + CARD_VIEW_MARGIN,
    view.height - CARD_VIEW_MARGIN * 2,
    height,
  );

  const headRuleY = y + headBlock + 4;
  const rows = details.map((detail, index) => ({
    ...detail,
    y: headRuleY + 8 + index * CARD_ROW_HEIGHT + 15,
  }));
  // 항목이 적은 유형은 아래가 남는다 — 마지막 줄에 붙이지 않고 **카드 바닥**에
  // 맞춰야 유형을 오갈 때 이 줄이 위아래로 뛰지 않는다.
  const actionRuleY = y + height - actionBlock;
  const inner = width - CARD_PAD * 2;

  return {
    id: node.id,
    tone: node.tone,
    anchor,
    transform: `translate(${anchor.x} ${anchor.y}) scale(${1 / zoom})`,
    x,
    y,
    width,
    height,
    // 지지대는 카드 테두리에서 앵커에 가장 가까운 점으로 잇는다. 앵커가 카드에
    // 덮인 경우에는 길이가 0 이 되어 저절로 사라진다.
    tip: {
      x: Math.min(Math.max(0, x + 8), x + width - 8),
      y: Math.min(Math.max(0, y), y + height),
    },
    kindLabel: node.kindLabel ?? "",
    kindY: y + CARD_PAD + 10,
    name: node.name,
    nameY: y + CARD_PAD + 27,
    headRuleY,
    rows,
    labelX: x + CARD_PAD,
    valueX: x + width - CARD_PAD,
    // 라벨은 짧고 고정적이라 안쪽 폭의 45% 로 묶고, 남는 자리는 자원 식별자처럼
    // 긴 값 쪽에 넘긴다.
    labelMaxWidth: inner * 0.45,
    valueMaxWidth: inner * 0.55 - CARD_COL_GAP,
    // 닫기 표식이 제목을 침범하지 않게 그만큼 뺀다.
    titleMaxWidth: inner - 18,
    action: actionLabel
      ? { label: actionLabel, y: actionRuleY + 21, ruleY: actionRuleY }
      : null,
    close: { x: x + width - CARD_PAD - 1, y: y + CARD_PAD + 6 },
  };
};
