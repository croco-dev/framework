import { verifyWebhook, type WebhookEvent } from '@clerk/backend/webhooks';
import { WebhookVerificationProblem } from './problems/ClerkProblems';
import type {
  ClerkMembershipEvent,
  ClerkOrgEvent,
  ClerkUserEvent,
  WebhookEventHandler,
  WebhookHandlerOptions,
} from './types';

export class ClerkWebhookHandler {
  constructor(
    private options: WebhookHandlerOptions,
    private handlers: WebhookEventHandler
  ) {}

  async handleWebhook(request: Request): Promise<void> {
    let event: unknown;
    try {
      event = await verifyWebhook(request, { signingSecret: this.options.signingSecret });
    } catch {
      throw new WebhookVerificationProblem();
    }

    const webhookEvent = event as WebhookEvent;

    switch (webhookEvent.type) {
      case 'user.created':
        await this.handlers['user.created']?.(webhookEvent.data as unknown as ClerkUserEvent);
        break;
      case 'user.updated':
        await this.handlers['user.updated']?.(webhookEvent.data as unknown as ClerkUserEvent);
        break;
      case 'user.deleted':
        await this.handlers['user.deleted']?.(webhookEvent.data as unknown as ClerkUserEvent);
        break;
      case 'organization.created':
        await this.handlers['organization.created']?.(webhookEvent.data as unknown as ClerkOrgEvent);
        break;
      case 'organization.updated':
        await this.handlers['organization.updated']?.(webhookEvent.data as unknown as ClerkOrgEvent);
        break;
      case 'organization.deleted':
        await this.handlers['organization.deleted']?.(webhookEvent.data as unknown as ClerkOrgEvent);
        break;
      case 'organizationMembership.created':
        await this.handlers['organizationMembership.created']?.(webhookEvent.data as unknown as ClerkMembershipEvent);
        break;
      case 'organizationMembership.deleted':
        await this.handlers['organizationMembership.deleted']?.(webhookEvent.data as unknown as ClerkMembershipEvent);
        break;
    }
  }
}
