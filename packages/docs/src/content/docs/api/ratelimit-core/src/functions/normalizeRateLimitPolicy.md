---
editUrl: false
next: false
prev: false
title: "normalizeRateLimitPolicy"
---

> **normalizeRateLimitPolicy**(`policy`): [`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/) \| [`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/) \| [`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)

Validates public input and makes legacy fixed-window intent explicit without mutating the caller.

## Parameters

### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

## Returns

[`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/) \| [`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/) \| [`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)
