---
editUrl: false
next: false
prev: false
title: "parseWindowMs"
---

> **parseWindowMs**(`window`): `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:77](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L77)

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
