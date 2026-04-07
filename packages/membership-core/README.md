# @croco/membership-core

테넌트-사용자 멤버십 관리를 위한 핵심 도메인 로직 패키지입니다. 역할 기반 접근 제어, 소유권 관리, 좌석 제한 통합을 제공합니다.

## 설치

```bash
pnpm add @croco/membership-core
```

## 핵심 기능

- 멤버십 라이프사이클 관리: 사용자 추가, 제거, 역할 변경
- 역할 계층 구조: `owner` > `admin` > `member` > `viewer`
- 소유권 보호: 마지막 소유자 제거/강등 방지
- 소유권 이전: 안전한 소유권 이전 인터페이스
- 좌석 제한 통합: entitlements-core와 연동된 좌석 관리
- 도메인 이벤트: 멤버십 변경 이벤트 발행

## 빠른 시작

```typescript
import { MembershipManager, InMemoryMembershipStore } from '@croco/membership-core';
import { Container } from '@croco/framework-context';

const store = new InMemoryMembershipStore();
const eventPublisher = Container.get(EventPublisher);

const manager = new MembershipManager(store, eventPublisher);

// 멤버 추가
const membership = await manager.addMember('tenant-123', 'user-456', 'admin');

// 역할 변경
await manager.updateRole('tenant-123', 'user-456', 'owner');

// 소유권 이전
await manager.transferOwnership('tenant-123', 'current-owner', 'new-owner');

// 멤버 제거
await manager.removeMember('tenant-123', 'user-456');
```

## 역할 계층

```
owner (4)   - 테넌트 소유자, 모든 권한
admin (3)   - 관리자, 대부분의 권한
member (2)  - 일반 멤버, 제한된 권한
viewer (1)  - 조회만 가능
```

## 소유권 보호

### 마지막 소유자 보호

- 마지막 소유자는 제거할 수 없음 (`LastOwnerCannotBeRemovedProblem`)
- 마지막 소유자의 권한을 변경하려면 먼저 소유권 이전 필요 (`OwnershipTransferRequiredProblem`)

### 소유권 이전

```typescript
// 소유권을 다른 멤버에게 이전
await manager.transferOwnership('tenant-123', 'current-owner-id', 'new-owner-id');

// 결과:
// - 기존 소유자는 'admin'으로 강등
// - 새 소유자는 'owner'로 승격
// - 두 이벤트(MembershipUpdatedEvent) 발행
```

## 좌석 제한 통합

entitlements-core의 좌석 체커를 주입하여 좌석 제한을 적용할 수 있습니다.

```typescript
import type { SeatLimitChecker } from '@croco/membership-core';
import type { EntitlementQuotaStatus } from '@croco/entitlements-core';

const seatLimitChecker: SeatLimitChecker = {
  async checkSeatAvailability(tenantId: string): Promise<EntitlementQuotaStatus> {
    // quota 체크 로직
    return { usage: 5, quota: 10, exceeded: false, remaining: 5 };
  },
  async getCurrentMemberCount(tenantId: string): Promise<number> {
    return 5;
  },
  async getMaxSeats(tenantId: string): Promise<number> {
    return 10;
  },
};

const manager = new MembershipManager(store, eventPublisher, seatLimitChecker);

// 좌석 초과 시 SeatLimitExceededProblem 발생
await manager.addMember('tenant-123', 'new-user', 'member');
```

## 문제 타입

| 문제 | 설명 |
|------|------|
| `MembershipNotFoundProblem` | 멤버십을 찾을 수 없음 |
| `AlreadyMemberProblem` | 이미 멤버인 사용자 |
| `InvalidRoleProblem` | 유효하지 않은 역할 |
| `LastOwnerCannotBeRemovedProblem` | 마지막 소유자 제거 시도 |
| `OwnershipTransferRequiredProblem` | 소유권 이전 필요 |
| `RoleHierarchyViolationProblem` | 역할 계층 위반 |
| `SeatLimitExceededProblem` | 좌석 제한 초과 |

## 도메인 이벤트

- `MembershipCreatedEvent` - 멤버 추가 시 발행
- `MembershipUpdatedEvent` - 역할 변경 시 발행
- `MembershipRemovedEvent` - 멤버 제거 시 발행

## 저장소 인터페이스

```typescript
abstract class MembershipStore {
  abstract findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null>;
  abstract findAllByTenant(tenantId: string): Promise<Membership[]>;
  abstract findAllByUser(userId: string): Promise<Membership[]>;
  abstract save(input: MembershipCreateInput): Promise<Membership>;
  abstract delete(tenantId: string, userId: string): Promise<void>;
  abstract countByRole(tenantId: string, role: MembershipRole): Promise<number>;
  abstract countAll(tenantId: string): Promise<number>;
}
```

## 테스트

```bash
pnpm test --filter=@croco/membership-core
```
