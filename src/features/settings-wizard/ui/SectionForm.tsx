"use client";

import type { Errors, ResolvedSection, Values } from "../model/types";
import { FieldControl } from "./FieldControl";
import styles from "./wizard.module.css";

type Props = {
  sections: ResolvedSection[];
  values: Values;
  errors: Errors;
  onField: (sectionId: string, fieldKey: string, label: string, value: string) => void;
};

/** 해석된 섹션 구성을 그대로 펼친다. 어떤 필드가 있는지는 이 컴포넌트가 모른다. */
export function SectionForm({ sections, values, errors, onField }: Props) {
  return (
    <div className={styles.cardBody}>
      {sections.map((section) => (
        <div key={section.id} className={styles.section}>
          <h3>
            {section.title}
            <em>{section.componentLabel}</em>
          </h3>
          <div className={styles.fields}>
            {section.fields.map((field) => (
              <FieldControl
                key={field.key}
                sectionId={section.id}
                field={field}
                value={values[field.key] ?? ""}
                error={errors[field.key]}
                onCommit={(value) => onField(section.id, field.key, field.label, value)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
