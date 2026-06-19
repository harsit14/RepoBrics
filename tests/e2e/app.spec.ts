import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { demoManifest } from "../../src/lib/demoManifest";
import { createWorldArtifacts } from "../../src/lib/worldArtifacts";
import type { HistoryFrame } from "../../src/types/world";

test("demo world renders in the app shell", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { name: "RepoBricks" })).toBeVisible();
  await expect(page.getByText("demo/starter-app")).toBeVisible();
  await expect(page.getByTestId("world-canvas")).toBeVisible();
  await expect(page.getByText("4 buildings")).toBeVisible();
  await expect(page.getByText("6 roads")).toBeVisible();
  await expect(page.getByText("3 links")).toBeVisible();
  await expect(page.getByText("5 landmarks")).toBeVisible();
});

test("file search focuses a matching building", async ({ page }) => {
  await page.goto("/?demo=1");
  await page.getByLabel("Search files").fill("api");
  await page.getByRole("button", { name: /api\.ts/ }).click();
  await expect(page.getByRole("heading", { name: "api.ts" })).toBeVisible();
  await expect(page.getByText("src/api.ts").first()).toBeVisible();
});

test("minimap is visible for generated worlds", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.getByLabel("Repository minimap")).toBeVisible();
});

test("analyze button loads an async job artifact", async ({ page }) => {
  const jobId = "job-e2e";
  const artifacts = createWorldArtifacts(demoManifest);
  const artifactById = new Map([
    ["index", artifacts.index],
    ...artifacts.chunks.map((chunk) => [chunk.id, chunk] as const)
  ]);

  await page.route("**/api/analyze/jobs", async (route) => {
    await route.fulfill({
      status: 202,
      json: {
        id: jobId,
        repoUrl: "https://github.com/demo/starter-app",
        status: "succeeded",
        stage: "complete",
        progress: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:01.000Z",
        artifacts: {
          manifest: "manifest",
          index: "index",
          chunks: artifacts.chunks.map((chunk) => chunk.id),
          historyFrames: []
        }
      }
    });
  });
  await page.route(`**/api/analyze/jobs/${jobId}`, async (route) => {
    await route.fulfill({
      json: {
        id: jobId,
        repoUrl: "https://github.com/demo/starter-app",
        status: "succeeded",
        stage: "complete",
        progress: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:01.000Z",
        artifacts: {
          manifest: "manifest",
          index: "index",
          chunks: artifacts.chunks.map((chunk) => chunk.id),
          historyFrames: []
        }
      }
    });
  });
  await page.route(`**/api/analyze/jobs/${jobId}/artifacts/*`, async (route) => {
    const artifactId = route.request().url().split("/").pop() ?? "";
    const artifact = artifactById.get(artifactId);
    await route.fulfill({
      status: artifact ? 200 : 404,
      json: artifact ?? { error: "missing test artifact" }
    });
  });

  await page.goto("/");
  await page.getByLabel("GitHub repository URL").fill("https://github.com/demo/starter-app");
  await page.locator("form").getByRole("button").click();

  await expect(page.getByText("demo/starter-app")).toBeVisible();
  await expect(page.getByText("4 buildings")).toBeVisible();
  await expect(page.getByText(/sectors cached/)).toBeVisible();
});

