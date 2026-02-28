function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function generateCurlCommand({
  url,
  method,
  headers,
  body,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | null;
}) {
  const parts: string[] = ["curl", "-X", method.toUpperCase(), shellEscape(url)];

  for (const [key, value] of Object.entries(headers)) {
    parts.push("-H", shellEscape(`${key}: ${value}`));
  }

  if (body && body.length > 0) {
    parts.push("--data-raw", shellEscape(body));
  }

  return parts.join(" ");
}
