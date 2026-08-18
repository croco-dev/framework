---
editUrl: false
next: false
prev: false
title: "defineApiRoute"
---

> **defineApiRoute**(`route`): [`ApiRouteDefinition`](/api/meta-vite/src/type-aliases/apiroutedefinition/)

Register a flat code-based API route.
Identity function — returns the same definition for build plugin consumption.

Usage:
```ts
const apiRoutes = [
  defineApiRoute({ path: '/api/users', method: 'GET', handler: getUsers }),
  defineApiRoute({ path: '/api/users', method: 'POST', handler: createUser }),
];
```

## Parameters

### route

[`ApiRouteDefinition`](/api/meta-vite/src/type-aliases/apiroutedefinition/)

## Returns

[`ApiRouteDefinition`](/api/meta-vite/src/type-aliases/apiroutedefinition/)
