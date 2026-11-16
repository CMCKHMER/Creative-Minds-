import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./glass.css";
import "./iridescent.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { loadGoogleClient } from "./lib/google";

// Prevent the browser from restoring the scroll position on page refresh.
// Without this, refreshing the page jumps to wherever you were last
// scrolled (which might be mid-page — confusing on a long landing page
// like CMC's homepage). With 'manual', the page always starts at the
// top on refresh.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
// Also force scroll to top on initial load (covers browsers that
// don't support scrollRestoration)
window.scrollTo(0, 0);

// Google Drive + Classroom (docs/google-classroom-drive.md). Loads NOTHING and
// requests no scopes unless VITE_GOOGLE_CLIENT_ID is set — with no id the
// window.CMCG API stays absent and every Google button falls back to the
// zero-setup Classroom share dialog.
loadGoogleClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Last line of defence: a render error anywhere (typically a lazy
        route chunk that failed to download) shows a Reload prompt instead
        of leaving a blank page. */}
    <ErrorBoundary variant="page" label="app">
      <App />
    </ErrorBoundary>
  </StrictMode>
);
