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

---

## 성숙도 안내

| 항목 | 상태 | 설명 |
|------|------|------|
| **현재 상태** | 🔴 alpha | 개발 중, 사용 시 주의 필요 |
| **주요 기능** | 단건 전송, 템플릿 전송, 재시도, 멱등성 | Resend API 기본 연동 |
| **테스트 존재 여부** | ✅ | 단위테스트 1개 파일 (`ResendProvider.spec.ts`) |
| **운영 증거 수준** | L1 | 단위테스트 있음 / 통합테스트 미존재 / 샌드박스 미실행 / 프로덕션 미사용 |

### 참고

- `@croco/notifications-core` 인터페이스를 구현합니다.
- 모든 요청에 고유 idempotency key를 적용합니다.
- 템플릿 미사용 시 HTML 본문으로 전송합니다.
