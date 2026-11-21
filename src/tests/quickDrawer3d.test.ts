import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QuickDrawer } from '../components/QuickDrawer';
import { QUICK_LINKS } from '../data/landingData';

describe('QuickDrawer 3D buttons & dark/light theme parity', () => {
  it('renders every Quick Link as a tactile 3D button with non-selectable text and category accent tones', () => {
    const html = renderToStaticMarkup(
      createElement(QuickDrawer, {
        isOpen: true,
        onClose: () => {},
        onSelectAction: () => {},
      }),
    );

    expect(html).toContain('cmc-qdrawer-panel');
    expect(html).toContain('cmc-qdrawer-btn');
    expect(html).toContain('select-none');
    expect(html).toContain('data-tone="sapphire"');
    expect(html).toContain('data-tone="violet"');
    expect(html).toContain('data-tone="emerald"');

    const decoded = html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
    for (const item of QUICK_LINKS) {
      expect(decoded).toContain(item.title);
    }
  });

  it('defines matching 3D keycap elevation, active press-down, and dark + html.light theme rules in src/glass.css', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/glass.css'), 'utf8');
    expect(css).toContain('.cmc-qdrawer-panel');
    expect(css).toContain('html.light .cmc-qdrawer-panel');
    expect(css).toContain('.cmc-qdrawer-btn');
    expect(css).toContain('.cmc-qdrawer-btn:hover');
    expect(css).toContain('.cmc-qdrawer-btn:active');
    expect(css).toContain('html.light .cmc-qdrawer-btn');
    expect(css).toContain('html.light .cmc-qdrawer-btn:active');
    expect(css).toContain('.cmc-qdrawer-icon');
    expect(css).toContain('html.light .cmc-qdrawer-icon');
    expect(css).toContain('html.light .cmc-qdrawer-badge');
  });
});
