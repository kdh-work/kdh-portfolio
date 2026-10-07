import type { Project } from "@/content/types";
import Link from "next/link";
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
            {project.points ? (
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
            ) : null}
            {project.groups ? (
              <ol className={styles.groups}>
                {project.groups.map((group) => (
                  <li key={group.title} className={styles.group}>
                    <h4 className={styles.groupTitle}>{group.title}</h4>
                    <p className={styles.groupSummary}>{group.summary}</p>
                    {group.points.length > 0 ? (
                      <details className={styles.more}>
                        <summary>
                          세부 근거 {group.points.length}건
                          <span className="sr"> — {group.title}</span>
                        </summary>
                        <ul className={styles.points}>
                          {group.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {project.links ? (
              <ul className={styles.links}>
                {project.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label} →</Link>
                    {link.note ? <span>{link.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {project.shots ? <ShotGrid shots={project.shots} note={project.shotsNote} /> : null}
            <p className={styles.stack}>{project.stack}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
