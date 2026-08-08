---
editUrl: false
next: false
prev: false
title: "registerPostHogConfig"
---

> **registerPostHogConfig**(`config`): `Readonly`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>

PostHog 설정을 검증하고 환경 기반 host를 정규화한 뒤 Croco DI에 등록합니다.

## Parameters

### config

[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)

등록할 PostHog API key와 선택적 HTTP(S) host입니다.

## Returns

`Readonly`\<[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)\>

컨테이너에 등록된 동결 설정입니다.
