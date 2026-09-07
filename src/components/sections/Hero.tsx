import { profile } from "@/content/profile";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <div className={`wrap ${styles.hero}`}>
      <h1 className={styles.headline}>{profile.headline}</h1>
      <p className={styles.lede}>{profile.lede}</p>
      <ul className={styles.meta}>
        {profile.facts.map((fact) => (
          <li key={fact.label}>
            <b>{fact.label}</b>
            {fact.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
