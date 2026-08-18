---
editUrl: false
next: false
prev: false
title: "InferDesktopCommandProblem"
---

> **InferDesktopCommandProblem**\<`TCommand`\> = `TCommand` *extends* [`DesktopCommandDefinition`](/api/protocols-desktop/src/type-aliases/desktopcommanddefinition/)\<`unknown`, `unknown`, readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[], readonly `string`[], infer TProblems\> ? \[`TProblems`\[`number`\]\] *extends* \[`never`\] ? `never` : `TProblems`\[`number`\] *extends* [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)\<infer TProblem\> ? `TProblem` : `never` : `never`

## Type Parameters

### TCommand

`TCommand`
