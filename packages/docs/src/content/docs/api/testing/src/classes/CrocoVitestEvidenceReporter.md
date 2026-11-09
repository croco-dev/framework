---
editUrl: false
next: false
prev: false
title: "CrocoVitestEvidenceReporter"
---

## Constructors

### Constructor

> **new CrocoVitestEvidenceReporter**(`options?`): `CrocoVitestEvidenceReporter`

#### Parameters

##### options?

[`TestEvidenceReporterOptions`](/api/testing/src/type-aliases/testevidencereporteroptions/) = `DEFAULT_VITEST_REPORTER_OPTIONS`

#### Returns

`CrocoVitestEvidenceReporter`

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

### onTestCaseResult()

> **onTestCaseResult**(`task`): `Promise`\<`void`\>

#### Parameters

##### task

[`VitestTask`](/api/testing/src/type-aliases/vitesttask/)

#### Returns

`Promise`\<`void`\>

---

### onTestRunStart()

> **onTestRunStart**(): `void`

#### Returns

`void`
