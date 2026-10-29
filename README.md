# Claude Artifacts React

Run and deploy the code from a Claude artifact as your own website.

Paste the artifact code into one file, push, and it is live on Vercel or Cloudflare. The project ships with the same libraries Claude's artifact runtime provides, so the code works without changes. It also adds the browser APIs that Claude gives artifacts: `window.storage`, `window.claude.complete`, `window.fs.readFile`, and calls to the Anthropic API.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frisonsimon%2Fclaude-artifacts-react&project-name=claude-artifact&repository-name=claude-artifact)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/risonsimon/claude-artifacts-react)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/risonsimon/claude-artifacts-react)

## Contents

- [Quick start](#quick-start)
- [Adding your artifact](#adding-your-artifact)
- [More than one artifact](#more-than-one-artifact)
- [Supported libraries](#supported-libraries)
- [Claude features outside Claude](#claude-features-outside-claude)
- [Using the Anthropic API](#using-the-anthropic-api)
- [Local development](#local-development)
- [Single-file build](#single-file-build)
- [Keeping your copy up to date](#keeping-your-copy-up-to-date)
- [Troubleshooting](#troubleshooting)
- [When to use this instead of Claude's publish button](#when-to-use-this-instead-of-claudes-publish-button)

## Quick start

1. Click **Deploy with Vercel** or **Deploy to Cloudflare** above. This copies the repository to your GitHub account and deploys it.
2. In your new repository, open `src/ArtifactCode.jsx` and click the pencil icon to edit it.
3. Replace the contents with the code from your Claude artifact and commit.
4. Your site rebuilds and shows the artifact in a minute or two.

To try it without an account, click **Open in StackBlitz**. It runs the project in your browser.

## Adding your artifact

Claude makes three kinds of artifacts that this project can run:

| Artifact type | File to use |
| --- | --- |
| React (JavaScript) | `src/ArtifactCode.jsx` |
| React (TypeScript) | `src/ArtifactCode.tsx` |
| HTML page | `src/ArtifactCode.html` |

Keep only one `src/ArtifactCode` file. If you switch from `.jsx` to `.tsx` or `.html`, delete the old file.

A React artifact must have a default export, which is how Claude writes them:

```jsx
export default function App() {
  return <h1>Hello</h1>;
}
```

TypeScript artifacts are compiled without type checking, the same as in Claude, so type errors do not break the build.

HTML artifacts run inside a full-page frame and can use the same Claude APIs as React artifacts. Scripts loaded from a CDN with `<script src>` work as long as the visitor's browser can reach the CDN.

## More than one artifact

Put extra artifacts in `src/artifacts/`. Each file gets its own page:

| File | Page |
| --- | --- |
| `src/ArtifactCode.jsx` | `/` |
| `src/artifacts/budget.jsx` | `/budget` |
| `src/artifacts/landing-page.html` | `/landing-page` |
| any | `/artifacts` lists every page |

File names can use letters, numbers, `-` and `_`. The names `api`, `assets`, `files` and `artifacts` are taken by the app.

Each artifact keeps its own `window.storage` data, so two artifacts that use the same key do not overwrite each other.

You can also point the build at a different folder with the `ARTIFACTS_DIR` environment variable, for example `ARTIFACTS_DIR=my-artifacts`. Every file in that folder becomes a page, and `index.jsx` (or `.tsx` or `.html`) is served at `/`.

## Supported libraries

These are the libraries Claude's artifact runtime offers. Where Claude uses an older version, this project uses the same one so the code behaves the same.

| Library | Import | Version |
| --- | --- | --- |
| React | `import { useState } from "react"` | 19 |
| Tailwind CSS | class names | 3.4 |
| shadcn/ui | `import { Button } from "@/components/ui/button"` | current |
| lucide-react | `import { Camera } from "lucide-react"` | 0.383.0 (same as Claude) |
| Recharts | `import { LineChart } from "recharts"` | 3 |
| three.js | `import * as THREE from "three"` | r128 (same as Claude) |
| D3 | `import * as d3 from "d3"` | 7 |
| Plotly | `import * as Plotly from "plotly"` | 4 |
| Chart.js | `import Chart from "chart.js/auto"` | 4 |
| Math.js | `import * as math from "mathjs"` | 15 |
| Lodash | `import _ from "lodash"` | 4 |
| Papa Parse | `import Papa from "papaparse"` | 5 |
| SheetJS | `import * as XLSX from "xlsx"` | 0.20 |
| Tone.js | `import * as Tone from "tone"` | 15 |
| Mammoth | `import mammoth from "mammoth"` | 1 |
| TensorFlow.js | `import * as tf from "@tensorflow/tfjs"` | 4 |

Every shadcn/ui component is in `src/components/ui/`. You can also import several at once from `@/components/ui`.

To use a library Claude does not offer, install it with `pnpm add <package>`. If an artifact imports a package that is not installed, the build stops with a message that names the package.

## Claude features outside Claude

| Feature | In Claude | Here |
| --- | --- | --- |
| `window.storage` (personal data) | Saved to your Claude account | Saved in the visitor's browser (localStorage) |
| `window.storage` with `shared: true` | Shared between everyone who uses the artifact | Saved in the visitor's browser only. It is not shared. |
| `window.claude.complete(prompt)` | Uses the viewer's Claude account | Uses your API key through the proxy. See below. |
| `fetch("https://api.anthropic.com/v1/messages")` | Works without a key | Sent to your proxy, which adds your key |
| `window.fs.readFile(name)` | Reads files uploaded to the chat | Reads files from `public/files/` |
| MCP connectors | Uses the viewer's connected apps | Not supported |

`window.storage` follows Claude's rules. Keys must be under 200 characters, with no spaces, slashes or quotes. Values must be under 5MB. Reading a key that does not exist throws an error, so wrap `get` in `try`/`catch`, as Claude's own code does.

For `window.fs.readFile`, put the file in `public/files/`. For example, `public/files/data.csv` is read with `window.fs.readFile("data.csv", { encoding: "utf8" })`.

## Using the Anthropic API

Artifacts that call Claude need your Anthropic API key. Without a key the rest of the artifact still works, and the AI calls return an error that explains what to set.

**Warning:** with a key set, anyone who can open your site can spend your API credits. Set a password or a spending limit before you share the link.

1. Create a key at [console.anthropic.com](https://console.anthropic.com/settings/keys). Setting a monthly spending limit there is a good idea.
2. Add it to your host:
   - **Vercel:** Project → Settings → Environment Variables. Add `ANTHROPIC_API_KEY`, then redeploy.
   - **Cloudflare:** Workers & Pages → your Worker → Settings → Variables and Secrets. Add `ANTHROPIC_API_KEY` as a secret. Or run `npx wrangler secret put ANTHROPIC_API_KEY`.
3. Optional settings, added the same way:

| Variable | What it does |
| --- | --- |
| `ARTIFACT_PASSWORD` | Visitors must enter this password before AI features work. The browser asks once per tab. |
| `RATE_LIMIT_PER_MINUTE` | Requests per visitor per minute. Default 20. Set to `0` to turn it off. |
| `ANTHROPIC_MODEL` | Use this model for every request instead of the one the artifact asks for. |
| `ANTHROPIC_MAX_TOKENS` | Use this `max_tokens` for every request. |
| `ANTHROPIC_BETA` | Extra `anthropic-beta` header values to send. |
| `ALLOWED_ORIGINS` | Other sites, comma-separated, that may call your proxy. By default only your own site can. |

How it works: the app replaces `window.fetch` so that requests to `https://api.anthropic.com` go to `/api/anthropic` on your own site. The proxy (`server/anthropic-proxy.js`) checks the origin, password and rate limit, adds your key, and streams the reply back. It accepts only `POST /v1/messages` and `POST /v1/messages/count_tokens`. The key never reaches the browser.

The rate limit is kept in memory, so each server instance counts separately. Treat it as a guard against accidents, not as a hard limit. Use the spending limit in the Anthropic console for that.

## Local development

You need Node.js 20.19 or newer (the version in `.nvmrc` is recommended) and pnpm.

```sh
git clone https://github.com/risonsimon/claude-artifacts-react.git
cd claude-artifacts-react
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:5173. Changes to your artifact files show up right away.

To use the Anthropic API locally, copy `.env.local.example` to `.env.local` and fill in `ANTHROPIC_API_KEY`. `pnpm dev` and `pnpm preview` both run the proxy.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Starts the dev server |
| `pnpm build` | Builds the site into `dist/` |
| `pnpm build:single` | Builds one self-contained HTML file into `dist-single/` |
| `pnpm preview` | Serves the `dist/` build |
| `pnpm lint` | Runs ESLint |
| `pnpm test` | Runs the unit tests |
| `pnpm test:e2e` | Runs the browser tests with Playwright |
| `pnpm cf:dev` | Builds and runs the site in Cloudflare's local runtime |
| `pnpm cf:deploy` | Builds and deploys to Cloudflare with Wrangler |

## Single-file build

`pnpm build:single` puts the whole site, including every library it uses, into `dist-single/index.html`. You can email that file, host it anywhere, or open it straight from your disk.

In the single-file build:

- Pages use `#/name` links instead of `/name`, so they work without a server.
- Files in `public/files/` are not included, so `window.fs.readFile` cannot find them.
- AI features only work if the file is served from a site that also runs the proxy.

## Keeping your copy up to date

If you forked this repository on GitHub, open your fork and click **Sync fork**, then **Update branch**.

The deploy buttons create a new repository instead of a fork, so there is no **Sync fork** button. Add this repository as a remote and merge from it:

```sh
git remote add upstream https://github.com/risonsimon/claude-artifacts-react.git
git fetch upstream
git merge upstream/main
```

If Git says "refusing to merge unrelated histories", your repository started with a fresh history. Run `git merge upstream/main --allow-unrelated-histories` and, for every conflict, keep this repository's version of everything except your own artifact files.

If you want easy updates, fork this repository first, then import your fork in Vercel or Cloudflare instead of using a deploy button.

If Git reports a conflict, it is almost always in `src/ArtifactCode.jsx`, because you replaced the sample. Keep your version of that file. Artifacts in `src/artifacts/` do not conflict, because this repository keeps that folder empty.

## Troubleshooting

**The build says a package could not be found.**
The artifact imports a library that is not installed. Claude's runtime does not have it either, so Claude may have made a mistake. Ask Claude to use one of the [supported libraries](#supported-libraries), or install the package with `pnpm add <package>`.

**The build says a shadcn/ui component is missing.**
The import path names a component that is not in `src/components/ui/`. Check the spelling, or add the component with `npx shadcn@latest add <name>`.

**The page shows "This artifact crashed".**
The message on the page shows the error. Common causes:

- An icon does not exist in lucide-react 0.383.0, the version Claude uses. Icons added later by lucide are not available in Claude either. Pick a different icon.
- The file has no `export default`. Add it before the main component.
- three.js code uses `THREE.OrbitControls` or `THREE.CapsuleGeometry`. Neither is part of the r128 build that Claude uses.

**The page is blank.**
Open the browser console (F12). Most often the artifact threw an error before it rendered, or an HTML artifact has a script error.

**AI features return an error.**

| Status | Meaning |
| --- | --- |
| 500 "ANTHROPIC_API_KEY is not set" | Add the key to your host and redeploy. |
| 401 | The password was missing or wrong. Reload the page to enter it again. |
| 403 | The request came from another site. Add that site to `ALLOWED_ORIGINS`. |
| 429 | The rate limit was hit. Wait a minute or raise `RATE_LIMIT_PER_MINUTE`. |
| 400 or 404 from Anthropic | The model name in the artifact may be retired. Set `ANTHROPIC_MODEL` to a current model. |

**`window.fs.readFile` says the file was not found.**
Put the file in `public/files/` with the exact same name, including upper and lower case.

**Tailwind classes have no effect.**
Tailwind only sees class names written out in full. Code like `` `bg-${color}-500` `` builds the name at runtime, so Tailwind never sees it. Background, text and border colors are always included to cover the common case. For other classes, write the full class name in the code.

**The Vercel build fails at the install step.**
Set the Node.js version to 20 or newer under Project → Settings → General. The project uses pnpm 10, which Vercel picks from the `packageManager` field in `package.json`.

**The Cloudflare deploy fails.**
The button creates a Cloudflare Worker, not a Pages project. If you have an older Pages project from this repository, create a new Worker with the button instead. The build command is `pnpm build` and the deploy command is `npx wrangler deploy`.

## When to use this instead of Claude's publish button

Claude can publish an artifact to a public link on claude.ai. That is the quickest way to share it, and it keeps shared storage and the viewer's own Claude usage.

Use this project when you want:

- Your own domain or hosting account.
- To edit the code yourself, add libraries, or keep it in Git.
- To show the artifact to people without a Claude account, with AI calls paid by your API key.
- A single HTML file you can keep or send.

## License

MIT. See [LICENSE](LICENSE).

If something does not work, please [open an issue](https://github.com/risonsimon/claude-artifacts-react/issues).
