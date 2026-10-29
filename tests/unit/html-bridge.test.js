import { describe, expect, it } from "vitest";
import { injectBridge } from "../../src/runtime/html-bridge.js";

describe("injectBridge", () => {
  it("goes right after <head> so it runs before the page's scripts", () => {
    const html = '<!DOCTYPE html><html><head><script src="x.js"></script></head></html>';
    const out = injectBridge(html);
    expect(out.startsWith("<!DOCTYPE html><html><head><script>")).toBe(true);
    expect(out.indexOf("__claudeArtifactsInstallShims")).toBeLessThan(out.indexOf("x.js"));
  });

  it("handles <head> with attributes and no <head> at all", () => {
    expect(injectBridge('<html lang="en"><head data-x="1"><title>t</title>')).toMatch(/^<html lang="en"><head data-x="1"><script>/);
    expect(injectBridge("<html><body>hi</body></html>")).toMatch(/^<html><script>/);
    expect(injectBridge("<!doctype html><p>hi</p>")).toMatch(/^<!doctype html><script>/);
    expect(injectBridge("<p>hi</p>")).toMatch(/^<script>.*<\/script><p>hi<\/p>$/);
  });

  it("does not mistake <header> for <head>", () => {
    expect(injectBridge("<!DOCTYPE html><header>x</header>")).toMatch(/^<!DOCTYPE html><script>/);
  });
});
