import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/rsc-basic');

async function readFixture(name: string) {
  return readFile(join(fixtureDir, name), 'utf8');
}

async function assertNoServerOnlyLeakage(clientFixtureName: string) {
  const source = await readFixture(clientFixtureName);
  const importedModules = Array.from(source.matchAll(/from ['"]([^'"]+)['"]/g)).map((match) => match[1] ?? '');
  const serverOnlyImports = importedModules.filter((specifier) => specifier.includes('server-only'));

  if (serverOnlyImports.length > 0) {
    throw new Error(
      `Client boundary ${clientFixtureName} imports server-only module(s): ${serverOnlyImports.join(', ')}`
    );
  }
}

describe('rsc server-only leakage', () => {
  it('fails hard when a client boundary imports a server-only module', async () => {
    await expect(assertNoServerOnlyLeakage('client-with-server-import.tsx')).rejects.toThrow(
      'imports server-only module'
    );
  });

  it('loads a pure RSC page that imports a server-only module', async () => {
    const { default: RscWithServerImport } = await import('./fixtures/rsc-basic/rsc-with-server-import');
    const element = RscWithServerImport();

    expect(element.props.children.join('')).toBe('RSC server module available: true');
  });

  it('loads the existing RSC entry while server-only modules stay outside client boundaries', async () => {
    const { default: RscEntry } = await import('./fixtures/rsc-basic/entry.rsc');
    const element = RscEntry();

    await expect(assertNoServerOnlyLeakage('entry.browser.tsx')).resolves.toBeUndefined();
    expect(element.props.children).toBe('RSC:server-only-value');
  });
});
