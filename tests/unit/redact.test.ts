import { describe, expect, it } from "vitest";
import { redactValue } from "~/lib/utils/redact";

describe("redactValue", () => {
  it("redacts sensitive keys", () => {
    const input = {
      authorization: "Bearer abcdef",
      nested: {
        apiKey: "sk_live_abc123456789",
        safe: "hello",
      },
    };

    const out = redactValue(input) as Record<string, unknown>;
    expect(out.authorization).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).safe).toBe("hello");
  });

  it("redacts sensitive token-like values", () => {
    const input = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def";
    expect(redactValue(input)).toBe("[REDACTED]");
  });
});
