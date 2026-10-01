import { describe, expect, it } from 'vitest';
import { stepValue } from './stepper';

describe('a nudge', () => {
  it('adds or takes one step', () => {
    expect(stepValue('8', 1, { step: 1 })).toBe('9');
    expect(stepValue('8', -1, { step: 1 })).toBe('7');
  });

  it('reads and writes kilos with a comma', () => {
    expect(stepValue('60', 1, { step: 2.5, decimals: true })).toBe('62,5');
    expect(stepValue('62,5', 1, { step: 2.5, decimals: true })).toBe('65');
    expect(stepValue('62.5', -1, { step: 2.5, decimals: true })).toBe('60');
  });

  it('keeps away from float dust', () => {
    expect(stepValue('0,1', 1, { step: 0.2, decimals: true })).toBe('0,3');
  });

  it('never goes below the minimum', () => {
    expect(stepValue('1', -1, { step: 1, min: 1 })).toBe('1');
    expect(stepValue('1', -1, { step: 2.5, decimals: true })).toBe('0');
  });

  it('starts from the minimum when empty or not a number', () => {
    expect(stepValue('', 1, { step: 1, min: 1 })).toBe('2');
    expect(stepValue('abc', 1, { step: 2.5, decimals: true })).toBe('2,5');
  });

  it('writes whole numbers when there are no decimals', () => {
    expect(stepValue('7,6', 1, { step: 1 })).toBe('9');
  });
});
