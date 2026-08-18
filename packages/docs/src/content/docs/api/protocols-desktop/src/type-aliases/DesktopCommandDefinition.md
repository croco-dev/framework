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

`TEffects` _extends_ readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[] = readonly \[\]

### TEvents

`TEvents` _extends_ readonly `string`[] = readonly \[\]

### TProblems

`TProblems` _extends_ readonly [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)[] = readonly \[\]
