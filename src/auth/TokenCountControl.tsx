/**
 * Gate — TokenCountControl.tsx
 *
 * Settings UI for the tokenCountVisibility preference.
 * Renders a segmented button group: "Always" / "On tap" / "Never".
 *
 * This component calls useUserPreferences() directly. Preference changes
 * are applied immediately — no save button required.
 *
 * Styling: Tailwind utility classes only — no inline styles, no CSS modules.
 */

import type { TokenCountVisibility } from '@/types';
import { useUserPreferences } from './useUserPreferences';

// ─── Option definitions ───────────────────────────────────────────────────────

interface VisibilityOption {
  value: TokenCountVisibility;
  label: string;
}

const OPTIONS: VisibilityOption[] = [
  { value: 'always', label: 'Always' },
  { value: 'active', label: 'On tap' },
  { value: 'never',  label: 'Never' },
];

// ─── TokenCountControl ────────────────────────────────────────────────────────

/**
 * Segmented button control for the "Token counts" preference.
 * Mount this inside the settings panel alongside ApiKeyPanel and theme controls.
 */
export function TokenCountControl() {
  const [prefs, savePrefs] = useUserPreferences();
  const current = prefs.tokenCountVisibility;

  const handleSelect = (value: TokenCountVisibility) => {
    savePrefs({ ...prefs, tokenCountVisibility: value });
  };

  return (
    <section aria-labelledby="token-count-heading" className="w-full">
      <h2
        id="token-count-heading"
        className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-1 px-1"
      >
        Token counts
      </h2>

      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div
          role="group"
          aria-label="Token count visibility"
          className="inline-flex rounded-md border border-border bg-input overflow-hidden"
        >
          {OPTIONS.map((option, index) => {
            const isActive = current === option.value;
            const isFirst = index === 0;
            const isLast = index === OPTIONS.length - 1;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handleSelect(option.value)}
                className={[
                  'h-8 px-4 text-[12px] font-medium',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
                  // Dividers between segments (not on the last segment)
                  !isLast ? 'border-r border-border' : '',
                  // Rounded corners on outermost segments
                  isFirst ? 'rounded-l' : '',
                  isLast  ? 'rounded-r' : '',
                  // Active vs idle appearance
                  isActive
                    ? 'bg-hover text-text-primary'
                    : 'bg-transparent text-text-muted hover:text-text-secondary hover:bg-hover/40',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
          {current === 'always' && 'Token counts are shown on all completed responses.'}
          {current === 'active' && 'Token counts appear on hover (desktop) or tap (mobile).'}
          {current === 'never'  && 'Token counts are hidden and removed from the page.'}
        </p>
      </div>
    </section>
  );
}
