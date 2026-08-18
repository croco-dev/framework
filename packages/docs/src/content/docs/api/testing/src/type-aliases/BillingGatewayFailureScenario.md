---
editUrl: false
next: false
prev: false
title: "BillingGatewayFailureScenario"
---

> **BillingGatewayFailureScenario**\<`TGateway`\> = `object`

## Type Parameters

### TGateway

`TGateway` _extends_ [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/) = [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

## Properties

### assertProblem?

> `readonly` `optional` **assertProblem?**: (`problem`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### problem

[`Problem`](/api/problems-core/src/classes/problem/)

#### Returns

`void` \| `Promise`\<`void`\>

---

### createGateway?

> `readonly` `optional` **createGateway?**: () => `TGateway` \| `Promise`\<`TGateway`\>

#### Returns

`TGateway` \| `Promise`\<`TGateway`\>

---

### name

> `readonly` **name**: `string`

---

### run

> `readonly` **run**: (`gateway`) => `Promise`\<`unknown`\>

#### Parameters

##### gateway

`TGateway`

#### Returns

`Promise`\<`unknown`\>
