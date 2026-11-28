import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./glass.css";
import "./iridescent.css";
// Motion follows the button skins; the final learning layer adds the bright
// studio palette and carousel transforms without changing the shared skins.
import "./motion.css";
import "./future-learning.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// /?motion=demo — the one page where every button behaviour can be seen and
// tapped without a login. Lazy, so it costs nothing on the real site.
const MotionShowcase = lazy(() => import("./components/MotionShowcase"));
const motionDemo = new URLSearchParams(window.location.search).has("motion");
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
      {motionDemo ? (
        <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
          <MotionShowcase />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>
);
