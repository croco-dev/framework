---
editUrl: false
next: false
prev: false
title: "createPageExperienceCollector"
---

> **createPageExperienceCollector**(`options`): `object`

One explicit instance per real navigation, retained outside a StrictMode effect.

## Parameters

### options

#### clock

() => `number`

#### contentCondition

`string`

#### contentMinIntersectionRatio

`number`

#### enabled

() => `boolean`

#### maxAttempts

`number`

#### maxBuffer

`number`

#### page

`string`

#### pageInstance

`string`

#### send

(`rows`) => `Promise`\<`void`\>

#### visible

() => `boolean`

## Returns

### action()

> **action**(`action`, `identity`): `void`

#### Parameters

##### action

`string`

##### identity

`string`

#### Returns

`void`

### attempt()

> **attempt**(`action`, `identity`): `void`

#### Parameters

##### action

`string`

##### identity

`string`

#### Returns

`void`

### contentDisplayed()

> **contentDisplayed**(`intersectionRatio`): `void`

#### Parameters

##### intersectionRatio

`number`

#### Returns

`void`

### flush()

> **flush**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### observe()

> **observe**(): `void`

#### Returns

`void`

### pause()

> **pause**(): `void`

Call before changing visibility, then resume after the transition.

#### Returns

`void`

### resume()

> **resume**(): `void`

#### Returns

`void`

### revoke()

> **revoke**(): `void`

#### Returns

`void`

### start()

> **start**(): `void`

#### Returns

`void`

### status()

> **status**(): `object`

#### Returns

`object`

##### attempts

> **attempts**: `number`

##### dropped

> **dropped**: `number`

##### queued

> **queued**: `number` = `queue.length`

##### visibleMs

> **visibleMs**: `number`
