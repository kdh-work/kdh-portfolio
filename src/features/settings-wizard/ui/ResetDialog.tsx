"use client";

import { useEffect, useRef } from "react";
import styles from "./wizard.module.css";

type Props = {
  message: string;
  items: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

/** 하위 설정 초기화 확인. Esc 와 배경 클릭은 취소로 처리한다. */
export function ResetDialog({ message, items, onConfirm, onCancel }: Props) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className={styles.dialog}>
        <h2 id="reset-dialog-title">하위 설정이 초기화됩니다</h2>
        <div className={styles.dialogBody}>
          <p>{message}</p>
          {items.length > 0 ? (
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className={styles.dialogFoot}>
          <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onCancel}>
            취소
          </button>
          <button ref={okRef} type="button" className={styles.btn} onClick={onConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
