---
editUrl: false
next: false
prev: false
title: "S3StorageOptions"
---

> **S3StorageOptions** = `object`

## Properties

### bucket

> `readonly` **bucket**: `string`

---

### credentials?

> `readonly` `optional` **credentials?**: `S3ClientConfig`\[`"credentials"`\]

Omit for the SDK default chain (Lambda role, IRSA/web identity, workload identity).

---

### endpoint?

> `readonly` `optional` **endpoint?**: `string`

Trusted application configuration for private endpoints or local conformance fixtures.

---

### forcePathStyle?

> `readonly` `optional` **forcePathStyle?**: `boolean`

---

### keyPrefix?

> `readonly` `optional` **keyPrefix?**: `string`

Literal namespace; must end with / when non-empty. Not an authorization boundary.

---

### publicUrlBase?

> `readonly` `optional` **publicUrlBase?**: `string`

Application-owned CDN/public bucket origin; objects remain private by default.

---

### region

> `readonly` **region**: `string`
