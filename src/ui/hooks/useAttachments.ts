/**
 * useAttachments — manages pending file attachments for the InputBar (issue #285).
 *
 * Handles file-to-Attachment conversion (FileReader → base64), enforces the
 * 5-attachment-per-message limit, and exposes stable callbacks for add/remove/clear.
 *
 * `Attachment.base64` is raw — no data-URL prefix. Callers that need to render
 * an <img> must prepend `data:<mimeType>;base64,` themselves (HANDOFF gotcha).
 *
 * The addFiles callback uses a ref for current count access so it can compare
 * against the actual current length inside an async operation without stale closures.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Attachment } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_ATTACHMENTS = 5;

/**
 * Set of MIME types accepted by the Attachment interface.
 * Kept as const Set<string> (not Set<Attachment['mimeType']>) so the
 * `has(f.type)` check below accepts an arbitrary string without TS narrowing issues.
 */
const ACCEPTED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reads a File as a base64 string (without the data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mimeType>;base64," prefix — store raw base64 per the Attachment contract.
      const commaIndex = result.indexOf(',');
      resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Converts a File to an Attachment object. */
async function fileToAttachment(file: File): Promise<Attachment> {
  const base64 = await fileToBase64(file);
  return {
    id: crypto.randomUUID(),
    mimeType: file.type as Attachment['mimeType'],
    base64,
    filename: file.name || undefined,
    sizeBytes: file.size,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAttachmentsReturn {
  attachments: Attachment[];
  /** Inline error string — set when the 5-attachment limit is exceeded. */
  error: string | null;
  /** Adds one or more files. Filters to accepted image types. Non-images are silently ignored. */
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** Removes a single attachment by ID. Also clears any current error. */
  removeAttachment: (id: string) => void;
  /** Clears all pending attachments and the error state. Called after a successful send. */
  clearAll: () => void;
  /** Dismisses the current error message without changing attachments. */
  clearError: () => void;
}

export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Ref for access to the current attachment list from inside async callbacks.
  // Without this, addFiles would capture a stale `attachments.length` from the
  // closure at the time the callback was created.
  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const addFiles = useCallback(async (inputFiles: FileList | File[]) => {
    const imageFiles = Array.from(inputFiles).filter(
      (f) => ACCEPTED_MIME_TYPES.has(f.type),
    );

    if (imageFiles.length === 0) return;

    const current = attachmentsRef.current;
    const remaining = MAX_ATTACHMENTS - current.length;

    if (remaining <= 0) {
      setError(`Maximum ${MAX_ATTACHMENTS} images per message.`);
      return;
    }

    // Truncate to the number we can still fit; show error if we had to truncate.
    const toAdd = imageFiles.slice(0, remaining);
    if (imageFiles.length > remaining) {
      setError(`Maximum ${MAX_ATTACHMENTS} images per message.`);
    }

    try {
      const newAttachments = await Promise.all(toAdd.map(fileToAttachment));
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch {
      setError('Failed to read image file. Please try again.');
    }
  }, []); // Intentionally empty: uses ref for current count

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setError(null);
  }, []);

  const clearAll = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { attachments, error, addFiles, removeAttachment, clearAll, clearError };
}
