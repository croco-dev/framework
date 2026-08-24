---
editUrl: false
next: false
prev: false
title: "CheckResult"
---

> **CheckResult** = \{ `allowed`: `true`; `decision`: `"allow"`; `reason?`: `string`; `trace?`: [`PolicyDecisionTrace`](/api/access-core/src/type-aliases/policydecisiontrace/); \} \| \{ `allowed`: `false`; `decision`: `"deny"`; `reason?`: `string`; `trace?`: [`PolicyDecisionTrace`](/api/access-core/src/type-aliases/policydecisiontrace/); \} \| \{ `allowed`: `false`; `decision`: `"abstain"`; `reason?`: `string`; `trace?`: [`PolicyDecisionTrace`](/api/access-core/src/type-aliases/policydecisiontrace/); \}
