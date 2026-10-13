---
editUrl: false
next: false
prev: false
title: "SurveyAuthority"
---

## Methods

### authorize()

> **authorize**(`input`): `Promise`\<`boolean`\>

#### Parameters

##### input

###### actor

`string`

###### permission

[`SurveyPermission`](/api/research-core/src/type-aliases/surveypermission/)

###### scope

[`SurveyScope`](/api/research-core/src/type-aliases/surveyscope/)

#### Returns

`Promise`\<`boolean`\>

---

### verifySubject()

> **verifySubject**(`input`): `Promise`\<`boolean`\>

#### Parameters

##### input

###### actor

`string`

###### scope

[`SurveyScope`](/api/research-core/src/type-aliases/surveyscope/)

###### subject

[`SurveySubject`](/api/research-core/src/type-aliases/surveysubject/)

#### Returns

`Promise`\<`boolean`\>
