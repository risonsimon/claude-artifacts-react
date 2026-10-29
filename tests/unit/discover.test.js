import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverArtifacts } from "../../vite/artifacts-plugin.js";

let root;

function write(file, content = "export default () => null") {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("discoverArtifacts", () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "artifacts-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("serves src/ArtifactCode at / and src/artifacts/* by file name", () => {
    write("src/ArtifactCode.jsx");
    write("src/artifacts/dashboard.tsx");
    write("src/artifacts/landing.html", "<p>hi</p>");
    write("src/artifacts/helpers.js");
    write("src/artifacts/lib/nested.jsx");

    const { entries } = discoverArtifacts(root, "");
    expect(entries.map(({ name, relative, type }) => ({ name, relative, type }))).toEqual([
      { name: "", relative: "src/ArtifactCode.jsx", type: "react" },
      { name: "dashboard", relative: "src/artifacts/dashboard.tsx", type: "react" },
      { name: "landing", relative: "src/artifacts/landing.html", type: "html" },
    ]);
  });

  it("accepts ArtifactCode.tsx and ArtifactCode.html", () => {
    write("src/ArtifactCode.tsx");
    expect(discoverArtifacts(root, "").entries[0].relative).toBe("src/ArtifactCode.tsx");
  });

  it("refuses two main artifacts", () => {
    write("src/ArtifactCode.jsx");
    write("src/ArtifactCode.html");
    expect(() => discoverArtifacts(root, "")).toThrow("more than one main artifact");
  });

  it("refuses two artifacts with the same path", () => {
    write("src/artifacts/chart.jsx");
    write("src/artifacts/Chart.tsx");
    expect(() => discoverArtifacts(root, "")).toThrow('would both be served at "/');
  });

  it("refuses reserved and invalid names", () => {
    write("src/artifacts/api.jsx");
    expect(() => discoverArtifacts(root, "")).toThrow("reserved name");
    fs.rmSync(path.join(root, "src/artifacts/api.jsx"));
    write("src/artifacts/my chart.jsx");
    expect(() => discoverArtifacts(root, "")).toThrow("can only use letters");
  });

  it("uses only ARTIFACTS_DIR when it is set", () => {
    write("src/ArtifactCode.jsx");
    write("custom/index.jsx");
    write("custom/other.jsx");
    const { entries } = discoverArtifacts(root, "custom");
    expect(entries.map((entry) => entry.name)).toEqual(["", "other"]);
  });

  it("returns nothing for an empty project", () => {
    expect(discoverArtifacts(root, "").entries).toEqual([]);
  });
});
