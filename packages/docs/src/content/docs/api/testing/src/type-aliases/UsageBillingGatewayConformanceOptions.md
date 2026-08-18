---
editUrl: false
next: false
prev: false
title: "UsageBillingGatewayConformanceOptions"
---

> **UsageBillingGatewayConformanceOptions**\<`TGateway`\> = `object`

## Type Parameters

### TGateway

`TGateway` *extends* [`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/) = [`UsageBillingGateway`](/api/billing-core/src/interfaces/usagebillinggateway/)

## Properties

### assertCustomerMeterStateUpdatedAt?

> `readonly` `optional` **assertCustomerMeterStateUpdatedAt?**: (`updatedAt`, `context`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### updatedAt

`Date`

##### context

###### expected

`Omit`\<[`CustomerMeterState`](/api/billing-core/src/type-aliases/customermeterstate/), `"updatedAt"`\>

###### previousUpdatedAt?

`Date`

###### providerName

`string`

#### Returns

`void` \| `Promise`\<`void`\>

***

### createGateway

> `readonly` **createGateway**: () => `TGateway` \| `Promise`\<`TGateway`\>

#### Returns

`TGateway` \| `Promise`\<`TGateway`\>

***

### failureScenarios

> `readonly` **failureScenarios**: `object`

#### http429

> `readonly` **http429**: [`UsageBillingFailureScenario`](/api/testing/src/type-aliases/usagebillingfailurescenario/)\<`Extract`\<[`UsageBillingRetryableFailureFixture`](/api/testing/src/type-aliases/usagebillingretryablefailurefixture/), \{ `kind`: `"http-429"`; \}\>, `TGateway`\>

#### http5xx

> `readonly` **http5xx**: [`UsageBillingFailureScenario`](/api/testing/src/type-aliases/usagebillingfailurescenario/)\<`Extract`\<[`UsageBillingRetryableFailureFixture`](/api/testing/src/type-aliases/usagebillingretryablefailurefixture/), \{ `kind`: `"http-5xx"`; \}\>, `TGateway`\>

#### invalidMeter

> `readonly` **invalidMeter**: [`UsageBillingFailureScenario`](/api/testing/src/type-aliases/usagebillingfailurescenario/)\<`Extract`\<[`UsageBillingTerminalFailureFixture`](/api/testing/src/type-aliases/usagebillingterminalfailurefixture/), \{ `kind`: `"invalid-meter"`; \}\>, `TGateway`\>

#### invalidSchema

> `readonly` **invalidSchema**: [`UsageBillingFailureScenario`](/api/testing/src/type-aliases/usagebillingfailurescenario/)\<`Extract`\<[`UsageBillingTerminalFailureFixture`](/api/testing/src/type-aliases/usagebillingterminalfailurefixture/), \{ `kind`: `"invalid-schema"`; \}\>, `TGateway`\>

#### timeout

> `readonly` **timeout**: [`UsageBillingFailureScenario`](/api/testing/src/type-aliases/usagebillingfailurescenario/)\<`Extract`\<[`UsageBillingRetryableFailureFixture`](/api/testing/src/type-aliases/usagebillingretryablefailurefixture/), \{ `kind`: `"timeout"`; \}\>, `TGateway`\>

***

### fixtures

> `readonly` **fixtures**: [`UsageBillingConformanceFixtures`](/api/testing/src/type-aliases/usagebillingconformancefixtures/)

***

### liveSmoke?

> `readonly` `optional` **liveSmoke?**: [`UsageBillingLiveSmokeGate`](/api/testing/src/type-aliases/usagebillinglivesmokegate/)
