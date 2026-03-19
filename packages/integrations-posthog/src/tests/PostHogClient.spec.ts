import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { PostHog } from 'posthog-node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogClient } from '../libs/PostHogClient';

vi.mock('posthog-node', () => {
  const PostHogMock = vi.fn();
  PostHogMock.prototype.shutdown = vi.fn().mockResolvedValue(undefined);

  return {
    PostHog: PostHogMock,
  };
});

describe('PostHogClient', () => {
  let client!: PostHogClient;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    vi.stubEnv('POSTHOG_HOST', 'https://test.posthog.com');
    client = new PostHogClient({ apiKey: 'test-key' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return underlying PostHog client', () => {
    const underlyingClient = client.getClient();
    expect(underlyingClient).not.toBeUndefined();
    expect(underlyingClient.shutdown).not.toBeUndefined();
  });

  it('should shutdown PostHog client', async () => {
    const underlyingClient = client.getClient();
    const shutdownSpy = vi.spyOn(underlyingClient, 'shutdown');

    await client.shutdown();

    expect(shutdownSpy).toHaveBeenCalled();
  });

  it('should throw error when host is not provided', () => {
    vi.unstubAllEnvs();
    expect(() => new PostHogClient({ apiKey: 'new-key' })).toThrow(
      '[PostHogClient] PostHog host is required. ' + 'Set POSTHOG_HOST environment variable or pass host in config.'
    );
  });

  it('should create PostHog client with custom host', () => {
    new PostHogClient({
      apiKey: 'custom-key',
      host: 'https://custom.posthog.com',
    });

    expect(PostHog).toHaveBeenLastCalledWith('custom-key', {
      host: 'https://custom.posthog.com',
    });
  });

  it('should fallback to POSTHOG_HOST when host is not provided', () => {
    vi.stubEnv('POSTHOG_HOST', 'https://env.posthog.example');

    new PostHogClient({ apiKey: 'env-key' });

    expect(PostHog).toHaveBeenLastCalledWith('env-key', {
      host: 'https://env.posthog.example',
    });

    vi.unstubAllEnvs();
  });

  it('should throw error when POSTHOG_HOST is empty string', () => {
    vi.stubEnv('POSTHOG_HOST', '');

    expect(() => new PostHogClient({ apiKey: 'env-key' })).toThrow(
      '[PostHogClient] PostHog host is required. ' + 'Set POSTHOG_HOST environment variable or pass host in config.'
    );

    vi.unstubAllEnvs();
  });

  it('should allow multiple client instances', () => {
    const client1 = new PostHogClient({ apiKey: 'key-1' });
    const client2 = new PostHogClient({ apiKey: 'key-2' });

    expect(client1.getClient()).not.toBeUndefined();
    expect(client2.getClient()).not.toBeUndefined();
    expect(client1.getClient()).not.toBe(client2.getClient());
  });
});
