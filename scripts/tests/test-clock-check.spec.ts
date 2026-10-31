import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

import { runStaticMisuseChecks } from "../static-misuse-check.mts";
import { detectTestClockFindings, isControlledTestClockSource } from "../test-clock-check.mts";

const repositories: string[] = [];
const directive = "// croco-test-clock: controlled";
const constructors = `
export class Service {
  constructor(readonly clock: () => Date = () => new Date(), readonly label = 'service') {}
}
export class OptionsService {
  constructor(readonly options: { now?: () => number; schedule?: (callback: () => void, delay: number) => void; label?: string } = {}) {}
}
export class ObjectClockService {
  constructor(readonly clock: { now(): Date } = { now: () => new Date() }) {}
}
export class DateInput {
  constructor(readonly options: { now?: Date; clock?: string; scheduler?: number } = {}) {}
}
`;

afterEach(() => {
  for (const repository of repositories.splice(0))
    rmSync(repository, { recursive: true, force: true });
});

function fixture(body: string, controlled = true) {
  const root = mkdtempSync(join(tmpdir(), "croco-test-clock-"));
  repositories.push(root);
  const file = "packages/example/src/tests/Clock.spec.ts";
  for (const [path, source] of [
    ["packages/example/src/Service.ts", constructors],
    ["packages/example/src/index.ts", 'export * from "./Service.js";'],
    [
      file,
      `${controlled ? directive : ""}\nimport { Service as Reader, OptionsService, ObjectClockService, DateInput } from '@croco/example';\n${body}`,
    ],
  ]) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  const program = ts.createProgram([join(root, file)], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    paths: { "@croco/*": [join(root, "packages/*/src/index.ts")] },
    types: [],
  });
  const source = program.getSourceFile(join(root, file));
  if (!source) throw new TypeError("Fixture source was not loaded");
  const findings = isControlledTestClockSource(file, source.text)
    ? detectTestClockFindings(source, program.getTypeChecker())
    : [];
  return { root, file, source, findings };
}

describe("controlled test clock boundaries", () => {
  it("finds omitted and undefined clocks on aliased imported constructors, including derived instances", () => {
    const { findings } = fixture(`
const clock = () => new Date('2034-03-26T00:00:00Z');
const owner = new Reader(clock);
const reader = new Reader();
const restarted = new Reader(undefined);
const alternate = new Reader(void 0);
declare const maybeClock: (() => Date) | undefined;
new Reader(maybeClock);
`);
    expect(findings.map(({ message }) => message)).toEqual([
      expect.stringContaining("fixture 'clock'"),
      expect.stringContaining("fixture 'clock'"),
      expect.stringContaining("fixture 'clock'"),
      expect.stringContaining("fixture 'clock'"),
    ]);
    expect(findings[0]?.node.getText()).toBe("new Reader()");
  });

  it("requires every declared options seam, including optional values that can fall back to ambient time", () => {
    const { findings } = fixture(`
const now = () => 12;
const schedule = (callback: () => void, _delay: number) => callback();
new OptionsService();
new OptionsService({ now });
new OptionsService({ now: undefined, schedule });
declare const optional: { now?: () => number; schedule: typeof schedule };
new OptionsService(optional);
new OptionsService({ now, schedule });
`);
    expect(findings.map(({ message }) => message)).toEqual([
      expect.stringContaining("options.now"),
      expect.stringContaining("options.schedule"),
      expect.stringContaining("options.schedule"),
      expect.stringContaining("options.now"),
      expect.stringContaining("options.now"),
    ]);
  });

  it("checks clock.now objects while leaving timestamp data and unrelated optional arguments alone", () => {
    const { findings } = fixture(`
new ObjectClockService();
new ObjectClockService({ now: () => new Date('2041-11-03T01:30:00-07:00') });
new DateInput();
new DateInput({ now: new Date('2026-10-13'), clock: 'UTC', scheduler: 1 });
const clock = () => new Date('2026-10-13T00:00:00Z');
new Reader(clock);
`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("fixture 'clock'");
  });

  it("finds ambient reads in callbacks without flagging parsing, date arithmetic, or strings", () => {
    const { findings } = fixture(`
const clock = () => new Date('2026-10-13T00:00:00Z');
new Reader(() => new Date());
new OptionsService({ now: () => Date.now(), schedule: () => {} });
Date();
globalThis.Date.now();
new globalThis.Date();
const parsed = new Date('2026-11-01T09:00:00+09:00');
new Date(parsed.getTime() + 1000);
Date.parse('2026-11-01T00:00:00Z');
Date.UTC(2026, 10, 1);
const text = 'new Date(); Date.now()';
// new Date(); Date.now();
`);
    expect(findings.map(({ node }) => node.getText())).toEqual([
      "new Date()",
      "Date.now()",
      "Date()",
      "globalThis.Date.now()",
      "new globalThis.Date()",
    ]);
  });

  it("does not mistake a locally declared Date object for the ambient clock", () => {
    const { findings } = fixture(`
function customClock() {
  const Date = { now: () => 42 };
  return Date.now();
}
`);
    expect(findings).toEqual([]);
  });

  it("limits real-lifecycle exceptions to the next expression and requires a reason", () => {
    const { findings } = fixture(`
// croco-test-clock-real-time -- Measure native provider connection shutdown, outside business expiry.
const started = Date.now();
const leaked = Date.now();
// croco-test-clock-real-time --
const unexplained = new Date();
// croco-test-clock-real-time -- Native timer completion is measured here.

const notAdjacent = Date.now();
`);
    expect(findings.map(({ node }) => node.getText())).toEqual([
      "Date.now()",
      "new Date()",
      "Date.now()",
    ]);
  });

  it("does not infer a controlled fixture contract without its source declaration", () => {
    const { findings } = fixture("new Reader(); Date.now();", false);
    expect(findings).toEqual([]);
    expect(isControlledTestClockSource("packages/example/src/production.ts", directive)).toBe(
      false,
    );
    expect(isControlledTestClockSource("scripts/tests/fixtures/clock.ts", directive)).toBe(true);
    expect(
      isControlledTestClockSource(
        "scripts/tests/clock.spec.ts",
        `const source = \`\n${directive}\n\`;`,
      ),
    ).toBe(false);
  });

  it("runs through the existing static-misuse gate with a stable location and recovery", () => {
    const { root, file } = fixture("const reader = new Reader();");
    const result = runStaticMisuseChecks(root).find(
      ({ id }) => id === "controlled-test-clock-boundary",
    );
    expect(result?.status).toBe("fail");
    expect(result?.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_STATIC_TEST_CLOCK_BOUNDARY",
        file,
        line: 3,
        column: 16,
        excerpt: "const reader = new Reader();",
        action: expect.stringContaining("bound factory"),
      }),
    ]);
    const cli = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        fileURLToPath(new URL("../static-misuse-check.mts", import.meta.url)),
        "--root",
        root,
      ],
      { encoding: "utf-8" },
    );
    const output = `${cli.stdout}${cli.stderr}`;
    expect(cli.status).toBe(1);
    expect(output).toContain("CROCO_STATIC_TEST_CLOCK_BOUNDARY");
    expect(output).toContain("reasoned next-line real-time exception");
    expect(output).not.toContain(
      "escape hatch: // croco-static-misuse-ignore-next-line CROCO_STATIC_TEST_CLOCK_BOUNDARY",
    );
  });
});
