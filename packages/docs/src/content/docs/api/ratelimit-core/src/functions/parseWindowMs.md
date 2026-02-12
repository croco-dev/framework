---
editUrl: false
next: false
prev: false
title: "parseWindowMs"
---

> **parseWindowMs**(`window`): `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:76](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/ratelimit-core/src/libs/types.ts#L76)

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
