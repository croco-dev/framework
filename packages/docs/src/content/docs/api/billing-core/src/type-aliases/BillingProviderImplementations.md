---
editUrl: false
next: false
prev: false
title: "BillingProviderImplementations"
---

> **BillingProviderImplementations**\<`Profile`\> = `{ readonly [Capability in BillingProviderCapability as true extends Profile["capabilities"][Capability]["supported"] ? Capability : never]: BillingProviderCapabilityMap[Capability] }`

## Type Parameters

### Profile

`Profile` _extends_ [`BillingProviderProfile`](/api/billing-core/src/type-aliases/billingproviderprofile/)
