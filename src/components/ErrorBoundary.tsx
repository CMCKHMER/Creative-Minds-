import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * What to show when a descendant throws:
   *  - 'page'    full-screen message with a Reload button (app root)
   *  - 'section' compact in-flow notice with a Reload button (one homepage
   *              section failed; the rest of the page keeps working)
   *  - 'silent'  render nothing (optional UI such as a closed modal)
   */
  variant?: 'page' | 'section' | 'silent';
  /** Short name used in the console warning, e.g. "daily-assessment". */
  label?: string;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches render-time errors — in practice almost always a React.lazy chunk
 * that failed to download (flaky mobile data, or a tab left open across a
 * deploy that now asks for a file hash which no longer exists).
 *
 * Without a boundary React unmounts the WHOLE tree on such an error and the
 * visitor is left with a blank page and no way to recover. With one, the
 * damage stays inside the boundary and the visitor gets a Reload button.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(`[cmc] ${this.props.label ?? 'app'} failed to render:`, error, info.componentStack);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    const variant = this.props.variant ?? 'section';
    if (variant === 'silent') return null;

    if (variant === 'page') {
      return (
        <div role="alert" className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
          <div className="max-w-md">
            <h1 className="text-xl font-bold text-white">This page did not load completely</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Part of the site could not be downloaded. This usually means the connection dropped or the site was
              just updated. Reloading fixes it.
            </p>
            <button
              type="button"
              onClick={this.reload}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
            >
              Reload the page
            </button>
          </div>
        </div>
      );
    }

    return (
      <div role="alert" className="mx-auto my-10 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
        <p className="text-sm font-semibold text-slate-100">This section could not be loaded.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          The connection may have dropped, or the site was just updated.
        </p>
        <button
          type="button"
          onClick={this.reload}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
        >
          Reload the page
        </button>
      </div>
    );
  }
}
