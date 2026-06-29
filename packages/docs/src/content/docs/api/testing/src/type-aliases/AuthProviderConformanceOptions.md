---
editUrl: false
next: false
prev: false
title: "AuthProviderConformanceOptions"
---

> **AuthProviderConformanceOptions** = `object`

## Properties

### auth

> `readonly` **auth**: [`AuthProviderAuthConformance`](/api/testing/src/type-aliases/authproviderauthconformance/)

***

### liveSmoke?

> `readonly` `optional` **liveSmoke?**: [`AuthProviderLiveSmokeGate`](/api/testing/src/type-aliases/authproviderlivesmokegate/)

***

### providerName

> `readonly` **providerName**: `string`

***

### readiness

> `readonly` **readiness**: [`AuthProviderReadinessConformance`](/api/testing/src/type-aliases/authproviderreadinessconformance/)

***

### secretSamples?

> `readonly` `optional` **secretSamples?**: readonly `string`[]

***

### tenantMapping?

> `readonly` `optional` **tenantMapping?**: [`AuthProviderTenantMappingConformance`](/api/testing/src/type-aliases/authprovidertenantmappingconformance/)

***

### webhooks

> `readonly` **webhooks**: [`AuthProviderWebhookConformance`](/api/testing/src/type-aliases/authproviderwebhookconformance/)
