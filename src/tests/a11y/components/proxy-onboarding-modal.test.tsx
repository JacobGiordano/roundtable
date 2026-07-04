/**
 * ProxyOnboardingModal — Axe-core + Focus Trap + ARIA Accessibility Tests (issue #332)
 *
 * Component under test:
 *   src/ui/components/ProxyOnboardingModal.tsx
 *
 * Standards: WCAG 2.1 Level AA
 *
 * States under test:
 *   - Initial render (4 focusable elements, Deploy link receives focus)
 *   - URL validation error (aria-invalid + role="alert" error paragraph)
 *   - Save & continue (button disabled + text change after successful save)
 *
 * Testing method:
 *   - Automated axe-core scanning
 *   - DOM assertions for dialog ARIA contract (role, aria-modal, aria-labelledby)
 *   - URL input: aria-label, aria-invalid, aria-describedby
 *   - Focus trap: Tab forward cycle, Shift+Tab backward cycle (WCAG 2.1.2)
 *   - Escape key: calls onDismiss (WCAG 2.1.2)
 *   - Enter key on URL input: triggers validation
 *   - Deploy to Cloudflare link: is a native <a> with href, rel="noopener noreferrer"
 *   - Reduced motion: modal renders in final state without animation
 *
 * Contrast audit: SKIPPED — all tokens (bg-accent-claude, text-text-inverse,
 * text-text-primary, text-text-secondary, text-text-muted, bg-input, bg-card,
 * bg-success/10, text-success, text-error, bg-hover) are existing tokens already
 * audited across prior Ada sessions. No novel color choices introduced.
 *
 * Advisory finding (AAA, not a blocker):
 *   Dismiss button: py-2 px-2 ≈ 35px height. Below WCAG 2.5.5 (AAA) 44px minimum.
 *   Passes WCAG 2.5.8 (WCAG 2.2 AA) 24px minimum. Advisory only.
 *
 * Advisory finding (VoiceOver/Safari specific):
 *   <ol list-none> without role="list" may strip ordered list semantics in VoiceOver.
 *   aria-label="Setup steps" is present but does not reinstate the list role.
 *   Fix: add role="list" to the <ol>. See advisory ticket filed with this audit.
 */

import React, { useRef } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ProxyOnboardingModal } from '@/ui/components/ProxyOnboardingModal';

// ─── jsdom setup — matchMedia ─────────────────────────────────────────────────
// ProxyOnboardingModal calls window.matchMedia('(prefers-reduced-motion: reduce)')
// at component initialisation. jsdom does not implement matchMedia natively.
// Default: no preference (matches: false) so animation code path runs.

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ─── Axe assertion helper ─────────────────────────────────────────────────────

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n'),
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── ModalWrapper ─────────────────────────────────────────────────────────────
// ProxyOnboardingModal requires a returnFocusRef prop pointing to a mounted DOM
// element. This wrapper provides a trigger button as the return target — matching
// the real-world InputBar usage where the textarea is the trigger element.

interface WrapperProps {
  onSaveAndContinue?: (url: string) => void;
  onDismiss?: () => void;
}

function ModalWrapper({
  onSaveAndContinue = vi.fn(),
  onDismiss = vi.fn(),
}: WrapperProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {/* Simulates the InputBar textarea (the return focus target in production). */}
      <button ref={triggerRef} data-testid="trigger">
        Send
      </button>
      <ProxyOnboardingModal
        onSaveAndContinue={onSaveAndContinue}
        onDismiss={onDismiss}
        returnFocusRef={triggerRef as React.RefObject<HTMLElement | null>}
      />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all focusable elements inside the dialog panel, in DOM order. */
function getDialogFocusables(): HTMLElement[] {
  const panel = screen.getByRole('dialog');
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])',
    ),
  );
}

/** Returns the dialog panel element. */
function getDialog(): HTMLElement {
  return screen.getByRole('dialog');
}

// ─── Reset between tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Axe scans (WCAG 4.1.2) ──────────────────────────────────────────────────

