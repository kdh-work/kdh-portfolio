"use client";

import { useEffect, useState } from "react";
import type { FieldDef } from "../model/types";
import styles from "./wizard.module.css";

type Props = {
  sectionId: string;
  field: FieldDef;
  value: string;
  error?: string;
  onCommit: (value: string) => void;
};

/**
 * 필드 하나. 텍스트는 입력 중에는 검증하지 않고 포커스가 빠질 때 확정한다.
 * 셀렉트는 선택 즉시 확정한다(상위 필드면 이 시점에 초기화 확인이 뜬다).
 */
export function FieldControl({ sectionId, field, value, error, onCommit }: Props) {
  const id = `f-${sectionId}-${field.key}`;
  const [draft, setDraft] = useState(value);

  // 상위 필드 초기화 등으로 저장된 값이 바뀌면 입력 중인 값도 따라간다.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const className = [
    styles.field,
    field.derived ? styles.derived : "",
    error ? styles.invalid : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <label htmlFor={id}>
        {field.label}
        {field.required ? (
          <span className={styles.req} aria-label="필수">
            *
          </span>
        ) : null}
        {field.driver ? <span className={styles.driverBadge}>상위 필드</span> : null}
      </label>

      {field.type === "select" ? (
        <select
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onCommit(event.target.value)}
        >
          <option value="">선택</option>
          {(field.options ?? []).map((option) => {
            const opt = typeof option === "string" ? { value: option, text: option } : option;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.text}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={draft}
          placeholder={field.placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onCommit(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      )}

      {field.note ? <p className={styles.note}>{field.note}</p> : null}
      {error ? <p className={styles.err}>{error}</p> : null}
    </div>
  );
}
