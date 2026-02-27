import { beforeEach, describe, expect, it } from 'vitest';
import { OnWebhook, WEBHOOK_METADATA_KEY } from '../libs/decorators/OnWebhook';
import { TriggerRegistry } from '../libs/TriggerRegistry';
import type { WebhookTriggerMetadata } from '../libs/types';

describe('@OnWebhook decorator', () => {
  beforeEach(() => {
    TriggerRegistry.getInstance();
  });

  it('should register webhook trigger metadata', () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/stripe', 'POST')
      async handleStripeWebhook(request: Request): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestWebhookHandler.prototype);
    expect(triggers.size).toBe(1);

    const [metadata] = Array.from(triggers.values());
    expect(metadata.type).toBe('webhook');
    expect((metadata as WebhookTriggerMetadata).path).toBe('/webhooks/stripe');
    expect((metadata as WebhookTriggerMetadata).method).toBe('POST');
    expect(metadata.methodName).toBe('handleStripeWebhook');
  });

  it('should normalize HTTP method to uppercase', () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/github', 'post')
      async handleGithub(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestWebhookHandler.prototype);
    const [metadata] = Array.from(triggers.values());

    expect((metadata as WebhookTriggerMetadata).method).toBe('POST');
  });

  it('should store custom options', () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/payment', 'POST', {
        name: 'payment-webhook',
        description: 'Handle payment provider webhooks',
        enabled: true,
        auth: true,
      })
      async handlePayment(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestWebhookHandler.prototype);
    const [metadata] = Array.from(triggers.values());

    expect(metadata.options).toEqual({
      name: 'payment-webhook',
      description: 'Handle payment provider webhooks',
      enabled: true,
      auth: true,
    });
  });

  it('should support CORS configuration', () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/external', 'POST', {
        cors: {
          origin: 'https://example.com',
          methods: ['POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        },
      })
      async handleExternal(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestWebhookHandler.prototype);
    const [metadata] = Array.from(triggers.values()) as WebhookTriggerMetadata[];

    expect(metadata.options?.cors).toEqual({
      origin: 'https://example.com',
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  });

  it('should support multiple origins in CORS', () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/multi-origin', 'GET', {
        cors: {
          origin: ['https://app1.com', 'https://app2.com', 'https://app3.com'],
        },
      })
      async handleMultiOrigin(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestWebhookHandler.prototype);
    const [metadata] = Array.from(triggers.values()) as WebhookTriggerMetadata[];

    expect(metadata.options?.cors?.origin).toEqual(['https://app1.com', 'https://app2.com', 'https://app3.com']);
  });

  it('should handle multiple webhook handlers on same class', () => {
    class MultiWebhookHandler {
      @OnWebhook('/webhooks/stripe', 'POST', { name: 'stripe' })
      async stripe(): Promise<void> {}

      @OnWebhook('/webhooks/github', 'POST', { name: 'github' })
      async github(): Promise<void> {}

      @OnWebhook('/webhooks/slack', 'POST', { name: 'slack' })
      async slack(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(MultiWebhookHandler.prototype);
    expect(triggers.size).toBe(3);

    const paths = Array.from(triggers.values()).map((m) => (m as WebhookTriggerMetadata).path);
    expect(paths).toContain('/webhooks/stripe');
    expect(paths).toContain('/webhooks/github');
    expect(paths).toContain('/webhooks/slack');
  });

  it('should handle same path with different methods', () => {
    class PathMethodHandler {
      @OnWebhook('/webhooks/hook', 'GET')
      async get(): Promise<void> {}

      @OnWebhook('/webhooks/hook', 'POST')
      async post(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(PathMethodHandler.prototype);
    expect(triggers.size).toBe(2);

    const webhookMetadata = Array.from(triggers.values()).map((m) => m as WebhookTriggerMetadata);
    const getTrigger = webhookMetadata.find((m) => m.method === 'GET');
    const postTrigger = webhookMetadata.find((m) => m.method === 'POST');

    expect(getTrigger?.path).toBe('/webhooks/hook');
    expect(postTrigger?.path).toBe('/webhooks/hook');
  });

  it('should support symbol method names', () => {
    const methodSymbol = Symbol('webhookHandler');

    class TestWebhookHandler {
      @OnWebhook('/webhooks/custom', 'POST')
      async [methodSymbol](request: Request): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestWebhookHandler.prototype);
    expect(triggers.has(methodSymbol)).toBe(true);

    const metadata = triggers.get(methodSymbol);
    expect(metadata?.type).toBe('webhook');
    expect(metadata?.methodName).toBe(methodSymbol);
  });

  it('should filter triggers by webhook type', () => {
    class MixedHandler {
      @OnWebhook('/webhooks/test', 'POST')
      async handleWebhook(): Promise<void> {}
    }

    const webhookTriggers = TriggerRegistry.getInstance().getTriggersByType(MixedHandler.prototype, 'webhook');
    expect(webhookTriggers.size).toBe(1);

    const cronTriggers = TriggerRegistry.getInstance().getTriggersByType(MixedHandler.prototype, 'cron');
    expect(cronTriggers.size).toBe(0);
  });

  it('should preserve original method behavior', async () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/test', 'POST')
      async handleRequest(request: Request): Promise<{ status: string }> {
        return { status: 'processed' };
      }
    }

    const handler = new TestWebhookHandler();
    const mockRequest = new Request('https://example.com');
    const result = await handler.handleRequest(mockRequest);

    expect(result.status).toBe('processed');
  });

  it('should export WEBHOOK_METADATA_KEY symbol', () => {
    expect(WEBHOOK_METADATA_KEY).not.toBeUndefined();
    expect(typeof WEBHOOK_METADATA_KEY).toBe('symbol');
  });

  it('should support different HTTP methods', () => {
    class HttpMethodHandler {
      @OnWebhook('/webhooks/hook', 'GET')
      async get(): Promise<void> {}

      @OnWebhook('/webhooks/hook', 'POST')
      async post(): Promise<void> {}

      @OnWebhook('/webhooks/hook', 'PUT')
      async put(): Promise<void> {}

      @OnWebhook('/webhooks/hook', 'DELETE')
      async delete(): Promise<void> {}

      @OnWebhook('/webhooks/hook', 'PATCH')
      async patch(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(HttpMethodHandler.prototype);
    expect(triggers.size).toBe(5);

    const methods = Array.from(triggers.values()).map((m) => (m as WebhookTriggerMetadata).method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
    expect(methods).toContain('DELETE');
    expect(methods).toContain('PATCH');
  });
});
