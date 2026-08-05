---
editUrl: false
next: false
prev: false
title: "TestClock"
---

## Constructors

### Constructor

> **new TestClock**(`initial?`): `TestClock`

#### Parameters

##### initial?

`string` \| `Date`

#### Returns

`TestClock`

## Accessors

### now

#### Get Signature

> **get** **now**(): `Date`

##### Returns

`Date`

---

### pendingWork

#### Get Signature

> **get** **pendingWork**(): readonly [`TestScheduledWork`](/api/testing/src/type-aliases/testscheduledwork/)[]

##### Returns

readonly [`TestScheduledWork`](/api/testing/src/type-aliases/testscheduledwork/)[]

## Methods

### advanceBy()

> **advanceBy**(`duration`): `Promise`\<`void`\>

#### Parameters

##### duration

[`TestDuration`](/api/testing/src/type-aliases/testduration/)

#### Returns

`Promise`\<`void`\>

---

### drain()

> **drain**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### schedule()

> **schedule**(`callback`, `delay`, `source?`): () => `void`

#### Parameters

##### callback

`ScheduledCallback`

##### delay

[`TestDuration`](/api/testing/src/type-aliases/testduration/)

##### source?

`string` = `"scheduled-work"`

#### Returns

() => `void`

---

### sleep()

> **sleep**(`delay`, `source?`): `Promise`\<`void`\>

#### Parameters

##### delay

[`TestDuration`](/api/testing/src/type-aliases/testduration/)

##### source?

`string` = `"sleep"`

#### Returns

`Promise`\<`void`\>
