---
editUrl: false
next: false
prev: false
title: "BackoffDependencies"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:35](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L35)

Dependency injection for testability.

## Properties

### random()?

> `optional` **random**: () => `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:40](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L40)

Random function (default: Math.random)

#### Returns

`number`

***

### sleep()?

> `optional` **sleep**: (`ms`) => `Promise`\<`void`\>

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:37](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/retry-core/src/libs/BackoffPolicy.ts#L37)

Sleep function (default: setTimeout-based)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
