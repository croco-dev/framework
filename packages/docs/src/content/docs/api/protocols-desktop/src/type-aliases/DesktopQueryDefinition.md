---
editUrl: false
next: false
prev: false
title: "DesktopQueryDefinition"
---

> **DesktopQueryDefinition**\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\> = `object`

## Type Parameters

### TInputSchema

`TInputSchema` = `unknown`

### TOutputSchema

`TOutputSchema` = `unknown`

### TEffects

`TEffects` *extends* readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[] = readonly \[\]

### TEvents

`TEvents` *extends* readonly `string`[] = readonly \[\]

### TProblems

`TProblems` *extends* readonly [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)[] = readonly \[\]

## Properties

### definitionType

> `readonly` **definitionType**: `"command"`

***

### effects

> `readonly` **effects**: `TEffects`

***

### events

> `readonly` **events**: `TEvents`

***

### input

> `readonly` **input**: `TInputSchema`

***

### kind

> `readonly` **kind**: `"query"`

***

### output

> `readonly` **output**: `TOutputSchema`

***

### problems

> `readonly` **problems**: `TProblems`
