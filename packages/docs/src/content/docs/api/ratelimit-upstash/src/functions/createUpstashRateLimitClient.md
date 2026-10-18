---
editUrl: false
next: false
prev: false
title: "createUpstashRateLimitClient"
---

> **createUpstashRateLimitClient**(`options`): `Pick`\<`Redis`, `"eval"` \| `"del"` \| `"expire"` \| `"get"` \| `"incrbyfloat"`\>

A fetch-only client for rate-limit commands. Sends each command once, with a ten-second timeout.
Transport failures can occur after Redis committed a command; callers own any retry decision.

## Parameters

### options

[`UpstashRateLimitClientOptions`](/api/ratelimit-upstash/src/type-aliases/upstashratelimitclientoptions/)

## Returns

`Pick`\<`Redis`, `"eval"` \| `"del"` \| `"expire"` \| `"get"` \| `"incrbyfloat"`\>
