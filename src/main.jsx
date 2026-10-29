// Shims first: artifacts may read window.storage, window.claude, or window.fs at import time.
import "./runtime/shims/index.js";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// No <StrictMode>: Claude renders artifacts without it, and its double-run effects
// make artifacts written without cleanup (intervals, Plotly, Tone) misbehave in dev.
createRoot(document.getElementById("root")).render(<App />);
