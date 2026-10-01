import { describe, expect, it } from 'vitest';
import { canonical, exerciseStatsPath, planPath, readRoute, workoutPath } from './routing';

describe('a path', () => {
  it.each([
    ['/', { kind: 'home' }],
    ['/esercizi', { kind: 'exercises' }],
    ['/schede', { kind: 'plans' }],
    ['/schede/nuova', { kind: 'plan', id: null }],
    ['/schede/12', { kind: 'plan', id: 12 }],
    ['/allenamenti/7', { kind: 'workout', id: 7 }],
    ['/storico', { kind: 'history' }],
    ['/statistiche', { kind: 'stats' }],
    ['/statistiche/3', { kind: 'exerciseStats', id: 3 }],
  ])('%s is a page', (path, route) => {
    expect(readRoute(path)).toEqual(route);
  });

  it('may end with a slash', () => {
    expect(readRoute('/schede/12/')).toEqual({ kind: 'plan', id: 12 });
    expect(readRoute('/esercizi/')).toEqual({ kind: 'exercises' });
  });

  it.each(['/qualcosa', '/schede/abc', '/allenamenti', '/allenamenti/0', '/statistiche/x', '/schede/12/altro'])(
    '%s leads home',
    (path) => {
      expect(readRoute(path)).toEqual({ kind: 'home' });
    },
  );
});

describe('the address of a page', () => {
  it('is built from its id', () => {
    expect(planPath(12)).toBe('/schede/12');
    expect(planPath(null)).toBe('/schede/nuova');
    expect(workoutPath(7)).toBe('/allenamenti/7');
    expect(exerciseStatsPath(3)).toBe('/statistiche/3');
  });

  it('is written one way only', () => {
    expect(canonical('/schede/12/')).toBe('/schede/12');
    expect(canonical('/storico/')).toBe('/storico');
    expect(canonical('/statistiche/')).toBe('/statistiche');
    expect(canonical('/sconosciuta')).toBe('/');
    expect(canonical('/')).toBe('/');
  });
});
