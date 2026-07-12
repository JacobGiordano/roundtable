/**
 * Unit tests for src/ui/utils/imageActions.ts (#390)
 *
 * Covers:
 *   downloadImage()        — DOM click-trigger download, href format, filename pattern, extension mapping
 *   copyImageToClipboard() — fetch → blob → ClipboardItem pipeline, failure propagation
 *
 * Mocking strategy:
 *   - document.createElement is spied at the DOM boundary so the real
 *     href/download assignment logic is exercised.
 *   - fetch is stubbed at the global boundary — the function calls fetch()
 *     with a data-URL and we return a blob Response.
 *   - navigator.clipboard.write is stubbed — ClipboardItem is polyfilled
 *     below so the full ClipboardItem shape is verified.
 *
 * These are pure utility tests — no React, no DOM rendering.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { downloadImage, copyImageToClipboard } from '@/ui/utils/imageActions';
import type { GeneratedImage } from '@/types/index';

// ─── Minimal base64 PNG ───────────────────────────────────────────────────────
// 1×1 transparent PNG in raw base64 (no data-URL prefix).
const SAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeGeneratedImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'test-img-1',
    mimeType: 'image/png',
    base64: SAMPLE_BASE64,
    ...overrides,
  };
}

// ─── ClipboardItem polyfill ───────────────────────────────────────────────────
// jsdom does not implement ClipboardItem. Polyfill it so tests can construct
// and inspect ClipboardItem objects in the same way the real function does.

beforeAll(() => {
  if (typeof globalThis.ClipboardItem === 'undefined') {
    class ClipboardItemPolyfill {
      _items: Record<string, Blob | Promise<Blob>>;
      constructor(items: Record<string, Blob | Promise<Blob>>) {
        this._items = items;
      }
      get types(): string[] {
        return Object.keys(this._items);
      }
    }
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: ClipboardItemPolyfill,
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── downloadImage() — href format ───────────────────────────────────────────

describe('downloadImage() — href format', () => {
  function spyOnAnchorCreate(): { aEl: HTMLAnchorElement } {
    const aEl = Object.assign(document.createElement('a'), {});
    vi.spyOn(aEl, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return aEl as unknown as HTMLElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (document.createElement as any).__original__
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document.createElement as any).__original__.call(document, tag)
        : document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
    return { aEl };
  }

  it('sets href to data:{mimeType};base64,{base64}', () => {
    const { aEl } = spyOnAnchorCreate();
    const img = makeGeneratedImage({ mimeType: 'image/png', base64: SAMPLE_BASE64 });
    downloadImage(img);
    expect(aEl.href).toBe(`data:image/png;base64,${SAMPLE_BASE64}`);
  });

  it('href uses the actual mimeType — not hardcoded image/png', () => {
    const { aEl } = spyOnAnchorCreate();
    const img = makeGeneratedImage({ mimeType: 'image/jpeg', base64: SAMPLE_BASE64 });
    downloadImage(img);
    expect(aEl.href).toBe(`data:image/jpeg;base64,${SAMPLE_BASE64}`);
  });

  it('does not double-prefix the base64 field (exactly one "data:" prefix in href)', () => {
    const { aEl } = spyOnAnchorCreate();
    downloadImage(makeGeneratedImage());
    const dataCount = (aEl.href.match(/data:/g) ?? []).length;
    expect(dataCount).toBe(1);
  });

  it('calls click() on the anchor element to trigger the download', () => {
    const { aEl } = spyOnAnchorCreate();
    const clickSpy = vi.spyOn(aEl, 'click').mockImplementation(() => {});
    downloadImage(makeGeneratedImage());
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

// ─── downloadImage() — filename pattern ──────────────────────────────────────

describe('downloadImage() — filename pattern', () => {
  function captureAnchor(): { aEl: HTMLAnchorElement } {
    const aEl = document.createElement('a');
    vi.spyOn(aEl, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return aEl as unknown as HTMLElement;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
    return { aEl };
  }

  it('filename starts with "roundtable-image-"', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage());
    expect(aEl.download).toMatch(/^roundtable-image-/);
  });

  it('filename contains a numeric timestamp segment', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage());
    // pattern: roundtable-image-<digits>.<ext>
    expect(aEl.download).toMatch(/^roundtable-image-\d+\./);
  });

  it('timestamp in filename is a recent Unix millisecond value (within 5 seconds)', () => {
    const { aEl } = captureAnchor();
    const before = Date.now();
    downloadImage(makeGeneratedImage());
    const after = Date.now();
    const match = aEl.download.match(/^roundtable-image-(\d+)\./);
    expect(match).not.toBeNull();
    const ts = parseInt(match![1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ─── downloadImage() — extension mapping per mimeType ────────────────────────

describe('downloadImage() — extension per mimeType', () => {
  function captureAnchor(): { aEl: HTMLAnchorElement } {
    const aEl = document.createElement('a');
    vi.spyOn(aEl, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return aEl as unknown as HTMLElement;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
    return { aEl };
  }

  it('image/png → .png extension', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage({ mimeType: 'image/png' }));
    expect(aEl.download).toMatch(/\.png$/);
  });

  it('image/jpeg → .jpg extension', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage({ mimeType: 'image/jpeg' }));
    expect(aEl.download).toMatch(/\.jpg$/);
  });

  it('image/webp → .webp extension', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage({ mimeType: 'image/webp' }));
    expect(aEl.download).toMatch(/\.webp$/);
  });

  it('image/gif → .gif extension', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage({ mimeType: 'image/gif' }));
    expect(aEl.download).toMatch(/\.gif$/);
  });

  it('unknown mimeType (image/avif) → .png fallback extension', () => {
    const { aEl } = captureAnchor();
    downloadImage(makeGeneratedImage({ mimeType: 'image/avif' }));
    expect(aEl.download).toMatch(/\.png$/);
  });
});

// ─── Fetch mock helper ────────────────────────────────────────────────────────
// jsdom's Response does not implement .stream(), which is required for .blob().
// Instead of new Response(blob), we return a minimal object with a working .blob()
// method so the full fetch → blob → ClipboardItem pipeline can be tested.

function makeFetchResponseWithBlob(blob: Blob): Response {
  return { blob: () => Promise.resolve(blob) } as unknown as Response;
}

// ─── copyImageToClipboard() — happy path ─────────────────────────────────────

describe('copyImageToClipboard() — happy path', () => {
  it('resolves without throwing for a PNG image', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2])], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponseWithBlob(blob)));
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn().mockResolvedValue(undefined) },
    });

    await expect(copyImageToClipboard(makeGeneratedImage())).resolves.toBeUndefined();
  });

  it('calls fetch with the correct data-URL string', async () => {
    const img = makeGeneratedImage({ mimeType: 'image/png', base64: SAMPLE_BASE64 });
    const blob = new Blob([], { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponseWithBlob(blob));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn().mockResolvedValue(undefined) },
    });

    await copyImageToClipboard(img);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`data:image/png;base64,${SAMPLE_BASE64}`);
  });

  it('calls navigator.clipboard.write with exactly one ClipboardItem', async () => {
    const blob = new Blob([new Uint8Array([0, 1])], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponseWithBlob(blob)));
    const writeMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { write: writeMock },
    });

    await copyImageToClipboard(makeGeneratedImage());

    expect(writeMock).toHaveBeenCalledOnce();
    const [items] = writeMock.mock.calls[0] as [Array<{ types: string[] }>];
    expect(items).toHaveLength(1);
  });

  it('ClipboardItem carries the correct mimeType key (image/png)', async () => {
    const blob = new Blob([], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponseWithBlob(blob)));
    const writeMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { write: writeMock },
    });

    await copyImageToClipboard(makeGeneratedImage({ mimeType: 'image/png' }));

    const [items] = writeMock.mock.calls[0] as [Array<{ types: string[] }>];
    expect(items[0].types).toContain('image/png');
  });
});

// ─── copyImageToClipboard() — failure propagation ────────────────────────────

describe('copyImageToClipboard() — failure propagation', () => {
  it('rejects when navigator.clipboard.write rejects (DOMException)', async () => {
    const blob = new Blob([], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponseWithBlob(blob)));
    const domEx = new DOMException('Permission denied', 'NotAllowedError');
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn().mockRejectedValue(domEx) },
    });

    await expect(copyImageToClipboard(makeGeneratedImage())).rejects.toThrow('Permission denied');
  });

  it('rejects when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn() },
    });

    await expect(copyImageToClipboard(makeGeneratedImage())).rejects.toThrow('Network failure');
  });

  it('does not call clipboard.write when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    const writeMock = vi.fn();
    vi.stubGlobal('navigator', {
      clipboard: { write: writeMock },
    });

    try {
      await copyImageToClipboard(makeGeneratedImage());
    } catch {
      // expected rejection
    }

    expect(writeMock).not.toHaveBeenCalled();
  });
});
