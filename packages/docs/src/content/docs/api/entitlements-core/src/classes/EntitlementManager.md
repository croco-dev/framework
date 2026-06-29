---
editUrl: false
next: false
prev: false
title: "EntitlementManager"
---

플랜 규칙과 quota를 조합해 entitlement 결과를 계산하는 핵심 서비스입니다.

## Constructors

### Constructor

> **new EntitlementManager**(`registry`, `subscriptionProvider`, `quotaChecker`, `meterLookup`, `options?`): `EntitlementManager`

#### Parameters

##### registry

[`PlanEntitlementRegistry`](/api/entitlements-core/src/classes/planentitlementregistry/)

##### subscriptionProvider

[`SubscriptionProvider`](/api/entitlements-core/src/classes/subscriptionprovider/)

##### quotaChecker

[`EntitlementQuotaChecker`](/api/entitlements-core/src/classes/entitlementquotachecker/)

##### meterLookup

[`EntitlementMeterLookup`](/api/entitlements-core/src/classes/entitlementmeterlookup/)

##### options?

[`EntitlementManagerOptions`](/api/entitlements-core/src/type-aliases/entitlementmanageroptions/) = `{}`

#### Returns

`EntitlementManager`

## Methods

### check()

> **check**(`tenantId`, `featureKey`, `checkOptions?`): `Promise`\<[`EntitlementCheckResult`](/api/entitlements-core/src/type-aliases/entitlementcheckresult/)\>

#### Parameters

##### tenantId

`string`

##### featureKey

`string`

##### checkOptions?

[`EntitlementCheckOptions`](/api/entitlements-core/src/type-aliases/entitlementcheckoptions/) = `{}`

#### Returns

`Promise`\<[`EntitlementCheckResult`](/api/entitlements-core/src/type-aliases/entitlementcheckresult/)\>
