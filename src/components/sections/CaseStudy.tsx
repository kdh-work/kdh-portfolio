import {
  basis,
  caseStudyIntro,
  implementation,
  layers,
  outcomes,
  resetRule,
  stages,
} from "@/content/caseStudy";
import block from "./Block.module.css";
import styles from "./CaseStudy.module.css";

export function CaseStudy() {
  return (
    <section className={block.block} id="case" aria-labelledby="case-h">
      <div className="wrap">
        <h2 id="case-h" className={block.heading}>
          사례 연구 — 설정 구조를 두 번 다시 설계한 과정
        </h2>
        <p className={block.lede}>{caseStudyIntro}</p>

        <div className={block.body}>
          {stages.map((stage) => (
            <div
              key={stage.title}
              className={`${styles.stage} ${stage.final ? styles.final : ""}`}
            >
              <div className={styles.rail} />
              <div className={styles.txt}>
                <h3>{stage.title}</h3>
                <p className={styles.who}>{stage.who}</p>
                {stage.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}

          <figure className={styles.basis}>
            <blockquote>
              <p>{basis.quote}</p>
            </blockquote>
            <figcaption>{basis.caption}</figcaption>
          </figure>

          <div className={block.body}>
            <h3 className={styles.implTitle}>{implementation.title}</h3>
            <p className={block.lede}>{implementation.lede}</p>
            <ul className={styles.result}>
              {layers.map((layer) => (
                <li key={layer.title}>
                  <b>{layer.title}</b> · {layer.description}
                </li>
              ))}
            </ul>
            <p className={styles.rule}>{resetRule}</p>
            <ul className={styles.result}>
              {outcomes.map((outcome) => (
                <li key={outcome.highlight}>
                  {outcome.text} <b>{outcome.highlight}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
