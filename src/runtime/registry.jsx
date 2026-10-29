import { lazy } from "react";
import artifacts from "virtual:artifacts";
import HtmlArtifact from "./HtmlArtifact.jsx";

function toComponent(artifact) {
  return lazy(async () => {
    const mod = await artifact.load();
    if (artifact.type === "html") {
      return { default: () => <HtmlArtifact html={mod.default} title={artifact.name || "Artifact"} /> };
    }
    if (typeof mod.default !== "function" && typeof mod.default !== "object") {
      throw new Error(`${artifact.file} has no default export. Claude artifacts export their main component as default.`);
    }
    return mod;
  });
}

// Lazy components are created once per artifact so React keeps their state.
export const registry = artifacts.map((artifact) => ({ ...artifact, Component: toComponent(artifact) }));
