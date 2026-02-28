---
editUrl: false
next: false
prev: false
title: "securityHeadersMiddleware"
---

> **securityHeadersMiddleware**(`options?`): [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:38](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L38)

Security headers middleware

Adds security-related HTTP headers to all responses.
Each header can be individually enabled/disabled via options.

Headers added by default:
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## Parameters

### options?

[`SecurityHeadersOptions`](/api/transports-http/src/type-aliases/securityheadersoptions/) = `{}`

## Returns

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

## Example

```typescript
app.use(securityHeadersMiddleware({
  frameOptions: false, // Disable X-Frame-Options
}));
```
