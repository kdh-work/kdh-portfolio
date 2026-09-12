import styles from "./HistoryReport.module.css";

/**
 * 틀리는 과정을 적는 검토 기록의 공용 틀.
 *
 * 다른 검토 기록(`LabelStudy`·`RendererComparison`)은 **고르는 과정**이라 대안을
 * 나란히 놓는 격자가 맞다. 회전·확대 기록과 핀 기록은 **틀리는 과정**이라 증상
 * → 원인 → 고침의 세로 흐름이고, 원인 하나를 여러 번에 걸쳐 만난 대목만 따로
 * 뺀다. 두 기록이 같은 모양이므로 틀을 하나만 둔다 — 형식이 갈리면 읽는 쪽이
 * 둘을 다른 종류의 기록으로 읽는다.
 */
export type HistoryReportData = {
  lede: string;
  rows: { symptom: string; cause: string; fix: string }[];
  thread?: {
    title: string;
    paragraphs: string[];
    measurement?: { caption: string; head: string[]; rows: string[][] };
  };
  lessons: { title: string; body: string }[];
  closing: string;
};

export function HistoryReport({
  data,
  threadHeadingId,
}: {
  data: HistoryReportData;
  /** 딸린 이야기의 제목 id — 같은 페이지에 두 기록이 있으므로 겹치면 안 된다. */
  threadHeadingId: string;
}) {
  const measurement = data.thread?.measurement;

  return (
    <div className={styles.root}>
      <p className={styles.lede}>{data.lede}</p>

      <ol className={styles.rounds}>
        {data.rows.map((row) => (
          <li key={row.symptom} className={styles.round}>
            <p className={styles.symptom}>{row.symptom}</p>
            <div className={styles.detail}>
              <span className={styles.tag}>원인</span>
              <p>{row.cause}</p>
            </div>
            <div className={styles.detail}>
              <span className={`${styles.tag} ${styles.tagFix}`}>고침</span>
              <p>{row.fix}</p>
            </div>
          </li>
        ))}
      </ol>

      {data.thread && (
        <section className={styles.thread} aria-labelledby={threadHeadingId}>
          <h3 id={threadHeadingId}>{data.thread.title}</h3>
          {data.thread.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          {measurement && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>{measurement.caption}</caption>
                <thead>
                  <tr>
                    {measurement.head.map((cell) => (
                      <th key={cell} scope="col">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measurement.rows.map(([label, ...cells]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {cells.map((cell, index) => (
                        <td key={`${label}-${measurement.head[index + 1]}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <ul className={styles.lessons}>
        {data.lessons.map((lesson) => (
          <li key={lesson.title}>
            <b>{lesson.title}.</b> {lesson.body}
          </li>
        ))}
      </ul>

      <p className={styles.closing}>{data.closing}</p>
    </div>
  );
}
