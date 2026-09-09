import { profile } from "@/content/profile";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "#career", label: "경력" },
  { href: "#case", label: "사례 연구" },
  { href: "#map", label: "자원 관계도" },
  { href: "#work", label: "실무 프로젝트" },
  { href: "#personal", label: "개인 프로젝트" },
  { href: "#stack", label: "사용 기술" },
  { href: "#contact", label: "연락" },
];

export function SiteHeader() {
  return (
    <header className={styles.top}>
      <div className="wrap">
        <div className={styles.inner}>
          <p className={styles.wordmark}>
            {profile.name}
            <span>{profile.role}</span>
          </p>
          <nav aria-label="문서 내 이동">
            <ul className={styles.nav}>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
