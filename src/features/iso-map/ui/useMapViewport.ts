"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

/**
 * 맵 뷰포트 조작 — 배율과 맵 안에서의 이동.
 *
 * 두 가지가 이 훅의 전제다.
 *
 * 1. **배율은 레이아웃이 아니라 뷰포트에 건다.** 씬의 `unit` 에 배율을 곱하면
 *    글자 크기는 CSS 로 고정돼 함께 커지지 않아, 배율을 바꿀 때마다 도식의
 *    비례가 어긋난다. `viewBox` 는 그대로 두고 `width`/`height` 만 곱하면
 *    글자까지 함께 커지고, 배율을 바꿔도 씬을 다시 만들지 않는다.
 * 2. **스크롤바를 두지 않는다.** 바깥을 보는 방법은 Space + 드래그(이동),
 *    Space + 휠(확대·축소), 그리고 맞춤 버튼이다. `overflow: hidden` 이어도
 *    엘리먼트는 여전히 스크롤 컨테이너라 `scrollLeft`/`scrollTop` 은 동작한다.
 *
 * Space 를 수정 키로 쓰는 이유는 맨 드래그가 이미 회전이고 맨 휠이 페이지
 * 스크롤이기 때문이다. 맵 위에서 휠을 무조건 가로채면 맵을 지나쳐 아래로
 * 내려가려던 사람이 갇힌다.
 */

/**
 * 배율의 **절대** 한계.
 *
 * Figma 처럼 100% 는 언제나 1:1 이다 — 맵이 크든 작든 100% 에서 노드와 글자는
 * 같은 픽셀 크기로 그려진다. 맵마다 달라지는 것은 100% 의 뜻이 아니라 *그 맵을
 * 한눈에 담으려면 몇 % 가 필요한가* 이고, 그래서 실제 하한은 맞춤 배율까지
 * 내려간다(`zoomMin`) — 아래 두 값은 기본값일 뿐이다.
 */
const ZOOM_FLOOR = 0.1;
const ZOOM_CEILING = 4;

/** [+] [−] 가 멈추는 배율. 끌어서 조절하면 이 사이 값도 나온다. */
const ZOOM_STOPS = [0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4];

/**
 * 끌기 감도 — 1px 당 배율의 **곱**. 10%~400% 범위에서 1px 당 일정한 %p 를 더하면
 * 400% 부근에서는 거의 티가 안 나고 10% 부근에서는 한 번에 두 배씩 튄다.
 */
const ZOOM_PER_PX = 1.008;

/** 휠 1틱(deltaY 100)당 약 0.82배. */
const ZOOM_WHEEL_SENSITIVITY = 0.002;

const SCRUB_THRESHOLD_PX = 3;

/** 값 손잡이에서 방향키·부호키가 뜻하는 방향. */
const ZOOM_KEY_DIRECTION: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  "+": 1,
  "=": 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  "-": -1,
};

/**
 * 배율을 바꾼 **뒤** 스크롤을 어디에 맞출지. 크기가 바뀌기 전에 적어 두고
 * 바뀐 뒤에 쓴다 — 변경 후에 배율 비로 계산하면 축소할 때 어긋난다. SVG 가
 * 작아지는 순간 브라우저가 스크롤 값을 먼저 최대치로 잘라내기 때문이다.
 */
type ScrollIntent =
  /** 커서 밑에 있던 지점을 제자리에 남긴다 — 휠 확대. */
  | { kind: "anchor"; u: number; v: number; clientX: number; clientY: number }
  /** 보고 있던 가운데를 유지한다 — 버튼·끌기. */
  | { kind: "center"; x: number; y: number };

type Options = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** 배율 1 에서의 콘텐츠 크기(px). 맞춤 배율의 분모다. */
  content: { width: number; height: number };
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * 포인터 캡처는 **실패해도 되는 보조 장치**다. 이미 놓친 포인터에 걸면 예외를
 * 던지는데, 그 예외가 끌기 준비 도중에 터지면 상태만 켜진 채 끝난다.
 */
const capture = (element: Element, pointerId: number) => {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    /* 캡처 없이도 창 리스너로 끝까지 따라간다 */
  }
};

const releaseCapture = (element: Element, pointerId: number) => {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    /* 이미 놓인 포인터 */
  }
};

