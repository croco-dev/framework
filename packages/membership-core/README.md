# @croco/membership-core

테넌트 멤버십, 역할 계층, 소유권 보호, 좌석 제한을 다루는 멤버십 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/membership-core
```

## 사용법

```ts
import { InMemoryMembershipStore, MembershipManager } from "@croco/membership-core";

const store = new InMemoryMembershipStore();
const manager = new MembershipManager(store, eventPublisher, seatLimitChecker);

await manager.addMember("tenant-123", "user-1", "admin");
await manager.updateRole("tenant-123", "user-1", "owner");
await manager.transferOwnership("tenant-123", "user-1", "user-2");
```

## API 레퍼런스

### 핵심 클래스

- `MembershipManager`, 멤버 추가, 제거, 역할 변경, 소유권 이전을 담당합니다.
- `MembershipService`, 동일한 도메인 기능을 서비스 형태로 제공합니다.
- `MembershipOwnerGuard`, 마지막 소유자 제거와 강등을 막습니다.
- `InMemoryMembershipStore`, 테스트용 저장소 구현체입니다.

### 저장소와 확장 포인트

- `MembershipStore`, 영속 저장소 계약입니다.
- `SeatLimitChecker`, entitlements 기반 좌석 제한 계약입니다.
- `AbstractMembershipManager`, invitation 같은 상위 패키지가 의존하는 추상 계약입니다.

### 주요 타입과 유틸리티

- `Membership`, `MembershipCreateInput`, `MembershipUpdateInput`, `MembershipRole`
- `ROLE_HIERARCHY`, `VALID_MEMBERSHIP_ROLES`
- `isMembershipRole`, `isHigherRole`, `isLowerRole`, `canPromote`, `canDemote`

### 이벤트와 문제 타입

- 이벤트: `MembershipCreatedEvent`, `MembershipUpdatedEvent`, `MembershipRemovedEvent`
- 문제 타입: `MembershipNotFoundProblem`, `AlreadyMemberProblem`, `InvalidRoleProblem`, `OwnershipTransferRequiredProblem`, `SeatLimitExceededProblem`, `LastOwnerCannotBeRemovedProblem`

## 구현 포인트

- 역할 계층은 `owner > admin > member > viewer` 순서입니다.
- 마지막 소유자는 제거하거나 바로 강등할 수 없습니다.
- `SeatLimitChecker`를 주입하면 플랜별 좌석 수를 강제할 수 있습니다.
