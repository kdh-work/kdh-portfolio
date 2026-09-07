"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import type { Shot } from "@/content/types";
import styles from "./Lightbox.module.css";

type OpenArgs = { shots: Shot[]; index: number };

const LightboxContext = createContext<((args: OpenArgs) => void) | null>(null);

export function useLightbox() {
  const open = useContext(LightboxContext);
  if (!open) throw new Error("useLightbox 는 LightboxProvider 안에서만 사용할 수 있습니다.");
  return open;
}

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenArgs | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const open = useCallback((args: OpenArgs) => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    setState(args);
  }, []);

  const close = useCallback(() => {
    setState(null);
    restoreFocusTo.current?.focus();
  }, []);

  const move = useCallback((delta: number) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = (prev.index + delta + prev.shots.length) % prev.shots.length;
      return { ...prev, index: next };
    });
  }, []);

  // 열려 있는 동안 배경 스크롤을 막고, 키보드로 조작할 수 있게 한다.
  useEffect(() => {
    if (!state) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") move(1);
      else if (event.key === "ArrowLeft") move(-1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [state, close, move]);

  const current = state ? state.shots[state.index] : undefined;
  const multiple = (state?.shots.length ?? 0) > 1;
  const value = useMemo(() => open, [open]);

  return (
    <LightboxContext.Provider value={value}>
      {children}
      {state && current ? (
        <div
          className={styles.scrim}
          role="dialog"
          aria-modal="true"
          aria-label="화면 확대 보기"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className={styles.bar}>
            <p className={styles.counter}>
              {state.index + 1} / {state.shots.length}
            </p>
            <button ref={closeRef} type="button" className={styles.close} onClick={close}>
              닫기
            </button>
          </div>

          <figure className={styles.frame}>
            <Image
              src={current.src}
              width={current.width}
              height={current.height}
              alt={current.alt}
              className={styles.image}
              priority
            />
            <figcaption className={styles.caption}>
              {current.route ? <code>{current.route}</code> : null}
              {current.caption}
            </figcaption>
          </figure>

          {multiple ? (
            <div className={styles.nav}>
              <button type="button" className={styles.navButton} onClick={() => move(-1)}>
                이전 화면
              </button>
              <button type="button" className={styles.navButton} onClick={() => move(1)}>
                다음 화면
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </LightboxContext.Provider>
  );
}
