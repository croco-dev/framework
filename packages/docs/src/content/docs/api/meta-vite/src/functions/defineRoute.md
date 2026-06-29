---
editUrl: false
next: false
prev: false
title: "defineRoute"
---

> **defineRoute**(`route`): [`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/)

Register a flat code-based page route.
Identity function — returns the same definition for build plugin consumption.

Usage:
```ts
const routes = [
  defineRoute({ path: '/', component: HomePage, mode: 'ssr' }),
  defineRoute({ path: '/about', component: AboutPage, mode: 'ssg' }),
];
```

## Parameters

### route

[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/)

## Returns

[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/)
