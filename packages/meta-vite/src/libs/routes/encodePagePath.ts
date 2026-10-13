/** Encode Unicode for URL lookup without changing existing ASCII path spellings or escaped separators. */
export function encodePagePath(path: string): string {
  return path.replace(/[\u0080-\u{10ffff}]+/gu, (segment) => encodeURIComponent(segment));
}
