export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimestamp(value: string | Date) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  const abs = date.toLocaleString();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
    ["second", 1000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === "second") {
      const value = Math.round(diffMs / ms);
      return `${rtf.format(value, unit)} (${abs})`;
    }
  }

  return abs;
}
