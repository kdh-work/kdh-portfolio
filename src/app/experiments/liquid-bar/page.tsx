import type { Metadata } from "next";
import Link from "next/link";
import { StudyFrame, StudyNotes } from "@/components/layout/StudyFrame";
import { liquidCopy } from "@/content/liquidExperiment";
import { profile } from "@/content/profile";
import { LiquidBar } from "@/features/liquid-bar/ui/LiquidBar";
import styles from "@/components/layout/DemoFrame.module.css";

export const metadata: Metadata = { title: `수면 인터랙션 실험 — ${profile.name}`, description: liquidCopy.lede };
export default function LiquidExperimentPage() {
  return <StudyFrame copy={liquidCopy}>
    <div className="wrap"><LiquidBar /></div>
    <StudyNotes title="실험에서 확인한 것과 남은 것" notes={liquidCopy.notes} />
    <div className={styles.aside}><div className="wrap"><Link href="/resource-overview">자원 현황·섹션 배치 데모로 이동 →</Link></div></div>
  </StudyFrame>;
}
