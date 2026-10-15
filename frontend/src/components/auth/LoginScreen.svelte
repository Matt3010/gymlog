<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../../lib/client';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Gate from '../Gate.svelte';
  import Icon from '../Icon.svelte';
  import TextField from '../TextField.svelte';

  /**
   * La porta: entrare, o creare un account quando il server lo permette
   * (`GET /auth/signup`). Le stesse due schede con lo stesso vestito, e si
   * passa dall'una all'altra senza perdere il nome scritto. Creato l'account
   * si è già dentro.
   */
  let mode = $state<'login' | 'signup'>('login');
  let signupOpen = $state(false);
  let username = $state('');
  let password = $state('');
  let again = $state('');
  let error = $state('');
  let working = $state(false);

  onMount(() => void session.signupOpen().then((open) => (signupOpen = open)));

  function switchTo(next: 'login' | 'signup'): void {
    mode = next;
    error = '';
    password = '';
    again = '';
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = '';
    if (mode === 'signup' && password !== again) {
      error = 'Le due password non coincidono.';
      return;
    }
    working = true;
    try {
      if (mode === 'signup') await session.register(username.trim(), password);
      else await session.login(username.trim(), password);
    } catch (failure) {
      error = (failure as Error).message;
      password = '';
      again = '';
    } finally {
      working = false;
    }
  }
</script>

<Gate
  title={mode === 'login' ? 'Bentornato' : 'Crea il tuo account'}
  lead={mode === 'login' ? 'Le tue schede, i tuoi allenamenti e i pesi di ogni serie.' : 'Un nome e una password, e sei dentro.'}
  onsubmit={submit}
>
  <div class="fields">
    <label class="field">
      <span class="eyebrow">Utente</span>
      <TextField name="username" autocomplete="username" maxlength={30} required bind:value={username} />
    </label>
    <label class="field">
      <span class="eyebrow">Password</span>
      <TextField
        kind="password"
        name="password"
        autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
        maxlength={200}
        required
        bind:value={password}
      />
    </label>
    {#if mode === 'signup'}<span class="hint">Almeno 10 caratteri.</span>{/if}
    {#if mode === 'signup'}
      <label class="field">
        <span class="eyebrow">Ripeti la password</span>
        <TextField kind="password" name="again" autocomplete="new-password" maxlength={200} required bind:value={again} />
      </label>
    {/if}
  </div>

  {#if error}<Alert message={error} />{/if}

  <Button look="primary" type="submit" size="lg" disabled={working}>
    {working ? 'Un attimo…' : mode === 'login' ? 'Entra' : 'Crea l’account'}
    <Icon name="submit" />
  </Button>

  {#if mode === 'signup'}
    <Button look="link" onclick={() => switchTo('login')}>Ho già un account</Button>
  {:else if signupOpen}
    <Button look="link" onclick={() => switchTo('signup')}>Crea un account</Button>
  {/if}
</Gate>

<style>
  .fields { display: grid; gap: 14px; }

  .field { display: grid; gap: 6px; }

  .hint { margin-top: -8px; font-size: 11.5px; color: var(--ink-3); }
</style>
