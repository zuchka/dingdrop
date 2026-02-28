import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { register } from "~/lib/auth.server";
import { createMonitor, listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { createOrgWithOwner } from "~/models/org.server";
import { disconnectDatabase, resetDatabase, uniqueValue } from "../../helpers/db";

describe("integration: monitor crud", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates monitor under org", async () => {
    const user = await register(`${uniqueValue("monitor-user")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: user.id, name: "Mon", slug: uniqueValue("mon") });

    const monitor = await createMonitor({
      orgId: org.id,
      name: "API health",
      url: "https://example.com",
      method: "GET",
      intervalSec: 60,
      timeoutMs: 10000,
      expectedStatusMode: "RANGE_2XX",
      expectedStatusCodes: null,
      bodyMatchType: "NONE",
      bodyMatchPattern: null,
      latencyWarnMs: null,
      tlsExpiryWarnDays: null,
    });

    expect(monitor.id).toBeTruthy();

    const monitors = await listMonitorsForOrg(org.id);
    expect(monitors).toHaveLength(1);
  });
});
