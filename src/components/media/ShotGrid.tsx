"use client";

import Image from "next/image";
import type { Shot } from "@/content/types";
import { withBasePath } from "@/lib/paths";
import { useLightbox } from "./Lightbox";
import styles from "./ShotGrid.module.css";

type Props = { shots: Shot[]; note?: string };

export function ShotGrid({ shots, note }: Props) {
  const openLightbox = useLightbox();

  return (
    <>
      <div className={styles.grid}>
        {shots.map((shot, index) => (
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
        ))}
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </>
  );
}
