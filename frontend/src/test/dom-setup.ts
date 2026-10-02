import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { session } from '../lib/client';
import { install } from '../lib/install.svelte';
import { current } from '../lib/current.svelte';
import { nav } from '../lib/nav.svelte';
import { rest } from '../lib/rest.svelte';
import { toast } from '../lib/toast.svelte';
import { ui } from '../lib/ui.svelte';

// Each test starts signed out, at home, with no message on screen and the real fetch back.
afterEach(() => {
  session.signedOut();
  session.status = 'checking';
  vi.unstubAllGlobals();
  vi.useRealTimers();
  toast.hide();
  rest.stop();
  current.workout = null;
  localStorage.clear();
  install.offerta = null;
  install.nonOra = false;
  ui.closeAll();
  nav.custodisci(() => false);
  history.replaceState({}, '', '/');
  nav.path = '/';
});
