import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Site-wide dark/light toggle.
 *
 * The theme is expressed as a `light` class on <html>. All light styling
 * lives in the unlayered "CMC LIGHT THEME" block at the end of index.css,
 * where it beats every Tailwind v4 utility layer without !important.
 * The pre-paint script in index.html applies the saved choice before
 * first paint, so there is no flash of the wrong theme on reload.
 */
const STORAGE_KEY = 'cmc-theme';

function applyTheme(light: boolean) {
  document.documentElement.classList.toggle('light', light);
  try {
    localStorage.setItem(STORAGE_KEY, light ? 'light' : 'dark');
  } catch { /* private mode — session-only choice */ }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', light ? '#e2e8f0' : '#0f172a');
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  // Initial state comes from the <html> class the pre-paint script set.
  const [light, setLight] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('light'),
  );

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      const isLight = e.newValue === 'light';
      document.documentElement.classList.toggle('light', isLight);
      setLight(isLight);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !light;
        setLight(next);
        applyTheme(next);
      }}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={light}
      title={light ? 'Dark mode' : 'Light mode'}
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/90 text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300 active:scale-95 ${className}`}
    >
      <Sun
        className={`h-4 w-4 transition-all duration-300 ${light ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'} absolute`}
        aria-hidden="true"
      />
      <Moon
        className={`h-4 w-4 transition-all duration-300 ${light ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0'} absolute`}
        aria-hidden="true"
      />
    </button>
  );
}
