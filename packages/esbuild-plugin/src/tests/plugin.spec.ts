import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as esbuild from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crocoPlugin } from '../libs/plugin';

const TEMP_DIR = path.join(__dirname, 'plugin-temp');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('crocoPlugin', () => {
  let mockBuildContext: esbuild.PluginBuild;

  beforeEach(() => {
    mockBuildContext = {
      initialOptions: {
        entryPoints: [],
      },
      onStart: vi.fn(),
      onLoad: vi.fn(),
      onEnd: vi.fn(),
    } as unknown as esbuild.PluginBuild;

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('configuration', () => {
    it('should use default config when none provided', () => {
      const plugin = crocoPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('croco-plugin');
      expect(typeof plugin.setup).toBe('function');
    });

    it('should merge custom config with defaults', () => {
      const customConfig = {
        reflectMetadata: false,
        scan: {
          dirs: ['src', 'lib'],
          decorators: ['Service'],
        },
      };

      const plugin = crocoPlugin(customConfig);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('croco-plugin');
    });

    it('should disable reflectMetadata when false', () => {
      const customConfig = {
        reflectMetadata: false,
      };

      const plugin = crocoPlugin(customConfig);

      expect(plugin).toBeDefined();
    });
  });

  describe('onStart', () => {
    it('should clear scanner cache', () => {
      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
      });

      plugin.setup(mockBuildContext);
      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it('should resolve entry points', () => {
      mockBuildContext.initialOptions.entryPoints = ['src/index.ts'];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it('should scan for components', () => {
      mockBuildContext.initialOptions.entryPoints = [path.join(FIXTURES_DIR, 'WithComponent.ts')];

      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
      });

      plugin.setup(mockBuildContext);

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });
  });

  describe('onLoad', () => {
    const createMockOnLoadArgs = (filePath: string): esbuild.OnLoadArgs => ({
      path: filePath,
      namespace: '',
      suffix: '',
      pluginData: {},
      with: {},
    });

    it('should prepend reflect-metadata import to entry points', async () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1];
      if (onLoadCallback) {
        const result = onLoadCallback(createMockOnLoadArgs(entryFilePath)) as esbuild.OnLoadResult;
        const actualResult = typeof result === 'object' && 'then' in result ? await result : result;

        expect(actualResult?.contents).toContain("import 'reflect-metadata';");
      }
    });

    it('should prepend auto-import for component files', async () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1];
      if (onLoadCallback) {
        const result = onLoadCallback(createMockOnLoadArgs(entryFilePath)) as esbuild.OnLoadResult;
        const actualResult = typeof result === 'object' && 'then' in result ? await result : result;

        expect(actualResult?.contents).toContain('@croco/auto-import');
      }
    });

    it('should not modify non-entry-point files', async () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      const nonEntryFilePath = path.join(TEMP_DIR, 'other.ts');

      fs.writeFileSync(entryFilePath, "console.log('hello');");
      fs.writeFileSync(nonEntryFilePath, "console.log('world');");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1];
      if (onLoadCallback) {
        const result = onLoadCallback(createMockOnLoadArgs(nonEntryFilePath));
        if (!result) {
          return;
        }
        const actualResult = typeof result === 'object' && 'then' in result ? await result : result;

        expect(actualResult).toBeUndefined();
      }
    });

    it('should return undefined when no prepend needed', async () => {
      const nonEntryFilePath = path.join(TEMP_DIR, 'other.ts');

      fs.writeFileSync(nonEntryFilePath, "console.log('world');");

      mockBuildContext.initialOptions.entryPoints = [];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1];
      if (onLoadCallback) {
        const result = onLoadCallback(createMockOnLoadArgs(nonEntryFilePath));
        if (!result) {
          return;
        }
        const actualResult = typeof result === 'object' && 'then' in result ? await result : result;

        expect(actualResult).toBeUndefined();
      }
    });

    it('should disable reflect-metadata when config is false', async () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        reflectMetadata: false,
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1];
      if (onLoadCallback) {
        const result = onLoadCallback(createMockOnLoadArgs(entryFilePath)) as esbuild.OnLoadResult;
        const actualResult = typeof result === 'object' && 'then' in result ? await result : result;

        expect(actualResult?.contents).not.toContain("import 'reflect-metadata';");
      }
    });
  });

  describe('watch mode optimization', () => {
    it('should not clear cache on subsequent builds in watch mode', () => {
      mockBuildContext.initialOptions = {
        entryPoints: [path.join(FIXTURES_DIR, 'WithComponent.ts')],
        metafile: true,
      };

      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
        watch: {
          optimize: true,
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      const onEndCallback = vi.mocked(mockBuildContext.onEnd).mock.calls[0]?.[0];

      if (onStartCallback) {
        onStartCallback();
      }

      if (onEndCallback) {
        onEndCallback({
          errors: [],
          warnings: [],
          outputFiles: [],
          metafile: undefined,
          mangleCache: undefined,
        });
      }

      if (onStartCallback) {
        onStartCallback();
      }

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it('should clear cache when not in watch mode', () => {
      mockBuildContext.initialOptions = {
        entryPoints: [path.join(FIXTURES_DIR, 'WithComponent.ts')],
      };

      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];

      if (onStartCallback) {
        onStartCallback();
      }

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it('should respect watch.optimize configuration', () => {
      mockBuildContext.initialOptions = {
        entryPoints: [path.join(FIXTURES_DIR, 'WithComponent.ts')],
        metafile: true,
      };

      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
        watch: {
          optimize: false,
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];

      if (onStartCallback) {
        onStartCallback();
      }

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });
  });

  describe('generateRegistry', () => {
    const REGISTRY_DIR = path.join(TEMP_DIR, '.croco');

    beforeEach(() => {
      if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(REGISTRY_DIR)) {
        fs.rmSync(REGISTRY_DIR, { recursive: true, force: true });
      }
    });

    it('should generate registry.gen.ts with controllers and components', () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const controllerFilePath = path.join(TEMP_DIR, 'UserController.ts');
      fs.writeFileSync(controllerFilePath, '@Controller()\nexport class UserController { id: string; }');

      const componentFilePath = path.join(TEMP_DIR, 'MyComponent.ts');
      fs.writeFileSync(componentFilePath, '@Component()\nexport class MyComponent { name: string; }');

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ['Component', 'Controller'],
        },
        generateRegistry: {
          enabled: true,
          outDir: REGISTRY_DIR,
          outFile: 'registry.gen.ts',
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const registryPath = path.join(REGISTRY_DIR, 'registry.gen.ts');
      expect(fs.existsSync(registryPath)).toBe(true);

      const registryContent = fs.readFileSync(registryPath, 'utf-8');
      expect(registryContent).toContain('// AUTO-GENERATED - DO NOT EDIT');
      expect(registryContent).toContain("import { UserController } from '../UserController';");
      expect(registryContent).toContain("import { MyComponent } from '../MyComponent';");
      expect(registryContent).toContain('export const controllers = [UserController] as const;');
      expect(registryContent).toContain('export const components = [MyComponent] as const;');
      expect(registryContent).toContain('export type Controllers = typeof controllers;');
      expect(registryContent).toContain('export type Components = typeof components;');
    });

    it('should use default outDir and outFile when not specified', () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const controllerFilePath = path.join(TEMP_DIR, 'UserController.ts');
      fs.writeFileSync(controllerFilePath, '@Controller()\nexport class UserController { id: string; }');

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ['Controller'],
        },
        generateRegistry: {
          enabled: true,
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const defaultRegistryPath = path.join(process.cwd(), '.croco', 'registry.gen.ts');
      expect(fs.existsSync(defaultRegistryPath)).toBe(true);

      if (fs.existsSync(defaultRegistryPath)) {
        fs.rmSync(defaultRegistryPath, { force: true });
      }
    });

    it('should not generate registry when disabled', () => {
      const entryFilePath = path.join(TEMP_DIR, 'entry.ts');
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const controllerFilePath = path.join(TEMP_DIR, 'UserController.ts');
      fs.writeFileSync(controllerFilePath, '@Controller()\nexport class UserController { id: string; }');

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ['Controller'],
        },
        generateRegistry: {
          enabled: false,
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const registryPath = path.join(REGISTRY_DIR, 'registry.gen.ts');
      expect(fs.existsSync(registryPath)).toBe(false);
    });
  });
});
