/**
 * @packageDocumentation
 *
 * Invitation and domain policy management for tenant onboarding.
 *
 * @description
 * This package provides domain-driven components for managing user invitations and domain-based auto-join policies.
 * It supports both email and link-based invitations with configurable expiration, role assignment, and status tracking.
 *
 * @remarks
 * - Invitations are token-based and hashed for security
 * - Domain policies enable automatic membership provisioning based on email domain
 * - Events are published for all state changes (created, accepted, declined, revoked)
 * - Public email domains (gmail.com, yahoo.com, etc.) are denylisted for auto-join
 *
 * @example
 * ```typescript
 * import { InvitationManager, InvitationStore, InMemoryInvitationStore } from '@croco/invitation-core';
 *
 * const store = new InMemoryInvitationStore();
 * const manager = new InvitationManager(store, membershipManager, notificationService, eventPublisher);
 *
 * // Create email invitation
 * const token = await manager.createEmailInvitation({
 *   tenantId: 'tenant-1',
 *   inviterId: 'user-1',
 *   email: 'user@example.com',
 *   role: 'member',
 *   expiresInDays: 7,
 * });
 *
 * // Accept invitation
 * const invitation = await manager.acceptInvitation({
 *   token,
 *   userId: 'user-2',
 *   email: 'user@example.com',
 * });
 * ```
 *
 * @see {@link https://github.com/croco-dev/croco}
 */

/**
 * Domain policy manager for auto-join functionality.
 *
 * @description
 * Manages domain-based policies that automatically grant membership to users
 * with matching email domains. Useful for enterprise scenarios where all employees
 * with a company email should get automatic access.
 *
 * @example
 * ```typescript
 * await domainPolicyManager.addDomainPolicy('tenant-1', 'acme.com', 'member');
 *
 * // User with 'user@acme.com' email will auto-join as 'member'
 * const membership = await domainPolicyManager.tryAutoJoin(
 *   'tenant-1',
 *   'user-123',
 *   'user@acme.com'
 * );
 * ```
 */
export { DomainPolicyManager } from './libs/DomainPolicyManager';

/**
 * Store interface for domain policy persistence.
 *
 * @description
 * Abstract interface for persisting and retrieving domain policies.
 * Implementations include InMemoryDomainPolicyStore for testing
 * and database-backed stores for production.
 *
 * @example
 * ```typescript
 * class MyDomainPolicyStore implements DomainPolicyStore {
 *   async save(policy) { /* DB implementation *\/ }
 *   async findByTenantAndDomain(tenantId, domain) { /* ... *\/ }
 *   // ... other methods
 * }
 * ```
 */
export { DomainPolicyStore } from './libs/DomainPolicyStore';

/**
 * Domain policy domain events.
 *
 * @description
 * Events emitted when domain policies are modified or when auto-join occurs.
 * These events can be handled to trigger side effects like audit logging
 * or notification delivery.
 */
export {
  DomainAutoJoinedEvent,
  DomainPolicyAddedEvent,
  DomainPolicyRemovedEvent,
} from './libs/events/DomainPolicyEvents';

/**
 * Invitation domain events.
 *
 * @description
 * Events emitted during the invitation lifecycle. These events enable
 * event-driven architecture patterns where invitations trigger workflows
 * like welcome emails, audit trails, or analytics.
 *
 * @example
 * ```typescript
 * @RegisterEventHandler(InvitationAcceptedEvent)
 * class SendWelcomeEmail implements EventHandler<InvitationAcceptedEvent> {
 *   async handle(event) {
 *     await this.emailService.send(event.email, 'Welcome!');
 *   }
 * }
 * ```
 */
export {
  InvitationAcceptedEvent,
  InvitationCreatedEvent,
  InvitationDeclinedEvent,
  InvitationRevokedEvent,
} from './libs/events/InvitationEvents';

/**
 * In-memory implementation of domain policy store.
 *
 * @description
 * An ephemeral store implementation suitable for testing and development.
 * Data is stored in memory and lost on process restart.
 *
 * @example
 * ```typescript
 * const store = new InMemoryDomainPolicyStore();
 * await store.save({ id: '1', tenantId: 't1', domain: 'acme.com', role: 'member', enabled: true, createdAt: new Date() });
 * ```
 */
export { InMemoryDomainPolicyStore } from './libs/InMemoryDomainPolicyStore';

