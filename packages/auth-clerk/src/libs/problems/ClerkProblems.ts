import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookVerificationProblem extends Problem {
  constructor() {
    super('auth-clerk/webhook-verification-failed', ProblemCategory.Unauthorized, 'Webhook verification failed');
  }
}

export class InvalidWebhookPayloadProblem extends Problem {
  constructor(eventType?: string) {
    const message =
      typeof eventType === 'string' ? `Invalid webhook payload for event '${eventType}'` : 'Invalid webhook payload';

    super('auth-clerk/invalid-webhook-payload', ProblemCategory.ValidationError, message);
  }
}

export class ClerkTokenVerificationProblem extends Problem {
  constructor(detail?: string) {
    super(
      'auth-clerk/token-verification-failed',
      ProblemCategory.Unauthorized,
      detail ?? 'Clerk token verification failed'
    );
  }
}

export class ClerkMalformedClaimProblem extends Problem {
  constructor(claimName: string) {
    super(
      'auth-clerk/malformed-claim',
      ProblemCategory.Unauthorized,
      `Clerk token contained a malformed '${claimName}' claim`
    );
  }
}

export class DuplicateTenantMappingProblem extends Problem {
  constructor(externalOrgId: string, existingTenantId: string, nextTenantId: string) {
    super(
      'auth-clerk/duplicate-tenant-mapping',
      ProblemCategory.Conflict,
      `Clerk org '${externalOrgId}' is already mapped to tenant '${existingTenantId}' and cannot be remapped to '${nextTenantId}'`
    );
  }
}
