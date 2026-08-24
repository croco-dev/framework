---
editUrl: false
next: false
prev: false
title: "NotificationResult"
---

> **NotificationResult** = \{ `error?`: `never`; `messageId?`: `string`; `problem?`: `never`; `providerResponse?`: `unknown`; `success`: `true`; \} \| \{ `error?`: `never`; `messageId?`: `never`; `problem`: [`Problem`](/api/problems-core/src/classes/problem/); `providerResponse?`: `unknown`; `success`: `false`; \}

Provider delivery outcome. Providers normalize failures into a Croco Problem
before returning so callers can classify retryability without inventing
missing failure evidence.
