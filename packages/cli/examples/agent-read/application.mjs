import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import { constants, readFileSync, realpathSync } from "node:fs";
import { compileMetric, count, defineMetric, evaluateMetric, project } from "@croco/metrics-core";
import { parse, resolve, sep } from "node:path";
import { MetricReadProblem, MetricReadService } from "@croco/metrics-core/runtime";
import { z } from "zod/v4";
import { ProblemCategory } from "@croco/problems-core";

export const window = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" };
export const digest = (value) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const actionsFact = {
  name: "frontend-actions",
  kind: "transaction",
  sourceRefs: ["frontend-manifest"],
  columns: { generatedAt: { type: "instant" } },
};
const metric = defineMetric("frontend.action-count", {
  version: 1,
  from: actionsFact,
  measure: count(),
  time: project(actionsFact, "generatedAt"),
  unit: "actions",
  population: "generated-frontend-actions",
});
export const definition = {
  ...(await compileMetric(metric)),
  description: "Count of generated frontend actions in a local build artifact.",
  requiredFields: ["actionCount"],
  requiresRaw: false,
};
export const context = {
  principal: {
    app: "agent-read-example",
    environment: "local",
    tenant: "example",
    subject: "operator",
  },
  allowedFields: ["actionCount"],
  allowRaw: false,
  budget: {
    maxWindowMs: 86400000,
    maxRows: 10,
    maxBytes: 10000,
    maxTimeMs: 2000,
    maxConcurrency: 2,
    maxCost: 10,
  },
  sourceRevisions: [{ sourceRef: "frontend-manifest", revision: "example-build-1" }],
  snapshotRefs: ["example-build-1"],
};
export const grant = { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" };
export const inputSchema = z.object({}).strict();
export const outputSchema = z.object({ actionCount: z.number().int().nonnegative() }).strict();
const manifestSchema = z
  .object({
    schemaVersion: z.literal("croco.frontend-action-manifest.v1"),
    actions: z.array(z.object({ id: z.string() }).passthrough()),
  })
  .strict();

export function resultFor(data, requestedWindow = window, readContext = context) {
  return {
    data: outputSchema.parse(data),
    principal: readContext.principal,
    definition,
    unit: definition.unit,
    population: definition.population,
    filter: "all-generated-actions",
    fieldRefs: ["actionCount"],
    window: requestedWindow,
    sourceRevisions: readContext.sourceRevisions,
    snapshotRefs: readContext.snapshotRefs,
    quality: {
      temporalCompleteness: "complete",
      freshness: "fresh",
      populationCoverage: "complete",
      validity: "valid",
      exactness: "exact",
      reproducibility: "reproducible",
    },
    diagnostics: [],
    rows: 1,
    bytes: Buffer.byteLength(JSON.stringify(data)),
    cost: 1,
  };
}

async function readJson(root, name, maxBytes, signal) {
  signal?.throwIfAborted();
  const path = resolve(root, name);
  let current = parse(path).root;
  for (const segment of path.slice(current.length).split(sep)) {
    current = resolve(current, segment);
    if ((await lstat(current)).isSymbolicLink())
      throw new MetricReadProblem(
        "metrics-core/source-revision-missing",
        ProblemCategory.ValidationError,
        "Artifact path contains a symbolic link",
      );
    signal?.throwIfAborted();
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile())
      throw new MetricReadProblem(
        "metrics-core/source-revision-missing",
        ProblemCategory.ValidationError,
        "Artifact must be a regular file",
      );
    if (stat.size > maxBytes)
      throw new MetricReadProblem(
        "metrics-core/result-budget-exceeded",
        ProblemCategory.ValidationError,
        "Artifact exceeds byte budget",
      );
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
      signal?.throwIfAborted();
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > maxBytes)
      throw new MetricReadProblem(
        "metrics-core/result-budget-exceeded",
        ProblemCategory.ValidationError,
        "Artifact exceeds byte budget",
      );
    return JSON.parse(buffer.subarray(0, size).toString("utf8"));
  } finally {
    await file.close();
  }
}

export function createExampleComponents(workspaceRoot) {
  const artifactRoot = realpathSync(workspaceRoot);
  const readExecutor = async ({ window: requestedWindow, context: readContext, signal }) => {
    const manifest = manifestSchema.parse(
      await readJson(artifactRoot, "frontend-actions.json", readContext.budget.maxBytes, signal),
    );
    const [evaluation] = evaluateMetric(
      metric,
      manifest.actions.map(() => ({ generatedAt: window.from })),
      requestedWindow,
    );
    return resultFor({ actionCount: Number(evaluation.value) }, requestedWindow, readContext);
  };
  const queries = ["frontend.actions", "frontend.actions.live"].map((id) => ({
    id,
    version: 1,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: "all-generated-actions",
    requiredFields: ["actionCount"],
    requiresRaw: false,
    limits: context.budget,
    inputSchema,
    outputSchema,
    inputKey: () => "{}",
    readExecutor,
  }));
  const authority = { currentContext: () => context, authorize: async () => grant };
  const reports = {
    readCandidates: async (_queryId, _inputKey, _principal, signal) =>
      readJson(artifactRoot, "reviewed-reports.json", context.budget.maxBytes, signal),
    verify: async (report, signal) => {
      const provenance = await readJson(
        artifactRoot,
        "review-provenance.json",
        context.budget.maxBytes,
        signal,
      );
      return (
        provenance.reportId === report.id &&
        provenance.reviewerId === report.reviewed.reviewerId &&
        provenance.reviewedAt === report.reviewed.reviewedAt &&
        provenance.resultHash === report.resultHash &&
        provenance.definitionHash === report.reviewed.definitionHash &&
        digest(report.result) === report.resultHash
      );
    },
  };
  return { queries, authority, reports };
}

export function createExampleApplication(workspaceRoot) {
  const { queries, authority, reports } = createExampleComponents(workspaceRoot);
  return {
    service: new MetricReadService([definition], queries, authority, reports),
    workspaceRoot,
    sources: [
      {
        id: "frontend-manifest",
        path: "frontend-actions.json",
        commit: readFileSync(resolve(workspaceRoot, "source-commit.txt"), "utf8").trim(),
        line: 1,
      },
    ],
    maxResponseBytes: 20000,
  };
}

const workspaceRoot = process.env.CROCO_AGENT_EXAMPLE_ROOT;
export default workspaceRoot ? createExampleApplication(resolve(workspaceRoot)) : undefined;
