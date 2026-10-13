import { decodeSource } from "@croco/etl-core/source";
import { cancellableSource } from "../read/BoundedSource";
import {
  GrowthModelProblem,
  validateGrowthDataset,
  validateStatePartition,
  validateGrowthScope,
  DEFAULT_GROWTH_LIMITS,
} from "./GrowthModel";
import type { SourceSchema } from "@croco/etl-core/source";
import type {
  GrowthModel,
  GrowthDataset,
  GrowthLimits,
  GrowthScope,
  GrowthTransition,
} from "./GrowthModel";

export type GrowthHistoryMetadata = {
  scope: GrowthScope;
  unit: string;
  period: string;
  sourceRevision: string;
  periods: readonly { index: number; complete: boolean }[];
};
export type GrowthHistoryBinding = { subjectId: string; stateId: string; period: string };
/** A declared complete subject partition requires explicit exit states; missing subjects are unknown, never dropped. */
export async function collectGrowthHistory(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  model: GrowthModel,
  metadata: GrowthHistoryMetadata,
  binding: GrowthHistoryBinding,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
  signal?: AbortSignal,
): Promise<GrowthDataset> {
  model = structuredClone(model);
  metadata = structuredClone(metadata);
  binding = structuredClone(binding);
  bounds = { ...bounds };
  validateStatePartition(model, bounds);
  function fail(field: string): never {
    throw new GrowthModelProblem(field);
  }
  if (
    metadata == null ||
    binding == null ||
    ![binding.subjectId, binding.stateId, binding.period].every(
      (key) => typeof key === "string" && key.trim().length > 0,
    ) ||
    new Set([binding.subjectId, binding.stateId, binding.period]).size !== 3
  )
    fail("history-binding");
  validateGrowthScope(metadata.scope);
  if (
    !Array.isArray(metadata.periods) ||
    metadata.periods.length < 1 ||
    metadata.periods.length > bounds.maxRows ||
    metadata.periods.some(
      (p) =>
        p == null ||
        !Number.isSafeInteger(p.index) ||
        p.index < 0 ||
        typeof p.complete !== "boolean",
    ) ||
    new Set(metadata.periods.map((p) => p.index)).size !== metadata.periods.length
  )
    fail("history-periods");
  const ordered = [...metadata.periods].sort((a, b) => a.index - b.index);
  if (ordered.some((p, i) => i > 0 && p.index !== (ordered[i - 1]?.index ?? -2) + 1))
    fail("history-period-gap");
  const states = model.stateDefinitions.map((s) => s.id);
  const history = new Map<number, Map<string, number>>(ordered.map((p) => [p.index, new Map()]));
  let rows = 0;
  for await (const row of cancellableSource(source, signal)) {
    if (++rows > bounds.maxRows) fail("history-row-budget");
    if (row == null || typeof row !== "object") fail("history-row");
    const subject = row[binding.subjectId],
      state = row[binding.stateId],
      period = row[binding.period];
    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.length > 2000 ||
      typeof state !== "string" ||
      !states.includes(state) ||
      typeof period !== "number" ||
      !Number.isSafeInteger(period)
    )
      fail("history-row");
    const target = history.get(period as number);
    if (!target) fail("history-period");
    if (target.has(subject as string)) fail("duplicate-subject-period");
    target.set(subject as string, states.indexOf(state as string));
  }
  const diagnostics: GrowthDataset["diagnostics"][number][] = [];
  const populations = ordered.map((p) => {
    const values = Array<number>(states.length).fill(0);
    for (const state of history.get(p.index)?.values() ?? [])
      values[state] = (values[state] ?? 0) + 1;
    if (!p.complete) diagnostics.push({ period: p.index, reason: "incomplete-period", count: 1 });
    return { period: p.index, values, complete: p.complete };
  });
  const transitions: GrowthTransition[] = [];
  const knownSubjects = new Set<string>();
  for (let i = 0; i < ordered.length - 1; i++) {
    const p = ordered[i],
      q = ordered[i + 1];
    if (!p || !q) fail("history-period");
    const before = history.get(p.index),
      after = history.get(q.index);
    if (!before || !after) fail("history-period");
    const counts = states.map(() => Array<number>(states.length).fill(0)),
      inflows = Array<number>(states.length).fill(0);
    for (const [subject, state] of before) {
      knownSubjects.add(subject);
      const next = after.get(subject);
      if (next === undefined) {
        continue;
      }
      const row = counts[state];
      if (!row) fail("history-state");
      row[next] = (row[next] ?? 0) + 1;
    }
    for (const [subject, state] of after) {
      knownSubjects.add(subject);
      if (!before.has(subject)) inflows[state] = (inflows[state] ?? 0) + 1;
    }
    const missing = knownSubjects.size - after.size;
    if (missing > 0) {
      diagnostics.push({ period: q.index, reason: "missing-state", count: missing });
      const population = populations[i + 1];
      if (population) population.complete = false;
    }
    transitions.push({
      from: p.index,
      counts,
      inflows,
      complete: p.complete && q.complete && missing === 0 && (populations[i]?.complete ?? false),
    });
  }
  const result: GrowthDataset = {
    scope: metadata.scope,
    unit: metadata.unit,
    period: metadata.period,
    stateIds: states,
    sourceRevision: metadata.sourceRevision,
    populations,
    transitions,
    partitionValidation: "subject-history",
    diagnostics,
  };
  validateGrowthDataset(model, result, bounds);
  return result;
}
/** Shared ETL decoder owns CSV/JSONL parsing. Numeric period schema must be explicit. */
export function importGrowthHistory(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
  model: GrowthModel,
  metadata: GrowthHistoryMetadata,
  binding: GrowthHistoryBinding,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
  signal?: AbortSignal,
): Promise<GrowthDataset> {
  return collectGrowthHistory(
    decodeSource(cancellableSource(bytes, signal), schema),
    model,
    metadata,
    binding,
    bounds,
    signal,
  );
}
/** Aggregate counts cannot prove mutually exclusive individual memberships. */
export function importGrowthCounts(
  model: GrowthModel,
  input: Omit<GrowthDataset, "partitionValidation" | "diagnostics">,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
): GrowthDataset {
  const result: GrowthDataset = {
    ...structuredClone(input),
    partitionValidation: "aggregate-only",
    diagnostics: [],
  };
  validateGrowthDataset(model, result, bounds);
  result.diagnostics = result.populations
    .filter((p) => !p.complete)
    .map((p) => ({ period: p.period, reason: "incomplete-period", count: 1 }));
  return result;
}
