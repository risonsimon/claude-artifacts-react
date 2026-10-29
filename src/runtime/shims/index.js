import { createClaude } from "./claude.js";
import { installFetchShim } from "./fetch.js";
import { createFs } from "./fs.js";
import { createStorage } from "./storage.js";

const base = import.meta.env.BASE_URL;

/** Adds Claude's artifact APIs (storage, claude, fs, and Anthropic fetch) to a window. */
export function installShims(win) {
  installFetchShim(win, base);
  win.storage ??= createStorage(win);
  win.claude ??= createClaude(win);
  win.fs ??= createFs(win, base);
}

installShims(window);
// HTML artifacts run in a same-origin iframe and call this to get the same APIs.
window.__claudeArtifactsInstallShims = installShims;
