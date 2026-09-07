"use client";

import { useCallback, useMemo, useState } from "react";
import { isSupported, resolveSections } from "./registry";
import { rules } from "./rules";
import type {
  Errors,
  ResolvedSection,
  ResourceType,
  Values,
  Vendor,
} from "./types";

export type Step = 1 | 2 | 3;

/**
 * 초기화 확인이 필요한 동작을 "의도"로 표현한다.
 * 콜백을 상태에 담지 않으므로 어떤 확인이 떠 있는지 값만 보고 알 수 있다.
 */
type PendingIntent =
  | { kind: "combo"; type: ResourceType; vendor: Vendor; clearing: number }
  | { kind: "driver"; fieldKey: string; label: string; value: string; cleared: string[] };

export type LogEntry = { id: number; message: string };

export function useWizard() {
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<ResourceType | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<PendingIntent | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [{ id: prev.length + 1, message }, ...prev].slice(0, 30));
  }, []);

  /** 조합과 현재 값에서 파생되는 섹션 구성. 상태로 들고 있지 않는다. */
  const sections: ResolvedSection[] = useMemo(
    () => (type && vendor ? resolveSections(type, vendor, values) : []),
    [type, vendor, values],
  );

  const validate = useCallback(
    (nextValues: Values, currentSections: ResolvedSection[], requireAll: boolean): Errors => {
      const next: Errors = {};
      for (const section of currentSections) {
        for (const field of section.fields) {
          const value = nextValues[field.key];
          if (value === undefined || value === "") {
            if (field.required && requireAll) next[field.key] = "필수 입력 항목입니다";
            continue;
          }
          if (field.rule) {
            const message = rules[field.rule](value, nextValues);
            if (message) next[field.key] = message;
          }
        }
      }
      return next;
    },
    [],
  );

  /** 현재 구성된 필수 항목이 모두 채워지고 형식 오류가 없는지 */
  const step2Complete = useMemo(() => {
    if (sections.length === 0) return false;
    const required = sections.flatMap((s) => s.fields.filter((f) => f.required));
    if (required.length === 0) return false;
    return Object.keys(validate(values, sections, true)).length === 0;
  }, [sections, values, validate]);

  const applyCombo = useCallback(
    (nextType: ResourceType, nextVendor: Vendor, clearing: number) => {
      setType(nextType);
      setVendor(nextVendor);
      setValues({});
      setErrors({});
      addLog(
        `조합 선택 · ${nextType} × ${nextVendor}` +
          (clearing > 0 ? ` (2단계 설정 ${clearing}개 항목 초기화)` : ""),
      );
    },
    [addLog],
  );

  const selectCombo = useCallback(
    (nextType: ResourceType, nextVendor: Vendor) => {
      if (!isSupported(nextType, nextVendor)) return;
      if (type === nextType && vendor === nextVendor) return;

      const filled = Object.keys(values).length;
      // 입력값이 있을 때만 확인을 받는다. 첫 선택이나 빈 상태 변경은 바로 적용.
      if (type && filled > 0) {
        setPending({ kind: "combo", type: nextType, vendor: nextVendor, clearing: filled });
        return;
      }
      applyCombo(nextType, nextVendor, 0);
    },
    [type, vendor, values, applyCombo],
  );

  const setField = useCallback(
    (sectionId: string, fieldKey: string, label: string, value: string) => {
      const section = sections.find((s) => s.id === sectionId);
      const dependents = section?.drivers[fieldKey];

      if (dependents) {
        const cleared = dependents.filter(
          (key) => values[key] !== undefined && values[key] !== "",
        );
        if (cleared.length > 0) {
          setPending({ kind: "driver", fieldKey, label, value, cleared });
          return;
        }
      }

      const nextValues = { ...values, [fieldKey]: value };
      setValues(nextValues);
      if (type && vendor) {
        const nextSections = resolveSections(type, vendor, nextValues);
        setErrors(validate(nextValues, nextSections, false));
      }
      if (dependents) addLog(`상위 필드 설정 · ${label} → ${value} / 하위 항목 구성`);
    },
    [sections, values, type, vendor, validate, addLog],
  );

  const confirmPending = useCallback(() => {
    if (!pending) return;
    if (pending.kind === "combo") {
      applyCombo(pending.type, pending.vendor, pending.clearing);
    } else {
      const nextValues: Values = { ...values, [pending.fieldKey]: pending.value };
      for (const key of pending.cleared) delete nextValues[key];
      setValues(nextValues);
      setErrors({});
      addLog(
        `상위 필드 변경 · ${pending.label} → ${pending.value} / 하위 ${pending.cleared.length}개 항목 초기화`,
      );
    }
    setPending(null);
  }, [pending, values, applyCombo, addLog]);

  const cancelPending = useCallback(() => {
    if (!pending) return;
    addLog(
      pending.kind === "combo"
        ? `조합 변경 취소 · ${type} × ${vendor} 유지`
        : `상위 필드 변경 취소 · ${pending.label} 값 유지`,
    );
    setPending(null);
  }, [pending, type, vendor, addLog]);

  /** 단계 이동은 자유. 초기화는 조합을 실제로 바꿀 때만 일어난다. */
  const goToStep = useCallback(
    (next: Step) => {
      setStep(next);
      const filled = Object.keys(values).length;
      if (next === 1) {
        addLog(filled > 0 ? `1단계로 복귀 · 입력한 ${filled}개 항목 유지` : "1단계로 복귀");
      } else if (next === 2) {
        addLog(filled > 0 ? "2단계 진입 · 기존 입력값 유지" : "2단계 진입 · 조합 결과로 섹션 구성");
      }
    },
    [values, addLog],
  );

  const submit = useCallback((): boolean => {
    const next = validate(values, sections, true);
    setErrors(next);
    const count = Object.keys(next).length;
    if (count > 0) {
      addLog(`저장 실패 · 확인이 필요한 항목 ${count}개`);
      return false;
    }
    setStep(3);
    addLog("저장 완료 · 현재 구성된 항목만 검증");
    return true;
  }, [values, sections, validate, addLog]);

  const reset = useCallback(() => {
    setStep(1);
    setType(null);
    setVendor(null);
    setValues({});
    setErrors({});
    setPending(null);
    addLog("초기화 · 처음부터 다시 시작");
  }, [addLog]);

  const derivedFieldLabels = useMemo(
    () => sections.flatMap((s) => s.fields.filter((f) => f.derived).map((f) => f.label)),
    [sections],
  );

  return {
    step,
    type,
    vendor,
    values,
    errors,
    sections,
    pending,
    log,
    step1Complete: type !== null,
    step2Complete,
    derivedFieldLabels,
    selectCombo,
    setField,
    confirmPending,
    cancelPending,
    goToStep,
    submit,
    reset,
  };
}
