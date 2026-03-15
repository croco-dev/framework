---
editUrl: false
next: false
prev: false
title: "SecurityHeadersOptions"
---

> **SecurityHeadersOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:3](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L3)

보안 헤더 미들웨어 및 옵션 타입입니다.

## Properties

### contentTypeOptions?

> `optional` **contentTypeOptions**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:5](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L5)

Enable X-Content-Type-Options: nosniff. Default: true

***

### frameOptions?

> `optional` **frameOptions**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:9](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L9)

Enable X-Frame-Options: DENY. Default: true

***

### referrerPolicy?

> `optional` **referrerPolicy**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:13](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L13)

Enable Referrer-Policy: strict-origin-when-cross-origin. Default: true

***

### strictTransportSecurity?

> `optional` **strictTransportSecurity**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:7](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L7)

Enable Strict-Transport-Security. Default: true

***

### xssProtection?

> `optional` **xssProtection**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts:11](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/middleware/SecurityHeadersMiddleware.ts#L11)

Enable X-XSS-Protection: 1; mode=block. Default: true
