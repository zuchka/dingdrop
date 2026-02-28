import { describe, expect, it } from "vitest";
import { buildReplayHeaders } from "~/services/replay.server";

describe("buildReplayHeaders", () => {
  it("keeps only allowlisted headers and drops blocked headers", () => {
    const headers = buildReplayHeaders({
      "Content-Type": "application/json",
      "User-Agent": "Vitest",
      Authorization: "Bearer hidden",
      Cookie: "a=b",
      Host: "example.com",
      "X-Custom": "keep?",
    });

    expect(headers).toEqual({
      "content-type": "application/json",
      "user-agent": "Vitest",
    });
  });
});
