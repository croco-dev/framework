---
editUrl: false
next: false
prev: false
title: "BillingProviderFailureState"
---

> **BillingProviderFailureState** = `object`

## Properties

### generatedAt

> `readonly` **generatedAt**: `Date`

---

### kind

> `readonly` **kind**: `"provider_failure"`

---

### partial?

> `readonly` `optional` **partial?**: `Partial`\<`Pick`\<[`BillingEntitlementAdminPanelReadyState`](/api/admin-react/src/type-aliases/billingentitlementadminpanelreadystate/), `"plan"` \| `"billing"` \| `"entitlements"` \| `"usage"` \| `"metering"` \| `"actions"`\>\>

---

### problem

> `readonly` **problem**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### provider

> `readonly` **provider**: [`AdminProviderState`](/api/admin-react/src/type-aliases/adminproviderstate/)

---

### tenantId

> `readonly` **tenantId**: `string`
