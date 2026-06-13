/**
 * OnboardingEmptyState — shown when the ProviderRoster is empty (first-run experience).
 *
 * Replaces the conversation column body (MessageThread) when no providers are
 * configured. The sidebar, sidebar header, model selector trigger, and input bar
 * remain visible.
 *
 * Spec: /_design/specs/provider-settings.md section 2.
 * Unmounts automatically when models.length > 0 (first provider added → roster
 * becomes non-empty → App re-derives isRosterEmpty → this component goes away).
 *
 * No entrance animation per spec section 6: "Onboarding empty state — no entrance
 * animation. It renders in the initial state when the app loads."
 */

interface OnboardingEmptyStateProps {
  /** Opens the ProviderSettingsPanel. Same handler used by CTA button and secondary link. */
  onOpenProviderSettings: () => void;
}

export function OnboardingEmptyState({ onOpenProviderSettings }: OnboardingEmptyStateProps) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-6"
      role="region"
      aria-label="Welcome to Roundtable"
    >
      {/* Content block — max-width 400px, centered */}
      <div className="w-full max-w-[400px] flex flex-col items-center text-center">
        {/* Icon — 64x64 SVG, "connected nodes / chat bubbles with plus" concept.
            Color: accents.model-claude per spec section 2.3 (warm, welcoming).
            margin-bottom: 24px */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="text-accent-claude mb-6 flex-shrink-0"
        >
          {/* Left chat bubble */}
          <rect
            x="4"
            y="8"
            width="32"
            height="24"
            rx="6"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          {/* Left bubble tail */}
          <path
            d="M10 32l-4 6 8-2"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right chat bubble — offset to create depth */}
          <rect
            x="28"
            y="22"
            width="32"
            height="24"
            rx="6"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          {/* Right bubble tail */}
          <path
            d="M54 46l4 6-8-2"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Plus icon in right bubble — signals "add" / "connect" */}
          <path
            d="M44 31v8M40 35h8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Dot row in left bubble — represents multiple models */}
          <circle cx="14" cy="20" r="2" fill="currentColor" />
          <circle cx="20" cy="20" r="2" fill="currentColor" />
          <circle cx="26" cy="20" r="2" fill="currentColor" />
        </svg>

        {/* Heading — "Welcome to Roundtable"
            24px, font-weight: 700, text.primary, centered, margin-bottom: 12px */}
        <h1 className="text-[24px] font-bold text-text-primary mb-3">
          Welcome to Roundtable
        </h1>

        {/* Description — explains the product to first-time users
            15px, font-weight: 400, line-height: 1.6, text.secondary, centered, margin-bottom: 32px */}
        <p className="text-[15px] font-normal leading-[1.6] text-text-secondary mb-8">
          Roundtable lets you talk with multiple AI models at once &mdash; same
          question, multiple perspectives, side by side. Add a provider to get
          started.
        </p>

        {/* Primary CTA button — "Add your first provider"
            height: 48px, padding: 0 28px, border-radius: radius.md
            background: accents.model-claude, text: 15px 600 text.inverse
            hover: brightness(1.1), active: brightness(0.9) scale(0.98)
            focus ring: 2px solid interactive.focusRing, 2px offset
            margin-bottom: 24px */}
        <button
          type="button"
          onClick={onOpenProviderSettings}
          className={[
            'h-12 px-7',
            'rounded-md',
            'bg-accent-claude text-text-inverse',
            'text-[15px] font-semibold',
            'transition-[filter,transform] duration-fast',
            'hover:brightness-110',
            'active:brightness-90 active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
            'mb-6',
            'cursor-pointer',
          ].join(' ')}
        >
          Add your first provider
        </button>

        {/* Secondary text link — "Have an OpenAI-compatible API? Add a custom endpoint."
            13px, text.muted, "custom endpoint" underlined
            hover on underlined portion: text.secondary
            clicking: opens ProviderSettingsPanel (same as CTA)
            text-align: center */}
        <p className="text-[13px] text-text-muted text-center">
          Have an OpenAI-compatible API?{' '}
          <button
            type="button"
            onClick={onOpenProviderSettings}
            className={[
              'underline decoration-text-muted',
              'hover:text-text-secondary hover:decoration-text-secondary',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus focus-visible:ring-offset-1 rounded-sm',
              'cursor-pointer',
            ].join(' ')}
          >
            Add a custom endpoint.
          </button>
        </p>
      </div>
    </div>
  );
}
