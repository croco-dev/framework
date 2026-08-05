---
editUrl: false
next: false
prev: false
title: "UsageBillingFailureScenario"
---

> **UsageBillingFailureScenario**\<`TFixture`, `TGateway`\> = `object`

## Type Parameters

### TFixture

`TFixture` _extends_ [`UsageBillingRetryableFailureFixture`](/api/testing/src/type-aliases/usagebillingretryablefailurefixture/) \| [`UsageBillingTerminalFailureFixture`](/api/testing/src/type-aliases/usagebillingterminalfailurefixture/)

### TGateway

`TGateway` _extends_ [`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/) = [`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/)

## Properties

### createGateway

> `readonly` **createGateway**: (`fixture`) => `TGateway` \| `Promise`\<`TGateway`\>

#### Parameters

##### fixture

`TFixture`

#### Returns

`TGateway` \| `Promise`\<`TGateway`\>

---

### fixture

> `readonly` **fixture**: `TFixture`

---

### forbiddenValues

> `readonly` **forbiddenValues**: readonly \[`string`, `...string[]`\]

---

### run

> `readonly` **run**: (`gateway`, `fixture`) => `Promise`\<`unknown`\>

#### Parameters

##### gateway

`TGateway`

##### fixture

`TFixture`

#### Returns

`Promise`\<`unknown`\>
