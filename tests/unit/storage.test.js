import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorage, setStorageNamespace } from "../../src/runtime/shims/storage.js";
import { fakeWindow } from "./helpers.js";

describe("window.storage shim", () => {
  let win;
  let storage;

  beforeEach(() => {
    setStorageNamespace("main");
    win = fakeWindow();
    storage = createStorage(win);
  });

  it("sets, gets, lists, and deletes values with Claude's return shapes", async () => {
    await expect(storage.set("todos:1", JSON.stringify({ done: false }))).resolves.toEqual({
      key: "todos:1",
      value: '{"done":false}',
      shared: false,
    });
    await storage.set("todos:2", { done: true });
    await storage.set("notes:1", "hello");

    await expect(storage.get("todos:2")).resolves.toEqual({ key: "todos:2", value: { done: true }, shared: false });
    await expect(storage.list("todos:")).resolves.toEqual({ keys: ["todos:1", "todos:2"], prefix: "todos:", shared: false });
    await expect(storage.delete("todos:1")).resolves.toEqual({ key: "todos:1", deleted: true, shared: false });
    await expect(storage.list("todos:")).resolves.toMatchObject({ keys: ["todos:2"] });
  });

  it("throws for missing keys, like Claude", async () => {
    await expect(storage.get("nope")).rejects.toThrow("key not found");
  });

  it("keeps personal and shared data apart and warns once about shared data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await storage.set("score", 1);
    await storage.set("score", 2, true);
    await storage.get("score", true);
    expect((await storage.get("score")).value).toBe(1);
    expect((await storage.get("score", true)).value).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("gives each artifact its own namespace", async () => {
    await storage.set("key", "main value");
    setStorageNamespace("other");
    await expect(storage.get("key")).rejects.toThrow();
    await storage.set("key", "other value");
    setStorageNamespace("main");
    expect((await storage.get("key")).value).toBe("main value");
  });

  it("rejects keys Claude rejects", async () => {
    for (const key of ["", "has space", "a/b", "a\\b", "it's", 'say"hi"', "x".repeat(200)]) {
      await expect(storage.set(key, "v")).rejects.toThrow();
    }
  });

  it("rejects values over 5MB", async () => {
    await expect(storage.set("big", "x".repeat(5 * 1024 * 1024 + 1))).rejects.toThrow("5MB");
  });

  it("falls back to memory when localStorage is unavailable", async () => {
    const broken = fakeWindow();
    Object.defineProperty(broken, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
    });
    const memory = createStorage(broken);
    await memory.set("k", "v");
    expect((await memory.get("k")).value).toBe("v");
  });
});
