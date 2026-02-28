export function Timeline({
  points,
}: {
  points: Array<{ ok: boolean; latencyMs: number | null; startedAt: string | Date }>;
}) {
  if (points.length === 0) {
    return <div className="text-sm text-slate-600">No timeline data yet.</div>;
  }

  const width = 760;
  const height = 120;
  const pad = 12;

  const latencies = points.map((p) => p.latencyMs).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const maxLatency = Math.max(100, ...latencies);

  const xFor = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (width - pad * 2);
  const yFor = (latencyMs: number | null) => {
    if (latencyMs == null) return height - pad;
    return height - pad - (Math.min(latencyMs, maxLatency) / maxLatency) * (height - pad * 2);
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded border bg-slate-50">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" strokeWidth="1" />
      {points.map((point, i) => {
        const x = xFor(i);
        const y = yFor(point.latencyMs);
        const tooltip = `${new Date(point.startedAt).toLocaleString()} - ${
          point.ok ? "UP" : "DOWN"
        }${point.latencyMs != null ? ` - ${point.latencyMs}ms` : ""}`;

        return (
          <circle key={i} cx={x} cy={y} r={3} fill={point.ok ? "#059669" : "#dc2626"}>
            <title>{tooltip}</title>
          </circle>
        );
      })}
    </svg>
  );
}
