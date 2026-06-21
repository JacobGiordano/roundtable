/**
 * Unit tests for useClickOutside hook (#149).
 *
 * Covers:
 *   - Fires handler when mousedown occurs outside the ref element
 *   - Does NOT fire when mousedown occurs inside the ref element
 *   - Does NOT fire when enabled=false
 *   - Cleans up the document listener when the component unmounts
 *   - Cleans up and re-registers when enabled transitions true→false→true
 *   - Works with multiple refs: does not fire when click is inside any of them
 *   - Fires when click lands outside all supplied refs
 *
 * Uses renderHook + act from @testing-library/react.
 */

import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { useClickOutside } from './useClickOutside';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a real DOM element and return a React ref pointing to it.
 * The element is appended to document.body so contains() works correctly.
 */
function makeRef(tagName = 'div') {
  const el = document.createElement(tagName);
  document.body.appendChild(el);
  const ref = { current: el };
  return { ref, el };
}

/** Fire a synthetic mousedown event on a target element. */
function fireMouseDown(target: EventTarget) {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target, configurable: true });
  document.dispatchEvent(event);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useClickOutside', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    // Remove any DOM elements added during the test.
    document.body.innerHTML = '';
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
  });

  it('fires onClose when mousedown is outside the ref element', () => {
    const { ref } = makeRef();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();

    const { unmount } = renderHook(() => useClickOutside([ref], onClose, true));
    cleanup = unmount;

    fireMouseDown(outside);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onClose when mousedown is inside the ref element', () => {
    const { ref, el } = makeRef();
    const inside = document.createElement('span');
    el.appendChild(inside);
    const onClose = vi.fn();

    const { unmount } = renderHook(() => useClickOutside([ref], onClose, true));
    cleanup = unmount;

    fireMouseDown(inside);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT fire onClose when mousedown is on the ref element itself', () => {
    const { ref, el } = makeRef();
    const onClose = vi.fn();

    const { unmount } = renderHook(() => useClickOutside([ref], onClose, true));
    cleanup = unmount;

    fireMouseDown(el);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT register a listener when enabled=false', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();
    const ref = { current: null as HTMLElement | null };

    const { unmount } = renderHook(() => useClickOutside([ref], onClose, false));
    cleanup = unmount;

    fireMouseDown(outside);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the listener when enabled transitions from true to false', () => {
    const { ref } = makeRef();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();

    let enabled = true;
    const { rerender, unmount } = renderHook(() =>
      useClickOutside([ref], onClose, enabled),
    );
    cleanup = unmount;

    // Disable the hook, then fire a mousedown — should not call onClose.
    enabled = false;
    rerender();
    fireMouseDown(outside);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('re-registers listener when enabled transitions from false to true', () => {
    const { ref } = makeRef();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();

    let enabled = false;
    const { rerender, unmount } = renderHook(() =>
      useClickOutside([ref], onClose, enabled),
    );
    cleanup = unmount;

    // Enable the hook.
    enabled = true;
    rerender();
    fireMouseDown(outside);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cleans up the document listener on unmount', () => {
    const { ref } = makeRef();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();

    const { unmount } = renderHook(() => useClickOutside([ref], onClose, true));

    unmount();
    fireMouseDown(outside);

    // The handler must not fire after unmount.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT fire when mousedown is inside any of multiple refs', () => {
    const { ref: ref1, el: el1 } = makeRef();
    const { ref: ref2, el: el2 } = makeRef();
    const inside1 = document.createElement('span');
    const inside2 = document.createElement('span');
    el1.appendChild(inside1);
    el2.appendChild(inside2);
    const onClose = vi.fn();

    const { unmount } = renderHook(() =>
      useClickOutside([ref1, ref2], onClose, true),
    );
    cleanup = unmount;

    fireMouseDown(inside1);
    fireMouseDown(inside2);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('fires when mousedown is outside all supplied refs', () => {
    const { ref: ref1 } = makeRef();
    const { ref: ref2 } = makeRef();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();

    const { unmount } = renderHook(() =>
      useClickOutside([ref1, ref2], onClose, true),
    );
    cleanup = unmount;

    fireMouseDown(outside);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses mousedown (not click or pointerdown) as the event type', () => {
    const { ref } = makeRef();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const onClose = vi.fn();

    const { unmount } = renderHook(() => useClickOutside([ref], onClose, true));
    cleanup = unmount;

    // Fire click and pointerdown — neither should trigger the handler.
    const clickEvent = new MouseEvent('click', { bubbles: true });
    document.dispatchEvent(clickEvent);
    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true });
    document.dispatchEvent(pointerEvent);

    expect(onClose).not.toHaveBeenCalled();

    // Only mousedown should trigger it.
    fireMouseDown(outside);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
