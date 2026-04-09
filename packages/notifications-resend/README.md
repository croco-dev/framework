# @croco/notifications-resend

Resend를 이용해 이메일 알림을 전송하는 `@croco/notifications-core` 구현체입니다.

## 설치

```bash
pnpm add @croco/notifications-resend resend
```

## 사용법

```typescript
import { ResendProvider } from '@croco/notifications-resend';

const provider = new ResendProvider({
  apiKey: process.env.RESEND_API_KEY!,
  from: 'noreply@example.com',
});

const result = await provider.send({
  channel: 'email',
  to: ['user@example.com'],
  subject: '환영합니다',
  content: '<p>가입을 환영합니다.</p>',
});
```

## 템플릿 전송

```typescript
await provider.send({
  channel: 'email',
  to: ['user@example.com'],
  templateId: 'welcome-email',
  variables: { name: 'Croco' },
});
```

## API 레퍼런스

| API | 설명 |
|---|---|
| `ResendProvider` | 단건 전송과 배치 전송을 처리합니다. |
| `ResendConfig` | API 키와 발신자 주소를 지정하는 설정 타입입니다. |
| `ResendNotificationProblem` | Resend 요청 실패를 Problem으로 표현합니다. |

## 동작 메모

- 재시도 대상 오류는 408, 425, 429, 5xx와 일부 네트워크 오류입니다.
- 템플릿을 쓰지 않으면 `content`를 HTML 본문으로 보냅니다.
- 모든 요청은 고유 idempotency key를 붙여 전송합니다.
