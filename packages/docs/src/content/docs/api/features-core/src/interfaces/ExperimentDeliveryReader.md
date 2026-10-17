---
editUrl: false
next: false
prev: false
title: "ExperimentDeliveryReader"
---

An application assignment reader or the real ExperimentRuntime; no allocator lives in this bridge.

## Methods

### admitDisplay()

> **admitDisplay**(`input`): `Promise`\<[`ExperimentAssignmentResult`](/api/features-core/src/type-aliases/experimentassignmentresult/)\>

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object` & `object`

#### Returns

`Promise`\<[`ExperimentAssignmentResult`](/api/features-core/src/type-aliases/experimentassignmentresult/)\>

---

### assign()

> **assign**(`input`): `Promise`\<[`ExperimentAssignmentResult`](/api/features-core/src/type-aliases/experimentassignmentresult/)\>

#### Parameters

##### input

[`ExperimentInput`](/api/features-core/src/type-aliases/experimentinput/)

#### Returns

`Promise`\<[`ExperimentAssignmentResult`](/api/features-core/src/type-aliases/experimentassignmentresult/)\>

---

### recordExposure()

> **recordExposure**(`input`): `Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

#### Parameters

##### input

[`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object` & `object`

#### Returns

`Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>
