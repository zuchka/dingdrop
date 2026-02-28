import { describe, expect, it } from "vitest";
import { ALERT_OPEN_FAILURES, ALERT_RESOLVE_SUCCESSES } from "~/lib/constants";

describe("alert defaults", () => {
  it("uses expected thresholds", () => {
    expect(ALERT_OPEN_FAILURES).toBe(3);
    expect(ALERT_RESOLVE_SUCCESSES).toBe(2);
  });
});
