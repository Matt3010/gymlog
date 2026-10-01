import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';
import { renderServiceWorker, shellOf, versionOf } from './src/sw/build';

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

/**
 * The service worker, written at build time: src/sw/sw.js with the list of
 * what the app needs to open offline (the page, the bundles, the public
 * files) and a version that changes with any of them. Emitted as /sw.js, at
 * the root of the site. After Vite's own plugins, so index.html is in the bundle.
 */
function serviceWorker(): Plugin {
  return {
    name: 'gymlog-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync(here('./public'));
      const shell = shellOf(Object.keys(bundle), publicFiles);
      // the public files keep their names across versions: their content counts too
      const contents = publicFiles.map((file) => readFileSync(here(`./public/${file}`)).toString('base64'));
      const source = renderServiceWorker(readFileSync(here('./src/sw/sw.js'), 'utf8'), shell, versionOf([...shell, ...contents]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// In dev, Vite serves the app on 5173 and passes /api to the API on 3000, or
// to GYMLOG_API when set (the e2e tests start an API of their own).
// In production nginx serves dist/ and passes /api to the API container.
export default defineConfig({
  plugins: [svelte(), serviceWorker()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Host lasciato com'è: l'API confronta l'Origin del browser con l'Host
      // per rifiutare le richieste da altri siti, e la forma corta di Vite lo
      // riscriverebbe in localhost:3000.
      '/api': { target: process.env.GYMLOG_API ?? 'http://localhost:3000', changeOrigin: false },
    },
  },
});
