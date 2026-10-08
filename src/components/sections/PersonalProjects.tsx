import { personalProjects } from "@/content/personalProjects";
import { liquidCopy } from "@/content/liquidExperiment";
import Link from "next/link";
import styles from "./Projects.module.css";
import { ProjectList } from "./ProjectList";
import block from "./Block.module.css";

export function PersonalProjects() {
  return (
    <section className={block.block} id="personal" aria-labelledby="personal-h">
      <div className="wrap">
        <h2 id="personal-h" className={block.heading}>
          개인 프로젝트
        </h2>
        <p className={block.lede}>
          React로 기획부터 개발까지 직접 진행하고 있는 프로젝트입니다. Robot Fleet Console은
          Next.js, My Games는 Vite를 사용했고, 두 프로젝트 모두 상태·API·도메인 구조를
          설계하며 계속 개발하고 있습니다.
        </p>
        <ProjectList projects={personalProjects} />
        <div className={styles.experiment}>
          <h3>{liquidCopy.mark}</h3>
          <p>{liquidCopy.link.note}</p>
          <Link href={liquidCopy.link.href}>{liquidCopy.link.label} →</Link>
        </div>
      </div>
    </section>
  );
}
