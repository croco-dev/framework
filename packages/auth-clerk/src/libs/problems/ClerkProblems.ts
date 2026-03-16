import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookVerificationProblem extends Problem {
  readonly code = 'auth-clerk/webhook-verification-failed';
  readonly category = ProblemCategory.Unauthorized;
  constructor() {
    super('Webhook verification failed');
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
  readonly code = 'auth-clerk/token-verification-failed';
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail?: string) {
    super(detail ?? 'Clerk token verification failed');
  }
}

export class ClerkMalformedClaimProblem extends Problem {
  readonly code = 'auth-clerk/malformed-claim';
  readonly category = ProblemCategory.Unauthorized;
  constructor(claimName: string) {
    super(`Clerk token contained a malformed '${claimName}' claim`);
  }
}

export class DuplicateTenantMappingProblem extends Problem {
  readonly code = 'auth-clerk/duplicate-tenant-mapping';
  readonly category = ProblemCategory.Conflict;
  constructor(externalOrgId: string, existingTenantId: string, nextTenantId: string) {
    super(
      `Clerk org '${externalOrgId}' is already mapped to tenant '${existingTenantId}' and cannot be remapped to '${nextTenantId}'`
    );
  }
}
