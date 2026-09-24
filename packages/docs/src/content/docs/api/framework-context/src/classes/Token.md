---
editUrl: false
next: false
prev: false
title: "Token"
---

A type-safe dependency token whose runtime identity is the token object itself.
The name is diagnostic-only and never participates in equality.

## Type Parameters

### T

`T`

## Constructors

### Constructor

> **new Token**\<`T`\>(`name`): `Token`\<`T`\>

#### Parameters

##### name

`string`

#### Returns

`Token`\<`T`\>

## Properties

### \[TOKEN_IDENTITY\]

> `readonly` **\[TOKEN_IDENTITY\]**: `true` = `true`

---

### name

> `readonly` **name**: `string`

## Methods

### toString()

> **toString**(): `string`

#### Returns

`string`
