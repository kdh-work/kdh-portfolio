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
          경력 전체가 B2B 엔터프라이즈 웹 콘솔과 데스크톱 환경입니다. 기존 코드와 운영을
          이어받아 점진적으로 개선하는 성격의 프로젝트가 많았습니다.
        </p>
        <ProjectList projects={workProjects} />
      </div>
    </section>
  );
}
