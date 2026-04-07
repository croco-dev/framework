---
editUrl: false
next: false
prev: false
title: "BackoffDependencies"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L40)

Dependency injection for testability.

## Properties

### random()?

> `optional` **random**: () => `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L45)

Random function (default: Math.random)

#### Returns

`number`

***

### sleep()?

> `optional` **sleep**: (`ms`) => `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:42](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/BackoffPolicy.ts#L42)

Sleep function (default: setTimeout-based)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
