---
editUrl: false
next: false
prev: false
title: "OfferConsoleProps"
---

> **OfferConsoleProps** = `object`

## Properties

### editor?

> `readonly` `optional` **editor?**: [`OfferPolicyEditorDraft`](/api/admin-core/src/type-aliases/offerpolicyeditordraft/)

---

### editorErrors?

> `readonly` `optional` **editorErrors?**: `Readonly`\<`Record`\<`string`, `string`\>\>

---

### onAction?

> `readonly` `optional` **onAction?**: (`action`) => `void`

#### Parameters

##### action

[`OfferConsoleAction`](/api/admin-core/src/type-aliases/offerconsoleaction/)

#### Returns

`void`

---

### onEditorChange?

> `readonly` `optional` **onEditorChange?**: (`editor`) => `void`

#### Parameters

##### editor

[`OfferPolicyEditorDraft`](/api/admin-core/src/type-aliases/offerpolicyeditordraft/)

#### Returns

`void`

---

### onRefresh?

> `readonly` `optional` **onRefresh?**: () => `void`

#### Returns

`void`

---

### onSelectClaim?

> `readonly` `optional` **onSelectClaim?**: (`claimId`) => `void`

#### Parameters

##### claimId

`string`

#### Returns

`void`

---

### onSubmitPolicy?

> `readonly` `optional` **onSubmitPolicy?**: (`editor`) => `void`

#### Parameters

##### editor

[`OfferPolicyEditorDraft`](/api/admin-core/src/type-aliases/offerpolicyeditordraft/)

#### Returns

`void`

---

### selectedClaimId?

> `readonly` `optional` **selectedClaimId?**: `string`

---

### state

> `readonly` **state**: [`OfferConsoleState`](/api/admin-core/src/type-aliases/offerconsolestate/)
