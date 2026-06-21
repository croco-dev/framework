---
editUrl: false
next: false
prev: false
title: "WebhookEventHandler"
---

> **WebhookEventHandler** = \{ \[K in WebhookEventType\]?: (data: ClerkUserEvent \| ClerkOrgEvent \| ClerkMembershipEvent) =\> Promise\<void\> \}

Clerk 웹훅과 인증 요청에 필요한 공개 타입입니다.
