---
editUrl: false
next: false
prev: false
title: "createPostHogConfig"
---

> **createPostHogConfig**(`config`, `logger?`): `Readonly`\<`Required`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>\>

명시적인 애플리케이션 provider에 전달할 PostHog 설정을 검증하고 동결합니다.

## Parameters

### config

[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)

PostHog API key와 선택적 HTTP(S) host입니다.

### logger?

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

## Returns

`Readonly`\<`Required`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>\>

검증된 host를 포함하는 동결 설정입니다.
