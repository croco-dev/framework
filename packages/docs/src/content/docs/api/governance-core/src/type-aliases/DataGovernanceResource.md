---
editUrl: false
next: false
prev: false
title: "DataGovernanceResource"
---

> **DataGovernanceResource** = `object`

## Properties

### description?

> `readonly` `optional` **description?**: `string`

***

### fields

> `readonly` **fields**: [`NonEmptyArray`](/api/governance-core/src/type-aliases/nonemptyarray/)\<[`DataGovernanceField`](/api/governance-core/src/type-aliases/datagovernancefield/)\>

***

### kind

> `readonly` **kind**: `string`

***

### label

> `readonly` **label**: `string`

***

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

***

### problems?

> `readonly` `optional` **problems?**: readonly [`DataGovernanceProblemContract`](/api/governance-core/src/type-aliases/datagovernanceproblemcontract/)[]

***

### retentionPolicies?

> `readonly` `optional` **retentionPolicies?**: readonly [`DataRetentionPolicy`](/api/governance-core/src/type-aliases/dataretentionpolicy/)[]

***

### scope

> `readonly` **scope**: [`DataGovernanceScope`](/api/governance-core/src/type-aliases/datagovernancescope/)

***

### subject

> `readonly` **subject**: [`DataSubjectIdentity`](/api/governance-core/src/type-aliases/datasubjectidentity/)

***

### subjectRequests?

> `readonly` `optional` **subjectRequests?**: `object`

#### delete?

> `readonly` `optional` **delete?**: [`DataSubjectCapabilityDeclaration`](/api/governance-core/src/type-aliases/datasubjectcapabilitydeclaration/)

#### export?

> `readonly` `optional` **export?**: [`DataSubjectCapabilityDeclaration`](/api/governance-core/src/type-aliases/datasubjectcapabilitydeclaration/)
