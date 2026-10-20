import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const require = createRequire(join(repositoryRoot, "package.json"));
const esbuild = createRequire(require.resolve("tsup")).resolve("esbuild/bin/esbuild");

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 180_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

describe("packed schema descriptor consumer", () => {
  it("preserves descriptors and wrapper helpers without keepNames in ordinary and minified bundles", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-schema-bundle-"));
    try {
      const tarballs = join(root, "tarballs");
      mkdirSync(tarballs);
      // Build source copies so parallel repository builds cannot clean this fixture's dist.
      const buildRoot = join(root, "build");
      mkdirSync(buildRoot);
      for (const directory of ["tsconfig", "tooling"]) {
        cpSync(join(repositoryRoot, directory), join(buildRoot, directory), { recursive: true });
      }
      symlinkSync(join(repositoryRoot, "node_modules"), join(buildRoot, "node_modules"), "dir");
      writeFileSync(join(buildRoot, "package.json"), JSON.stringify({ private: true }));
      writeFileSync(join(buildRoot, "pnpm-workspace.yaml"), "packages: [packages/*]\n");
      for (const name of ["problems-core", "protocols-core"]) {
        const packageDir = join(buildRoot, "packages", name);
        mkdirSync(packageDir, { recursive: true });
        for (const entry of ["src", "package.json", "tsconfig.json"]) {
          cpSync(join(repositoryRoot, "packages", name, entry), join(packageDir, entry), {
            recursive: true,
          });
        }
      }
      const moduleRoot = join(buildRoot, "packages/protocols-core/node_modules");
      mkdirSync(join(moduleRoot, "@croco"), { recursive: true });
      symlinkSync(
        join(buildRoot, "packages/problems-core"),
        join(moduleRoot, "@croco/problems-core"),
        "dir",
      );
      for (const name of ["zod", "reflect-metadata"]) {
        symlinkSync(
          realpathSync(join(repositoryRoot, "packages/protocols-core/node_modules", name)),
          join(moduleRoot, name),
          "dir",
        );
      }
      for (const name of ["problems-core", "protocols-core"]) {
        const packageDir = join(buildRoot, "packages", name);
        run(
          process.execPath,
          [
            require.resolve("tsup/dist/cli-default.js"),
            "src/index.ts",
            "--format",
            "esm,cjs",
            "--minify",
            "--clean",
            "--dts",
          ],
          packageDir,
        );
        run("pnpm", ["pack", "--pack-destination", tarballs], packageDir);
        const tarball = readdirSync(tarballs).find(
          (file) => file.startsWith(`croco-${name}-`) && file.endsWith(".tgz"),
        );
        expect(tarball).toBeDefined();
        const target = join(root, "node_modules/@croco", name);
        mkdirSync(target, { recursive: true });
        run(
          "tar",
          ["-xzf", join(tarballs, String(tarball)), "-C", target, "--strip-components=1"],
          root,
        );
      }
      for (const name of ["zod", "reflect-metadata"]) {
        symlinkSync(
          realpathSync(join(repositoryRoot, "packages/protocols-core/node_modules", name)),
          join(root, "node_modules", name),
          "dir",
        );
      }
      writeFileSync(
        join(root, "consumer.mjs"),
        `
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createOperation, defineOperation, describeZodSchema, getZodSchemaTypeName, isZodArraySchema, getZodInputObjectSchema, getZodArrayElementSchema, unwrapZodEffectsSchema } from '@croco/protocols-core';
import { ProblemFactory } from '@croco/problems-core';
const primitives = [z.string(), z.number(), z.object({ id: z.string() }), z.array(z.string()), z.enum(['draft', 'published'])];
const expectedKinds = ['string', 'number', 'object', 'array', 'enum'];
const wrap = [s => s, s => s.optional(), s => s.default(() => { throw new Error('must not execute defaults'); }), s => s.readonly()];
const results = primitives.flatMap((base, index) => wrap.map((transform, wrapperIndex) => {
  const schema = transform(base);
  const descriptor = describeZodSchema(schema);
  assert.equal(descriptor.kind, [expectedKinds[index], 'optional', 'default', 'readonly'][wrapperIndex]);
  if (wrapperIndex > 0) assert.equal(descriptor.inner.kind, expectedKinds[index]);
  assert.equal(descriptor.jsonSafe, true);
  assert.equal(isZodArraySchema(schema), index === 3);
  assert.equal(getZodInputObjectSchema(schema) !== undefined, index === 2 && wrapperIndex === 0);
  if (index === 3) assert.equal(describeZodSchema(getZodArrayElementSchema(schema)).kind, 'string');
  assert.equal(getZodSchemaTypeName(unwrapZodEffectsSchema(schema.refine(() => true))), getZodSchemaTypeName(schema));
  return descriptor;
}));
const operation = createOperation(defineOperation({
  id: 'product.detail', kind: 'query',
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ id: z.string(), tenant: z.string() }),
  authorize(context) { if (!context.allowed) throw ProblemFactory.forbidden('product/denied'); },
}), (input, context) => ({ id: input.id, tenant: context.tenant, secret: 'private' }));
operation.invoke({ id: 'product_27', tenant: 'attacker' }, { tenant: 'verified', allowed: true }).then(async (value) => {
  assert.deepEqual(value, { id: 'product_27', tenant: 'verified' });
  await assert.rejects(operation.dispatch({ tenant: 'verified', allowed: false }, () => {
    throw new Error('Unauthorized input source must not be read');
  }), { code: 'product/denied' });
  console.log(JSON.stringify([...results, { operation: value }]));
});
`,
      );
      const baseline = run(process.execPath, ["consumer.mjs"], root);
      for (const minify of [false, true]) {
        const outfile = minify ? "minified.cjs" : "bundled.cjs";
        run(
          esbuild,
          [
            "consumer.mjs",
            "--bundle",
            "--platform=node",
            "--format=cjs",
            `--outfile=${outfile}`,
            ...(minify ? ["--minify"] : []),
          ],
          root,
        );
        expect(JSON.parse(run(process.execPath, [outfile], root))).toEqual(JSON.parse(baseline));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 240_000);
});
