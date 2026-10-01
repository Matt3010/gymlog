import { describe, expect, it } from 'vitest';
import { formatClock, formatDay, formatDuration, formatKg, formatNumber, formatRest, normalise, parseKg } from './format';

describe('a weight', () => {
  it('is written the Italian way, without useless decimals', () => {
    expect(formatKg(100)).toBe('100 kg');
    expect(formatKg(62.5)).toBe('62,5 kg');
    expect(formatKg(1.25)).toBe('1,25 kg');
    expect(formatKg(0)).toBe('0 kg');
  });

  it('is read with a comma or a dot', () => {
    expect(parseKg('62,5')).toBe(62.5);
    expect(parseKg(' 62.5 ')).toBe(62.5);
    expect(parseKg('100')).toBe(100);
  });

  it('is read while being typed: a separator at the end counts for nothing', () => {
    expect(parseKg('22,')).toBe(22);
    expect(parseKg('22.')).toBe(22);
    expect(parseKg('22,5')).toBe(22.5);
    expect(parseKg('0,5')).toBe(0.5);
    expect(parseKg(',5')).toBe(0.5);
  });

  it('is nothing with two separators or a separator alone', () => {
    expect(parseKg('2,2,5')).toBeNull();
    expect(parseKg('2.2,5')).toBeNull();
    expect(parseKg(',')).toBeNull();
  });

  it('is nothing when it is not a number', () => {
    expect(parseKg('')).toBeNull();
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('-5')).toBeNull();
  });
});

describe('a big number', () => {
  it('groups thousands with a dot', () => {
    expect(formatNumber(12500)).toBe('12.500');
    expect(formatNumber(512.5)).toBe('512,5');
  });
});

describe('a rest', () => {
  it('is minutes and seconds', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(60)).toBe('1:00');
    expect(formatRest(5)).toBe('0:05');
    expect(formatRest(0)).toBe('0:00');
  });

  it('never goes below zero', () => {
    expect(formatRest(-3)).toBe('0:00');
  });
});

describe('a duration', () => {
  it('is minutes under the hour, hours and minutes above', () => {
    expect(formatDuration('2026-09-01T17:00:00Z', '2026-09-01T17:42:30Z')).toBe('42 min');
    expect(formatDuration('2026-09-01T17:00:00Z', '2026-09-01T18:05:00Z')).toBe('1 h 05 min');
    // the server's clock a little ahead of the phone's: a workout just started is not «-1 min»
    expect(formatDuration('2026-09-01T17:00:40Z', '2026-09-01T17:00:00Z')).toBe('0 min');
    expect(formatDuration('2026-09-01T17:00:00Z', '2026-09-01T17:00:20Z')).toBe('0 min');
  });
});

describe('a day', () => {
  const now = new Date(2026, 9, 1, 12, 0); // giovedì 1 ottobre 2026, ora locale

  it('is today or yesterday when it is', () => {
    expect(formatDay(new Date(2026, 9, 1, 7, 30).toISOString(), now)).toBe('Oggi');
    expect(formatDay(new Date(2026, 8, 30, 23, 59).toISOString(), now)).toBe('Ieri');
  });

  it('is the weekday and the date otherwise, the year only when another', () => {
    expect(formatDay(new Date(2026, 8, 28, 18, 0).toISOString(), now)).toBe('lun 28 set');
    expect(formatDay(new Date(2025, 11, 31, 18, 0).toISOString(), now)).toBe('mer 31 dic 2025');
  });

  it('has its time on the clock', () => {
    expect(formatClock(new Date(2026, 8, 28, 7, 5).toISOString())).toBe('07:05');
  });
});

describe('search', () => {
  it('ignores accents and case', () => {
    expect(normalise('Crunch Obliquo')).toBe('crunch obliquo');
    expect(normalise('Più')).toBe('piu');
  });
});
