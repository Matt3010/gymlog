<script lang="ts">
  import { session } from '../../lib/client';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Gate from '../Gate.svelte';
  import Icon from '../Icon.svelte';
  import Stop from '../Stop.svelte';
  import TextField from '../TextField.svelte';

  /**
   * La porta. Solo per entrare: gli accessi li crea chi gestisce il server,
   * da riga di comando, quindi qui non c'è un «crea il tuo accesso».
   */
  let username = $state('');
  let password = $state('');
  let mostra = $state(false);
  let error = $state('');
  let working = $state(false);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = '';
    working = true;
    try {
      await session.login(username.trim(), password);
    } catch (failure) {
      error = (failure as Error).message;
      password = '';
    } finally {
      working = false;
    }
  }
</script>

<Gate title="Bentornato" lead="Le tue schede, i tuoi allenamenti e i pesi di ogni serie." onsubmit={submit}>
  <div class="stops">
    <Stop icon="user" color="#2f6fed" label="Utente">
      <TextField name="username" autocomplete="username" required bind:value={username} />
    </Stop>

    <Stop icon="lock" color="#6a4c93" label="Password">
      <span class="peek">
        <TextField
          kind={mostra ? 'text' : 'password'}
          name="password"
          autocomplete="current-password"
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
    </Stop>
  </div>

  {#if error}<Alert message={error} />{/if}

  <Button look="primary" type="submit" extra="go" disabled={working}>
    {working ? 'Un attimo…' : 'Entra'}
    <Icon name="submit" />
  </Button>
</Gate>

<style>
  /* due tappe di un percorso: il tratteggio le tiene insieme */
  .stops {
    position: relative;
    display: grid;
    gap: 14px;
  }

  .stops::before {
    content: "";
    position: absolute;
    left: 17px;
    top: 34px;
    bottom: 34px;
    width: 0;
    border-left: 2px dashed color-mix(in srgb, var(--ink-3) 45%, transparent);
  }

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
