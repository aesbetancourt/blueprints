import { VaultService } from '../services/vault';

const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

export const IMAGE_INCLUDE_PATTERNS = Object.keys(IMAGE_MIME_TYPES).map((ext) => `*.${ext}`);

/** Window event fired with the file path when an image changes on disk */
export const IMAGE_CHANGED_EVENT = 'vault:image-changed';

export function isImageExtension(ext: string | undefined): boolean {
  return !!ext && Object.hasOwn(IMAGE_MIME_TYPES, ext.toLowerCase());
}

function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isImagePath(path: string): boolean {
  return isImageExtension(extensionOf(path));
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return '/' + parts.join('/');
}

/**
 * Resolve a Markdown image `src` to an absolute file path.
 * Relative paths resolve against the note's folder; a leading `/` is the vault root.
 * Returns null for URLs (http:, https:, data:, blob:) that load directly.
 */
export function resolveImagePath(
  src: string,
  notePath: string,
  vaultPath: string | null,
): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null;
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    // Keep the raw value when it is not valid percent-encoding
  }
  if (decoded.startsWith('/')) {
    if (!vaultPath || decoded.startsWith(vaultPath + '/')) return normalizePath(decoded);
    return normalizePath(vaultPath + decoded);
  }
  return normalizePath(notePath.slice(0, notePath.lastIndexOf('/')) + '/' + decoded);
}

export interface LoadedImage {
  url: string;
  size: number;
}

/** Object URLs keyed by file path; shared by the viewer tab and inline Markdown images */
const imageCache = new Map<string, Promise<LoadedImage>>();

export function loadImage(path: string): Promise<LoadedImage> {
  const cached = imageCache.get(path);
  if (cached) return cached;
  const pending = VaultService.readBinaryFile(path).then((bytes) => ({
    url: URL.createObjectURL(
      new Blob([bytes], { type: IMAGE_MIME_TYPES[extensionOf(path)] ?? 'image/*' }),
    ),
    size: bytes.byteLength,
  }));
  // Drop failed loads so the next attempt retries
  pending.catch(() => {
    if (imageCache.get(path) === pending) imageCache.delete(path);
  });
  imageCache.set(path, pending);
  return pending;
}

/** Drop the cached copy and tell open viewers to reload */
export function invalidateImage(path: string): void {
  const cached = imageCache.get(path);
  imageCache.delete(path);
  cached?.then(({ url }) => URL.revokeObjectURL(url)).catch(() => {});
  window.dispatchEvent(new CustomEvent(IMAGE_CHANGED_EVENT, { detail: path }));
}
