---
editUrl: false
next: false
prev: false
title: "PolarCheckoutRecoveryPolicy"
---

> **PolarCheckoutRecoveryPolicy** = `object`

Bounds process-local tracking for checkout creates whose provider outcome is ambiguous.

## Properties

### capacity?

> `readonly` `optional` **capacity?**: `number`

Maximum number of ambiguous checkout operation keys retained by one gateway instance.

---

### ttlMs?

> `readonly` `optional` **ttlMs?**: `number`

Maximum age from first tracking before normal provider lookup and creation resume.
