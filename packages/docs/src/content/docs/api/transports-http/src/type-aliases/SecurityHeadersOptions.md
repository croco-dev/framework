---
editUrl: false
next: false
prev: false
title: "SecurityHeadersOptions"
---

> **SecurityHeadersOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:3](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L3)

보안 헤더를 일괄 적용하는 미들웨어입니다.

## Properties

### contentSecurityPolicy?

> `optional` **contentSecurityPolicy**: `boolean` \| `string`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L10)

***

### contentTypeOptions?

> `optional` **contentTypeOptions**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L4)

***

### frameOptions?

> `optional` **frameOptions**: `boolean` \| `"DENY"` \| `"SAMEORIGIN"` \| `"ALLOW-FROM"`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L6)

***

### frameOptionsAllowFrom?

> `optional` **frameOptionsAllowFrom**: `string`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L7)

***

### permissionsPolicy?

> `optional` **permissionsPolicy**: `boolean` \| `string`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L11)

***

### referrerPolicy?

> `optional` **referrerPolicy**: `boolean` \| `ReferrerPolicyValue`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L9)

***

### strictTransportSecurity?

> `optional` **strictTransportSecurity**: `boolean` \| \{ `includeSubDomains?`: `boolean`; `maxAge`: `number`; \}

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L5)

***

### xssProtection?

> `optional` **xssProtection**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L8)
