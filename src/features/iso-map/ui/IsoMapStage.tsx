"use client";

import { useState } from "react";
import type { IsoNode } from "../scene/types";
import type { IsoVpcSource } from "../vpc/sourceTypes";
import { VpcIsoMap } from "./VpcIsoMap";
import styles from "./IsoMapStage.module.css";

/**
 * 데모 페이지의 관계도 무대.
 *
 * 실무에서는 자원을 누르면 그 자원의 상세 화면으로 넘어간다 — 박스를 누르면
 * 곧바로, 핀을 누르면 펼친 카드의 마지막 줄을 거쳐서다. 포트폴리오에는 넘어갈
 * 상세 화면이 없으므로, **이동 대신 그 자리에 무엇이 넘어갔는지를 적는다.**
 * 클릭 경로를 통째로 빼면 카드의 마지막 줄도 사라져 기능의 절반이 안 보인다.
 */
type Props = {
  source: IsoVpcSource;
  canvasHeight?: number;
};

export function IsoMapStage({ source, canvasHeight }: Props) {
  const [selected, setSelected] = useState<IsoNode | null>(null);

  return (
    <>
      <VpcIsoMap
        source={source}
        canvasHeight={canvasHeight}
        onNodeClick={setSelected}
      />

      <div className={styles.panel} aria-live="polite">
        <span className={styles.label}>상세 화면으로 넘긴 자원</span>
        {selected ? (
          <div className={styles.body}>
            <b className={styles.name}>
              {selected.kindLabel && (
                <span className={styles.kind}>{selected.kindLabel}</span>
              )}
              {selected.name}
            </b>
            <span className={styles.rows}>
              {(selected.details ?? []).map((detail) => (
                <span key={detail.label} className={styles.row}>
                  {detail.label} <b>{detail.value}</b>
                </span>
              ))}
            </span>
          </div>
        ) : (
          <p className={styles.empty}>
            자원 박스를 누르면 바로, 핀을 누르면 펼친 카드의 마지막 줄에서
            상세 화면으로 넘어갑니다. 실무 화면에서는 이 클릭이 자원 상세로
            이동하고, 여기서는 무엇이 넘어갔는지를 대신 적습니다.
          </p>
        )}
      </div>
    </>
  );
}
