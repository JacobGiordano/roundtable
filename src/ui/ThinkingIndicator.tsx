/**
 * ThinkingIndicator — three-dot pre-response indicator (#371).
 *
 * Shown in the assistant bubble body zone when a message is streaming but no
 * content has arrived yet (`isStreaming === true && content === ''`). Mutually
 * exclusive with MessageContent — the parent (MessageBubble) renders one or
 * the other, never both.
 *
 * Animation: sequential opacity pulse via `.thinking-dot` CSS class + stagger
 * on :nth-child(2) and :nth-child(3). Under `prefers-reduced-motion: reduce`,
 * CSS suppresses the animation and holds all dots at opacity 0.6. No JS media
 * query — motion handling is entirely at the CSS layer.
 *
 * Accessibility:
 *   - Wrapper: role="status" + aria-label="[modelName] is thinking"
 *     role="status" implies aria-live="polite" + aria-atomic="true".
 *     Announces once when mounted. Subsequent animation cycles do not change
 *     DOM content, so no re-announcement fires.
 *   - Dots: aria-hidden="true" — purely decorative; all meaning is in the label.
 *
 * Spec: /_design/specs/thinking-indicator.md
 */

interface ThinkingIndicatorProps {
  /**
   * Model display name for the accessible announcement.
   * Source: modelConfig.name in MessageBubble. Fallback: "Assistant".
   * Produces: aria-label="[modelName] is thinking"
   */
  modelName: string;
}

export function ThinkingIndicator({ modelName }: ThinkingIndicatorProps) {
  return (
    <div
      role="status"
      aria-label={`${modelName} is thinking`}
      className="flex items-center gap-2 min-h-8"
    >
      {/* Each dot: 6×6px filled circle. aria-hidden — decorative only.
          .thinking-dot drives the thinkingPulse animation (defined in src/index.css).
          :nth-child(2) and :nth-child(3) stagger the delay 200ms and 400ms respectively. */}
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-text-muted" aria-hidden="true" />
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-text-muted" aria-hidden="true" />
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-text-muted" aria-hidden="true" />
    </div>
  );
}
