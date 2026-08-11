import { readFileSync } from "node:fs";
import { dirname, isAbsolute, parse, resolve } from "node:path";

import { createTestEvidenceRecord, TestEvidenceContractError } from "./test-evidence.mjs";
import {
  type TestEvidenceAttachment,
  type TestEvidenceAttempt,
  type TestEvidenceFidelity,
  type TestEvidenceIntent,
  type TestEvidenceDiagnostic,
  type TestEvidenceObservation,
  type TestEvidenceRecord,
  type TestEvidenceReplay,
  type TestEvidenceResourceStatus,
} from "./test-evidence.mjs";
import { createTestEvidenceFileWriter } from "./test-evidence-files";

export type TestEvidenceReporterContext =
  | {
      readonly diagnostic?: {
        readonly duration: number;
        readonly flaky: boolean;
        readonly retryCount: number;
      };
      readonly fullName: string;
      readonly id: string;
      readonly name: string;
      readonly runner: "vitest";
      readonly source: VitestTask;
      readonly state: "failed" | "passed" | "skipped";
    }
  | {
      readonly expectedStatus: PlaywrightTestResult["status"];
      readonly id: string;
      readonly results: readonly PlaywrightTestResult[];
      readonly runner: "playwright";
      readonly source: {
        readonly results: readonly PlaywrightTestResult[];
        readonly test: PlaywrightTestCase;
      };
      readonly title: string;
      readonly titlePath: readonly string[];
    };

export type TestEvidenceReporterOptions = {
  readonly fidelity: TestEvidenceFidelity;
  readonly packageName?: string | ((context: TestEvidenceReporterContext) => string | undefined);
  readonly attempts?: (context: TestEvidenceReporterContext) => readonly TestEvidenceAttempt[];
  readonly diagnostics?: (
    context: TestEvidenceReporterContext,
  ) => readonly TestEvidenceDiagnostic[];
  readonly intent?: (context: TestEvidenceReporterContext) => TestEvidenceIntent;
  readonly observed?: (context: TestEvidenceReporterContext) => TestEvidenceObservation;
  readonly outputDirectory?: string;
  readonly replay?: (context: TestEvidenceReporterContext) => TestEvidenceReplay;
  readonly resources?: (context: TestEvidenceReporterContext) => TestEvidenceResourceStatus;
  readonly write?: (record: TestEvidenceRecord) => Promise<void> | void;
};

const DEFAULT_VITEST_REPORTER_OPTIONS: TestEvidenceReporterOptions = {
  fidelity: {
    boot: "isolated",
    dependency: "fake",
    isolation: "fake",
    runtime: "node",
    validation: "isolated",
  },
};

const PACKAGE_NAMES_BY_DIRECTORY = new Map<string, string | undefined>();

export type VitestTask = {
  readonly id: string;
  readonly name: string;
  readonly module?: { readonly moduleId: string };
  readonly project?: {
    readonly config?: { readonly root?: string };
    readonly name: string;
  };
  readonly fullName: string;
  readonly diagnostic: () =>
    | {
        readonly duration: number;
        readonly flaky: boolean;
        readonly retryCount: number;
      }
    | undefined;
  readonly result: () => {
    readonly errors?: readonly unknown[];
    readonly state: "failed" | "passed" | "pending" | "skipped";
  };
};

export type PlaywrightTestCase = {
  readonly expectedStatus?: PlaywrightTestResult["status"];
  readonly id: string;
  readonly location?: { readonly file: string };
  readonly parent?: {
    readonly project: () =>
      | {
          readonly name: string;
          readonly testDir: string;
        }
      | undefined;
  };
  readonly title: string;
  readonly titlePath?: () => readonly string[];
};

export type PlaywrightTestResult = {
  readonly attachments?: readonly { readonly name: string; readonly path?: string }[];
  readonly duration: number;
  readonly error?: unknown;
  readonly errors?: readonly unknown[];
  readonly retry?: number;
  readonly status: "failed" | "interrupted" | "passed" | "skipped" | "timedOut";
};

export class CrocoVitestEvidenceReporter {
  private readonly write: (record: TestEvidenceRecord) => Promise<void> | void;

  constructor(
    private readonly options: TestEvidenceReporterOptions = DEFAULT_VITEST_REPORTER_OPTIONS,
  ) {
    this.write = options.write ?? createTestEvidenceFileWriter(options);
  }

