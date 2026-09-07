import type { Metadata } from "next";
import Link from "next/link";
import { layers } from "@/content/caseStudy";
import { demoIntro } from "@/content/demo";
import { profile } from "@/content/profile";
import { Wizard } from "@/features/settings-wizard/ui/Wizard";
import styles from "./demo.module.css";

export const metadata: Metadata = {
  title: `설정 위저드 데모 — ${profile.name}`,
  description: "조합이 화면 구성을 결정하는 설정 위저드 구조를 직접 조작해볼 수 있는 데모.",
};

export default function DemoPage() {
  return (
    <>
      <header className={styles.top}>
        <div className={`wrap ${styles.topInner}`}>
          <span className={styles.mark}>{profile.name} · 설정 위저드 데모</span>
          <Link href="/">포트폴리오로 돌아가기</Link>
        </div>
      </header>

      <div className={`wrap ${styles.intro}`}>
        <h1>{demoIntro.title}</h1>
        {demoIntro.paragraphs.map((paragraph) => (
          <p key={paragraph} className={styles.lede}>
            {paragraph}
          </p>
        ))}
        <p className={styles.disclosure}>{demoIntro.disclosure}</p>
      </div>

      <div className={styles.layers}>
        <div className="wrap">
          <h2>조건이 해석되는 세 층</h2>
          <ol>
            {layers.map((layer) => (
              <li key={layer.title}>
                <span
                  className={`${styles.tag} ${layer.kind === "반응" ? styles.tagReactive : ""}`}
                >
                  {layer.kind}
                </span>
                <span>
                  <b>{layer.title}.</b> {layer.description}합니다.
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <main className={styles.stage}>
        <div className="wrap">
          <Wizard />
        </div>
      </main>
    </>
  );
}
