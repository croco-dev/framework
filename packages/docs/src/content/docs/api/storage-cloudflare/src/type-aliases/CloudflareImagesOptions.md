---
editUrl: false
next: false
prev: false
title: "CloudflareImagesOptions"
---

> **CloudflareImagesOptions** = `object`

Cloudflare Images 제공자 설정입니다.

## Properties

### accountHash

> **accountHash**: `string`

Cloudflare Account Hash (공개 URL용)

---

### accountId

> **accountId**: `string`

Cloudflare Account ID

---

### apiToken

> **apiToken**: `string`

Cloudflare API Token (Images API 권한 필요)

---

### customDomain?

> `optional` **customDomain?**: `string`

커스텀 도메인 (선택)
설정된 경우 커스텀 도메인을 통해 이미지 제공

---

### defaultVariant?

> `optional` **defaultVariant?**: `string`

기본 변형 (variant)
기본값: 'public'

---

### maxUploadBytes?

> `optional` **maxUploadBytes?**: `number`

---

### retryBackoff?

> `optional` **retryBackoff?**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

---

### signingKey?

> `optional` **signingKey?**: `string`

---

### ttl?

> `optional` **ttl?**: `number`

Upload Intent TTL (초 단위, 기본값: 3600)
