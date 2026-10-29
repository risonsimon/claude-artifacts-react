import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDirs = [];

async function buildWith({ artifactsDir, mode = "production" }) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "artifacts-build-"));
  outDirs.push(outDir);
  const previous = process.env.ARTIFACTS_DIR;
  if (artifactsDir) process.env.ARTIFACTS_DIR = artifactsDir;
  else delete process.env.ARTIFACTS_DIR;
  try {
    await build({ root, mode, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  } finally {
    if (previous === undefined) delete process.env.ARTIFACTS_DIR;
    else process.env.ARTIFACTS_DIR = previous;
  }
  return outDir;
}

afterEach(() => {
  for (const dir of outDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("vite build", () => {
  it("builds the template as shipped", async () => {
    const outDir = await buildWith({});
    expect(fs.existsSync(path.join(outDir, "index.html"))).toBe(true);
    expect(fs.readdirSync(path.join(outDir, "assets")).some((file) => file.startsWith("ArtifactCode-"))).toBe(true);
  });

  it("explains a package that isn't installed", async () => {
    await expect(buildWith({ artifactsDir: "tests/fixtures/missing-package" })).rejects.toThrow(
      /imports "canvas-confetti", but the package "canvas-confetti" isn't installed[\s\S]*pnpm add canvas-confetti/,
    );
  });

  it("explains a shadcn component that doesn't exist", async () => {
    await expect(buildWith({ artifactsDir: "tests/fixtures/missing-ui" })).rejects.toThrow(
      /no shadcn\/ui component called "sidebar"[\s\S]*Available components: accordion/,
    );
  });

  it("builds a single self-contained HTML file", async () => {
    const outDir = await buildWith({ artifactsDir: "tests/fixtures/simple", mode: "single" });
    expect(fs.readdirSync(outDir)).toEqual(["index.html"]);
    const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    expect(html).toContain("Simple fixture");
    expect(html).not.toMatch(/<script[^>]+src=/);
  });
});
