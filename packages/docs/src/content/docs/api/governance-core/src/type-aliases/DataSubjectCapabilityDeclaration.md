---
editUrl: false
next: false
prev: false
title: "DataSubjectCapabilityDeclaration"
---

> **DataSubjectCapabilityDeclaration** = \{ `audit`: [`DataGovernanceAuditDescriptor`](/api/governance-core/src/type-aliases/datagovernanceauditdescriptor/); `handlerId`: `string`; `metadata?`: `Readonly`\<`Record`\<`string`, `unknown`\>\>; `problems?`: readonly [`DataGovernanceProblemContract`](/api/governance-core/src/type-aliases/datagovernanceproblemcontract/)[]; `status`: `"supported"`; \} \| \{ `audit?`: [`DataGovernanceAuditDescriptor`](/api/governance-core/src/type-aliases/datagovernanceauditdescriptor/); `metadata?`: `Readonly`\<`Record`\<`string`, `unknown`\>\>; `problems?`: readonly [`DataGovernanceProblemContract`](/api/governance-core/src/type-aliases/datagovernanceproblemcontract/)[]; `reason`: `string`; `status`: `"not-supported"`; \}
