import type { MiddlewareFunction } from '../types';

export type SecurityHeadersOptions = {
  /** Enable X-Content-Type-Options: nosniff. Default: true */
  contentTypeOptions?: boolean;
  /** Enable Strict-Transport-Security. Default: true */
  strictTransportSecurity?: boolean;
  /** Enable X-Frame-Options: DENY. Default: true */
  frameOptions?: boolean;
  /** Enable X-XSS-Protection: 1; mode=block. Default: true */
  xssProtection?: boolean;
  /** Enable Referrer-Policy: strict-origin-when-cross-origin. Default: true */
  referrerPolicy?: boolean;
};

const HSTS_MAX_AGE = 31536000;

/**
 * Security headers middleware
 *
 * Adds security-related HTTP headers to all responses.
 * Each header can be individually enabled/disabled via options.
 *
 * Headers added by default:
 * - X-Content-Type-Options: nosniff
 * - Strict-Transport-Security: max-age=31536000; includeSubDomains
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Referrer-Policy: strict-origin-when-cross-origin
 *
 * @example
 * ```typescript
 * app.use(securityHeadersMiddleware({
 *   frameOptions: false, // Disable X-Frame-Options
 * }));
 * ```
 */
export const securityHeadersMiddleware = (options: SecurityHeadersOptions = {}): MiddlewareFunction => {
  const {
    contentTypeOptions = true,
    strictTransportSecurity = true,
    frameOptions = true,
    xssProtection = true,
    referrerPolicy = true,
  } = options;

  return async (ctx, next): Promise<void> => {
    if (contentTypeOptions) {
      ctx.raw.header('X-Content-Type-Options', 'nosniff');
    }

    if (strictTransportSecurity) {
      ctx.raw.header('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}; includeSubDomains`);
    }

    if (frameOptions) {
      ctx.raw.header('X-Frame-Options', 'DENY');
    }

    if (xssProtection) {
      ctx.raw.header('X-XSS-Protection', '1; mode=block');
    }

    if (referrerPolicy) {
      ctx.raw.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    await next();
  };
};
