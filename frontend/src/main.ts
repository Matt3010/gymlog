import '@fontsource-variable/inter/wght.css';
import './styles/index.css';

import { mount } from 'svelte';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('app') as HTMLElement });

/*
 * Il service worker serve solo a rendere l'app installabile sulla schermata
 * home: non tiene copie di niente, e i dati arrivano sempre dal server. In
 * sviluppo no, perché Vite ricarica da sé.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
