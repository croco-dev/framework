---
editUrl: false
next: false
prev: false
title: "TaskRunnerRuntime"
---

## Properties

### now?

> `readonly` `optional` **now?**: () => `number`

#### Returns

`number`

---

### schedule?

> `readonly` `optional` **schedule?**: (`callback`, `delayMs`) => () => `void`

#### Parameters

##### callback

() => `void`

##### delayMs

`number`

#### Returns

() => `void`

---

### serviceResolver?

> `readonly` `optional` **serviceResolver?**: (`target`) => `object`

#### Parameters

##### target

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`object`\>

#### Returns

`object`
