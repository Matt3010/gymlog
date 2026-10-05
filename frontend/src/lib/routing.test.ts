import { describe, expect, it } from 'vitest';
import { canonical, exercisePath, planPath, readRoute, workoutPath } from './routing';

describe('a path', () => {
  it.each([
    ['/', { kind: 'home' }],
    ['/exercises', { kind: 'exercises' }],
    ['/plans', { kind: 'plans' }],
    ['/plans/new', { kind: 'plan', id: null }],
    ['/plans/12', { kind: 'plan', id: 12 }],
    ['/workouts/7', { kind: 'workout', id: 7 }],
    ['/history', { kind: 'history' }],
    ['/exercises/3', { kind: 'exercise', id: 3 }],
  ])('%s is a page', (path, route) => {
    expect(readRoute(path)).toEqual(route);
  });

  // the Italian addresses of before, kept for bookmarks and pages left open
  it.each([
    ['/esercizi', { kind: 'exercises' }],
    ['/schede', { kind: 'plans' }],
    ['/schede/nuova', { kind: 'plan', id: null }],
    ['/schede/12', { kind: 'plan', id: 12 }],
    ['/allenamenti/7', { kind: 'workout', id: 7 }],
    ['/storico', { kind: 'history' }],
    ['/esercizi/3', { kind: 'exercise', id: 3 }],
    ['/statistiche/3', { kind: 'exercise', id: 3 }],
  ])('%s, as it was, is still the page', (path, route) => {
    expect(readRoute(path)).toEqual(route);
  });

  it('may end with a slash', () => {
    expect(readRoute('/plans/12/')).toEqual({ kind: 'plan', id: 12 });
    expect(readRoute('/exercises/')).toEqual({ kind: 'exercises' });
  });

  it.each(['/something', '/plans/abc', '/workouts', '/workouts/0', '/statistiche/x', '/statistiche', '/exercises/x', '/plans/12/more', '/plans/nuova', '/schede/new'])(
    '%s leads home',
    (path) => {
      expect(readRoute(path)).toEqual({ kind: 'home' });
    },
  );
});

describe('the address of a page', () => {
  it('is built from its id', () => {
    expect(planPath(12)).toBe('/plans/12');
    expect(planPath(null)).toBe('/plans/new');
    expect(workoutPath(7)).toBe('/workouts/7');
    expect(exercisePath(3)).toBe('/exercises/3');
  });

  it('is written one way only, in English', () => {
    expect(canonical('/plans/12/')).toBe('/plans/12');
    expect(canonical('/history/')).toBe('/history');
    expect(canonical('/exercises/4/')).toBe('/exercises/4');
    expect(canonical('/schede/12')).toBe('/plans/12');
    expect(canonical('/schede/nuova')).toBe('/plans/new');
    expect(canonical('/storico')).toBe('/history');
    expect(canonical('/allenamenti/7')).toBe('/workouts/7');
    expect(canonical('/statistiche/4')).toBe('/exercises/4');
    expect(canonical('/unknown')).toBe('/');
    expect(canonical('/')).toBe('/');
  });
});
