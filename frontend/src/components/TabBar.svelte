<script lang="ts">
  import { nav } from '../lib/nav.svelte';
  import { EXERCISES_PATH, HOME_PATH, PLANS_PATH, type Route } from '../lib/routing';
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
    // lo storico si apre dalla home («Tutto lo storico»): sta sotto Allenati
    { href: HOME_PATH, label: 'Allenati', icon: 'home', owns: ['home', 'workout', 'history'] },
    { href: PLANS_PATH, label: 'Schede', icon: 'plans', owns: ['plans', 'plan'] },
    { href: EXERCISES_PATH, label: 'Esercizi', icon: 'exercises', owns: ['exercises', 'exercise'] },
  ];
</script>

<nav class="bar" aria-label="Sezioni">
  {#each SECTIONS as section (section.href)}
    {@const here = section.owns.includes(nav.route.kind)}
    <a href={section.href} class:here aria-current={here ? 'page' : undefined}>
      <Icon name={section.icon} />
      <span>{section.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-bar);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    height: var(--tab-bar);
    padding: 0 max(6px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(6px, env(safe-area-inset-left));
    background: var(--glass);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    backdrop-filter: blur(28px) saturate(180%);
    border-top: 1px solid var(--hairline);
  }

  @supports not (backdrop-filter: blur(1px)) {
    .bar { background: var(--glass-strong); }
  }

  a {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 3px;
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

  a :global(.ico) { width: 21px; height: 21px; }

  @media (hover: hover) {
  a:hover { color: var(--ink-2); }
}

  a.here { color: var(--ink); }

  a.here :global(.ico) { stroke-width: 2.1; }
</style>
