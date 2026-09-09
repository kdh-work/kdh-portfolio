import { rendererComparison as copy } from "@/content/isoMap";
import styles from "./RendererComparison.module.css";

/**
 * SVG · WebGL 비교 기록.
 *
 * 원본 문서(§1)는 Three.js 를 쓰지 않은 근거를 표로 적어 두었다. 같은 장면을 두
 * 렌더러로 만들어 그 표를 실측으로 바꾼 결과를 여기에 남긴다.
 */
export function RendererComparison() {
  return (
    <div className={styles.root}>
      <p className={styles.lede}>{copy.lede}</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">SVG</th>
              <th scope="col">WebGL</th>
            </tr>
          </thead>
          <tbody>
            {copy.rows.map((row) => (
              <tr key={row.aspect}>
                <th scope="row">{row.aspect}</th>
                <td>{row.svg}</td>
                <td>{row.webgl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.closing}>{copy.closing}</p>
    </div>
  );
}