describe('ProxyOnboardingModal — axe-core (WCAG 4.1.2)', () => {
  it('has no axe violations in initial state', async () => {
    const { container } = render(<ModalWrapper />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when URL validation error is shown', async () => {
    const { container } = render(<ModalWrapper />);

    // Clicking Save with an empty URL input triggers synchronous validation,
    // which sets aria-invalid + renders the role="alert" error paragraph.
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('alert')).toBeTruthy();

    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Dialog ARIA contract (WCAG 1.3.1, 4.1.2) ────────────────────────────────

describe('ProxyOnboardingModal — dialog ARIA contract (WCAG 1.3.1, 4.1.2)', () => {
  it('panel has role="dialog"', () => {
    render(<ModalWrapper />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
  });

  it('panel has aria-modal="true" (WCAG 4.1.2 — suppresses background AT tree)', () => {
    render(<ModalWrapper />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('panel has aria-labelledby pointing to the <h2> title', () => {
    render(<ModalWrapper />);
    const dialog = screen.getByRole('dialog');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();

    // The referenced element must exist and contain the dialog title text.
    const titleEl = document.getElementById(labelledById!);
    expect(titleEl).toBeTruthy();
    expect(titleEl!.tagName.toLowerCase()).toBe('h2');
    expect(titleEl!.textContent).toMatch(/connect your proxy/i);
  });

  it('dialog title is an <h2> element (semantic heading level — WCAG 1.3.1)', () => {
    render(<ModalWrapper />);
    const heading = screen.getByRole('heading', { name: /connect your proxy/i });
    expect(heading.tagName.toLowerCase()).toBe('h2');
  });
});

// ─── URL input ARIA attributes (WCAG 1.3.1, 3.3.1, 4.1.2) ───────────────────

describe('ProxyOnboardingModal — URL input ARIA attributes (WCAG 1.3.1, 3.3.1)', () => {
  it('URL input has aria-label="Proxy URL" (accessible name)', () => {
    render(<ModalWrapper />);
    const input = screen.getByLabelText('Proxy URL');
    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('url');
  });

  it('URL input does NOT have aria-invalid when no error (absent = valid)', () => {
    render(<ModalWrapper />);
    const input = screen.getByLabelText('Proxy URL');
    // aria-invalid absent or explicitly "false" — both are valid "no error" states.
    const ariaInvalid = input.getAttribute('aria-invalid');
    expect(ariaInvalid === null || ariaInvalid === 'false').toBe(true);
  });

  it('URL input has aria-invalid="true" when validation error is shown (WCAG 3.3.1)', () => {
    render(<ModalWrapper />);
    // Trigger validation: click Save with empty input.
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const input = screen.getByLabelText('Proxy URL');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('URL input does NOT have aria-describedby when no error', () => {
    render(<ModalWrapper />);
    const input = screen.getByLabelText('Proxy URL');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('URL input has aria-describedby wired to error paragraph when error is shown', () => {
    render(<ModalWrapper />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const input = screen.getByLabelText('Proxy URL');
    const describedById = input.getAttribute('aria-describedby');
    expect(describedById).toBe('proxy-onboarding-url-error');

    const errorEl = document.getElementById('proxy-onboarding-url-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl!.textContent).toMatch(/paste your proxy url/i);
  });

  it('URL validation error paragraph has role="alert" (WCAG 3.3.1, 4.1.3)', () => {
    render(<ModalWrapper />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/paste your proxy url/i);
  });

  it('invalid URL format produces a descriptive error message', () => {
    render(<ModalWrapper />);
    fireEvent.change(screen.getByLabelText('Proxy URL'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/valid url/i);
  });

  it('aria-invalid clears when the user starts typing after an error', () => {
    render(<ModalWrapper />);
    // Trigger error
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByLabelText('Proxy URL').getAttribute('aria-invalid')).toBe('true');

    // Start correcting the input — error should clear
    fireEvent.change(screen.getByLabelText('Proxy URL'), {
      target: { value: 'h' },
    });
    const input = screen.getByLabelText('Proxy URL');
    const ariaInvalid = input.getAttribute('aria-invalid');
    expect(ariaInvalid === null || ariaInvalid === 'false').toBe(true);
  });
});

// ─── Deploy to Cloudflare link (WCAG 1.4.1, 2.4.4) ───────────────────────────

describe('ProxyOnboardingModal — Deploy to Cloudflare link (WCAG 1.4.1, 2.4.4)', () => {
  it('Deploy button is a native <a> element (not a styled div)', () => {
    render(<ModalWrapper />);
    const deployLink = screen.getByRole('link', { name: /deploy to cloudflare/i });
    expect(deployLink.tagName.toLowerCase()).toBe('a');
  });

  it('Deploy link has a non-empty href (keyboard operable via Enter)', () => {
    render(<ModalWrapper />);
    const deployLink = screen.getByRole('link', { name: /deploy to cloudflare/i });
    const href = deployLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toContain('cloudflare.com');
  });

  it('Deploy link opens in new tab with rel="noopener noreferrer"', () => {
    render(<ModalWrapper />);
    const deployLink = screen.getByRole('link', { name: /deploy to cloudflare/i });
    expect(deployLink.getAttribute('target')).toBe('_blank');
    expect(deployLink.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('Deploy link accessible name does not include the decorative arrow (aria-hidden)', () => {
    render(<ModalWrapper />);
    // The arrow "→" span is aria-hidden="true". The computed accessible name
    // should be the link text only, not "Deploy to Cloudflare →".
    // We verify this indirectly: the link is found by the name without the arrow.
    const deployLink = screen.getByRole('link', { name: /deploy to cloudflare/i });
    expect(deployLink).toBeTruthy();
    // Arrow span must be aria-hidden
    const arrowSpan = deployLink.querySelector('[aria-hidden="true"]');
    expect(arrowSpan).toBeTruthy();
    expect(arrowSpan!.textContent).toBe('→');
  });
});

// ─── Save & continue button (WCAG 2.1.1, 4.1.2) ──────────────────────────────

describe('ProxyOnboardingModal — Save & continue button (WCAG 2.1.1, 4.1.2)', () => {
  it('Save & continue button has accessible name "Save & continue" in idle state', () => {
    render(<ModalWrapper />);
    const saveBtn = screen.getByRole('button', { name: /save & continue/i });
    expect(saveBtn).toBeTruthy();
  });

  it('Save & continue button calls onSaveAndContinue after the 100ms feedback beat', async () => {
    const onSaveAndContinue = vi.fn();
    render(
      <ModalWrapper onSaveAndContinue={onSaveAndContinue} />,
    );

    fireEvent.change(screen.getByLabelText('Proxy URL'), {
      target: { value: 'https://my-proxy.workers.dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save & continue/i }));

    // Button text changes to "Saved" immediately (Spark spec step 1).
    expect(screen.getByRole('button', { name: /^saved$/i })).toBeTruthy();

    // Callback fires after SAVE_FEEDBACK_DELAY_MS (100ms — Spark spec step 2).
    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledWith('https://my-proxy.workers.dev');
    }, { timeout: 300 });
  });

  it('Save & continue button becomes disabled after clicking (prevents double-fire)', async () => {
    render(<ModalWrapper />);
    fireEvent.change(screen.getByLabelText('Proxy URL'), {
      target: { value: 'https://my-proxy.workers.dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save & continue/i }));

    const savedBtn = screen.getByRole('button', { name: /^saved$/i });
    // We use aria-disabled (not native disabled) to preserve focus during the 100ms save-feedback beat
    expect(savedBtn.getAttribute('aria-disabled')).toBe('true');
  });
});

// ─── Dismiss button (WCAG 2.1.1) ─────────────────────────────────────────────

describe('ProxyOnboardingModal — Dismiss button (WCAG 2.1.1)', () => {
  it('Dismiss button has accessible name (WCAG 2.4.6)', () => {
    render(<ModalWrapper />);
    const dismissBtn = screen.getByRole('button', { name: /i'll set this up later/i });
    expect(dismissBtn).toBeTruthy();
  });

  it('Dismiss button calls onDismiss when clicked (WCAG 2.1.1)', () => {
    const onDismiss = vi.fn();
    render(<ModalWrapper onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /i'll set this up later/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Dismiss button has focus-visible:ring-2 class (WCAG 2.4.7)', () => {
    render(<ModalWrapper />);
    const dismissBtn = screen.getByRole('button', { name: /i'll set this up later/i });
    expect(dismissBtn.className).toContain('focus-visible:ring-2');
  });
});

// ─── Focus trap — Tab and Shift+Tab (WCAG 2.1.2) ─────────────────────────────
//
// The focus trap is implemented via onKeyDown on the dialog panel div.
// Four focusable elements in DOM order (initial state):
//   [0] Deploy to Cloudflare link   (a[href])
//   [1] Proxy URL input             (input)
//   [2] Save & continue button      (button)
//   [3] I'll set this up later btn  (button)
//
// Tab on [3] must wrap to [0]. Shift+Tab on [0] must wrap to [3].

describe('ProxyOnboardingModal — focus trap Tab forward (WCAG 2.1.2)', () => {
  it('dialog panel contains exactly 4 focusable elements in initial state', () => {
    render(<ModalWrapper />);
    const focusables = getDialogFocusables();
    // [0] Deploy link, [1] URL input, [2] Save button, [3] Dismiss button
    expect(focusables).toHaveLength(4);
  });

  it('Tab on the last focusable element wraps to the first (Deploy link)', () => {
    render(<ModalWrapper />);
    const focusables = getDialogFocusables();
    const last = focusables[focusables.length - 1]; // Dismiss button
    const first = focusables[0]; // Deploy link

    act(() => { last.focus(); });
    expect(document.activeElement).toBe(last);

    // Fire Tab on the dialog panel — the onKeyDown handler catches it.
    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        shiftKey: false,
      });
    });

    expect(document.activeElement).toBe(first);
  });

  it('Tab on the URL input moves to the Save & continue button', () => {
    render(<ModalWrapper />);
    const focusables = getDialogFocusables();
    const urlInput = focusables[1]; // URL input
    const saveBtn = focusables[2]; // Save & continue

    act(() => { urlInput.focus(); });
    expect(document.activeElement).toBe(urlInput);

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        shiftKey: false,
      });
    });

    expect(document.activeElement).toBe(saveBtn);
  });
});

describe('ProxyOnboardingModal — focus trap Shift+Tab backward (WCAG 2.1.2)', () => {
  it('Shift+Tab on the first focusable wraps to the last (Dismiss button)', () => {
    render(<ModalWrapper />);
    const focusables = getDialogFocusables();
    const first = focusables[0]; // Deploy link
    const last = focusables[focusables.length - 1]; // Dismiss button

    act(() => { first.focus(); });
    expect(document.activeElement).toBe(first);

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      });
    });

    expect(document.activeElement).toBe(last);
  });

  it('Shift+Tab on the Save button moves to the URL input', () => {
    render(<ModalWrapper />);
    const focusables = getDialogFocusables();
    const saveBtn = focusables[2]; // Save & continue
    const urlInput = focusables[1]; // URL input

    act(() => { saveBtn.focus(); });
    expect(document.activeElement).toBe(saveBtn);

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      });
    });

    expect(document.activeElement).toBe(urlInput);
  });
});

// ─── Escape dismiss (WCAG 2.1.2) ─────────────────────────────────────────────

describe('ProxyOnboardingModal — Escape key dismiss (WCAG 2.1.2)', () => {
  it('pressing Escape on the dialog panel calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<ModalWrapper onDismiss={onDismiss} />);

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Escape also dismisses when focus is on the URL input', () => {
    const onDismiss = vi.fn();
    render(<ModalWrapper onDismiss={onDismiss} />);

    const urlInput = screen.getByLabelText('Proxy URL');
    act(() => { urlInput.focus(); });

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ─── Enter key on URL input (WCAG 2.1.1) ─────────────────────────────────────

describe('ProxyOnboardingModal — Enter key on URL input (WCAG 2.1.1)', () => {
  it('Enter on URL input with empty value triggers validation error (no submit)', () => {
    render(<ModalWrapper />);
    const urlInput = screen.getByLabelText('Proxy URL');
    act(() => { urlInput.focus(); });

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
    });

    // Validation fired — error message should appear.
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('Enter on URL input with a valid URL calls onSaveAndContinue', async () => {
    const onSaveAndContinue = vi.fn();
    render(<ModalWrapper onSaveAndContinue={onSaveAndContinue} />);

    fireEvent.change(screen.getByLabelText('Proxy URL'), {
      target: { value: 'https://my-proxy.workers.dev' },
    });

    const urlInput = screen.getByLabelText('Proxy URL');
    act(() => { urlInput.focus(); });

    act(() => {
      fireEvent.keyDown(getDialog(), {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
    });

    // After the 100ms feedback beat, onSaveAndContinue should fire.
    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledWith('https://my-proxy.workers.dev');
    }, { timeout: 300 });
  });
});

// ─── Backdrop click dismiss (WCAG 2.1.1) ─────────────────────────────────────

describe('ProxyOnboardingModal — backdrop click dismiss (WCAG 2.1.1)', () => {
  it('clicking the backdrop (outside the panel) calls onDismiss', () => {
    const onDismiss = vi.fn();
    const { container } = render(<ModalWrapper onDismiss={onDismiss} />);

    // The backdrop is the outermost div with the fixed inset-0 class.
    // ProxyOnboardingModal renders: backdrop div > dialog panel div.
    // Clicking directly on the backdrop div (not the panel) triggers dismiss.
    const backdrop = container.querySelector('.fixed.inset-0') as HTMLElement;
    expect(backdrop).toBeTruthy();

    // Simulate clicking the backdrop itself (currentTarget === target).
    act(() => {
      fireEvent.click(backdrop);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ─── Reduced motion (WCAG 2.3.3 AAA — noted, not required) ──────────────────
//
// When prefers-reduced-motion: reduce, the modal must appear instantly in its
// final visible state (no opacity/scale animation). This is AAA under WCAG 2.1
// but is a material accessibility improvement. The implementation uses a boolean
// captured at mount time that controls both animation classes and initial state.

describe('ProxyOnboardingModal — reduced motion (WCAG 2.3.3 / prefers-reduced-motion)', () => {
  it('with reduced motion, modal starts in visible state (isVisible=true at mount)', () => {
    // Temporarily override matchMedia to report reduced-motion preference.
    const original = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    render(<ModalWrapper />);

    // The dialog panel should not have the opacity-0 or scale-[0.97] entry-state
    // classes. With reduced motion, isVisible starts as true (no transition from 0).
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).not.toContain('opacity-0');
    expect(dialog.className).not.toContain('scale-[0.97]');
    expect(dialog.className).toContain('opacity-100');
    expect(dialog.className).toContain('scale-100');

    window.matchMedia = original;
  });
});

// ─── StepNumber accessibility (WCAG 1.3.1) ───────────────────────────────────

describe('ProxyOnboardingModal — step numbers (WCAG 1.3.1)', () => {
  it('step number spans are aria-hidden (redundant with ordered list semantics)', () => {
    render(<ModalWrapper />);
    // StepNumber renders <span aria-hidden="true">1</span> etc.
    // The ordered list announces position numerically ("item 1 of 3") automatically;
    // hiding the visual number prevents double announcement.
    const dialog = screen.getByRole('dialog');
    const hiddenSpans = dialog.querySelectorAll('span[aria-hidden="true"]');
    // Decorative spans: 3 step numbers + 1 arrow in Deploy link = 4 total.
    // We only need to confirm step number spans exist and are aria-hidden.
    const stepNumberSpans = Array.from(hiddenSpans).filter((el) =>
      ['1', '2', '3'].includes(el.textContent?.trim() ?? ''),
    );
    expect(stepNumberSpans).toHaveLength(3);
  });

  it('setup steps are an ordered list with an accessible label', () => {
    render(<ModalWrapper />);
    const list = screen.getByRole('list', { name: /setup steps/i });
    expect(list).toBeTruthy();
    // The list should be an <ol> element.
    expect(list.tagName.toLowerCase()).toBe('ol');
  });
});
