# @croco/auth-clerk

Clerk Backend SDK를 Croco 인증, 세션, 조직 API에 연결하는 패키지입니다.

## Workers authentication subset

`@croco/auth-clerk/workers`는 alpha 인증 subset입니다. `clerkWorkersAuth()`를 application imports에
조합하고 `AUTH_PROVIDER_TOKEN`으로 사용합니다. Worker의 `CLERK_SECRET_KEY` secret binding을
factory에 직접 전달하며 `process.env`나 전역 singleton에 보관하지 않습니다.

```typescript
import {
  clerkWorkersAuth,
  ClerkTenantMapper,
  type TenantMappingStore,
} from "@croco/auth-clerk/workers";

// env는 Worker fetch의 binding, store는 애플리케이션의 내구 tenant mapping입니다.
export function createWorkerAuth(
  env: { CLERK_SECRET_KEY: string },
  store: TenantMappingStore,
  resolveTargetTenant: (request: Request) => Promise<string | null>,
) {
  return clerkWorkersAuth({
    secretKey: env.CLERK_SECRET_KEY,
    audience: "croco-api",
    authorizedParties: ["https://console.example.com"],
    tenantMapping: new ClerkTenantMapper(store),
    resolveTargetTenant,
  });
}
```

실제 workerd의 `nodejs_compat` 환경에서 SDK의 browser Web Crypto 조건으로 검증합니다.
Node crypto polyfill을 Clerk SDK에 주입하지 않습니다. Bearer 또는 `__session` cookie를 검증하고,
매 인증마다 Clerk session API로 active 상태·사용자·만료를 확인합니다. `ClerkSessionProvider.revokeSession()`
후 upstream이 revoked 상태를 반환하면 아직 서명이 유효한 JWT도 거부합니다. 이 조회는 매 요청의
외부 의존성이며 upstream 장애는 실패로 반환합니다. JWT 공개키를 `jwtKey`로 선택해도 session 조회는 필요합니다.

쿠키 요청의 Origin은 허용 목록과 일치해야 하며, 쓰기 요청은 Origin이 필수입니다. Authorization이 있으면
쿠키로 fallback하지 않습니다. host는 적절한 cookie 속성, 응답 cache 정책과 route authorization을 소유합니다.
검증된 조직을 기존 `TenantMappingProvider`로 매핑하고 서버가 결정한 target tenant와 다르면 거부합니다.
tenant 기능은 선택 사항이며 target resolver 사용 시 mapping이 필수입니다. 사용자·permission·request scope는
요청 사이에 저장하지 않습니다. role/permission 변경은 서명된 JWT의 수명 동안 남을 수 있습니다.

검증 범위는 synthetic key와 synthetic Clerk HTTP 응답을 쓰는 실제 workerd request fixture입니다.
만료·잘못된 서명·audience/party·tenant mismatch·동시 요청·revoke·장애·redaction과 기존 auth conformance를
`pnpm --filter @croco/auth-clerk test`로 확인합니다. 실서비스 credential, 배포 인증, npm 출시는 미검증입니다.

Workers entry는 webhook handler와 user/organization 관리 API를 export하지 않습니다. 기존 Node/Lambda
webhook 검증·lease-aware 중복 처리 경로를 유지하며, Workers용 webhook 보장은 선언하지 않습니다.
`saas-cloudflare`의 generated profile은 `createGeneratedWorkersAuthPlugin`과 검증 범위를 노출하지만
full SaaS composition은 #3537의 별도 통합 전까지 `documentation-only`로 유지합니다.

## 설치

```bash
pnpm add @croco/auth-clerk @croco/idempotency-core @clerk/backend
```

## 사용법

### Canonical module plugin

새 애플리케이션은 `clerkAuth()`를 `defineCrocoApplication()`의 import로 전달합니다. 이 factory는
`AUTH_PROVIDER_TOKEN`의 단일 소유권과 `diagnostics.provider` contribution을 같은 module graph에
등록합니다. 다른 auth plugin으로 교체할 때는 application-level provider replacement를 명시해야 합니다.

```typescript
import { clerkAuth } from "@croco/auth-clerk";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";

const application = defineCrocoApplication({
  imports: [
    clerkAuth({
      secretKey: process.env.CLERK_SECRET_KEY!,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
    }),
  ],
});

const runtime = createApplicationRuntime(application);
await runtime.initialize();
```

기존 `new ClerkAuthProvider(...)` 직접 생성 경로는 호환성을 위해 유지됩니다. canonical application
graph를 사용하는 애플리케이션에서는 plugin factory를 사용해야 provider ownership, diagnostics metadata,
중복 검증이 startup 전에 일관되게 적용됩니다.

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

사용자, 조직, 멤버십, 초대, 세션의 모든 Clerk SDK 실패는
`auth-clerk/external-service-error` Problem으로 정규화됩니다. `extensions`에는 안전한
`provider`, `operation`, `retryable`, 선택적 `upstreamStatus`만 포함되며 SDK 요청, credential,
원본 오류 메시지는 노출하지 않습니다. 단일 리소스 조회의 not-found는 계속 `null`을 반환하고,
목록과 mutation의 실패는 Problem으로 전달합니다. 패키지는 자동 retry를 수행하지 않습니다.

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
실패하므로 Clerk가 완료 결과를 다시 확인할 수 있습니다. 처리 예약은 기본 15분 뒤 만료되어
중단된 worker의 delivery를 재시도할 수 있으며, `processingLeaseMs`로 조정합니다. 완료 결과는
완료 시점부터 기본 24시간 동안 유지되며, `idempotencyTtlMs`로 provider retry 정책에 맞게
조정할 수 있습니다. 처리 lease는 자동 연장되지 않으므로 예상 최대 처리 시간보다 길게 설정해야 합니다.
Lease 만료 후에는 이전 worker도 계속 실행 중일 수 있으므로 mutation 자체의 중복 방지도 필요합니다.
Durable 저장소는 `leaseMs`를 결과 보존 기간과 독립적으로 구현하고 conformance suite를 통과한 뒤
`processingLeaseVersion: 1`을 선언해야 합니다. 선언하지 않은 저장소는 handler 구성 시 거부됩니다.

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

- 유효한 Bearer token을 `AuthUser`로 변환합니다. v1의 `org_id`, `org_role`,
  `org_slug`와 v2의 `o.id`, `o.rol`, `o.slg`를 같은 조직 metadata로 보존하고,
  `sid`를 세션 ID로 보존합니다. v2의 `o.rol`에는 `org:` 접두사를 붙이며,
  조직 권한은 `fea`의 조직 feature와 `o.per`, `o.fpm` 비트맵에서 복원합니다.
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
