export const panelIds = ["summary", "resources", "detail"] as const;
export type PanelId = (typeof panelIds)[number];
export type LayoutMode = "grid" | "order";
export type Layout = { order: PanelId[]; widths: Record<PanelId, 6 | 12> };
export const initialLayout = (): Layout => ({ order: [...panelIds], widths: { summary: 12, resources: 6, detail: 6 } });

export function movePanel(layout: Layout, id: PanelId, to: number): Layout {
  const from = layout.order.indexOf(id);
  if (from < 0 || to < 0 || to >= layout.order.length || from === to) return layout;
  const order = [...layout.order];
  order.splice(from, 1);
  order.splice(to, 0, id);
  return { ...layout, order };
}

/** 공개 데모 전용 저장값. 손상되거나 형식이 다르면 기본 배치로 복구한다. */
export function parseLayout(value: unknown): Layout {
  const fallback = initialLayout();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<Layout>;
  if (!Array.isArray(candidate.order) || candidate.order.length !== panelIds.length ||
      new Set(candidate.order).size !== panelIds.length || !panelIds.every(id => candidate.order!.includes(id))) return fallback;
  return { order: [...candidate.order], widths: Object.fromEntries(panelIds.map(id => [id, candidate.widths?.[id] === 6 ? 6 : 12])) as Layout["widths"] };
}
