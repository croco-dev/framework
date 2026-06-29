---
editUrl: false
next: false
prev: false
title: "EntitlementMeterLookup"
---

## Constructors

### Constructor

> **new EntitlementMeterLookup**(): `EntitlementMeterLookup`

#### Returns

`EntitlementMeterLookup`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`EntitlementMeterLookup`\>

## Methods

### getMeterQuota()

> `abstract` **getMeterQuota**(`tenantId`, `meterId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`Promise`\<`number` \| `null`\>
