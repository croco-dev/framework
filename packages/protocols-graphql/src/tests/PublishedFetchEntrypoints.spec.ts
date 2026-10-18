import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const packages = ["problems-core", "diagnostics-core", "framework-context", "protocols-graphql"];

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 180_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

describe("published GraphQL fetch entrypoints", () => {
  it("shares guard tokens and enforces root role metadata through ESM and CommonJS fetch guards", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-graphql-fetch-"));
    try {
      const buildRoot = join(root, "build");
      const tarballs = join(root, "tarballs");
      mkdirSync(buildRoot);
      mkdirSync(tarballs);
      // Build copies so another repository task cannot clean this consumer's artifacts.
      for (const name of ["tsconfig", "tooling"]) {
        cpSync(join(repositoryRoot, name), join(buildRoot, name), { recursive: true });
      }
      symlinkSync(join(repositoryRoot, "node_modules"), join(buildRoot, "node_modules"), "dir");
      writeFileSync(join(buildRoot, "package.json"), JSON.stringify({ private: true }));
      writeFileSync(join(buildRoot, "pnpm-workspace.yaml"), "packages: [packages/*]\n");
      for (const name of packages) {
        const source = join(repositoryRoot, "packages", name);
        const target = join(buildRoot, "packages", name);
        mkdirSync(target, { recursive: true });
        for (const entry of ["src", "package.json", "tsconfig.json"]) {
          cpSync(join(source, entry), join(target, entry), { recursive: true });
        }
      }
      for (const name of packages) {
        const source = join(repositoryRoot, "packages", name);
        const target = join(buildRoot, "packages", name);
        const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        // pnpm pack resolves workspace versions in development-only declarations too.
        for (const dependency of Object.keys(manifest.devDependencies ?? {})) {
          const link = join(target, "node_modules", dependency);
          mkdirSync(dirname(link), { recursive: true });
          symlinkSync(realpathSync(join(source, "node_modules", dependency)), link, "dir");
        }
        for (const dependency of Object.keys(manifest.dependencies ?? {})) {
          const internal = dependency.startsWith("@croco/");
          const dependencyPath = internal
            ? join(buildRoot, "packages", dependency.slice("@croco/".length))
            : realpathSync(join(source, "node_modules", dependency));
          const link = join(target, "node_modules", dependency);
          mkdirSync(dirname(link), { recursive: true });
          symlinkSync(dependencyPath, link, "dir");
          const consumerLink = join(root, "node_modules", dependency);
          if (!internal && !existsSync(consumerLink)) {
            mkdirSync(dirname(consumerLink), { recursive: true });
            symlinkSync(dependencyPath, consumerLink, "dir");
          }
        }
        run("pnpm", ["run", "build"], target);
        run("pnpm", ["pack", "--pack-destination", tarballs], target);
        const archive = readdirSync(tarballs).find((file) => file.startsWith(`croco-${name}-`));
        expect(archive).toBeDefined();
        const consumerPackage = join(root, "node_modules/@croco", name);
        mkdirSync(consumerPackage, { recursive: true });
        run(
          "tar",
          ["-xzf", join(tarballs, String(archive)), "-C", consumerPackage, "--strip-components=1"],
          root,
        );
      }
      const assertions = `
import assert from 'node:assert/strict';
assert.equal(root.GRAPHQL_AUTH_GUARD_OPTIONS, fetch.GRAPHQL_AUTH_GUARD_OPTIONS);
assert.equal(root.GraphQLAuthGuard, fetch.GraphQLAuthGuard);
class Resolver { value() {} }
root.Roles('admin')(Resolver.prototype, 'value', Object.getOwnPropertyDescriptor(Resolver.prototype, 'value'));
const guard = new fetch.GraphQLRolesGuard();
const context = { root: new Resolver(), args: {}, context: { user: { roles: ['viewer'] } }, info: { fieldName: 'value' } };
assert.equal(guard.canActivate(context), false);
context.context.user.roles = ['admin'];
assert.equal(guard.canActivate(context), true);
console.log('guard-identity-and-roles-preserved');
`;
      for (const format of ["esm", "cjs"]) {
        const imports =
          format === "esm"
            ? "import * as root from '@croco/protocols-graphql'; import * as fetch from '@croco/protocols-graphql/fetch';"
            : "const root = require('@croco/protocols-graphql'); const fetch = require('@croco/protocols-graphql/fetch');";
        const consumer = `consumer.${format === "esm" ? "mjs" : "cjs"}`;
        const source =
          format === "esm"
            ? assertions
            : assertions.replace(
                "import assert from 'node:assert/strict';",
                "const assert = require('node:assert/strict');",
              );
        writeFileSync(join(root, consumer), `${imports}\n${source}`);
        expect(run(process.execPath, [consumer], root)).toBe("guard-identity-and-roles-preserved");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 240_000);
});
