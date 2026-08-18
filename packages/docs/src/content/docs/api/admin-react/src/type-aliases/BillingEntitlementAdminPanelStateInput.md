---
editUrl: false
next: false
prev: false
title: "BillingEntitlementAdminPanelStateInput"
---

> **BillingEntitlementAdminPanelStateInput** = `object`

## Properties

### account?

> `readonly` `optional` **account?**: [`BillingAccount`](/api/billing-core/src/type-aliases/billingaccount/) \| `null`

---

### actions?

> `readonly` `optional` **actions?**: readonly [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/)[]

---

### entitlementChecks?

> `readonly` `optional` **entitlementChecks?**: readonly [`EntitlementCheckResult`](/api/entitlements-core/src/type-aliases/entitlementcheckresult/)[]

---

### generatedAt?

> `readonly` `optional` **generatedAt?**: `Date`

---

### grantedPermissions?

> `readonly` `optional` **grantedPermissions?**: readonly `string`[]

---

### metering?

> `readonly` `optional` **metering?**: `Partial`\<`Omit`\<[`AdminMeteringState`](/api/admin-react/src/type-aliases/adminmeteringstate/), `"source"` \| `"mutability"`\>\>

---

### plan?

> `readonly` `optional` **plan?**: [`Plan`](/api/billing-core/src/type-aliases/plan/) \| `null`

---

### provider?

> `readonly` `optional` **provider?**: `Partial`\<`Omit`\<[`AdminProviderState`](/api/admin-react/src/type-aliases/adminproviderstate/), `"source"` \| `"mutability"`\>\>

---

### providerFailure?

> `readonly` `optional` **providerFailure?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### requiredPermissions?

> `readonly` `optional` **requiredPermissions?**: readonly `string`[]

---

### subscription?

> `readonly` `optional` **subscription?**: [`Subscription`](/api/billing-core/src/type-aliases/subscription/) \| `null`

---

### tenantId

> `readonly` **tenantId**: `string`

---

### usageMeters?

> `readonly` `optional` **usageMeters?**: readonly `AdminUsageMeterInput`[]
