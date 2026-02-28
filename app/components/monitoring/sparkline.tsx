export function Sparkline({ values }: { values: Array<number | null> }) {
  const bars = "▁▂▃▄▅▆▇█";

  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) {
    return <span className="font-mono text-xs text-slate-400">-</span>;
  }

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = Math.max(1, max - min);

  const str = values
    .map((value) => {
      if (value == null || !Number.isFinite(value)) return "·";
      const index = Math.max(0, Math.min(7, Math.round(((value - min) / range) * 7)));
      return bars[index] ?? "·";
    })
    .join("");

  return <span className="font-mono text-xs text-slate-600">{str}</span>;
}
