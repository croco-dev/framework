---
editUrl: false
next: false
prev: false
title: "LifecycleAutomationSource"
---

## Methods

### dryRun()

> **dryRun**(`request`, `grantedPermissions`): `Promise`\<[`LifecycleDryRunResponse`](/api/admin-react/src/type-aliases/lifecycledryrunresponse/)\>

#### Parameters

##### request

[`LifecycleDryRunRequest`](/api/admin-react/src/type-aliases/lifecycledryrunrequest/)

##### grantedPermissions

readonly `string`[]

#### Returns

`Promise`\<[`LifecycleDryRunResponse`](/api/admin-react/src/type-aliases/lifecycledryrunresponse/)\>

---

### executeRuleAction()

> **executeRuleAction**(`input`): `Promise`\<[`LifecycleRuleActionResult`](/api/admin-react/src/type-aliases/lifecycleruleactionresult/)\>

#### Parameters

##### input

[`LifecycleRuleActionInput`](/api/admin-react/src/type-aliases/lifecycleruleactioninput/)

#### Returns

`Promise`\<[`LifecycleRuleActionResult`](/api/admin-react/src/type-aliases/lifecycleruleactionresult/)\>

---

### inspectRules()

> **inspectRules**(): `Promise`\<readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]\>

#### Returns

`Promise`\<readonly [`LifecycleRuleInspection`](/api/lifecycle-core/src/type-aliases/lifecycleruleinspection/)[]\>

---

### listDryRunFixtures()

> **listDryRunFixtures**(): readonly [`LifecycleDryRunFixtureDescriptor`](/api/admin-react/src/type-aliases/lifecycledryrunfixturedescriptor/)[]

#### Returns

readonly [`LifecycleDryRunFixtureDescriptor`](/api/admin-react/src/type-aliases/lifecycledryrunfixturedescriptor/)[]

---

### listRecoveryItems()?

> `optional` **listRecoveryItems**(): `Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

#### Returns

`Promise`\<readonly [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/)[]\>

---

### listRuns()

> **listRuns**(`filters?`): `Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

#### Parameters

##### filters?

[`LifecycleRunFilters`](/api/admin-react/src/type-aliases/lifecyclerunfilters/)

#### Returns

`Promise`\<readonly [`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)[]\>

---

### runLinks()?

> `optional` **runLinks**(`run`): \{ `operationsHref?`: `string`; `tenantHref?`: `string`; \} \| `undefined`

#### Parameters

##### run

[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/)

#### Returns

\{ `operationsHref?`: `string`; `tenantHref?`: `string`; \} \| `undefined`
