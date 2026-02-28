import { describe, expect, it } from "vitest";
import { generateCurlCommand } from "~/lib/utils/curl";

describe("generateCurlCommand", () => {
  it("quotes single quotes safely", () => {
    const command = generateCurlCommand({
      url: "https://example.com/hook?x=1",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-note": "it's complicated",
      },
      body: "{\"note\":\"it's fine\"}",
    });

    expect(command).toContain("curl -X POST");
    expect(command).toContain("'https://example.com/hook?x=1'");
    expect(command).toContain("x-note: it'\"'\"'s complicated");
    expect(command).toContain("--data-raw");
  });
});
