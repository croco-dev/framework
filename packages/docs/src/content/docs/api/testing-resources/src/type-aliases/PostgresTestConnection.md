---
editUrl: false
next: false
prev: false
title: "PostgresTestConnection"
---

> **PostgresTestConnection** = `object`

## Properties

### client?

> `readonly` `optional` **client?**: `PoolClient`

---

### connectionString

> `readonly` **connectionString**: `string`

---

### database

> `readonly` **database**: `string`

---

### host

> `readonly` **host**: `string`

---

### password

> `readonly` **password**: `string`

---

### pool

> `readonly` **pool**: `Pool`

---

### port

> `readonly` **port**: `number`

---

### query

> `readonly` **query**: \<`TRow`\>(`text`, `values?`) => `Promise`\<`QueryResult`\<`TRow`\>\>

#### Type Parameters

##### TRow

`TRow` _extends_ `QueryResultRow` = `QueryResultRow`

#### Parameters

##### text

`string`

##### values?

`unknown`[]

#### Returns

`Promise`\<`QueryResult`\<`TRow`\>\>

---

### username

> `readonly` **username**: `string`
