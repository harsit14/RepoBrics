import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

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
