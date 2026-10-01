<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconName } from '../lib/icons';
  import Icon from './Icon.svelte';

  /** Una tappa della porta: un pin colorato e, accanto, quello che devi scrivere. */
  let {
    icon,
    color,
    label,
    children,
  }: {
    icon: IconName;
    color: string;
    label: string;
    children: Snippet;
  } = $props();
</script>

<label class="stop">
  <span class="stop-pin" style:--c={color}>
    <span class="stop-glyph"><Icon name={icon} /></span>
  </span>
  <span class="stop-card">
    <span class="eyebrow">{label}</span>
    {@render children()}
  </span>
</label>

<style>
  .stop {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .stop-pin {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 50% 6px;
    transform: rotate(-45deg);
    background: var(--c);
    background-image: linear-gradient(135deg, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0) 55%);
    border: 2px solid rgb(255 255 255 / 0.92);
    box-shadow: 0 5px 14px -4px rgb(10 13 18 / 0.55), inset 0 -2px 6px rgb(0 0 0 / 0.14);
  }

  .stop-glyph {
    display: grid;
    place-items: center;
    transform: rotate(45deg);
    color: #fff;
  }

  .stop-glyph :global(.ico) { width: 16px; height: 16px; }

  .stop-card { display: grid; gap: 4px; flex: 1; min-width: 0; }

  @media (prefers-color-scheme: dark) {
    .stop-pin { border-color: rgb(255 255 255 / 0.8); }
  }
</style>
