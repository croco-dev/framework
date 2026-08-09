---
editUrl: false
next: false
prev: false
title: "DesktopQueryOptions"
---

> **DesktopQueryOptions**\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\> = `object`

## Type Parameters

### TInputSchema

`TInputSchema`

### TOutputSchema

`TOutputSchema`

### TEffects

`TEffects` *extends* readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[] \| `undefined` = `undefined`

### TEvents

`TEvents` *extends* readonly `string`[] \| `undefined` = `undefined`

### TProblems

`TProblems` *extends* readonly [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)[] \| `undefined` = `undefined`

## Properties

### effects?

> `readonly` `optional` **effects?**: `TEffects`

***

### events?

> `readonly` `optional` **events?**: `TEvents`

***

### input

> `readonly` **input**: `TInputSchema`

***

### output

> `readonly` **output**: `TOutputSchema`

***

### problems?

> `readonly` `optional` **problems?**: `TProblems`
