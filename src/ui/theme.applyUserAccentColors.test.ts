/**
 * Tests for applyUserAccentColors in theme.ts.
 *
 * Since jsdom is not configured in this project, we test the function via a
 * manual mock of document.documentElement.style.setProperty. This lets us
 * verify which CSS custom properties are written without a browser environment.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyUserAccentColors } from './theme';

describe('applyUserAccentColors', () => {
  // Track calls to setProperty.
  const setPropertyCalls: Array<[string, string]> = [];

  beforeEach(() => {
    setPropertyCalls.length = 0;

    // Stub document.documentElement.style.setProperty
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: (prop: string, value: string) => {
            setPropertyCalls.push([prop, value]);
          },
          getPropertyValue: () => '',
        },
        getAttribute: () => null,
        setAttribute: () => undefined,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes --accent-claude when claude is in the record', () => {
    applyUserAccentColors({ claude: '#FF0000' });
    expect(setPropertyCalls).toContainEqual(['--accent-claude', '#FF0000']);
  });

  it('writes --accent-gpt when gpt-5.5 is in the record', () => {
    applyUserAccentColors({ 'gpt-5.5': '#00FF00' });
    expect(setPropertyCalls).toContainEqual(['--accent-gpt', '#00FF00']);
  });

  it('writes --accent-gemini when gemini is in the record', () => {
    applyUserAccentColors({ gemini: '#0000FF' });
    expect(setPropertyCalls).toContainEqual(['--accent-gemini', '#0000FF']);
  });

  it('writes --accent-grok when grok is in the record', () => {
    applyUserAccentColors({ grok: '#FF00FF' });
    expect(setPropertyCalls).toContainEqual(['--accent-grok', '#FF00FF']);
  });

  it('writes --accent-deepseek when deepseek is in the record', () => {
    applyUserAccentColors({ deepseek: '#FFFF00' });
    expect(setPropertyCalls).toContainEqual(['--accent-deepseek', '#FFFF00']);
  });

  it('writes --accent-mistral when mistral is in the record', () => {
    applyUserAccentColors({ mistral: '#00FFFF' });
    expect(setPropertyCalls).toContainEqual(['--accent-mistral', '#00FFFF']);
  });

  it('writes multiple vars when multiple models are present', () => {
    applyUserAccentColors({
      claude: '#AA0000',
      'gpt-5.5': '#00AA00',
      mistral: '#0000AA',
    });
    expect(setPropertyCalls).toContainEqual(['--accent-claude', '#AA0000']);
    expect(setPropertyCalls).toContainEqual(['--accent-gpt', '#00AA00']);
    expect(setPropertyCalls).toContainEqual(['--accent-mistral', '#0000AA']);
  });

  it('does NOT write vars for models absent from the record', () => {
    // Only claude is set — gemini should not appear in the calls.
    applyUserAccentColors({ claude: '#AA0000' });
    const writtenVars = setPropertyCalls.map(([prop]) => prop);
    expect(writtenVars).not.toContain('--accent-gemini');
    expect(writtenVars).not.toContain('--accent-grok');
    expect(writtenVars).not.toContain('--accent-deepseek');
    expect(writtenVars).not.toContain('--accent-mistral');
  });

  it('writes nothing when called with an empty object', () => {
    applyUserAccentColors({});
    // applyTheme writes other vars — but applyUserAccentColors only writes
    // accent vars. With an empty record, setProperty is never called by this fn.
    // (applyTheme is not called here, so the stub starts clean.)
    expect(setPropertyCalls).toHaveLength(0);
  });
});
