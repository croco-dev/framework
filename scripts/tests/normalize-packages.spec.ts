import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve(__dirname, '../normalize-packages.mjs');
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe('normalize-packages.mjs', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('reports drift in check mode without writing files', () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, 'example', {
      name: '@croco/example',
      version: '0.0.3',
      files: ['dist'],
      type: 'commonjs',
      main: './src/index.ts',
      types: ['dist/index.d.ts', 'dist/index.d.mts'],
      publishConfig: {
        main: './src/index.ts',
        types: ['dist/index.d.ts', 'dist/index.d.mts'],
        exports: {
          '.': {
            import: './dist/index.mjs',
            require: './dist/index.js',
            types: ['dist/index.d.ts', 'dist/index.d.mts'],
          },
        },
      },
    });
    const before = readFileSync(packagePath, 'utf-8');

    const result = runScript(root, '--check');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('package manifest drift detected');
    expect(result.stdout).toContain('publishConfig.main must not reference ./src');
    expect(readFileSync(packagePath, 'utf-8')).toBe(before);
  });

  it('normalizes publish contracts in write mode and preserves versions', () => {
    const root = createTempRoot();
    const packagePath = writePackage(root, 'example', {
      name: '@croco/example',
      version: '0.0.3',
      type: 'commonjs',
      main: './src/index.ts',
      types: ['dist/index.d.ts', 'dist/index.d.mts'],
      publishConfig: {
        files: ['dist'],
        main: './src/index.ts',
        types: ['dist/index.d.ts', 'dist/index.d.mts'],
        exports: {
          '.': {
            import: './dist/index.mjs',
            require: './dist/index.js',
            types: ['dist/index.d.ts', 'dist/index.d.mts'],
          },
        },
      },
    });

    const result = runScript(root, '--write');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

    expect(result.status).toBe(0);
    expect(pkg.version).toBe('0.0.3');
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.types).toBe('./dist/index.d.ts');
    expect(pkg.publishConfig.access).toBe('public');
    expect(pkg.publishConfig.files).toBeUndefined();
    expect(pkg.publishConfig.main).toBe('./dist/index.js');
    expect(pkg.publishConfig.types).toBe('./dist/index.d.ts');
    expect(pkg.publishConfig.exports['.'].types).toBe('./dist/index.d.ts');
  });

  it('allows documented non-library package exceptions', () => {
    const root = createTempRoot();
    writePackage(
      root,
      'docs',
      {
        name: '@croco/docs',
        version: '0.0.3',
        type: 'module',
        publishConfig: {
          access: 'public',
        },
      },
      {
        sourceIndex: false,
      },
    );
    writePackage(root, 'create-croco-app', {
      name: 'create-croco-app',
      version: '0.0.3',
      bin: {
        'create-croco-app': './dist/index.js',
      },
      files: ['dist', 'templates'],
      type: 'module',
      publishConfig: {
        access: 'public',
      },
    });

    const result = runScript(root, '--check');

    expect(result.status).toBe(0);
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'croco-package-manifests-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'packages'));

  return root;
}

function writePackage(
  root: string,
  packageDirName: string,
  pkg: Record<string, unknown>,
  options: { readonly sourceIndex?: boolean } = {},
): string {
  const packageDir = join(root, 'packages', packageDirName);
  mkdirSync(packageDir, { recursive: true });

  if (options.sourceIndex !== false) {
    const sourcePath = join(packageDir, 'src', 'index.ts');
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, 'export const value = 1;\n');
  }

  const packagePath = join(packageDir, 'package.json');
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  return packagePath;
}

function runScript(root: string, mode: '--check' | '--write'): ScriptResult {
  const result = spawnSync('node', [scriptPath, mode, '--root', root], {
    encoding: 'utf-8',
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
