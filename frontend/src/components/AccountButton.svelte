<script lang="ts">
  import { session } from '../lib/client';
  import { nav } from '../lib/nav.svelte';
  import { ADMIN_PATH, PROFILE_PATH } from '../lib/routing';
  import { ui } from '../lib/ui.svelte';

  /**
   * Chi sei, in alto a destra in ogni pagina, sempre allo stesso posto: un
   * cerchio con l'iniziale del nome. Toccato, apre un menu corto (lo stesso
   * di ogni scelta accanto a un tasto, `ui.askPick`): il profilo, l'utilizzo
   * dell'app per chi la amministra, e l'uscita, che prima chiede.
   */
  const name = $derived(session.user?.username ?? '');

  function open(event: MouseEvent): void {
    const anchor = event.currentTarget as HTMLElement;
    ui.askPick(anchor, {
      title: name,
      options: [
        { id: 'profile', label: 'Profilo' },
        ...(session.user?.isAdmin ? [{ id: 'usage', label: 'Utilizzo dell’app' }] : []),
        { id: 'out', label: 'Esci' },
      ],
      onPick: (id) => {
        if (id === 'profile') nav.go(PROFILE_PATH);
        else if (id === 'usage') nav.go(ADMIN_PATH);
        // un tocco per sbaglio in palestra costerebbe un nuovo accesso: prima si chiede
        else ui.askSure(anchor, { title: 'Uscire da gymlog?', verb: 'Esci', onYes: () => void session.logout() });
      },
    });
  }
</script>

{#if session.user}
  <button type="button" class="account" aria-label="Account di {name}" title="Account di {name}" onclick={open}>
    {name.charAt(0).toUpperCase()}
  </button>
{/if}

<style>
  .account {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--accent-grad);
    color: var(--on-accent);
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
  }

  /* alto quanto un dito dove si tocca, senza spostare il titolo */
  @media (hover: none) {
    .account { box-shadow: 0 0 0 5px transparent; }
  }

  .account:active { filter: brightness(0.9); }
</style>
