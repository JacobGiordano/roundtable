/**
 * InputBar — Axe-core Accessibility Tests (#226, #244)
 *
 * Audit scope:
 *   - Skip-link target wiring (#226)
 *   - Streaming state axe scan and WCAG 2.4.3 focus contract (#244)
 *
 * Skip-link: the textareaId prop places id="skip-target" on the textarea when
 * the roster is populated (AppLayout: isRosterEmpty === false). When isRosterEmpty
 * is true, InputBar receives textareaId={undefined} and the id sits on
 * OnboardingEmptyState's CTA button instead — preventing any duplicate-id-active
 * violation.
 *
 * Streaming state: when isStreaming + onStopMessage are both truthy, the send
 * button unmounts and the stop button mounts. The fix for #244 must:
 *   1. Put a ref on the stop button
 *   2. Move focus to the stop button via double-rAF when streaming starts
 *   3. Move focus back to the textarea when streaming ends (stop → send swap)
 *
 * WCAG criteria:
 *   - 2.4.1 Bypass Blocks — skip link must land focus on a usable interactive element
 *   - 2.4.3 Focus Order — focus must not be lost when a visible control is replaced
 *   - 2.4.7 Focus Visible — focus indicator must be visible (focus-visible: ring)
 *   - 4.1.1 Parsing — no duplicate id attributes in the DOM
 *   - 4.1.2 Name, Role, Value — stop button must have an accessible name
 */

