import { companies, careerFacts } from "@/content/profile";
import styles from "./CareerSummary.module.css";

export function CareerSummary() {
  return (
    <section className={styles.career} id="career" aria-labelledby="career-h">
      <div className="wrap">
        <h2 id="career-h" className={styles.heading}>
          경력 요약
        </h2>

        <div className={styles.grid}>
          {companies.map((company) => (
            <div key={company.name} className={styles.company}>
              <div>
                <h3 className={styles.companyName}>{company.name}</h3>
                <p className={styles.companyMeta}>
                  {company.period} · {company.department} · {company.title}
                </p>
              </div>
              <ul className={styles.projects}>
                {company.projects.map((project) => (
                  <li key={project.name}>
                    <span className={styles.projectName}>{project.name}</span>
                    <span className={styles.projectPeriod}>{project.period}</span>
                    <span className={styles.projectRole}>{project.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <dl className={styles.facts}>
          {careerFacts.map((fact) => (
            <div key={fact.term}>
              <dt>{fact.term}</dt>
              <dd>{fact.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
