# @croco/auth-better-auth

Better Auth와 Drizzle을 Croco 인증 흐름에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/auth-better-auth better-auth drizzle-orm
```

## 사용법

### 1. Drizzle과 팩토리 등록

```typescript
import { BetterAuthFactory, DRIZZLE_TOKEN } from '@croco/auth-better-auth';
import { Container } from '@croco/framework-context';

Container.register(DRIZZLE_TOKEN, db);

const factory = new BetterAuthFactory(db, {
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
});
```

### 2. 인증 사용자 변환

```typescript
import { BetterAuthProvider } from '@croco/auth-better-auth';

const provider = new BetterAuthProvider(factory);
const user = await provider.authenticate(request);
```

### 3. 세션 관리

```typescript
import { BetterAuthSessionManager } from '@croco/auth-better-auth';

const sessions = new BetterAuthSessionManager(factory);
const session = await sessions.getSession(token);
await sessions.revokeUserSessions('user_123');
```

### 4. 웹훅 처리

```typescript
import { BetterAuthWebhookProcessor } from '@croco/auth-better-auth';

const processor = new BetterAuthWebhookProcessor(
  { signingSecret: process.env.BETTER_AUTH_WEBHOOK_SECRET! },
  {
    'session.revoked': async (payload) => {
      await auditSession(payload);
    },
  },
  sessions
);

await processor.processWebhook(request);
```

### 5. 제공 스키마 사용

```typescript
import { account, session, user, verification } from '@croco/auth-better-auth';

export const authSchema = { user, session, account, verification };
```

## API 레퍼런스

| API | 설명 |
|---|---|
| `BetterAuthFactory` | Better Auth 인스턴스를 생성하고 재사용합니다. |
| `BetterAuthProvider` | 요청 헤더에서 세션을 읽어 `AuthUser`로 변환합니다. |
| `BetterAuthSessionManager` | 세션 조회, 단건 해제, 사용자 전체 세션 해제를 처리합니다. |
| `BetterAuthWebhookProcessor` | 웹훅 서명을 확인하고 이벤트 핸들러를 호출합니다. |
| `user`, `session`, `account`, `verification` | Better Auth용 Drizzle 스키마를 제공합니다. |
| `BetterAuthInvalidSessionProblem` 외 Problem | 세션, 초기화, 웹훅 오류를 Problem으로 표현합니다. |

## 공개 타입

- `BetterAuthConfig`
- `BetterAuthSession`, `BetterAuthSessionProvider`
- `BetterAuthWebhookEvent`, `BetterAuthWebhookHandler`, `BetterAuthWebhookOptions`
- `BetterAuthUser`
