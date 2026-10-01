import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SnippetProbes from '../test/SnippetProbes.svelte';
import Chip from './Chip.svelte';
import CopyLine from './CopyLine.svelte';
import DateField from './DateField.svelte';
import Hint from './Hint.svelte';
import Lazy from './Lazy.svelte';
import PanelSkeleton from './PanelSkeleton.svelte';
import Pager from './Pager.svelte';
import PickField from './PickField.svelte';
import SearchTrigger from './SearchTrigger.svelte';
import StaleNote from './StaleNote.svelte';
import Tabs from './Tabs.svelte';
import TimeField from './TimeField.svelte';
import ViewControls from './ViewControls.svelte';
import { Vista } from '../lib/vista.svelte';
import { createRawSnippet } from 'svelte';

/*
 * The pieces taken from restaurant-index that no gymlog screen uses yet:
 * each mounts and shows what it is for, so none of them sits in the code
 * untested. They get their full tests when a screen starts using them.
 */

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

describe('the ported pieces not used yet', () => {
  it('Chip shows its name and its count, and answers a touch', async () => {
    const onclick = vi.fn();
    render(Chip, { label: 'Gambe', count: 4, onclick });
    await userEvent.setup().click(screen.getByRole('button', { name: /Gambe/ }));
    expect(screen.getByRole('button')).toHaveTextContent('Gambe 4');
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('CopyLine shows the text to copy', () => {
    render(CopyLine, { text: 'gymlog.example', title: 'Copia l’indirizzo', fallita: 'Copia non riuscita' });
    expect(screen.getByText('gymlog.example')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copia l’indirizzo/ })).toBeInTheDocument();
  });

  it('DateField shows the day chosen, said as a day', () => {
    // today as the phone counts it (local time): in UTC, just after midnight, it is still yesterday
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    render(DateField, { value: today, onchange: vi.fn(), label: 'Il giorno' });
    expect(screen.getByRole('button', { name: 'Il giorno' })).toHaveTextContent('oggi');
  });

  it('Hint shows its instruction, and Esc when asked', () => {
    render(Hint, { esc: true, children: text('Tocca il giorno da spostare') });
    expect(screen.getByRole('status')).toHaveTextContent('Tocca il giorno da spostare Esc');
  });

  it('Lazy shows the component once it has loaded', async () => {
    render(Lazy, { props: { load: () => import('../test/Probe.svelte'), props: { text: 'caricato' } } });
    expect(await screen.findByText('caricato')).toBeInTheDocument();
  });

  it('Pager says where you are, and asks for the next piece', async () => {
    const onpick = vi.fn();
    render(Pager, { total: 42, offset: 8, limit: 8, onpick, what: 'allenamenti' });
    expect(screen.getByText('9–16 di 42 allenamenti')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Più vecchi' }));
    expect(onpick).toHaveBeenCalledWith(16);
  });

  it('PickField shows the choice of now', () => {
    render(PickField, { value: 'b', options: [{ id: 'a', label: 'Alfa' }, { id: 'b', label: 'Beta' }], onpick: vi.fn(), label: 'Scegli' });
    expect(screen.getByRole('button', { name: 'Scegli' })).toHaveTextContent('Beta');
  });

  it('SearchTrigger says what it searches, and opens on a touch', async () => {
    const onclick = vi.fn();
    render(SearchTrigger, { label: 'Cerca un esercizio', onclick });
    await userEvent.setup().click(screen.getByRole('button', { name: /Cerca un esercizio/ }));
    expect(onclick).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Ctrl K|⌘K/)).not.toBeInTheDocument();
  });

  it('StaleNote says that what is shown is old, and why', () => {
    render(StaleNote, { what: 'gli allenamenti', problem: 'il server non risponde', letto: true });
    expect(screen.getByRole('status')).toHaveTextContent('Quello che vedi è dell’ultima lettura riuscita, perché gli allenamenti non si rileggono (il server non risponde).');
  });

  it('StaleNote says nothing was read yet, with a capital', () => {
    render(StaleNote, { what: 'gli allenamenti', problem: 'rete assente', letto: false });
    expect(screen.getByRole('status')).toHaveTextContent('Gli allenamenti non si vedono perché la prima lettura non è riuscita (rete assente). Ricaricando la pagina si riprova.');
  });

  it('StaleNote is silent when all is fresh', () => {
    render(StaleNote, { what: 'gli allenamenti', problem: null, letto: true });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('StepRail shows each step with its wait', () => {
    render(SnippetProbes, { which: 'rail' });
    expect(screen.getByText('riga 1: primo passo')).toBeInTheDocument();
    expect(screen.getByText('riga 2: secondo passo')).toBeInTheDocument();
    expect(screen.getByText('dopo 30 secondi')).toBeInTheDocument();
  });

  it('Tabs show their options, the chosen one marked', async () => {
    const onpick = vi.fn();
    render(Tabs, { value: 'a', options: [{ id: 'a', label: 'Tutti' }, { id: 'b', label: 'Oggi' }], onpick, label: 'Quali' });
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Oggi' }));
    expect(screen.getByRole('tab', { name: 'Tutti' })).toHaveAttribute('aria-selected', 'true');
    expect(onpick).toHaveBeenCalledWith('b');
  });

  it('TimeField shows the time chosen', () => {
    render(TimeField, { value: '07:30', onchange: vi.fn(), label: 'Ora' });
    expect(screen.getByRole('button', { name: 'Ora' })).toHaveTextContent('07:30');
  });

  it('Wizard shows its steps and the content of the first', async () => {
    render(SnippetProbes, { which: 'wizard' });
    expect(screen.getByText('passo nome')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /I giorni/ }));
    expect(screen.getByText('passo giorni')).toBeInTheDocument();
  });

  it('ViewControls says the order and turns it around', async () => {
    const vista = new Vista<unknown>({ criteri: [{ id: 'nome', label: 'Nome' }, { id: 'gruppo', label: 'Gruppo' }] });
    render(ViewControls, { vista });
    expect(screen.getByRole('button', { name: 'Per nome' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTitle('In ordine crescente, tocca per girarlo'));
    expect(vista.verso).toBe('desc');
  });

  it('PanelSkeleton draws the empty shape of a panel', () => {
    render(PanelSkeleton);
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
