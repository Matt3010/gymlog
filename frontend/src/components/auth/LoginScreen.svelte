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
  let mostra = $state(false);
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
      <span class="peek">
        <TextField
          kind={mostra ? 'text' : 'password'}
          name="password"
          autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
          maxlength={200}
          required
          bind:value={password}
        />
        <button
          type="button"
          class="peek-btn"
          title={mostra ? 'Nascondi' : 'Mostra'}
          aria-label={mostra ? 'Nascondi la password' : 'Mostra la password'}
          aria-pressed={mostra}
          onclick={() => (mostra = !mostra)}
        >
          <Icon name={mostra ? 'eyeOff' : 'eye'} />
        </button>
      </span>
    </label>
    {#if mode === 'signup'}<span class="hint">Almeno 10 caratteri.</span>{/if}
    {#if mode === 'signup'}
      <label class="field">
        <span class="eyebrow">Ripeti la password</span>
        <TextField kind={mostra ? 'text' : 'password'} name="again" autocomplete="new-password" maxlength={200} required bind:value={again} />
      </label>
    {/if}
  </div>

  {#if error}<Alert message={error} />{/if}

  <Button look="primary" type="submit" extra="go" disabled={working}>
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

  /* l'occhiolino sta dentro al campo, all'altezza del testo */
  .peek { position: relative; display: block; }
  .peek :global(.text-field) { width: 100%; padding-right: 40px; }
  .peek-btn {
    position: absolute;
    top: 50%;
    right: 5px;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    margin-top: -15px;
    padding: 0;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .peek-btn:hover { background: var(--sunken); color: var(--ink-2); }
  .peek-btn[aria-pressed="true"] { color: var(--ink-2); }
  .peek-btn :global(.ico) { width: 16px; height: 16px; }
</style>
