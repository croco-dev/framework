---
editUrl: false
next: false
prev: false
title: "QuotaManager"
---

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:23](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/QuotaManager.ts#L23)

## Constructors

### Constructor

> **new QuotaManager**(`options`): `QuotaManager`

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:27](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/QuotaManager.ts#L27)

#### Parameters

##### options

[`QuotaManagerOptions`](/api/metering-core/src/type-aliases/quotamanageroptions/)

#### Returns

`QuotaManager`

## Methods

### checkAndRecord()

> **checkAndRecord**(`options`): `Promise`\<[`QuotaCheckAndRecordResult`](/api/metering-core/src/type-aliases/quotacheckandrecordresult/)\>

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:31](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/QuotaManager.ts#L31)

#### Parameters

##### options

[`QuotaCheckAndRecordOptions`](/api/metering-core/src/type-aliases/quotacheckandrecordoptions/)

#### Returns

`Promise`\<[`QuotaCheckAndRecordResult`](/api/metering-core/src/type-aliases/quotacheckandrecordresult/)\>

***

### validateOrThrow()

> **validateOrThrow**(`options`): `void`

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:63](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/QuotaManager.ts#L63)

#### Parameters

##### options

###### allowOverQuota

`boolean`

###### exceeded

`boolean`

###### meterId

`string`

###### newUsage

`number`

###### quota

`number`

#### Returns

`void`
