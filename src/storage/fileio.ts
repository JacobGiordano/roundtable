/**
 * fileio.ts — Browser file I/O primitives for Vault.
 *
 * All functions here touch the DOM (Blob, anchor click, file input) and are
 * therefore browser-only. They must never be called from the StorageProvider
 * interface methods — those are kept side-effect-free so non-browser consumers
 * (tests, server) can call them without DOM access.
 *
 * Exported from /src/storage/index.ts so Aria can import without reaching into
 * internal files.
 */

// ─── Download trigger (shared primitive) ─────────────────────────────────────

/**
 * Creates a temporary anchor element, triggers a browser download, then
 * immediately cleans up. Used by both conversation exporters and JSON download.
 */
export function triggerDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── downloadJSON ─────────────────────────────────────────────────────────────

/**
 * Serialize `payload` to pretty-printed JSON and trigger a browser download.
 *
 * Vault is a dumb pipe here — it does not inspect or validate the payload
 * object. Assembling the payload with the correct shape is Gate's responsibility.
 *
 * @param payload  Any object to serialize. Must be JSON-serializable.
 * @param filename The suggested download filename
 *                 (e.g. "roundtable-setup-2026-07-01.json").
 */
export function downloadJSON(payload: object, filename: string): void {
  const content = JSON.stringify(payload, null, 2);
  triggerDownload(filename, content, 'application/json;charset=utf-8');
}

// ─── readJSONFile ─────────────────────────────────────────────────────────────

/**
 * Open a browser file picker restricted to .json files, read the selected
 * file as text, and return the parsed JSON value.
 *
 * **Cancel behavior**: if the user dismisses the file picker without selecting
 * a file, the promise resolves to `null`. Cancel is expected UX, not an error
 * condition. Aria checks `result === null` to detect cancel and short-circuits
 * the import flow without showing an error. Note: a JSON file whose entire
 * contents are the literal `null` value is indistinguishable from cancel via
 * this return — Gate's `importSetup()` rejects such a file during schema
 * validation anyway.
 *
 * **Error behavior**: if the selected file cannot be read or its contents are
 * not valid JSON, the promise rejects with a descriptive `Error`.
 *
 * **Browser support**: cancel detection relies on the `cancel` event on
 * `<input type="file">`, supported in Chrome 113+, Firefox 91+, Safari 17+.
 * On older browsers the promise remains pending when the user cancels — this
 * is acceptable given the app's modern-browser baseline. The `change` event
 * path handles the file-selected case universally.
 *
 * @returns The raw parsed JSON value. Vault does not validate content; Gate's
 *          `importSetup()` validates the `SetupExport` shape.
 */
export function readJSONFile(): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    // Guard against settling the promise more than once (e.g. if both 'change'
    // and 'cancel' fire in some edge case).
    let settled = false;

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      input.remove();
      fn();
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        // change fired but files list is empty — treat as cancel.
        settle(() => resolve(null));
        return;
      }

      const reader = new FileReader();

      reader.addEventListener('load', () => {
        const text = reader.result as string;
        try {
          const parsed = JSON.parse(text);
          settle(() => resolve(parsed));
        } catch (err) {
          settle(() =>
            reject(
              new Error(
                `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`
              )
            )
          );
        }
      });

      reader.addEventListener('error', () => {
        settle(() => reject(new Error('Failed to read file')));
      });

      reader.readAsText(file);
    });

    // 'cancel' event fires when the user dismisses the picker without selecting.
    // Supported in Chrome 113+, Firefox 91+, Safari 17+.
    input.addEventListener('cancel', () => {
      settle(() => resolve(null));
    });

    document.body.appendChild(input);
    input.click();
  });
}
