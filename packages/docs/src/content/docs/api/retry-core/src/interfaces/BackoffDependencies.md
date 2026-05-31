---
editUrl: false
next: false
prev: false
title: "BackoffDependencies"
---

Dependency injection for testability.

## Properties

### random()?

> `optional` **random**: () => `number`

Random function (default: Math.random)

#### Returns

`number`

---

### sleep()?

> `optional` **sleep**: (`ms`) => `Promise`\<`void`\>

Sleep function (default: setTimeout-based)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
