"use client";

import Image from "next/image";
import type { Shot } from "@/content/types";
import { Fold } from "@/components/ui/Fold";
import { withBasePath } from "@/lib/paths";
import { useLightbox } from "./Lightbox";
import styles from "./ShotGrid.module.css";

type Props = {
  shots: Shot[];
  /** 처음부터 보이는 장 수. 나머지는 펼쳐서 보고, 확대 보기에서는 전부 넘겨 볼 수 있다. */
  visible?: number;
  note?: string;
};

export function ShotGrid({ shots, visible = shots.length, note }: Props) {
  const openLightbox = useLightbox();
  const hidden = shots.length - visible;

  const renderShot = (shot: Shot, index: number) => (
    <figure key={shot.src} className={styles.shot}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => openLightbox({ shots, index })}
        aria-label={`${shot.caption} 확대해서 보기`}
      >
        <Image
          src={withBasePath(shot.src)}
          width={shot.width}
          height={shot.height}
          alt={shot.alt}
          className={styles.image}
          sizes="(max-width: 760px) 100vw, 50vw"
        />
      </button>
      <figcaption className={styles.caption}>
        {shot.route ? <code>{shot.route}</code> : null}
        {shot.caption}
      </figcaption>
    </figure>
  );

  return (
    <>
      <div className={styles.grid}>{shots.slice(0, visible).map(renderShot)}</div>
      {hidden > 0 ? (
        <div className={styles.more}>
          <Fold label={`화면 ${hidden}장 더 보기`}>
            <div className={`${styles.grid} ${styles.moreGrid}`}>
              {shots.slice(visible).map((shot, offset) => renderShot(shot, visible + offset))}
            </div>
          </Fold>
        </div>
      ) : null}
      {note ? <p className={styles.note}>{note}</p> : null}
    </>
  );
}
