import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../api/anthropic/v1/messages.js";
import { POST as countTokens } from "../../api/anthropic/v1/messages/count_tokens.js";
import { resetRateLimits } from "../../server/anthropic-proxy.js";
import worker from "../../worker/index.js";

describe("deploy targets", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ content: [] })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("Vercel function reads the key from process.env", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-vercel");
    const response = await POST(
      new Request("https://app.vercel.app/api/anthropic/v1/messages", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(200);
    expect(fetch.mock.calls[0][1].headers["x-api-key"]).toBe("sk-vercel");
    expect((await GET(new Request("https://app.vercel.app/api/anthropic/v1/messages"))).status).toBe(405);

    const counted = await countTokens(
      new Request("https://app.vercel.app/api/anthropic/v1/messages/count_tokens", { method: "POST", body: "{}" }),
    );
    expect(counted.status).toBe(200);
    expect(fetch.mock.calls[1][0]).toBe("https://api.anthropic.com/v1/messages/count_tokens");
  });

  it("rate limits by the address each platform guarantees", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk");
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "1");
    const vercel = (realIp, forged) =>
      POST(
        new Request("https://app.vercel.app/api/anthropic/v1/messages", {
          method: "POST",
          body: "{}",
          headers: { "x-real-ip": realIp, "cf-connecting-ip": forged },
        }),
      );
    expect((await vercel("1.1.1.1", "9.9.9.1")).status).toBe(200);
    expect((await vercel("1.1.1.1", "9.9.9.2")).status).toBe(429);

    const env = { ANTHROPIC_API_KEY: "sk", RATE_LIMIT_PER_MINUTE: "1", ASSETS: { fetch: vi.fn() } };
    const cf = (ip, forged) =>
      worker.fetch(
        new Request("https://app.workers.dev/api/anthropic/v1/messages", {
          method: "POST",
          body: "{}",
          headers: { "cf-connecting-ip": ip, "x-real-ip": forged },
        }),
        env,
      );
    expect((await cf("2.2.2.2", "9.9.9.1")).status).toBe(200);
    expect((await cf("2.2.2.2", "9.9.9.2")).status).toBe(429);
  });

  it("Cloudflare worker proxies /api/anthropic and serves everything else from assets", async () => {
    const assets = { fetch: vi.fn(async () => new Response("asset")) };
    const env = { ANTHROPIC_API_KEY: "sk-cf", ASSETS: assets };

    const api = await worker.fetch(
      new Request("https://app.workers.dev/api/anthropic/v1/messages", { method: "POST", body: "{}" }),
      env,
    );
    expect(api.status).toBe(200);
    expect(fetch.mock.calls[0][1].headers["x-api-key"]).toBe("sk-cf");

    const otherApi = await worker.fetch(new Request("https://app.workers.dev/api/other"), env);
    expect(otherApi.status).toBe(404);

    const page = await worker.fetch(new Request("https://app.workers.dev/dashboard"), env);
    expect(await page.text()).toBe("asset");
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });
});