export function useMapViewport({ zoom, onZoomChange, content }: Options) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentElRef = useRef<Element | null>(null);
  const intentRef = useRef<ScrollIntent | null>(null);
  const pointerInsideRef = useRef(false);
  const spaceHeldRef = useRef(false);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  /** SVG(또는 WebGL 루트)를 가리키는 콜백 ref. 앵커 계산에 실제 사각형이 필요하다. */
  const setContentEl = useCallback((element: Element | null) => {
    contentElRef.current = element;
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () =>
      setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * **맞춤 배율** — 콘텐츠 전체가 뷰포트에 들어오는 배율.
   *
   * 가로·세로 중 더 빡빡한 쪽을 기준으로 잡아야 양쪽 다 들어온다. **내림**이어야
   * 한다 — 표시(정수 %)와 맞추려고 소수 둘째 자리에서 끊는데 그게 위로 올라가면
   * 몇 px 이 잘린다. 100% 상한은 두지 않는다. 작은 맵도 캔버스를 채워야 한다.
   */
  const fitScale = (() => {
    if (!viewportSize.width || !viewportSize.height) return 0;
    if (!content.width || !content.height) return 0;
    const ratio = Math.min(
      viewportSize.width / content.width,
      viewportSize.height / content.height,
    );
    return Math.max(0.01, Math.floor(ratio * 100) / 100);
  })();

  /** 하한은 **맞춤 배율보다 높을 수 없다.** 고정하면 큰 맵은 전체를 볼 방법이 없다. */
  const zoomMin = Math.min(ZOOM_FLOOR, fitScale || ZOOM_FLOOR);
  const zoomMax = Math.max(ZOOM_CEILING, fitScale);

  /* 이벤트 리스너가 매 배율마다 다시 붙지 않도록 최신값은 ref 로 읽는다. */
  const latest = useRef({ zoom, zoomMin, zoomMax });
  latest.current = { zoom, zoomMin, zoomMax };
  spaceHeldRef.current = spaceHeld;

  const applyZoom = useCallback(
    (value: number, anchor?: Omit<Extract<ScrollIntent, { kind: "anchor" }>, "kind">) => {
      const { zoom: current, zoomMin: min, zoomMax: max } = latest.current;
      const clamped = Math.min(max, Math.max(min, value));
      // 표시가 정수 % 이므로 값도 같은 자리에서 끊어 둘이 어긋나지 않게 한다.
      const rounded = Math.round(clamped * 100) / 100;
      if (rounded === current) return;

      const element = viewportRef.current;
      if (anchor) {
        intentRef.current = { kind: "anchor", ...anchor };
      } else if (element) {
        intentRef.current = {
          kind: "center",
          x:
            (element.scrollLeft + element.clientWidth / 2) /
            Math.max(1, element.scrollWidth),
          y:
            (element.scrollTop + element.clientHeight / 2) /
            Math.max(1, element.scrollHeight),
        };
      }

      onZoomChange(rounded);
    },
    [onZoomChange],
  );

  /**
   * 배율이 적용된 직후 스크롤을 되돌린다. **그리기 전에** 끝나야 하므로
   * `useLayoutEffect` 다 — `useEffect` 로 두면 한 프레임 동안 도식이 튄다.
   */
  useLayoutEffect(() => {
    const intent = intentRef.current;
    intentRef.current = null;
    const element = viewportRef.current;
    if (!intent || !element) return;

    if (intent.kind === "anchor") {
      const target = contentElRef.current;
      if (!target) return;
      // 앵커 지점이 지금 화면 어디에 있는지 재서, 커서 자리로 되돌린다.
      const rect = target.getBoundingClientRect();
      element.scrollLeft += rect.left + intent.u * rect.width - intent.clientX;
      element.scrollTop += rect.top + intent.v * rect.height - intent.clientY;
      return;
    }

    element.scrollLeft = intent.x * element.scrollWidth - element.clientWidth / 2;
    element.scrollTop = intent.y * element.scrollHeight - element.clientHeight / 2;
  }, [zoom]);

  /** 뷰포트를 콘텐츠 가운데로 맞춘다. */
  const center = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
  }, []);

  /** 다음(1) / 이전(-1) 정지 배율로 옮긴다. 끌어서 만든 중간값에서도 동작한다. */
  const stepZoom = useCallback(
    (direction: number) => {
      const { zoom: current, zoomMin: min, zoomMax: max } = latest.current;
      const inRange = ZOOM_STOPS.filter((stop) => stop >= min && stop <= max);
      const stops = direction > 0 ? inRange : [...inRange].reverse();
      const next = stops.find((stop) =>
        direction > 0 ? stop > current + 0.001 : stop < current - 0.001,
      );
      applyZoom(next ?? (direction > 0 ? max : min));
    },
    [applyZoom],
  );

  /** 맵 전체가 들어오는 배율로 맞춘다. 하한도 같은 값을 쓰므로 계산은 한 곳에 둔다. */
  const fit = useCallback(() => {
    if (!fitScale) return;
    applyZoom(fitScale);
    // 배율이 이미 맞춤이라 그대로일 수도 있으니 정렬은 따로 해준다.
    center();
  }, [applyZoom, center, fitScale]);

  /* ── Space 수정 키 ─────────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // 값 손잡이에 초점이 있으면 Space 는 그쪽의 100% 되돌리기다.
      if (target?.closest?.("[data-zoom-value]")) return;
      if (event.code !== "Space" || !pointerInsideRef.current) return;
      // 맵 위에서 Space 는 페이지 스크롤이 아니라 이동·확대 수정 키다.
      event.preventDefault();
      setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    /** 창을 잃으면 눌린 상태가 남아 커서가 계속 손 모양이 된다. */
    const onBlur = () => setSpaceHeld(false);

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /* ── Space + 휠 확대·축소 ──────────────────────────────────── */
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!spaceHeldRef.current) return;
      const target = contentElRef.current;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      event.preventDefault();

      // deltaMode 1 은 줄 단위(Firefox) — 픽셀로 환산하지 않으면 한 틱이 너무 작다.
      const deltaY = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      applyZoom(latest.current.zoom * Math.exp(-deltaY * ZOOM_WHEEL_SENSITIVITY), {
        u: clamp01((event.clientX - rect.left) / rect.width),
        v: clamp01((event.clientY - rect.top) / rect.height),
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    // 기본 동작(페이지 스크롤)을 막아야 하므로 passive 가 아니어야 한다.
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  /* ── Space + 드래그 이동 ───────────────────────────────────── */
  const startPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const element = viewportRef.current;
    if (!element || event.button !== 0) return;

    // 회전 드래그가 같은 pointerdown 을 이어받지 않게 한다.
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = element.scrollLeft;
    const startTop = element.scrollTop;
    const pointerId = event.pointerId;
    setPanning(true);

    const onMove = (moveEvent: PointerEvent) => {
      // 끄는 방향으로 내용이 따라오게 — 스크롤은 반대로 움직인다.
      element.scrollLeft = startLeft - (moveEvent.clientX - startX);
      element.scrollTop = startTop - (moveEvent.clientY - startY);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      releaseCapture(element, pointerId);
      setPanning(false);
    };

    /*
     * 리스너는 **창에** 붙인다. 요소에만 붙이면 포인터 캡처가 잡히지 않았을 때
     * (브라우저가 거절하거나 이미 놓친 포인터) 이동·놓기를 통째로 놓쳐 끌기
     * 상태에서 빠져나오지 못한다. 캡처는 있으면 좋은 보조일 뿐이다.
     */
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    capture(element, pointerId);
  }, []);

  /* ── 값 손잡이 끌기 ────────────────────────────────────────── */
  const startScrub = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startZoom = latest.current.zoom;
      let moved = false;

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!moved && Math.abs(dx) < SCRUB_THRESHOLD_PX) return;
        moved = true;
        setScrubbing(true);
        applyZoom(startZoom * Math.pow(ZOOM_PER_PX, dx));
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        releaseCapture(handle, pointerId);
        // 끌지 않고 눌렀다 뗀 것은 누르기로 보고 100% 로 되돌린다.
        if (!moved) applyZoom(1);
        setScrubbing(false);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      capture(handle, pointerId);
    },
    [applyZoom],
  );

  const onValueKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const direction = ZOOM_KEY_DIRECTION[event.key];
      if (direction) {
        event.preventDefault();
        stepZoom(direction);
        return;
      }
      if (event.key === "Home" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        applyZoom(1);
      }
    },
    [applyZoom, stepZoom],
  );

  return {
    viewportRef,
    setContentEl,
    spaceHeld,
    panning,
    scrubbing,
    fitScale,
    zoomMin,
    zoomMax,
    setZoom: applyZoom,
    stepZoom,
    fit,
    center,
    startPan,
    startScrub,
    onValueKeyDown,
    onPointerEnter: () => {
      pointerInsideRef.current = true;
    },
    onPointerLeave: () => {
      pointerInsideRef.current = false;
    },
  };
}
