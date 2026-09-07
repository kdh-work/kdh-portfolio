import type { Step } from "../model/useWizard";
import styles from "./wizard.module.css";

type Props = { step: Step; step1Complete: boolean; step2Complete: boolean };

const STEPS = [
  { no: "1단계", name: "자원 유형 · 벤더 선택" },
  { no: "2단계", name: "설정 입력" },
];

/** 현재 단계와 각 단계의 설정 여부. 완료 화면(3단계)에서는 2단계를 현재로 표시한다. */
export function StepTabs({ step, step1Complete, step2Complete }: Props) {
  const current = Math.min(step, 2);
  const complete = [step1Complete, step2Complete];

  return (
    <ol className={styles.steps}>
      {STEPS.map((item, index) => {
        const set = complete[index] ?? false;
        return (
          <li key={item.no} aria-current={current === index + 1 ? "step" : undefined}>
            <span className={styles.stepName}>
              <b>{item.no}</b>
              {item.name}
            </span>
            <span className={styles.stepTag} data-set={set}>
              {set ? "설정" : "미설정"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
