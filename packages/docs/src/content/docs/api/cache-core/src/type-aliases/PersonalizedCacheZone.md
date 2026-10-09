---
editUrl: false
next: false
prev: false
title: "PersonalizedCacheZone"
---

> **PersonalizedCacheZone** = `"public"` \| `"variant"` \| `"private"`

Personalized SSR cache policy.

Extends existing cache-core/ISR semantics without a new cache engine:
cacheable zones share fragment bytes through an existing CacheStore,
while private values stay request-local and final personalized
responses are never written to a shared HTTP/CDN cache.
