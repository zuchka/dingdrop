import { createServer } from "node:http";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "~/lib/db.server";
import { register } from "~/lib/auth.server";
import { createEndpointForOrg } from "~/models/endpoint.server";
import { createOrgWithOwner } from "~/models/org.server";
import { createWebhookRequest } from "~/models/webhook-request.server";
import { replayWebhook } from "~/services/replay.server";
import { disconnectDatabase, resetDatabase, uniqueValue } from "../helpers/db";

describe("integration: replay", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("logs successful replay attempt", async () => {
    let receivedMethod = "";
    let receivedHeaders: Record<string, string | string[] | undefined> = {};
    let receivedBody = "";

    const server = createServer((req, res) => {
      receivedMethod = req.method ?? "";
      receivedHeaders = req.headers;

      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk.toString();
      });
      req.on("end", () => {
        receivedBody = raw;
        res.statusCode = 202;
        res.setHeader("content-type", "text/plain");
        res.end("accepted");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const targetUrl = `http://127.0.0.1:${port}/target`;

    try {
      const user = await register(`${uniqueValue("replay-user")}@example.com`, "strong-password");
      const org = await createOrgWithOwner({ userId: user.id, name: "Replay", slug: uniqueValue("replay") });
      const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Hook" });

      const webhook = await createWebhookRequest({
        endpointId: endpoint.id,
        method: "POST",
        path: "/i/test",
        query: null,
        headers: {
          "content-type": "application/json",
          "user-agent": "Vitest",
          authorization: "Bearer secret",
        },
        bodyRaw: Buffer.from('{"ping":true}'),
        bodyText: '{"ping":true}',
        bodyJson: { ping: true },
        contentType: "application/json",
        sourceIp: "127.0.0.1",
        userAgent: "Vitest",
        sizeBytes: 13,
      });

      const attempt = await replayWebhook({
        webhookRequest: {
          id: webhook.id,
          method: webhook.method,
          headers: webhook.headers,
          bodyRaw: Buffer.from(webhook.bodyRaw),
        },
        endpoint: { defaultReplayUrl: targetUrl },
        explicitTargetUrl: null,
      });

      expect(attempt.ok).toBe(true);
      expect(attempt.responseStatus).toBe(202);
      expect(receivedMethod).toBe("POST");
      expect(receivedBody).toBe('{"ping":true}');
      expect(receivedHeaders["content-type"]).toBe("application/json");
      expect(receivedHeaders["authorization"]).toBeUndefined();

      const logged = await prisma.replayAttempt.findUnique({ where: { id: attempt.id } });
      expect(logged).not.toBeNull();
      expect(logged?.ok).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  it("logs failed replay attempt", async () => {
    const user = await register(`${uniqueValue("replay-user2")}@example.com`, "strong-password");
    const org = await createOrgWithOwner({ userId: user.id, name: "Replay", slug: uniqueValue("replay2") });
    const endpoint = await createEndpointForOrg({ orgId: org.id, name: "Hook2" });

    const webhook = await createWebhookRequest({
      endpointId: endpoint.id,
      method: "POST",
      path: "/i/test",
      query: null,
      headers: { "content-type": "application/json" },
      bodyRaw: Buffer.from('{"ping":true}'),
      bodyText: '{"ping":true}',
      bodyJson: { ping: true },
      contentType: "application/json",
      sourceIp: "127.0.0.1",
      userAgent: "Vitest",
      sizeBytes: 13,
    });

    const attempt = await replayWebhook({
      webhookRequest: {
        id: webhook.id,
        method: webhook.method,
        headers: webhook.headers,
        bodyRaw: Buffer.from(webhook.bodyRaw),
      },
      endpoint: { defaultReplayUrl: "http://127.0.0.1:1/unreachable" },
      explicitTargetUrl: null,
    });

    expect(attempt.ok).toBe(false);
    expect(attempt.errorMessage).toBeTruthy();

    const logged = await prisma.replayAttempt.findUnique({ where: { id: attempt.id } });
    expect(logged?.ok).toBe(false);
    expect(logged?.errorMessage).toBeTruthy();
  });
});
