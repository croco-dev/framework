import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ProblemCategory } from "@croco/problems-core";
import { expect } from "vitest";
import { z } from "zod";

import type { ContractGraph } from "@croco/protocols-core";

export function createLocaleGraph(): ContractGraph {
  const names = ["Zones", "Tasks", "alphaLower", "AlphaUpper", "task-one", "task_two"];
  return {
    version: "croco.contract-graph.v1",
    controllers: names.map((name, index) => ({
      name: `Controller${index}`,
      path: `/${name}`,
      guards: [],
      roles: [],
      routeIds: [`Controller${index}.list`],
    })),
    routes: names.map((name, index) => ({
      routeId: `Controller${index}.list`,
      operationId: `Controller${index}_list`,
      controllerName: `Controller${index}`,
      methodName: "list",
      httpMethod: "GET",
      path: `/${name}`,
      controllerPath: `/${name}`,
      routeContract: null,
      params: [],
      inputSchema: null,
      inputSchemas: { body: null, path: null, query: null, headers: null },
      outputSchema: z.object({ value: z.string() }),
      domain: name,
      access: { guards: [], roles: [] },
      entitlements: [],
      problemResponses: names.map((code) => ({
        code,
        category: ProblemCategory.Conflict,
        status: 409,
      })),
    })),
    diagnostics: [],
  };
}

export function verifyLocaleArtifacts(
  testUrl: string,
  generate: (directory: string) => void,
): void {
  const childOutput = process.env.CROCO_LOCALE_TEST_OUTPUT;
  if (childOutput) {
    expect(Intl.DateTimeFormat().resolvedOptions().locale).toBe(
      process.env.CROCO_LOCALE_TEST_LANGUAGE,
    );
    generate(childOutput);
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "croco-locale-generation-"));
  const testFile = fileURLToPath(testUrl);
  const packageRoot = path.resolve(path.dirname(testFile), "../..");
  const vitestCli = path.join(
    path.dirname(createRequire(testUrl).resolve("vitest/package.json")),
    "vitest.mjs",
  );
  try {
    const outputs = ["en_US.UTF-8", "et_EE.UTF-8"].map((locale) => {
      const output = path.join(tempRoot, locale);
      fs.mkdirSync(output);
      const result = spawnSync(process.execPath, [vitestCli, "run", testFile, "--maxWorkers=1"], {
        cwd: packageRoot,
        env: {
          ...process.env,
          LANG: locale,
          LC_ALL: locale,
          CROCO_LOCALE_TEST_OUTPUT: output,
          CROCO_LOCALE_TEST_LANGUAGE: locale === "en_US.UTF-8" ? "en-US" : "et-EE",
        },
        encoding: "utf8",
        timeout: 60_000,
      });
      expect(result.error).toBeUndefined();
      expect({
        locale,
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
      }).toMatchObject({ status: 0 });
      const files = fs
        .readdirSync(output, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(output, path.join(entry.parentPath, entry.name)))
        .sort();
      expect(files.length).toBeGreaterThan(0);
      return new Map(files.map((name) => [name, fs.readFileSync(path.join(output, name))]));
    });
    const [english, estonian] = outputs;
    expect([...estonian.keys()]).toEqual([...english.keys()]);
    for (const [name, bytes] of english) {
      expect({ artifact: name, identical: estonian.get(name)?.equals(bytes) }).toEqual({
        artifact: name,
        identical: true,
      });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
