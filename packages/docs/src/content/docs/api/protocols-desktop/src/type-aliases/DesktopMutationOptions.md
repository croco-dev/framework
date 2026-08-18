---
editUrl: false
next: false
prev: false
title: "DesktopMutationOptions"
---

> **DesktopMutationOptions**\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\> = `object`

## Type Parameters

### TInputSchema

`TInputSchema`

### TOutputSchema

`TOutputSchema`

### TEffects

`TEffects` _extends_ readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[] \| `undefined` = `undefined`

### TEvents

`TEvents` _extends_ readonly `string`[] \| `undefined` = `undefined`

### TProblems

`TProblems` _extends_ readonly [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)[] \| `undefined` = `undefined`

## Properties

### effects?

> `readonly` `optional` **effects?**: `TEffects`

---

### events?

> `readonly` `optional` **events?**: `TEvents`

---

### input

> `readonly` **input**: `TInputSchema`

---

### output

> `readonly` **output**: `TOutputSchema`

---

### problems?

> `readonly` `optional` **problems?**: `TProblems`
