---
editUrl: false
next: false
prev: false
title: "PersonalizedCacheFreshnessPolicy"
---

> **PersonalizedCacheFreshnessPolicy** = `object`

## Properties

### noStaleDomains?

> `readonly` `optional` **noStaleDomains?**: readonly `string`[]

Domains that must never be served stale (price, eligibility, balance).

---

### staleIfErrorMs?

> `readonly` `optional` **staleIfErrorMs?**: `number`

Optional stale-if-error bound for source failures.

---

### staleWhileRevalidateMs?

> `readonly` `optional` **staleWhileRevalidateMs?**: `number`

Optional stale-while-revalidate bound. Zero or undefined disables stale reads.

---

### ttlMs

> `readonly` **ttlMs**: `number`

Fresh lifetime in milliseconds.
