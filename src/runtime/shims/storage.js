// Same API as Claude's `window.storage`, backed by localStorage.
// In Claude, shared data (shared: true) is visible to every user of the artifact.
// Here it can only live in the visitor's own browser.

const PREFIX = "claude-artifacts";
const MAX_KEY_LENGTH = 200;
const MAX_VALUE_BYTES = 5 * 1024 * 1024;

let namespace = "main";
let warnedShared = false;

export function setStorageNamespace(name) {
  namespace = name || "main";
}

function memoryBackend() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function pickBackend(win) {
  try {
    const storage = win.localStorage;
    const probe = `${PREFIX}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryBackend();
  }
}

function validateKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("window.storage: key must be a non-empty string");
  }
  if (key.length >= MAX_KEY_LENGTH) {
    throw new Error(`window.storage: key must be under ${MAX_KEY_LENGTH} characters`);
  }
  if (/[\s/\\'"]/.test(key)) {
    throw new Error("window.storage: key cannot contain whitespace, slashes, or quotes");
  }
}

function scope(shared) {
  return `${PREFIX}:${namespace}:${shared ? "shared" : "personal"}:`;
}

function warnShared(shared) {
  if (shared && !warnedShared) {
    warnedShared = true;
    console.warn(
      "window.storage: shared data is only saved in this browser. Outside Claude there is no server that shares it between users.",
    );
  }
}

export function createStorage(win = window) {
  let backend;
  const store = () => (backend ??= pickBackend(win));

  return {
    async get(key, shared = false) {
      validateKey(key);
      warnShared(shared);
      const raw = store().getItem(scope(shared) + key);
      // Claude's API throws for missing keys instead of returning null.
      if (raw === null) throw new Error(`window.storage: key not found: ${key}`);
      return { key, value: JSON.parse(raw).value, shared };
    },

    async set(key, value, shared = false) {
      validateKey(key);
      warnShared(shared);
      const raw = JSON.stringify({ value });
      if (new Blob([raw]).size > MAX_VALUE_BYTES) {
        throw new Error("window.storage: values must be under 5MB");
      }
      store().setItem(scope(shared) + key, raw);
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      validateKey(key);
      warnShared(shared);
      const fullKey = scope(shared) + key;
      const existed = store().getItem(fullKey) !== null;
      store().removeItem(fullKey);
      return { key, deleted: existed, shared };
    },

    async list(prefix = "", shared = false) {
      warnShared(shared);
      const base = scope(shared);
      const backendStore = store();
      const keys = [];
      for (let i = 0; i < backendStore.length; i++) {
        const fullKey = backendStore.key(i);
        if (fullKey?.startsWith(base + (prefix ?? ""))) keys.push(fullKey.slice(base.length));
      }
      keys.sort();
      return { keys, prefix, shared };
    },
  };
}
