---
editUrl: false
next: false
prev: false
title: "ParameterizedPolicy"
---

> **ParameterizedPolicy**\<`TValue`, `TContext`, `TResult`\> = `object`

The complete code registration for one parameterized policy. Functions are held in memory only;
persisted revisions carry the explicit registration fingerprint and never arbitrary code.

## Type Parameters

### TValue

`TValue`

### TContext

`TContext` _extends_ [`PolicyContext`](/api/features-core/src/type-aliases/policycontext/) = [`PolicyContext`](/api/features-core/src/type-aliases/policycontext/)

### TResult

`TResult` = `unknown`

## Properties

### codeRegistrationId

> `readonly` **codeRegistrationId**: `string`

---

### evaluate

> `readonly` **evaluate**: [`PolicyEvaluation`](/api/features-core/src/type-aliases/policyevaluation/)\<`TValue`, `TContext`, `TResult`\>

---

### fallback?

> `readonly` `optional` **fallback?**: `TValue`

---

### fieldDescriptors

> `readonly` **fieldDescriptors**: readonly [`PolicyFieldDescriptor`](/api/features-core/src/type-aliases/policyfielddescriptor/)\<`TValue`\>[]

---

### id

> `readonly` **id**: `string`

---

### registrationFingerprint?

> `readonly` `optional` **registrationFingerprint?**: `string`

---

### reviewRequirements?

> `readonly` `optional` **reviewRequirements?**: `object`

#### independentReviewer

> `readonly` **independentReviewer**: `boolean`

#### risk

> `readonly` **risk**: `"low"` \| `"financial"`

---

### schema

> `readonly` **schema**: [`PolicySchema`](/api/features-core/src/type-aliases/policyschema/)\<`TValue`\>

---

### schemaVersion

> `readonly` **schemaVersion**: `string`

---

### semanticDiff?

> `readonly` `optional` **semanticDiff?**: (`before`, `after`) => readonly [`PolicySemanticDiff`](/api/features-core/src/type-aliases/policysemanticdiff/)[]

#### Parameters

##### before

`TValue` \| `null`

##### after

`TValue`

#### Returns

readonly [`PolicySemanticDiff`](/api/features-core/src/type-aliases/policysemanticdiff/)[]

---

### validate?

> `readonly` `optional` **validate?**: (`value`) => [`PolicyValidationResult`](/api/features-core/src/type-aliases/policyvalidationresult/) \| readonly [`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/)[] \| `boolean`

#### Parameters

##### value

`unknown`

#### Returns

[`PolicyValidationResult`](/api/features-core/src/type-aliases/policyvalidationresult/) \| readonly [`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/)[] \| `boolean`
