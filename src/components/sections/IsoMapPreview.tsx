import Link from "next/link";
import { isoMapPreviewCopy as copy, vpcResourceMap } from "@/content/isoMap";
import { VpcIsoMap } from "@/features/iso-map/ui/VpcIsoMap";
import styles from "./IsoMapPreview.module.css";

/**
 * 메인 페이지의 자원 관계도 미리보기.
 *
 * 데모 페이지와 **같은 어댑터·같은 렌더러·같은 데이터**를 쓴다. 미리보기용으로
 * 축약한 사본을 두지 않으므로 두 화면이 어긋날 수 없다. `MatrixPreview` 가
 * 데모 페이지와 registry 를 공유하는 것과 같은 방식이다.
 */
export function IsoMapPreview() {
  return (
    <section className={styles.demo} id="map" aria-labelledby="map-h">
      <div className="wrap">
        <div className={styles.head}>
          <h2 id="map-h">{copy.title}</h2>
          <p>{copy.lede}</p>
        </div>

        <VpcIsoMap source={vpcResourceMap} initialZoom={0.85} />

        <p className={styles.note}>
          <Link href="/iso-map">{copy.demoLink}</Link> — {copy.demoLinkNote}
        </p>
        <p className={styles.note}>{copy.note}</p>
      </div>
    </section>
  );
}
