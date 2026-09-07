import { techGroups } from "@/content/personalProjects";
// import { notYetExperienced } from "@/content/personalProjects"; // 미경험 영역 노출 보류
import block from "./Block.module.css";
import styles from "./TechStack.module.css";

export function TechStack() {
  return (
    <section className={block.block} id="stack" aria-labelledby="stack-h">
      <div className="wrap">
        <h2 id="stack-h" className={block.heading}>
          사용 기술 정리
        </h2>
        <p className={block.lede}>
          앞의 프로젝트에서 실제로 사용한 것만 적었습니다. 실무에서 운영까지 경험한 것과 개인
          프로젝트에서 사용한 것을 구분하고, 아직 경험하지 않은 영역도 함께 표기합니다.
        </p>

        <div className={`${block.body} ${styles.grid}`}>
          {techGroups.map((group) => (
            <div key={group.title} className={styles.col}>
              <h3>{group.title}</h3>
              <dl>
                {group.entries.map((entry) => (
                  <div key={entry.term}>
                    <dt>{entry.term}</dt>
                    <dd>{entry.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* 아직 경험하지 않은 영역 — 노출 보류. 다시 보이게 하려면 주석만 풀면 된다.
        <div className={styles.honest}>
          <h3>아직 경험하지 않은 영역</h3>
          <ul>
            {notYetExperienced.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        */}
      </div>
    </section>
  );
}
