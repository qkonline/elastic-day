import { describe, expect, it } from 'vitest';
import { normalizeItem } from './backup';
import { hueColor, inkOn, isHue } from './types';

describe('task colours', () => {
  it('accepts the five named colours and custom #rrggbb ones', () => {
    expect(isHue('lime')).toBe(true);
    expect(isHue('#F472B6')).toBe(true);
    expect(isHue('pink')).toBe(false);
    expect(isHue('#fff')).toBe(false);
    expect(isHue('toString')).toBe(false);
  });

  it('resolves to a CSS colour', () => {
    expect(hueColor('cyan')).toBe('#22d3ee');
    expect(hueColor('#f472b6')).toBe('#f472b6');
  });

  it('picks ink that reads on the colour', () => {
    expect(inkOn('yellow')).toBe('#16181d');
    expect(inkOn('#1e3a8a')).toBe('#ffffff');
  });

  it('keeps a custom colour through import, and replaces anything else', () => {
    expect(normalizeItem({ title: 'A', min: 30, hue: '#f472b6' }).hue).toBe('#f472b6');
    expect(normalizeItem({ title: 'B', min: 30, hue: 'url(x)' }).hue).toBe('cyan');
  });
});
