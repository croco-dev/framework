---
editUrl: false
next: false
prev: false
title: "parseWindowMs"
---

> **parseWindowMs**(`window`): `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:76](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/types.ts#L76)

Parse window string to milliseconds

## Parameters

### window

`string`

## Returns

`number`

## Example

```ts
'1m' -> 60000, '1h' -> 3600000, '1d' -> 86400000
```
