/**
 * ChevronIcon — shared down-chevron SVG icon (#150).
 *
 * Consolidates the ChevronIcon component previously duplicated across
 * ModelSelectorPanel.tsx and the inline chevron SVGs in Sidebar.tsx.
 *
 * Props:
 *   isOpen    — when true, rotates 180° (points up); when false, points down (0°)
 *   size      — SVG dimensions in pixels (default: 10)
 *   className — additional class names (merged with transition and shrink classes)
 */

interface ChevronIconProps {
  isOpen: boolean;
  size?: number;
  className?: string;
}

export function ChevronIcon({ isOpen, size = 10, className = '' }: ChevronIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={['transition-transform duration-fast flex-shrink-0', className].filter(Boolean).join(' ')}
      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path
        d="M1.5 3.5L5 7L8.5 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
