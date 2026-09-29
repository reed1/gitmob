const IMAGE_TYPES: Record<string, string> = {
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

/** The MIME type of an image the browser can draw, or null for anything else. */
export function imageTypeFor(path: string): string | null {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  return IMAGE_TYPES[name.slice(dot + 1).toLowerCase()] ?? null;
}
