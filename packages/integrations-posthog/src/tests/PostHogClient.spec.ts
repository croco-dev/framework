import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogClient } from '../libs/PostHogClient';

vi.mock('posthog-node', () => {
  const PostHogMock = vi.fn();
  PostHogMock.prototype.shutdown = vi.fn().mockResolvedValue(undefined);

  return {
    PostHog: PostHogMock,
  };
});

describe('PostHogClient', () => {
  let client: PostHogClient;

  beforeEach(() => {
    Container.reset();
    client = new PostHogClient({ apiKey: 'test-key' });
  });

  it('should return underlying PostHog client', () => {
    const underlyingClient = client.getClient();
    expect(underlyingClient).toBeDefined();
    expect(underlyingClient.shutdown).toBeDefined();
  });

  it('should shutdown PostHog client', async () => {
    const underlyingClient = client.getClient();
    const shutdownSpy = vi.spyOn(underlyingClient, 'shutdown');

    await client.shutdown();

    expect(shutdownSpy).toHaveBeenCalled();
  });

  it('should create PostHog client with default host', () => {
    const client2 = new PostHogClient({ apiKey: 'new-key' });
    expect(client2.getClient()).toBeDefined();
  });

  it('should create PostHog client with custom host', () => {
    const clientWithHost = new PostHogClient({
      apiKey: 'custom-key',
      host: 'https://custom.posthog.com',
    });
    expect(clientWithHost.getClient()).toBeDefined();
  });

  it('should allow multiple client instances', () => {
    const client1 = new PostHogClient({ apiKey: 'key-1' });
    const client2 = new PostHogClient({ apiKey: 'key-2' });

    expect(client1.getClient()).toBeDefined();
    expect(client2.getClient()).toBeDefined();
    expect(client1.getClient()).not.toBe(client2.getClient());
  });
});
