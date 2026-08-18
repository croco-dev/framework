---
editUrl: false
next: false
prev: false
title: "Money"
---

통화 안전 계산을 위한 값 객체입니다.

## Constructors

### Constructor

> **new Money**(`amount`, `currency`): `Money`

#### Parameters

##### amount

`number`

##### currency

`string`

#### Returns

`Money`

## Properties

### amount

> `readonly` **amount**: `number`

---

### currency

> `readonly` **currency**: `string`

## Methods

### add()

> **add**(`other`): `Money`

#### Parameters

##### other

`Money`

#### Returns

`Money`

---

### divide()

> **divide**(`divisor`, `roundingMode?`): `Money`

#### Parameters

##### divisor

`number`

##### roundingMode?

[`MoneyRoundingMode`](/api/billing-core/src/type-aliases/moneyroundingmode/) = `"half_up"`

#### Returns

`Money`

---

### eq()

> **eq**(`other`): `boolean`

#### Parameters

##### other

`Money`

#### Returns

`boolean`

---

### gt()

> **gt**(`other`): `boolean`

#### Parameters

##### other

`Money`

#### Returns

`boolean`

---

### gte()

> **gte**(`other`): `boolean`

#### Parameters

##### other

`Money`

#### Returns

`boolean`

---

### lt()

> **lt**(`other`): `boolean`

#### Parameters

##### other

`Money`

#### Returns

`boolean`

---

### lte()

> **lte**(`other`): `boolean`

#### Parameters

##### other

`Money`

#### Returns

`boolean`

---

### multiply()

> **multiply**(`multiplier`, `roundingMode?`): `Money`

#### Parameters

##### multiplier

`number`

##### roundingMode?

[`MoneyRoundingMode`](/api/billing-core/src/type-aliases/moneyroundingmode/) = `"half_up"`

#### Returns

`Money`

---

### subtract()

> **subtract**(`other`): `Money`

#### Parameters

##### other

`Money`

#### Returns

`Money`

---

### toDecimal()

> **toDecimal**(): `number`

#### Returns

`number`

---

### toFormattedString()

> **toFormattedString**(`locale?`): `string`

#### Parameters

##### locale?

`string` = `"en-US"`

#### Returns

`string`

---

### toJSON()

> **toJSON**(): `object`

#### Returns

`object`

##### amount

> **amount**: `number`

##### currency

> **currency**: `string`

---

### toString()

> **toString**(): `string`

#### Returns

`string`

---

### fromDecimal()

> `static` **fromDecimal**(`amount`, `currency`, `roundingMode?`): `Money`

#### Parameters

##### amount

`number`

##### currency

`string`

##### roundingMode?

[`MoneyRoundingMode`](/api/billing-core/src/type-aliases/moneyroundingmode/) = `"half_up"`

#### Returns

`Money`

---

### zero()

> `static` **zero**(`currency`): `Money`

#### Parameters

##### currency

`string`

#### Returns

`Money`
