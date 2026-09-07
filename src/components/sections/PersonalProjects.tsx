import { personalProjects } from "@/content/personalProjects";
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
          실무는 Vue였고, React와 Next.js는 개인 프로젝트에서 기획부터 단독으로 진행하며
          익히고 있습니다. 두 프로젝트 모두 진행 중입니다.
        </p>
        <ProjectList projects={personalProjects} />
      </div>
    </section>
  );
}
