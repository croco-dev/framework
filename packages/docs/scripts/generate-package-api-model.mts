#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { Application } from "typedoc";

import { apiDocCompilerOptions, apiDocPackages } from "../api-docs.config.mjs";
import { normalizeTypeDocMergeModel } from "./typedoc-merge-normalizer.mjs";

const DOCS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGES_ROOT = dirname(DOCS_ROOT);

async function main(): Promise<void> {
  const packageRoot = resolve(cwd());
  const catalogEntry = apiDocPackages.find(
    ({ directory }) => resolve(PACKAGES_ROOT, directory) === packageRoot,
  );
  if (!catalogEntry) {
    throw new Error(`docs:api:model must run from a documented package directory: ${packageRoot}`);
  }

  const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
    readonly name?: unknown;
  };
  if (packageJson.name !== catalogEntry.packageName) {
    throw new Error(
      `API docs catalog mismatch for ${basename(packageRoot)}: expected ${catalogEntry.packageName}, found ${String(packageJson.name)}`,
    );
  }

  const outputPath = join(packageRoot, ".turbo", "docs-api", "model.json");
  const temporaryOutputPath = `${outputPath}.${process.pid}.tmp`;
  const app = await Application.bootstrap(
    {
      name: catalogEntry.moduleName,
      entryPoints: [join(packageRoot, catalogEntry.entryPoint)],
      compilerOptions: apiDocCompilerOptions,
      disableSources: true,
      excludeInternal: true,
      excludePrivate: true,
      excludeProtected: true,
      excludeReferences: true,
      readme: "none",
      skipErrorChecking: true,
    },
    [],
  );
  const project = await app.convert();
  if (!project || app.logger.hasErrors()) {
    throw new Error(`TypeDoc conversion failed for ${catalogEntry.packageName}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  try {
    await app.generateJson(project, temporaryOutputPath);
    if (app.logger.hasErrors()) {
      throw new Error(`TypeDoc JSON generation failed for ${catalogEntry.packageName}`);
    }
    const model = JSON.parse(await readFile(temporaryOutputPath, "utf8")) as unknown;
    normalizeTypeDocMergeModel(model, catalogEntry.directory);
    await writeFile(temporaryOutputPath, `${JSON.stringify(model, null, "\t")}\n`);
    await rename(temporaryOutputPath, outputPath);
  } finally {
    await rm(temporaryOutputPath, { force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  exit(1);
});
