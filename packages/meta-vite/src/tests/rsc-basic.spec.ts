import { describe, expect, it } from 'vitest';

const entries = [
  ['entry.rsc', './fixtures/rsc-basic/entry.rsc'],
  ['entry.ssr', './fixtures/rsc-basic/entry.ssr'],
  ['entry.browser', './fixtures/rsc-basic/entry.browser'],
] as const;

async function loadEntry(entryName: string, path: string) {
  try {
    return await import(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to load ${entryName}: ${message}`);
  }
}

describe('rsc-basic fixture entries', () => {
  it.each(entries)('loads %s independently', async (entryName, path) => {
    const mod = await loadEntry(entryName, path);

    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('fails clearly when the browser entry is missing', async () => {
    await expect(loadEntry('entry.browser', './fixtures/rsc-basic/entry.browser-missing')).rejects.toThrow(
      'entry.browser'
    );
  });
});
