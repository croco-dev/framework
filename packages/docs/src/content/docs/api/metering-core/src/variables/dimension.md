---
editUrl: false
next: false
prev: false
title: "dimension"
---

> `const` **dimension**: `Readonly`\<\{ `enum`: [`EnumDimension`](/api/metering-core/src/type-aliases/enumdimension/)\<`Values`\>; \}\>

Definition-first meter helpers and deterministic meter descriptors.

## Example

```typescript
const requests = defineMeter({
  key: 'api.requests',
  aggregation: 'COUNT',
  unit: 'request',
  dimensions: {
    region: dimension.enum(['apac', 'emea']),
  },
});
```
