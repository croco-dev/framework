---
editUrl: false
next: false
prev: false
title: "ReferralProgramConsoleProps"
---

> **ReferralProgramConsoleProps** = `object`

## Properties

### editor?

> `readonly` `optional` **editor?**: [`ReferralProgramEditorDraft`](/api/admin-core/src/type-aliases/referralprogrameditordraft/)

---

### editorErrors?

> `readonly` `optional` **editorErrors?**: `Readonly`\<`Record`\<`string`, `string`\>\>

---

### onAction?

> `readonly` `optional` **onAction?**: (`action`) => `void`

#### Parameters

##### action

[`ReferralConsoleAction`](/api/admin-core/src/type-aliases/referralconsoleaction/)

#### Returns

`void`

---

### onEditorChange?

> `readonly` `optional` **onEditorChange?**: (`editor`) => `void`

#### Parameters

##### editor

[`ReferralProgramEditorDraft`](/api/admin-core/src/type-aliases/referralprogrameditordraft/)

#### Returns

`void`

---

### onRefresh?

> `readonly` `optional` **onRefresh?**: () => `void`

#### Returns

`void`

---

### onSelectAttribution?

> `readonly` `optional` **onSelectAttribution?**: (`attributionId`) => `void`

#### Parameters

##### attributionId

`string`

#### Returns

`void`

---

### onSubmitProgram?

> `readonly` `optional` **onSubmitProgram?**: (`editor`) => `void`

#### Parameters

##### editor

[`ReferralProgramEditorDraft`](/api/admin-core/src/type-aliases/referralprogrameditordraft/)

#### Returns

`void`

---

### selectedAttributionId?

> `readonly` `optional` **selectedAttributionId?**: `string`

---

### state

> `readonly` **state**: [`ReferralConsoleState`](/api/admin-core/src/type-aliases/referralconsolestate/)
