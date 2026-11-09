---
editUrl: false
next: false
prev: false
title: "CrocoPlaywrightEvidenceReporter"
---

## Constructors

### Constructor

> **new CrocoPlaywrightEvidenceReporter**(`options`): `CrocoPlaywrightEvidenceReporter`

#### Parameters

##### options

[`TestEvidenceReporterOptions`](/api/testing/src/type-aliases/testevidencereporteroptions/)

#### Returns

`CrocoPlaywrightEvidenceReporter`

## Accessors

### outputDirectory

#### Get Signature

> **get** **outputDirectory**(): `string` \| `undefined`

##### Returns

`string` \| `undefined`

---

### runId

#### Get Signature

> **get** **runId**(): `string` \| `undefined`

##### Returns

`string` \| `undefined`

## Methods

### onBegin()

> **onBegin**(): `void`

#### Returns

`void`

---

### onEnd()

> **onEnd**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### onTestEnd()

> **onTestEnd**(`test`, `result`): `void`

#### Parameters

##### test

[`PlaywrightTestCase`](/api/testing/src/type-aliases/playwrighttestcase/)

##### result

[`PlaywrightTestResult`](/api/testing/src/type-aliases/playwrighttestresult/)

#### Returns

`void`
