"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { liquidCopy, liquidSamples as samples } from "@/content/liquidExperiment";
import { stepWave, wavePath, waveStrengths } from "../model/wave";
import styles from "./LiquidBar.module.css";

export function LiquidBar() {
  const root = useRef<HTMLDivElement>(null);
  const impulse = useRef<(force: number) => void>(() => {});
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [strength, setStrength] = useState(1);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const paths = Array.from(host.querySelectorAll<SVGPathElement>("path[data-baseline]"));
    const sections = Array.from(host.querySelectorAll<HTMLElement>("[data-wave-section]"));
    const visible = new Set<Element>();
    let frame = 0, velocity = 0, offset = 0, phase = 0, lastTime = 0;
    let lastY = window.scrollY;
    const enabled = playing && !reduced && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (rest = false) => {
      for (const path of paths) {
        const section = path.closest("[data-wave-section]");
        if (!rest && section && !visible.has(section)) continue;
        // 강도를 입력에 곱하면 빠른 스크롤에서 같은 상한으로 잘린다.
        // 정규화한 운동량에 최종 진폭을 적용해 강도별 차이를 보존한다.
        path.setAttribute("d", wavePath(Number(path.dataset.baseline), rest ? 0 : offset * strength, phase));
      }
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; velocity = 0; offset = 0; lastTime = 0; draw(true); };
    const tick = (now: number) => {
      frame = 0;
      if (!enabled || document.hidden || !visible.size) { stop(); return; }
      const dt = Math.min(2, Math.max(.25, lastTime ? (now - lastTime) / 16.667 : 1));
      lastTime = now;
      ({ velocity, offset } = stepWave(offset, velocity, dt));
      phase += .06 * dt;
      draw();
      if (Math.abs(velocity) + Math.abs(offset) < .015) { stop(); return; }
      frame = requestAnimationFrame(tick);
    };
    impulse.current = (force: number) => {
      if (!enabled || document.hidden || !visible.size) return;
      velocity = Math.max(-2, Math.min(2, velocity + force));
      if (!frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
    };
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      if (!visible.size) stop();
    }) : null;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) visible.add(section);
      observer?.observe(section);
    }
    if (!observer) sections.forEach(section => visible.add(section));
    const onScroll = () => { const y = window.scrollY; impulse.current((y - lastY) * .025); lastY = y; };
    const onVisibility = () => { lastY = window.scrollY; if (document.hidden) stop(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    draw(true);
    return () => {
      stop(); observer?.disconnect(); impulse.current = () => {};
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [playing, reduced, strength]);

  return <div ref={root} className={styles.experiment}>
    <div className={styles.toolbar}>
      <div className={styles.actions}>
        <button type="button" disabled={reduced} aria-pressed={playing && !reduced} onClick={() => setPlaying(value => !value)}>{playing ? "움직임 정지" : "움직임 재생"}</button>
        <button type="button" disabled={!playing || reduced} onClick={() => impulse.current(1.5)}>한 번 흔들기</button>
        <label>세기 <select value={strength} onChange={e => setStrength(Number(e.target.value))} disabled={reduced}>
          {waveStrengths.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
      </div>
      <span role="status">{reduced ? "시스템 설정에 따라 움직임 최소화" : playing ? "스크롤에 반응합니다" : "정지된 수면"}</span>
    </div>
    <p className={styles.hint}>{liquidCopy.hint}</p>
    {liquidCopy.variants.map(variant => <section key={variant.id} data-wave-section className={styles.variant}>
      <h2>{variant.title}</h2><p>{variant.body}</p>
      <div className={variant.id === "pipe" ? styles.pipe : styles.tanks}>
        {samples.map(sample => {
          const baseline = variant.id === "level" ? 100 - sample.value : 13;
          return <div key={sample.name} className={styles.sample} style={{ "--tone": sample.color, flex: variant.id === "pipe" ? sample.value : undefined } as CSSProperties}>
            <div className={styles.water}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path data-baseline={baseline} d={wavePath(baseline, 0, 0)} />
              </svg>
              {variant.id === "surface" ? <div className={styles.fixedText}><strong>{sample.value}</strong><span>{sample.name}</span></div> : null}
            </div>
            {variant.id !== "pipe" ? <div className={styles.caption}><span>{sample.name}</span><b>{sample.value}{variant.id === "level" ? "%" : "개"}</b></div> : null}
          </div>;
        })}
      </div>
      {variant.id === "pipe" ? <ul className={styles.legend}>{samples.map(sample => <li key={sample.name}><i style={{ background: sample.color }} />{sample.name} <b>{sample.value}%</b></li>)}</ul> : null}
    </section>)}
  </div>;
}
