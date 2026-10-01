// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* What makes the app installable: the manifest and the icons it names, and the icon iOS takes from the page. */

const root = (file: string) => new URL(`../../${file}`, import.meta.url);
const manifest = JSON.parse(readFileSync(root('public/manifest.webmanifest'), 'utf8')) as {
  icons: { src: string; sizes: string; purpose: string }[];
  display: string;
  start_url: string;
};
const page = readFileSync(root('index.html'), 'utf8');

/** Width and height of a PNG, from its header. */
function sizeOf(file: string): string {
  const bytes = readFileSync(root(`public${file}`));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('the manifest', () => {
  it('opens the app on its own, from the home screen', () => {
    expect(manifest).toMatchObject({ display: 'standalone', start_url: '/' });
  });

  it('names icons for any use and maskable ones, at 192 and 512', () => {
    expect(manifest.icons.map(({ src, sizes, purpose }) => `${src} ${sizes} ${purpose}`)).toEqual([
      '/icona-192.png 192x192 any',
      '/icona-512.png 512x512 any',
      '/icona-maskable-192.png 192x192 maskable',
      '/icona-maskable-512.png 512x512 maskable',
    ]);
  });

  it('names only icons that are there, as big as it says', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(root(`public${icon.src}`)), icon.src).toBe(true);
      expect(sizeOf(icon.src), icon.src).toBe(icon.sizes);
    }
  });
});

describe('the page', () => {
  it('gives iOS its own icon, 180 wide', () => {
    expect(page).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(sizeOf('/apple-touch-icon.png')).toBe('180x180');
  });
});
