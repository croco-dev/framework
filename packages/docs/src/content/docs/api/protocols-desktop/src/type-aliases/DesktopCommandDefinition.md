---
editUrl: false
next: false
prev: false
title: "DesktopCommandDefinition"
---

> **DesktopCommandDefinition**\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\> = [`DesktopQueryDefinition`](/api/protocols-desktop/src/type-aliases/desktopquerydefinition/)\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\> \| [`DesktopMutationDefinition`](/api/protocols-desktop/src/type-aliases/desktopmutationdefinition/)\<`TInputSchema`, `TOutputSchema`, `TEffects`, `TEvents`, `TProblems`\>

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
