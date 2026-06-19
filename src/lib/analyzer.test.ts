import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeRepositoryPath, extractImportSpecs, resolveImportPath } from "@/lib/analyzer";

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

describe("analyzer", () => {
  it("extracts JavaScript and Python import specs", () => {
    expect(extractImportSpecs("src/app.ts", 'import { api } from "./api";\nconst db = require("./db");')).toEqual(["./api", "./db"]);
    expect(extractImportSpecs("main.py", "from app.db import query\nimport app.settings")).toEqual(["app.db", "app.settings"]);
  });

  it("resolves only repo-local imports", () => {
    const pathSet = new Set(["src/api.ts", "src/db.ts", "src/index.ts"]);
    expect(resolveImportPath("src/app.ts", "./api", pathSet)).toBe("src/api.ts");
    expect(resolveImportPath("src/app.ts", "react", pathSet)).toBeNull();
  });

  it("builds a useful deterministic manifest from a local fixture", async () => {
    const manifest = await analyzeRepositoryPath(fixturePath, {
      generatedAt: "2026-06-18T00:00:00.000Z",
      repoInfo
    });
    const second = await analyzeRepositoryPath(fixturePath, {
      generatedAt: "2026-06-18T00:00:00.000Z",
      repoInfo
    });

    expect(manifest.version).toBe("1.0");
    expect(manifest.repo.fullName).toBe("demo/sample-repo");
    expect(manifest.stats.files).toBe(9);
    expect(manifest.districts.map((district) => district.id)).toEqual(["src", "root", ".github", "docs", "tests"]);
    expect(manifest.stats.roads).toBe(9);
    expect(manifest.roads.map((road) => road.name)).toEqual(
      expect.arrayContaining(["Src Lane", "Root Baseplate Lane", "Docs Lane", "Tests Lane"])
    );
    expect(manifest.landmarks.map((landmark) => landmark.kind)).toEqual([
      "automation_panel",
      "instruction_library",
      "control_block",
      "instruction_center",
      "testing_yard"
    ]);
    expect(manifest.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromPath: "src/api.ts", toPath: "src/db.ts", importPath: "./db" }),
        expect.objectContaining({ fromPath: "src/app.ts", toPath: "src/api.ts", importPath: "./api" }),
        expect.objectContaining({ fromPath: "src/app.ts", toPath: "src/theme.ts", importPath: "./theme" })
      ])
    );
    expect(manifest.buildings.map((building) => [building.path, building.position])).toEqual(
      second.buildings.map((building) => [building.path, building.position])
    );
  });
});
