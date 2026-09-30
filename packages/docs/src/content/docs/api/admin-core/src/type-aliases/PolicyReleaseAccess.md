---
editUrl: false
next: false
prev: false
title: "PolicyReleaseAccess"
---

> **PolicyReleaseAccess** = `Readonly`\<\{ `actor`: [`PolicyActor`](/api/features-core/src/type-aliases/policyactor/); `permissions`: readonly [`PolicyReleasePermission`](/api/admin-core/src/type-aliases/policyreleasepermission/)[]; `scope`: [`PolicyScope`](/api/features-core/src/type-aliases/policyscope/) & `object`; \}\>

Resolve on the server from the authenticated identity, never from request JSON.
