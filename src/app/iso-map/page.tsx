import type { Metadata } from "next";
import Link from "next/link";
import { isoMapIntro, isoMapLayers, vpcResourceMap } from "@/content/isoMap";
import { profile } from "@/content/profile";
import { LabelStudy } from "@/features/iso-map/ui/LabelStudy";
import { RendererComparison } from "@/features/iso-map/ui/RendererComparison";
import { VpcIsoMap } from "@/features/iso-map/ui/VpcIsoMap";
import styles from "@/components/layout/DemoFrame.module.css";

export const metadata: Metadata = {
  title: `자원 관계도 데모 — ${profile.name}`,
  description:
    "클라우드 자원의 계층 관계를 아이소메트릭 투영으로 그린 관계도 데모. 3D 와 평면도를 같은 데이터로 전환할 수 있습니다.",
};

export default function IsoMapPage() {
  return (
    <>
      <header className={styles.top}>
        <div className="wrap">
          <div className={styles.topInner}>
            <span className={styles.mark}>{profile.name} · 자원 관계도 데모</span>
            <Link href="/">포트폴리오로 돌아가기</Link>
          </div>
        </div>
      </header>

      <div className={styles.intro}>
        <div className="wrap">
          <h1>{isoMapIntro.title}</h1>
          {isoMapIntro.paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.lede}>
              {paragraph}
            </p>
          ))}
          <p className={styles.disclosure}>{isoMapIntro.disclosure}</p>
        </div>
      </div>

      <div className={styles.layers}>
        <div className="wrap">
          <h2>관계도가 해석하는 세 가지 관계</h2>
          <ol>
            {isoMapLayers.map((layer) => (
              <li key={layer.title}>
                <span
                  className={`${styles.tag} ${layer.kind === "참조" ? styles.tagReactive : ""}`}
                >
                  {layer.kind}
                </span>
                <span>
                  <b>{layer.title}.</b> {layer.description}.
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <main className={styles.stage}>
        <div className="wrap">
          <VpcIsoMap source={vpcResourceMap} />
        </div>
      </main>

      <section className={styles.study} aria-labelledby="renderer-h">
        <div className="wrap">
          <h2 id="renderer-h">검토 기록 — SVG 와 WebGL 을 둘 다 만들어 본 결과</h2>
          <RendererComparison />
        </div>
      </section>

      <section className={styles.study} aria-labelledby="label-study-h">
        <div className="wrap">
          <h2 id="label-study-h">검토 기록 — 구획 이름을 어디에 둘 것인가</h2>
          <LabelStudy />
        </div>
      </section>
    </>
  );
}
