import { useMemo } from "react";
import { injectBridge } from "./html-bridge.js";

export default function HtmlArtifact({ html, title }) {
  const srcDoc = useMemo(() => injectBridge(html), [html]);

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      onLoad={(event) => {
        const pageTitle = event.currentTarget.contentDocument?.title;
        if (pageTitle) document.title = pageTitle;
      }}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
