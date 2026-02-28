import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isBlockedIp(host: string) {
  if (host === "::1") return true;
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;

  if (isIP(host) === 4) {
    return isPrivateIpv4(host);
  }

  return false;
}

export function validateMonitorTargetUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "URL is invalid." } as const;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, error: "Only http and https URLs are allowed." } as const;
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || isBlockedIp(host)) {
    return { ok: false, error: "Target host is blocked by monitoring policy." } as const;
  }

  return { ok: true, url } as const;
}

export async function validateMonitorTargetUrlWithDns(value: string) {
  const basic = validateMonitorTargetUrl(value);
  if (!basic.ok) {
    return basic;
  }

  const host = basic.url.hostname;
  if (isIP(host)) {
    return basic;
  }

  try {
    const resolved = await lookup(host, { all: true });
    for (const entry of resolved) {
      if (isBlockedIp(entry.address)) {
        return { ok: false, error: "Resolved target address is blocked by monitoring policy." } as const;
      }
    }
  } catch {
    return { ok: false, error: "Failed to resolve target host." } as const;
  }

  return basic;
}
