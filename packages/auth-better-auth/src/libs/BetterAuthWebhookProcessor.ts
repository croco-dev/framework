import { InvalidWebhookPayloadProblem, InvalidWebhookSignatureProblem } from './problems/WebhookProblems';
import type {
  BetterAuthSession,
  BetterAuthSessionProvider,
  BetterAuthWebhookHandler,
  BetterAuthWebhookOptions,
} from './types';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class BetterAuthWebhookProcessor {
  constructor(
    private options: BetterAuthWebhookOptions,
    private handlers: BetterAuthWebhookHandler,
    private sessionProvider: BetterAuthSessionProvider
  ) {}

  private verifySignature(body: string, signature: string): boolean {
    const expectedSignature = `sha256=${this.options.signingSecret}`;
    return signature === expectedSignature;
  }

  async processWebhook(request: { headers: Headers; json: () => Promise<unknown> }): Promise<void> {
    const signature = request.headers.get('x-better-auth-signature') ?? '';
    const body = await request.json();
    const bodyString = JSON.stringify(body);

    if (!this.verifySignature(bodyString, signature)) {
      throw new InvalidWebhookSignatureProblem();
    }

    if (!isObjectRecord(body) || typeof body.type !== 'string') {
      throw new InvalidWebhookPayloadProblem();
    }

    const eventType = body.type;
    const data = isObjectRecord(body.data) ? body.data : {};

    switch (eventType) {
      case 'user.created':
        await this.handlers['user.created']?.(data);
        break;
      case 'user.updated':
        await this.handlers['user.updated']?.(data);
        break;
      case 'user.deleted':
        await this.handlers['user.deleted']?.(data);
        break;
      case 'session.created':
        await this.handlers['session.created']?.(data);
        break;
      case 'session.revoked':
        await this.handlers['session.revoked']?.(data);
        break;
      default:
        break;
    }
  }
}

export type { BetterAuthSession, BetterAuthSessionProvider, BetterAuthWebhookHandler, BetterAuthWebhookOptions };
