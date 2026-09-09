"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * 끌어서 시점을 돌리는 동작. **두 렌더러가 공유한다** — SVG 는 `<svg>` 에,
 * WebGL 은 캔버스 컨테이너에 같은 핸들러를 붙인다. 조작감이 갈리면 토글이
 * 비교가 아니라 딴 물건이 된다.
 *
 * 상태로 두는 것은 "지금 끌고 있는가" 뿐이다. 시작 각도와 시작 좌표는 ref 에
 * 담아 매 프레임 리렌더를 만들지 않는다.
 */

/** 가로 1px 드래그당 회전할 각도 */
const DEGREES_PER_PX = 0.4;

/** 이보다 적게 움직였으면 클릭으로 본다 */
const THRESHOLD_PX = 4;

const normalize = (deg: number) => ((deg % 360) + 360) % 360;

export interface YawDrag<T extends Element> {
  dragging: boolean;
  /** 임계값을 넘겨 끌었는지 — 뒤이어 오는 클릭을 삼킬지 판단에 쓴다 */
  movedRef: { current: boolean };
  handlers: {
    onPointerDown: (event: ReactPointerEvent<T>) => void;
    onPointerMove: (event: ReactPointerEvent<T>) => void;
    onPointerUp: (event: ReactPointerEvent<T>) => void;
    onPointerCancel: (event: ReactPointerEvent<T>) => void;
  };
}

export function useYawDrag<T extends Element>(
  yawDeg: number | undefined,
  onYawChange: ((deg: number) => void) | undefined,
  enabled: boolean,
): YawDrag<T> {
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ x: number; yaw: number } | null>(null);
  const movedRef = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    if (!enabled || !onYawChange || event.button !== 0) return;
    origin.current = { x: event.clientX, yaw: yawDeg ?? 0 };
    movedRef.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const from = origin.current;
    if (!from || !onYawChange) return;
    const dx = event.clientX - from.x;
    if (Math.abs(dx) > THRESHOLD_PX) movedRef.current = true;
    onYawChange(normalize(from.yaw - dx * DEGREES_PER_PX));
  };

  const finish = (event: ReactPointerEvent<T>) => {
    if (!origin.current) return;
    origin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    dragging,
    movedRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}
