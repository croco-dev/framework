---
editUrl: false
next: false
prev: false
title: "AstryxSessionState"
---

> **AstryxSessionState** = \{ `kind`: `"loading"`; `recoveryActions?`: readonly [`AstryxRecoveryAction`](/api/ui-astryx/src/type-aliases/astryxrecoveryaction/)[]; \} \| \{ `kind`: `"authenticated"`; `session`: [`AstryxSession`](/api/ui-astryx/src/type-aliases/astryxsession/); \} \| \{ `kind`: `"unauthenticated"`; `problem?`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`AstryxRecoveryAction`](/api/ui-astryx/src/type-aliases/astryxrecoveryaction/)[]; \} \| \{ `kind`: `"unavailable"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`AstryxRecoveryAction`](/api/ui-astryx/src/type-aliases/astryxrecoveryaction/)[]; \}
