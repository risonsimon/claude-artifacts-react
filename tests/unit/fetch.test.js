import { describe, expect, it, vi } from "vitest";
import { installFetchShim, toProxyUrl } from "../../src/runtime/shims/fetch.js";
import { fakeWindow } from "./helpers.js";

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("fetch shim", () => {
  it("maps Anthropic URLs to the proxy and leaves others alone", () => {
    expect(toProxyUrl("https://api.anthropic.com/v1/messages")).toBe("/api/anthropic/v1/messages");
    expect(toProxyUrl("https://api.anthropic.com/v1/messages", "/app/")).toBe("/app/api/anthropic/v1/messages");
    expect(toProxyUrl("https://api.anthropic.com.evil.test/v1/messages")).toBeNull();
    expect(toProxyUrl("https://example.com/")).toBeNull();
  });

  it("rewrites the request, keeps the body, and strips client-side keys", async () => {
    const calls = [];
    const win = fakeWindow({
      fetch: vi.fn(async (url, init) => {
        calls.push({ url, init });
        return jsonResponse(200, { ok: true });
      }),
    });
    installFetchShim(win);

    await win.fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "sk-leak", "anthropic-beta": "b1" },
      body: JSON.stringify({ hello: "world" }),
    });

    expect(calls[0].url).toBe("/api/anthropic/v1/messages");
    expect(calls[0].init.method).toBe("POST");
    expect(new TextDecoder().decode(calls[0].init.body)).toBe('{"hello":"world"}');
    expect(calls[0].init.headers.get("x-api-key")).toBeNull();
    expect(calls[0].init.headers.get("anthropic-beta")).toBe("b1");
  });

  it("passes other requests straight through", async () => {
    const original = vi.fn(async () => new Response("ok"));
    const win = fakeWindow({ fetch: original });
    installFetchShim(win);
    await win.fetch("/data.json", { method: "GET" });
    expect(original).toHaveBeenCalledWith("/data.json", { method: "GET" });
  });

  it("accepts Request and URL objects", async () => {
    const original = vi.fn(async () => jsonResponse(200, {}));
    const win = fakeWindow({ fetch: original });
    installFetchShim(win);
    await win.fetch(new URL("https://api.anthropic.com/v1/messages"), { method: "POST", body: "{}" });
    await win.fetch(new Request("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}" }));
    expect(original.mock.calls.map(([url]) => url)).toEqual(["/api/anthropic/v1/messages", "/api/anthropic/v1/messages"]);
  });

  it("asks for the password once, retries, and remembers it", async () => {
    const seen = [];
    const win = fakeWindow({
      prompt: vi.fn(() => "secret"),
      fetch: vi.fn(async (url, init) => {
        const password = init.headers.get("x-artifact-password");
        seen.push(password);
        return password === "secret"
          ? jsonResponse(200, { ok: true })
          : jsonResponse(401, { error: {} }, { "x-artifact-auth": "required" });
      }),
    });
    installFetchShim(win);

    const first = await win.fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}" });
    const second = await win.fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(win.prompt).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([null, "secret", "secret"]);
  });

  it("returns the 401 when the visitor cancels the password prompt", async () => {
    const win = fakeWindow({
      prompt: vi.fn(() => null),
      fetch: vi.fn(async () => jsonResponse(401, {}, { "x-artifact-auth": "required" })),
    });
    installFetchShim(win);
    const response = await win.fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}" });
    expect(response.status).toBe(401);
    expect(win.fetch).toBeDefined();
  });

  it("installs only once", () => {
    const win = fakeWindow();
    installFetchShim(win);
    const shim = win.fetch;
    installFetchShim(win);
    expect(win.fetch).toBe(shim);
  });
});
