import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "tsup";

const usage =
  "node packages/testing/scripts/verifyTestEvidenceReplay.mjs --playwright-package <installed @playwright/test directory>";
assert.equal(process.argv[2], "--playwright-package", usage);
assert.equal(process.argv.length, 4, usage);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const vitestDirectory = dirname(require.resolve("vitest/package.json"));
const playwrightDirectory = resolve(process.argv[3]);
const source = resolve(packageRoot, "src/libs/test-evidence-reporters.ts");
const title = "returns (cached) [ready].+";
const shellTitle = "shell 'quotes' $CROCO_REPLAY_LITERAL `printf substituted` \\path";
mkdirSync(resolve(packageRoot, ".turbo"), { recursive: true });
const bundleDirectory = mkdtempSync(resolve(packageRoot, ".turbo/replay-smoke-"));

function execute(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
}

try {
  // Keep normal package resolution for the reporter's existing dependencies.
  await build({
    entry: { reporter: source },
    outDir: bundleDirectory,
    outExtension: () => ({ js: ".cjs" }),
    format: ["cjs"],
    platform: "node",
    dts: false,
    silent: true,
    splitting: false,
  });
  console.log(
    JSON.stringify({
      sourceSha256: createHash("sha256").update(readFileSync(source)).digest("hex"),
      node: process.versions.node,
      vitest: JSON.parse(readFileSync(resolve(vitestDirectory, "package.json"), "utf8")).version,
      playwright: JSON.parse(readFileSync(resolve(playwrightDirectory, "package.json"), "utf8"))
        .version,
    }),
  );

  for (const [runner, projectName] of [
    ["vitest", "node-tests"],
    ["playwright", "browser"],
    ["playwright", ""],
  ]) {
    let workspace = mkdtempSync(resolve(tmpdir(), "croco-replay-smoke-"));
    const ownedDirectories = [workspace];
    try {
      mkdirSync(resolve(workspace, "node_modules/.bin"), { recursive: true });
      mkdirSync(resolve(workspace, "node_modules/@playwright"), { recursive: true });
      symlinkSync(vitestDirectory, resolve(workspace, "node_modules/vitest"), "dir");
      symlinkSync(playwrightDirectory, resolve(workspace, "node_modules/@playwright/test"), "dir");
      const vitestCli = resolve(vitestDirectory, "vitest.mjs");
      const playwrightCli = resolve(playwrightDirectory, "cli.js");
      symlinkSync(vitestCli, resolve(workspace, "node_modules/.bin/vitest"));
      symlinkSync(playwrightCli, resolve(workspace, "node_modules/.bin/playwright"));
      writeFileSync(
        resolve(workspace, "package.json"),
        JSON.stringify({ name: "@croco/replay-fixture", type: "module", private: true }),
      );
      writeFileSync(resolve(workspace, "pnpm-workspace.yaml"), "packages:\n  - '.'\n");
      const reporter =
        runner === "vitest" ? "CrocoVitestEvidenceReporter" : "CrocoPlaywrightEvidenceReporter";
      writeFileSync(
        resolve(workspace, "evidence-reporter.cjs"),
        `const {${reporter}: Reporter} = require(${JSON.stringify(resolve(bundleDirectory, "reporter.cjs"))});
module.exports = class extends Reporter {
  constructor() {
    super({
      fidelity: {boot:'isolated',dependency:'fake',isolation:'fake',runtime:'node',validation:'isolated'},
      outputDirectory: 'evidence',
      intent: c => ({contractIds: [], description: c.runner === 'vitest' ? c.source.module.moduleId + ' ' + c.fullName : c.titlePath.join(' > ')})
    });
  }
};`,
      );
      const prelude =
        runner === "vitest"
          ? "import {test,describe} from 'vitest';"
          : "import {test} from '@playwright/test'; const describe=test.describe;";
      const suite =
        runner === "vitest"
          ? "describe('suite > [a]',()=>{"
          : "describe('suite > [a]',{tag:'@group one [1]'},()=>{";
      const fixture = `${prelude}
import {appendFileSync} from 'node:fs';
const mark = label => appendFileSync('executed.jsonl', JSON.stringify(label) + '\\n');
${suite}
for (const [name,label] of ${JSON.stringify([
        [title, "target"],
        ["returns cached rX", "regex-only"],
        [title + " extra", "suffix"],
        [title + " @group one [1]", "tag-suffix"],
        [shellTitle, "shell"],
      ])}) test(name,()=>mark(label));
});
describe('other suite',()=>{test(${JSON.stringify(title)},()=>mark('other-suite'));});`;
      writeFileSync(resolve(workspace, "--Replay [1].spec.mjs"), fixture);
      writeFileSync(
        resolve(workspace, "Other.spec.mjs"),
        fixture.replace("mark(label)", "mark('other-file')"),
      );
      mkdirSync(resolve(workspace, "nested"));
      writeFileSync(
        resolve(workspace, "nested/--Replay [1].spec.mjs"),
        fixture.replace("mark(label)", "mark('overlapping-file')"),
      );
      const config = resolve(
        workspace,
        runner === "vitest" ? "vitest.config.mjs" : "playwright.config.mjs",
      );
      const configPrelude =
        "import {fileURLToPath} from 'node:url'; const reporter=fileURLToPath(new URL('./evidence-reporter.cjs',import.meta.url));";
      writeFileSync(
        config,
        configPrelude +
          (runner === "vitest"
            ? `export default {test:{name:${JSON.stringify(projectName)},include:['**/*.spec.mjs'],reporters:[reporter],maxWorkers:1}};`
            : `export default {testDir:'.',testMatch:'**/*.spec.mjs',workers:1,reporter:[['list'],[reporter]],projects:[{name:${JSON.stringify(projectName)}}]};`),
      );
      execute(
        process.execPath,
        [
          runner === "vitest" ? vitestCli : playwrightCli,
          runner === "vitest" ? "run" : "test",
          "--config",
          config,
        ],
        workspace,
      );
      const records = readdirSync(resolve(workspace, "evidence")).map((file) =>
        JSON.parse(readFileSync(resolve(workspace, "evidence", file), "utf8")),
      );
      const moved = mkdtempSync(resolve(tmpdir(), "croco-replay-moved-"));
      ownedDirectories.push(moved);
      renameSync(workspace, moved);
      workspace = moved;
      for (const [which, name] of [
        ["target", title],
        ["shell", shellTitle],
      ]) {
        const record = records.find(
          (record) =>
            record.intent.description.endsWith(name) &&
            record.intent.description.includes("--Replay [1].spec.mjs") &&
            !record.intent.description.includes("nested/") &&
            record.intent.description.includes("suite > [a]"),
        );
        assert(record, "Native reporter did not emit the target record");
        rmSync(resolve(workspace, "evidence"), { recursive: true, force: true });
        writeFileSync(resolve(workspace, "executed.jsonl"), "");
        execute("sh", ["-c", record.replay.command], workspace);
        const executed = readFileSync(resolve(workspace, "executed.jsonl"), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map(JSON.parse);
        assert.deepEqual(executed, [which]);
        console.log(
          JSON.stringify({ runner, projectName, which, command: record.replay.command, executed }),
        );
      }
    } finally {
      for (const directory of ownedDirectories) rmSync(directory, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(bundleDirectory, { recursive: true, force: true });
}
