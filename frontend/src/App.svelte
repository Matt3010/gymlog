<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './components/Button.svelte';
  import Gate from './components/Gate.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import Alert from './components/Alert.svelte';
  import Modal from './components/Modal.svelte';
  import PickPopover from './components/PickPopover.svelte';
  import SenzaRete from './components/SenzaRete.svelte';
  import SurePopover from './components/SurePopover.svelte';
  import LoginScreen from './components/auth/LoginScreen.svelte';
  import HomePage from './components/home/HomePage.svelte';
  import ExercisesPage from './components/exercises/ExercisesPage.svelte';
  import ExerciseStatsPage from './components/exercises/ExerciseStatsPage.svelte';
  import PlansPage from './components/plans/PlansPage.svelte';
  import PlanEditorPage from './components/plans/PlanEditorPage.svelte';
  import WorkoutPage from './components/workouts/WorkoutPage.svelte';
  import HistoryPage from './components/workouts/HistoryPage.svelte';
  import AdminPage from './components/admin/AdminPage.svelte';
  import NowBar from './components/workouts/NowBar.svelte';
  import { session } from './lib/client';
  import { nav } from './lib/nav.svelte';
  import { ui } from './lib/ui.svelte';

  onMount(() => void session.check());

  /*
   * Cambiare pagina chiude quello che sta davanti: una finestra galleggia
   * sopra a tutta l'app, non sopra una pagina, e il suo «Salva» parlerebbe di
   * una pagina che non c'è più. Se dentro c'è del lavoro non salvato, prima
   * di cambiare si chiede (`ui.chiediPrima`).
   */
  nav.custodisci((vai) => ui.primaDiAndare(vai));

  let eravamo = nav.path;
  $effect(() => {
    const siamo = nav.path;
    if (siamo === eravamo) return;
    eravamo = siamo;
    ui.closeAll();
  });

  // «c'è una finestra davanti»: il messaggio allora sale in cima (Toast.svelte)
  $effect(() => {
    document.body.classList.toggle('sheet-open', ui.modal !== null);
  });

  /** Esc toglie quello che sta davanti, uno strato alla volta. */
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') ui.escape();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if session.status === 'in'}
  {@const route = nav.route}
  <!-- La pagina si rifà da capo quando cambia l'indirizzo: due allenamenti
       diversi non si passano lo stato l'uno con l'altro. -->
  {#key nav.path}
    {#if route.kind === 'home'}
      <HomePage />
    {:else if route.kind === 'exercises'}
      <ExercisesPage />
    {:else if route.kind === 'exercise'}
      <ExerciseStatsPage id={route.id} />
    {:else if route.kind === 'plans'}
      <PlansPage />
    {:else if route.kind === 'plan'}
      <PlanEditorPage id={route.id} />
    {:else if route.kind === 'workout'}
      <WorkoutPage id={route.id} />
    {:else if route.kind === 'history'}
      <HistoryPage />
    {:else if route.kind === 'admin'}
      <AdminPage />
    {/if}
  {/key}
  <NowBar />
  <TabBar />
{:else if session.status === 'out'}
  <LoginScreen />
{:else if session.status === 'unreachable'}
  <Gate title="Il server non risponde">
    <Alert message={session.problem} />
    <Button look="primary" extra="go" onclick={() => void session.check()}>Riprova</Button>
  </Gate>
{/if}

<!-- Una per richiesta, tutte montate e si vede solo l'ultima: chi sta sotto
     tiene quello che avevi scritto mentre rispondi a quella sopra. -->
{#each ui.modals as request (request)}
  <Modal {request} davanti={request === ui.modal} />
{/each}

{#if ui.sure}<SurePopover />{/if}
{#if ui.pick}<PickPopover />{/if}

<Toast />
<!-- la rete che manca si dice su ogni pagina, anche dalla porta -->
<SenzaRete />
