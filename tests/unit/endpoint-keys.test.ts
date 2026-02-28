import { describe, expect, it } from "vitest";
import { generateEndpointKey, generateEndpointSecret } from "~/lib/utils/endpoint-keys";

describe("endpoint key/secret generation", () => {
  it("generates keys with expected prefix and uniqueness", () => {
    const keys = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const key = generateEndpointKey();
      expect(key.startsWith("dd_")).toBe(true);
      expect(key.length).toBeGreaterThan(10);
      keys.add(key);
    }

    expect(keys.size).toBe(1000);
  });

  it("generates secrets with expected prefix and uniqueness", () => {
    const secrets = new Set<string>();

    for (let i = 0; i < 500; i++) {
      const secret = generateEndpointSecret();
      expect(secret.startsWith("dds_")).toBe(true);
      expect(secret.length).toBeGreaterThan(20);
      secrets.add(secret);
    }

    expect(secrets.size).toBe(500);
  });
});
