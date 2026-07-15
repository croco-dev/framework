import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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
  readonly buildRoot: string;
  readonly cwd: string;
  readonly rootLink: boolean;
  readonly source: string;
  readonly turboCacheDir: string;
};

describe("api-docs-drift-check.mts", () => {
  afterEach(() => {
    for (const root of TEMP_ROOTS.splice(0)) rmSync(root, { force: true, recursive: true });
  });

  it("uses unstaged tracked source and generates only in a temporary workspace", () => {
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
    expect(calls[0]?.args.join(" ")).toBe("turbo run docs:build --force --env-mode=loose");
    expect(calls).toHaveLength(1);
    expect(calls.every((call) => call.cwd === realpathSync(fixture.root))).toBe(true);
    expect(calls.every((call) => !call.rootLink)).toBe(true);
    expect(calls.every((call) => call.source === "unstaged\n")).toBe(true);
    expect(calls.every((call) => call.turboCacheDir === join(call.buildRoot, "turbo-cache"))).toBe(
      true,
    );
    expect(calls.every((call) => !existsSync(call.buildRoot))).toBe(true);
  });

  it("formats only raw generated differences before comparing them", () => {
    const fixture = createFixture({
      docs: { "source.md": "source\n" },
      generatedDocs: { "source.md": "source  \n" },
    });

    const result = runScript(fixture);
    const calls = readCalls(fixture.log);

    expect(result.status).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args).toEqual([
      "exec",
      "oxfmt",
      "--write",
      join(calls[1]?.buildRoot ?? "", "src/content/docs/api/source.md"),
    ]);
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
    expect(result.stdout).toContain("generation: pnpm docs:build");
    expect(result.stdout).toContain(`formatting: pnpm exec oxfmt --write ${API_DOCS_PATH}`);
    expect(result.stdout).toContain("commit the resulting files");
    expect(snapshotDocs(fixture.root)).toEqual(before);
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
    expect(existsSync(calls[0]?.buildRoot ?? fixture.root)).toBe(false);
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
const buildRoot=process.env.CROCO_DOCS_BUILD_ROOT;
const rootLink=fs.lstatSync(path.join(cwd,"node_modules")).isSymbolicLink();
const sourcePath=path.join(buildRoot,"src/content/docs/api/source.md");
const source=fs.existsSync(sourcePath)?fs.readFileSync(sourcePath,"utf8"):"";
fs.appendFileSync(process.env.FAKE_PNPM_LOG,JSON.stringify({args,buildRoot,cwd,rootLink,source,turboCacheDir:process.env.TURBO_CACHE_DIR})+"\\n");
const fixture=JSON.parse(fs.readFileSync(path.join(cwd,".api-docs-fixture.json"),"utf8"));
if(args[0]==="turbo"){
 if(fixture.failBuild)process.exit(23);
 const api=path.join(buildRoot,"src/content/docs/api");fs.rmSync(api,{recursive:true,force:true});fs.mkdirSync(api,{recursive:true});
 const docs=fixture.generatedDocs||{"source.md":fs.readFileSync(path.join(cwd,"packages/example/src/current.txt"),"utf8")+"\\n"};
 for(const [name,content] of Object.entries(docs)){const target=path.join(api,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}
 for(const name of fixture.executableDocs)fs.chmodSync(path.join(api,name),0o755);
}
if(args[0]==="exec"&&args[1]==="oxfmt"){
 for(const file of args.slice(3))fs.writeFileSync(file,fs.readFileSync(file,"utf8").replace(/ +$/gm,""))
}
`;
}

function runScript(fixture: Fixture) {
  return spawnSync("node", ["--experimental-strip-types", SCRIPT_PATH, "--root", fixture.root], {
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_PNPM_LOG: fixture.log,
      FIXTURE_ROOT: fixture.root,
      PATH: `${fixture.bin}:${process.env.PATH ?? ""}`,
    },
  });
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
