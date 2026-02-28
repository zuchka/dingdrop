import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "~/lib/crypto.server";

describe("monitor channel crypto", () => {
  it("roundtrips config payload", () => {
    const input = { webhookUrl: "https://example.com/hook", token: "abc123" };
    const encoded = encryptJson(input);
    const decoded = decryptJson<Record<string, unknown>>(encoded);

    expect(decoded).toEqual(input);
  });
});
