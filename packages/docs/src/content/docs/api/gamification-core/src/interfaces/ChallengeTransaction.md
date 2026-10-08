---
editUrl: false
next: false
prev: false
title: "ChallengeTransaction"
---

## Properties

### challenge

> `readonly` **challenge**: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/) \| `null`

---

### completion

> `readonly` **completion**: `Readonly`\<\{ `challengeId`: `string`; `completedAt`: `Date`; `definitionVersion`: `number`; `id`: `string`; `memberCount`: `number`; `progress`: `number`; \}\> \| `null`

---

### contributions

> `readonly` **contributions**: readonly `Readonly`\<\{ `acceptedAt`: `Date`; `amount`: `number`; `correctionOf`: `string` \| `null`; `eventId`: `string`; `occurredAt`: `Date`; `revision`: `number`; `sourceId`: `string`; `subjectId`: `string`; \}\>[]

---

### erasedEventIds

> `readonly` **erasedEventIds**: readonly `string`[]

---

### erasedSubjectHashes

> `readonly` **erasedSubjectHashes**: readonly `string`[]

---

### evidenceAttempts

> `readonly` **evidenceAttempts**: readonly `Readonly`\<\{ `eventId`: `string`; `fingerprint`: `string`; `id`: `string`; `idempotencyKey`: `string`; `receivedAt`: `Date`; `sourceId`: `string`; `state`: `"unknown"` \| `"accepted"` \| `"rejected"`; `subjectId`: `string`; \}\>[]

---

### members

> `readonly` **members**: readonly `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\>[]

---

### receipts

> `readonly` **receipts**: readonly `Readonly`\<\{ `action`: [`ChallengeAction`](/api/gamification-core/src/type-aliases/challengeaction/); `actor`: `string`; `definitionVersion`: `number`; `fingerprint`: `string`; `idempotencyKey`: `string`; `reason`: `string`; `recordedAt`: `Date`; `subjectHash`: `string` \| `null`; \}\>[]

## Methods

### eraseSubject()

> **eraseSubject**(`subjectId`, `subjectHash`): `void`

Delete identifying membership, evidence and audit data; retain opaque replay tombstones.

#### Parameters

##### subjectId

`string`

##### subjectHash

`string`

#### Returns

`void`

---

### saveChallenge()

> **saveChallenge**(`value`): `void`

#### Parameters

##### value

[`Challenge`](/api/gamification-core/src/type-aliases/challenge/)

#### Returns

`void`

---

### saveCompletion()

> **saveCompletion**(`value`): `void`

#### Parameters

##### value

[`ChallengeCompletion`](/api/gamification-core/src/type-aliases/challengecompletion/)

#### Returns

`void`

---

### saveContribution()

> **saveContribution**(`value`): `void`

#### Parameters

##### value

[`ChallengeContribution`](/api/gamification-core/src/type-aliases/challengecontribution/)

#### Returns

`void`

---

### saveEvidenceAttempt()

> **saveEvidenceAttempt**(`value`): `void`

#### Parameters

##### value

[`ChallengeEvidenceAttempt`](/api/gamification-core/src/type-aliases/challengeevidenceattempt/)

#### Returns

`void`

---

### saveMember()

> **saveMember**(`value`): `void`

#### Parameters

##### value

[`ChallengeMember`](/api/gamification-core/src/type-aliases/challengemember/)

#### Returns

`void`

---

### saveReceipt()

> **saveReceipt**(`value`): `void`

#### Parameters

##### value

[`ChallengeReceipt`](/api/gamification-core/src/type-aliases/challengereceipt/)

#### Returns

`void`
