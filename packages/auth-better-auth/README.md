# @croco/auth-better-auth

Better Auth와 Drizzle을 Croco 인증 흐름에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/auth-better-auth better-auth drizzle-orm
```

## 사용법

### 1. Drizzle과 팩토리 등록

```typescript
import { BetterAuthFactory, DRIZZLE_TOKEN } from "@croco/auth-better-auth";
import { Container } from "@croco/framework-context";

Container.register(DRIZZLE_TOKEN, db);

const factory = new BetterAuthFactory(db, {
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
});
```

### 2. 인증 사용자 변환

```typescript
import { BetterAuthProvider } from "@croco/auth-better-auth";

const provider = new BetterAuthProvider(factory);
const user = await provider.authenticate(request);
```

### 3. 세션 관리

```typescript
import { BetterAuthSessionManager } from "@croco/auth-better-auth";

const sessions = new BetterAuthSessionManager(factory);
const session = await sessions.getSession(token);
await sessions.revokeUserSessions("user_123");
```

### 4. 웹훅 처리

```typescript
import { BetterAuthWebhookProcessor } from "@croco/auth-better-auth";

const processor = new BetterAuthWebhookProcessor(
  { signingSecret: process.env.BETTER_AUTH_WEBHOOK_SECRET! },
  {
    "session.revoked": async (payload) => {
      await auditSession(payload);
    },
  },
  sessions,
);

await processor.processWebhook(request);
```

### 5. 제공 스키마 사용

```typescript
import { account, session, user, verification } from "@croco/auth-better-auth";

export const authSchema = { user, session, account, verification };
```

## Diagnostics와 Conformance

`BetterAuthDiagnosticsProvider`는 `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, 앱이 제공하는
Drizzle 연결, 선택적 `BETTER_AUTH_WEBHOOK_SECRET` 준비 상태를 secret 값 없이 보고합니다.

```typescript
import { BetterAuthDiagnosticsProvider } from "@croco/auth-better-auth";

const diagnostics = new BetterAuthDiagnosticsProvider({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  webhookSecret: process.env.BETTER_AUTH_WEBHOOK_SECRET,
  databaseConfigured: true,
});
```

패키지 테스트는 `@croco/testing`의 `createAuthProviderConformanceSuite()`를 사용해 아래
계약을 기본 no-credential CI에서 검증합니다.

- 유효한 세션을 `AuthUser`로 변환하고 `roles`, `permissions`, `orgId`, `tenantId` metadata를
  보존합니다.
- 누락/무효 세션은 인증되지 않은 상태(`null`)로 처리하고, malformed session payload는
  `auth-better-auth/invalid-session-payload` Problem으로 실패합니다.
- Better Auth upstream 실패는 secret 값을 redaction한
  `auth-better-auth/authentication-failed` Problem으로 정규화합니다.
- 웹훅은 HMAC 서명 성공/실패와 malformed payload를 stable Problem code로 검증합니다.
- readiness diagnostics는 필수 env 이름만 노출하고 secret 값은 노출하지 않습니다.

Optional live smoke는 기본적으로 skip됩니다. 실제 Better Auth 배포를 검증하려면 아래 env를
설정하고 테스트를 실행합니다.

```bash
BETTER_AUTH_LIVE_SMOKE=1 \
BETTER_AUTH_LIVE_SESSION_URL=https://auth.example.com/api/auth/get-session \
BETTER_AUTH_LIVE_SESSION_TOKEN=... \
pnpm --filter @croco/auth-better-auth test
```

검증 명령:

```bash
pnpm --filter @croco/auth-better-auth test
pnpm docs:catalog:check
pnpm public-api:check
```

## API 레퍼런스

| API                                          | 설명                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| `BetterAuthFactory`                          | Better Auth 인스턴스를 생성하고 재사용합니다.             |
| `BetterAuthDiagnosticsProvider`              | readiness와 missing config를 secret 없이 보고합니다.      |
| `BetterAuthProvider`                         | 요청 헤더에서 세션을 읽어 `AuthUser`로 변환합니다.        |
| `BetterAuthSessionManager`                   | 세션 조회, 단건 해제, 사용자 전체 세션 해제를 처리합니다. |
| `BetterAuthWebhookProcessor`                 | 웹훅 서명을 확인하고 이벤트 핸들러를 호출합니다.          |
| `user`, `session`, `account`, `verification` | Better Auth용 Drizzle 스키마를 제공합니다.                |
| `BetterAuthInvalidSessionProblem` 외 Problem | 세션, 초기화, 웹훅 오류를 Problem으로 표현합니다.         |

## 공개 타입

- `BetterAuthConfig`
- `BetterAuthDiagnosticsConfig`, `BetterAuthDiagnosticsOptions`
- `BetterAuthSession`, `BetterAuthSessionProvider`
- `BetterAuthWebhookEvent`, `BetterAuthWebhookHandler`, `BetterAuthWebhookOptions`
- `BetterAuthUser`
