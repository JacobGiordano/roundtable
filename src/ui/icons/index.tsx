/**
 * Shared icon system (#147).
 *
 * All icons are 1:1 SVG components. Each accepts:
 *   size     — SVG width/height in px (default varies per icon, usually 16)
 *   className — additional Tailwind classes (merged onto the svg element)
 *
 * Every icon sets aria-hidden="true" — they are decorative and paired with an
 * accessible label on their parent element (button aria-label, etc.).
 *
 * MessageBubble and OnboardingEmptyState icons remain inline — their SVGs are
 * single-use with no cross-file duplication.
 *
 * SearchBar's magnifying glass SVG is also intentionally inline (#248) — it
 * applies Tailwind size/color classes directly on the SVG path and does not fit
 * the fixed-size IconProps contract. This is the documented exception.
 */

import { useId } from 'react';
import type { SVGProps } from 'react';

/** Base props shared by every icon component. */
export interface IconProps {
  size?: number;
  className?: string;
}

function iconSvg(
  size: number,
  className: string | undefined,
  props: SVGProps<SVGSVGElement>,
  children: React.ReactNode,
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={props.viewBox ?? `0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

// ─── PlusIcon ─────────────────────────────────────────────────────────────────
/** + icon. Used in new-conversation button and add-providers chip. */
export function PlusIcon({ size = 16, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <path
      d="M8 2v12M2 8h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  ));
}

// ─── CloseIcon ────────────────────────────────────────────────────────────────
/** × icon. Used in close buttons throughout the app. */
export function CloseIcon({ size = 16, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <path
      d="M3 3l10 10M13 3L3 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  ));
}

// ─── GearIcon ─────────────────────────────────────────────────────────────────
/** Gear/settings icon. Used in sidebar settings toggle and provider settings. */
export function GearIcon({ size = 16, className }: IconProps) {
  // Scaled viewBox so the same path works at any size.
  return iconSvg(size, className, { viewBox: '0 0 20 20' }, (
    <>
      <path
        d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M17 10c0-.43-.04-.85-.11-1.25l1.98-1.54-1.88-3.24-2.36.95a7 7 0 0 0-2.16-1.25L12.12 2H7.88L7.53 3.67a7 7 0 0 0-2.16 1.25L3.01 3.97 1.13 7.21l1.98 1.54C3.04 9.15 3 9.57 3 10c0 .43.04.85.11 1.25L1.13 12.79l1.88 3.24 2.36-.95a7 7 0 0 0 2.16 1.25L7.88 18h4.24l.35-1.67a7 7 0 0 0 2.16-1.25l2.36.95 1.88-3.24-1.98-1.54C16.96 10.85 17 10.43 17 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </>
  ));
}

// ─── GhostIcon ───────────────────────────────────────────────────────────────
/** Ghost icon. Used in the ghost mode toggle. */
export function GhostIcon({ size = 16, className, filled = false }: IconProps & { filled?: boolean }) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <>
      <path
        d="M8 2a5 5 0 0 0-5 5v6l1.5-1.5L6 13l2-1.5L10 13l1.5-1.5L13 13V7a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? '0.15' : '0'}
      />
      <circle cx="6" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="10" cy="7.5" r="0.8" fill="currentColor" />
    </>
  ));
}

// ─── EllipsisVerticalIcon ────────────────────────────────────────────────────
/** Vertical three-dot (ellipsis) icon. Used in thread action menu trigger. */
export function EllipsisVerticalIcon({ size = 12, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 12 12' }, (
    <>
      <circle cx="6" cy="2" r="1.1" fill="currentColor" />
      <circle cx="6" cy="6" r="1.1" fill="currentColor" />
      <circle cx="6" cy="10" r="1.1" fill="currentColor" />
    </>
  ));
}

// ─── DownloadIcon ─────────────────────────────────────────────────────────────
/** Download arrow icon. Used in ExportButton. */
export function DownloadIcon({ size = 15, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 15 15' }, (
    <>
      <path
        d="M7.5 1v8M4.5 6.5L7.5 9.5L10.5 6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 11h11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ));
}

// ─── PaletteIcon ──────────────────────────────────────────────────────────────
/** Palette icon. Used in model accent color picker trigger. */
export function PaletteIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <>
      <path
        d="M7 1.5A5.5 5.5 0 1 0 12.5 7c0-.83-.17-1.5-1-1.5H10a1.5 1.5 0 0 1 0-3 5.5 5.5 0 0 0-3-1Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4.5" cy="5" r="0.75" fill="currentColor" />
      <circle cx="4.5" cy="9" r="0.75" fill="currentColor" />
      <circle cx="7"   cy="10.5" r="0.75" fill="currentColor" />
    </>
  ));
}

// ─── RightChevronIcon ─────────────────────────────────────────────────────────
/**
 * Right-pointing chevron (→). Rotates 90° to point down (↓) when `isOpen`.
 * Used in GroupHeader (sidebar group collapse/expand).
 * Distinct from ChevronIcon (down-pointing, ↓→↑).
 */
export function RightChevronIcon({
  size = 8,
  className,
  isOpen = false,
}: IconProps & { isOpen?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="none"
      aria-hidden="true"
      className={['flex-shrink-0 transition-transform duration-fast motion-reduce:transition-none', className].filter(Boolean).join(' ')}
      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <path
        d="M2 1.5L5.5 4L2 6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── MenuIcon ─────────────────────────────────────────────────────────────────
/** Three-line hamburger icon. Used in the mobile navigation toggle. */
export function MenuIcon({ size = 18, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 18 18' }, (
    <path
      d="M2 4h14M2 9h14M2 14h14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  ));
}

// ─── EyeIcon ──────────────────────────────────────────────────────────────────
/** Eye (visible) icon. Used in API key visibility toggle. */
export function EyeIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <>
      <path
        d="M1 7c1.2-2.8 3.6-4.5 6-4.5S11.8 4.2 13 7c-1.2 2.8-3.6 4.5-6 4.5S2.2 9.8 1 7Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
    </>
  ));
}

// ─── EyeOffIcon ───────────────────────────────────────────────────────────────
/** Eye with slash (hidden) icon. Used in API key visibility toggle. */
export function EyeOffIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <path
      d="M1.5 1.5l11 11M6.07 6.08A2 2 0 0 0 7 9a2 2 0 0 0 1.93-1.93M2.5 4.5A9.7 9.7 0 0 0 1 7c1.2 2.8 3.6 4.5 6 4.5 1.1 0 2.1-.3 3-.9M11.5 9.5A9.7 9.7 0 0 0 13 7c-1.2-2.8-3.6-4.5-6-4.5-.5 0-1 .07-1.5.2"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  ));
}

// ─── EditIcon ─────────────────────────────────────────────────────────────────
/** Pencil/edit icon. Used in the custom provider edit button. */
export function EditIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <>
      <path
        d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4l2 2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ));
}

// ─── TrashIcon ────────────────────────────────────────────────────────────────
/** Trash/delete icon. Used in the custom provider remove button. */
export function TrashIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <path
      d="M2 3.5h10M5.5 3.5V2.5h3V3.5M3.5 3.5l.5 8h6l.5-8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));
}

// ─── StopIcon ─────────────────────────────────────────────────────────────────
/** Filled square stop icon. Used in the InputBar stop-streaming button. */
export function StopIcon({ size = 16, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
  ));
}

// ─── SendIcon ─────────────────────────────────────────────────────────────────
/**
 * Send arrow icon. Right-pointing arrow. Used in the InputBar send button.
 * The `disabled` prop switches the stroke class for correct opacity.
 */
export function SendIcon({ size = 16, className, disabled = false }: IconProps & { disabled?: boolean }) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <path
      d="M2 8h12M9 3l5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={disabled ? 'text-text-muted' : 'text-text-inverse'}
    />
  ));
}

// ─── PanelLeftIcon ────────────────────────────────────────────────────────────
/**
 * Sidebar panel icon. Represents a two-pane layout with a left sidebar.
 * Used for the desktop sidebar collapse/expand toggle button (#280).
 *
 * Visual: a rounded rectangle split by a vertical line near the left edge.
 * Left strip = sidebar panel; wider right area = main content area.
 * The same icon is used for both collapse and expand — button position and
 * aria-label disambiguate the action.
 */
export function PanelLeftIcon({ size = 16, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <>
      {/* Outer rectangle representing the full application window */}
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      {/* Vertical divider — separates the sidebar from the content area */}
      <line
        x1="5.5"
        y1="1.5"
        x2="5.5"
        y2="14.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </>
  ));
}

// ─── SmallCloseIcon ───────────────────────────────────────────────────────────
/**
 * Small × icon for inline clear/dismiss buttons (search clear, input clear).
 * Distinct from CloseIcon (16px panel close) — this renders at 8px default.
 */
export function SmallCloseIcon({ size = 8, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 8 8' }, (
    <path
      d="M1 1l6 6M7 1L1 7"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  ));
}

// ─── CopyIcon ─────────────────────────────────────────────────────────────────
/**
 * Two-page copy/clipboard icon — stroke-based, 14×14 default.
 *
 * Back page sits upper-right; front page overlaps lower-left. A <mask> clips
 * the back page so only the portion that sticks out from behind the front page
 * is rendered. This approach is background-agnostic — no `pageFill` color
 * matching is required, and the icon renders correctly on any surface.
 *
 * A unique mask ID is generated per instance via useId() so multiple CopyIcon
 * instances on the same page cannot share clip-path IDs and interfere.
 */
export function CopyIcon({ size = 14, className }: IconProps) {
  const id = useId();
  const maskId = `copy-icon-mask-${id.replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={['flex-shrink-0', className].filter(Boolean).join(' ')}
    >
      <defs>
        {/*
         * Mask: white = show, black = hide.
         * The entire canvas is white (show everything), then the front page
         * rect area is painted black (mask out), so the back page only renders
         * in the region that is NOT covered by the front page.
         */}
        <mask id={maskId}>
          <rect x="0" y="0" width="14" height="14" fill="white" />
          {/* front page footprint — masks out back page where they overlap */}
          <rect x="2" y="3" width="8" height="10" rx="1.5" fill="black" />
        </mask>
      </defs>
      {/* back page — upper-right, masked to show only the visible portion */}
      <rect
        x="4" y="1" width="8" height="10" rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
      {/* front page — lower-left, drawn fully on top */}
      <rect
        x="2" y="3" width="8" height="10" rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── KeyIcon ──────────────────────────────────────────────────────────────────
/**
 * Key icon. Used in auth_failure error state in MessageBubble (#463).
 * Communicates "credential problem" rather than a generic alarm.
 */
export function KeyIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <>
      <circle cx="5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 7.5l1 1 3-3M10.5 6l1 1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ));
}

// ─── WifiOffIcon ───────────────────────────────────────────────────────────────
/**
 * Wifi-off icon. Used in network_error state in MessageBubble (#463).
 * Reassuring "connection issue" rather than alarm.
 */
export function WifiOffIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <>
      <path
        d="M1.5 1.5l11 11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M5.5 9.5a2 2 0 0 1 3 0"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3 7a6 6 0 0 1 2.9-1.7M8.5 5.9A6 6 0 0 1 11 7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M1 4.5a9.5 9.5 0 0 1 3.3-2.1M9 2.7A9.5 9.5 0 0 1 13 4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="12" r="0.75" fill="currentColor" />
    </>
  ));
}

