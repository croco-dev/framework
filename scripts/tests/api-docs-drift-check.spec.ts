import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { replaceApiDocs, snapshotTree } from "../api-docs-drift-check.mts";

const SCRIPT_PATH = resolve(__dirname, "../api-docs-drift-check.mts");
const API_DOCS_PATH = join("packages", "docs", "src", "content", "docs", "api");
const TEMP_ROOTS: string[] = [];

type FixtureOptions = {
  readonly createNodeModules?: boolean;
  readonly docs?: Readonly<Record<string, string>>;
  readonly executableDocs?: readonly string[];
  readonly failBuild?: boolean;
  readonly generatedDocs?: Readonly<Record<string, string>>;
  readonly source?: string;
};

type Fixture = {
  readonly bin: string;
  readonly log: string;
  readonly root: string;
};
type Invocation = {
  readonly args: readonly string[];
  readonly cacheOutput: string;
  readonly cacheOutputExisted: boolean;
  readonly cwd: string;
  readonly rootLink: boolean;
  readonly source: string;
  readonly turboCacheDir?: string;
};

describe("api-docs-drift-check.mts", () => {
  afterEach(() => {
    for (const root of TEMP_ROOTS.splice(0)) rmSync(root, { force: true, recursive: true });
  });

  it("uses unstaged source, refreshes the cached candidate, and preserves tracked docs", () => {
    const fixture = createFixture({
      source: "committed",
      docs: { "source.md": "unstaged\n" },
    });
    writeFileSync(join(fixture.root, "packages/example/src/current.txt"), "unstaged");
    const before = snapshotDocs(fixture.root);

    const result = runScript(fixture);
    const calls = readCalls(fixture.log);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("generated API docs match the tracked checkout");
    expect(snapshotDocs(fixture.root)).toEqual(before);
    expect(calls[0]?.args.join(" ")).toBe(
      "turbo run docs:api:render --filter=@croco/docs --cache=local:rw --cache-dir=.turbo/cache --env-mode=strict --output-logs=errors-only",
    );
    expect(calls).toHaveLength(1);
    expect(calls.every((call) => call.cwd === realpathSync(fixture.root))).toBe(true);
    expect(calls.every((call) => !call.rootLink)).toBe(true);
    expect(calls.every((call) => call.source === "unstaged\n")).toBe(true);
    expect(calls.every((call) => !call.cacheOutputExisted)).toBe(true);
    expect(calls.every((call) => call.turboCacheDir === undefined)).toBe(true);
    expect(calls.every((call) => existsSync(call.cacheOutput))).toBe(true);
  });

  it("compares the formatter-ready cached candidate without invoking a second formatter", () => {
    const fixture = createFixture({
      docs: { "source.md": "source\n" },
      generatedDocs: { "source.md": "source  \n" },
    });

    const result = runScript(fixture);
    const calls = readCalls(fixture.log);

    expect(result.status).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0]).toBe("turbo");
  });

  it("lists added, deleted, changed, and mode-changed API docs without changing primary files", () => {
    const fixture = createFixture({
      docs: { "deleted.md": "old\n", "mode.md": "same\n", "stale.md": "old\n" },
      generatedDocs: {
        "added.md": "new\n",
        "mode.md": "same\n",
        "stale.md": "new\n",
      },
      executableDocs: ["mode.md"],
    });
    const before = snapshotDocs(fixture.root);

    const result = runScript(fixture);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("added: added.md");
    expect(result.stdout).toContain("deleted: deleted.md");
    expect(result.stdout).toContain("changed: stale.md");
    expect(result.stdout).toContain("mode-changed: mode.md");
    expect(result.stdout).toContain("recovery: pnpm docs:api:write");
    expect(result.stdout).toContain("commit the resulting files");
    expect(snapshotDocs(fixture.root)).toEqual(before);
  });

  it("writes the formatted generated tree only when explicitly requested", () => {
    const fixture = createFixture({
      docs: { "deleted.md": "old\n", "stale.md": "old\n" },
      generatedDocs: { "added.md": "new  \n", "stale.md": "new\n" },
    });

    const result = runScript(fixture, "--write");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("wrote generated API docs to the tracked checkout");
    expect(snapshotDocs(fixture.root)).toEqual({
      "added.md": "420:new\n",
      "stale.md": "420:new\n",
    });
  });

  it.skipIf(process.platform === "win32")(
    "preserves the tracked API tree when atomic write staging fails",
    () => {
      const fixture = createFixture({
        docs: { "source.md": "old\n" },
        generatedDocs: { "source.md": "new\n" },
      });
      const before = snapshotDocs(fixture.root);
      const apiParent = dirname(join(fixture.root, API_DOCS_PATH));
      chmodSync(apiParent, 0o555);
      const result = (() => {
        try {
          return runScript(fixture, "--write");
        } finally {
          chmodSync(apiParent, 0o755);
        }
      })();

      expect(result.status).toBe(1);
      expect(snapshotDocs(fixture.root)).toEqual(before);
    },
  );

  it("restores the previous API tree when the atomic install rename fails", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-api-docs-rollback-"));
    TEMP_ROOTS.push(root);
    const target = join(root, API_DOCS_PATH);
    const generated = join(root, "generated-api-docs");
    write(join(target, "source.md"), "old\n");
    write(join(generated, "source.md"), "new\n");
    const before = snapshotDocs(root);
    let renameCount = 0;

    expect(() =>
      replaceApiDocs(root, generated, snapshotTree(generated), {
        rename(source, destination) {
          renameCount++;
          if (renameCount === 2) throw new Error("injected install rename failure");
          renameSync(source, destination);
        },
      }),
    ).toThrow("injected install rename failure");

    expect(renameCount).toBe(3);
    expect(snapshotDocs(root)).toEqual(before);
    expect(
      readdirSync(dirname(target)).filter(
        (entry) => entry.startsWith("api.next-") || entry.startsWith("api.previous-"),
      ),
    ).toEqual([]);
  });

  it("cleans up and preserves primary files after generator failure", () => {
    const fixture = createFixture({ failBuild: true });
    const before = snapshotDocs(fixture.root);
    const result = runScript(fixture);
    const calls = readCalls(fixture.log);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("failed with exit code 23");
    expect(snapshotDocs(fixture.root)).toEqual(before);
    expect(calls).toHaveLength(1);
    expect(existsSync(calls[0]?.cacheOutput ?? fixture.root)).toBe(false);
  });

  it("fails before invoking pnpm when installed dependencies are missing", () => {
    const fixture = createFixture({ createNodeModules: false });
    const result = runScript(fixture);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("missing root node_modules");
    expect(result.stdout).toContain("run pnpm install");
    expect(existsSync(fixture.log)).toBe(false);
  });
});

