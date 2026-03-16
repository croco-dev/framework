/**
 * @packageDocumentation
 *
 * @croco/membership-core
 *
 * 테넌트-사용자 멤버십 관리를 위한 핵심 도메인 로직입니다.
 *
 * @feature 멤버십 라이프사이클 관리 - 사용자 추가, 제거, 역할 변경
 * @feature 역할 기반 접근 제어 - owner, admin, member, viewer 계층 구조
 * @feature 도메인 이벤트 - 멤버십 변경 이벤트 발행
 * @feature 저장소 추상화 - MembershipStore 인터페이스로 다양한 저장소 지원
 *
 * @example 기본 사용법
 * ```typescript
 * import { MembershipService, InMemoryMembershipStore } from '@croco/membership-core';
 *
 * const store = new InMemoryMembershipStore();
 * const service = new MembershipService(store, eventPublisher);
 *
 * // 멤버 추가
 * const membership = await service.addMember('tenant-123', 'user-456', 'admin');
 *
 * // 역할 변경
 * await service.updateRole('tenant-123', 'user-456', 'owner');
 *
 * // 멤버 제거
 * await service.removeMember('tenant-123', 'user-456');
 * ```
 *
 * @description 이 패키지는 다음을 제공합니다:
 * - {@link MembershipService}: 멤버십 관리 서비스
 * - {@link MembershipStore}: 저장소 인터페이스
 * - {@link InMemoryMembershipStore}: 인메모리 저장소 구현체
 * - 도메인 이벤트: {@link MembershipCreatedEvent}, {@link MembershipRemovedEvent}, {@link MembershipUpdatedEvent}
 * - 문제 타입: {@link MembershipNotFoundProblem}, {@link AlreadyMemberProblem}, {@link LastOwnerProblem}
 */

/**
 * 멤버십 생성 도메인 이벤트
 *
 * @description 사용자가 테넌트에 멤버로 추가될 때 발행하는 이벤트입니다.
 *
 * @example 이벤트 핸들러 등록
 * ```typescript
 * @RegisterEventHandler(MembershipCreatedEvent)
 * class Handler implements EventHandler<MembershipCreatedEvent> {
 *   async handle(event: MembershipCreatedEvent) {
 *     console.log(`User ${event.data.userId} added to ${event.data.tenantId}`);
 *   }
 * }
 * ```
 */
export { MembershipCreatedEvent } from './libs/events/MembershipCreatedEvent';

/**
 * 멤버십 제거 도메인 이벤트
 *
 * @description 사용자가 테넌트에서 제거될 때 발행하는 이벤트입니다.
 *
 * @example 이벤트 핸들러 등록
 * ```typescript
 * @RegisterEventHandler(MembershipRemovedEvent)
 * class Handler implements EventHandler<MembershipRemovedEvent> {
 *   async handle(event: MembershipRemovedEvent) {
 *     console.log(`User ${event.data.userId} removed from ${event.data.tenantId}`);
 *   }
 * }
 * ```
 */
export { MembershipRemovedEvent } from './libs/events/MembershipRemovedEvent';

/**
 * 멤버십 역할 업데이트 도메인 이벤트
 *
 * @description 멤버의 역할이 변경될 때 발행하는 이벤트입니다.
 *
 * @example 이벤트 핸들러 등록
 * ```typescript
 * @RegisterEventHandler(MembershipUpdatedEvent)
 * class Handler implements EventHandler<MembershipUpdatedEvent> {
 *   async handle(event: MembershipUpdatedEvent) {
 *     console.log(`Role changed from ${event.data.oldRole} to ${event.data.newRole}`);
 *   }
 * }
 * ```
 */
export { MembershipUpdatedEvent } from './libs/events/MembershipUpdatedEvent';

/**
 * 인메모리 멤버십 저장소 구현체
 *
 * @description {@link MembershipStore} 인터페이스의 인메모리 구현체입니다. 테스트 및 프로토타이핑에 적합합니다.
 *
 * @example 저장소 생성 및 사용
 * ```typescript
 * import { InMemoryMembershipStore } from '@croco/membership-core';
 *
 * const store = new InMemoryMembershipStore();
 * const membership = await store.save({
 *   id: 'mem-1',
 *   tenantId: 'tenant-1',
 *   userId: 'user-1',
 *   role: 'admin'
 * });
 * ```
 */
export { InMemoryMembershipStore } from './libs/InMemoryMembershipStore';

/**
 * 멤버십 관리자
 *
 * @description 멤버십 라이프사이클을 관리하는 서비스입니다. 내장된 owner invariant 체크를 통해 마지막 소유자가 제거되지 않도록 보호합니다.
 *
 * @example 서비스 사용
 * ```typescript
 * const manager = new MembershipManager(store, eventPublisher, logger);
 *
 * // 멤버 추가
 * await manager.addMember('tenant-123', 'user-456', 'admin');
 *
 * // 역할 변경
 * await manager.updateRole('tenant-123', 'user-456', 'owner');
 *
 * // 멤버 제거
 * await manager.removeMember('tenant-123', 'user-456');
 * ```
 */