// ─── ClockIcon ────────────────────────────────────────────────────────────────
/**
 * Clock icon. Used in rate_limit state in MessageBubble (#463).
 * Communicates "wait a moment" rather than an error alarm.
 */
export function ClockIcon({ size = 14, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 14 14' }, (
    <>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 4v3.5l2 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ));
}

// ─── PhotoIcon ────────────────────────────────────────────────────────────────
/**
 * Photo/image icon (mountain-in-frame silhouette). Used in the InputBar
 * attach-image button (issue #285, #321). Communicates "image" not "generic
 * attachment" — replaces PaperclipIcon per Luma's spec update 2026-07-02.
 *
 * Spec (components.md §3 "Pending icon spec — PhotoIcon"):
 *   ViewBox 0 0 16 16 · stroke currentColor 1.4 round/round · fill none
 *   Frame: rect x=1.5 y=2.5 w=13 h=11 rx=2
 *   Mountain peaks: M1.5 10.5 L5 7 L8.5 10.5 L11 8 L14.5 10.5
 *   Sun: circle cx=11.5 cy=5.5 r=1.25 (stroke only)
 */
export function PhotoIcon({ size = 16, className }: IconProps) {
  return iconSvg(size, className, { viewBox: '0 0 16 16' }, (
    <>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 10.5 L5 7 L8.5 10.5 L11 8 L14.5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="11.5"
        cy="5.5"
        r="1.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </>
  ));
}
