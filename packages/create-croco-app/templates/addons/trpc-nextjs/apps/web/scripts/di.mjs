import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const name = "CrocoDi";

function writeChanged(file, content) {
  if (existsSync(file) && readFileSync(file, "utf8") === content) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, content);
  renameSync(`${file}.tmp`, file);
}

async function compile(baseDir, files, directories) {
  const { compileDiGraph } = await import("@croco/esbuild-plugin");
  const { default: ts } = await import("typescript");
  const configFile = resolve(baseDir, "di.config.json");
  const fromApp = createRequire(resolve(baseDir, "package.json"));
  files.add(configFile);
  const options = JSON.parse(readFileSync(configFile, "utf8"));
  const tsconfig = resolve(baseDir, options.tsconfig ?? "tsconfig.json");
  // Track the real config inheritance chain, including files outside scan roots.
  const parsed = ts.getParsedCommandLineOfConfigFile(
    tsconfig,
    {},
    {
      ...ts.sys,
      getCurrentDirectory: () => baseDir,
      fileExists(file) {
        files.add(file);
        return ts.sys.fileExists(file);
      },
      readFile(file) {
        files.add(file);
        return ts.sys.readFile(file);
      },
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (parsed?.errors.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => baseDir,
        getNewLine: () => "\n",
      }),
    );
  }
  for (const dir of options.scanDirs ?? ["src"]) directories.add(resolve(baseDir, dir));
  for (const descriptor of options.packageDescriptors ?? []) {
    const file =
      descriptor.startsWith(".") || descriptor.startsWith("/")
        ? resolve(baseDir, descriptor)
        : fromApp.resolve(descriptor);
    files.add(file);
    directories.add(dirname(file));
  }
  return compileDiGraph({ ...options, baseDir });
}

export async function generateDi(baseDir = process.cwd()) {
  const result = await compile(baseDir, new Set(), new Set());
  const { writeDiGraph } = await import("@croco/esbuild-plugin");
  writeDiGraph(result);
  return result;
}

export class CrocoDiWebpackPlugin {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  apply(compiler) {
    const baseDir = this.baseDir;
    const stateFile = resolve(baseDir, ".croco/di.development.json");
    const configFile = resolve(baseDir, "di.config.json");
    let files = new Set([configFile]);
    let directories = new Set([baseDir]);
    let failure;

    compiler.hooks.beforeCompile.tapPromise(name, async () => {
      failure = undefined;
      writeChanged(stateFile, JSON.stringify({ status: "building" }));
      try {
        const nextFiles = new Set([configFile]);
        const nextDirectories = new Set();
        let result;
        try {
          result = await compile(baseDir, nextFiles, nextDirectories);
        } finally {
          for (const file of nextFiles) files.add(file);
          for (const directory of nextDirectories) directories.add(directory);
        }
        files = nextFiles;
        directories = nextDirectories;
        for (const file of result.watchFiles) files.add(file);
        for (const directory of result.watchDirs) directories.add(directory);
        // Publish the manifest first and graph last, before webpack reads either.
        // The ready marker commits the pair; unchanged bytes never trigger another build.
        writeChanged(result.manifestFile, `${JSON.stringify(result.manifest, null, 2)}\n`);
        writeChanged(result.outFile, result.code);
        writeChanged(
          stateFile,
          JSON.stringify({
            status: "ready",
            inputHash: result.manifest.inputHash,
            revision: randomUUID(),
          }),
        );
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error));
        writeChanged(stateFile, JSON.stringify({ status: "failed" }));
      }
    });
    compiler.hooks.afterCompile.tap(name, (compilation) => {
      for (const file of files) {
        (existsSync(file) ? compilation.fileDependencies : compilation.missingDependencies).add(
          file,
        );
      }
      for (const directory of directories) compilation.contextDependencies.add(directory);
      if (failure) {
        failure.message = `${failure.message}\nCorrect the source/configuration; Croco DI regenerates on the next edit.`;
        compilation.errors.push(failure);
      }
    });
  }
}

export function withCrocoDi(config, baseDir) {
  const previous = config.webpack;
  return {
    ...config,
    webpack(webpackConfig, context) {
      const result = previous ? previous(webpackConfig, context) : webpackConfig;
      if (context.dev && context.isServer && context.nextRuntime === "nodejs") {
        result.plugins.push(new CrocoDiWebpackPlugin(baseDir));
        result.plugins.push(
          new context.webpack.DefinePlugin({
            "process.env.CROCO_DI_DEV_STATE": JSON.stringify(
              resolve(baseDir, ".croco/di.development.json"),
            ),
          }),
        );
      }
      return result;
    },
  };
}
