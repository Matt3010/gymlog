import { afterEach, describe, expect, it } from 'vitest';
import { perNome, perTesto, poiPerNome, Vista } from './vista.svelte';

/* How a list is looked at: searched, put in order, turned around, remembered. */

interface Voce {
  name: string;
  group?: string;
  peso?: number;
}

const VOCI: Voce[] = [
  { name: 'Squat', group: 'Gambe', peso: 100 },
  { name: 'Panca', group: 'Petto', peso: 80 },
  { name: 'Affondi', group: 'Gambe', peso: 40 },
  { name: 'Curl' },
];

const names = (voci: Voce[]) => voci.map((voce) => voce.name);

function vista(chiave?: string) {
  return new Vista<Voce>({
    ...(chiave ? { chiave } : {}),
    criteri: [
      { id: 'nome', label: 'Nome', per: perNome },
      { id: 'peso', label: 'Peso', per: (a, b) => (a.peso ?? 0) - (b.peso ?? 0), verso: 'desc', inFondo: (voce) => voce.peso === undefined },
    ],
    testoDi: (voce) => [voce.name, voce.group ?? ''],
  });
}

afterEach(() => localStorage.clear());

describe('a view', () => {
  it('starts on its first criterion, upwards', () => {
    const view = vista();
    expect([view.ordine, view.verso, view.criterio?.label]).toEqual(['nome', 'asc', 'Nome']);
    expect(names(view.applica(VOCI))).toEqual(['Affondi', 'Curl', 'Panca', 'Squat']);
  });

  it('leaves the list it is given as it was', () => {
    const list = [...VOCI];
    vista().applica(list);
    expect(names(list)).toEqual(['Squat', 'Panca', 'Affondi', 'Curl']);
  });

  it('takes the way a criterion wants, and those without a value go last', () => {
    const view = vista();
    view.ordina('peso');
    expect([view.ordine, view.verso]).toEqual(['peso', 'desc']);
    expect(names(view.applica(VOCI))).toEqual(['Squat', 'Panca', 'Affondi', 'Curl']);
    view.gira();
    expect(names(view.applica(VOCI))).toEqual(['Affondi', 'Panca', 'Squat', 'Curl']);
  });

  it('is turned by choosing the same criterion again', () => {
    const view = vista();
    view.ordina('nome');
    expect(view.verso).toBe('desc');
    expect(names(view.applica(VOCI))).toEqual(['Squat', 'Panca', 'Curl', 'Affondi']);
  });

  it('ignores a criterion it does not have', () => {
    const view = vista();
    view.ordina('colore');
    expect(view.ordine).toBe('nome');
  });

  it('searches every field, the first field and the start of a word first', () => {
    const view = vista();
    view.cerca = 'gam';
    expect(names(view.applica(VOCI))).toEqual(['Affondi', 'Squat']);
    view.cerca = '  pan ';
    expect(names(view.applica(VOCI))).toEqual(['Panca']);
    view.cerca = 'a';
    // starts with it in the name, then inside the name, then in the group
    expect(names(view.applica(VOCI))).toEqual(['Affondi', 'Panca', 'Squat']);
  });

  it('searches without minding accents or case', () => {
    const view = new Vista<Voce>({ criteri: [{ id: 'nome', label: 'Nome', per: perNome }], testoDi: (voce) => voce.name });
    view.cerca = 'CAFFE';
    expect(names(view.applica([{ name: 'Caffè' }, { name: 'Tè' }]))).toEqual(['Caffè']);
  });

  it('cannot be searched without saying what to search', () => {
    const view = new Vista<Voce>({ criteri: [{ id: 'nome', label: 'Nome' }] });
    view.cerca = 'x';
    expect(view.cercabile).toBe(false);
    expect(names(view.applica(VOCI))).toEqual(names(VOCI));
  });

  it('remembers how it was left, in this browser', () => {
    const view = vista('prova');
    view.ordina('peso');
    view.gira();
    expect(localStorage.getItem('gymlog.vista.prova')).toBe(JSON.stringify({ ordine: 'peso', verso: 'asc' }));
    const again = vista('prova');
    expect([again.ordine, again.verso]).toEqual(['peso', 'asc']);
  });

  it('forgets a choice whose criterion is gone', () => {
    localStorage.setItem('gymlog.vista.prova', JSON.stringify({ ordine: 'colore', verso: 'desc' }));
    expect([vista('prova').ordine, vista('prova').verso]).toEqual(['nome', 'asc']);
  });

  it('remembers nothing without a key', () => {
    vista().ordina('peso');
    expect(localStorage.length).toBe(0);
  });

  it('starts where it is told to', () => {
    const view = new Vista<Voce>({ criteri: [{ id: 'nome', label: 'Nome' }, { id: 'peso', label: 'Peso', verso: 'desc' }], iniziale: 'peso' });
    expect([view.ordine, view.verso]).toEqual(['peso', 'desc']);
  });

  it('says its order for a request to the server', () => {
    const view = vista();
    view.ordina('peso');
    expect(view.richiesta).toBe('ordine=peso&verso=desc');
  });
});

describe('comparisons', () => {
  it('read numbers as numbers and accents as letters', () => {
    expect(['Tenda 10', 'Tenda 2', 'Èlite', 'Zeta'].sort(perTesto)).toEqual(['Èlite', 'Tenda 2', 'Tenda 10', 'Zeta']);
  });

  it('fall back on the name when equal', () => {
    const byGroup = poiPerNome<Voce>((a, b) => perTesto(a.group ?? '', b.group ?? ''));
    expect(names([...VOCI].sort(byGroup))).toEqual(['Curl', 'Affondi', 'Squat', 'Panca']);
  });
});
