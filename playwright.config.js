import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const mockPort = 4319;
const outDir = process.env.E2E_OUT_DIR || "dist-e2e";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: process.env.E2E_RESULTS_DIR || "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    // Set PLAYWRIGHT_CHANNEL=chrome to use an installed Google Chrome instead of Playwright's Chromium.
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: [
    {
      command: "node tests/e2e/mock-anthropic.js",
      url: `http://127.0.0.1:${mockPort}/health`,
      env: { MOCK_ANTHROPIC_PORT: String(mockPort) },
      reuseExistingServer: false,
    },
    {
      command: `vite build --outDir ${outDir} --emptyOutDir && vite preview --outDir ${outDir} --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        ARTIFACTS_DIR: "tests/fixtures/artifacts",
        ARTIFACTS_PUBLIC_DIR: "tests/fixtures/public",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${mockPort}`,
        ARTIFACT_PASSWORD: "letmein",
      },
    },
  ],
});
