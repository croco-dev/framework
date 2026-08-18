---
editUrl: false
next: false
prev: false
title: "LifecycleAutomationConsoleProps"
---

> **LifecycleAutomationConsoleProps** = `object`

## Properties

### onDryRunFixture?

> `readonly` `optional` **onDryRunFixture?**: (`fixtureId`) => `void`

#### Parameters

##### fixtureId

`string`

#### Returns

`void`

---

### onRecoverRun?

> `readonly` `optional` **onRecoverRun?**: (`run`) => `void`

#### Parameters

##### run

[`LifecycleRunOperation`](/api/admin-react/src/type-aliases/lifecyclerunoperation/)

#### Returns

`void`

---

### onRuleAction?

> `readonly` `optional` **onRuleAction?**: (`action`) => `void`

#### Parameters

##### action

[`LifecycleRuleAdminAction`](/api/admin-react/src/type-aliases/lifecycleruleadminaction/)

#### Returns

`void`

---

### state

> `readonly` **state**: [`LifecycleAutomationConsoleState`](/api/admin-react/src/type-aliases/lifecycleautomationconsolestate/)
