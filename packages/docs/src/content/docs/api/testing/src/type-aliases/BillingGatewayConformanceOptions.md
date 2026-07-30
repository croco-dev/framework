---
editUrl: false
next: false
prev: false
title: "BillingGatewayConformanceOptions"
---

> **BillingGatewayConformanceOptions**\<`TGateway`\> = `object`

## Type Parameters

### TGateway

`TGateway` *extends* [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/) = [`BillingGateway`](/api/billing-core/src/interfaces/billinggateway/)

## Properties

### assertions?

> `readonly` `optional` **assertions?**: [`BillingGatewayConformanceAssertions`](/api/testing/src/type-aliases/billinggatewayconformanceassertions/)\<`TGateway`\>

***

### checkoutConflictProblemCode?

> `readonly` `optional` **checkoutConflictProblemCode?**: `string`

***

### createGateway

> `readonly` **createGateway**: () => `TGateway` \| `Promise`\<`TGateway`\>

#### Returns

`TGateway` \| `Promise`\<`TGateway`\>

***

### failureScenarios?

> `readonly` `optional` **failureScenarios?**: readonly [`BillingGatewayFailureScenario`](/api/testing/src/type-aliases/billinggatewayfailurescenario/)\<`TGateway`\>[]

***

### fixtures

> `readonly` **fixtures**: [`BillingGatewayConformanceFixtures`](/api/testing/src/type-aliases/billinggatewayconformancefixtures/)

***

### getCheckoutCreateCount

> `readonly` **getCheckoutCreateCount**: (`gateway`) => `number` \| `Promise`\<`number`\>

#### Parameters

##### gateway

`TGateway`

#### Returns

`number` \| `Promise`\<`number`\>
