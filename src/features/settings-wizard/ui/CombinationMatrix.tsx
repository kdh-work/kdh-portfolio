"use client";

import { RESOURCE_TYPES, VENDORS, isSupported } from "../model/registry";
import type { ResourceType, Vendor } from "../model/types";
import styles from "./CombinationMatrix.module.css";

export type Combo = { type: ResourceType; vendor: Vendor };

type Props = {
  selected: Combo | null;
  onSelect: (type: ResourceType, vendor: Vendor) => void;
  /** 표를 설명하는 요소의 id */
  describedBy?: string;
};

/**
 * 자원 유형 × 벤더 조합 표.
 * 지원 여부는 registry 의 조합 표에서 읽으므로, 벤더가 늘어나도 이 컴포넌트는 바뀌지 않는다.
 */
export function CombinationMatrix({ selected, onSelect, describedBy }: Props) {
  return (
    <table className={styles.table} aria-describedby={describedBy}>
      <thead>
        <tr>
          <th scope="col">
            <span className="sr">자원 유형</span>
          </th>
          {VENDORS.map((vendor) => (
            <th key={vendor} scope="col">
              {vendor}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {RESOURCE_TYPES.map((type) => (
          <tr key={type}>
            <th scope="row">{type}</th>
            {VENDORS.map((vendor) => {
              const supported = isSupported(type, vendor);
              const pressed = selected?.type === type && selected.vendor === vendor;
              return (
                <td key={vendor}>
                  {supported ? (
                    <button
                      type="button"
                      className={styles.cell}
                      aria-pressed={pressed}
                      aria-label={`${type} · ${vendor} 조합 선택`}
                      onClick={() => onSelect(type, vendor)}
                    >
                      {pressed ? "선택됨" : "선택"}
                    </button>
                  ) : (
                    <button type="button" className={styles.cell} disabled>
                      미지원
                    </button>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
