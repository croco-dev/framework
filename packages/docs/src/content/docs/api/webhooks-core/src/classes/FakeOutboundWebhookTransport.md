---
editUrl: false
next: false
prev: false
title: "FakeOutboundWebhookTransport"
---

## Implements

- [`OutboundWebhookTransport`](/api/webhooks-core/src/type-aliases/outboundwebhooktransport/)

## Constructors

### Constructor

> **new FakeOutboundWebhookTransport**(`outcomes`): `FakeOutboundWebhookTransport`

#### Parameters

##### outcomes

readonly [`OutboundWebhookAttemptOutcome`](/api/webhooks-core/src/type-aliases/outboundwebhookattemptoutcome/)[]

#### Returns

`FakeOutboundWebhookTransport`

## Properties

### requests

> `readonly` **requests**: [`OutboundWebhookTransportRequest`](/api/webhooks-core/src/type-aliases/outboundwebhooktransportrequest/)[] = `[]`

## Methods

### send()

> **send**(`request`): `Promise`\<[`OutboundWebhookAttemptOutcome`](/api/webhooks-core/src/type-aliases/outboundwebhookattemptoutcome/)\>

Connect only to an address in `request.resolvedAddresses`, preserve the URL hostname for
TLS/SNI, and return redirects without following them.

#### Parameters

##### request

[`OutboundWebhookTransportRequest`](/api/webhooks-core/src/type-aliases/outboundwebhooktransportrequest/)

#### Returns

`Promise`\<[`OutboundWebhookAttemptOutcome`](/api/webhooks-core/src/type-aliases/outboundwebhookattemptoutcome/)\>

#### Implementation of

`OutboundWebhookTransport.send`
