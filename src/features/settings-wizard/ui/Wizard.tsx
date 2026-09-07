"use client";

import { useEffect, useRef } from "react";
import { useWizard } from "../model/useWizard";
import { CombinationMatrix } from "./CombinationMatrix";
import { DonePanel } from "./DonePanel";
import { ResetDialog } from "./ResetDialog";
import { SectionForm } from "./SectionForm";
import { StepTabs } from "./StepTabs";
import { TracePanel } from "./TracePanel";
import styles from "./wizard.module.css";

/** 위저드 화면 조립. 상태와 규칙은 전부 useWizard 에 있고 여기서는 배치만 한다. */
export function Wizard() {
  const w = useWizard();
  const formRef = useRef<HTMLDivElement>(null);
  const combo = w.type && w.vendor ? { type: w.type, vendor: w.vendor } : null;
  const errorCount = Object.keys(w.errors).length;

  // 저장이 막히면 첫 오류 필드로 포커스를 옮긴다. 오류 표시가 렌더된 뒤에 조회해야 하므로 effect 에서 처리한다.
  const focusFirstError = useRef(false);
  const onSubmit = () => {
    if (!w.submit()) focusFirstError.current = true;
  };
  useEffect(() => {
    if (!focusFirstError.current) return;
    focusFirstError.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [w.errors]);

  const labelOf = (key: string) =>
    w.sections.flatMap((s) => s.fields).find((f) => f.key === key)?.label ?? key;

  return (
    <>
      <StepTabs step={w.step} step1Complete={w.step1Complete} step2Complete={w.step2Complete} />

      <div className={styles.cols}>
        <div>
          {w.step === 1 ? (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>1단계 — 자원 유형과 벤더 선택</h2>
                <span>빗금 칸은 미지원 조합</span>
              </div>
              <div className={styles.cardBody}>
                <CombinationMatrix selected={combo} onSelect={w.selectCombo} />
                <p className={styles.hint}>
                  조합 표는 화면 코드가 아니라 별도 데이터로 관리됩니다. 벤더가 추가될 때 화면을
                  수정하지 않아도 됩니다.
                </p>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={!w.step1Complete}
                  onClick={() => w.goToStep(2)}
                >
                  다음 단계로
                </button>
              </div>
            </section>
          ) : null}

          {w.step === 2 && combo ? (
            <section className={styles.card} ref={formRef}>
              <div className={styles.cardHead}>
                <h2>
                  2단계 — {combo.type} × {combo.vendor}
                </h2>
                <span>섹션 {w.sections.length}개</span>
              </div>
              {errorCount > 0 ? (
                <p className={styles.formAlert} role="alert">
                  입력을 확인해야 하는 항목이 {errorCount}개 있습니다.
                </p>
              ) : null}
              <SectionForm
                sections={w.sections}
                values={w.values}
                errors={w.errors}
                onField={w.setField}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.ghost}`}
                  onClick={() => w.goToStep(1)}
                >
                  1단계로 돌아가기
                </button>
                <button type="button" className={styles.btn} onClick={onSubmit}>
                  설정 저장
                </button>
              </div>
            </section>
          ) : null}

          {w.step === 3 && combo ? (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>저장 완료</h2>
              </div>
              <DonePanel
                type={combo.type}
                vendor={combo.vendor}
                sections={w.sections}
                values={w.values}
              />
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={w.reset}>
                  처음부터 다시
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <TracePanel
          type={w.type}
          vendor={w.vendor}
          sections={w.sections}
          derivedFieldLabels={w.derivedFieldLabels}
          log={w.log}
        />
      </div>

      {w.pending?.kind === "combo" && combo ? (
        <ResetDialog
          message="자원 유형과 벤더를 변경하면 2단계 설정 구성이 달라지므로, 입력한 설정이 모두 초기화됩니다."
          items={[
            `${combo.type} × ${combo.vendor} 기준으로 입력한 ${w.pending.clearing}개 항목`,
            `변경 후 구성: ${w.pending.type} × ${w.pending.vendor}`,
          ]}
          onConfirm={w.confirmPending}
          onCancel={w.cancelPending}
        />
      ) : null}

      {w.pending?.kind === "driver" ? (
        <ResetDialog
          message="상위 필드를 변경하면 아래 하위 설정이 초기화됩니다."
          items={w.pending.cleared.map((key) => `${labelOf(key)} · 입력값 ${w.values[key]}`)}
          onConfirm={w.confirmPending}
          onCancel={w.cancelPending}
        />
      ) : null}
    </>
  );
}