test("git history artifacts render the timeline", async ({ page }) => {
  const jobId = "job-history-e2e";
  const artifacts = createWorldArtifacts(demoManifest);
  const historyFrames: HistoryFrame[] = [
    historyFrame("history-a", 0, "1111111", "Add API client", [{ status: "added", path: "src/api.ts" }]),
    historyFrame("history-b", 1, "2222222", "Tune theme", [{ status: "modified", path: "src/theme.ts" }])
  ];
  const artifactById = new Map([
    ["index", artifacts.index],
    ...artifacts.chunks.map((chunk) => [chunk.id, chunk] as const),
    ...historyFrames.map((frame) => [frame.id, frame] as const)
  ]);

  await page.route("**/api/analyze/jobs", async (route) => {
    await route.fulfill({
      status: 202,
      json: {
        id: jobId,
        repoUrl: "https://github.com/demo/starter-app",
        status: "succeeded",
        stage: "complete",
        progress: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:01.000Z",
        artifacts: {
          manifest: "manifest",
          index: "index",
          chunks: artifacts.chunks.map((chunk) => chunk.id),
          historyFrames: historyFrames.map((frame) => frame.id)
        }
      }
    });
  });
  await page.route(`**/api/analyze/jobs/${jobId}`, async (route) => {
    await route.fulfill({
      json: {
        id: jobId,
        repoUrl: "https://github.com/demo/starter-app",
        status: "succeeded",
        stage: "complete",
        progress: 1,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:01.000Z",
        artifacts: {
          manifest: "manifest",
          index: "index",
          chunks: artifacts.chunks.map((chunk) => chunk.id),
          historyFrames: historyFrames.map((frame) => frame.id)
        }
      }
    });
  });
  await page.route(`**/api/analyze/jobs/${jobId}/artifacts/*`, async (route) => {
    const artifactId = route.request().url().split("/").pop() ?? "";
    const artifact = artifactById.get(artifactId);
    await route.fulfill({
      status: artifact ? 200 : 404,
      json: artifact ?? { error: "missing test artifact" }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Toggle git history capture" }).click();
  await page.getByLabel("GitHub repository URL").fill("https://github.com/demo/starter-app");
  await page.locator("form").getByRole("button").click();

  await expect(page.getByRole("slider", { name: "Git history timeline" })).toBeVisible();
  await expect(page.getByText(/2222222/)).toBeVisible();
  await page.getByRole("button", { name: "Previous history frame" }).click();
  await expect(page.getByText(/1111111/)).toBeVisible();
});

test("toolbar toggles update their pressed state", async ({ page }) => {
  await page.goto("/?demo=1");
  const dependencyToggle = page.getByRole("button", { name: "Toggle dependency connections" });
  await expect(dependencyToggle).toHaveAttribute("aria-pressed", "true");
  await dependencyToggle.click();
  await expect(dependencyToggle).toHaveAttribute("aria-pressed", "false");

  const streetToggle = page.getByRole("button", { name: "Toggle street view" });
  await expect(streetToggle).toHaveAttribute("aria-pressed", "false");
  await streetToggle.click();
  await expect(streetToggle).toHaveAttribute("aria-pressed", "true");

  const neonToggle = page.getByRole("button", { name: "Toggle neon theme" });
  await expect(neonToggle).toHaveAttribute("aria-pressed", "false");
  await neonToggle.click();
  await expect(neonToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main")).toHaveAttribute("data-scene-theme", "neon");
});

test("canvas output is nonblank", async ({ page }) => {
  await page.goto("/?demo=1");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect(page.getByText("Src")).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector("canvas");
    return Boolean(element && element.width > 0 && element.height > 0);
  });
  await page.waitForTimeout(500);

  const before = await canvas.screenshot();
  const stats = canvasPixelStats(before);
  expect(stats.uniqueColors).toBeGreaterThan(20);
  expect(stats.scenePixels).toBeGreaterThan(40);
});

test("street view responds to keyboard walking", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard walking is covered by the desktop browser project.");
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Toggle street view" }).click();
  await expect(page.getByText("Street View")).toBeVisible();
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-view-mode", "street");
  await expect.poll(async () => canvas.getAttribute("data-street-camera")).not.toBeNull();
  await canvas.click({ position: { x: 20, y: 120 } });
  await page.waitForTimeout(250);
  const before = await canvas.getAttribute("data-street-camera");
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  await expect.poll(async () => canvas.getAttribute("data-street-camera")).not.toBe(before);

  const after = await canvas.getAttribute("data-street-camera");
  expect(after).not.toBe(before);

  const beforeD = parseStreetCamera(after);
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  const afterD = parseStreetCamera(await canvas.getAttribute("data-street-camera"));
  expect(afterD.z).toBeGreaterThan(beforeD.z + 0.05);

  await page.keyboard.down("a");
  await page.waitForTimeout(500);
  await page.keyboard.up("a");
  const afterA = parseStreetCamera(await canvas.getAttribute("data-street-camera"));
  expect(afterA.z).toBeLessThan(afterD.z - 0.05);
});

test("fly mode responds to keyboard movement and climb", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard flight is covered by the desktop browser project.");
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Toggle fly mode" }).click();
  await expect(page.getByText("Fly Mode")).toBeVisible();
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-view-mode", "fly");
  await expect.poll(async () => canvas.getAttribute("data-fly-camera")).not.toBeNull();
  await canvas.click({ position: { x: 20, y: 120 } });
  await page.waitForTimeout(250);

  const before = await canvas.getAttribute("data-fly-camera");
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  await expect.poll(async () => canvas.getAttribute("data-fly-camera")).not.toBe(before);

  const beforeClimb = parseFlyCamera(await canvas.getAttribute("data-fly-camera"));
  await page.keyboard.down("r");
  await page.waitForTimeout(500);
  await page.keyboard.up("r");
  const afterClimb = parseFlyCamera(await canvas.getAttribute("data-fly-camera"));
  expect(afterClimb.y).toBeGreaterThan(beforeClimb.y + 0.05);
});

function parseStreetCamera(value: string | null): { x: number; z: number } {
  expect(value).not.toBeNull();
  const [x, z] = value!.split(",").map(Number);
  return { x, z };
}

function historyFrame(id: string, sequence: number, shortSha: string, message: string, changes: HistoryFrame["changes"]): HistoryFrame {
  return {
    version: "1.0",
    kind: "history_frame",
    id,
    sequence,
    commit: {
      sha: `${shortSha}${"0".repeat(33)}`,
      shortSha,
      message,
      authorName: "RepoBricks",
      authoredAt: "2026-06-18T00:00:00.000Z"
    },
    summary: {
      added: changes.filter((change) => change.status === "added").length,
      modified: changes.filter((change) => change.status === "modified").length,
      deleted: changes.filter((change) => change.status === "deleted").length,
      renamed: changes.filter((change) => change.status === "renamed").length,
      copied: changes.filter((change) => change.status === "copied").length,
      total: changes.length,
      truncated: false
    },
    changes
  };
}

function parseFlyCamera(value: string | null): { x: number; y: number; z: number } {
  expect(value).not.toBeNull();
  const [x, y, z] = value!.split(",").map(Number);
  return { x, y, z };
}

function canvasPixelStats(buffer: Buffer): { uniqueColors: number; scenePixels: number } {
  const png = PNG.sync.read(buffer);
  const colors = new Set<string>();
  let scenePixels = 0;

  for (let y = 0; y < png.height; y += 8) {
    for (let x = 0; x < png.width; x += 8) {
      const offset = (png.width * y + x) * 4;
      const red = png.data[offset];
      const green = png.data[offset + 1];
      const blue = png.data[offset + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = max / 255;

      colors.add(`${red},${green},${blue}`);
      if ((saturation > 0.16 && brightness < 0.97) || brightness < 0.76) {
        scenePixels += 1;
      }
    }
  }

  return { uniqueColors: colors.size, scenePixels };
}
