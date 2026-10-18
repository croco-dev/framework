import type { PublicPageMetadata } from "@croco/seo-core";

/**
 * Minimal head() metadata API for v1.
 * Full SEO framework is out of scope for v1.
 */
export type HeadMetadata = {
  title?: string;
  description?: string;
  /** OpenGraph / Twitter card title override */
  ogTitle?: string;
  /** Canonical URL override */
  canonical?: string;
  /** Validated request-owned public-page metadata. */
  publicPage?: PublicPageMetadata;
};

/**
 * Define page-level head metadata.
 * Usage: `head(() => ({ title: 'My Page', description: '...' }))`
 */
export function head(metadata: HeadMetadata): () => HeadMetadata {
  return () => metadata;
}
