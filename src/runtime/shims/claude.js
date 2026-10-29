// Same API as Claude's `window.claude.complete(prompt)`: sends one prompt and
// resolves with the reply text. Goes through the fetch shim and the API proxy.

import { ANTHROPIC_ORIGIN } from "./fetch.js";

// The model Claude.ai's artifact instructions use. Set ANTHROPIC_MODEL on the server to change it.
export const DEFAULT_MODEL = "claude-sonnet-4-6";

async function errorMessage(response) {
  try {
    const data = await response.json();
    return data?.error?.message || JSON.stringify(data);
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

export function createClaude(win = window) {
  return {
    async complete(prompt) {
      const messages =
        typeof prompt === "string" ? [{ role: "user", content: prompt }] : Array.isArray(prompt) ? prompt : prompt?.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("window.claude.complete needs a prompt string");
      }

      const response = await win.fetch(`${ANTHROPIC_ORIGIN}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: DEFAULT_MODEL, max_tokens: 1000, messages }),
      });
      if (!response.ok) {
        throw new Error(`window.claude.complete failed (${response.status}): ${await errorMessage(response)}`);
      }

      const data = await response.json();
      return (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    },
  };
}
