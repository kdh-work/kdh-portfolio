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
    /* **여기서 포인터를 잡으면 안 된다.** 아래 `onPointerMove` 주석 참고. */
  };

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const from = origin.current;
    if (!from || !onYawChange) return;
    const dx = event.clientX - from.x;

    /*
     * 포인터 캡처는 **끌기 시작이 확인된 뒤에** 건다.
     *
     * 포인터가 잡혀 있으면 브라우저는 뒤따르는 마우스 호환 이벤트 —
     * `mousedown`, `mouseup`, 그리고 **`click`** — 을 원래 눌린 요소가 아니라
     * 잡은 요소로 보낸다. 여기서 잡는 것은 `<svg>` 이므로, pointerdown 에서
     * 바로 잡으면 자원 박스를 눌러도 클릭이 박스가 아니라 SVG 에 떨어져 상세로
     * 가는 길이 통째로 막힌다. 놓기 시점과 클릭 합성 시점이 경쟁하므로 어쩌다
     * 한 번은 통과하는데, 그 무규칙성이 원인을 더 찾기 어렵게 만들었다.
     *
     * 잡기가 필요한 것은 도식 **밖으로 끌고 나가도** 회전이 이어지게 하려는
     * 것뿐이다. 그러니 실제로 끌기 시작한 뒤에 잡으면 된다 — 누르고 떼기만 한
     * 제스처는 잡기를 거치지 않으므로 `click` 이 제 요소로 간다.
     *
     * 캡처 자체는 **실패해도 되는 보조 장치**다. 이미 놓친 포인터에 걸면 예외가
     * 나는데, 그 예외가 여기서 터지면 회전이 중간에 멈춘다.
     */
    if (!movedRef.current && Math.abs(dx) > THRESHOLD_PX) {
      movedRef.current = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* 캡처 없이도 요소 안에서는 포인터 이벤트가 계속 온다 */
      }
    }

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
