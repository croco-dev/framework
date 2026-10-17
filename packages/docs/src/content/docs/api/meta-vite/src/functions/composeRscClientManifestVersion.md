---
editUrl: false
next: false
prev: false
title: "composeRscClientManifestVersion"
---

> **composeRscClientManifestVersion**(`clientBuildId`): `string`

Client manifest version for one client build. The protocol constant alone
only separates framework generations: a browser holding HTML that was
rendered for an older client bundle would still be accepted, then decode
payloads whose references it cannot resolve. Appending the build id makes
that mismatch explicit instead of surfacing as a broken tree.

## Parameters

### clientBuildId

`string`

## Returns

`string`
