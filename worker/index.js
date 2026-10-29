// Cloudflare Worker: serves the built site from ./dist and handles /api/anthropic/*.
import { handleAnthropicProxy, PROXY_PREFIX } from "../server/anthropic-proxy.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === PROXY_PREFIX || pathname.startsWith(PROXY_PREFIX + "/")) {
      return handleAnthropicProxy(request, env);
    }
    if (pathname.startsWith("/api/")) {
      return Response.json({ type: "error", error: { type: "not_found_error", message: "Not found." } }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
