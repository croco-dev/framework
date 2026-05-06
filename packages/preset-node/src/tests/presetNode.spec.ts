import { describe, expect, it, vi } from 'vitest';

import { createNodeEntry, createNodeServerPreset } from '../index';

describe('createNodeServerPreset', () => {
  it('returns a node preset', () => {
    const preset = createNodeServerPreset();

    expect(preset.name).toBe('node');
    expect(preset.config.name).toBe('node');
  });

  it('uses the Node entry point', () => {
    const preset = createNodeServerPreset();

    expect(preset.config.entry).toBe('./entry.js');
  });
});

describe('createNodeEntry', () => {
  it('creates a server lifecycle object', () => {
    const entry = createNodeEntry({ fetch: vi.fn() });

    expect(entry.server).toBeDefined();
    expect(typeof entry.start).toBe('function');
    expect(typeof entry.close).toBe('function');
  });

  it('starts and closes the server', async () => {
    const entry = createNodeEntry(
      {
        fetch: async () => new Response('ok'),
      },
      {
        port: 0,
        hostname: '127.0.0.1',
      }
    );

    await entry.start();
    expect(entry.server.listening).toBe(true);

    await entry.close();
    expect(entry.server.listening).toBe(false);
  });
});
