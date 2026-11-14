/**
 * Retry a dynamic import a couple of times before giving up.
 *
 * A code-split chunk can fail to download for boring reasons — a phone
 * dropping signal for a second, a captive portal, a proxy hiccup. Two things
 * then make the failure permanent for the rest of the visit: React.lazy
 * remembers the first rejection, and the browser itself remembers that the
 * module failed, so simply calling import() again is answered from that
 * memory without touching the network (verified in Chrome).
 *
 * The retry therefore asks for the same file under a cache-busting query
 * string (`chunk.js?retry=…`), which the browser treats as a module it has
 * never tried. The URL comes from the error message of the failed import.
 * When the message carries no URL (Safari), the original loader is simply
 * called again — harmless, and it works where failures are not remembered.
 *
 * A failure that survives the retries still rejects and is handled by the
 * nearest <ErrorBoundary>, which offers a page reload.
 */
export function retryImport<T>(loader: () => Promise<T>, retries = 2, delayMs = 500): Promise<T> {
  return loader().catch((error: unknown) => retryAfterFailure(loader, error, retries, delayMs));
}

/** URL of the chunk named in a failed-import error, or null if there is none. */
export function failedModuleUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  // Chrome / Edge: "Failed to fetch dynamically imported module: <url>"
  // Firefox:       "error loading dynamically imported module: <url>"
  const match = /dynamically imported module:\s*(\S+)/i.exec(message);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    url.searchParams.delete('retry');
    return url.href;
  } catch {
    return null;
  }
}

async function retryAfterFailure<T>(
  loader: () => Promise<T>,
  error: unknown,
  retries: number,
  delayMs: number,
): Promise<T> {
  if (retries <= 0) throw error;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const url = failedModuleUrl(error);
  try {
    if (!url) return await loader();
    const fresh = new URL(url);
    fresh.searchParams.set('retry', Date.now().toString(36));
    return (await import(/* @vite-ignore */ fresh.href)) as T;
  } catch (nextError) {
    return retryAfterFailure(loader, nextError, retries - 1, delayMs * 2);
  }
}
