---
editUrl: false
next: false
prev: false
title: "isRouteContractSpec"
---

> **isRouteContractSpec**(`value`): `value is RouteContractSpec`

Route contract decorator overloads use this guard to distinguish contract objects from direct schema arguments at runtime.

## Parameters

### value

`unknown`

## Returns

`value is RouteContractSpec`

## Example

```ts
if (isRouteContractSpec(value)) {
  value.method;
  value.path;
}
```
