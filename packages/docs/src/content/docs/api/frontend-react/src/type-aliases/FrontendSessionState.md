---
editUrl: false
next: false
prev: false
title: "FrontendSessionState"
---

> **FrontendSessionState** = \{ `kind`: `"loading"`; `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `kind`: `"authenticated"`; `session`: [`FrontendSession`](/api/frontend-react/src/type-aliases/frontendsession/); \} \| \{ `kind`: `"unauthenticated"`; `problem?`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `kind`: `"unavailable"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \}
