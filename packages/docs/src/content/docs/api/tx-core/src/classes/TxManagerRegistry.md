---
editUrl: false
next: false
prev: false
title: "TxManagerRegistry"
---

애플리케이션이 소유하는 키 기반 트랜잭션 매니저 레지스트리입니다.

## Constructors

### Constructor

> **new TxManagerRegistry**(): `TxManagerRegistry`

#### Returns

`TxManagerRegistry`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

---

### get()

> **get**\<`TClient`, `TOptions`\>(`key?`): [`TxManager`](/api/tx-core/src/classes/txmanager/)\<`TClient`, `TOptions`\>

#### Type Parameters

##### TClient

`TClient` = `unknown`

##### TOptions

`TOptions` = `unknown`

#### Parameters

##### key?

[`TxManagerKey`](/api/tx-core/src/type-aliases/txmanagerkey/)

#### Returns

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<`TClient`, `TOptions`\>

---

### has()

> **has**(`key?`): `boolean`

#### Parameters

##### key?

[`TxManagerKey`](/api/tx-core/src/type-aliases/txmanagerkey/)

#### Returns

`boolean`

---

### register()

> **register**(`manager`, `key?`): `void`

#### Parameters

##### manager

`TxManagerInstance`

##### key?

[`TxManagerKey`](/api/tx-core/src/type-aliases/txmanagerkey/)

#### Returns

`void`
