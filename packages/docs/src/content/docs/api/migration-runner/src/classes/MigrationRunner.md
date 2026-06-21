---
editUrl: false
next: false
prev: false
title: "MigrationRunner"
---

## Constructors

### Constructor

> **new MigrationRunner**(`db`, `migrationsDir`, `tableName?`): `MigrationRunner`

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

##### migrationsDir

`string`

##### tableName?

`string`

#### Returns

`MigrationRunner`

## Methods

### down()

> **down**(`targetId?`, `count?`): `Promise`\<`string`[]\>

#### Parameters

##### targetId?

`string`

##### count?

`number`

#### Returns

`Promise`\<`string`[]\>

***

### init()

> **init**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### status()

> **status**(): `Promise`\<[`MigrationStatus`](/api/migration-runner/src/interfaces/migrationstatus/)[]\>

#### Returns

`Promise`\<[`MigrationStatus`](/api/migration-runner/src/interfaces/migrationstatus/)[]\>

***

### up()

> **up**(`targetId?`): `Promise`\<`string`[]\>

#### Parameters

##### targetId?

`string`

#### Returns

`Promise`\<`string`[]\>
