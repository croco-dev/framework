---
editUrl: false
next: false
prev: false
title: "SecurityHeadersOptions"
---

> **SecurityHeadersOptions** = `object`

보안 헤더를 일괄 적용하는 미들웨어입니다.

## Properties

### contentSecurityPolicy?

> `optional` **contentSecurityPolicy?**: `boolean` \| `string`

---

### contentTypeOptions?

> `optional` **contentTypeOptions?**: `boolean`

---

### frameOptions?

> `optional` **frameOptions?**: `boolean` \| `"DENY"` \| `"SAMEORIGIN"` \| `"ALLOW-FROM"`

---

### frameOptionsAllowFrom?

> `optional` **frameOptionsAllowFrom?**: `string`

---

### permissionsPolicy?

> `optional` **permissionsPolicy?**: `boolean` \| `string`

---

### referrerPolicy?

> `optional` **referrerPolicy?**: `boolean` \| `ReferrerPolicyValue`

---

### strictTransportSecurity?

> `optional` **strictTransportSecurity?**: `boolean` \| \{ `includeSubDomains?`: `boolean`; `maxAge`: `number`; \}

---

### xssProtection?

> `optional` **xssProtection?**: `boolean`
