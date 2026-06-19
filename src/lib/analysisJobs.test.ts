import { describe, expect, it } from "vitest";
import { startAnalysisJob, getAnalysisJob, readAnalysisArtifact } from "@/lib/analysisJobs";
import { demoManifest } from "@/lib/demoManifest";
import { createWorldArtifacts } from "@/lib/worldArtifacts";
import type { AnalysisJob } from "@/types/world";

describe("analysis jobs", () => {
  it("persists a completed job and its artifacts", async () => {
    const result = await startAnalysisJob(
      {
        repoUrl: "https://github.com/demo/starter-app",
        includeHistory: true,
        maxHistoryFrames: 4
      },
      {
        now: () => "2026-06-18T00:00:00.000Z",
        analyze: async () => createWorldArtifacts(demoManifest)
      }
    );

    expect(result.status).toBe(202);
    if (result.status !== 202) {
      throw new Error("Expected accepted job");
    }

    const job = await waitForSucceededJob(result.body.id);
    expect(job.status).toBe("succeeded");
    expect(job.artifacts?.index).toBe("index");
    expect(job.artifacts?.manifest).toBe("manifest");
    expect(job.artifacts?.chunks.length).toBeGreaterThan(0);

    const manifest = await readAnalysisArtifact(job.id, "manifest");
    const index = await readAnalysisArtifact(job.id, "index");

    expect(manifest).toMatchObject({ version: "1.0", repo: { fullName: demoManifest.repo.fullName } });
    expect(index).toMatchObject({ kind: "world_index", repo: { fullName: demoManifest.repo.fullName } });
  });
});

async function waitForSucceededJob(jobId: string): Promise<AnalysisJob> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await getAnalysisJob(jobId);
    if (job?.status === "succeeded") {
      return job;
    }
    if (job?.status === "failed") {
      throw new Error(job.error);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Job did not complete in time");
}
