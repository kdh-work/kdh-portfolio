import type { LogEntry } from "../model/useWizard";
import type { ResolvedSection, ResourceType, Vendor } from "../model/types";
import styles from "./wizard.module.css";

type Props = {
  type: ResourceType | null;
  vendor: Vendor | null;
  sections: ResolvedSection[];
  derivedFieldLabels: string[];
  log: LogEntry[];
};

/** 어떤 조건이 어느 층에서 해석됐는지 보여주는 패널 */
export function TracePanel({ type, vendor, sections, derivedFieldLabels, log }: Props) {
  const chosen = type && vendor;

  return (
    <aside className={styles.trace} aria-label="조건 해석 경로">
      <h2>해석 경로</h2>
      <div className={styles.traceBody}>
        <Row label="선택한 조합" dim={!chosen}>
          {chosen ? `${type} × ${vendor}` : "아직 선택하지 않음"}
        </Row>
        <Row label="자원 유형이 결정한 섹션" dim={!chosen}>
          {chosen ? sections.map((s) => s.title).join(" / ") : "—"}
        </Row>
        <Row label="조합이 결정한 입력 컴포넌트" dim={!chosen}>
          {chosen ? sections.map((s) => `${s.title}: ${s.componentLabel}`).join(" · ") : "—"}
        </Row>
        <Row label="필드 값이 만든 하위 구성" dim={derivedFieldLabels.length === 0} dynamic>
          {!chosen
            ? "—"
            : derivedFieldLabels.length > 0
              ? derivedFieldLabels.join(" / ")
              : "상위 필드를 선택하면 하위 항목이 구성됩니다"}
        </Row>

        <div className={styles.traceLog}>
          <p className={styles.traceKey}>동작 기록</p>
          <ul>
            {log.length === 0 ? (
              <li>조합을 선택하면 기록이 남습니다.</li>
            ) : (
              log.map((entry) => <li key={entry.id}>{entry.message}</li>)
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function Row({
  label,
  dim,
  dynamic,
  children,
}: {
  label: string;
  dim: boolean;
  dynamic?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.traceRow} ${dynamic ? styles.dyn : ""}`}>
      <p className={styles.traceKey}>{label}</p>
      <p className={`${styles.traceValue} ${dim ? styles.dim : ""}`}>{children}</p>
    </div>
  );
}
