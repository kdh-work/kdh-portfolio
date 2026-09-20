import type { Metadata } from "next";
import Link from "next/link";
import { StudyFrame, StudyNotes } from "@/components/layout/StudyFrame";
import { overviewCopy } from "@/content/resourceOverview";
import { profile } from "@/content/profile";
import { ResourceOverview } from "@/features/resource-overview/ui/ResourceOverview";
import styles from "@/components/layout/DemoFrame.module.css";

export const metadata: Metadata = { title: `자원 현황·섹션 배치 — ${profile.name}`, description: overviewCopy.lede };
export default function ResourceOverviewPage() {
  return <StudyFrame copy={overviewCopy}>
    <div className="wrap"><ResourceOverview /></div>
    <StudyNotes title="담당 범위와 설계 판단" notes={overviewCopy.notes} />
    <aside className={styles.aside}><div className="wrap">
      <h2>{overviewCopy.experiment.title}</h2><p>{overviewCopy.experiment.body}</p>
      <Link href="/experiments/liquid-bar">{overviewCopy.experiment.label} →</Link>
    </div></aside>
  </StudyFrame>;
}
