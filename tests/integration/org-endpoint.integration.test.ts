import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { register } from "~/lib/auth.server";
import { createEndpointForOrg, getEndpointsForOrg } from "~/models/endpoint.server";
import { createOrgWithOwner, requireOrgMember } from "~/models/org.server";
import { disconnectDatabase, resetDatabase, uniqueValue } from "../helpers/db";

describe("integration: org + endpoint", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates org with owner membership and enforces membership", async () => {
    const owner = await register(`${uniqueValue("owner")}@example.com`, "strong-password");
    const outsider = await register(`${uniqueValue("outsider")}@example.com`, "strong-password");
    const slug = uniqueValue("org");

    const org = await createOrgWithOwner({
      userId: owner.id,
      name: "Acme",
      slug,
    });

    const allowed = await requireOrgMember(owner.id, org.slug);
    expect(allowed.id).toBe(org.id);

    await expect(requireOrgMember(outsider.id, org.slug)).rejects.toBeInstanceOf(Response);
  });

  it("creates endpoint and lists it for org", async () => {
    const owner = await register(`${uniqueValue("owner2")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: owner.id, name: "Beta", slug: uniqueValue("beta") });

    const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Primary" });
    expect(endpoint.key.startsWith("dd_")).toBe(true);
    expect(endpoint.secret.startsWith("dds_")).toBe(true);

    const endpoints = await getEndpointsForOrg(org.id);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]?.id).toBe(endpoint.id);
  });
});
