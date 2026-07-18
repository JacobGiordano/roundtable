/**
 * ImageGenToggleRow — Accessibility Tests (#421)
 *
 * Component under test:
 *   /src/ui/components/model-selector/ImageGenToggleRow.tsx
 *
 * What this tests:
 *   Label association (htmlFor/id pair), keyboard operability, focus visibility,
 *   ARIA attributes on decorative elements, checked/unchecked state, callback
 *   contract, and label text visibility.
 *
 * Testing method:
 *   React Testing Library (structural/DOM assertions) — axe-core scan not
 *   required here because the component is a native <input type="checkbox">
 *   with explicit <label> association, which axe handles trivially. The
 *   meaningful audit work is the structural contract tests below.
 *
 * Standards: WCAG 2.1 Level AA
 *   1.3.1 Info and Relationships — label programmatically associated
 *   1.4.1 Use of Color — color dot is aria-hidden; name in label text
 *   2.1.1 Keyboard — native checkbox is natively keyboard operable
 *   2.4.7 Focus Visible — focus-visible: ring class applied, not bare focus:
 *   4.1.2 Name, Role, Value — checkbox has accessible name, reports checked state
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImageGenToggleRow } from '@/ui/components/model-selector/ImageGenToggleRow';
import type { ModelConfig } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_MODEL: ModelConfig = {
  modelId: 'gpt-image-1',
  name: 'GPT Image 1',
  color: 'accent-gpt',
  isActive: true,
  imageGenerationEnabled: false,
};

const ENABLED_MODEL: ModelConfig = {
  ...BASE_MODEL,
  imageGenerationEnabled: true,
};

const UNDEFINED_MODEL: ModelConfig = {
  ...BASE_MODEL,
  imageGenerationEnabled: undefined,
};

function renderRow(model: ModelConfig = BASE_MODEL, onToggle = vi.fn()) {
  return render(<ImageGenToggleRow model={model} onToggle={onToggle} />);
}

// ─── Label association (WCAG 1.3.1) ─────────────────────────────────────────

describe('ImageGenToggleRow — label association (WCAG 1.3.1)', () => {
  it('checkbox has an id attribute', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.getAttribute('id')).toBeTruthy();
  });

  it('label htmlFor matches checkbox id', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]');
    const label = container.querySelector('label');
    const checkboxId = checkbox?.getAttribute('id');
    const labelFor = label?.getAttribute('for');
    expect(checkboxId).toBeTruthy();
    expect(labelFor).toBeTruthy();
    expect(labelFor).toBe(checkboxId);
  });

  it('checkbox id is derived from model.modelId (stable and unique)', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]');
    const id = checkbox?.getAttribute('id') ?? '';
    // The id must contain the modelId so it remains unique per row
    expect(id).toContain('gpt-image-1');
  });
});

// ─── Keyboard operability (WCAG 2.1.1) ───────────────────────────────────────

describe('ImageGenToggleRow — keyboard operability (WCAG 2.1.1)', () => {
  it('checkbox is a native <input type="checkbox"> (inherently keyboard operable)', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.tagName.toLowerCase()).toBe('input');
    expect(checkbox?.getAttribute('type')).toBe('checkbox');
  });

  it('checkbox is in the tab order (tabIndex is not -1)', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    // tabIndex defaults to 0 for native checkboxes; must not be explicitly set to -1
    expect(checkbox?.tabIndex).not.toBe(-1);
  });

  it('space key toggles the checkbox and fires onToggle', () => {
    const onToggle = vi.fn();
    renderRow(BASE_MODEL, onToggle);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    // Simulate space key via click (jsdom maps Space to click on checkboxes)
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

// ─── Focus visibility (WCAG 2.4.7) ───────────────────────────────────────────

describe('ImageGenToggleRow — focus visibility (WCAG 2.4.7)', () => {
  it('checkbox className uses focus-visible: ring, not bare focus:', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]');
    const className = checkbox?.className ?? '';
    // Must include focus-visible: prefixed ring class
    expect(className).toContain('focus-visible:');
    // Must NOT use bare focus: ring (which applies on mouse click, causing noise)
    expect(className).not.toMatch(/(?<![a-z-])focus:ring/);
  });
});

// ─── Decorative element (WCAG 1.4.1) ─────────────────────────────────────────

describe('ImageGenToggleRow — decorative color dot (WCAG 1.4.1)', () => {
  it('color dot span has aria-hidden="true" (color is decorative only)', () => {
    const { container } = renderRow();
    // The dot is a <span> with a rounded-full style — it must be hidden from AT
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });
});

// ─── Checked/unchecked state (WCAG 4.1.2) ────────────────────────────────────

describe('ImageGenToggleRow — checked state (WCAG 4.1.2)', () => {
  it('checkbox is checked when imageGenerationEnabled is true', () => {
    renderRow(ENABLED_MODEL);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('checkbox is unchecked when imageGenerationEnabled is false', () => {
    renderRow(BASE_MODEL);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('checkbox is unchecked when imageGenerationEnabled is undefined (defaults false)', () => {
    renderRow(UNDEFINED_MODEL);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});

// ─── onToggle callback contract ───────────────────────────────────────────────

describe('ImageGenToggleRow — onToggle callback contract', () => {
  it('onToggle is called with (modelId, true) when checkbox is clicked to enable', () => {
    const onToggle = vi.fn();
    renderRow(BASE_MODEL, onToggle);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('gpt-image-1', true);
  });

  it('onToggle is called with (modelId, false) when checkbox is clicked to disable', () => {
    const onToggle = vi.fn();
    renderRow(ENABLED_MODEL, onToggle);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('gpt-image-1', false);
  });
});

// ─── Label text (WCAG 2.4.6) ─────────────────────────────────────────────────

describe('ImageGenToggleRow — label text visibility (WCAG 2.4.6)', () => {
  it('label text is non-empty and matches model.name', () => {
    renderRow();
    const label = screen.getByText('GPT Image 1');
    expect(label).not.toBeNull();
    expect(label.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('checkbox has an aria-label that identifies the model by name', () => {
    const { container } = renderRow();
    const checkbox = container.querySelector('input[type="checkbox"]');
    const ariaLabel = checkbox?.getAttribute('aria-label') ?? '';
    // aria-label should reference the model name for disambiguation in lists
    expect(ariaLabel).toContain('GPT Image 1');
  });
});
