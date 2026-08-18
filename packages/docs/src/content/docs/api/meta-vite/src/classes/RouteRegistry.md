---
editUrl: false
next: false
prev: false
title: "RouteRegistry"
---

## Constructors

### Constructor

> **new RouteRegistry**(): `RouteRegistry`

#### Returns

`RouteRegistry`

## Methods

### compile()

> **compile**(): [`RenderRouteIR`](/api/meta-vite/src/type-aliases/renderrouteir/)[]

#### Returns

[`RenderRouteIR`](/api/meta-vite/src/type-aliases/renderrouteir/)[]

---

### getApiRoutes()

> **getApiRoutes**(): [`ApiRouteIR`](/api/meta-vite/src/type-aliases/apirouteir/)[]

#### Returns

[`ApiRouteIR`](/api/meta-vite/src/type-aliases/apirouteir/)[]

---

### getPageRoutes()

> **getPageRoutes**(): [`PageRouteIR`](/api/meta-vite/src/type-aliases/pagerouteir/)[]

#### Returns

[`PageRouteIR`](/api/meta-vite/src/type-aliases/pagerouteir/)[]

---

### register()

> **register**(`definition`): `void`

#### Parameters

##### definition

[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/)

#### Returns

`void`

---

### registerApiRoute()

> **registerApiRoute**(`definition`): `void`

#### Parameters

##### definition

[`ApiRouteDefinition`](/api/meta-vite/src/type-aliases/apiroutedefinition/)

#### Returns

`void`
