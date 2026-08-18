---
editUrl: false
next: false
prev: false
title: "DesktopMutationDefinition"
---

> **DesktopMutationDefinition**\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\> = `object`

## Type Parameters

### TInputSchema

`TInputSchema` = `unknown`

### TOutputSchema

`TOutputSchema` = `unknown`

### TEffects

`TEffects` _extends_ readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[] = readonly \[\]

### TEvents

`TEvents` _extends_ readonly `string`[] = readonly \[\]

### TProblems

`TProblems` _extends_ readonly [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)[] = readonly \[\]

## Properties

### definitionType

> `readonly` **definitionType**: `"command"`

---

### effects

> `readonly` **effects**: `TEffects`

---

### events

> `readonly` **events**: `TEvents`

---

### input

> `readonly` **input**: `TInputSchema`

---

### kind

> `readonly` **kind**: `"mutation"`

---

### output

> `readonly` **output**: `TOutputSchema`

---

### problems

> `readonly` **problems**: `TProblems`
