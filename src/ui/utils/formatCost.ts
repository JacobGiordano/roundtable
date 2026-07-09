/**
 * formatCost — shared helper for displaying estimated message and session costs.
 *
 * Extracted from SessionTokenSection.tsx (#357) so both the bubble footer
 * (MessageBubble.tsx) and the session total header chip (SessionTokenSection.tsx)
 * can share the same formatting logic without duplication.
 *
 * Format table:
 *   undefined | 0   → null (caller hides the cost element)
 *   > 0 and < 0.01  → '< $0.01'
 *   < 1000          → '~$X.XX'  (2 decimal places, no thousands separator)
 *   ≥ 1000          → '~$X,XXX.XX' (2 decimal places, with thousands separator)
 *
 * Always uses a '~' prefix to signal that the cost is an estimate, never '¢'.
 * Never more than 2 decimal places.
 */
export function formatCost(cost: number | undefined): string | null {
  if (cost === undefined || cost === 0) return null;
  if (cost < 0.01) return '< $0.01';
  if (cost < 1000) return `~$${cost.toFixed(2)}`;
  return `~$${cost.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
