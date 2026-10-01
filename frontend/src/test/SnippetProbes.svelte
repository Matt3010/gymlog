<script lang="ts">
  import StepRail from '../components/StepRail.svelte';
  import Wizard from '../components/Wizard.svelte';

  /** The ported pieces that take snippets, mounted for their smoke tests. */
  let { which }: { which: 'rail' | 'wizard' } = $props();

  const steps = [
    { key: 'a', says: 'primo passo' },
    { key: 'b', wait: 30, says: 'secondo passo', now: true },
  ];
</script>

{#if which === 'rail'}
  <StepRail {steps}>
    {#snippet row(step, at)}<span>riga {at + 1}: {step.says}</span>{/snippet}
  </StepRail>
{:else}
  <Wizard passi={[{ id: 'nome', titolo: 'Il nome' }, { id: 'giorni', titolo: 'I giorni' }]}>
    {#snippet contenuto(id)}<p>passo {id}</p>{/snippet}
  </Wizard>
{/if}
