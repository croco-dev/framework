# @croco/auth-clerk

Clerk Backend SDK를 Croco 인증, 세션, 조직 API에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/auth-clerk @croco/idempotency-core @clerk/backend
```

## 사용법

### 1. 토큰 인증

```typescript
import { ClerkAuthProvider } from "@croco/auth-clerk";

const authProvider = new ClerkAuthProvider({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

const user = await authProvider.authenticate(request);
```

### 2. 세션 조회와 해제

```typescript
import { ClerkSessionProvider } from "@croco/auth-clerk";

const sessions = new ClerkSessionProvider({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const session = await sessions.getSession("sess_123");
await sessions.revokeAllSessions("user_123");
```

### 3. 사용자와 조직 관리

```typescript
import { ClerkOrganizationService, ClerkUserService } from "@croco/auth-clerk";

const options = { secretKey: process.env.CLERK_SECRET_KEY! };
const users = new ClerkUserService(options);
const organizations = new ClerkOrganizationService(options);

await users.createUser({
  emailAddress: ["owner@example.com"],
  firstName: "Croco",
});

await organizations.createOrganization({
  name: "Croco Team",
  createdBy: "user_123",
});
```

### 4. 테넌트 매핑

```typescript
import { ClerkTenantMapper } from "@croco/auth-clerk";

const mapper = new ClerkTenantMapper();
await mapper.register("org_123", "tenant_123");
const tenantId = await mapper.resolve("org_123");
```

Custom `TenantMappingStore` adapters must implement `claim()` with a database uniqueness constraint
or compare-and-set operation. The absence check and insert must be atomic across processes; `set()`
is no longer part of the store contract. Run `createTenantMappingStoreConformanceSuite()` with two
separate clients that share one backing namespace before using an adapter in production.

### 5. 웹훅 처리

```typescript
import { ClerkWebhookHandler } from "@croco/auth-clerk";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";

const handler = new ClerkWebhookHandler(
  {
    signingSecret: process.env.CLERK_WEBHOOK_SECRET!,
    idempotencyStore: new InMemoryIdempotencyStore(),
  },
  {
    "user.created": async (event) => {
      await syncUser(event.id);
    },
  },
);

await handler.handleWebhook(request);
```

운영 환경에서는 모든 worker가 공유하는 durable `IdempotencyStore`를 전달해야 합니다. 핸들러는
서명 검증을 통과한 `svix-id`만 예약하며, 완료된 delivery의 결과를 저장한 뒤에만 이후 재전달을
중복으로 승인합니다. 처리 중인 중복은 retryable `auth-clerk/webhook-delivery-in-flight` Problem으로
실패하므로 Clerk가 완료 결과를 다시 확인할 수 있습니다. 예약과 완료 결과는 기본 24시간 동안
유지되며, `idempotencyTtlMs`로 provider retry 정책에 맞게 조정할 수 있습니다.

## Diagnostics와 Conformance

`ClerkAuthDiagnosticsProvider`는 `CLERK_SECRET_KEY`, 선택적 `CLERK_PUBLISHABLE_KEY`,
선택적 `CLERK_WEBHOOK_SECRET` 준비 상태를 secret 값 없이 보고합니다.

```typescript
import { ClerkAuthDiagnosticsProvider } from "@croco/auth-clerk";

const diagnostics = new ClerkAuthDiagnosticsProvider({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
});
```

패키지 테스트는 `@croco/testing`의 `createAuthProviderConformanceSuite()`를 사용해 아래
계약을 기본 no-credential CI에서 검증합니다.

- 유효한 Bearer token을 `AuthUser`로 변환하고 Clerk `org_id`, `org_role`, `org_slug`,
  `sid`를 metadata로 보존합니다.
- 누락 credentials는 `null`을 반환하고, 무효 token과 malformed claim은 stable Clerk
  Problem code로 실패합니다.
- Clerk upstream 실패는 secret 값을 redaction한 `auth-clerk/token-verification-upstream-failed`
  Problem으로 정규화하고 retryable evidence를 노출합니다.
- Clerk 웹훅은 서명 성공/실패, handler가 등록된 malformed payload, user/org/membership
  이벤트 분기, 검증된 delivery ID의 중복 및 동시 처리를 검증합니다.
- `ClerkTenantMapper`는 Clerk org ID를 Croco tenant ID로 매핑하고, 미등록 org는 `null`을
  반환합니다.
- readiness diagnostics는 필수 env 이름만 노출하고 secret 값은 노출하지 않습니다.

Optional live smoke는 기본적으로 skip됩니다. 실제 Clerk token 검증을 실행하려면 아래 env를
설정합니다.

```bash
CLERK_LIVE_SMOKE=1 \
CLERK_SECRET_KEY=... \
CLERK_LIVE_SESSION_TOKEN=... \
pnpm --filter @croco/auth-clerk test
```

검증 명령:

```bash
pnpm --filter @croco/auth-clerk test
pnpm docs:catalog:check
pnpm public-api:check
```

## API 레퍼런스

| API                                     | 설명                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| `ClerkAuthDiagnosticsProvider`          | readiness와 missing config를 secret 없이 보고합니다.      |
| `ClerkAuthProvider`                     | Bearer 토큰을 검증하고 `AuthUser`를 반환합니다.           |
| `ClerkSessionProvider`                  | Clerk 세션 조회, 목록 조회, 세션 해제를 처리합니다.       |
| `ClerkUserService`                      | 사용자 조회, 생성, 수정, 삭제, 밴 관리를 제공합니다.      |
| `ClerkOrganizationService`              | 조직, 멤버십, 초대 관리를 제공합니다.                     |
| `ClerkTenantMapper`                     | Clerk 조직 ID와 Croco tenant ID를 매핑합니다.             |
| `ClerkWebhookHandler`                   | Clerk 서명을 검증하고 delivery를 한 번만 처리합니다.      |
| `WebhookVerificationProblem` 외 Problem | 토큰, 웹훅, tenant 매핑 오류를 Problem 형태로 제공합니다. |

## 공개 타입

- `ClerkAuthOptions`
- `ClerkAuthDiagnosticsConfig`, `ClerkAuthDiagnosticsOptions`
- `ClerkUser`, `CreateClerkUserInput`, `UpdateClerkUserInput`
- `ClerkOrganization`, `CreateOrganizationInput`, `CreateInvitationInput`
- `ClerkTenantRequest`, `TenantMappingClaimResult`, `TenantMappingStore`
- `createTenantMappingStoreConformanceSuite`와 관련 conformance 타입
- `WebhookHandlerOptions`, `WebhookEventHandler`, `WebhookEventType`, `ClerkWebhookDeliveryOutcome`
