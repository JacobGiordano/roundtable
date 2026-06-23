import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * OutrunFlash — transient full-viewport overlay that fires when the user
 * switches to the Outrun theme.
 *
 * Spec: _design/specs/motion.md §4 "Outrun Theme (Electric Entry)"
 *
 * Behaviour:
 *   1. A MutationObserver watches the `data-theme` attribute on :root.
 *      When it changes to "outrun", the flash is triggered.
 *   2. The overlay is a full-viewport fixed div at #FF00AA / 20% opacity,
 *      rendered via createPortal into document.body to escape any ancestor
 *      transform/stacking contexts (e.g. the sidebar's translate classes).
 *   3. The CSS animation holds at 20% opacity for 100ms (fast), then fades
 *      to 0 over 200ms (medium) — 300ms total. After that the div unmounts.
 *   4. prefers-reduced-motion: reduce — no overlay rendered at all.
 *   5. Page load with Outrun already active — no flash. MutationObserver only
 *      fires on attribute *changes*, not on the initial DOM state.
 */
export function OutrunFlash() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Skip if the user prefers reduced motion.
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          const newTheme = (mutation.target as HTMLElement).getAttribute('data-theme');
          if (newTheme === 'outrun') {
            setIsVisible(true);
            // Total animation duration: 100ms hold + 200ms fade = 300ms.
            setTimeout(() => setIsVisible(false), 300);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  if (!isVisible) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="outrun-flash fixed inset-0 pointer-events-none z-[9999]"
    />,
    document.body,
  );
}
