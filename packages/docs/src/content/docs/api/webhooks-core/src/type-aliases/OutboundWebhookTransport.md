---
editUrl: false
next: false
prev: false
title: "OutboundWebhookTransport"
---

> **OutboundWebhookTransport** = `object`

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