  async onTestCaseResult(task: VitestTask): Promise<void> {
    const result = task.result();
    if (result.state === "pending") return;
    const diagnostic = task.diagnostic();
    const attempts = (diagnostic?.retryCount ?? 0) + 1;
    const finalOutcome =
      result.state === "passed" ? "passed" : result.state === "failed" ? "failed" : "skipped";
    const context: TestEvidenceReporterContext = {
      ...(diagnostic ? { diagnostic } : {}),
      fullName: task.fullName,
      id: task.id,
      name: task.name,
      runner: "vitest",
      source: task,
      state: finalOutcome,
    };
    const packageName = resolvePackageName(this.options.packageName, context);
    await this.write(
      createTestEvidenceRecord({
        id: evidenceRecordId(packageName, task.id),
        runner: "vitest",
        ...(packageName ? { packageName } : {}),
        fidelity: this.options.fidelity,
        intent: this.options.intent?.(context) ?? {
          contractIds: [],
          description: task.fullName,
        },
        observed: this.options.observed?.(context) ?? { contractIds: [] },
        replay: this.options.replay?.(context) ?? {
          command: packageName
            ? `pnpm --filter ${JSON.stringify(packageName)} exec vitest run -t ${JSON.stringify(task.fullName)}`
            : `pnpm vitest run -t ${JSON.stringify(task.fullName)}`,
        },
        diagnostics:
          this.options.diagnostics?.(context) ??
          failureDiagnostics(
            result.state === "failed" ? (result.errors ?? []) : [],
            "CROCO_VITEST_TEST_FAILED",
            `Vitest test '${task.fullName}' failed.`,
            result.state === "failed",
          ),
        resources: this.options.resources?.(context) ?? { leaks: [], status: "not-checked" },
        attempts:
          this.options.attempts?.(context) ??
          Array.from({ length: attempts }, (_, index) => ({
            attempt: index + 1,
            outcome: index + 1 === attempts ? finalOutcome : "failed",
            ...(index + 1 === attempts && diagnostic ? { durationMs: diagnostic.duration } : {}),
          })),
      }),
    );
  }
}

function resolvePackageName(
  configured: TestEvidenceReporterOptions["packageName"],
  context: TestEvidenceReporterContext,
): string | undefined {
  const packageName =
    typeof configured === "function"
      ? configured(context)
      : (configured ?? inferPackageName(context));
  return packageName?.trim() || undefined;
}

function inferPackageName(context: TestEvidenceReporterContext): string | undefined {
  if (context.runner === "vitest") {
    const projectRoot = context.source.project?.config?.root;
    return (
      packageNameFromSource(context.source.module?.moduleId, projectRoot) ??
      packageNameFromDirectory(projectRoot) ??
      context.source.project?.name
    );
  }
  const project = context.source.test.parent?.project();
  return (
    packageNameFromSource(context.source.test.location?.file, project?.testDir) ??
    packageNameFromDirectory(project?.testDir) ??
    project?.name
  );
}

function packageNameFromSource(
  source: string | undefined,
  baseDirectory?: string,
): string | undefined {
  if (!source) return undefined;
  const path = isAbsolute(source)
    ? source
    : baseDirectory
      ? resolve(baseDirectory, source)
      : undefined;
  return path ? findPackageName(dirname(path)) : undefined;
}

function packageNameFromDirectory(directory: string | undefined): string | undefined {
  return directory ? findPackageName(directory) : undefined;
}

