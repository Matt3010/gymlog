import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

// The tests of src/lib and of the screens. Apart from vite.config.ts because
// Vitest 3 brings its own Vite, whose plugin types differ from the app's Vite
// 8. The svelte plugin compiles the components and the runes in *.svelte.ts;
// svelteTesting makes Svelte load its browser build in jsdom and unmounts what
// a test mounted.
export default defineConfig({
  // @ts-expect-error the plugins are typed for the app's Vite, and work with Vitest's as well
  plugins: [svelte(), svelteTesting()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
