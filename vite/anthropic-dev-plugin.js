import { Readable } from "node:stream";
import { loadEnv } from "vite";
import { handleAnthropicProxy, PROXY_PREFIX } from "../server/anthropic-proxy.js";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function middleware(getEnv) {
  return async (req, res, next) => {
    const url = req.originalUrl || req.url;
    if (!url.startsWith(PROXY_PREFIX + "/") && url !== PROXY_PREFIX) return next();

    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const request = new Request(new URL(url, `http://${req.headers.host || "localhost"}`), {
        method: req.method,
        headers,
        body,
      });

      // Tunnels that rewrite Host usually send x-forwarded-host, which the origin check accepts.
      // For any other setup, list the site in ALLOWED_ORIGINS.
      const response = await handleAnthropicProxy(request, getEnv(), { clientIp: req.socket.remoteAddress });

      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      if (response.body) {
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      next(error);
    }
  };
}

/** Serves the Anthropic proxy from `vite` and `vite preview`, using .env.local for the key. */
export function anthropicDevProxy() {
  let env = {};
  return {
    name: "claude-artifacts-anthropic-proxy",
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.envDir || config.root, ""), ...process.env };
    },
    configureServer(server) {
      server.middlewares.use(middleware(() => env));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(() => env));
    },
  };
}
