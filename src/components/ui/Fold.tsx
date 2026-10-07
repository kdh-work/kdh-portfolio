import styles from "./Fold.module.css";

type Props = {
  label: string;
  /** 같은 페이지에 펼치기가 여럿일 때 스크린 리더가 구분할 수 있게 덧붙이는 이름 */
  context?: string;
  children: React.ReactNode;
};

/** 요약은 늘 보이고 근거는 펼쳐서 보는 자리에 쓴다. 키보드·찾기(Ctrl+F)는 브라우저 기본 동작을 그대로 쓴다. */
export function Fold({ label, context, children }: Props) {
  return (
    <details className={styles.fold}>
      <summary>
        {label}
        {context ? <span className="sr"> — {context}</span> : null}
      </summary>
      {children}
    </details>
  );
}
