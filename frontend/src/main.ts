import '@fontsource-variable/inter/wght.css';
import './styles/index.css';

import { mount } from 'svelte';
import App from './App.svelte';
import { keepUpToDate } from './lib/update';

export default mount(App, { target: document.getElementById('app') as HTMLElement });

/*
 * Il service worker rende l'app installabile e la apre anche senza rete,
 * dal guscio che tiene sul telefono (i dati li tiene l'app: lib/copies,
 * lib/outbox). Tenuta aperta in sottofondo, si aggiorna da sé (lib/update).
 * In sviluppo no, perché Vite ricarica da sé.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
  keepUpToDate(navigator.serviceWorker, document, () => window.location.reload());
}
