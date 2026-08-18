---
editUrl: false
next: false
prev: false
title: "TestEvidenceReporterOptions"
---

> **TestEvidenceReporterOptions** = `object`

## Properties

### attempts?

> `readonly` `optional` **attempts?**: (`context`) => readonly [`TestEvidenceAttempt`](/api/testing/src/type-aliases/testevidenceattempt/)[]

#### Parameters

##### context

[`TestEvidenceReporterContext`](/api/testing/src/type-aliases/testevidencereportercontext/)

#### Returns

readonly [`TestEvidenceAttempt`](/api/testing/src/type-aliases/testevidenceattempt/)[]

---

### diagnostics?

> `readonly` `optional` **diagnostics?**: (`context`) => readonly [`TestEvidenceDiagnostic`](/api/testing/src/type-aliases/testevidencediagnostic/)[]

#### Parameters

##### context

[`TestEvidenceReporterContext`](/api/testing/src/type-aliases/testevidencereportercontext/)

#### Returns

readonly [`TestEvidenceDiagnostic`](/api/testing/src/type-aliases/testevidencediagnostic/)[]

---

### fidelity

> `readonly` **fidelity**: [`TestEvidenceFidelity`](/api/testing/src/type-aliases/testevidencefidelity/)

---

### intent?

> `readonly` `optional` **intent?**: (`context`) => [`TestEvidenceIntent`](/api/testing/src/type-aliases/testevidenceintent/)

#### Parameters

##### context

[`TestEvidenceReporterContext`](/api/testing/src/type-aliases/testevidencereportercontext/)

#### Returns

[`TestEvidenceIntent`](/api/testing/src/type-aliases/testevidenceintent/)

---

### observed?

> `readonly` `optional` **observed?**: (`context`) => [`TestEvidenceObservation`](/api/testing/src/type-aliases/testevidenceobservation/)

#### Parameters

##### context

[`TestEvidenceReporterContext`](/api/testing/src/type-aliases/testevidencereportercontext/)

#### Returns

[`TestEvidenceObservation`](/api/testing/src/type-aliases/testevidenceobservation/)

---

### outputDirectory?

> `readonly` `optional` **outputDirectory?**: `string`

---

### packageName?

> `readonly` `optional` **packageName?**: `string` \| ((`context`) => `string` \| `undefined`)

---

### replay?

> `readonly` `optional` **replay?**: (`context`) => [`TestEvidenceReplay`](/api/testing/src/type-aliases/testevidencereplay/)

#### Parameters

##### context

[`TestEvidenceReporterContext`](/api/testing/src/type-aliases/testevidencereportercontext/)

#### Returns

[`TestEvidenceReplay`](/api/testing/src/type-aliases/testevidencereplay/)

---

### resources?

> `readonly` `optional` **resources?**: (`context`) => [`TestEvidenceResourceStatus`](/api/testing/src/type-aliases/testevidenceresourcestatus/)

#### Parameters

##### context

[`TestEvidenceReporterContext`](/api/testing/src/type-aliases/testevidencereportercontext/)

#### Returns

[`TestEvidenceResourceStatus`](/api/testing/src/type-aliases/testevidenceresourcestatus/)

---

### write?

> `readonly` `optional` **write?**: (`record`) => `Promise`\<`void`\> \| `void`

#### Parameters

##### record

[`TestEvidenceRecord`](/api/testing/src/type-aliases/testevidencerecord/)

#### Returns

`Promise`\<`void`\> \| `void`
