export function renderBars(root: HTMLElement, probs: Record<string, number>) {
  const entries = Object.entries(probs).sort((a,b) => b[1]-a[1]);
  root.innerHTML = entries.map(([k,v]) => {
    const pct = Math.round(v * 100);
    return `
      <div style="display:flex;gap:10px;align-items:center;margin:6px 0;">
        <div style="width:90px;opacity:.9">${k}</div>
        <div style="flex:1;height:10px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:rgba(255,255,255,.85);transition: width 180ms ease;"></div>
        </div>
        <div style="width:44px;text-align:right;opacity:.9">${pct}%</div>
      </div>
    `;
  }).join("");
}
