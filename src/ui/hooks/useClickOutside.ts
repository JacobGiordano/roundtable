import { useEffect, RefObject } from 'react';

/**
 * useClickOutside — fires `onClose` when a pointer/mouse event lands outside
 * every ref in `refs`. Consolidates the 4 separate click-outside implementations
 * that previously existed across AccentColorPicker, ExportButton, and
 * ModelSelectorPanel.AddModelButton (#149).
 *
 * Uses `pointerdown` (catches both mouse and touch) rather than `mousedown` so
 * touch devices are covered without a separate touchstart handler.
 *
 * The hook is a no-op when `enabled` is false — callers guard with their own
 * `isOpen` state to avoid unnecessary document listeners.
 *
 * @param refs    One or more element refs. A click inside ANY of them does NOT
 *                trigger onClose. Pass multiple refs when a trigger button and a
 *                dropdown panel are separate DOM nodes.
 * @param onClose Called when a pointerdown fires outside all supplied refs.
 * @param enabled When false the listener is not registered (default: true).
 */
export function useClickOutside(
  refs: RefObject<Element | null>[],
  onClose: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const isInside = refs.some(
        (ref) => ref.current && ref.current.contains(target),
      );
      if (!isInside) {
        onClose();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onClose]);
  // Intentionally excluding `refs` from the dependency array. Ref objects are
  // stable (same object identity across renders); their `.current` values change
  // without the array changing. Including them would cause the listener to re-
  // register on every render that updates a ref's `.current`, which is both
  // unnecessary and potentially racy during mount.
}
