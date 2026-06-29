---
editUrl: false
next: false
prev: false
title: "FrontendAuthBridgeStateInput"
---

> **FrontendAuthBridgeStateInput** = `object`

## Properties

### entitlements?

> `readonly` `optional` **entitlements?**: readonly [`FrontendEntitlementCheck`](/api/frontend-react/src/type-aliases/frontendentitlementcheck/)[] \| [`FrontendEntitlementState`](/api/frontend-react/src/type-aliases/frontendentitlementstate/)

***

### generatedAt?

> `readonly` `optional` **generatedAt?**: `Date`

***

### loading?

> `readonly` `optional` **loading?**: `boolean`

***

### permissions?

> `readonly` `optional` **permissions?**: readonly [`FrontendPermissionCheck`](/api/frontend-react/src/type-aliases/frontendpermissioncheck/)[] \| [`FrontendPermissionState`](/api/frontend-react/src/type-aliases/frontendpermissionstate/)

***

### providerFailure?

> `readonly` `optional` **providerFailure?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### providerName?

> `readonly` `optional` **providerName?**: `string`

***

### recoveryActions?

> `readonly` `optional` **recoveryActions?**: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]

***

### session?

> `readonly` `optional` **session?**: [`FrontendSession`](/api/frontend-react/src/type-aliases/frontendsession/) \| [`FrontendSessionState`](/api/frontend-react/src/type-aliases/frontendsessionstate/) \| `null`

***

### tenant?

> `readonly` `optional` **tenant?**: [`FrontendTenant`](/api/frontend-react/src/type-aliases/frontendtenant/) \| [`FrontendTenantState`](/api/frontend-react/src/type-aliases/frontendtenantstate/) \| `null`
