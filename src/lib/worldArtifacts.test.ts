import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeRepositoryPath } from "@/lib/analyzer";
import { composeManifestFromArtifacts, createWorldArtifacts } from "@/lib/worldArtifacts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../../tests/fixtures/sample-repo");

const repoInfo = {
  owner: "demo",
  name: "sample-repo",
  fullName: "demo/sample-repo",
  url: "https://github.com/demo/sample-repo",
  cloneUrl: "https://github.com/demo/sample-repo.git",
  branch: "main"
};

describe("world artifacts", () => {
  it("splits a manifest into deterministic district chunks", async () => {
    const manifest = await analyzeRepositoryPath(fixturePath, {
      generatedAt: "2026-06-18T00:00:00.000Z",
      repoInfo
    });
    const artifacts = createWorldArtifacts(manifest);

    expect(artifacts.index.kind).toBe("world_index");
    expect(artifacts.index.chunks.map((chunk) => chunk.id)).toEqual(["chunk-src", "chunk-root", "chunk-.github", "chunk-docs", "chunk-tests"]);
    expect(artifacts.chunks).toHaveLength(manifest.districts.length);
    expect(artifacts.chunks[0]).toMatchObject({
      kind: "world_chunk",
      districtIds: ["src"],
      stats: expect.objectContaining({ districts: 1, buildings: 4 })
    });
    expect(artifacts.index.bounds.radius).toBeGreaterThan(1);
  });

  it("can compose streamed chunks back into the manifest-facing contract", async () => {
    const manifest = await analyzeRepositoryPath(fixturePath, {
      generatedAt: "2026-06-18T00:00:00.000Z",
      repoInfo
    });
    const artifacts = createWorldArtifacts(manifest);
    const recomposed = composeManifestFromArtifacts(artifacts.index, artifacts.chunks);

    expect(recomposed.stats).toEqual(manifest.stats);
    expect(recomposed.districts.map((district) => district.id)).toEqual(manifest.districts.map((district) => district.id));
    expect(recomposed.buildings.map((building) => building.path)).toEqual(manifest.buildings.map((building) => building.path));
    expect(recomposed.connections.map((connection) => connection.id)).toEqual(manifest.connections.map((connection) => connection.id));
  });
});