export { MembershipManager } from './libs/MembershipManager';

/**
 * 멤버십 소유자 변경 가드
 *
 * @description 소유자 역할 변경/제거 시 제약 조건을 검증하는 가드 클래스입니다. 마지막 소유자가 제거되거나 강등되지 않도록 보호합니다.
 *
 * @example 가드 사용
 * ```typescript
 * const guard = new MembershipOwnerGuard(store);
 *
 * await guard.validateOwnerMutation({
 *   tenantId: 'tenant-1',
 *   userId: 'user-1',
 *   currentRole: 'owner',
 *   operation: 'remove'
 * });
 * ```
 */
export { MembershipOwnerGuard } from './libs/MembershipOwnerGuard';

/**
 * 멤버십 서비스
 *
 * @description 멤버십 라이프사이클을 관리하는 서비스입니다. {@link MembershipOwnerGuard}를 사용하여 소유자 제약 조건을 검증합니다.
 *
 * @example 서비스 사용
 * ```typescript
 * const service = new MembershipService(store, eventPublisher);
 *
 * // 멤버 추가
 * await service.addMember('tenant-123', 'user-456', 'admin');
 *
 * // 역할 변경
 * await service.updateRole('tenant-123', 'user-456', 'owner');
 *
 * // 멤버 제거
 * await service.removeMember('tenant-123', 'user-456');
 * ```
 */
export { MembershipService } from './libs/MembershipService';

/**
 * 멤버십 저장소 인터페이스
 *
 * @description 멤버십 데이터 영속성을 위한 추상 인터페이스입니다. 데이터베이스, 인메모리 저장소 등 다양한 구현체가 가능합니다.
 *
 * @example 커스텀 저장소 구현
 * ```typescript
 * class PostgresMembershipStore extends MembershipStore {
 *   async findByTenantAndUser(tenantId: string, userId: string) {
 *     // DB 조회 로직
 *   }
 *   // 다른 메서드 구현...
 * }
 * ```
 */
export { MembershipStore } from './libs/MembershipStore';

/**
 * 마지막 소유자 제거 불가 문제
 *
 * @description 테넌트의 마지막 소유자를 제거하려 할 때 발생하는 문제입니다.
 *
 * @example 에러 처리
 * ```typescript
 * try {
 *   await service.removeMember('tenant-1', 'last-owner');
 * } catch (err) {
 *   if (err instanceof LastOwnerCannotBeRemovedProblem) {
 *     console.log('Cannot remove last owner');
 *   }
 * }
 * ```
 */
export { LastOwnerCannotBeRemovedProblem } from './libs/problems/LastOwnerCannotBeRemovedProblem';

/**
 * 멤버십 제약 조건 문제
 *
 * @description 멤버십 제약 조건 위반 시 발생하는 기본 문제 클래스입니다.
 *
 * @example 에러 처리
 * ```typescript
 * try {
 *   await service.removeMember('tenant-1', 'last-owner');
 * } catch (err) {
 *   if (err instanceof MembershipConstraintProblem) {
 *     console.log('Membership constraint violated');
 *   }
 * }
 * ```
 */
export { MembershipConstraintProblem } from './libs/problems/MembershipConstraintProblem';
/**
 * 이미 멤버임 문제
 *
 * @description 사용자가 이미 테넌트의 멤버일 때 발생하는 문제입니다.
 */
/**
 * 유효하지 않은 역할 문제
 *
 * @description 유효하지 않은 멤버십 역할을 사용하려 할 때 발생하는 문제입니다. 유효한 역할: owner, admin, member, viewer
 */
/**
 * 마지막 소유자 문제
 *
 * @description 테넌트의 마지막 소유자를 제거하거나 강등하려 할 때 발생하는 문제입니다.
 */
/**
 * 멤버십을 찾을 수 없음 문제
 *
 * @description 지정된 테넌트-사용자 조합에 대한 멤버십을 찾을 수 없을 때 발생하는 문제입니다.
 */
export {
  AlreadyMemberProblem,
  InvalidRoleProblem,
  LastOwnerProblem,
  MembershipNotFoundProblem,
} from './libs/problems/MembershipProblems';

/**
 * 멤버십 타입
 *
 * @description 멤버십 관련 타입들을 내보냅니다.
 *
 * @see {@link MembershipRole} - 멤버십 역할 타입 (owner | admin | member | viewer)
 * @see {@link Membership} - 멤버십 엔티티 타입
 * @see {@link MembershipCreateInput} - 멤버십 생성 입력 타입
 * @see {@link MembershipUpdateInput} - 멤버십 업데이트 입력 타입
 */
export type * from './libs/types';
