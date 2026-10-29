import { Component } from "react";

const TROUBLESHOOTING_URL = "https://github.com/risonsimon/claude-artifacts-react#troubleshooting";

function hintsFor(error, file) {
  const message = String(error?.message ?? error);
  const hints = [];
  if (/Element type is invalid|is not defined|Cannot read properties of undefined/.test(message)) {
    hints.push(
      "A name the artifact uses doesn't exist. Check that every icon exists in lucide-react 0.383.0 and that shadcn/ui component names are spelled correctly.",
    );
  }
  if (/has no default export/.test(message)) {
    hints.push(`Add "export default" before the main component in ${file}.`);
  }
  if (/OrbitControls|CapsuleGeometry/.test(message)) {
    hints.push("three.js is pinned to r128 to match Claude. OrbitControls and CapsuleGeometry are not part of it.");
  }
  if (/Failed to fetch dynamically imported module|Importing a module script failed/.test(message)) {
    hints.push("The page is out of date with the latest deployment. Reload the page.");
  }
  return hints;
}

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`Artifact ${this.props.file} crashed:`, error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const hints = hintsFor(error, this.props.file);

    return (
      <div role="alert" className="min-h-screen bg-white p-6 text-left text-gray-900">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6">
          <h1 className="mb-2 text-lg font-semibold text-red-800">This artifact crashed</h1>
          <p className="mb-4 text-sm text-red-900">
            <code className="rounded bg-red-100 px-1 py-0.5">{this.props.file}</code> threw an error while rendering.
          </p>
          <pre className="mb-4 overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-sm text-red-900">
            {String(error?.message ?? error)}
          </pre>
          {hints.length > 0 && (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-red-900">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-red-900">
            The browser console has the full stack trace. See{" "}
            <a className="underline" href={TROUBLESHOOTING_URL} target="_blank" rel="noreferrer">
              troubleshooting
            </a>{" "}
            for common fixes.
          </p>
        </div>
      </div>
    );
  }
}
