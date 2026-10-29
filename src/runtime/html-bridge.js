// Runs first inside the iframe so the page gets window.storage, window.claude,
// window.fs, and the Anthropic fetch rewrite before its own scripts run.
const BRIDGE =
  "<script>try{window.parent.__claudeArtifactsInstallShims&&window.parent.__claudeArtifactsInstallShims(window)}catch(e){console.warn('Could not install artifact APIs',e)}</script>";

export function injectBridge(html) {
  // Inserting before <!DOCTYPE> would put the page into quirks mode, so go after it.
  const patterns = [/<head(\s[^>]*)?>/i, /<html(\s[^>]*)?>/i, /<!doctype[^>]*>/i];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      const end = match.index + match[0].length;
      return html.slice(0, end) + BRIDGE + html.slice(end);
    }
  }
  return BRIDGE + html;
}
