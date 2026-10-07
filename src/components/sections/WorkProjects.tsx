import { workProjects } from "@/content/workProjects";
import { ProjectList } from "./ProjectList";
import block from "./Block.module.css";

export function WorkProjects() {
  return (
    <section className={block.block} id="work" aria-labelledby="work-h">
      <div className="wrap">
        <h2 id="work-h" className={block.heading}>
          실무 프로젝트
        </h2>
        <p className={block.lede}>
          항목이 많은 프로젝트는 주제별로 묶었습니다. 각 주제의 세부 근거는 펼쳐서 볼 수
          있습니다.
        </p>
        <ProjectList projects={workProjects} />
      </div>
    </section>
  );
}
