---
editUrl: false
next: false
prev: false
title: "InferDesktopCommandProblem"
---

> **InferDesktopCommandProblem**\<`TCommand`\> = `TCommand` _extends_ [`DesktopCommandDefinition`](/api/protocols-desktop/src/type-aliases/desktopcommanddefinition/)\<`unknown`, `unknown`, readonly [`AnyDesktopEffect`](/api/protocols-desktop/src/type-aliases/anydesktopeffect/)[], readonly `string`[], infer TProblems\> ? \[`TProblems`\[`number`\]\] _extends_ \[`never`\] ? `never` : `TProblems`\[`number`\] _extends_ [`DesktopProblemReference`](/api/protocols-desktop/src/type-aliases/desktopproblemreference/)\<infer TProblem\> ? `TProblem` : `never` : `never`

## Type Parameters

### TCommand

`TCommand`
