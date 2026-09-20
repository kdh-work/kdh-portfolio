"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { overviewUI as copy, resourceExamples, resourceStates, type ResourceState } from "@/content/resourceOverview";
import { initialLayout, movePanel, panelIds, parseLayout, type Layout, type LayoutMode, type PanelId } from "../model/layout";
import styles from "./ResourceOverview.module.css";

const totalOf = (counts: Record<ResourceState, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
const total = resourceExamples.reduce((sum, row) => sum + totalOf(row.counts), 0);
const totals = Object.fromEntries(resourceStates.map(state => [state.id, resourceExamples.reduce((sum, row) => sum + row.counts[state.id], 0)])) as Record<ResourceState, number>;
const storageKey = "portfolio:overview-layout:v1";
type Gesture = { id: PanelId; kind: "move" | "resize"; x: number; width: number; container: number; nextWidth: 6 | 12 };

export function ResourceOverview() {
  const [filter, setFilter] = useState<ResourceState | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [mode, setMode] = useState<LayoutMode>("grid");
  const [layouts, setLayouts] = useState<Record<LayoutMode, Layout>>({ grid: initialLayout(), order: initialLayout() });
  const [history, setHistory] = useState<Record<LayoutMode, Layout[]>>({ grid: [], order: [] });
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [over, setOver] = useState<PanelId | null>(null);
  const [resizing, setResizing] = useState<{ id: PanelId; width: 6 | 12 } | null>(null);
  const rows = useRef<Record<string, HTMLButtonElement | null>>({});
  const detail = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layout = layouts[mode];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object") {
        setLayouts({ grid: parseLayout(saved.grid), order: parseLayout(saved.order) });
        setMode(saved.mode === "order" ? "order" : "grid");
      }
    } catch { /* 읽기 불가·손상 시 기본 배치 */ }
    setReady(true);
    return () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ ...layouts, mode })); }
    catch { setNotice("브라우저 저장을 사용할 수 없어 이번 방문에서만 배치를 유지합니다."); }
  }, [layouts, mode, ready]);

  useEffect(() => {
    if (!highlight) return;
    const el = rows.current[highlight];
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) el.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [highlight, filter]);

  function change(next: Layout) {
    if (JSON.stringify(next) === JSON.stringify(layout)) return;
    setHistory(prev => ({ ...prev, [mode]: [...prev[mode], layout].slice(-30) }));
    setLayouts(prev => ({ ...prev, [mode]: next }));
  }
  function move(id: PanelId, direction: number) {
    const to = layout.order.indexOf(id) + direction;
    change(movePanel(layout, id, to));
    if (to >= 0 && to < panelIds.length) setNotice(`${copy.panels[id]} 섹션을 ${to + 1}번째로 이동했습니다.`);
  }
  function chooseFilter(next: typeof filter) {
    setFilter(next); setHighlight(null);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }
  function chooseChip(state: ResourceState, id: string) {
    setFilter(state); setHighlight(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlight(null), 1800);
  }
  function start(event: PointerEvent<HTMLButtonElement>, id: PanelId, kind: Gesture["kind"]) {
    if (event.button !== 0 || !ready) return;
    const panel = event.currentTarget.closest<HTMLElement>("[data-panel]");
    if (!panel || !grid.current) return;
    gesture.current = { id, kind, x: event.clientX, width: panel.getBoundingClientRect().width, container: grid.current.getBoundingClientRect().width, nextWidth: layout.widths[id] };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function track(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "resize") {
      active.nextWidth = active.width + event.clientX - active.x > active.container * .75 ? 12 : 6;
      setResizing({ id: active.id, width: active.nextWidth });
    } else {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-panel]")?.dataset.panel;
      setOver(panelIds.includes(target as PanelId) ? target as PanelId : null);
    }
  }
  function end(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const active = gesture.current;
    if (!active) return;
    if (!cancel) {
      if (active.kind === "resize") change({ ...layout, widths: { ...layout.widths, [active.id]: active.nextWidth } });
      else {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-panel]")?.dataset.panel as PanelId | undefined;
        if (target) change(movePanel(layout, active.id, layout.order.indexOf(target)));
      }
    }
    gesture.current = null; setOver(null); setResizing(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const visible = resourceExamples.filter(row => filter === "all" || row.counts[filter] > 0);
  const selectedRow = resourceExamples.find(row => row.id === selected);
  const filterName = filter === "all" ? copy.all : resourceStates.find(state => state.id === filter)!.label;

  function body(id: PanelId) {
    if (id === "summary") return <>
      <p className={styles.hint}>{copy.summaryNote}</p>
      <div className={styles.bar} aria-label="전체 자원의 상태별 비율">
        {resourceStates.map(state => totals[state.id] > 0 ? <button key={state.id} type="button"
          style={{ flex: totals[state.id], background: state.color }} onClick={() => chooseFilter(state.id)}
          aria-label={`${state.label} ${totals[state.id]}개로 필터`} aria-pressed={filter === state.id}
          title={`${state.label} ${totals[state.id]}개 · ${Math.round(totals[state.id] / total * 100)}%`} /> : null)}
      </div>
      <div className={styles.statuses}>
        <div className={styles.status} data-active={filter === "all"}>
          <button type="button" className={styles.statusButton} onClick={() => chooseFilter("all")} aria-pressed={filter === "all"}>
            <span>{copy.all}</span><strong>{total}<small>개</small></strong><span>전체의 100%</span>
          </button><p className={styles.hint}>자원 유형 {resourceExamples.length}종</p>
        </div>
        {resourceStates.map(state => <div key={state.id} className={styles.status} data-active={filter === state.id}>
          <button type="button" className={styles.statusButton} onClick={() => chooseFilter(state.id)} aria-pressed={filter === state.id}>
            <span><i style={{ background: state.color }} />{state.label}</span><strong>{totals[state.id]}<small>개</small></strong>
            <span>전체의 {Math.round(totals[state.id] / total * 100)}%</span>
          </button>
          <div className={styles.chips}>{resourceExamples.filter(row => row.counts[state.id] > 0).slice(0, 2).map(row =>
            <button type="button" key={row.id} onClick={() => chooseChip(state.id, row.id)} aria-label={`${state.label} · ${row.name} 찾기`}>{row.name} {row.counts[state.id]}</button>)}</div>
        </div>)}
      </div>
    </>;
    if (id === "resources") return <>
      <p className={styles.hint} aria-live="polite">{filterName} · {filter === "all" ? total : totals[filter]}개 / 전체 {total}개</p>
      <div className={styles.rows}>{visible.length ? visible.map(row => <button type="button" key={row.id}
        ref={el => { rows.current[row.id] = el; }} className={styles.row} data-highlight={highlight === row.id}
        onClick={() => { setSelected(row.id); requestAnimationFrame(() => { detail.current?.focus({ preventScroll: true }); detail.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }); }}>
        <span>{row.name}<small>{filter === "all" ? "전체 상태" : filterName}</small></span>
        <strong>{filter === "all" ? totalOf(row.counts) : `${row.counts[filter]} / ${totalOf(row.counts)}`}<small>개 →</small></strong>
      </button>) : <p className={styles.empty}>{copy.empty}</p>}</div>
    </>;
    return <div ref={detail} tabIndex={-1} aria-label="선택한 자원 유형 상세">
      {selectedRow ? <><h3 className={styles.selectedTitle}>{selectedRow.name} · 전체 {totalOf(selectedRow.counts)}개</h3>
        <dl className={styles.detail}>{resourceStates.map(state => <div key={state.id}><dt>{state.label}</dt><dd>{selectedRow.counts[state.id]}개</dd></div>)}</dl>
        <p className={styles.hint}>{copy.mock}</p></> : <p className={styles.empty}>{copy.detailEmpty}</p>}
    </div>;
  }

  return <div className={styles.demo}>
    <div className={styles.toolbar}>
      <div role="group" aria-label={copy.modeLabel} className={styles.buttons}>
        {copy.modes.map(item => <button type="button" key={item.id} disabled={!ready} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}
      </div>
      <div className={styles.buttons}>
        <button type="button" disabled={!history[mode].length} onClick={() => {
          const previous = history[mode].at(-1);
          if (previous) { setLayouts(prev => ({ ...prev, [mode]: previous })); setHistory(prev => ({ ...prev, [mode]: prev[mode].slice(0, -1) })); }
        }}>{copy.undo}</button>
        <button type="button" disabled={!ready} onClick={() => change(initialLayout())}>{copy.reset}</button>
      </div>
    </div>
    <p className={styles.instructions}>{mode === "grid" ? copy.gridHint : copy.orderHint}</p>
    <div ref={grid} className={styles.grid} data-mode={mode}>
      {layout.order.map((id, index) => <section key={id} data-panel={id} data-over={over === id} className={styles.panel}
        style={{ "--span": mode === "order" ? 12 : resizing?.id === id ? resizing.width : layout.widths[id] } as CSSProperties} aria-labelledby={`panel-${id}`}>
        <div className={styles.panelHead}>
          <h2 id={`panel-${id}`}>{copy.panels[id]}</h2>
          <div className={styles.controls}>
            {mode === "grid" ? <button type="button" className={styles.grip} aria-label={`${copy.panels[id]} 이동 손잡이`} title="끌어서 다른 섹션으로 이동 · 방향키로도 이동 가능"
              onPointerDown={e => start(e, id, "move")} onPointerMove={track} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)}
              onKeyDown={e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); move(id, e.key === "ArrowUp" ? -1 : 1); } }}>⠿</button> : null}
            <span className={styles.position}>{index + 1} / {panelIds.length}</span>
            {[-1, 1].map(direction => <button type="button" key={direction} aria-label={`${copy.panels[id]} ${direction === -1 ? "위로" : "아래로"}`}
              aria-disabled={index + direction < 0 || index + direction >= panelIds.length}
              onClick={() => move(id, direction)} onKeyDown={e => {
                if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); move(id, e.key === "ArrowUp" ? -1 : 1); }
              }}>{direction === -1 ? "↑" : "↓"}</button>)}
          </div>
        </div>
        <div className={styles.panelBody}>{body(id)}</div>
        {mode === "grid" ? <div className={styles.widthTools}>
          <div className={styles.buttons} role="group" aria-label={`${copy.panels[id]} 폭`}>
            {([6, 12] as const).map(width => <button type="button" key={width} aria-pressed={layout.widths[id] === width} onClick={() => change({ ...layout, widths: { ...layout.widths, [id]: width } })}>{width === 6 ? "반폭" : "전체 폭"}</button>)}
          </div>
          <button type="button" className={styles.grip} aria-label={`${copy.panels[id]} 폭 조절 손잡이`} title="좌우로 끌어 반폭·전체 폭 조절 · 좌우 방향키로도 조절 가능"
            onPointerDown={e => start(e, id, "resize")} onPointerMove={track} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)}
            onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); change({ ...layout, widths: { ...layout.widths, [id]: e.key === "ArrowLeft" ? 6 : 12 } }); } }}>↔</button>
        </div> : null}
      </section>)}
    </div>
    <p className={styles.hint}>배치만 이 브라우저에 저장됩니다. 필터와 선택한 유형은 새로고침하면 초기화됩니다.</p>
    <p className={styles.notice} role="status">{notice}</p>
  </div>;
}
