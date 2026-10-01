<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /** Un guaio detto per intero: cos'è successo e, se c'è, come uscirne. */
  let {
    message,
    action,
  }: {
    message: string;
    action?: { label: string; run: () => void };
  } = $props();
</script>

<p class="alert" role="alert">
  <Icon name="alert" />
  <span>{message}</span>
  {#if action}
    <Button look="link" extra="alert-fix" onclick={action.run}>{action.label}</Button>
  {/if}
</p>

<style>
  .alert {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0;
    padding: 9px 10px 9px 12px;
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--danger) 11%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 26%, transparent);
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--ink);
    animation: rise 0.22s var(--ease);
  }

  .alert :global(.ico) { width: 15px; height: 15px; flex: none; color: var(--danger); }

  .alert span { flex: 1; min-width: 0; }

  .alert :global(.btn.alert-fix) {
    flex: none;
    padding: 4px 10px;
    border: 0;
    border-radius: 99px;
    background: var(--sunken-hover);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    font-weight: 560;
    transition: background 0.14s;
  }

  @media (hover: hover) {
  .alert :global(.btn.alert-fix:hover) { background: var(--sunken); }
}
</style>
