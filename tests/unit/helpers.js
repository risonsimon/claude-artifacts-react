export function memoryStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

export function fakeWindow(overrides = {}) {
  return {
    Request,
    Headers,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    prompt: () => null,
    fetch: async () => new Response("unexpected fetch", { status: 500 }),
    ...overrides,
  };
}
