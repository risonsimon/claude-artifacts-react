/**
 * Forwards artifact calls to the Anthropic Messages API with the deployer's key.
 *
 * Claude.ai injects the API key for artifacts that call
 * `fetch("https://api.anthropic.com/v1/messages")`. Once deployed, the browser
 * shim rewrites those calls to `/api/anthropic/v1/messages`, and this handler
 * adds the key server-side so it never reaches the browser.
 *
 * Works with any runtime that has the Web `Request`/`Response` API
 * (Vercel Functions, Cloudflare Workers, Node 20+).
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY      required
 *   ARTIFACT_PASSWORD      optional, require this password before calling the API
 *   RATE_LIMIT_PER_MINUTE  optional, requests per visitor per minute (default 20, 0 turns it off)
 *   ANTHROPIC_MODEL        optional, replace the model the artifact asks for
 *   ANTHROPIC_MAX_TOKENS   optional, replace max_tokens (Claude.ai raises the artifact's 1000 itself)
 *   ANTHROPIC_BETA         optional, extra anthropic-beta header value
 *   ANTHROPIC_BASE_URL     optional, send requests to a different API host
 *   ALLOWED_ORIGINS        optional, comma-separated extra origins allowed to call the proxy
 */

export const PROXY_PREFIX = "/api/anthropic";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_VERSION = "2023-06-01";
const DEFAULT_RATE_LIMIT = 20;
const WINDOW_MS = 60_000;
const ALLOWED_PATHS = new Set(["/v1/messages", "/v1/messages/count_tokens"]);
const PASSED_RESPONSE_HEADERS = ["content-type", "request-id", "retry-after", "anthropic-organization-id"];

const visitors = new Map();

function jsonError(status, type, message, headers = {}) {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}


// Per-instance memory only: serverless platforms run several instances, so this
// slows down abuse rather than enforcing an exact global limit.
function isRateLimited(id, limit, now = Date.now()) {
  if (visitors.size > 10_000) {
    for (const [key, entry] of visitors) {
      if (now - entry.start >= WINDOW_MS) visitors.delete(key);
    }
  }
  const entry = visitors.get(id);
  if (!entry || now - entry.start >= WINDOW_MS) {
    visitors.set(id, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function resetRateLimits() {
  visitors.clear();
}

function readNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function extraOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function isAllowedOrigin(request, url, env) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (extraOrigins(env).includes(origin)) return true;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host"), url.host].filter(Boolean);
  return hosts.includes(originHost);
}

// Only origins listed in ALLOWED_ORIGINS need CORS headers; the site itself is same-origin.
function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  if (!origin || !extraOrigins(env).includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-expose-headers": "x-artifact-auth, request-id, retry-after",
    vary: "Origin",
  };
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @param {{ checkOrigin?: boolean, clientIp?: string | null }} [options]
 *   clientIp should come from a source the platform guarantees (for example
 *   cf-connecting-ip on Cloudflare); client-supplied headers can be forged.
 */
export async function handleAnthropicProxy(request, env = {}, options = {}) {
  const response = await proxy(request, env, options);
  const cors = corsHeaders(request, env);
  if (!cors) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

async function proxy(request, env, { checkOrigin = true, clientIp } = {}) {
  const url = new URL(request.url);
  const path = url.pathname.startsWith(PROXY_PREFIX) ? url.pathname.slice(PROXY_PREFIX.length) : url.pathname;

  if (!ALLOWED_PATHS.has(path)) {
    return jsonError(404, "not_found_error", `Only POST ${PROXY_PREFIX}/v1/messages is available.`);
  }
  if (request.method === "OPTIONS") {
    if (!corsHeaders(request, env)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-methods": "POST",
        "access-control-allow-headers": "content-type, anthropic-version, anthropic-beta, x-artifact-password",
        "access-control-max-age": "600",
      },
    });
  }
  if (request.method !== "POST") {
    return jsonError(405, "invalid_request_error", "Use POST.", { allow: "POST" });
  }

  // Blocks other websites from spending your API credits from their visitors' browsers.
  if (checkOrigin && !isAllowedOrigin(request, url, env)) {
    return jsonError(
      403,
      "permission_error",
      "This API proxy only accepts requests from its own site. Add other sites to ALLOWED_ORIGINS.",
    );
  }

  if (!env.ANTHROPIC_API_KEY) {
    return jsonError(
      500,
      "api_error",
      "ANTHROPIC_API_KEY is not set. Add it to your hosting provider's environment variables (or .env.local for local development) and redeploy.",
    );
  }

  if (env.ARTIFACT_PASSWORD) {
    const given = request.headers.get("x-artifact-password");
    if (!given || !safeEqual(given, env.ARTIFACT_PASSWORD)) {
      return jsonError(401, "authentication_error", "This app needs a password to use AI features.", {
        "x-artifact-auth": "required",
      });
    }
  }

  const limit = readNumber(env.RATE_LIMIT_PER_MINUTE) ?? DEFAULT_RATE_LIMIT;
  if (limit > 0 && isRateLimited(clientIp || "unknown", limit)) {
    return jsonError(429, "rate_limit_error", `Too many requests. The limit is ${limit} per minute.`, {
      "retry-after": "60",
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request_error", "The request body must be JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "invalid_request_error", "The request body must be a JSON object.");
  }

  if (env.ANTHROPIC_MODEL) body.model = env.ANTHROPIC_MODEL;
  const maxTokens = readNumber(env.ANTHROPIC_MAX_TOKENS);
  if (maxTokens && path === "/v1/messages") body.max_tokens = maxTokens;

  const headers = {
    "content-type": "application/json",
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": request.headers.get("anthropic-version") || DEFAULT_VERSION,
  };
  const beta = [request.headers.get("anthropic-beta"), env.ANTHROPIC_BETA].filter(Boolean).join(",");
  if (beta) headers["anthropic-beta"] = beta;

  const baseUrl = (env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  let upstream;
  try {
    upstream = await fetch(baseUrl + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
    });
  } catch (error) {
    return jsonError(502, "api_error", `Could not reach the Anthropic API: ${error.message}`);
  }

  const responseHeaders = new Headers();
  for (const name of PASSED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const [name, value] of upstream.headers) {
    if (name.startsWith("anthropic-ratelimit-")) responseHeaders.set(name, value);
  }
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
