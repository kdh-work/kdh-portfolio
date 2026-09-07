import type { ResolvedSection, ResourceType, Values, Vendor } from "../model/types";
import styles from "./wizard.module.css";

type Props = {
  type: ResourceType;
  vendor: Vendor;
  sections: ResolvedSection[];
  values: Values;
};

export function DonePanel({ type, vendor, sections, values }: Props) {
  return (
    <div className={styles.done}>
      <h3>
        {type} × {vendor} 설정이 저장되었습니다
      </h3>
      <p>
        검증은 현재 구성된 항목만을 대상으로 수행했습니다. 상위 필드 변경으로 사라진 항목의 값과
        규칙은 함께 제거되므로, 화면에 없는 항목이 저장을 막는 일이 발생하지 않습니다.
      </p>
      <dl>
        {sections.flatMap((section) =>
          section.fields.map((field) => (
            <div key={`${section.id}-${field.key}`} className={styles.doneRow}>
              <dt>
                {section.title} · {field.label}
              </dt>
              <dd>{values[field.key] || "(미입력)"}</dd>
            </div>
          )),
        )}
      </dl>
    </div>
  );
}
