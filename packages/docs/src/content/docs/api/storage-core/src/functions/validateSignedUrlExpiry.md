---
editUrl: false
next: false
prev: false
title: "validateSignedUrlExpiry"
---

> **validateSignedUrlExpiry**(`expiresIn`): `number`

Validates a signed-URL lifetime expressed in seconds.

The seven-day upper bound is the narrowest limit shared by Croco's storage providers.

## Parameters

### expiresIn

`number`

## Returns

`number`

## Throws

When the expiry is not a positive safe integer or exceeds the provider limit.
