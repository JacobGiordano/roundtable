/**
 * Integration tests: MessageBubble generated-image thumbnail actions (#390, #404)
 *
 * Tests the persistent action bar introduced in #404 (replacing the #390 hover overlay):
 *   - Persistent action bar is always visible below each image thumbnail
 *   - Download button is always in the Tab order (not tabIndex={-1})
 *   - aria-describedby wired to sr-only tooltip span when altText present
 *   - Tooltip span content truncated to 120 chars for long altText
 *
 * Also covers basic generated-image rendering contracts that the thumbnail
 * action bar depends on (trigger button label, multi-image fallback alt text).
 *
 * Cross-agent contracts exercised:
 *   MessageBubble (Aria, src/ui/MessageBubble.tsx) — thumbnail grid + persistent action bar
 *   downloadImage (Aria, src/ui/utils/imageActions.ts) — called from action bar button
 *   GeneratedImage interface (Arch, src/types/index.ts) — data shape
 *   Message interface (Arch, src/types/index.ts) — generatedImages field
 *
 * Mocking strategy:
 *   - imageActions module is mocked so downloadImage doesn't hit the DOM.
 *   - No Lightbox state tests here — those live in lightbox-image-actions.test.tsx.
 *   - #404: controls are persistent (always in DOM, not hover-conditional), so
 *     no CSS hover class presence check is needed.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from '@/ui/MessageBubble';
import type { GeneratedImage, Message, ModelConfig } from '@/types/index';
import { makeGeneratedImage } from '../fixtures/conversations';

// ─── Mock imageActions ────────────────────────────────────────────────────────

vi.mock('@/ui/utils/imageActions', () => ({
  downloadImage: vi.fn(),
  copyImageToClipboard: vi.fn().mockResolvedValue(undefined),
}));

import { downloadImage } from '@/ui/utils/imageActions';

// ─── scrollIntoView stub ──────────────────────────────────────────────────────
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MODEL_CONFIG: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

// makeGeneratedImage is imported from ../fixtures/conversations — shared factory.

function makeAssistantMessageWithImages(images: GeneratedImage[]): Message {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Here are some images.',
    modelId: 'claude',
    timestamp: Date.now(),
    isStreaming: false,
    generatedImages: images,
  };
}

// ─── Persistent action bar (#404) ────────────────────────────────────────────
//
// #404 replaced the hover overlay (hidden group-hover:flex) with a persistent
// action bar rendered below every image. Controls are always visible and always
// in the Tab order.

describe('MessageBubble thumbnail — persistent action bar below each image (#404)', () => {
  it('download button is in the DOM (not hidden) below the image at rest', () => {
    const img = makeGeneratedImage();
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    // #404: persistent bar — download button is always present, no hover needed.
    const downloadBtn = screen.getByRole('button', { name: 'Download generated image' });
    expect(downloadBtn).toBeTruthy();
  });

  it('action bar is present for each image in a multi-image strip', () => {
    const images = [makeGeneratedImage(), makeGeneratedImage()];
    const message = makeAssistantMessageWithImages(images);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    // Each image in a multi-strip has its own persistent action bar.
    // Both images have no altText so they use the numbered download label.
    const dlBtn1 = screen.getByRole('button', { name: 'Download generated image 1 of 2' });
    const dlBtn2 = screen.getByRole('button', { name: 'Download generated image 2 of 2' });
    expect(dlBtn1).toBeTruthy();
    expect(dlBtn2).toBeTruthy();
  });

  it('download button has no tabIndex restriction (always in Tab order)', () => {
    const img = makeGeneratedImage({ altText: 'Test image' });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    // #404: buttons in the persistent action bar are always keyboard-reachable —
    // no tabIndex={-1}. This is the contract fix from #390 where the overlay
    // excluded keyboard users. The download button now has default tab order.
    const downloadLabel = `Download: ${img.altText}`;
    const btn = screen.getByRole('button', { name: downloadLabel });
    // tabIndex -1 is explicitly NOT present (the attribute is absent or 0).
    const tabIndex = btn.getAttribute('tabindex');
    expect(tabIndex).not.toBe('-1');
  });

  it('clicking the download button in the persistent bar calls downloadImage()', async () => {
    const img = makeGeneratedImage();
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const downloadBtn = screen.getByRole('button', { name: 'Download generated image' });
    await userEvent.click(downloadBtn);
    expect(downloadImage).toHaveBeenCalledOnce();
    expect(downloadImage).toHaveBeenCalledWith(img);
  });
});

// ─── aria-describedby wiring ──────────────────────────────────────────────────

describe('MessageBubble thumbnail — aria-describedby tooltip (#390)', () => {
  it('trigger button has aria-describedby when altText is present', () => {
    const altText = 'A beautiful coastal sunset';
    const img = makeGeneratedImage({ altText });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: `View full size: ${altText}`,
    });
    expect(triggerBtn.hasAttribute('aria-describedby')).toBe(true);
  });

  it('aria-describedby target span contains the altText content', () => {
    const altText = 'Rocky mountain peaks at dawn';
    const img = makeGeneratedImage({ altText });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: `View full size: ${altText}`,
    });
    const describedById = triggerBtn.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const tooltipSpan = document.getElementById(describedById!);
    expect(tooltipSpan).not.toBeNull();
    expect(tooltipSpan!.textContent).toContain(altText);
  });

  it('trigger button does NOT have aria-describedby when altText is undefined', () => {
    const img = makeGeneratedImage({ altText: undefined });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: 'View full size: Model-generated image',
    });
    expect(triggerBtn.hasAttribute('aria-describedby')).toBe(false);
  });

  it('tooltip span has sr-only class (not visible, but in accessibility tree)', () => {
    const altText = 'Accessible tooltip text';
    const img = makeGeneratedImage({ altText });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: `View full size: ${altText}`,
    });
    const tooltipId = triggerBtn.getAttribute('aria-describedby')!;
    const tooltipSpan = document.getElementById(tooltipId);
    expect(tooltipSpan!.classList.contains('sr-only')).toBe(true);
  });
});

// ─── Tooltip content truncation ───────────────────────────────────────────────

describe('MessageBubble thumbnail — tooltip text truncated to 120 chars (#390)', () => {
  it('tooltip span content is limited to 120 chars when altText exceeds 120 chars', () => {
    // Exactly 150 chars of altText — tooltip must be 120.
    const longAlt =
      'This is an extremely long description of a generated image that has been created by an AI model and goes well past one hundred and twenty characters in total length';
    expect(longAlt.length).toBeGreaterThan(120);
    const img = makeGeneratedImage({ altText: longAlt });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: `View full size: ${longAlt}`,
    });
    const tooltipId = triggerBtn.getAttribute('aria-describedby')!;
    const tooltipSpan = document.getElementById(tooltipId);
    expect(tooltipSpan!.textContent!.length).toBeLessThanOrEqual(120);
  });

  it('tooltip span content is NOT truncated for altText under 120 chars', () => {
    const shortAlt = 'A brief description.';
    expect(shortAlt.length).toBeLessThan(120);
    const img = makeGeneratedImage({ altText: shortAlt });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: `View full size: ${shortAlt}`,
    });
    const tooltipId = triggerBtn.getAttribute('aria-describedby')!;
    const tooltipSpan = document.getElementById(tooltipId);
    expect(tooltipSpan!.textContent).toBe(shortAlt);
  });

  it('tooltip span content at exactly 120 chars is not truncated', () => {
    // Construct exactly 120 char string
    const exactly120 = 'A'.repeat(120);
    const img = makeGeneratedImage({ altText: exactly120 });
    const message = makeAssistantMessageWithImages([img]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);

    const triggerBtn = screen.getByRole('button', {
      name: `View full size: ${exactly120}`,
    });
    const tooltipId = triggerBtn.getAttribute('aria-describedby')!;
    const tooltipSpan = document.getElementById(tooltipId);
    expect(tooltipSpan!.textContent!.length).toBe(120);
  });
});

// ─── Generated-image group semantics ─────────────────────────────────────────

describe('MessageBubble — generated-image group semantics (#390 context)', () => {
  it('renders the image strip with role="group" and a group aria-label', () => {
    const message = makeAssistantMessageWithImages([makeGeneratedImage()]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    const group = screen.getByRole('group', { name: /model-generated images/i });
    expect(group).toBeTruthy();
  });

  it('trigger button aria-label includes the altText when present', () => {
    const altText = 'Rolling green hills';
    const message = makeAssistantMessageWithImages([makeGeneratedImage({ altText })]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    const btn = screen.getByRole('button', { name: `View full size: ${altText}` });
    expect(btn).toBeTruthy();
  });

  it('single image with no altText uses the "Model-generated image" fallback label', () => {
    const message = makeAssistantMessageWithImages([makeGeneratedImage({ altText: undefined })]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    const btn = screen.getByRole('button', { name: 'View full size: Model-generated image' });
    expect(btn).toBeTruthy();
  });

  it('multi-image strip uses numbered fallback label for images without altText', () => {
    const images = [
      makeGeneratedImage({ altText: undefined }),
      makeGeneratedImage({ altText: undefined }),
    ];
    const message = makeAssistantMessageWithImages(images);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    // First image
    expect(
      screen.getByRole('button', { name: 'View full size: Generated image 1' }),
    ).toBeTruthy();
    // Second image
    expect(
      screen.getByRole('button', { name: 'View full size: Generated image 2' }),
    ).toBeTruthy();
  });

  it('does not render image strip when generatedImages is empty', () => {
    const message = makeAssistantMessageWithImages([]);
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    const group = screen.queryByRole('group', { name: /model-generated images/i });
    expect(group).toBeNull();
  });

  it('does not render image strip when generatedImages is undefined', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'No images here.',
      modelId: 'claude',
      timestamp: Date.now(),
      isStreaming: false,
    };
    render(<MessageBubble message={message} modelConfig={MODEL_CONFIG} />);
    const group = screen.queryByRole('group', { name: /model-generated images/i });
    expect(group).toBeNull();
  });
});
