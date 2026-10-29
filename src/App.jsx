import { useEffect, useState } from "react";
import ArtifactIndex from "./runtime/ArtifactIndex.jsx";
import ArtifactView from "./runtime/ArtifactView.jsx";
import { registry as artifacts } from "./runtime/registry.jsx";
import { setStorageNamespace } from "./runtime/shims/storage.js";

// The single-file build is often opened from disk, where only the URL hash can route.
const useHash = import.meta.env.MODE === "single";
const base = import.meta.env.BASE_URL.replace(/\/+$/, "");

function currentName() {
  let path = useHash ? window.location.hash.replace(/^#/, "") : window.location.pathname;
  if (!useHash && base && path.startsWith(base)) path = path.slice(base.length);
  try {
    path = decodeURIComponent(path);
  } catch {
    // Leave malformed escapes as they are; they won't match an artifact.
  }
  return path.replace(/^\/+|\/+$/g, "");
}

function href(name) {
  return useHash ? `#/${name}` : `${base}/${name}`;
}

export default function App() {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    const update = () => setName(currentName());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  const artifact = name === "artifacts" ? undefined : artifacts.find((item) => item.name === name);

  useEffect(() => {
    if (artifact?.name) document.title = artifact.name;
  }, [artifact]);

  if (!artifact) {
    const showMissing = name !== "" && name !== "artifacts";
    return <ArtifactIndex artifacts={artifacts} href={href} missing={showMissing ? name : undefined} />;
  }

  // Each artifact gets its own window.storage, like separate artifacts in Claude.
  setStorageNamespace(artifact.name);
  return <ArtifactView key={artifact.file} artifact={artifact} />;
}
