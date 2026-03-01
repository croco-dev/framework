import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as esbuild from 'esbuild';
import { ComponentScanner } from './ComponentScanner';

const REFLECT_METADATA_IMPORT = "import 'reflect-metadata';\n";

export interface CrocoPluginConfig {
  reflectMetadata?: boolean;
  scan?: {
    dirs?: string[];
    exclude?: string[];
    decorators?: string[];
    cache?: boolean;
  };
  watch?: {
    optimize?: boolean;
    debounce?: number;
  };
  generateRegistry?: {
    enabled: boolean;
    outDir?: string;
    outFile?: string;
  };
}

export interface NormalizedCrocoPluginConfig {
  reflectMetadata: boolean;
  scan: {
    dirs: string[];
    exclude: string[];
    decorators: string[];
    cache: boolean;
  };
  watch: {
    optimize: boolean;
    debounce: number;
  };
  generateRegistry: {
    enabled: boolean;
    outDir: string;
    outFile: string;
  };
}

function normalizeConfig(config: CrocoPluginConfig | undefined): NormalizedCrocoPluginConfig {
  return {
    reflectMetadata: config?.reflectMetadata ?? true,
    scan: {
      dirs: config?.scan?.dirs ?? ['src'],
      exclude: config?.scan?.exclude ?? ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
      decorators: config?.scan?.decorators ?? ['Component'],
      cache: config?.scan?.cache ?? true,
    },
    watch: {
      optimize: config?.watch?.optimize ?? true,
      debounce: config?.watch?.debounce ?? 0,
    },
    generateRegistry: {
      enabled: config?.generateRegistry?.enabled ?? false,
      outDir: config?.generateRegistry?.outDir ?? '.croco',
      outFile: config?.generateRegistry?.outFile ?? 'registry.gen.ts',
    },
  };
}

function generateRegistryContent(
  controllers: { filePath: string; decorators: string[] }[],
  components: { filePath: string; decorators: string[] }[],
  baseDir: string
): string {
  const lines = ['// AUTO-GENERATED - DO NOT EDIT', ''];

  const controllerFiles = controllers.filter((c) => c.decorators.includes('Controller'));
  const componentFiles = components.filter((c) => c.decorators.includes('Component'));

  const allFiles = [...controllerFiles, ...componentFiles];
  const uniqueFiles = Array.from(new Map(allFiles.map((f) => [f.filePath, f])).values());

  for (const file of uniqueFiles) {
    const relativePath = path.relative(baseDir, file.filePath).replace(/\.ts$/, '').replace(/\\/g, '/');
    const className = path.basename(file.filePath, '.ts');
    lines.push(`import { ${className} } from '${relativePath}';`);
  }

  lines.push('');

  const controllerNames = controllerFiles.map((c) => path.basename(c.filePath, '.ts'));
  const componentNames = componentFiles
    .filter((c) => !controllerFiles.some((ctrl) => ctrl.filePath === c.filePath))
    .map((c) => path.basename(c.filePath, '.ts'));

  lines.push(`export const controllers = [${controllerNames.join(', ')}] as const;`);
  lines.push(`export const components = [${componentNames.join(', ')}] as const;`);
  lines.push('');
  lines.push('export type Controllers = typeof controllers;');
  lines.push('export type Components = typeof components;');

  return lines.join('\n');
}

function resolveEntryPointPath(ep: string | { in: string; out: string }): string {
  return typeof ep === 'string' ? ep : ep.in;
}

export function crocoPlugin(config?: CrocoPluginConfig): esbuild.Plugin {
  const normalizedConfig = normalizeConfig(config);
  const scanner = new ComponentScanner({
    scanDirs: normalizedConfig.scan.dirs,
    exclude: normalizedConfig.scan.exclude,
    decorators: normalizedConfig.scan.decorators,
    cache: normalizedConfig.scan.cache,
  });

  let entryPointPaths: string[] = [];
  let autoImportContent = '';
  let isFirstBuild = true;

  return {
    name: 'croco-plugin',
    setup(build: esbuild.PluginBuild) {
      const isWatchMode = Boolean(build.initialOptions.metafile);

      build.onStart(() => {
        if (normalizedConfig.watch.optimize && isWatchMode) {
          if (isFirstBuild) {
            scanner.clearCache();
            isFirstBuild = false;
          }
        } else {
          scanner.clearCache();
        }

        const rawEntryPoints = build.initialOptions.entryPoints;
        const entryPoints = Array.isArray(rawEntryPoints) ? rawEntryPoints : [];
        entryPointPaths = entryPoints.map((ep: string | { in: string; out: string }) => resolveEntryPointPath(ep));

        const scanDirs = normalizedConfig.scan.dirs;
        if (scanDirs && scanDirs.length > 0) {
          const baseDir = entryPointPaths.length > 0 ? path.dirname(entryPointPaths[0]) : process.cwd();
          try {
            const scanResults = scanner.scan(baseDir);
            const componentFiles = scanResults.filter((r) => r.hasComponent);

            const importStatements = componentFiles.map((result) => {
              const relativePath = path.relative(baseDir, result.filePath);
              const importPath = `./${relativePath.replace(/\.tsx?$/, '')}`;
              return `import '${importPath}';`;
            });

            autoImportContent = `// @croco/auto-import\n${importStatements.join('\n')}\n`;

            if (normalizedConfig.generateRegistry.enabled) {
              const controllers = scanResults.filter((r) => r.decorators.includes('Controller'));
              const components = scanResults.filter((r) => r.decorators.includes('Component'));

              const outPath = path.join(
                normalizedConfig.generateRegistry.outDir,
                normalizedConfig.generateRegistry.outFile
              );
              const registryDir = path.dirname(path.resolve(outPath));
              const content = generateRegistryContent(controllers, components, registryDir);

              const outDir = path.dirname(outPath);
              if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
              }

              fs.writeFileSync(outPath, content);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              errors: [{ text: `Component scan failed: ${message}` }],
            };
          }
        }
      });

      build.onLoad({ filter: /.*/ }, async (args: { path: string }) => {
        const isEntryPoint = entryPointPaths.includes(args.path);
        if (!isEntryPoint) {
          return undefined;
        }

        const prependContents: string[] = [];

        if (normalizedConfig.reflectMetadata) {
          prependContents.push(REFLECT_METADATA_IMPORT.trim());
        }

        if (autoImportContent) {
          prependContents.push(autoImportContent.trim());
        }

        if (prependContents.length === 0) {
          return undefined;
        }

        const originalContent = fs.readFileSync(args.path, 'utf-8');
        const finalContents = `${prependContents.join('\n\n')}\n\n${originalContent}`;

        return {
          contents: finalContents,
          loader: 'ts',
        };
      });

      build.onEnd((result) => {
        if (normalizedConfig.watch.optimize && isWatchMode && result.errors.length === 0) {
          isFirstBuild = false;
        }
      });
    },
  };
}
