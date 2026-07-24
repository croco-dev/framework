---
editUrl: false
next: false
prev: false
title: "RedisCircuitBreakerStoreOptions"
---

> **RedisCircuitBreakerStoreOptions** = `object`

Redis 기반 분산 서킷 브레이커 상태 저장소 옵션입니다.

## Properties

### onStoreError?

> `optional` **onStoreError?**: [`OnStoreError`](/api/retry-core/src/type-aliases/onstoreerror/)

***

### redis

> **redis**: `UpstashRedisLike`

***

### ttlSeconds?

> `optional` **ttlSeconds?**: `number`

Positive safe-integer expiry in seconds (default: 60).
