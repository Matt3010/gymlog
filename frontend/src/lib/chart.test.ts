import { describe, expect, it } from 'vitest';
import { chartOf } from './chart';

const box = { width: 300, height: 100, pad: 10 };

describe('a line chart', () => {
  it('spreads the points across the width, oldest on the left', () => {
    const { lines } = chartOf([{ label: 'max', values: [80, 90, 100] }], box);
    expect(lines[0]!.points.map((point) => point.x)).toEqual([10, 150, 290]);
  });

  it('puts the lowest value at the bottom and the highest at the top, with room around', () => {
    const { lines, low, high } = chartOf([{ label: 'max', values: [80, 100] }], box);
    // domain 80..100 widened by a tenth of its span each way: 78..102
    expect([low, high]).toEqual([78, 102]);
    const [first, last] = lines[0]!.points;
    expect(first!.y).toBeCloseTo(10 + 80 * (102 - 80) / 24);
    expect(last!.y).toBeCloseTo(10 + 80 * (102 - 100) / 24);
  });

  it('shares one scale among all the lines', () => {
    const { lines, low, high } = chartOf([{ label: 'max', values: [100, 120] }, { label: 'media', values: [90, 100] }], box);
    expect([low, high]).toEqual([87, 123]);
    expect(lines[1]!.points[1]!.y).toBeCloseTo(lines[0]!.points[0]!.y);
  });

  it('draws a path through the points', () => {
    const { lines } = chartOf([{ label: 'max', values: [80, 100] }], box);
    const [a, b] = lines[0]!.points;
    expect(lines[0]!.path).toBe(`M${a!.x},${a!.y} L${b!.x},${b!.y}`);
  });

  it('centres a single point, and gives a flat line some height', () => {
    const { lines, low, high } = chartOf([{ label: 'max', values: [60] }], box);
    expect(lines[0]!.points[0]).toMatchObject({ x: 150, y: 50, value: 60 });
    expect([low, high]).toEqual([59, 61]);
  });

  it('is empty with no values', () => {
    expect(chartOf([{ label: 'max', values: [] }], box).lines[0]!.points).toEqual([]);
  });
});
