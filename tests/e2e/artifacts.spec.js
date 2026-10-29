import { expect, test } from "@playwright/test";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("serves index.* at the root", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Simple fixture" })).toBeVisible();
  await page.getByRole("button", { name: "Clicked 0 times" }).click();
  await expect(page.getByRole("button", { name: "Clicked 1 times" })).toBeVisible();
  // The old Vite starter CSS centered and padded #root; artifacts should start at the edge.
  const rootStyle = await page.locator("#root").evaluate((el) => getComputedStyle(el).textAlign);
  expect(rootStyle).not.toBe("center");
  expect(errors).toEqual([]);
});

test("every library Claude lists can be imported and used", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/libraries");
  const results = page.getByTestId("results");
  await expect(results).toContainText('"plotly":true', { timeout: 30_000 });
  const data = JSON.parse(await results.textContent());
  expect(data).toMatchObject({
    lodash: 6,
    d3: 50,
    mathjs: 6,
    papaparse: "2",
    xlsx: 42,
    three: "128:BoxGeometry",
    chartjs: 1,
    tone: true,
    mammoth: true,
    tensorflow: 6,
    plotly: true,
  });
  await expect(page.getByLabel("camera icon")).toBeVisible();
  expect(errors.filter((message) => !/AudioContext|WebGL|webgl|backend/i.test(message))).toEqual([]);
});

test("shadcn components work from the @/components/ui barrel", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/shadcn");
  await expect(page.getByText("Shadcn fixture")).toBeVisible();
  await expect(page.getByText("Tab one content")).toBeVisible();
  await page.getByRole("tab", { name: "Two" }).click();
  await expect(page.getByText("Tab two content")).toBeVisible();

  await expect(page.getByTestId("selected-date")).toHaveText("Wed Jan 15 2025");
  await page.getByRole("button", { name: /January 20th, 2025/ }).click();
  await expect(page.getByTestId("selected-date")).toHaveText("Mon Jan 20 2025");

  // Claude passes percentages as plain numbers; v4 of the library would read them as pixels.
  await expect(page.getByTestId("sizes")).toHaveText("30,70");
  const left = await page.getByText("Left", { exact: true }).evaluate((el) => el.closest("[data-panel]").getBoundingClientRect().width);
  expect(left).toBeGreaterThan(100);
  expect(left).toBeLessThan(140);

  // Refs keep the version 2 imperative API, which works in percentages.
  await page.getByRole("button", { name: "Resize left" }).click();
  await page.getByRole("button", { name: "Read refs" }).click();
  await expect(page.getByTestId("ref-info")).toHaveText("50|50,50");
  expect(errors).toEqual([]);
});

test("recharts charts render", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/charts");
  for (const id of ["line", "bar", "pie", "area"]) {
    await expect(page.getByTestId(id).locator("svg.recharts-surface").first()).toBeVisible();
  }
  await expect(page.locator(".recharts-line-curve")).toHaveCount(2);
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(3);
  await expect(page.locator(".recharts-pie-sector")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("window.storage persists across reloads", async ({ page }) => {
  await page.goto("/storage");
  const output = page.getByTestId("storage");
  await expect(output).toHaveText(JSON.stringify({ visits: 1, keys: ["visits"], missing: "threw" }));
  await page.reload();
  await expect(output).toHaveText(JSON.stringify({ visits: 2, keys: ["visits"], missing: "threw" }));
});

test("Anthropic API calls and window.claude.complete go through the password-protected proxy", async ({ page }) => {
  const prompts = [];
  page.on("dialog", (dialog) => {
    prompts.push(dialog.message());
    dialog.accept("letmein");
  });
  await page.goto("/ai");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("reply")).toHaveText("echo: hello from fetch (claude-sonnet-4-6)");
  await expect(page.getByTestId("completion")).toHaveText("echo: hello from complete (claude-sonnet-4-6)");
  // The password is asked once and then reused for the session.
  expect(prompts).toHaveLength(1);
});

test("wrong password leaves the request unauthorized", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept("wrong"));
  await page.goto("/ai");
  const status = await page.evaluate(async () => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "x", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
    });
    return response.status;
  });
  expect(status).toBe(401);
});

test("window.fs.readFile reads from public/files", async ({ page }) => {
  await page.goto("/uploads");
  await expect(page.getByTestId("rows")).toHaveText("2");
  await expect(page.getByTestId("missing")).toContainText("public/files/nope.csv");
});

test("TypeScript artifacts work", async ({ page }) => {
  await page.goto("/typed");
  await expect(page.getByTestId("typed")).toHaveText("typed works");
});

test("HTML artifacts render in standards mode with the artifact APIs", async ({ page }) => {
  await page.goto("/page");
  const frame = page.frameLocator("iframe");
  await expect(frame.locator("#title")).toHaveText("HTML artifact");
  await expect(frame.locator("#apis")).toHaveText("CSS1Compat,object,object,object,ok");
  await expect(page).toHaveTitle("HTML fixture");
  // A URL object made in the iframe still goes to the proxy, which asks for the password.
  await expect(frame.locator("#proxy")).toHaveText("401");
});

test("a crashing artifact shows a helpful error", async ({ page }) => {
  await page.goto("/broken");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This artifact crashed");
  await expect(alert).toContainText("tests/fixtures/artifacts/broken.jsx");
  await expect(alert).toContainText("Cannot read properties of undefined");
});

test("the index lists artifacts and unknown paths explain themselves", async ({ page }) => {
  await page.goto("/artifacts");
  await expect(page.getByRole("link", { name: /\/libraries/ })).toBeVisible();
  await page.goto("/nope");
  await expect(page.getByRole("alert")).toContainText("There is no artifact at /nope");
});
