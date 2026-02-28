---
editUrl: false
next: false
prev: false
title: "corsMiddleware"
---

> **corsMiddleware**(`options`): [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:34](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L34)

CORS (Cross-Origin Resource Sharing) middleware

Handles preflight requests automatically and adds CORS headers to responses.
Only adds CORS headers if the request origin is in the allowlist.

## Parameters

### options

[`CorsOptions`](/api/transports-http/src/type-aliases/corsoptions/)

## Returns

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

## Example

```typescript
app.use(corsMiddleware({
  origins: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
```
