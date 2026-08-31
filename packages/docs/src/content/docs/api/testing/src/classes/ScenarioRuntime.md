---
editUrl: false
next: false
prev: false
title: "ScenarioRuntime"
---

## Constructors

### Constructor

> **new ScenarioRuntime**(`options`): `ScenarioRuntime`

#### Parameters

##### options

[`ScenarioRuntimeOptions`](/api/testing/src/type-aliases/scenarioruntimeoptions/)

#### Returns

`ScenarioRuntime`

## Properties

### controls

> `readonly` **controls**: [`TestRuntime`](/api/testing/src/classes/testruntime/)

## Methods

### advanceBy()

> **advanceBy**(`duration`): `Promise`\<`void`\>

#### Parameters

##### duration

[`TestDuration`](/api/testing/src/type-aliases/testduration/)

#### Returns

`Promise`\<`void`\>

---

### at()

> **at**(`point`, `boundary`, `failure`): `this`

#### Parameters

##### point

`string`

##### boundary

`"telemetry"` \| `"transaction"` \| `"retry"` \| `"provider"` \| `"task"` \| `"event"` \| `"trigger"`

##### failure

[`ScenarioFailure`](/api/testing/src/type-aliases/scenariofailure/)

#### Returns

`this`

---

### execute()

> **execute**\<`T`\>(`point`, `boundary`, `operation`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### point

`string`

##### boundary

`"telemetry"` \| `"transaction"` \| `"retry"` \| `"provider"` \| `"task"` \| `"event"` \| `"trigger"`

##### operation

() => `T` \| `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### expectEventOnce()

> **expectEventOnce**(`name`): `this`

#### Parameters

##### name

`string`

#### Returns

`this`

---

### expectEvidence()

> **expectEvidence**(`kind`, `name`, `count?`): `this`

#### Parameters

##### kind

[`ScenarioEvidenceKind`](/api/testing/src/type-aliases/scenarioevidencekind/)

##### name

`string`

##### count?

`number` = `1`

#### Returns

`this`

---

### expectProblem()

> **expectProblem**(`code`, `count?`): `this`

#### Parameters

##### code

`string`

##### count?

`number` = `1`

#### Returns

`this`

---

### expectTask()

> **expectTask**(`name`, `count?`): `this`

#### Parameters

##### name

`string`

##### count?

`number` = `1`

#### Returns

`this`

---

### recordEvidence()

> **recordEvidence**(`kind`, `name`): `void`

#### Parameters

##### kind

[`ScenarioEvidenceKind`](/api/testing/src/type-aliases/scenarioevidencekind/)

##### name

`string`

#### Returns

`void`

---

### run()

> **run**(`run`): `Promise`\<[`ScenarioReport`](/api/testing/src/type-aliases/scenarioreport/)\>

#### Parameters

##### run

(`scenario`) => `void` \| `Promise`\<`void`\>

#### Returns

`Promise`\<[`ScenarioReport`](/api/testing/src/type-aliases/scenarioreport/)\>
