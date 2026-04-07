import type { MiddlewareFunction } from '../types';

export type SecurityHeadersOptions = {
  contentTypeOptions?: boolean;
  strictTransportSecurity?: boolean | { maxAge: number; includeSubDomains?: boolean };
  frameOptions?: boolean | 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  frameOptionsAllowFrom?: string;
  xssProtection?: boolean;
  referrerPolicy?: boolean | ReferrerPolicyValue;
  contentSecurityPolicy?: boolean | string;
  permissionsPolicy?: boolean | string;
};

export type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

const DEFAULT_HSTS_MAX_AGE = 31536000;
const DEFAULT_REFERRER_POLICY: ReferrerPolicyValue = 'strict-origin-when-cross-origin';

export const securityHeadersMiddleware = (options: SecurityHeadersOptions = {}): MiddlewareFunction => {
  const {
    contentTypeOptions = true,
    strictTransportSecurity = true,
    frameOptions = true,
    frameOptionsAllowFrom,
    xssProtection = true,
    referrerPolicy = true,
    contentSecurityPolicy,
    permissionsPolicy,
  } = options;

  const hstsValue = buildHstsValue(strictTransportSecurity);
  const frameValue = buildFrameValue(frameOptions, frameOptionsAllowFrom);
  const referrerValue = buildReferrerValue(referrerPolicy);

  return async (ctx, next): Promise<void> => {
    if (contentTypeOptions) {
      ctx.raw.header('X-Content-Type-Options', 'nosniff');
    }

    if (hstsValue) {
      ctx.raw.header('Strict-Transport-Security', hstsValue);
    }

    if (frameValue) {
      ctx.raw.header('X-Frame-Options', frameValue);
    }

    if (xssProtection) {
      ctx.raw.header('X-XSS-Protection', '1; mode=block');
    }

    if (referrerValue) {
      ctx.raw.header('Referrer-Policy', referrerValue);
    }

    if (contentSecurityPolicy) {
      const cspValue = typeof contentSecurityPolicy === 'string' ? contentSecurityPolicy : "default-src 'self'";
      ctx.raw.header('Content-Security-Policy', cspValue);
    }

    if (permissionsPolicy) {
      const ppValue =
        typeof permissionsPolicy === 'string' ? permissionsPolicy : 'camera=(), microphone=(), geolocation=()';
      ctx.raw.header('Permissions-Policy', ppValue);
    }

    await next();
  };
};

function buildHstsValue(option: boolean | { maxAge: number; includeSubDomains?: boolean }): string | null {
  if (option === false) return null;
  if (option === true) {
    return `max-age=${DEFAULT_HSTS_MAX_AGE}; includeSubDomains`;
  }
  const maxAge = option.maxAge ?? DEFAULT_HSTS_MAX_AGE;
  const subDomains = option.includeSubDomains ?? true;
  return `max-age=${maxAge}${subDomains ? '; includeSubDomains' : ''}`;
}

function buildFrameValue(option: boolean | 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM', allowFrom?: string): string | null {
  if (option === false) return null;
  if (option === true) return 'DENY';
  if (option === 'ALLOW-FROM' && allowFrom) {
    return `ALLOW-FROM ${allowFrom}`;
  }
  return option;
}

function buildReferrerValue(option: boolean | ReferrerPolicyValue): ReferrerPolicyValue | null {
  if (option === false) return null;
  if (option === true) return DEFAULT_REFERRER_POLICY;
  return option;
}
