---
editUrl: false
next: false
prev: false
title: "EntitlementQuotaChecker"
---

## Constructors

### Constructor

> **new EntitlementQuotaChecker**(): `EntitlementQuotaChecker`

#### Returns

`EntitlementQuotaChecker`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`EntitlementQuotaChecker`\>

## Methods

### checkQuota()

> `abstract` **checkQuota**(`tenantId`, `featureId`, `quota`): `Promise`\<[`EntitlementQuotaStatus`](/api/entitlements-core/src/type-aliases/entitlementquotastatus/)\>

#### Parameters

##### tenantId

`string`

##### featureId

`string`

##### quota

`number`

#### Returns

`Promise`\<[`EntitlementQuotaStatus`](/api/entitlements-core/src/type-aliases/entitlementquotastatus/)\>

---

### getCurrentUsage()

> `abstract` **getCurrentUsage**(`tenantId`, `featureId`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

##### featureId

`string`

#### Returns

`Promise`\<`number`\>

---

### getUsageHistory()

> `abstract` **getUsageHistory**(`tenantId`, `featureId`, `period`): `Promise`\<[`UsageHistoryEntry`](/api/entitlements-core/src/type-aliases/usagehistoryentry/)[]\>

#### Parameters

##### tenantId

`string`

##### featureId

`string`

##### period

[`UsageHistoryPeriod`](/api/entitlements-core/src/type-aliases/usagehistoryperiod/)

#### Returns

`Promise`\<[`UsageHistoryEntry`](/api/entitlements-core/src/type-aliases/usagehistoryentry/)[]\>

---

### resetUsage()

> `abstract` **resetUsage**(`tenantId`, `featureId`, `billingCycleStart`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### featureId

`string`

##### billingCycleStart

`Date`

#### Returns

`Promise`\<`void`\>
