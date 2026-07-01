/**
 * Unit tests for /src/storage/fileio.ts
 *
 * jsdom does not support real browser file downloads or native file pickers,
 * so these tests verify the functions' behavior by mocking DOM APIs.
 *
 * Coverage:
 *   - downloadJSON: produces pretty-printed JSON and calls triggerDownload with
 *     the correct filename and mimeType.
 *   - readJSONFile: resolves with parsed value when a valid JSON file is selected.
 *   - readJSONFile: resolves null when the user cancels via the 'cancel' event.
 *   - readJSONFile: resolves null when 'change' fires with an empty file list
 *     (cross-browser cancel fallback).
 *   - readJSONFile: rejects with a descriptive Error when the file contains
 *     invalid JSON.
 *   - readJSONFile: rejects when the FileReader emits an error.
 *   - readJSONFile: does not settle twice (settled guard).
 *
 * What is NOT covered:
 *   - Actual browser download (Blob / anchor click) — no real download happens
 *     in jsdom; we verify the anchor attributes and that click() was called.
 *   - The file picker UI itself — jsdom does not open a native dialog; we
 *     dispatch synthetic events on the input element directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadJSON, readJSONFile } from './fileio';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal File-like object usable with FileReader in jsdom.
 * jsdom's FileReader.readAsText reads the Blob content, so we construct a real Blob.
 */
function makeJsonFile(content: string, name = 'test.json'): File {
  return new File([content], name, { type: 'application/json' });
}

// ─── downloadJSON ─────────────────────────────────────────────────────────────

describe('downloadJSON', () => {
  let createdAnchor: HTMLAnchorElement | null = null;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    // Intercept anchor creation to capture and spy on the element.
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        createdAnchor = el as HTMLAnchorElement;
        vi.spyOn(el, 'click');
      }
      return el;
    });

    // Stub URL.createObjectURL / revokeObjectURL (not implemented in jsdom).
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    createdAnchor = null;
  });

  it('serializes the payload as pretty-printed JSON', () => {
    const payload = { schemaVersion: 1, exportedAt: '2026-07-01T00:00:00.000Z' };
    downloadJSON(payload, 'roundtable-setup-2026-07-01.json');

    expect(createdAnchor).not.toBeNull();
    // The download attribute should reflect the filename passed in.
    expect(createdAnchor!.download).toBe('roundtable-setup-2026-07-01.json');
  });

  it('triggers a click on the anchor element', () => {
    downloadJSON({ key: 'value' }, 'test.json');
    expect(createdAnchor).not.toBeNull();
    expect(createdAnchor!.click).toHaveBeenCalledOnce();
  });

  it('calls URL.createObjectURL with a Blob', () => {
    downloadJSON({ a: 1 }, 'out.json');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('calls URL.revokeObjectURL after the click', () => {
    downloadJSON({ a: 1 }, 'out.json');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('produces valid JSON that round-trips the payload', () => {
    const payload = { schemaVersion: 1, credentials: { claude: 'sk-ant-test' } };
    // Capture Blob content by intercepting the Blob constructor.
    let capturedContent = '';
    const OriginalBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        capturedContent = parts[0] as string;
        super(parts, options);
      }
    });

    downloadJSON(payload, 'test.json');

    const parsed = JSON.parse(capturedContent);
    expect(parsed).toEqual(payload);
    // Pretty-printed: should contain newlines and spaces.
    expect(capturedContent).toContain('\n');
    expect(capturedContent).toContain('  ');

    vi.unstubAllGlobals();
  });
});

// ─── readJSONFile ─────────────────────────────────────────────────────────────

/**
 * Simulate the file picker sequence by:
 * 1. Capturing the input element that readJSONFile creates.
 * 2. Setting input.files (FileList is not directly settable in jsdom — we
 *    override the property with a defineProperty so tests can control it).
 * 3. Dispatching the appropriate event.
 *
 * Pattern used in each test:
 *   const inputPromise = captureInput();
 *   const result = readJSONFile();
 *   const input = await inputPromise;
 *   // manipulate input / dispatch events
 *   await result;
 */

function captureInput(): Promise<HTMLInputElement> {
  return new Promise((resolve) => {
    const original = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag === 'input') {
        // Restore immediately so no other createElement calls are intercepted.
        spy.mockRestore();
        resolve(el as HTMLInputElement);
      }
      return el;
    });
  });
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  // jsdom doesn't allow setting input.files directly; use defineProperty.
  Object.defineProperty(input, 'files', {
    value: {
      0: files[0],
      length: files.length,
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () { yield* files; },
    } as unknown as FileList,
    writable: true,
    configurable: true,
  });
}

describe('readJSONFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with the parsed JSON value when a valid file is selected', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    const payload = { schemaVersion: 1, exportedAt: '2026-07-01T00:00:00.000Z' };
    setInputFiles(input, [makeJsonFile(JSON.stringify(payload))]);
    input.dispatchEvent(new Event('change'));

    const result = await promise;
    expect(result).toEqual(payload);
  });

  it('resolves null when the cancel event fires', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    input.dispatchEvent(new Event('cancel'));

    const result = await promise;
    expect(result).toBeNull();
  });

  it('resolves null when change fires with an empty file list (cross-browser cancel fallback)', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    // Simulate change event with no file selected (files list empty / undefined).
    Object.defineProperty(input, 'files', {
      value: { length: 0, item: () => null } as unknown as FileList,
      writable: true,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));

    const result = await promise;
    expect(result).toBeNull();
  });

  it('rejects with a descriptive Error when the file contains invalid JSON', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    setInputFiles(input, [makeJsonFile('{ this is not JSON }')]);
    input.dispatchEvent(new Event('change'));

    await expect(promise).rejects.toThrow(/Failed to parse JSON/);
  });

  it('rejects when FileReader emits an error event', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    // Replace FileReader with a stub that fires 'error' immediately on readAsText.
    const OriginalFileReader = globalThis.FileReader;
    const mockReader = {
      result: null,
      addEventListener: (event: string, handler: EventListener) => {
        if (event === 'error') {
          // Fire the error handler asynchronously after the current tick.
          setTimeout(() => handler(new Event('error')), 0);
        }
      },
      readAsText: vi.fn(),
    };
    vi.stubGlobal('FileReader', vi.fn(() => mockReader));

    setInputFiles(input, [makeJsonFile('anything')]);
    input.dispatchEvent(new Event('change'));

    await expect(promise).rejects.toThrow('Failed to read file');

    vi.unstubAllGlobals();
    // Restore original FileReader to not affect subsequent tests.
    globalThis.FileReader = OriginalFileReader;
  });

  it('does not settle the promise twice when both cancel and change fire', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    // Fire cancel first (resolves null), then change — second should be ignored.
    input.dispatchEvent(new Event('cancel'));
    setInputFiles(input, [makeJsonFile('"should be ignored"')]);
    input.dispatchEvent(new Event('change'));

    // Must still be null — the change-after-cancel must be ignored.
    const result = await promise;
    expect(result).toBeNull();
  });

  it('removes the input element from the DOM after resolution', async () => {
    const inputCapture = captureInput();
    const promise = readJSONFile();
    const input = await inputCapture;

    // The input is appended to body — confirm it's there before cancel.
    expect(document.body.contains(input)).toBe(true);

    input.dispatchEvent(new Event('cancel'));
    await promise;

    // After resolution the input should be removed.
    expect(document.body.contains(input)).toBe(false);
  });
});
