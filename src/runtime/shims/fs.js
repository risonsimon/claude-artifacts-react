// Same API as Claude's `window.fs.readFile(path, options)`. In Claude it reads
// files uploaded to the chat; here it reads files you put in `public/files/`.

function looksLikeHtmlFallback(path, response) {
  // Dev servers and SPA hosting answer unknown paths with index.html instead of a 404.
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html") && !/\.html?$/i.test(path);
}

export function createFs(win = window, base = "/") {
  const root = base.replace(/\/+$/, "") + "/files/";

  return {
    async readFile(path, options = {}) {
      const clean = String(path).replace(/^\/+/, "");
      const url = root + clean.split("/").map(encodeURIComponent).join("/");
      const response = await win.fetch(url);
      if (!response.ok || looksLikeHtmlFallback(clean, response)) {
        throw new Error(`window.fs.readFile: "${clean}" was not found. Put the file at public/files/${clean}.`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const encoding = typeof options === "string" ? options : options?.encoding;
      if (!encoding) return bytes;
      const label = String(encoding).toLowerCase() === "utf8" ? "utf-8" : encoding;
      return new TextDecoder(label).decode(bytes);
    },
  };
}
