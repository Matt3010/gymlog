<script lang="ts">
  import { nav } from '../lib/nav.svelte';
  import { EXERCISES_PATH, HISTORY_PATH, HOME_PATH, PLANS_PATH, type Route } from '../lib/routing';
  import type { IconName } from '../lib/icons';
  import Icon from './Icon.svelte';

  /**
   * Le sezioni dell'app, in fondo allo schermo.
   *
   * In restaurant-index le pagine si scambiano dalle linguette in cima. Qui
   * l'app si usa col telefono in una mano fra una serie e l'altra, e in cima
   * il pollice non ci arriva: le stesse porte stanno in fondo, sempre. Un
   * allenamento aperto è di «Allenati», una scheda di «Schede», un esercizio
   * di «Esercizi».
   */
  const SECTIONS: { href: string; label: string; icon: IconName; owns: Route['kind'][] }[] = [
    { href: HOME_PATH, label: 'Allenati', icon: 'home', owns: ['home', 'workout'] },
    { href: PLANS_PATH, label: 'Schede', icon: 'plans', owns: ['plans', 'plan'] },
    { href: EXERCISES_PATH, label: 'Esercizi', icon: 'exercises', owns: ['exercises', 'exercise'] },
    // gli allenamenti fatti: una sezione sua, la home resta per cominciare
    { href: HISTORY_PATH, label: 'Storico', icon: 'history', owns: ['history'] },
  ];
</script>

<nav class="bar" aria-label="Sezioni">
  {#each SECTIONS as section (section.href)}
    {@const here = section.owns.includes(nav.route.kind)}
    <a href={section.href} class:here aria-current={here ? 'page' : undefined}>
      <span class="pill"><Icon name={section.icon} /></span>
      <span>{section.label}</span>
    </a>
  {/each}
</nav>

<style>
  /* un'isola che galleggia sopra la pagina, staccata dai bordi e dal fondo */
  .bar {
    position: fixed;
    left: var(--island-side);
    right: var(--island-side);
    bottom: var(--island-gap);
    z-index: var(--z-bar);
    max-width: 520px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    height: 64px;
    padding: 0 6px;
    border: 1px solid var(--hairline);
    border-radius: 32px;
    background: var(--glass);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    backdrop-filter: blur(28px) saturate(180%);
    box-shadow: var(--shadow-2);
  }

  @supports not (backdrop-filter: blur(1px)) {
    .bar { background: var(--glass-strong); }
  }

  a {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 2px;
    min-width: 0;
    color: var(--ink-3);
    text-decoration: none;
    font-size: 10.5px;
    font-weight: 560;
    letter-spacing: 0.01em;
    transition: color 0.16s;
  }

  a span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* l'icona sta in una pastiglia, accesa per la sezione in cui sei */
  .pill {
    display: grid;
    place-items: center;
    width: 52px;
    height: 28px;
    border-radius: 14px;
    transition: background 0.16s;
  }

  a.here .pill { background: var(--sunken-hover); }

  a :global(.ico) { width: 20px; height: 20px; }

  @media (hover: hover) {
  a:hover { color: var(--ink-2); }
}

  a.here { color: var(--ink); }

  a.here :global(.ico) { stroke-width: 2.1; }
</style>
