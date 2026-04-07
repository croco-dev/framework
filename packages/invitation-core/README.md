# @croco/invitation-core

Tenant onboarding invitation system with spam prevention and batch operations.

## Features

- **Email & Link Invitations**: Create time-limited invitations with configurable roles
- **Domain Policies**: Auto-join users with specific email domains
- **Spam Prevention**: Rate limiting and duplicate detection
- **Batch Operations**: Invite multiple users at once with granular error handling
- **Type-Safe Tokens**: Branded token types for compile-time security
- **Event-Driven**: Domain events for all state changes
- **RFC 7807 Errors**: Structured problem details for all error scenarios

## Installation

```bash
pnpm add @croco/invitation-core
```

## Quick Start

### Basic Email Invitation

```typescript
import { InvitationManager, InMemoryInvitationStore } from '@croco/invitation-core';
import { MembershipManager } from '@croco/membership-core';
import { NotificationService } from '@croco/notifications-core';
import { EventPublisher } from '@croco/events-core';

const store = new InMemoryInvitationStore();
const manager = new InvitationManager(
  store,
  membershipManager,
  notificationService,
  eventPublisher
);

const token = await manager.createEmailInvitation({
  tenantId: 'tenant-123',
  inviterId: 'user-456',
  email: 'new-user@example.com',
  role: 'member',
  expiresInDays: 7,
});
```

### Accept Invitation

```typescript
const invitation = await manager.acceptInvitation({
  token,
  userId: 'user-789',
  email: 'new-user@example.com',
});
```

### Rate-Limited Invitations

```typescript
import {
  RateLimitedInvitationService,
  InMemoryPendingInvitationStore,
} from '@croco/invitation-core';

const pendingStore = new InMemoryPendingInvitationStore();
const rateLimitedService = new RateLimitedInvitationService(
  manager,
  pendingStore,
  {
    maxInvitesPerHour: 100,
    maxInvitesPerDay: 1000,
  }
);

await rateLimitedService.createEmailInvitationWithRateLimit({
  tenantId: 'tenant-123',
  inviterId: 'user-456',
  email: 'new-user@example.com',
  role: 'member',
});
```

### Batch Invitations

```typescript
const result = await rateLimitedService.batchInvite(
  'tenant-123',
  ['user1@example.com', 'user2@example.com', 'user3@example.com'],
  {
    expiresInDays: 7,
    maxBatchSize: 50,
  }
);

result.successful.forEach(({ email, token }) => {
  console.log(`Invited ${email}: ${token}`);
});

result.failed.forEach(({ email, error }) => {
  console.error(`Failed to invite ${email}: ${error}`);
});
```

## API Reference

### InvitationManager

Main service for managing invitation lifecycle.

#### Methods

- `createEmailInvitation(input)`: Create an email-based invitation
- `createLinkInvitation(input)`: Create a shareable link invitation
- `acceptInvitation(input)`: Accept an invitation and create membership
- `declineInvitation(token)`: Decline a pending invitation
- `revokeInvitation(invitationId)`: Revoke an invitation
- `resendInvitation(invitationId)`: Resend an invitation with a new token

### RateLimitedInvitationService

Rate-limited invitation service with spam prevention.

#### Methods

- `createEmailInvitationWithRateLimit(input)`: Create email invitation with rate limiting
- `createLinkInvitationWithRateLimit(input)`: Create link invitation with rate limiting
- `batchInvite(tenantId, emails, options)`: Invite multiple users at once
- `checkRateLimit(tenantId)`: Check if tenant is within rate limits

### Token Utilities

- `generateToken()`: Generate a cryptographically secure 64-byte hex token
- `hashToken(token)`: Hash a token using SHA-256
- `assertToken(value)`: Validate and cast a string to Token type

## Types

### Token & TokenHash

Branded types for type-safe token handling:

```typescript
type Token = string & { readonly __brand: unique symbol };
type TokenHash = string & { readonly __brand: unique symbol };
```

### BatchInviteResult

Result of batch invitation operation:

```typescript
type BatchInviteResult = {
  successful: Array<{
    email: string;
    token: Token;
  }>;
  failed: Array<{
    email: string;
    error: string;
  }>;
};
```

### RateLimitConfig

Configuration for rate limiting:

```typescript
type RateLimitConfig = {
  maxInvitesPerHour: number;
  maxInvitesPerDay: number;
};
```

## Error Handling

All errors extend RFC 7807 Problem Details:

- `InvitationNotFoundProblem`: Invitation not found
- `InvitationExpiredProblem`: Invitation has expired
- `InvitationAlreadyAcceptedProblem`: Invitation already accepted
- `InvitationEmailMismatchProblem`: Email does not match
- `InvitationInvalidStatusProblem`: Invalid operation for current status
- `InvitationRateLimitExceededProblem`: Rate limit exceeded
- `DuplicateInvitationProblem`: Invitation already pending

```typescript
try {
  await manager.acceptInvitation({ token, userId: 'user-123' });
} catch (error) {
  if (error instanceof InvitationExpiredProblem) {
    console.error('Invitation has expired');
  }
}
```

## Events

The following events are published during invitation lifecycle:

- `InvitationCreatedEvent`: Emitted when invitation is created
- `InvitationAcceptedEvent`: Emitted when invitation is accepted
- `InvitationDeclinedEvent`: Emitted when invitation is declined
- `InvitationRevokedEvent`: Emitted when invitation is revoked
- `DomainAutoJoinedEvent`: Emitted when user auto-joins via domain policy

## Domain Policies

Enable automatic membership based on email domains:

```typescript
import { DomainPolicyManager, InMemoryDomainPolicyStore } from '@croco/invitation-core';

const domainStore = new InMemoryDomainPolicyStore();
const domainManager = new DomainPolicyManager(domainStore, membershipManager, eventPublisher);

await domainManager.addDomainPolicy('tenant-123', 'acme.com', 'member');

const membership = await domainManager.tryAutoJoin(
  'tenant-123',
  'user-456',
  'user@acme.com'
);
```

## Testing

```typescript
import {
  InvitationManager,
  InMemoryInvitationStore,
  InMemoryPendingInvitationStore,
  RateLimitedInvitationService,
} from '@croco/invitation-core';
import { describe, it, expect } from 'vitest';

describe('Invitation', () => {
  it('should create and accept invitation', async () => {
    const store = new InMemoryInvitationStore();
    const manager = new InvitationManager(store, membershipManager, notificationService, eventPublisher);

    const token = await manager.createEmailInvitation({
      tenantId: 'tenant-123',
      inviterId: 'inviter-456',
      email: 'user@example.com',
      role: 'member',
    });

    const invitation = await manager.acceptInvitation({
      token,
      userId: 'user-789',
      email: 'user@example.com',
    });

    expect(invitation.status).toBe('accepted');
  });
});
```

## Best Practices

1. **Always use rate limiting**: Protect against spam attacks
2. **Set reasonable expiration**: Default is 7 days for email, 30 days for link
3. **Validate emails**: Normalize emails before creating invitations
4. **Handle errors gracefully**: Use specific problem types for user feedback
5. **Monitor events**: Track invitation lifecycle via domain events

## License

MIT