import { describe, expect, it } from 'vitest';
import { dopoGiorni, fusoDelBrowser, oraIn } from './fuso';
import { durata, GIORNI, nextDays, saysDay, saysDays, saysLeft, saysShortDay, saysWait, today } from './timing';

const ROME = 'Europe/Rome';
const NOW = new Date('2026-10-01T10:00:00Z'); // giovedì

describe('a time zone', () => {
  it('gives the date, the clock and the weekday there', () => {
    expect(oraIn(ROME, NOW)).toEqual({ date: '2026-10-01', clock: '12:00', day: 4 });
    expect(oraIn('America/New_York', NOW)).toEqual({ date: '2026-10-01', clock: '06:00', day: 4 });
    expect(oraIn('Pacific/Auckland', new Date('2026-10-01T23:30:00Z'))).toMatchObject({ date: '2026-10-02', day: 5 });
  });

  it('writes midnight as 00, never 24', () => {
    expect(oraIn(ROME, new Date('2026-09-30T22:00:00Z')).clock).toBe('00:00');
  });

  it('is this browser’s by default, Rome when it says none', () => {
    expect(fusoDelBrowser()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome');
  });

  it('counts days across months and years', () => {
    expect(dopoGiorni('2026-12-30', 3)).toBe('2027-01-02');
    expect(dopoGiorni('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('a day, said', () => {
  it('is today, tomorrow, the day after, as one says them', () => {
    expect(saysDay('2026-10-01', ROME, NOW)).toBe('oggi');
    expect(saysDay('2026-10-02', ROME, NOW)).toBe('domani');
    expect(saysDay('2026-10-03', ROME, NOW)).toBe('dopodomani');
  });

  it('is the weekday and the date further on, the year only when not this one', () => {
    expect(saysDay('2026-10-05', ROME, NOW)).toBe('lunedì 5 ottobre');
    expect(saysDay('2026-09-30', ROME, NOW)).toBe('mercoledì 30 settembre');
    expect(saysDay('2027-01-04', ROME, NOW)).toBe('lunedì 4 gennaio 2027');
  });

  it('is short in narrow rows', () => {
    expect(saysShortDay(NOW.getTime(), ROME, NOW)).toBe('oggi');
    expect(saysShortDay(Date.parse('2026-10-02T10:00:00Z'), ROME, NOW)).toBe('domani');
    expect(saysShortDay(Date.parse('2026-10-08T10:00:00Z'), ROME, NOW)).toBe('gio 8');
  });

  it('weekdays are said in a word', () => {
    expect(GIORNI).toEqual(['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']);
    expect(saysDays([])).toBe('ogni giorno');
    expect(saysDays([0, 1, 2, 3, 4, 5, 6])).toBe('ogni giorno');
    expect(saysDays([5, 1, 2, 3, 4])).toBe('dal lunedì al venerdì');
    expect(saysDays([6, 0])).toBe('sabato e domenica');
    expect(saysDays([5, 1, 3])).toBe('lun mer ven');
    expect(saysDays([1, 2, 3, 4])).toBe('lun mar mer gio');
  });

  it('today and the next days come from the time zone', () => {
    expect(today(ROME)).toBe(oraIn(ROME).date);
    const days = nextDays(3, ROME);
    expect(days).toEqual([today(ROME), dopoGiorni(today(ROME), 1), dopoGiorni(today(ROME), 2)]);
    expect(nextDays(undefined, ROME)).toHaveLength(30);
  });
});

describe('a wait, said', () => {
  it('counting down is short: seconds, then minutes, then hours', () => {
    expect(saysLeft(42.2)).toBe('43 s');
    expect(saysLeft(-3)).toBe('0 s');
    expect(saysLeft(60)).toBe('1:00');
    expect(saysLeft(245)).toBe('4:05');
    expect(saysLeft(3599)).toBe('59:59');
    expect(saysLeft(3600)).toBe('1 h 00');
    expect(saysLeft(4800)).toBe('1 h 20');
  });

  it('is «insieme» when there is none', () => {
    expect(saysWait(0)).toBe('insieme');
    expect(saysWait(undefined)).toBe('insieme');
    expect(saysWait(90)).toBe('dopo 1 minuto e 30 secondi');
  });

  it('as a duration names every part, joined the Italian way', () => {
    expect(durata(0)).toBe('0 secondi');
    expect(durata(1)).toBe('1 secondo');
    expect(durata(2)).toBe('2 secondi');
    expect(durata(60)).toBe('1 minuto');
    expect(durata(120)).toBe('2 minuti');
    expect(durata(3600)).toBe('1 ora');
    expect(durata(7200)).toBe('2 ore');
    expect(durata(5400)).toBe('1 ora e 30 minuti');
    expect(durata(3661)).toBe('1 ora, 1 minuto e 1 secondo');
    expect(durata(-5)).toBe('0 secondi');
    expect(durata(89.6)).toBe('1 minuto e 30 secondi');
  });
});
