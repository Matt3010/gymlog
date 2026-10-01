/* What jsdom lacks and the app asks for as soon as it loads: first, before any module of the app. */

// jsdom does not scroll; the app asks to after a navigation.
window.scrollTo = () => undefined;
// nor knows media queries: a desktop with a mouse, wide and light, matches none of the app's
window.matchMedia ??= (query: string) =>
  ({
    matches: false, media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  }) as MediaQueryList;

export {};
