# @croco/auth-better-auth

Better Auth SDK 기반 인증 패키지입니다. Drizzle ORM과 통합된 셀프 호스팅 인증 솔루션을 제공합니다.

## 설치

```bash
pnpm add @croco/auth-better-auth better-auth drizzle-orm
```

## 설정

### 1. 데이터베이스 스키마

Better Auth용 Drizzle 스키마는 패키지에서 제공됩니다:

```typescript
import { user, session, account, verification } from '@croco/auth-better-auth';

// drizzle.config.ts에서 사용
export default {
  schema: './schema.ts',
  out: './migrations',
};
```

### 2. BetterAuthFactory 설정

```typescript
import { Container, Component } from '@croco/framework-context';
import { BetterAuthFactory, DRIZZLE_TOKEN } from '@croco/auth-better-auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Drizzle DB 인스턴스 등록
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

Container.register(DRIZZLE_TOKEN, db);

// Better Auth 설정
const betterAuthFactory = new BetterAuthFactory(db, {
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
});

Container.register(BetterAuthFactory, betterAuthFactory);
```

### 3. 인증 Provider 사용

```typescript
import { BetterAuthProvider } from '@croco/auth-better-auth';
import { AuthGuard } from '@croco/auth-core';
import { Controller, Get } from '@croco/protocols-rest';

@Controller('/api')
class ApiController {
  @Get('/profile')
  @UseGuard(AuthGuard)
  async getProfile(@User() user: AuthUser) {
    return { id: user.id, email: user.email };
  }
}
```

## API

### BetterAuthProvider

`AuthProvider<Request>` 인터페이스 구현체입니다.

```typescript
const provider = new BetterAuthProvider(factory);
const user = await provider.authenticate(request);
```

### BetterAuthSessionManager

세션 관리 기능을 제공합니다.

```typescript
const sessionManager = new BetterAuthSessionManager(factory);

// 세션 조회
const session = await sessionManager.getSession(token);

// 세션 취소
await sessionManager.revokeSession(sessionId);

// 사용자의 모든 세션 취소
await sessionManager.revokeUserSessions(userId);
```

### BetterAuthUserService

사용자 관리 기능을 제공합니다.

```typescript
const userService = new BetterAuthUserService(factory);

// 사용자 조회
const user = await userService.getUser(userId);

// 사용자 정보 업데이트
await userService.updateUser(userId, { email: 'new@example.com' });

// 사용자 삭제
await userService.deleteUser(userId);
```

### BetterAuthWebhookProcessor

Better Auth 웹훅을 처리합니다.

```typescript
const processor = new BetterAuthWebhookProcessor(
  { signingSecret: process.env.WEBHOOK_SECRET! },
  {
    'user.created': async (data) => {
      // 사용자 생성 시 처리
    },
    'session.revoked': async (data) => {
      // 세션 취소 시 처리
    },
  },
  sessionProvider
);

// 웹훅 처리
await processor.processWebhook(request);
```

## Problem 에러

Better Auth 관련 에러는 모두 Problem 클래스를 상속합니다:

- `BetterAuthInvalidSessionProblem`: 유효하지 않은 세션
- `BetterAuthNotInitializedProblem`: 초기화되지 않음
- `BetterAuthSessionNotFoundProblem`: 세션을 찾을 수 없음
- `BetterAuthUserNotFoundProblem`: 사용자를 찾을 수 없음
- `InvalidWebhookSignatureProblem`: 웹훅 서명 오류
- `InvalidWebhookPayloadProblem`: 웹훅 페이로드 오류

## 라이선스

MIT
