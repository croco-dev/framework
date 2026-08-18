---
editUrl: false
next: false
prev: false
title: "LifecycleDryRunResult"
---

> **LifecycleDryRunResult** = `object`

## Properties

### conditionEvidence

> `readonly` **conditionEvidence**: [`LifecycleConditionEvidence`](/api/lifecycle-core/src/type-aliases/lifecycleconditionevidence/)

---

### evaluatedAt

> `readonly` **evaluatedAt**: `Date`

---

### matched

> `readonly` **matched**: `boolean`

---

### problems

> `readonly` **problems**: readonly [`LifecycleDryRunProblem`](/api/lifecycle-core/src/type-aliases/lifecycledryrunproblem/)[]

---

### proposedActions

> `readonly` **proposedActions**: readonly [`LifecycleRuleActionDescriptor`](/api/lifecycle-core/src/type-aliases/lifecycleruleactiondescriptor/)[]

---

### ruleFingerprint

> `readonly` **ruleFingerprint**: `string`

---

### ruleId

> `readonly` **ruleId**: `string`

---

### ruleVersion

> `readonly` **ruleVersion**: `string`

---

### signal

> `readonly` **signal**: [`LifecycleDryRunSignalEvidence`](/api/lifecycle-core/src/type-aliases/lifecycledryrunsignalevidence/)

---

### state

> `readonly` **state**: [`LifecycleRuleState`](/api/lifecycle-core/src/type-aliases/lifecyclerulestate/)

---

### suppression

> `readonly` **suppression**: [`LifecycleDryRunSuppression`](/api/lifecycle-core/src/type-aliases/lifecycledryrunsuppression/)

---

### tenantId

> `readonly` **tenantId**: `string`
