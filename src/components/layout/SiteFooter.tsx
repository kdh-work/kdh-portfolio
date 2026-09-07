import { profile } from "@/content/profile";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer} id="contact" aria-labelledby="contact-h">
      <div className="wrap">
        <h2 id="contact-h" className={styles.heading}>
          연락
        </h2>
        <div className={styles.contact}>
          <div>
            <span>이메일</span>
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </div>
          {/* 이력서 · 경력기술서 — PDF 준비 전까지 노출 보류
          <div>
            <span>이력서 · 경력기술서</span>
            {profile.docsHref ? (
              <a href={profile.docsHref} target="_blank" rel="noopener">
                PDF 내려받기
              </a>
            ) : (
              <p className={styles.pending}>PDF 준비 중</p>
            )}
          </div>
          */}
        </div>
        <p className={styles.updated}>
          {profile.name} · {profile.location} 거주 · {profile.education} · 최종 갱신{" "}
          {profile.updatedAt}
        </p>
      </div>
    </footer>
  );
}
