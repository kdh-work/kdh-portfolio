import Link from "next/link";
import type { ReactNode } from "react";
import { profile } from "@/content/profile";
import styles from "./DemoFrame.module.css";

/** 기존 데모의 프레임을 공유한다. 문구는 content에서 전달한다. */
export function StudyFrame({ copy, children }: {
  copy: { mark: string; title: string; lede: string; disclosure: string };
  children: ReactNode;
}) {
  return <>
    <header className={styles.top}><div className="wrap"><div className={styles.topInner}>
      <span className={styles.mark}>{profile.name} · {copy.mark}</span>
      <Link href="/">포트폴리오로 돌아가기</Link>
    </div></div></header>
    <main>
      <div className={styles.intro}><div className="wrap">
        <h1>{copy.title}</h1><p className={styles.lede}>{copy.lede}</p>
        <p className={styles.disclosure}>{copy.disclosure}</p>
      </div></div>
      {children}
    </main>
  </>;
}

export function StudyNotes({ title, notes }: { title: string; notes: readonly { title: string; body: string }[] }) {
  return <section className={styles.study}><div className="wrap">
    <h2>{title}</h2>
    <div className={styles.noteGrid}>{notes.map((note) => <article key={note.title}>
      <h3>{note.title}</h3><p>{note.body}</p>
    </article>)}</div>
  </div></section>;
}
