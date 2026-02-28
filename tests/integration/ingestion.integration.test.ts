import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_WEBHOOK_BODY_BYTES } from "~/lib/constants";
import { prisma } from "~/lib/db.server";
import { register } from "~/lib/auth.server";
import { createEndpointForOrg } from "~/models/endpoint.server";
import { createOrgWithOwner } from "~/models/org.server";
import { ingestWebhook } from "~/services/ingestion.server";
import { disconnectDatabase, resetDatabase, uniqueValue } from "../helpers/db";

describe("integration: ingestion", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("captures webhook successfully", async () => {
    const user = await register(`${uniqueValue("ingest-user")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: user.id, name: "Ingest", slug: uniqueValue("ingest") });
    const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Hook" });

    const req = new Request(`http://localhost/i/${endpoint.key}?event=ping`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dingdrop-secret": endpoint.secret,
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "Vitest",
      },
      body: JSON.stringify({ hello: "world" }),
    });

    const stored = await ingestWebhook({ request: req, endpointKey: endpoint.key });
    expect(stored.endpointId).toBe(endpoint.id);

    const found = await prisma.webhookRequest.findUnique({ where: { id: stored.id } });
    expect(found).not.toBeNull();
    expect(found?.method).toBe("POST");
    expect(found?.sourceIp).toBe("1.2.3.4");
    expect(found?.contentType).toContain("application/json");
  });

  it("rejects invalid secret", async () => {
    const user = await register(`${uniqueValue("ingest-user2")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: user.id, name: "Ingest", slug: uniqueValue("ingest2") });
    const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Hook2" });

    const req = new Request(`http://localhost/i/${endpoint.key}`, {
      method: "POST",
      headers: { "x-dingdrop-secret": "bad" },
      body: "{}",
    });

    await expect(ingestWebhook({ request: req, endpointKey: endpoint.key })).rejects.toMatchObject({ status: 401 });
  });

  it("rejects inactive endpoint", async () => {
    const user = await register(`${uniqueValue("ingest-user3")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: user.id, name: "Ingest", slug: uniqueValue("ingest3") });
    const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Hook3" });

    await prisma.endpoint.update({ where: { id: endpoint.id }, data: { isActive: false } });

    const req = new Request(`http://localhost/i/${endpoint.key}`, {
      method: "POST",
      headers: { "x-dingdrop-secret": endpoint.secret },
      body: "{}",
    });

    await expect(ingestWebhook({ request: req, endpointKey: endpoint.key })).rejects.toMatchObject({ status: 403 });
  });

  it("rejects oversized payload", async () => {
    const user = await register(`${uniqueValue("ingest-user4")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: user.id, name: "Ingest", slug: uniqueValue("ingest4") });
    const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Hook4" });

    const bigBody = "x".repeat(MAX_WEBHOOK_BODY_BYTES + 1);
    const req = new Request(`http://localhost/i/${endpoint.key}`, {
      method: "POST",
      headers: { "x-dingdrop-secret": endpoint.secret },
      body: bigBody,
    });

    await expect(ingestWebhook({ request: req, endpointKey: endpoint.key })).rejects.toMatchObject({ status: 413 });
  });
});
