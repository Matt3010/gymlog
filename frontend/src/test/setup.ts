// The screens' tests run in jsdom; the service worker's in node, without a window.
if (typeof window !== 'undefined') {
  await import('./dom-stubs');
  await import('./dom-setup');
}

export {};
