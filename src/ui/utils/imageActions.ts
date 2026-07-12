/**
 * Image action utilities for generated images (#390).
 *
 * Extracted from Lightbox.tsx so both Lightbox (lightbox download button)
 * and MessageBubble (thumbnail hover overlay download button) can share the
 * same implementation without duplicating logic.
 *
 * These are pure utility functions — not React components — so they live in
 * /src/ui/utils/ rather than alongside component files.
 */

import type { GeneratedImage } from '@/types';

/**
 * Triggers a browser download of the given GeneratedImage.
 *
 * File extension is derived from mimeType — never hardcoded to .png.
 * Filename format: `roundtable-image-<timestamp>.<ext>`
 *
 * GeneratedImage.base64 is raw base64 without a data-URL prefix per the
 * types contract; we prepend `data:{mimeType};base64,` here at call time.
 */
export function downloadImage(image: GeneratedImage): void {
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = extMap[image.mimeType] ?? 'png';
  const filename = `roundtable-image-${Date.now()}.${ext}`;
  const a = document.createElement('a');
  a.href = `data:${image.mimeType};base64,${image.base64}`;
  a.download = filename;
  a.click();
}

/**
 * Copies the given GeneratedImage to the system clipboard as an image blob.
 *
 * PNG-only gate must be enforced by the caller — this function is not safe to
 * call for non-PNG mimeTypes because ClipboardItem JPEG/WebP support is
 * inconsistent across browsers. Callers should gate on `image.mimeType === 'image/png'`
 * before calling this function.
 *
 * Rejects with DOMException when the user denies permission or when the
 * ClipboardItem API is unavailable (non-HTTPS context, old browser).
 * Callers must catch this rejection and handle it gracefully.
 */
export async function copyImageToClipboard(image: GeneratedImage): Promise<void> {
  const blob = await fetch(
    `data:${image.mimeType};base64,${image.base64}`,
  ).then((r) => r.blob());
  await navigator.clipboard.write([new ClipboardItem({ [image.mimeType]: blob })]);
}