import { render, screen, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { InputBar } from '@/ui/InputBar';

// ─── Axe assertion helper ────────────────────────────────────────────────────

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

// ─── Skip-link tests (#226) ──────────────────────────────────────────────────

describe('InputBar — accessibility (#226)', () => {
  it('has no axe violations in default state', async () => {
    const { container } = render(<InputBar onSend={vi.fn()} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('textarea receives id when textareaId prop is provided (WCAG 2.4.1 skip-link target)', () => {
    render(<InputBar onSend={vi.fn()} textareaId="skip-target" />);
    // The skip link in AppLayout targets #skip-target. When isRosterEmpty is false,
    // InputBar holds this id on its textarea so focus lands on a naturally focusable
    // element after the user activates the skip link.
    const textarea = screen.getByRole('textbox');
    expect(textarea.id).toBe('skip-target');
  });

  it('has no axe violations when textareaId is applied (WCAG 2.4.1)', async () => {
    const { container } = render(<InputBar onSend={vi.fn()} textareaId="skip-target" />);
    // Axe must not flag the id assignment itself (e.g. duplicate-id-active).
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('textarea id is absent when textareaId prop is omitted (no orphan id)', () => {
    render(<InputBar onSend={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    // Without textareaId, the textarea must not have an unexpected id.
    expect(textarea.id).toBe('');
  });
});

// ─── Streaming state — axe and WCAG 2.4.3 focus contract (#244) ──────────────
//
// WCAG 2.4.3 Focus Order: "If a Web page can be navigated sequentially and
// the navigation sequences affect meaning or operation, focusable components
// receive focus in an order that preserves meaning and operation."
//
// In practice for this control: when the send button unmounts and the stop
// button mounts in its place, focus must not drop to document.body. The fix
// (stopButtonRef + double-rAF useEffect) must be present and correct. These
// tests verify:
//   (a) axe finds no structural violations in the streaming state
//   (b) the stop button exists, is keyboard operable, and has an accessible name
//   (c) when streaming ends, focus is returned to the textarea (not body)
//
// jsdom does not run rAF callbacks natively. We follow the established project
// pattern (provider-settings-panel.test.tsx, sidebar-state-machines.test.tsx):
// stub requestAnimationFrame with a synchronous implementation so callbacks
// fire immediately during the test. This is safe — tests are isolated and
// the stub is restored in afterEach via vi.restoreAllMocks() or manually.

/** Replace window.requestAnimationFrame with a synchronous stub for testing. */
function stubRafSync(): () => void {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  };
  return () => { window.requestAnimationFrame = original; };
}

describe('InputBar — streaming state accessibility (#244)', () => {
  it('has no axe violations in streaming state (isStreaming + onStopMessage)', async () => {
    const { container } = render(
      <InputBar onSend={vi.fn()} isStreaming={true} onStopMessage={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('stop button is present with accessible name when streaming (WCAG 4.1.2)', () => {
    render(<InputBar onSend={vi.fn()} isStreaming={true} onStopMessage={vi.fn()} />);
    // The stop button replaces the send button while isStreaming is true.
    // It must have an accessible name so AT users know what it does.
    const stopButton = screen.getByRole('button', { name: /stop generating/i });
    expect(stopButton).toBeTruthy();
  });

  it('stop button uses focus-visible ring class, not bare focus (WCAG 2.4.7)', () => {
    render(<InputBar onSend={vi.fn()} isStreaming={true} onStopMessage={vi.fn()} />);
    const stopButton = screen.getByRole('button', { name: /stop generating/i });
    // Must use focus-visible: prefix to avoid showing ring on mouse click.
    // Bare 'focus:ring' would show a ring on every click — visually noisy
    // and a pattern the project has explicitly banned per HANDOFF gotchas.
    expect(stopButton.className).toContain('focus-visible:ring-2');
    // Must not use bare focus:ring
    expect(stopButton.className).not.toMatch(/(?<!\w)focus:ring/);
  });

  it('send button is absent while streaming (only stop button shown)', () => {
    render(<InputBar onSend={vi.fn()} isStreaming={true} onStopMessage={vi.fn()} />);
    // The send button must be gone — only the stop button should be present.
    // Ensures the conditional render is correctly exclusive.
    const sendButton = screen.queryByRole('button', { name: /send message/i });
    expect(sendButton).toBeNull();
    const stopButton = screen.queryByRole('button', { name: /stop generating/i });
    expect(stopButton).not.toBeNull();
  });

  it('stop button is absent when onStopMessage is undefined (even if isStreaming)', () => {
    // When onStopMessage is not wired, the condition `isStreaming && onStopMessage`
    // is falsy, so the stop button must not render. This prevents a dead button
    // from appearing while also ensuring the edge case where streaming starts
    // before onStopMessage is connected does not strand focus.
    render(<InputBar onSend={vi.fn()} isStreaming={true} />);
    const stopButton = screen.queryByRole('button', { name: /stop generating/i });
    expect(stopButton).toBeNull();
  });

  it('stop button receives programmatic focus when streaming starts (WCAG 2.4.3)', async () => {
    // This test verifies the core of the #244 fix: the useEffect + stopButtonRef
    // mechanism must move focus to the stop button when the send→stop swap occurs.
    //
    // Strategy: render in non-streaming state, rerender in streaming state, then
    // flush the double-rAF with a synchronous stub. The stop button must hold focus.
    //
    // rAF is stubbed synchronously following the established project pattern from
    // provider-settings-panel.test.tsx and sidebar-state-machines.test.tsx.
    const restoreRaf = stubRafSync();

    const { rerender } = render(
      <InputBar onSend={vi.fn()} isStreaming={false} onStopMessage={vi.fn()} />,
    );

    // Transition to streaming — this is when the useEffect fires.
    await act(async () => {
      rerender(<InputBar onSend={vi.fn()} isStreaming={true} onStopMessage={vi.fn()} />);
    });

    const stopButton = screen.getByRole('button', { name: /stop generating/i });
    // If the fix is present, stopButtonRef.current?.focus() has run and the
    // stop button is the active element. If the fix is missing, document.body
    // is the active element (focus dropped on unmount).
    expect(document.activeElement).toBe(stopButton);

    restoreRaf();
  });

  it('focus returns to textarea when streaming ends naturally (WCAG 2.4.3 — stop→send swap)', async () => {
    // When isStreaming becomes false, the stop button unmounts and the send button
    // mounts. Without explicit focus management, focus drops to document.body.
    // This asserts the symmetric useEffect branch (isStreaming === false with
    // hasStreamedRef guard) returns focus to the textarea on stream end —
    // whether by natural completion or abort.
    const restoreRaf = stubRafSync();

    const { rerender } = render(
      <InputBar onSend={vi.fn()} isStreaming={true} onStopMessage={vi.fn()} />,
    );

    // Simulate streaming end (natural completion or abort settled).
    await act(async () => {
      rerender(<InputBar onSend={vi.fn()} isStreaming={false} onStopMessage={vi.fn()} />);
    });

    const textarea = screen.getByRole('textbox');
    // Focus must have returned to the textarea — not to body.
    expect(document.activeElement).toBe(textarea);

    restoreRaf();
  });
});

// ─── Ghost mode live region — mount-suppression guard (#435) ─────────────────
//
// WCAG 4.1.3 Status Messages: ghost mode on/off transitions must be announced
// by screen readers via aria-live="polite". However, the live region must NOT
// announce on initial mount ("Ghost mode off" should not fire for every user who
// opens the app). Issue #435 introduces a useRef guard: ghostModeHasMountedRef
// flips to true after the first effect cycle, silencing the mount announcement.
//
// These tests verify:
//   (a) The ghost mode live region is present with aria-live="polite" and aria-atomic="true"
//   (b) The region is empty on initial mount (no "Ghost mode off" announcement)
//   (c) Toggling isGhostMode to true populates the region with the correct text
//   (d) Toggling back to false announces "Ghost mode off"
//
// jsdom does not fire useEffect synchronously — we rely on act() to flush effects
// and check the live region content directly (DOM text, not AT announcements).

describe('InputBar — ghost mode live region mount-suppression (#435, WCAG 4.1.3)', () => {
  it('ghost mode live region has aria-live="polite" and aria-atomic="true"', () => {
    const { container } = render(<InputBar onSend={vi.fn()} isGhostMode={false} />);
    // The sr-only live region that announces ghost mode state changes
    // is the first <span aria-live="polite"> inside the input row.
    const liveRegions = container.querySelectorAll('span[aria-live="polite"][aria-atomic="true"]');
    // InputBar mounts multiple live regions (ghost mode, streaming state, directed reply,
    // attachment announcer). At least one must exist for ghost mode.
    expect(liveRegions.length).toBeGreaterThan(0);
  });

  it('ghost mode live region is empty on mount — no spurious announcement (#435)', async () => {
    // When the user first opens the app and InputBar mounts with isGhostMode=false,
    // the live region must be empty. Without the useRef guard, it would contain
    // "Ghost mode off" on every page load — spamming every screen reader user.
    const { container } = render(<InputBar onSend={vi.fn()} isGhostMode={false} />);

    // Find the first sr-only polite live region (ghost mode announcer — always first)
    const srOnlyLiveRegions = container.querySelectorAll('span.sr-only[aria-live="polite"]');
    expect(srOnlyLiveRegions.length).toBeGreaterThan(0);

    // The ghost mode announcer is the first one in the row. It must be empty on mount.
    // If the guard is missing, the content would be "Ghost mode off".
    const ghostRegion = srOnlyLiveRegions[0];
    expect(ghostRegion.textContent).toBe('');
  });

  it('live region announces "Ghost mode on" text when isGhostMode changes to true', async () => {
    // Simulates the user clicking the ghost mode toggle button after mount.
    // The useRef guard must NOT suppress this subsequent change.
    const { container, rerender } = render(<InputBar onSend={vi.fn()} isGhostMode={false} />);

    await act(async () => {
      rerender(<InputBar onSend={vi.fn()} isGhostMode={true} />);
    });

    const srOnlyLiveRegions = container.querySelectorAll('span.sr-only[aria-live="polite"]');
    const ghostRegion = srOnlyLiveRegions[0];
    // The region must now contain the ghost-on announcement
    expect(ghostRegion.textContent).toMatch(/ghost mode on/i);
  });

  it('live region announces "Ghost mode off" text when isGhostMode changes back to false', async () => {
    // Simulates toggling ghost mode off after it was on.
    const { container, rerender } = render(<InputBar onSend={vi.fn()} isGhostMode={true} />);

    // First toggle: true → already mounted, guard is active → announces nothing on mount
    // Then toggle false to trigger the second announcement.
    await act(async () => {
      rerender(<InputBar onSend={vi.fn()} isGhostMode={false} />);
    });

    const srOnlyLiveRegions = container.querySelectorAll('span.sr-only[aria-live="polite"]');
    const ghostRegion = srOnlyLiveRegions[0];
    // The region must contain the ghost-off announcement
    expect(ghostRegion.textContent).toMatch(/ghost mode off/i);
  });

  it('has no axe violations with ghost mode active', async () => {
    const { container } = render(<InputBar onSend={vi.fn()} isGhostMode={true} />);
    const results = await axe(container);
    assertNoViolations(results);
  });
});
