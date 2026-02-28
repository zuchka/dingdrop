import { describe, expect, it } from "vitest";
import { validateMonitorTargetUrl } from "~/services/monitoring/target-policy.server";

describe("validateMonitorTargetUrl", () => {
  it("allows public https urls", () => {
    const out = validateMonitorTargetUrl("https://example.com/health");
    expect(out.ok).toBe(true);
  });

  it("blocks localhost", () => {
    const out = validateMonitorTargetUrl("http://localhost:3000/health");
    expect(out.ok).toBe(false);
  });

  it("blocks private ipv4", () => {
    const out = validateMonitorTargetUrl("http://10.0.0.1/health");
    expect(out.ok).toBe(false);
  });
});
