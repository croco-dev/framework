---
editUrl: false
next: false
prev: false
title: "ResearchOperations"
---

Server-owned access and source; forwards every write through the same authorized domain service.

## Constructors

### Constructor

> **new ResearchOperations**(`service`): `ResearchOperations`

#### Parameters

##### service

[`ResearchService`](/api/research-core/src/classes/researchservice/)

#### Returns

`ResearchOperations`

## Methods

### execute()

> **execute**(`scope`, `studyId`, `action`, `command`, `access`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### studyId

`string`

##### action

[`ResearchAction`](/api/admin-core/src/type-aliases/researchaction/)

##### command

`Omit`\<[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/), `"source"`\>

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

#### Returns

`Promise`\<`number`\>

---

### read()

> **read**(`scope`, `studyId`, `access`, `offset?`, `limit?`): `Promise`\<`Readonly`\<\{ `candidates`: readonly `Readonly`\<\{ `candidate`: [`Candidate`](/api/research-core/src/type-aliases/candidate/); `exclusion?`: `string`; `invitation?`: [`Invitation`](/api/research-core/src/type-aliases/invitation/); `note?`: `string`; \}\>[]; `groups`: readonly `Readonly`\<\{ `accepted`: `number`; `eligible`: `number`; `group`: `string`; `held`: `number`; `invited`: `number`; `participated`: `number`; `population`: `number`; `selected`: `number`; `shortage`: `number`; `unknown`: `number`; \}\>[]; `history`: readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `contactConsent?`: `boolean`; `idempotencyKey`: `string`; `operation`: `string`; `participationConsent?`: `boolean`; `reason`: `string`; `revision`: `number`; `source`: `string`; `subject?`: `string`; `transitions?`: readonly `Readonly`\<\{ `state`: [`InvitationState`](/api/research-core/src/type-aliases/invitationstate/); `subject`: `string`; \}\>[]; \}\>[]; `nextOffset?`: `number`; `revision`: `number`; `scope`: [`ResearchScope`](/api/research-core/src/type-aliases/researchscope/); `study`: [`StudyDefinition`](/api/research-core/src/type-aliases/studydefinition/); \}\>\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### studyId

`string`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### offset?

`number` = `0`

##### limit?

`number` = `20`

#### Returns

`Promise`\<`Readonly`\<\{ `candidates`: readonly `Readonly`\<\{ `candidate`: [`Candidate`](/api/research-core/src/type-aliases/candidate/); `exclusion?`: `string`; `invitation?`: [`Invitation`](/api/research-core/src/type-aliases/invitation/); `note?`: `string`; \}\>[]; `groups`: readonly `Readonly`\<\{ `accepted`: `number`; `eligible`: `number`; `group`: `string`; `held`: `number`; `invited`: `number`; `participated`: `number`; `population`: `number`; `selected`: `number`; `shortage`: `number`; `unknown`: `number`; \}\>[]; `history`: readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `contactConsent?`: `boolean`; `idempotencyKey`: `string`; `operation`: `string`; `participationConsent?`: `boolean`; `reason`: `string`; `revision`: `number`; `source`: `string`; `subject?`: `string`; `transitions?`: readonly `Readonly`\<\{ `state`: [`InvitationState`](/api/research-core/src/type-aliases/invitationstate/); `subject`: `string`; \}\>[]; \}\>[]; `nextOffset?`: `number`; `revision`: `number`; `scope`: [`ResearchScope`](/api/research-core/src/type-aliases/researchscope/); `study`: [`StudyDefinition`](/api/research-core/src/type-aliases/studydefinition/); \}\>\>