function createFixture(options: FixtureOptions = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "croco-api-docs-fixture-"));
  const bin = mkdtempSync(join(tmpdir(), "croco-api-docs-bin-"));
  TEMP_ROOTS.push(root, bin);
  mkdirSync(join(root, API_DOCS_PATH), { recursive: true });
  mkdirSync(join(root, "packages/example/src"), { recursive: true });
  writeFileSync(join(root, "packages/example/src/current.txt"), options.source ?? "source");
  for (const [path, content] of Object.entries(
    options.docs ?? { "source.md": `${options.source ?? "source"}\n` },
  )) {
    write(join(root, API_DOCS_PATH, path), content);
  }
  write(
    join(root, ".api-docs-fixture.json"),
    JSON.stringify({
      executableDocs: options.executableDocs ?? [],
      failBuild: options.failBuild ?? false,
      generatedDocs: options.generatedDocs ?? null,
    }),
  );
  if (options.createNodeModules !== false) {
    mkdirSync(join(root, "node_modules/.pnpm"), { recursive: true });
    mkdirSync(join(root, "packages/example/node_modules"), { recursive: true });
  }
  git(root, ["init", "-q"]);
  git(root, ["add", "."]);
  const log = join(bin, "calls.jsonl");
  writeFileSync(join(bin, "pnpm"), fakePnpm(), { mode: 0o755 });
  return { bin, log, root };
}

function fakePnpm(): string {
  return `#!/usr/bin/env node
const fs=require("node:fs"),path=require("node:path"),cwd=process.cwd(),args=process.argv.slice(2);
const cacheOutput=path.join(cwd,"packages/docs/.turbo/docs-api/rendered");
const cacheOutputExisted=fs.existsSync(cacheOutput);
const rootLink=fs.lstatSync(path.join(cwd,"node_modules")).isSymbolicLink();
const source=fs.readFileSync(path.join(cwd,"packages/example/src/current.txt"),"utf8")+"\\n";
fs.appendFileSync(process.env.FAKE_PNPM_LOG,JSON.stringify({args,cacheOutput,cacheOutputExisted,cwd,rootLink,source,turboCacheDir:process.env.TURBO_CACHE_DIR})+"\\n");
const fixture=JSON.parse(fs.readFileSync(path.join(cwd,".api-docs-fixture.json"),"utf8"));
if(args[0]==="turbo"){
 if(fixture.failBuild)process.exit(23);
 fs.rmSync(cacheOutput,{recursive:true,force:true});fs.mkdirSync(cacheOutput,{recursive:true});
 const docs=fixture.generatedDocs||{"source.md":source};
 for(const [name,content] of Object.entries(docs)){const target=path.join(cacheOutput,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content.replace(/ +$/gm,""))}
 for(const name of fixture.executableDocs)fs.chmodSync(path.join(cacheOutput,name),0o755);
}
`;
}

function runScript(fixture: Fixture, mode: "--check" | "--write" = "--check") {
  return spawnSync(
    "node",
    ["--experimental-strip-types", SCRIPT_PATH, mode, "--root", fixture.root],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        FAKE_PNPM_LOG: fixture.log,
        FIXTURE_ROOT: fixture.root,
        PATH: `${fixture.bin}:${process.env.PATH ?? ""}`,
      },
    },
  );
}

function git(root: string, args: readonly string[]): void {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}

function readCalls(path: string): readonly Invocation[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function snapshotDocs(root: string): Readonly<Record<string, string>> {
  const docsRoot = join(root, API_DOCS_PATH);
  return Object.fromEntries(
    files(docsRoot).map((path) => [
      path,
      `${statSync(join(docsRoot, path)).mode & 0o777}:${readFileSync(join(docsRoot, path), "utf8")}`,
    ]),
  );
}

function files(root: string, prefix = ""): readonly string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? join(prefix, entry.name) : entry.name;
    return entry.isDirectory() ? files(root, path) : [path];
  });
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
