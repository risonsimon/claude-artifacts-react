import fs from "node:fs";
import path from "node:path";

const VIRTUAL_ID = "virtual:artifacts";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const EXTENSIONS = [".jsx", ".tsx", ".html"];
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
// These paths are taken by the app itself, the API proxy, public/files, or build output.
const RESERVED_NAMES = new Set(["api", "assets", "files", "artifacts"]);

export const CLAUDE_LIBRARIES = [
  "react",
  "lucide-react",
  "recharts",
  "mathjs",
  "lodash",
  "d3",
  "plotly",
  "three",
  "papaparse",
  "xlsx",
  "chart.js",
  "tone",
  "mammoth",
  "@tensorflow/tfjs",
  "@/components/ui/*",
];

function toPosix(file) {
  return file.split(path.sep).join("/");
}

function stripQuery(id) {
  return id.split("?")[0];
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && EXTENSIONS.includes(path.extname(entry.name)))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

/**
 * Finds the artifacts to serve.
 *
 * Default layout: `src/ArtifactCode.{jsx,tsx,html}` is served at `/`, and every
 * `src/artifacts/<name>.{jsx,tsx,html}` is served at `/<name>`.
 * When `ARTIFACTS_DIR` is set, every file in that folder is an artifact and
 * `index.*` is served at `/`.
 */
export function discoverArtifacts(root, artifactsDir = process.env.ARTIFACTS_DIR) {
  const entries = [];
  const scanDirs = [];

  if (artifactsDir) {
    const dir = path.resolve(root, artifactsDir);
    scanDirs.push(dir);
    for (const file of listFiles(dir)) {
      const base = path.basename(file, path.extname(file));
      entries.push({ name: base === "index" ? "" : base, file });
    }
  } else {
    const srcDir = path.join(root, "src");
    const mainFiles = EXTENSIONS.map((ext) => path.join(srcDir, `ArtifactCode${ext}`)).filter((file) =>
      fs.existsSync(file),
    );
    if (mainFiles.length > 1) {
      throw new Error(
        `Found more than one main artifact: ${mainFiles.map((f) => path.relative(root, f)).join(", ")}. ` +
          "Keep only one src/ArtifactCode file (.jsx, .tsx, or .html).",
      );
    }
    if (mainFiles.length === 1) entries.push({ name: "", file: mainFiles[0] });

    const dir = path.join(srcDir, "artifacts");
    scanDirs.push(dir);
    for (const file of listFiles(dir)) {
      entries.push({ name: path.basename(file, path.extname(file)), file });
    }
  }

  const seen = new Map();
  for (const entry of entries) {
    const rel = toPosix(path.relative(root, entry.file));
    if (entry.name !== "" && !NAME_PATTERN.test(entry.name)) {
      throw new Error(
        `${rel}: artifact file names can only use letters, numbers, "-" and "_", and must start with a letter or number.`,
      );
    }
    if (RESERVED_NAMES.has(entry.name.toLowerCase())) {
      throw new Error(`${rel}: "${entry.name}" is a reserved name. Rename the file.`);
    }
    const key = entry.name.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`${rel} and ${seen.get(key)} would both be served at "/${entry.name}". Rename one of them.`);
    }
    seen.set(key, rel);
    entry.relative = rel;
    entry.type = path.extname(entry.file) === ".html" ? "html" : "react";
  }

  return { entries, scanDirs };
}

function generateModule(entries) {
  const items = entries.map((entry) => {
    const importPath = toPosix(entry.file) + (entry.type === "html" ? "?raw" : "");
    return `  {
    name: ${JSON.stringify(entry.name)},
    file: ${JSON.stringify(entry.relative)},
    type: ${JSON.stringify(entry.type)},
    load: () => import(${JSON.stringify(importPath)}),
  }`;
  });
  return `export default [\n${items.join(",\n")}\n];\n`;
}

function listUiComponents(uiDir) {
  if (!fs.existsSync(uiDir)) return [];
  return fs
    .readdirSync(uiDir)
    .filter((file) => /\.(jsx?|tsx?)$/.test(file) && !file.startsWith("index."))
    .map((file) => file.replace(/\.(jsx?|tsx?)$/, ""))
    .sort();
}

function isBareImport(source) {
  return !(
    source.startsWith(".") ||
    source.startsWith("/") ||
    source.startsWith("\0") ||
    source.startsWith("virtual:") ||
    source.startsWith("data:") ||
    /^[a-z]+:\/\//i.test(source)
  );
}

function packageName(source) {
  const parts = source.split("/");
  return source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

export function artifactsPlugin() {
  let root = process.cwd();
  let scanDirs = [];
  let mainFilePattern = null;

  const isArtifactFile = (id) => {
    const file = stripQuery(id);
    if (mainFilePattern && mainFilePattern.test(file)) return true;
    return scanDirs.some((dir) => file.startsWith(dir + path.sep) || file.startsWith(toPosix(dir) + "/"));
  };

  return {
    name: "claude-artifacts",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
      const srcDir = toPosix(path.join(root, "src"));
      mainFilePattern = process.env.ARTIFACTS_DIR
        ? null
        : new RegExp(`^${srcDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/ArtifactCode\\.(jsx|tsx|html)$`);
      scanDirs = discoverArtifacts(root).scanDirs;
    },

    async resolveId(source, importer, options) {
      if (source === VIRTUAL_ID) return RESOLVED_ID;
      if (!importer || !isArtifactFile(importer)) return null;

      const importerName = toPosix(path.relative(root, stripQuery(importer)));

      // Vite may apply the "@" alias before this hook runs, so match both forms.
      const uiDir = path.join(root, "src", "components", "ui");
      const uiPrefixes = ["@/components/ui/", toPosix(uiDir) + "/"];
      const uiPrefix = uiPrefixes.find((prefix) => toPosix(source).startsWith(prefix));
      if (uiPrefix) {
        const component = toPosix(source).slice(uiPrefix.length).replace(/\.(jsx?|tsx?)$/, "");
        const available = listUiComponents(uiDir);
        if (component && component !== "index" && !available.includes(component)) {
          this.error(
            `${importerName} imports "@/components/ui/${component}", but there is no shadcn/ui component called "${component}".\n` +
              `Available components: ${available.join(", ")}.\n` +
              "To add one, run: pnpm dlx shadcn@2.3.0 add " +
              component,
          );
        }
        return null;
      }
      if (!isBareImport(source) || source.startsWith("@/")) return null;

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved) return resolved;

      const pkg = packageName(source);
      this.error(
        `${importerName} imports "${source}", but the package "${pkg}" isn't installed.\n` +
          `Claude artifacts can use: ${CLAUDE_LIBRARIES.join(", ")}. All of these are already installed.\n` +
          `If your artifact needs "${pkg}", install it with: pnpm add ${pkg}`,
      );
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;
      const { entries } = discoverArtifacts(root);
      return generateModule(entries);
    },

    configureServer(server) {
      const { scanDirs: dirs } = discoverArtifacts(root);
      const watched = [...dirs, path.join(root, "src")];
      server.watcher.add(watched);

      const refresh = (file) => {
        if (!EXTENSIONS.includes(path.extname(file))) return;
        if (!isArtifactFile(path.resolve(file))) return;
        for (const environment of Object.values(server.environments ?? {})) {
          const mod = environment.moduleGraph?.getModuleById(RESOLVED_ID);
          if (mod) environment.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
  };
}