function findPackageName(startDirectory: string): string | undefined {
  let directory = resolve(startDirectory);
  const root = parse(directory).root;
  const visitedDirectories: string[] = [];
  while (true) {
    if (PACKAGE_NAMES_BY_DIRECTORY.has(directory)) {
      const packageName = PACKAGE_NAMES_BY_DIRECTORY.get(directory);
      for (const visited of visitedDirectories) {
        PACKAGE_NAMES_BY_DIRECTORY.set(visited, packageName);
      }
      return packageName;
    }
    visitedDirectories.push(directory);
    const manifestPath = resolve(directory, "package.json");
    let manifest: unknown;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (error) {
      if (!isMissingFile(error)) {
        throw new TestEvidenceContractError(
          `Unable to read package identity from '${manifestPath}'.`,
          error,
        );
      }
      if (directory === root) {
        for (const visited of visitedDirectories) {
          PACKAGE_NAMES_BY_DIRECTORY.set(visited, undefined);
        }
        return undefined;
      }
      directory = dirname(directory);
      continue;
    }
    if (!isRecord(manifest)) {
      throw new TestEvidenceContractError(
        `Package manifest '${manifestPath}' must contain a JSON object.`,
      );
    }
    if (!("name" in manifest)) {
      if (directory === root) {
        for (const visited of visitedDirectories) {
          PACKAGE_NAMES_BY_DIRECTORY.set(visited, undefined);
        }
        return undefined;
      }
      directory = dirname(directory);
      continue;
    }
    if (typeof manifest["name"] !== "string" || !manifest["name"].trim()) {
      throw new TestEvidenceContractError(
        `Package manifest '${manifestPath}' must declare a non-empty string name.`,
      );
    }
    const packageName = manifest["name"].trim();
    for (const visited of visitedDirectories) {
      PACKAGE_NAMES_BY_DIRECTORY.set(visited, packageName);
    }
    return packageName;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function evidenceRecordId(packageName: string | undefined, id: string): string {
  return packageName ? `${packageName}::${id}` : id;
}

export class CrocoPlaywrightEvidenceReporter {
  private readonly tests = new Map<
    string,
    {
      readonly attempts: PlaywrightTestResult[];
      readonly packageName?: string;
      readonly test: PlaywrightTestCase;
    }
  >();

  private readonly writeRecord: (record: TestEvidenceRecord) => Promise<void> | void;

  constructor(private readonly options: TestEvidenceReporterOptions) {
    this.writeRecord = options.write ?? createTestEvidenceFileWriter(options);
  }

  onTestEnd(test: PlaywrightTestCase, result: PlaywrightTestResult): void {
    const packageName = resolvePackageName(
      this.options.packageName,
      playwrightContext(test, [result]),
    );
    const recordId = evidenceRecordId(packageName, test.id);
    const current = this.tests.get(recordId);
    this.tests.set(recordId, {
      test,
      attempts: [...(current?.attempts ?? []), result],
      ...(packageName ? { packageName } : {}),
    });
  }

  async onEnd(): Promise<void> {
    for (const { test, attempts, packageName } of [...this.tests.values()].sort((left, right) =>
      evidenceRecordId(left.packageName, left.test.id) <
      evidenceRecordId(right.packageName, right.test.id)
        ? -1
        : evidenceRecordId(left.packageName, left.test.id) >
            evidenceRecordId(right.packageName, right.test.id)
          ? 1
          : 0,
    )) {
      await this.write(test, attempts, packageName);
    }
  }

  private async write(
    test: PlaywrightTestCase,
    results: readonly PlaywrightTestResult[],
    packageName: string | undefined,
  ): Promise<void> {
    const chronologicalResults = results
      .map((result, index) => ({ attempt: (result.retry ?? index) + 1, result }))
      .sort((left, right) => left.attempt - right.attempt);
    const outcome = (result: PlaywrightTestResult): TestEvidenceAttempt["outcome"] =>
      playwrightOutcome(result, test.expectedStatus ?? "passed");
    const failed = (result: PlaywrightTestResult): boolean => outcome(result) === "failed";
    const attachments = chronologicalResults.flatMap(({ result }) => playwrightAttachments(result));
    const context = playwrightContext(test, results);
    await this.writeRecord(
      createTestEvidenceRecord({
        id: evidenceRecordId(packageName, test.id),
        runner: "playwright",
        ...(packageName ? { packageName } : {}),
        fidelity: this.options.fidelity,
        intent: this.options.intent?.(context) ?? { contractIds: [], description: test.title },
        observed: this.options.observed?.(context) ?? { contractIds: [] },
        replay: this.options.replay?.(context) ?? {
          command: packageName
            ? `pnpm --filter ${JSON.stringify(packageName)} exec playwright test --grep ${JSON.stringify(test.title)}`
            : `pnpm playwright test --grep ${JSON.stringify(test.title)}`,
        },
        diagnostics:
          this.options.diagnostics?.(context) ??
          failureDiagnostics(
            chronologicalResults
              .filter(({ result }) => failed(result))
              .map(({ result }) => result)
              .flatMap((result) =>
                result.errors && result.errors.length > 0
                  ? result.errors
                  : result.error === undefined
                    ? []
                    : [result.error],
              ),
            "CROCO_PLAYWRIGHT_TEST_FAILED",
            `Playwright test '${test.title}' failed.`,
            chronologicalResults.some(({ result }) => failed(result)),
          ),
        resources: this.options.resources?.(context) ?? { leaks: [], status: "not-checked" },
        attachments,
        attempts:
          this.options.attempts?.(context) ??
          chronologicalResults.map(({ attempt, result }) => ({
            attempt,
            attachments: playwrightAttachments(result),
            durationMs: result.duration,
            outcome: outcome(result),
          })),
      }),
    );
  }
}

function playwrightContext(
  test: PlaywrightTestCase,
  results: readonly PlaywrightTestResult[],
): Extract<TestEvidenceReporterContext, { readonly runner: "playwright" }> {
  return {
    expectedStatus: test.expectedStatus ?? "passed",
    id: test.id,
    results,
    runner: "playwright",
    source: { test, results },
    title: test.title,
    titlePath: test.titlePath?.() ?? [test.title],
  };
}

function playwrightOutcome(
  result: PlaywrightTestResult,
  expectedStatus: PlaywrightTestResult["status"],
): TestEvidenceAttempt["outcome"] {
  if (result.status === "skipped") return "skipped";
  return result.status === expectedStatus ? "passed" : "failed";
}

function playwrightAttachments(result: PlaywrightTestResult): TestEvidenceAttachment[] {
  return (result.attachments ?? []).flatMap(({ name, path }) =>
    path ? [{ kind: attachmentKind(name), path }] : [],
  );
}

function attachmentKind(name: string): TestEvidenceAttachment["kind"] {
  const normalized = name.toLowerCase();
  if (normalized.includes("screenshot")) return "screenshot";
  if (normalized.includes("trace")) return "trace";
  if (normalized.includes("log")) return "log";
  return "report";
}

function failureDiagnostics(
  errors: readonly unknown[],
  code: string,
  fallback: string,
  failed: boolean,
): readonly TestEvidenceDiagnostic[] {
  const messages = errors
    .filter((error) => error !== undefined)
    .map((error) => (error instanceof Error ? error.message : String(error)));
  if (messages.length === 0) {
    return failed ? [{ code, recoveryAction: `${fallback} Inspect the runner output.` }] : [];
  }
  return messages.map((message) => ({
    code,
    recoveryAction: `${fallback} Inspect the runner failure: ${message}`,
  }));
}
