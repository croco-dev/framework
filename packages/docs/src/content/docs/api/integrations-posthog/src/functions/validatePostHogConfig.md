---
editUrl: false
next: false
prev: false
title: "validatePostHogConfig"
---

> **validatePostHogConfig**(`config`): `Required`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>

PostHog 설정과 환경 기반 host를 검증하고 런타임에서 사용할 완전한 설정을 반환합니다.

## Parameters

### config

`Partial`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>

검증할 부분 PostHog 설정입니다.

## Returns

`Required`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>

API key와 검증된 HTTP(S) host를 포함한 설정입니다.
