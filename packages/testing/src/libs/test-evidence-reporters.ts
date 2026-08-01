import { createTestEvidenceRecord } from "./test-evidence.mjs";
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

export type VitestTask = {
  readonly id: string;
  readonly name: string;
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

  constructor(private readonly options: TestEvidenceReporterOptions) {
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
    await this.write(
      createTestEvidenceRecord({
        id: task.id,
        runner: "vitest",
        fidelity: this.options.fidelity,
        intent: this.options.intent?.(context) ?? {
          contractIds: [],
          description: task.fullName,
        },
        observed: this.options.observed?.(context) ?? { contractIds: [] },
        replay: this.options.replay?.(context) ?? {
          command: `pnpm vitest run -t ${JSON.stringify(task.fullName)}`,
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

export class CrocoPlaywrightEvidenceReporter {
  private readonly tests = new Map<
    string,
    { readonly attempts: PlaywrightTestResult[]; readonly test: PlaywrightTestCase }
  >();

  private readonly writeRecord: (record: TestEvidenceRecord) => Promise<void> | void;

  constructor(private readonly options: TestEvidenceReporterOptions) {
    this.writeRecord = options.write ?? createTestEvidenceFileWriter(options);
  }

  onTestEnd(test: PlaywrightTestCase, result: PlaywrightTestResult): void {
    const current = this.tests.get(test.id);
    this.tests.set(test.id, { test, attempts: [...(current?.attempts ?? []), result] });
  }

  async onEnd(): Promise<void> {
    for (const { test, attempts } of [...this.tests.values()].sort((left, right) =>
      left.test.id < right.test.id ? -1 : left.test.id > right.test.id ? 1 : 0,
    )) {
      await this.write(test, attempts);
    }
  }

  private async write(
    test: PlaywrightTestCase,
    results: readonly PlaywrightTestResult[],
  ): Promise<void> {
    const chronologicalResults = results
      .map((result, index) => ({ attempt: (result.retry ?? index) + 1, result }))
      .sort((left, right) => left.attempt - right.attempt);
    const outcome = (result: PlaywrightTestResult): TestEvidenceAttempt["outcome"] =>
      playwrightOutcome(result, test.expectedStatus ?? "passed");
    const failed = (result: PlaywrightTestResult): boolean => outcome(result) === "failed";
    const attachments = chronologicalResults.flatMap(({ result }) => playwrightAttachments(result));
    const context: TestEvidenceReporterContext = {
      expectedStatus: test.expectedStatus ?? "passed",
      id: test.id,
      results,
      runner: "playwright",
      source: { test, results },
      title: test.title,
      titlePath: test.titlePath?.() ?? [test.title],
    };
    await this.writeRecord(
      createTestEvidenceRecord({
        id: test.id,
        runner: "playwright",
        fidelity: this.options.fidelity,
        intent: this.options.intent?.(context) ?? { contractIds: [], description: test.title },
        observed: this.options.observed?.(context) ?? { contractIds: [] },
        replay: this.options.replay?.(context) ?? {
          command: `pnpm playwright test --grep ${JSON.stringify(test.title)}`,
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
