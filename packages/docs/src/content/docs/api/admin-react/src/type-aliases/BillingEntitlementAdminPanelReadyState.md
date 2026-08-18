---
editUrl: false
next: false
prev: false
title: "BillingEntitlementAdminPanelReadyState"
---

> **BillingEntitlementAdminPanelReadyState** = `object`

## Properties

### actions

> `readonly` **actions**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

***

### billing

> `readonly` **billing**: [`AdminBillingStatus`](/api/admin-react/src/type-aliases/adminbillingstatus/)

***

### entitlements

> `readonly` **entitlements**: readonly [`AdminEntitlementRow`](/api/admin-react/src/type-aliases/adminentitlementrow/)[]

***

### generatedAt

> `readonly` **generatedAt**: `Date`

***

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

***

### kind

> `readonly` **kind**: `"ready"`

***

### metering

> `readonly` **metering**: [`AdminMeteringState`](/api/admin-react/src/type-aliases/adminmeteringstate/)

***

### plan

> `readonly` **plan**: [`AdminPlanSummary`](/api/admin-react/src/type-aliases/adminplansummary/)

***

### provider

> `readonly` **provider**: [`AdminProviderState`](/api/admin-react/src/type-aliases/adminproviderstate/)

***

### tenantId

> `readonly` **tenantId**: `string`

***

### usage

> `readonly` **usage**: readonly [`AdminUsageMeter`](/api/admin-react/src/type-aliases/adminusagemeter/)[]
