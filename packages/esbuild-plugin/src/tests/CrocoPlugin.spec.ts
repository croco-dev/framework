import * as fs from "node:fs";
import * as path from "node:path";
import * as esbuild from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentScannerDiagnosticError } from "../libs/ComponentScanner";
import { crocoPlugin } from "../libs/plugin";

const TEMP_DIR = path.join(__dirname, "plugin-temp");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

describe("crocoPlugin", () => {
  let mockBuildContext!: esbuild.PluginBuild;

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

  describe("configuration", () => {
    it("should use default config when none provided", () => {
      const plugin = crocoPlugin();

      expect(plugin).not.toBeUndefined();
      expect(plugin.name).toBe("croco-plugin");
      expect(typeof plugin.setup).toBe("function");
    });

    it("should merge custom config with defaults", () => {
      const customConfig = {
        reflectMetadata: false,
        scan: {
          dirs: ["src", "lib"],
          decorators: ["Service"],
        },
      };

      const plugin = crocoPlugin(customConfig);

      expect(plugin).not.toBeUndefined();
      expect(plugin.name).toBe("croco-plugin");
    });

    it("should disable reflectMetadata when false", () => {
      const customConfig = {
        reflectMetadata: false,
      };

      const plugin = crocoPlugin(customConfig);

      expect(plugin).not.toBeUndefined();
    });
  });

  describe("onStart", () => {
    it("should clear scanner cache", () => {
      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
      });

      plugin.setup(mockBuildContext);
      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it("should resolve entry points", () => {
      mockBuildContext.initialOptions.entryPoints = ["src/index.ts"];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it("should scan for components", () => {
      mockBuildContext.initialOptions.entryPoints = [path.join(FIXTURES_DIR, "WithComponent.ts")];

      const plugin = crocoPlugin({
        scan: {
          dirs: [FIXTURES_DIR],
        },
      });

      plugin.setup(mockBuildContext);

      expect(mockBuildContext.onStart).toHaveBeenCalled();
    });

    it("should resolve default scan dirs from absWorkingDir instead of the entry file directory", async () => {
      const projectRoot = path.join(TEMP_DIR, "project-root");
      const srcDir = path.join(projectRoot, "src");
      const entryFilePath = path.join(srcDir, "index.ts");
      const componentFilePath = path.join(srcDir, "DefaultComponent.ts");
      const onLoadArgs: esbuild.OnLoadArgs = {
        path: entryFilePath,
        namespace: "",
        suffix: "",
        pluginData: {},
        with: {},
      };

      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(entryFilePath, "console.log('hello');");
      fs.writeFileSync(componentFilePath, "@Component()\nexport class DefaultComponent {}");

      mockBuildContext.initialOptions = {
        entryPoints: ["src/index.ts"],
        absWorkingDir: projectRoot,
      };

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      onStartCallback?.();

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback(onLoadArgs) as esbuild.OnLoadResult;
      const actualResult = typeof result === "object" && "then" in result ? await result : result;

      expect(actualResult?.contents).toContain("import './DefaultComponent';");
    });

    it("should generate entry-specific auto-imports for multi-entry builds in different directories", async () => {
      const projectRoot = path.join(TEMP_DIR, "multi-entry-project");
      const appDir = path.join(projectRoot, "src", "app");
      const adminDir = path.join(projectRoot, "src", "admin");
      const appEntryPath = path.join(appDir, "index.ts");
      const adminEntryPath = path.join(adminDir, "index.ts");
      const appComponentPath = path.join(appDir, "AppComponent.ts");
      const adminComponentPath = path.join(adminDir, "AdminComponent.ts");

      fs.mkdirSync(appDir, { recursive: true });
      fs.mkdirSync(adminDir, { recursive: true });
      fs.writeFileSync(appEntryPath, "console.log('app');");
      fs.writeFileSync(adminEntryPath, "console.log('admin');");
      fs.writeFileSync(appComponentPath, "@Component()\nexport class AppComponent {}");
      fs.writeFileSync(adminComponentPath, "@Component()\nexport class AdminComponent {}");

      mockBuildContext.initialOptions = {
        entryPoints: ["src/app/index.ts", "src/admin/index.ts"],
        absWorkingDir: projectRoot,
      };

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      onStartCallback?.();

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const appResult = onLoadCallback({
        path: appEntryPath,
        namespace: "",
        suffix: "",
        pluginData: {},
        with: {},
      }) as esbuild.OnLoadResult;
      const adminResult = onLoadCallback({
        path: adminEntryPath,
        namespace: "",
        suffix: "",
        pluginData: {},
        with: {},
      }) as esbuild.OnLoadResult;

      const resolvedAppResult =
        typeof appResult === "object" && "then" in appResult ? await appResult : appResult;
      const resolvedAdminResult =
        typeof adminResult === "object" && "then" in adminResult ? await adminResult : adminResult;

      expect(resolvedAppResult?.contents).toContain("import './AppComponent';");
      expect(resolvedAppResult?.contents).toContain("import '../admin/AdminComponent';");
      expect(resolvedAdminResult?.contents).toContain("import './AdminComponent';");
      expect(resolvedAdminResult?.contents).toContain("import '../app/AppComponent';");
    });

    it("should resolve object entry points from absWorkingDir", async () => {
      const projectRoot = path.join(TEMP_DIR, "object-entry-project");
      const srcDir = path.join(projectRoot, "src");
      const entryFilePath = path.join(srcDir, "main.ts");
      const componentFilePath = path.join(srcDir, "ObjectEntryComponent.ts");

      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(entryFilePath, "console.log('object-entry');");
      fs.writeFileSync(componentFilePath, "@Component()\nexport class ObjectEntryComponent {}");

      mockBuildContext.initialOptions = {
        entryPoints: {
          app: "src/main.ts",
        },
        absWorkingDir: projectRoot,
      };

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      onStartCallback?.();

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback({
        path: entryFilePath,
        namespace: "",
        suffix: "",
        pluginData: {},
        with: {},
      }) as esbuild.OnLoadResult;
      const actualResult = typeof result === "object" && "then" in result ? await result : result;

      expect(actualResult?.contents).toContain("import './ObjectEntryComponent';");
    });

    it("should surface scan failures as build errors", () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      const invalidFilePath = path.join(TEMP_DIR, "invalid.ts");

      fs.writeFileSync(entryFilePath, "console.log('hello');");
      fs.writeFileSync(invalidFilePath, "this is not valid typescript {{{");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      const result = onStartCallback?.();
      const buildError = (result as { errors: esbuild.PartialMessage[] } | undefined)?.errors?.[0];

      expect(result).toEqual({
        errors: [
          expect.objectContaining({
            text: expect.stringContaining("Component scan failed:"),
            detail: expect.objectContaining({
              diagnostic: expect.any(Object),
              cause: expect.any(Object),
            }),
            location: expect.objectContaining({
              file: path.resolve(invalidFilePath),
              line: expect.any(Number),
              column: expect.any(Number),
              lineText: "this is not valid typescript {{{",
            }),
          }),
        ],
      });

      expect(buildError?.detail).toBeInstanceOf(ComponentScannerDiagnosticError);
    });
  });

  describe("onLoad", () => {
    const createMockOnLoadArgs = (filePath: string): esbuild.OnLoadArgs => ({
      path: filePath,
      namespace: "",
      suffix: "",
      pluginData: {},
      with: {},
    });

    it("should prepend reflect-metadata import to entry points", async () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback(createMockOnLoadArgs(entryFilePath)) as esbuild.OnLoadResult;
      const actualResult = typeof result === "object" && "then" in result ? await result : result;

      expect(actualResult?.contents).toContain("import 'reflect-metadata';");
    });

    it("should prepend auto-import for component files", async () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
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

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback(createMockOnLoadArgs(entryFilePath)) as esbuild.OnLoadResult;
      const actualResult = typeof result === "object" && "then" in result ? await result : result;

      expect(actualResult?.contents).toContain("@croco/auto-import");
    });

    it("should not modify non-entry-point files", async () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      const nonEntryFilePath = path.join(TEMP_DIR, "other.ts");

      fs.writeFileSync(entryFilePath, "console.log('hello');");
      fs.writeFileSync(nonEntryFilePath, "console.log('world');");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback(createMockOnLoadArgs(nonEntryFilePath));
      const actualResult =
        result != null && typeof result === "object" && "then" in result ? await result : result;

      expect(actualResult).toBeUndefined();
    });

    it("should return undefined when no prepend needed", async () => {
      const nonEntryFilePath = path.join(TEMP_DIR, "other.ts");

      fs.writeFileSync(nonEntryFilePath, "console.log('world');");

      mockBuildContext.initialOptions.entryPoints = [];

      const plugin = crocoPlugin();
      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback(createMockOnLoadArgs(nonEntryFilePath));
      const actualResult =
        result != null && typeof result === "object" && "then" in result ? await result : result;

      expect(actualResult).toBeUndefined();
    });

    it("should disable reflect-metadata when config is false", async () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
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

      expect(vi.mocked(mockBuildContext.onLoad).mock.calls[0]?.[1]).toBeDefined();
      const onLoadCallback = vi.mocked(mockBuildContext.onLoad).mock.calls[0]![1];
      const result = onLoadCallback(createMockOnLoadArgs(entryFilePath)) as esbuild.OnLoadResult;
      const actualResult = typeof result === "object" && "then" in result ? await result : result;
      const actualContents = actualResult?.contents;

      expect(typeof actualContents === "string" ? actualContents : "").not.toContain(
        "import 'reflect-metadata';",
      );
    });
  });

  describe("watch mode optimization", () => {
    it("should not clear cache on subsequent builds in watch mode", () => {
      mockBuildContext.initialOptions = {
        entryPoints: [path.join(FIXTURES_DIR, "WithComponent.ts")],
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

    it("should clear cache when not in watch mode", () => {
      mockBuildContext.initialOptions = {
        entryPoints: [path.join(FIXTURES_DIR, "WithComponent.ts")],
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

    it("should respect watch.optimize configuration", () => {
      mockBuildContext.initialOptions = {
        entryPoints: [path.join(FIXTURES_DIR, "WithComponent.ts")],
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

  describe("generateRegistry", () => {
    const REGISTRY_DIR = path.join(TEMP_DIR, ".croco");

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

    it("should generate a valid registry for .tsx components", () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const cardFilePath = path.join(TEMP_DIR, "Card.tsx");
      fs.writeFileSync(cardFilePath, "@Component()\nexport class Card { name: string; }");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ["Component"],
        },
        generateRegistry: {
          enabled: true,
          outDir: REGISTRY_DIR,
          outFile: "registry.gen.ts",
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const registryPath = path.join(REGISTRY_DIR, "registry.gen.ts");
      expect(fs.existsSync(registryPath)).toBe(true);

      const registryContent = fs.readFileSync(registryPath, "utf-8");
      expect(registryContent).toContain("import { Card } from '../Card';");
      expect(registryContent).toContain("export const components = [Card] as const;");
      expect(registryContent).not.toContain("Card.tsx");
    });

    it("should build the generated registry with esbuild for .tsx components", async () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const cardFilePath = path.join(TEMP_DIR, "Card.tsx");
      fs.writeFileSync(cardFilePath, "@Component()\nexport class Card { name: string; }");

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ["Component"],
        },
        generateRegistry: {
          enabled: true,
          outDir: REGISTRY_DIR,
          outFile: "registry.gen.ts",
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const registryPath = path.join(REGISTRY_DIR, "registry.gen.ts");
      expect(fs.existsSync(registryPath)).toBe(true);

      const buildResult = await esbuild.build({
        entryPoints: [registryPath],
        bundle: true,
        write: false,
        format: "esm",
      });

      expect(buildResult.errors).toEqual([]);
      expect(buildResult.outputFiles?.length).toBeGreaterThan(0);
    });

    it("should generate registry.gen.ts with controllers and components", () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const controllerFilePath = path.join(TEMP_DIR, "UserController.ts");
      fs.writeFileSync(
        controllerFilePath,
        "@Controller()\nexport class UserController { id: string; }",
      );

      const componentFilePath = path.join(TEMP_DIR, "MyComponent.ts");
      fs.writeFileSync(
        componentFilePath,
        "@Component()\nexport class MyComponent { name: string; }",
      );

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ["Component", "Controller"],
        },
        generateRegistry: {
          enabled: true,
          outDir: REGISTRY_DIR,
          outFile: "registry.gen.ts",
        },
      });

      plugin.setup(mockBuildContext);

      const onStartCallback = vi.mocked(mockBuildContext.onStart).mock.calls[0]?.[0];
      if (onStartCallback) {
        onStartCallback();
      }

      const registryPath = path.join(REGISTRY_DIR, "registry.gen.ts");
      expect(fs.existsSync(registryPath)).toBe(true);

      const registryContent = fs.readFileSync(registryPath, "utf-8");
      expect(registryContent).toContain("// AUTO-GENERATED - DO NOT EDIT");
      expect(registryContent).toContain("import { UserController } from '../UserController';");
      expect(registryContent).toContain("import { MyComponent } from '../MyComponent';");
      expect(registryContent).toContain("export const controllers = [UserController] as const;");
      expect(registryContent).toContain("export const components = [MyComponent] as const;");
      expect(registryContent).toContain("export type Controllers = typeof controllers;");
      expect(registryContent).toContain("export type Components = typeof components;");
    });

    it("should use default outDir and outFile when not specified", () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const controllerFilePath = path.join(TEMP_DIR, "UserController.ts");
      fs.writeFileSync(
        controllerFilePath,
        "@Controller()\nexport class UserController { id: string; }",
      );

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ["Controller"],
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

      const defaultRegistryPath = path.join(process.cwd(), ".croco", "registry.gen.ts");
      expect(fs.existsSync(defaultRegistryPath)).toBe(true);

      if (fs.existsSync(defaultRegistryPath)) {
        fs.rmSync(defaultRegistryPath, { force: true });
      }
    });

    it("should not generate registry when disabled", () => {
      const entryFilePath = path.join(TEMP_DIR, "entry.ts");
      fs.writeFileSync(entryFilePath, "console.log('hello');");

      const controllerFilePath = path.join(TEMP_DIR, "UserController.ts");
      fs.writeFileSync(
        controllerFilePath,
        "@Controller()\nexport class UserController { id: string; }",
      );

      mockBuildContext.initialOptions.entryPoints = [entryFilePath];

      const plugin = crocoPlugin({
        scan: {
          dirs: [TEMP_DIR],
          decorators: ["Controller"],
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

      const registryPath = path.join(REGISTRY_DIR, "registry.gen.ts");
      expect(fs.existsSync(registryPath)).toBe(false);
    });
  });
});
