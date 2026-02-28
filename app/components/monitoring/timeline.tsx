import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";

export function Timeline({
  points,
}: {
  points: Array<{
    ok: boolean;
    latencyMs: number | null;
    startedAt: string | Date;
  }>;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border bg-slate-50 text-sm text-slate-600">
        No timeline data yet.
      </div>
    );
  }

  // Prepare data for the chart
  const chartData = points.map((point, index) => {
    const date = new Date(point.startedAt);
    return {
      timestamp: date.getTime(),
      time: date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fullTime: date.toLocaleString(),
      latency: point.latencyMs ?? 0,
      status: point.ok ? 1 : 0,
      statusLabel: point.ok ? "UP" : "DOWN",
      // Create a visual indicator value for status
      statusBar: point.ok ? null : 100, // Show bar at top when DOWN
      index,
    };
  });

  const maxLatency = Math.max(
    100,
    ...chartData.map((d) => d.latency).filter((v) => v > 0)
  );

  return (
    <div className="space-y-4">
      {/* Status Timeline */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-slate-700">
          Availability Status
        </h3>
        <ChartContainer
          config={{
            status: {
              label: "Status",
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-[80px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="statusGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis hide domain={[0, 1]} />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
                      <div className="text-xs font-medium text-slate-900">
                        {data.fullTime}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            data.status === 1 ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-xs text-slate-600">Status:</span>
                        <span
                          className={`text-xs font-medium ${
                            data.status === 1
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {data.statusLabel}
                        </span>
                      </div>
                      {data.latency > 0 && (
                        <div className="mt-1 text-xs text-slate-600">
                          Latency: <span className="font-medium">{data.latency}ms</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="stepAfter"
                dataKey="status"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#statusGradient)"
                isAnimationActive={false}
              />
              {/* Failure indicators */}
              <Area
                type="stepAfter"
                dataKey="statusBar"
                stroke="#ef4444"
                strokeWidth={0}
                fill="#ef4444"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Latency Chart */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-slate-700">
          Response Time (ms)
        </h3>
        <ChartContainer
          config={{
            latency: {
              label: "Latency",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[180px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                domain={[0, maxLatency * 1.1]}
                tickFormatter={(value) => `${Math.round(value)}ms`}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
                      <div className="text-xs font-medium text-slate-900">
                        {data.fullTime}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-xs text-slate-600">Latency:</span>
                        <span className="text-xs font-medium text-slate-900">
                          {data.latency}ms
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            data.status === 1 ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-xs text-slate-600">Status:</span>
                        <span
                          className={`text-xs font-medium ${
                            data.status === 1
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {data.statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorLatency)"
                isAnimationActive={false}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={payload.status === 1 ? "#10b981" : "#ef4444"}
                      stroke="white"
                      strokeWidth={1}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
