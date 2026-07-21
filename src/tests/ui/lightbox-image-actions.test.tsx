/**
 * Integration tests: Lightbox image action controls (#390)
 *
 * Tests behavior of the updated Lightbox component when the generatedImage prop
 * is provided — download button, PNG-only copy button, info toggle, live region,
 * Escape handling, aria-label variants, and DOM tab order.
 *
 * The Lightbox renders via createPortal to document.body. Tests query the portal
 * content via document.body queries (not the rendered container).
 *
 * Cross-agent contracts exercised:
 *   Lightbox (Aria, src/ui/components/Lightbox.tsx) — generatedImage controls
 *   downloadImage / copyImageToClipboard (Aria, src/ui/utils/imageActions.ts) — utility calls
 *   GeneratedImage interface (Arch, src/types/index.ts) — data shape
 *
 * Mocking strategy:
 *   - imageActions module is mocked so downloadImage / copyImageToClipboard
 *     do not hit the DOM or clipboard — we assert they were called with the
 *     correct GeneratedImage object.
 *   - userEvent for keyboard events (fireEvent for Escape avoids focus complexity).
 *   - createPortal renders into document.body — all queries use screen or
 *     document.body.querySelector for portal children.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lightbox } from '@/ui/components/Lightbox';
import type { GeneratedImage } from '@/types/index';
import { makeGeneratedImage, SAMPLE_BASE64 } from '../fixtures/conversations';

// ─── Mock imageActions at module boundary ─────────────────────────────────────
// We test the Lightbox's behavior (does it call downloadImage? does it call
// copyImageToClipboard?) not the utility internals (those are covered in
// imageActions.test.ts).

vi.mock('@/ui/utils/imageActions', () => ({
  downloadImage: vi.fn(),
  copyImageToClipboard: vi.fn().mockResolvedValue(undefined),
}));

import { downloadImage, copyImageToClipboard } from '@/ui/utils/imageActions';

// ─── scrollIntoView stub ──────────────────────────────────────────────────────
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeReturnRef(): React.RefObject<HTMLElement | null> {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return { current: div };
}

// ─── Minimal Lightbox render helper ──────────────────────────────────────────

interface RenderLightboxOptions {
  generatedImage?: GeneratedImage;
  imageIndex?: number;
  imageTotal?: number;
  onClose?: () => void;
  src?: string;
  alt?: string;
}

function renderLightbox(opts: RenderLightboxOptions = {}) {
  const onClose = opts.onClose ?? vi.fn();
  const returnFocusRef = makeReturnRef();
  const result = render(
    <Lightbox
      src={opts.src ?? `data:image/png;base64,${SAMPLE_BASE64}`}
      alt={opts.alt ?? 'Test image'}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      generatedImage={opts.generatedImage}
      imageIndex={opts.imageIndex}
      imageTotal={opts.imageTotal}
    />,
  );
  return { ...result, onClose, returnFocusRef };
}

// ─── Download button ──────────────────────────────────────────────────────────

describe('Lightbox — download button (#390)', () => {
  it('renders a download button when generatedImage prop is provided', () => {
    renderLightbox({ generatedImage: makeGeneratedImage() });
    const btn = screen.getByRole('button', { name: /download/i });
    expect(btn).toBeTruthy();
  });

  it('does NOT render a download button when generatedImage is absent', () => {
    renderLightbox(); // no generatedImage
    const btn = screen.queryByRole('button', { name: /download/i });
    expect(btn).toBeNull();
  });

  it('calls downloadImage() with the correct GeneratedImage when clicked', async () => {
    const img = makeGeneratedImage();
    renderLightbox({ generatedImage: img });
    const btn = screen.getByRole('button', { name: /download/i });
    await userEvent.click(btn);
    expect(downloadImage).toHaveBeenCalledOnce();
    expect(downloadImage).toHaveBeenCalledWith(img);
  });
});

// ─── Copy button — PNG-only gate ─────────────────────────────────────────────

describe('Lightbox — copy button PNG-only gate (#390)', () => {
  it('renders copy button when mimeType is image/png', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/png' }) });
    // The copy button aria-label is "Copy image to clipboard" at idle state.
    const btn = screen.queryByRole('button', { name: /copy image to clipboard/i });
    expect(btn).toBeTruthy();
  });

  it('does NOT render copy button when mimeType is image/jpeg', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/jpeg' }) });
    const btn = screen.queryByRole('button', { name: /copy/i });
    expect(btn).toBeNull();
  });

  it('does NOT render copy button when mimeType is image/webp', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/webp' }) });
    const btn = screen.queryByRole('button', { name: /copy/i });
    expect(btn).toBeNull();
  });

  it('does NOT render copy button when generatedImage is absent', () => {
    renderLightbox();
    const btn = screen.queryByRole('button', { name: /copy/i });
    expect(btn).toBeNull();
  });

  it('calls copyImageToClipboard() with the GeneratedImage when copy is clicked', async () => {
    const img = makeGeneratedImage({ mimeType: 'image/png' });
    renderLightbox({ generatedImage: img });
    const btn = screen.getByRole('button', { name: /copy image to clipboard/i });
    await userEvent.click(btn);
    expect(copyImageToClipboard).toHaveBeenCalledOnce();
    expect(copyImageToClipboard).toHaveBeenCalledWith(img);
  });
});

// ─── Info toggle — altText gate ───────────────────────────────────────────────

describe('Lightbox — info toggle (#390)', () => {
  it('renders the info toggle button when altText is present', () => {
    renderLightbox({
      generatedImage: makeGeneratedImage({ altText: 'A sunset over mountains' }),
    });
    const btn = screen.getByRole('button', { name: /show image description/i });
    expect(btn).toBeTruthy();
  });

  it('does NOT render info toggle when altText is undefined', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ altText: undefined }) });
    const btn = screen.queryByRole('button', { name: /image description/i });
    expect(btn).toBeNull();
  });

  it('does NOT render info toggle when generatedImage is absent', () => {
    renderLightbox();
    const btn = screen.queryByRole('button', { name: /image description/i });
    expect(btn).toBeNull();
  });

  it('info panel is hidden at rest — altText content not in document', () => {
    const altText = 'Detailed description of the image';
    renderLightbox({ generatedImage: makeGeneratedImage({ altText }) });
    // The panel content (altText) should not be visible before toggle.
    // The sr-only tooltip span in MessageBubble is separate — in Lightbox,
    // the info panel is a conditional div, not rendered until toggled.
    const panelContent = document.body.querySelector('[class*="bg-black/70"]');
    expect(panelContent).toBeNull();
  });

  it('clicking info toggle shows the info panel with altText content', async () => {
    const altText = 'A stunning mountain landscape at dusk';
    renderLightbox({ generatedImage: makeGeneratedImage({ altText }) });
    const toggleBtn = screen.getByRole('button', { name: /show image description/i });
    await userEvent.click(toggleBtn);
    // The info panel is now visible — it should contain the altText.
    expect(document.body.textContent).toContain(altText);
  });

  it('clicking info toggle again hides the info panel', async () => {
    const altText = 'Landscape visible then hidden';
    renderLightbox({ generatedImage: makeGeneratedImage({ altText }) });
    const toggleBtn = screen.getByRole('button', { name: /show image description/i });
    // Open
    await userEvent.click(toggleBtn);
    expect(document.body.textContent).toContain(altText);
    // Close
    await userEvent.click(screen.getByRole('button', { name: /hide image description/i }));
    // Panel should be gone — content no longer in body
    const panels = document.body.querySelectorAll('[class*="bg-black/70"]');
    expect(panels).toHaveLength(0);
  });

  it('aria-expanded is false on info button at rest', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ altText: 'Some alt' }) });
    const btn = screen.getByRole('button', { name: /show image description/i });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('aria-expanded becomes true after clicking the info toggle', async () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ altText: 'Some alt' }) });
    const btn = screen.getByRole('button', { name: /show image description/i });
    await userEvent.click(btn);
    // After toggle, the button aria-label changes — look for it by expanded state.
    const expandedBtn = screen.getByRole('button', { name: /hide image description/i });
    expect(expandedBtn.getAttribute('aria-expanded')).toBe('true');
  });
});

// ─── Escape closes lightbox (not just info panel) ────────────────────────────

describe('Lightbox — Escape key closes lightbox (#390)', () => {
  it('pressing Escape calls onClose when info panel is closed', () => {
    const onClose = vi.fn();
    const returnFocusRef = makeReturnRef();
    const { container } = render(
      <Lightbox
        src={`data:image/png;base64,${SAMPLE_BASE64}`}
        alt="Test"
        onClose={onClose}
        returnFocusRef={returnFocusRef}
        generatedImage={makeGeneratedImage()}
      />,
    );
    // Find the dialog panel and fire Escape on it.
    const dialog = container.ownerDocument.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    fireEvent.keyDown(dialog!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('pressing Escape calls onClose even when the info panel is open', async () => {
    const onClose = vi.fn();
    const returnFocusRef = makeReturnRef();
    render(
      <Lightbox
        src={`data:image/png;base64,${SAMPLE_BASE64}`}
        alt="Test"
        onClose={onClose}
        returnFocusRef={returnFocusRef}
        generatedImage={makeGeneratedImage({ altText: 'Some alt text' })}
      />,
    );
    // Open info panel
    const toggleBtn = screen.getByRole('button', { name: /show image description/i });
    await userEvent.click(toggleBtn);
    // Info panel is now visible — Escape must still close the lightbox, not just the panel.
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    fireEvent.keyDown(dialog!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ─── Download button aria-label variants ────────────────────────────────────

describe('Lightbox — download button aria-label variants (#390)', () => {
  it('no altText, single image → "Download generated image"', () => {
    renderLightbox({
      generatedImage: makeGeneratedImage({ altText: undefined }),
      // imageIndex and imageTotal absent — single image
    });
    const btn = screen.getByRole('button', { name: 'Download generated image' });
    expect(btn).toBeTruthy();
  });

  it('altText present, single image → "Download: {altText}"', () => {
    const altText = 'A vibrant sunrise over rolling hills';
    renderLightbox({
      generatedImage: makeGeneratedImage({ altText }),
    });
    // The label is truncated to 60 chars; our test alt is under 60.
    const btn = screen.getByRole('button', { name: `Download: ${altText}` });
    expect(btn).toBeTruthy();
  });

  it('no altText, multi-image (2 of 3) → "Download generated image 2 of 3"', () => {
    renderLightbox({
      generatedImage: makeGeneratedImage({ altText: undefined }),
      imageIndex: 1, // 0-based → display "2"
      imageTotal: 3,
    });
    const btn = screen.getByRole('button', { name: 'Download generated image 2 of 3' });
    expect(btn).toBeTruthy();
  });

  it('altText present, multi-image → "Download: {altText} (image {n} of {total})"', () => {
    const altText = 'City skyline at night';
    renderLightbox({
      generatedImage: makeGeneratedImage({ altText }),
      imageIndex: 0, // "image 1 of 2"
      imageTotal: 2,
    });
    const btn = screen.getByRole('button', {
      name: `Download: ${altText} (image 1 of 2)`,
    });
    expect(btn).toBeTruthy();
  });

  it('altText longer than 60 chars is truncated in the label', () => {
    const longAlt =
      'An extremely detailed and verbose description of a very complex generated image that exceeds sixty characters easily';
    renderLightbox({
      generatedImage: makeGeneratedImage({ altText: longAlt }),
    });
    const truncated = longAlt.slice(0, 60);
    const btn = screen.getByRole('button', { name: `Download: ${truncated}` });
    expect(btn).toBeTruthy();
  });
});

// ─── Live region for copy announcements ──────────────────────────────────────

describe('Lightbox — copy live region (#390, WCAG 4.1.3)', () => {
  it('live region is pre-mounted (role="status") when generatedImage is PNG', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/png' }) });
    const region = document.body.querySelector('[role="status"]');
    expect(region).toBeTruthy();
  });

  it('live region is NOT present when generatedImage is absent (no copy button)', () => {
    renderLightbox(); // no generatedImage
    const region = document.body.querySelector('[role="status"]');
    expect(region).toBeNull();
  });

  it('live region is NOT present when mimeType is not PNG (no copy button)', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/jpeg' }) });
    const region = document.body.querySelector('[role="status"]');
    expect(region).toBeNull();
  });

  it('live region text is empty at rest', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/png' }) });
    const region = document.body.querySelector('[role="status"]');
    expect(region!.textContent).toBe('');
  });

  it('live region announces "Image copied to clipboard." after successful copy', async () => {
    vi.mocked(copyImageToClipboard).mockResolvedValue(undefined);
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/png' }) });
    const copyBtn = screen.getByRole('button', { name: /copy image to clipboard/i });
    await userEvent.click(copyBtn);
    await waitFor(() => {
      const region = document.body.querySelector('[role="status"]');
      expect(region!.textContent).toBe('Image copied to clipboard.');
    });
  });

  it('live region announces copy failure when clipboard write fails', async () => {
    vi.mocked(copyImageToClipboard).mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError'),
    );
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/png' }) });
    const copyBtn = screen.getByRole('button', { name: /copy image to clipboard/i });
    await userEvent.click(copyBtn);
    await waitFor(() => {
      const region = document.body.querySelector('[role="status"]');
      expect(region!.textContent).toBe('Copy failed. Permission denied.');
    });
  });
});

// ─── DOM tab order: download before info before copy before close ─────────────

describe('Lightbox — download button tab order (#390 spec)', () => {
  it('download button appears before the close button in the DOM', () => {
    renderLightbox({ generatedImage: makeGeneratedImage() });
    const allButtons = Array.from(document.body.querySelectorAll('button'));
    const downloadIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label')?.includes('Download'),
    );
    const closeIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label') === 'Close image viewer',
    );
    expect(downloadIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThanOrEqual(0);
    expect(downloadIdx).toBeLessThan(closeIdx);
  });

  it('info button appears after download but before copy in the DOM', () => {
    renderLightbox({
      generatedImage: makeGeneratedImage({
        mimeType: 'image/png',
        altText: 'Some alt text',
      }),
    });
    const allButtons = Array.from(document.body.querySelectorAll('button'));
    const downloadIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label')?.includes('Download'),
    );
    const infoIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label')?.includes('image description'),
    );
    const copyIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label')?.includes('Copy image to clipboard'),
    );
    expect(downloadIdx).toBeGreaterThanOrEqual(0);
    expect(infoIdx).toBeGreaterThanOrEqual(0);
    expect(copyIdx).toBeGreaterThanOrEqual(0);
    expect(downloadIdx).toBeLessThan(infoIdx);
    expect(infoIdx).toBeLessThan(copyIdx);
  });

  it('copy button appears before close button in the DOM', () => {
    renderLightbox({ generatedImage: makeGeneratedImage({ mimeType: 'image/png' }) });
    const allButtons = Array.from(document.body.querySelectorAll('button'));
    const copyIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label')?.includes('Copy image to clipboard'),
    );
    const closeIdx = allButtons.findIndex((b) =>
      b.getAttribute('aria-label') === 'Close image viewer',
    );
    expect(copyIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThanOrEqual(0);
    expect(copyIdx).toBeLessThan(closeIdx);
  });
});
