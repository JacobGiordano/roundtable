/**
 * /src/ui/utils/timeFormat.ts
 *
 * Shared relative-time formatting utility.
 *
 * Extracted so it can be consumed by both ThreadRow (sidebar timestamps)
 * and MessageBubble (nameplate timestamps) without duplication.
 */

/**
 * Format a Unix millisecond timestamp into a relative label per the spec:
 *   < 1 min  → "< 1m"
 *   < 60 min → "Xm"
 *   < 24 hr  → "Xh"
 *   < 7 d    → "Xd"
 *   same day → "2:34 PM" (locale time)
 *   older    → "Jan 4" (abbreviated month + day)
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 60_000) return '< 1m';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  // Same calendar day: show time
  const msgDate = new Date(timestamp);
  const today = new Date();
  if (
    msgDate.getDate() === today.getDate() &&
    msgDate.getMonth() === today.getMonth() &&
    msgDate.getFullYear() === today.getFullYear()
  ) {
    return msgDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Older: "Jan 4"
  return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
