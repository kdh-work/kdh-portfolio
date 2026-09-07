import type { Project } from "@/content/types";
import { ShotGrid } from "@/components/media/ShotGrid";
import styles from "./Projects.module.css";

/** 실무·개인 프로젝트가 같은 레이아웃을 쓴다. 차이는 데이터에만 있다. */
export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className={styles.list}>
      {projects.map((project) => (
        <article key={project.id} className={styles.item}>
          <div className={styles.when}>
            <b>{project.period}</b>
            {project.meta}
          </div>
          <div>
            <h3 className={styles.name}>{project.name}</h3>
            <p className={styles.role}>{project.role}</p>
            <ul className={styles.points}>
              {project.points.map((point, index) => (
                <li key={point}>
                  {point}
                  {index === 0 && project.detailHref ? (
                    <>
                      {" "}
                      <a href={project.detailHref}>(사례 연구)</a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {project.shots ? <ShotGrid shots={project.shots} note={project.shotsNote} /> : null}
            <p className={styles.stack}>{project.stack}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
