import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAnthropicProxy, resetRateLimits } from "../../server/anthropic-proxy.js";

const env = { ANTHROPIC_API_KEY: "sk-test" };

function request(body = { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] }, { path = "/api/anthropic/v1/messages", method = "POST", headers = {} } = {}) {
  return new Request(`https://my-app.example${path}`, {
    method,
    headers: { "content-type": "application/json", host: "my-app.example", ...headers },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

describe("handleAnthropicProxy", () => {
  let upstream;

  beforeEach(() => {
    resetRateLimits();
    upstream = vi.fn(async () =>
      Response.json({ content: [{ type: "text", text: "hi" }] }, {
        headers: { "request-id": "req_1", "anthropic-ratelimit-requests-remaining": "9", "set-cookie": "x=1" },
      }),
    );
    vi.stubGlobal("fetch", upstream);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("adds the API key server-side and forwards the body", async () => {
    const response = await handleAnthropicProxy(
      request(undefined, { headers: { "anthropic-beta": "b1", "x-api-key": "sk-from-browser" } }),
      { ...env, ANTHROPIC_BETA: "b2" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ content: [{ type: "text", text: "hi" }] });

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-test");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    expect(init.headers["anthropic-beta"]).toBe("b1,b2");
    expect(JSON.parse(init.body)).toMatchObject({ model: "claude-sonnet-4-6", max_tokens: 1000 });
  });

  it("only passes safe response headers", async () => {
    const response = await handleAnthropicProxy(request(), env);
    expect(response.headers.get("request-id")).toBe("req_1");
    expect(response.headers.get("anthropic-ratelimit-requests-remaining")).toBe("9");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("can replace the model and max_tokens", async () => {
    await handleAnthropicProxy(request(), { ...env, ANTHROPIC_MODEL: "claude-haiku-4-5", ANTHROPIC_MAX_TOKENS: "4096" });
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toMatchObject({ model: "claude-haiku-4-5", max_tokens: 4096 });
  });

  it("uses ANTHROPIC_BASE_URL", async () => {
    await handleAnthropicProxy(request(), { ...env, ANTHROPIC_BASE_URL: "https://gateway.example/anthropic/" });
    expect(upstream.mock.calls[0][0]).toBe("https://gateway.example/anthropic/v1/messages");
  });

  it("explains a missing API key", async () => {
    const response = await handleAnthropicProxy(request(), {});
    expect(response.status).toBe(500);
    expect((await response.json()).error.message).toContain("ANTHROPIC_API_KEY is not set");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("only allows the messages endpoints over POST", async () => {
    expect((await handleAnthropicProxy(request(undefined, { path: "/api/anthropic/v1/models" }), env)).status).toBe(404);
    expect((await handleAnthropicProxy(request(undefined, { method: "GET" }), env)).status).toBe(405);
    expect((await handleAnthropicProxy(request(undefined, { path: "/api/anthropic/v1/messages/count_tokens" }), env)).status).toBe(200);
  });

  it("rejects bad JSON", async () => {
    expect((await handleAnthropicProxy(request("{not json"), env)).status).toBe(400);
    expect((await handleAnthropicProxy(request("[1,2]"), env)).status).toBe(400);
  });

  it("rejects other websites but allows its own site and ALLOWED_ORIGINS", async () => {
    const other = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://evil.example" } }), env);
    expect(other.status).toBe(403);

    const same = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://my-app.example" } }), env);
    expect(same.status).toBe(200);

    const listed = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://friend.example" } }), {
      ...env,
      ALLOWED_ORIGINS: "https://friend.example/, https://other.example",
    });
    expect(listed.status).toBe(200);

    const forwarded = await handleAnthropicProxy(
      request(undefined, { headers: { origin: "https://public.example", host: "internal:3000", "x-forwarded-host": "public.example" } }),
      env,
    );
    expect(forwarded.status).toBe(200);

    const skipped = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://evil.example" } }), env, {
      checkOrigin: false,
    });
    expect(skipped.status).toBe(200);
  });

  it("requires ARTIFACT_PASSWORD when set", async () => {
    const locked = { ...env, ARTIFACT_PASSWORD: "letmein" };
    const missing = await handleAnthropicProxy(request(), locked);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("x-artifact-auth")).toBe("required");

    const wrong = await handleAnthropicProxy(request(undefined, { headers: { "x-artifact-password": "letme" } }), locked);
    expect(wrong.status).toBe(401);

    const right = await handleAnthropicProxy(request(undefined, { headers: { "x-artifact-password": "letmein" } }), locked);
    expect(right.status).toBe(200);
  });

  it("rate limits each visitor", async () => {
    const limited = { ...env, RATE_LIMIT_PER_MINUTE: "2" };
    const send = (clientIp, forged) =>
      handleAnthropicProxy(request(undefined, { headers: { "cf-connecting-ip": forged, "x-forwarded-for": forged } }), limited, {
        clientIp,
      });
    expect((await send("1.1.1.1", "9.9.9.1")).status).toBe(200);
    expect((await send("1.1.1.1", "9.9.9.2")).status).toBe(200);
    const third = await send("1.1.1.1", "9.9.9.3");
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBe("60");
    expect((await send("2.2.2.2", "9.9.9.3")).status).toBe(200);
  });

  it("answers CORS preflights and adds CORS headers only for ALLOWED_ORIGINS", async () => {
    const shared = { ...env, ALLOWED_ORIGINS: "https://friend.example" };
    const preflight = (origin) =>
      handleAnthropicProxy(request(undefined, { method: "OPTIONS", headers: { origin } }), shared);

    const ok = await preflight("https://friend.example");
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://friend.example");
    expect(ok.headers.get("access-control-allow-headers")).toContain("x-artifact-password");
    expect((await preflight("https://evil.example")).status).toBe(403);
    expect((await preflight("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();

    const post = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://friend.example" } }), shared);
    expect(post.status).toBe(200);
    expect(post.headers.get("access-control-allow-origin")).toBe("https://friend.example");
    expect(post.headers.get("access-control-expose-headers")).toContain("x-artifact-auth");

    const locked = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://friend.example" } }), {
      ...shared,
      ARTIFACT_PASSWORD: "pw",
    });
    expect(locked.status).toBe(401);
    expect(locked.headers.get("access-control-allow-origin")).toBe("https://friend.example");

    const sameSite = await handleAnthropicProxy(request(undefined, { headers: { origin: "https://my-app.example" } }), shared);
    expect(sameSite.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("turns the rate limit off with 0", async () => {
    const unlimited = { ...env, RATE_LIMIT_PER_MINUTE: "0" };
    for (let i = 0; i < 30; i++) {
      expect((await handleAnthropicProxy(request(), unlimited)).status).toBe(200);
    }
  });

  it("reports network failures as 502", async () => {
    upstream.mockRejectedValueOnce(new Error("ECONNRESET"));
    const response = await handleAnthropicProxy(request(), env);
    expect(response.status).toBe(502);
    expect((await response.json()).error.message).toContain("ECONNRESET");
  });

  it("streams the upstream body through", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: message_start\n\n"));
        controller.close();
      },
    });
    upstream.mockResolvedValueOnce(new Response(stream, { headers: { "content-type": "text/event-stream" } }));
    const response = await handleAnthropicProxy(request({ stream: true, messages: [] }), env);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toBe("event: message_start\n\n");
  });
});
