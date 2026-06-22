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
