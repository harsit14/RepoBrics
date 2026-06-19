import { describe, expect, it } from "vitest";
import { handleAnalyzeRequest } from "@/lib/analyzeHandler";
import { demoManifest } from "@/lib/demoManifest";

describe("handleAnalyzeRequest", () => {
  it("rejects missing repoUrl", async () => {
    await expect(handleAnalyzeRequest({})).resolves.toEqual({
      status: 400,
      body: { error: "repoUrl is required." }
    });
  });

  it("returns a manifest through injectable analysis dependencies", async () => {
    await expect(
      handleAnalyzeRequest(
        { repoUrl: "https://github.com/demo/starter-app" },
        {
          analyze: async () => demoManifest
        }
      )
    ).resolves.toEqual({
      status: 200,
      body: demoManifest
    });
  });
});