/**
 * In-memory implementation of invitation store.
 *
 * @description
 * An ephemeral store implementation suitable for testing and development.
 * Data is stored in memory and lost on process restart.
 *
 * @example
 * ```typescript
 * const store = new InMemoryInvitationStore();
 * await store.save({ id: '1', tenantId: 't1', email: 'user@example.com', role: 'member', status: 'pending', /* ... *\/ });
 * ```
 */
export { InMemoryInvitationStore } from './libs/InMemoryInvitationStore';

/**
 * Input types for invitation operations.
 *
 * @description
 * Type definitions for inputs to InvitationManager methods.
 * These provide type safety for invitation creation and acceptance.
 */
export type {
  AcceptInvitationInput,
  CreateEmailInvitationInput,
  CreateLinkInvitationInput,
} from './libs/InvitationManager';

/**
 * Core invitation manager service.
 *
 * @description
 * Orchestrates invitation lifecycle: creation, acceptance, decline, and revocation.
 * Integrates with stores, membership manager, notification service, and event publisher.
 *
 * @example
 * ```typescript
 * const manager = new InvitationManager(
 *   store,
 *   membershipManager,
 *   notificationService,
 *   eventPublisher
 * );
 *
 * const token = await manager.createEmailInvitation({
 *   tenantId: 'tenant-1',
 *   inviterId: 'user-1',
 *   email: 'user@example.com',
 *   role: 'member',
 * });
 * ```
 */
export { InvitationManager } from './libs/InvitationManager';

/**
 * Store interface for invitation persistence.
 *
 * @description
 * Abstract interface for persisting and retrieving invitations.
 * Implementations include InMemoryInvitationStore for testing
 * and database-backed stores for production.
 */
export { InvitationStore } from './libs/InvitationStore';

/**
 * Domain policy problem types.
 *
 * @description
 * RFC 7807 Problem Details for domain policy errors.
 * Thrown when domain policy validation fails.
 *
 * @example
 * ```typescript
 * try {
 *   await domainPolicyManager.addDomainPolicy('t1', 'gmail.com', 'member');
 * } catch (e) {
 *   if (e instanceof PublicEmailDomainNotAllowedProblem) {
 *     console.log('Public email domains are not allowed');
 *   }
 * }
 * ```
 */
export { InvalidAutoJoinRoleProblem, PublicEmailDomainNotAllowedProblem } from './libs/problems/DomainPolicyProblems';

/**
 * Invitation problem types.
 *
 * @description
 * RFC 7807 Problem Details for invitation-related errors.
 * Thrown when invitation operations fail due to invalid state, expiration, or not found.
 *
 * @example
 * ```typescript
 * try {
 *   await manager.acceptInvitation({ token, userId: 'u1' });
 * } catch (e) {
 *   if (e instanceof InvitationExpiredProblem) {
 *     console.log('This invitation has expired');
 *   }
 * }
 * ```
 */
export {
  InvitationAlreadyAcceptedProblem,
  InvitationEmailMismatchProblem,
  InvitationExpiredProblem,
  InvitationInvalidStatusProblem,
  InvitationNotFoundProblem,
} from './libs/problems/InvitationProblems';

/**
 * Token generation and hashing utilities.
 *
 * @description
 * Cryptographic utilities for secure invitation token handling.
 * Tokens are generated randomly and hashed before storage.
 *
 * @example
 * ```typescript
 * const token = generateToken(); // 'a1b2c3d4...'
 * const hash = hashToken(token);   // SHA-256 hash for storage
 * ```
 */
export { generateToken, hashToken } from './libs/token';

/**
 * Core domain types.
 *
 * @description
 * Type definitions for invitations and domain policies.
 * Includes entity types, enums, and input types.
 */
export type {
  DomainPolicy,
  DomainPolicyCreateInput,
  Invitation,
  InvitationCreateInput,
  InvitationStatus,
  InvitationType,
} from './libs/types';

/**
 * Public email domain denylist.
 *
 * @description
 * List of public email domains that are not allowed for domain policy auto-join.
 * Prevents accidental auto-join for generic email providers.
 *
 * @example
 * ```typescript
 * import { PUBLIC_EMAIL_DOMAINS } from '@croco/invitation-core';
 *
 * if (PUBLIC_EMAIL_DOMAINS.includes(extractedDomain)) {
 *   throw new Error('Public email domains not allowed');
 * }
 * ```
 */
export { PUBLIC_EMAIL_DOMAINS } from './libs/types';
