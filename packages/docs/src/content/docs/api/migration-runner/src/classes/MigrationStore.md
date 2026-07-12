---
editUrl: false
next: false
prev: false
title: "MigrationStore"
---

## Constructors

### Constructor

> **new MigrationStore**(`tableName?`): `MigrationStore`

#### Parameters

##### tableName?

`string` = `"_migrations"`

#### Returns

`MigrationStore`

## Methods

### claimMigrationForRollback()

> **claimMigrationForRollback**(`db`, `id`): `Promise`\<`boolean`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

##### id

`string`

#### Returns

`Promise`\<`boolean`\>

---

### completeMigration()

> **completeMigration**(`db`, `id`): `Promise`\<`void`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### ensureTable()

> **ensureTable**(`db`): `Promise`\<`void`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

#### Returns

`Promise`\<`void`\>

---

### getExecutedMigrations()

> **getExecutedMigrations**(`db`): `Promise`\<[`MigrationRecord`](/api/migration-runner/src/interfaces/migrationrecord/)[]\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

#### Returns

`Promise`\<[`MigrationRecord`](/api/migration-runner/src/interfaces/migrationrecord/)[]\>

---

### hasTable()

> **hasTable**(`db`): `Promise`\<`boolean`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

#### Returns

`Promise`\<`boolean`\>

---

### recordMigration()

> **recordMigration**(`db`, `id`, `name`): `Promise`\<`void`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

##### id

`string`

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### removeMigration()

> **removeMigration**(`db`, `id`): `Promise`\<`void`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### reserveMigration()

> **reserveMigration**(`db`, `id`, `name`): `Promise`\<`boolean`\>

#### Parameters

##### db

[`DatabaseClient`](/api/migration-runner/src/type-aliases/databaseclient/)

##### id

`string`

##### name

`string`

#### Returns

`Promise`\<`boolean`\>
