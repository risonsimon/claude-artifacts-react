// Claude.ai lets artifacts call the Anthropic API without a key. Outside Claude
// those calls go to this site's own proxy (/api/anthropic), which adds the key.

export const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
export const PROXY_PATH = "/api/anthropic";
const PASSWORD_KEY = "claude-artifacts:password";
const MARKER = Symbol.for("claude-artifacts.fetch");

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url;
}

export function toProxyUrl(url, base = "/") {
  if (typeof url !== "string" || !url.startsWith(ANTHROPIC_ORIGIN + "/")) return null;
  return base.replace(/\/+$/, "") + PROXY_PATH + url.slice(ANTHROPIC_ORIGIN.length);
}

function readPassword(win) {
  try {
    return win.sessionStorage.getItem(PASSWORD_KEY);
  } catch {
    return null;
  }
}

function savePassword(win, password) {
  try {
    if (password) win.sessionStorage.setItem(PASSWORD_KEY, password);
    else win.sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    // sessionStorage can be unavailable; the password then lasts for this request only.
  }
}

export function installFetchShim(win = window, base = "/") {
  const original = win.fetch;
  if (!original || original[MARKER]) return;

  const shim = async function fetch(input, init) {
    const target = toProxyUrl(requestUrl(input), base);
    if (!target) return original.call(win, input, init);

    const request = new win.Request(input, init);
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    const headers = new win.Headers(request.headers);
    headers.delete("x-api-key");
    headers.delete("authorization");
    headers.delete("anthropic-dangerous-direct-browser-access");

    const send = (password) => {
      const sendHeaders = new win.Headers(headers);
      if (password) sendHeaders.set("x-artifact-password", password);
      return original.call(win, target, { method: request.method, headers: sendHeaders, body, signal: request.signal });
    };

    let response = await send(readPassword(win));
    if (response.status === 401 && response.headers.get("x-artifact-auth") === "required") {
      const password = win.prompt?.("This app is password protected. Enter the password to use its AI features:");
      if (!password) return response;
      response = await send(password);
      savePassword(win, response.status === 401 ? null : password);
    }
    return response;
  };
  shim[MARKER] = true;
  win.fetch = shim;
}
