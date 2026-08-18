---
editUrl: false
next: false
prev: false
title: "AuthProviderReadinessConformance"
---

> **AuthProviderReadinessConformance** = `object`

## Properties

### requiredEnv

> `readonly` **requiredEnv**: readonly `string`[]

## Methods

### createMissingConfigHealth()

> **createMissingConfigHealth**(): [`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/) \| `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Returns

[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/) \| `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

---

### createReadyHealth()?

> `optional` **createReadyHealth**(): [`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/) \| `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Returns

[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/) \| `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>
