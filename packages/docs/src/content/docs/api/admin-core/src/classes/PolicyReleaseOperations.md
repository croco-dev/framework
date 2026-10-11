---
editUrl: false
next: false
prev: false
title: "PolicyReleaseOperations"
---

Authenticated server boundary; field writes and all transitions use the shared policy service.

## Constructors

### Constructor

> **new PolicyReleaseOperations**(`service`): `PolicyReleaseOperations`

#### Parameters

##### service

[`PolicyReleaseService`](/api/features-core/src/classes/policyreleaseservice/)

#### Returns

`PolicyReleaseOperations`

## Methods

### edit()

> **edit**(`command`, `access`): `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `policyId`: `string`; `scope`: [`PolicyScope`](/api/features-core/src/type-aliases/policyscope/); \}\> & `Readonly`\<\{ `expectedRevision`: `number`; `idempotencyKey`: `string`; `reason`: `string`; \}\> & `Readonly`\<\{ `field`: `string`; `value`: `unknown`; \}\>

##### access

[`PolicyReleaseAccess`](/api/admin-core/src/type-aliases/policyreleaseaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>\>

---

### publish()

> **publish**(`command`, `access`): `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>\>

#### Parameters

##### command

`Readonly`\<\{ `policyId`: `string`; `scope`: [`PolicyScope`](/api/features-core/src/type-aliases/policyscope/); \}\> & `Readonly`\<\{ `expectedRevision`: `number`; `idempotencyKey`: `string`; `reason`: `string`; \}\> & `Readonly`\<\{ `effectiveAt?`: `string`; `reviewHash`: `string`; \}\>

##### access

[`PolicyReleaseAccess`](/api/admin-core/src/type-aliases/policyreleaseaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>\>

---

### read()

> **read**(`target`, `access`): `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: ...; `value`: ...; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\> \| `null`\>

#### Parameters

##### target

[`PolicyReleaseAdminTarget`](/api/admin-core/src/type-aliases/policyreleaseadmintarget/)

##### access

[`PolicyReleaseAccess`](/api/admin-core/src/type-aliases/policyreleaseaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: ...; `value`: ...; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\> \| `null`\>

---

### review()

> **review**(`command`, `access`): `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>\>

#### Parameters

##### command

[`PolicyReleaseAdminCommand`](/api/admin-core/src/type-aliases/policyreleaseadmincommand/)

##### access

[`PolicyReleaseAccess`](/api/admin-core/src/type-aliases/policyreleaseaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>\>
