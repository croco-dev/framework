---
editUrl: false
next: false
prev: false
title: "AuthProviderAuthConformance"
---

> **AuthProviderAuthConformance** = `object`

## Properties

### expectedUser

> `readonly` **expectedUser**: [`AuthUser`](/api/auth-core/src/type-aliases/authuser/)

---

### invalidCredentials

> `readonly` **invalidCredentials**: [`AuthProviderCredentialFailureExpectation`](/api/testing/src/type-aliases/authprovidercredentialfailureexpectation/)

---

### malformedPayload

> `readonly` **malformedPayload**: [`AuthProviderProblemExpectation`](/api/testing/src/type-aliases/authproviderproblemexpectation/)

---

### upstreamFailure

> `readonly` **upstreamFailure**: [`AuthProviderProblemExpectation`](/api/testing/src/type-aliases/authproviderproblemexpectation/)

## Methods

### authenticateMissingCredentials()

> **authenticateMissingCredentials**(): [`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\> \| `null`

#### Returns

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\> \| `null`

---

### authenticateValid()

> **authenticateValid**(): [`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\> \| `null`

#### Returns

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `Promise`\<[`AuthUser`](/api/auth-core/src/type-aliases/authuser/) \| `null`\> \| `null`
