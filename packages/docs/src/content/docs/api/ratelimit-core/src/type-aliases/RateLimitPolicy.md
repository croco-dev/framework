---
editUrl: false
next: false
prev: false
title: "RateLimitPolicy"
---

> **RateLimitPolicy** = [`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/) \| [`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/) \| [`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/) \| \{ `algorithm?`: [`RateLimitAlgorithm`](/api/ratelimit-core/src/type-aliases/ratelimitalgorithm/); `limit`: `number`; `name`: `string`; `windowMs`: `number`; \}

Defined in: [packages/ratelimit-core/src/libs/types.ts:27](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/types.ts#L27)
