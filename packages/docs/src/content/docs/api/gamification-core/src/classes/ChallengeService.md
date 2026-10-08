---
editUrl: false
next: false
prev: false
title: "ChallengeService"
---

## Constructors

### Constructor

> **new ChallengeService**(`options`): `ChallengeService`

#### Parameters

##### options

[`ChallengeServiceOptions`](/api/gamification-core/src/type-aliases/challengeserviceoptions/)

#### Returns

`ChallengeService`

## Methods

### close()

> **close**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: `Readonly`\<\{ `id`: `string`; `reason`: `string`; \}\>; `challengeId`: `string`; `scope`: [`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/); `subjectId`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### contribute()

> **contribute**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: `Readonly`\<\{ `id`: `string`; `reason`: `string`; \}\>; `challengeId`: `string`; `scope`: [`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/); `subjectId`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### create()

> **create**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: `Readonly`\<\{ `id`: `string`; `reason`: `string`; \}\>; `challengeId`: `string`; `scope`: [`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/); `subjectId`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### eraseSubject()

> **eraseSubject**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

[`ChallengeCommand`](/api/gamification-core/src/type-aliases/challengecommand/)

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### join()

> **join**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: `Readonly`\<\{ `id`: `string`; `reason`: `string`; \}\>; `challengeId`: `string`; `scope`: [`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/); `subjectId`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### leave()

> **leave**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

[`ChallengeCommand`](/api/gamification-core/src/type-aliases/challengecommand/)

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### read()

> **read**(`access`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### access

`Readonly`\<\{ `actor`: `Readonly`\<\{ `id`: `string`; `reason`: `string`; \}\>; `challengeId`: `string`; `scope`: [`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/); `subjectId`: `string`; \}\> & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

---

### updateDefinition()

> **updateDefinition**(`command`): `Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `actor`: `Readonly`\<\{ `id`: `string`; `reason`: `string`; \}\>; `challengeId`: `string`; `scope`: [`ChallengeScope`](/api/gamification-core/src/type-aliases/challengescope/); `subjectId`: `string`; \}\> & `Readonly`\<\{ `idempotencyKey`: `string`; \}\> & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `challenge`: [`Challenge`](/api/gamification-core/src/type-aliases/challenge/); `participants`: readonly `Readonly`\<\{ `progress`: `number`; `subjectId`: `string`; \}\>[]; `pendingEvidenceCount`: `number`; `self`: `Readonly`\<\{ `consentVersion`: `number`; `intervals`: readonly `Readonly`\<\{ `joinedAt`: `Date`; `leftAt`: `Date` \| `null`; \}\>[]; `publicConsent`: `boolean`; `subjectId`: `string`; \}\> \| `null`; `selfProgress`: `number`; \}\>\>
