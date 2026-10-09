import { describe, expect, test } from 'vitest';
import { shortcutFor, shortcutLabels, type KeyTarget } from './shortcuts';

const key = (k: string, extra: Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
});
const page: KeyTarget = { tag: 'BODY', role: null, editable: false, inDialog: false };
const on = (tag: string, extra: Partial<KeyTarget> = {}): KeyTarget => ({ ...page, tag, ...extra });

describe('the key bindings', () => {
  test.each([
    ['ArrowRight', {}, 'microForward'],
    ['ArrowLeft', {}, 'microBack'],
    ['ArrowRight', { shiftKey: true }, 'stageForward'],
    ['ArrowLeft', { shiftKey: true }, 'stageBack'],
    ['g', {}, 'generation'],
    ['G', {}, 'generation'],
    [' ', {}, 'toggle'],
  ] as const)('%s %j does %s', (k, extra, expected) => {
    expect(shortcutFor(key(k, extra), page)).toBe(expected);
  });

  test('every shortcut is labelled for the screen, and the labels are distinct', () => {
    const labels = Object.values(shortcutLabels);
    expect(labels).toHaveLength(6);
    expect(new Set(labels).size).toBe(6);
  });

  test('other keys, and keys with Ctrl, Alt or Meta (browser and system shortcuts), do nothing', () => {
    expect(shortcutFor(key('x'), page)).toBeUndefined();
    expect(shortcutFor(key('ArrowUp'), page)).toBeUndefined();
    expect(shortcutFor(key('g', { ctrlKey: true }), page)).toBeUndefined();
    expect(shortcutFor(key('ArrowRight', { altKey: true }), page)).toBeUndefined(); // Alt+→ is browser forward
    expect(shortcutFor(key(' ', { metaKey: true }), page)).toBeUndefined();
    expect(shortcutFor(key('g', { shiftKey: true }), page)).toBeUndefined();
  });
});

describe('where the keys do not apply', () => {
  test('not while typing in a field', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(shortcutFor(key('g'), on(tag))).toBeUndefined();
      expect(shortcutFor(key(' '), on(tag))).toBeUndefined();
      expect(shortcutFor(key('ArrowRight'), on(tag))).toBeUndefined();
    }
    expect(shortcutFor(key('g'), on('DIV', { editable: true }))).toBeUndefined();
  });

  test('not inside a dialog, where Tab, Esc and Enter belong to the dialog', () => {
    expect(shortcutFor(key('ArrowRight'), on('BUTTON', { inDialog: true }))).toBeUndefined();
    expect(shortcutFor(key('g'), on('DIV', { inDialog: true }))).toBeUndefined();
  });

  test('a slider keeps the arrows (the history bar), and a button keeps Space and Enter', () => {
    expect(shortcutFor(key('ArrowRight'), on('DIV', { role: 'slider' }))).toBeUndefined();
    expect(shortcutFor(key('ArrowLeft', { shiftKey: true }), on('DIV', { role: 'slider' }))).toBeUndefined();
    expect(shortcutFor(key(' '), on('DIV', { role: 'slider' }))).toBeUndefined();
    expect(shortcutFor(key(' '), on('BUTTON'))).toBeUndefined();
    // but a focused button does not stop the arrows or G
    expect(shortcutFor(key('ArrowRight'), on('BUTTON'))).toBe('microForward');
    expect(shortcutFor(key('g'), on('BUTTON'))).toBe('generation');
  });

  test('a switch keeps Space', () => {
    expect(shortcutFor(key(' '), on('INPUT', { role: 'switch' }))).toBeUndefined();
  });
});
