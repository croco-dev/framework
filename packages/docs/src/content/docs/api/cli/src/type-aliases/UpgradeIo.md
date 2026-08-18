---
editUrl: false
next: false
prev: false
title: "UpgradeIo"
---

> **UpgradeIo** = `object`

## Properties

### cwd

> `readonly` **cwd**: `string`

---

### exists

> `readonly` **exists**: (`path`) => `boolean`

#### Parameters

##### path

`string`

#### Returns

`boolean`

---

### mkdir

> `readonly` **mkdir**: (`path`) => `void`

#### Parameters

##### path

`string`

#### Returns

`void`

---

### readDir

> `readonly` **readDir**: (`path`) => readonly [`UpgradeDirent`](/api/cli/src/type-aliases/upgradedirent/)[]

#### Parameters

##### path

`string`

#### Returns

readonly [`UpgradeDirent`](/api/cli/src/type-aliases/upgradedirent/)[]

---

### readFile

> `readonly` **readFile**: (`path`) => `string`

#### Parameters

##### path

`string`

#### Returns

`string`

---

### stat

> `readonly` **stat**: (`path`) => `object`

#### Parameters

##### path

`string`

#### Returns

`object`

##### isDirectory

> `readonly` **isDirectory**: () => `boolean`

###### Returns

`boolean`

##### isFile

> `readonly` **isFile**: () => `boolean`

###### Returns

`boolean`

---

### stderr

> `readonly` **stderr**: (`message`) => `void`

#### Parameters

##### message

`string`

#### Returns

`void`

---

### stdout

> `readonly` **stdout**: (`message`) => `void`

#### Parameters

##### message

`string`

#### Returns

`void`

---

### writeFile

> `readonly` **writeFile**: (`path`, `content`) => `void`

#### Parameters

##### path

`string`

##### content

`string`

#### Returns

`void`
