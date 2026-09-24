import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const commandTimeoutMs = 180_000;

describe("published generated DI graph", () => {
  it("compiles and runs a source-free consumer using packed Croco packages and a versioned library descriptor", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-packed-di-consumer-"));
    const packDir = join(root, "tarballs");
    const libraryDir = join(root, "library");
    const consumerDir = join(root, "consumer");

    try {
      mkdirSync(packDir);
      const packed = packCrocoPackages(packDir);
      writePackageJson(libraryDir, {
        name: "@fixture/packed-library",
        version: "1.0.0",
        private: true,
        type: "module",
      });
      writeOverrides(libraryDir, packed);
      installPackedDependencies(libraryDir, packed);
      writeFileSync(
        join(libraryDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            module: "NodeNext",
            moduleResolution: "NodeNext",
            skipLibCheck: true,
            strict: true,
            target: "ES2022",
          },
          include: ["src/**/*.ts"],
        }),
      );
      writeFileSync(
        join(libraryDir, "src/LibraryService.ts"),
        'import { Component } from "@croco/framework-context";\n@Component() export class LibraryService { readonly source = "packed-library"; }\n',
      );
      writeFileSync(
        join(libraryDir, "build.mjs"),
        `import { compileDiGraph, createDiPackageDescriptor, writeDiGraph, writeDiPackageDescriptor } from "@croco/esbuild-plugin";
import { build } from "esbuild";
const graph = compileDiGraph({ baseDir: process.cwd(), graphId: "@fixture/packed-library", packageName: "@fixture/packed-library" });
writeDiGraph(graph);
await build({ entryPoints: ["src/LibraryService.ts", graph.outFile], outdir: "dist", outbase: process.cwd(), bundle: false, format: "esm", platform: "node", tsconfig: "tsconfig.json" });
writeDiPackageDescriptor("dist/croco-di.json", createDiPackageDescriptor(graph, { packageName: "@fixture/packed-library", packageVersion: "1.0.0", graphImport: "./.croco/di.generated.js" }));
`,
      );
      run("node", ["build.mjs"], libraryDir);
      writeFileSync(
        join(libraryDir, "dist/src/LibraryService.d.ts"),
        "export declare class LibraryService { readonly source: string; }\n",
      );
      writeFileSync(
        join(libraryDir, "dist/.croco/di.generated.d.ts"),
        'export declare const generatedDiGraph: import("@croco/framework-context").GeneratedDiGraph;\n',
      );
      writePackageJson(libraryDir, {
        name: "@fixture/packed-library",
        version: "1.0.0",
        type: "module",
        files: ["dist"],
        peerDependencies: { "@croco/framework-context": "*" },
        exports: {
          ".": { types: "./dist/src/LibraryService.d.ts", default: "./dist/src/LibraryService.js" },
          "./croco-di.json": "./dist/croco-di.json",
        },
      });
      const libraryTarball = join(
        packDir,
        run("npm", ["pack", "--silent", "--pack-destination", packDir], libraryDir).trim(),
      );

      writePackageJson(consumerDir, { name: "packed-di-consumer", private: true, type: "module" });
      writeOverrides(consumerDir, packed);
      installPackedDependencies(consumerDir, packed, libraryTarball);
      writeFileSync(
        join(consumerDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            module: "NodeNext",
            moduleResolution: "NodeNext",
            skipLibCheck: true,
            strict: true,
            target: "ES2022",
          },
          include: ["src/**/*.ts"],
        }),
      );
      writeFileSync(
        join(consumerDir, "src/AppService.ts"),
        'import { Component } from "@croco/framework-context";\nimport { LibraryService } from "@fixture/packed-library";\n@Component() export class AppService { constructor(readonly library: LibraryService) {} }\n',
      );
      writeFileSync(
        join(consumerDir, "runtime.ts"),
        `import { ApplicationRuntime } from "@croco/framework-module";
import { generatedDiGraph } from "./.croco/di.generated";
import { AppService } from "./src/AppService";
Reflect.getMetadata = () => { throw new Error("reflection fallback was used"); };
Reflect.getOwnMetadata = () => { throw new Error("reflection fallback was used"); };
const app = new ApplicationRuntime({ generatedGraph: generatedDiGraph });
await app.initialize();
if (app.get(AppService).library.source !== "packed-library") throw new Error("packed graph resolution failed");
await app.dispose();
process.stdout.write("packed graph consumer passed");
`,
      );
      writeFileSync(
        join(consumerDir, "build.mjs"),
        `import { compileDiGraph, writeDiGraph } from "@croco/esbuild-plugin";
import { build } from "esbuild";
const graph = compileDiGraph({ baseDir: process.cwd(), packageDescriptors: ["@fixture/packed-library/croco-di.json"] });
writeDiGraph(graph);
await build({ entryPoints: ["runtime.ts"], outfile: "runtime.mjs", bundle: true, format: "esm", platform: "node", tsconfig: "tsconfig.json" });
`,
      );

      run("node", ["build.mjs"], consumerDir);
      const manifest = JSON.parse(
        readFileSync(join(consumerDir, ".croco/di.manifest.json"), "utf8"),
      ) as {
        packages: { packageName: string; packageVersion: string }[];
      };
      expect(manifest.packages).toEqual([
        expect.objectContaining({
          packageName: "@fixture/packed-library",
          packageVersion: "1.0.0",
        }),
      ]);
      expect(existsSync(join(consumerDir, "node_modules/@fixture/packed-library/src"))).toBe(false);
      expect(existsSync(join(consumerDir, "node_modules/typedi"))).toBe(false);
      expect(run("node", ["runtime.mjs"], consumerDir)).toBe("packed graph consumer passed");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  }, 360_000);
});

function packCrocoPackages(packDir: string): Record<string, string> {
  run("pnpm", ["--filter", "@croco/framework-module...", "build"], repositoryRoot);
  run("pnpm", ["--filter", "@croco/esbuild-plugin", "build"], repositoryRoot);
  const packages = [
    "problems-core",
    "diagnostics-core",
    "framework-context",
    "framework-module",
    "esbuild-plugin",
  ];
  const packed: Record<string, string> = {};
  for (const name of packages) {
    run(
      "pnpm",
      ["--filter", `@croco/${name}`, "pack", "--pack-destination", packDir],
      repositoryRoot,
    );
    const tarball = readdirSync(packDir).find(
      (entry) => entry.startsWith(`croco-${name}-`) && entry.endsWith(".tgz"),
    );
    if (!tarball) throw new Error(`Missing packed @croco/${name} tarball`);
    packed[`@croco/${name}`] = join(packDir, tarball);
  }
  return packed;
}

function writePackageJson(directory: string, manifest: object): void {
  mkdirSync(join(directory, "src"), { recursive: true });
  writeFileSync(join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeOverrides(directory: string, packed: Record<string, string>): void {
  writeFileSync(
    join(directory, "pnpm-workspace.yaml"),
    `packages:\n  - .\noverrides:\n${Object.entries(packed)
      .map(([name, tarball]) => `  ${JSON.stringify(name)}: ${JSON.stringify(`file:${tarball}`)}`)
      .join("\n")}\n`,
  );
}

function installPackedDependencies(
  directory: string,
  packed: Record<string, string>,
  libraryTarball?: string,
): void {
  run(
    "pnpm",
    [
      "add",
      "--prod",
      ...Object.values(packed),
      ...(libraryTarball ? [libraryTarball] : []),
      "esbuild@0.20.2",
      "typescript@6.0.3",
      "--ignore-scripts",
    ],
    directory,
  );
}

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: commandTimeoutMs });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout.trim();
}
