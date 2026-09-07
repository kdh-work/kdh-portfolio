"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { matrixPreviewCopy as copy } from "@/content/demo";
import { CombinationMatrix, type Combo } from "@/features/settings-wizard/ui/CombinationMatrix";
import { resolveSections } from "@/features/settings-wizard/model/registry";
import styles from "./MatrixPreview.module.css";

/**
 * 메인 페이지의 축약 데모. 조합을 고르면 결정되는 섹션 구성만 보여준다.
 * 데이터는 데모 페이지와 같은 registry 를 읽으므로 두 화면이 어긋나지 않는다.
 */
export function MatrixPreview() {
  const [combo, setCombo] = useState<Combo | null>(null);

  const sections = useMemo(
    () => (combo ? resolveSections(combo.type, combo.vendor, {}) : []),
    [combo],
  );

  return (
    <section className={styles.demo} aria-labelledby="demo-h">
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.head}>
          <h2 id="demo-h">{copy.title}</h2>
          <p>{copy.lede}</p>
        </div>

        <div className={styles.grid}>
          <div>
            <p className={styles.label} id="mx-label">
              1단계 — 자원 유형과 벤더 선택
            </p>
            <CombinationMatrix
              selected={combo}
              describedBy="mx-label"
              onSelect={(type, vendor) => setCombo({ type, vendor })}
            />
            <p className={styles.note} style={{ marginBottom: 12 }}>
              <Link href="/demo">{copy.demoLink}</Link> — {copy.demoLinkNote}
            </p>
            <p className={styles.note}>{copy.note}</p>
          </div>

          <div>
            <p className={styles.label}>2단계 — 결정된 설정 구성</p>
            <div className={styles.out}>
              <div className={styles.outHead}>
                <strong>{combo ? `${combo.type} · ${combo.vendor}` : copy.emptyTitle}</strong>
                {combo ? <em>섹션 {sections.length}개</em> : null}
              </div>
              <div className={styles.outBody} aria-live="polite">
                {combo ? (
                  sections.map((section, index) => {
                    const driver = section.fields.find((field) => field.driver);
                    return (
                      <div
                        // 조합이 바뀔 때마다 등장 애니메이션을 다시 재생한다.
                        key={`${combo.type}-${combo.vendor}-${section.id}`}
                        className={`${styles.sect} ${styles.enter}`}
                        style={{ animationDelay: `${index * 45}ms` }}
                      >
                        <span className={styles.sectNo}>{index + 1}</span>
                        <span className={styles.sectTitle}>{section.title}</span>
                        <span className={styles.sectComp}>
                          {section.componentLabel}
                          {driver ? (
                            <span className={styles.sectDyn}>
                              {driver.label} 선택에 따라 하위 필드 구성 변경
                            </span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className={styles.empty}>{copy.empty}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
