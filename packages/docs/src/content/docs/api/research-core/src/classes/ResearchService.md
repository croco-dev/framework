---
editUrl: false
next: false
prev: false
title: "ResearchService"
---

One study is an immutable dataset/policy publication. Revision tracks operations, not a new contact budget.

## Constructors

### Constructor

> **new ResearchService**(`store`, `authorizer`, `sender`, `approvedBookingUrls`, `clock?`): `ResearchService`

#### Parameters

##### store

[`ResearchStore`](/api/research-core/src/interfaces/researchstore/)

##### authorizer

[`ResearchAuthorizer`](/api/research-core/src/interfaces/researchauthorizer/)

##### sender

[`ResearchSender`](/api/research-core/src/interfaces/researchsender/)

##### approvedBookingUrls

readonly `string`[]

##### clock?

() => `Date`

#### Returns

`ResearchService`

## Methods

### importCandidates()

> **importCandidates**(`scope`, `id`, `candidates`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### candidates

readonly `Readonly`\<\{ `consentRecordedAt`: `string`; `consentSource`: `string`; `contactConsent`: `boolean`; `eligible`: `boolean`; `group`: `string`; `observedThrough`: `string`; `priorContactAt?`: `string`; `priorParticipatedAt?`: `string`; `sourceSnapshotId`: `string`; `subject`: `string`; \}\>[]

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### inspect()

> **inspect**(`scope`, `id`, `access`, `offset?`, `limit?`): `Promise`\<`Readonly`\<\{ `candidates`: readonly `Readonly`\<\{ `candidate`: [`Candidate`](/api/research-core/src/type-aliases/candidate/); `exclusion?`: `string`; `invitation?`: [`Invitation`](/api/research-core/src/type-aliases/invitation/); `note?`: `string`; \}\>[]; `groups`: readonly `Readonly`\<\{ `accepted`: `number`; `eligible`: `number`; `group`: `string`; `held`: `number`; `invited`: `number`; `participated`: `number`; `population`: `number`; `selected`: `number`; `shortage`: `number`; `unknown`: `number`; \}\>[]; `history`: readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `contactConsent?`: `boolean`; `idempotencyKey`: `string`; `operation`: `string`; `participationConsent?`: `boolean`; `reason`: `string`; `revision`: `number`; `source`: `string`; `subject?`: `string`; `transitions?`: readonly `Readonly`\<\{ `state`: [`InvitationState`](/api/research-core/src/type-aliases/invitationstate/); `subject`: `string`; \}\>[]; \}\>[]; `nextOffset?`: `number`; `revision`: `number`; `scope`: [`ResearchScope`](/api/research-core/src/type-aliases/researchscope/); `study`: [`StudyDefinition`](/api/research-core/src/type-aliases/studydefinition/); \}\>\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### offset?

`number` = `0`

##### limit?

`number` = `20`

#### Returns

`Promise`\<`Readonly`\<\{ `candidates`: readonly `Readonly`\<\{ `candidate`: [`Candidate`](/api/research-core/src/type-aliases/candidate/); `exclusion?`: `string`; `invitation?`: [`Invitation`](/api/research-core/src/type-aliases/invitation/); `note?`: `string`; \}\>[]; `groups`: readonly `Readonly`\<\{ `accepted`: `number`; `eligible`: `number`; `group`: `string`; `held`: `number`; `invited`: `number`; `participated`: `number`; `population`: `number`; `selected`: `number`; `shortage`: `number`; `unknown`: `number`; \}\>[]; `history`: readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `contactConsent?`: `boolean`; `idempotencyKey`: `string`; `operation`: `string`; `participationConsent?`: `boolean`; `reason`: `string`; `revision`: `number`; `source`: `string`; `subject?`: `string`; `transitions?`: readonly `Readonly`\<\{ `state`: [`InvitationState`](/api/research-core/src/type-aliases/invitationstate/); `subject`: `string`; \}\>[]; \}\>[]; `nextOffset?`: `number`; `revision`: `number`; `scope`: [`ResearchScope`](/api/research-core/src/type-aliases/researchscope/); `study`: [`StudyDefinition`](/api/research-core/src/type-aliases/studydefinition/); \}\>\>

---

### invite()

> **invite**(`scope`, `id`, `subject`, `access`, `command`): `Promise`\<`number`\>

Commit admission before dispatch. Withdrawal completed before admission prevents contact. After admission, cancellation is not claimed.

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### subject

`string`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### markParticipated()

> **markParticipated**(`scope`, `id`, `subject`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### subject

`string`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### publishStudy()

> **publishStudy**(`scope`, `definition`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### definition

[`StudyDefinition`](/api/research-core/src/type-aliases/studydefinition/)

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### purgeExpiredNotes()

> **purgeExpiredNotes**(`scope`, `id`, `access`, `command`): `Promise`\<`number`\>

Physical expiration is an audited write; read paths never expose expired notes.

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### reconcileInvitation()

> **reconcileInvitation**(`scope`, `id`, `subject`, `outcome`, `access`, `command`): `Promise`\<`number`\>

Provider evidence is supplied through an authenticated host with participation authority; no blind retry of unknown sends.

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### subject

`string`

##### outcome

`"invited"` \| `"suppressed"`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### recordConsent()

> **recordConsent**(`scope`, `id`, `subject`, `consent`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### subject

`string`

##### consent

`Readonly`\<\{ `contact`: `boolean`; `participation`: `boolean`; \}\>

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### recordResponse()

> **recordResponse**(`scope`, `id`, `subject`, `response`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### subject

`string`

##### response

`"accepted"` \| `"declined"` \| `"withdrawn"`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### selectCandidates()

> **selectCandidates**(`scope`, `id`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>

---

### writeNote()

> **writeNote**(`scope`, `id`, `subject`, `note`, `access`, `command`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ResearchScope`](/api/research-core/src/type-aliases/researchscope/)

##### id

`string`

##### subject

`string`

##### note

`string` \| `null`

##### access

[`ResearchAccess`](/api/research-core/src/type-aliases/researchaccess/)

##### command

[`ResearchCommand`](/api/research-core/src/type-aliases/researchcommand/)

#### Returns

`Promise`\<`number`\>
