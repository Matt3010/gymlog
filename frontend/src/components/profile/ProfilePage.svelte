<script lang="ts">
  import { session } from '../../lib/client';
  import { accountApi } from '../../lib/endpoints';
  import { toast } from '../../lib/toast.svelte';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import TextField from '../TextField.svelte';

  /**
   * Chi sei e da quando, e la password da cambiare. Si cambia su richiesta
   * («Cambia la password»), con quella attuale e la nuova scritta due volte:
   * è un'azione, non un campo che si salva da sé.
   */
  let current = $state('');
  let next = $state('');
  let again = $state('');
  let working = $state(false);
  let error = $state('');

  const since = $derived(session.user?.createdAt
    ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(session.user.createdAt))
    : null);

  async function change(): Promise<void> {
    error = '';
    if (next !== again) {
      error = 'Le due password non coincidono.';
      return;
    }
    working = true;
    try {
      await accountApi.changePassword(current, next);
      current = next = again = '';
      toast.show('Password cambiata. Le altre sessioni sono chiuse.');
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }
</script>

<PageShell title="Profilo">
  <PageCard>
    <span class="eyebrow">Account</span>
    <span class="name">{session.user?.username}</span>
    {#if since}<span class="since">Iscritto dal {since}</span>{/if}
  </PageCard>

  <PageCard>
    <label class="field">
      <span class="eyebrow">Password attuale</span>
      <TextField kind="password" autocomplete="current-password" maxlength={200} bind:value={current} />
    </label>
    <label class="field">
      <span class="eyebrow">Nuova password</span>
      <TextField kind="password" autocomplete="new-password" maxlength={200} bind:value={next} />
    </label>
    <span class="hint">Almeno 10 caratteri. Le altre sessioni si chiudono.</span>
    <label class="field">
      <span class="eyebrow">Ripeti la nuova password</span>
      <TextField kind="password" autocomplete="new-password" maxlength={200} bind:value={again} />
    </label>
    {#if error}<Alert message={error} />{/if}
    <span class="go">
      <Button look="primary" disabled={working || current === '' || next === '' || again === ''} onclick={() => void change()}>
        Cambia la password
      </Button>
    </span>
  </PageCard>
</PageShell>

<style>
  .name { font-size: 17px; font-weight: 620; letter-spacing: -0.015em; overflow-wrap: anywhere; }

  .since, .hint { font-size: 12.5px; color: var(--ink-3); }

  .go { display: block; }

  @media (min-width: 601px) { .go { justify-self: end; } }
</style>
