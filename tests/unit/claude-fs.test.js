import { describe, expect, it, vi } from "vitest";
import { createClaude, DEFAULT_MODEL } from "../../src/runtime/shims/claude.js";
import { createFs } from "../../src/runtime/shims/fs.js";
import { fakeWindow } from "./helpers.js";

describe("window.claude.complete", () => {
  it("sends one user message and joins the text blocks", async () => {
    const win = fakeWindow({
      fetch: vi.fn(async () =>
        Response.json({ content: [{ type: "text", text: "Hello" }, { type: "tool_use" }, { type: "text", text: " there" }] }),
      ),
    });
    const claude = createClaude(win);
    await expect(claude.complete("Hi")).resolves.toBe("Hello there");

    const [url, init] = win.fetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(init.body)).toEqual({
      model: DEFAULT_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: "Hi" }],
    });
  });

  it("accepts a messages array", async () => {
    const win = fakeWindow({ fetch: vi.fn(async () => Response.json({ content: [] })) });
    await createClaude(win).complete([{ role: "user", content: "a" }]);
    expect(JSON.parse(win.fetch.mock.calls[0][1].body).messages).toEqual([{ role: "user", content: "a" }]);
  });

  it("throws the API error message", async () => {
    const win = fakeWindow({
      fetch: vi.fn(async () => Response.json({ error: { message: "ANTHROPIC_API_KEY is not set" } }, { status: 500 })),
    });
    await expect(createClaude(win).complete("Hi")).rejects.toThrow("ANTHROPIC_API_KEY is not set");
  });
});

describe("window.fs.readFile", () => {
  it("returns bytes by default and text with an encoding", async () => {
    const win = fakeWindow({
      fetch: vi.fn(async () => new Response("a,b", { headers: { "content-type": "text/csv" } })),
    });
    const fs = createFs(win);
    const bytes = await fs.readFile("data.csv");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes)).toBe("a,b");
    await expect(fs.readFile("data.csv", { encoding: "utf8" })).resolves.toBe("a,b");
    expect(win.fetch.mock.calls[0][0]).toBe("/files/data.csv");
  });

  it("encodes file names and respects the base path", async () => {
    const win = fakeWindow({ fetch: vi.fn(async () => new Response("x")) });
    await createFs(win, "/app/").readFile("/My Sheet #1.xlsx");
    expect(win.fetch.mock.calls[0][0]).toBe("/app/files/My%20Sheet%20%231.xlsx");
  });

  it("treats the SPA index.html fallback as a missing file", async () => {
    const win = fakeWindow({
      fetch: vi.fn(async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } })),
    });
    await expect(createFs(win).readFile("data.csv")).rejects.toThrow("public/files/data.csv");
  });

  it("throws on 404", async () => {
    const win = fakeWindow({ fetch: vi.fn(async () => new Response("", { status: 404 })) });
    await expect(createFs(win).readFile("data.csv")).rejects.toThrow("was not found");
  });
});
