import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { anthropicDevProxy } from "./vite/anthropic-dev-plugin.js";
import { artifactsPlugin } from "./vite/artifacts-plugin.js";

export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    plugins: [artifactsPlugin(), react(), anthropicDevProxy(), single && viteSingleFile()].filter(Boolean),
    // ARTIFACTS_PUBLIC_DIR lets tests use their own files. The single-file build
    // has nowhere to put public/ files, so it leaves them out.
    publicDir: single ? false : process.env.ARTIFACTS_PUBLIC_DIR || "public",
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: single ? "dist-single" : "dist",
      // Libraries such as plotly and tensorflow are large on their own.
      chunkSizeWarningLimit: 8000,
    },
    test: {
      include: ["tests/unit/**/*.test.js"],
      testTimeout: 120_000,
    },
  };
});
