# @croco/invitation-core

이메일 초대, 링크 초대, 도메인 자동 가입, 스팸 방지를 제공하는 초대 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/invitation-core
```

## 사용법

```ts
import { InMemoryInvitationStore, InvitationManager } from "@croco/invitation-core";

const store = new InMemoryInvitationStore();
const manager = new InvitationManager(
  store,
  membershipManager,
  notificationService,
  eventPublisher,
);

const token = await manager.createEmailInvitation({
  tenantId: "tenant-123",
  inviterId: "user-1",
  email: "new-user@example.com",
  role: "member",
});

await manager.acceptInvitation({ token, userId: "user-2", email: "new-user@example.com" });
```

```ts
import { DomainPolicyManager, InMemoryDomainPolicyStore } from "@croco/invitation-core";

const domainPolicyManager = new DomainPolicyManager(domainStore, membershipManager, eventPublisher);

await domainPolicyManager.addDomainPolicy("tenant-123", "acme.com", "member");
await domainPolicyManager.tryAutoJoin("tenant-123", "user-3", "user@acme.com");
```

## API 레퍼런스

### 핵심 클래스

- `InvitationManager`, 초대 생성, 수락, 거절, 취소, 재전송을 담당합니다.
- `RateLimitedInvitationService`, 초대 rate limit과 batch invite를 제공합니다.
- `DomainPolicyManager`, 이메일 도메인 기반 자동 가입 정책을 관리합니다.
- `InMemoryInvitationStore`, `InMemoryDomainPolicyStore`, 테스트용 저장소 구현체입니다.

### 저장소와 유틸리티

- `InvitationStore`, `DomainPolicyStore`, 영속 저장소 계약입니다.
- `generateToken`, `hashToken`, 안전한 초대 토큰 유틸리티입니다.
- `PUBLIC_EMAIL_DOMAINS`, 자동 가입에서 제외할 공개 이메일 도메인 목록입니다.

### 주요 타입

- `CreateEmailInvitationInput`, `CreateLinkInvitationInput`, `AcceptInvitationInput`
- `Invitation`, `InvitationCreateInput`, `InvitationStatus`, `InvitationType`
- `BatchInviteOptions`, `BatchInviteResult`, `RateLimitConfig`, `DomainPolicy`

### 이벤트와 문제 타입

- 이벤트: `InvitationCreatedEvent`, `InvitationAcceptedEvent`, `InvitationDeclinedEvent`, `InvitationRevokedEvent`, `DomainPolicyAddedEvent`, `DomainAutoJoinedEvent`
- 문제 타입: `InvitationNotFoundProblem`, `InvitationExpiredProblem`, `InvitationEmailMismatchProblem`, `InvitationRateLimitExceededProblem`, `DuplicateInvitationProblem`, `PublicEmailDomainNotAllowedProblem`

## 구현 포인트

- 이메일 초대는 토큰을 해시해 저장하고, 링크 초대는 이메일 없이 공유할 수 있습니다.
- 도메인 정책은 회사 이메일 사용자를 자동으로 멤버십에 연결할 때 유용합니다.
- 도메인 자동 가입은 정확히 하나의 `@`와 공백 없는 로컬·도메인 구간을 요구합니다. 국제화 도메인은
  punycode로 자동 변환하지 않으므로 정책과 이메일에 같은 유니코드 또는 ASCII 표기를 사용해야 합니다.
- batch invite는 성공과 실패를 분리해 반환합니다.
