import { startApp } from "../src/app";

test("starts", async () => {
  expect(await startApp()).toBeDefined();
});
