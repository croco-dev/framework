import type {
  DesktopContractGraphCommand,
  DesktopContractGraphEffect,
  DesktopContractGraphGrant,
  DesktopContractGraphProblem,
  DesktopContractGraphSchema,
  DesktopContractGraphV1,
  DesktopContractGraphWindow,
} from "./DesktopContractGraph";
import type { DesktopContractGraphDiagnostic } from "./DesktopContractGraphDiagnostic";
import type { DesktopWireSchemaDescriptor } from "./DesktopWireSchema";
import { compareCodeUnits, stringifyCanonicalJson } from "./canonicalJson";
import { sha256 } from "./sha256";

export type DesktopContractGraphDiffVersion = "croco.desktop-contract-graph-diff.v1";
export type DesktopContractCompatibility = "breaking" | "non-breaking";
export type DesktopContractAuthority = "escalation" | "none" | "reduction";
export type DesktopContractGraphDiffFingerprint = `sha256:${string}`;
export type DesktopContractGraphDiffExitCode = 0 | 1 | 2 | 3;

export type DesktopContractGraphDiffTargetKind =
  | "command"
  | "diagnostic"
  | "effect"
  | "event"
  | "grant"
  | "problem"
  | "window";

export type DesktopContractGraphDiffChangeCode =
  | "desktop-command-added"
  | "desktop-command-removed"
  | "desktop-command-kind-changed"
  | "desktop-command-input-schema-changed"
  | "desktop-command-output-schema-changed"
  | "desktop-command-problem-added"
  | "desktop-command-problem-removed"
  | "desktop-command-event-added"
  | "desktop-command-event-removed"
  | "desktop-command-execution-policy-changed"
  | "desktop-effect-added"
  | "desktop-effect-removed"
  | "desktop-effect-access-changed"
  | "desktop-effect-method-added"
  | "desktop-effect-method-removed"
  | "desktop-effect-grant-added"
  | "desktop-effect-grant-removed"
  | "desktop-event-added"
  | "desktop-event-removed"
  | "desktop-event-payload-schema-changed"
  | "desktop-grant-added"
  | "desktop-grant-removed"
  | "desktop-grant-resource-changed"
  | "desktop-grant-access-changed"
  | "desktop-grant-scope-changed"
  | "desktop-grant-lifetime-changed"
  | "desktop-problem-added"
  | "desktop-problem-removed"
  | "desktop-problem-definition-changed"
  | "desktop-window-added"
  | "desktop-window-removed"
  | "desktop-window-trust-changed"
  | "desktop-window-initial-url-changed"
  | "desktop-window-command-exposed"
  | "desktop-window-command-hidden"
  | "desktop-window-event-exposed"
  | "desktop-window-event-hidden"
  | "desktop-window-remote-origin-added"
  | "desktop-window-remote-origin-removed"
  | "desktop-diagnostic-added"
  | "desktop-diagnostic-removed";

export type DesktopContractGraphDiffChange = {
  readonly fingerprint: DesktopContractGraphDiffFingerprint;
  readonly code: DesktopContractGraphDiffChangeCode;
  readonly compatibility: DesktopContractCompatibility;
  readonly authority: DesktopContractAuthority;
  readonly targetKind: DesktopContractGraphDiffTargetKind;
  readonly targetId: string;
  readonly fieldPath?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly message: string;
};

export type DesktopContractGraphDiff = {
  readonly version: DesktopContractGraphDiffVersion;
  readonly baselineSemanticHash: DesktopContractGraphV1["semanticHash"];
  readonly currentSemanticHash: DesktopContractGraphV1["semanticHash"];
  readonly breakingCompatibilityCount: number;
  readonly nonBreakingCompatibilityCount: number;
  readonly authorityEscalationCount: number;
  readonly authorityReductionCount: number;
  readonly hasBreakingCompatibility: boolean;
  readonly hasAuthorityEscalations: boolean;
  readonly changes: readonly DesktopContractGraphDiffChange[];
  readonly breakingChanges: readonly DesktopContractGraphDiffChange[];
  readonly nonBreakingChanges: readonly DesktopContractGraphDiffChange[];
  readonly authorityEscalations: readonly DesktopContractGraphDiffChange[];
  readonly authorityReductions: readonly DesktopContractGraphDiffChange[];
};

export type DesktopContractGraphDiffExitOptions = {
  readonly reviewedAuthorityEscalationFingerprints?: readonly DesktopContractGraphDiffFingerprint[];
};

export type DesktopContractGraphDiffExitStatus = {
  readonly exitCode: DesktopContractGraphDiffExitCode;
  readonly hasBreakingCompatibility: boolean;
  readonly unreviewedAuthorityEscalations: readonly DesktopContractGraphDiffChange[];
};

type ChangeInput = Omit<DesktopContractGraphDiffChange, "fingerprint"> & {
  readonly fingerprintAuthorityContext?: unknown;
};

export function diffDesktopContractGraphs(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiff {
  const changes = [
    ...diffCommands(baseline, current),
    ...diffEvents(baseline, current),
    ...diffGrants(baseline, current),
    ...diffProblems(baseline, current),
    ...diffWindows(baseline, current),
    ...diffDiagnostics(baseline, current),
  ].sort(compareChanges);
  const breakingChanges = changes.filter((change) => change.compatibility === "breaking");
  const nonBreakingChanges = changes.filter((change) => change.compatibility === "non-breaking");
  const authorityEscalations = changes.filter((change) => change.authority === "escalation");
  const authorityReductions = changes.filter((change) => change.authority === "reduction");
  const breakingCompatibilityCount = breakingChanges.length;
  const authorityEscalationCount = authorityEscalations.length;

  return {
    version: "croco.desktop-contract-graph-diff.v1",
    baselineSemanticHash: baseline.semanticHash,
    currentSemanticHash: current.semanticHash,
    breakingCompatibilityCount,
    nonBreakingCompatibilityCount: changes.length - breakingCompatibilityCount,
    authorityEscalationCount,
    authorityReductionCount: authorityReductions.length,
    hasBreakingCompatibility: breakingCompatibilityCount > 0,
    hasAuthorityEscalations: authorityEscalationCount > 0,
    changes,
    breakingChanges,
    nonBreakingChanges,
    authorityEscalations,
    authorityReductions,
  };
}

export function resolveDesktopContractGraphDiffExitStatus(
  diff: DesktopContractGraphDiff,
  options: DesktopContractGraphDiffExitOptions = {},
): DesktopContractGraphDiffExitStatus {
  const reviewed = new Set(options.reviewedAuthorityEscalationFingerprints ?? []);
  const unreviewedAuthorityEscalations = diff.changes.filter(
    (change) => change.authority === "escalation" && !reviewed.has(change.fingerprint),
  );
  const exitCode = (Number(diff.hasBreakingCompatibility) |
    (Number(unreviewedAuthorityEscalations.length > 0) << 1)) as DesktopContractGraphDiffExitCode;
  return {
    exitCode,
    hasBreakingCompatibility: diff.hasBreakingCompatibility,
    unreviewedAuthorityEscalations,
  };
}

export function formatDesktopContractGraphDiffChange(
  change: DesktopContractGraphDiffChange,
): string {
  const field = change.fieldPath ? ` ${change.fieldPath}` : "";
  return `${change.compatibility.toUpperCase()} ${formatAuthority(change.authority)} ${change.code} ${change.targetKind}:${change.targetId}${field} ${change.fingerprint}: ${change.message}`;
}

export function formatDesktopContractGraphDiff(diff: DesktopContractGraphDiff): string {
  const changes = diff.changes.map(formatDesktopContractGraphDiffChange);
  const summary = `Desktop contract diff found ${diff.breakingCompatibilityCount} breaking compatibility change(s), ${diff.authorityEscalationCount} authority escalation(s), and ${diff.authorityReductionCount} authority reduction(s).`;
  return [...changes, summary].join("\n");
}

export function stringifyDesktopContractGraphDiff(diff: DesktopContractGraphDiff): string {
  return `${stringifyCanonicalJson(diff, 2)}\n`;
}

function diffCommands(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const baselineCommands = indexById(baseline.commands);
  const currentCommands = indexById(current.commands);

  for (const command of baseline.commands) {
    const next = currentCommands.get(command.id);
    if (!next) {
      changes.push(
        createChange({
          code: "desktop-command-removed",
          compatibility: "breaking",
          authority: "none",
          targetKind: "command",
          targetId: command.id,
          before: semanticCommand(command),
          message: `Command '${command.id}' was removed.`,
        }),
        ...commandAuthorityPresenceChanges(command, "removed", baseline),
      );
      continue;
    }
    changes.push(...diffExistingCommand(command, next, baseline, current));
  }

  for (const command of current.commands) {
    if (baselineCommands.has(command.id)) continue;
    changes.push(
      createChange({
        code: "desktop-command-added",
        compatibility: "non-breaking",
        authority: "none",
        targetKind: "command",
        targetId: command.id,
        after: semanticCommand(command),
        message: `Command '${command.id}' was added without exposing it to a window.`,
      }),
      ...commandAuthorityPresenceChanges(command, "added", current),
    );
  }
  return changes;
}

function commandAuthorityPresenceChanges(
  command: DesktopContractGraphCommand,
  direction: "added" | "removed",
  graph: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const added = direction === "added";
  return [
    ...command.effects.map((effect) =>
      createChange({
        code: added ? "desktop-effect-added" : "desktop-effect-removed",
        compatibility: "non-breaking",
        authority: added ? "escalation" : "reduction",
        targetKind: "effect",
        targetId: `${command.id}:${effect.namespace}`,
        ...(added
          ? { after: commandEffectAuthorityContext(effect, graph) }
          : { before: commandEffectAuthorityContext(effect, graph) }),
        message: `Command '${command.id}' ${direction} effect '${effect.namespace}'.`,
      }),
    ),
    ...command.events.map((eventId) =>
      createChange({
        code: added ? "desktop-command-event-added" : "desktop-command-event-removed",
        compatibility: added ? "non-breaking" : "breaking",
        authority: added ? "escalation" : "reduction",
        targetKind: "command",
        targetId: command.id,
        fieldPath: "events",
        ...(added
          ? { after: eventAuthorityContext(eventId, graph) }
          : { before: eventAuthorityContext(eventId, graph) }),
        message: `Command '${command.id}' ${direction} event authority '${eventId}'.`,
      }),
    ),
  ];
}

function diffExistingCommand(
  baseline: DesktopContractGraphCommand,
  current: DesktopContractGraphCommand,
  baselineGraph: DesktopContractGraphV1,
  currentGraph: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  if (baseline.kind !== current.kind) {
    changes.push(
      createChange({
        code: "desktop-command-kind-changed",
        compatibility: "breaking",
        authority: current.kind === "mutation" ? "escalation" : "reduction",
        targetKind: "command",
        targetId: baseline.id,
        fieldPath: "kind",
        before: baseline.kind,
        after: current.kind,
        fingerprintAuthorityContext: commandAuthorityContext(current.id, currentGraph),
        message: `Command '${baseline.id}' changed from ${baseline.kind} to ${current.kind}.`,
      }),
    );
  }
  changes.push(
    ...diffSchemaReference(
      baseline.id,
      "input",
      baseline.input.descriptor,
      current.input.descriptor,
    ),
    ...diffSchemaReference(
      baseline.id,
      "output",
      baseline.output.descriptor,
      current.output.descriptor,
    ),
    ...diffStringSet({
      baseline: baseline.problems,
      current: current.problems,
      targetKind: "command",
      targetId: baseline.id,
      fieldPath: "problems",
      addedCode: "desktop-command-problem-added",
      removedCode: "desktop-command-problem-removed",
      addedCompatibility: "breaking",
      removedCompatibility: "breaking",
      addedAuthority: "none",
      removedAuthority: "none",
      addedMessage: (value) => `Command '${baseline.id}' added Problem '${value}'.`,
      removedMessage: (value) => `Command '${baseline.id}' removed Problem '${value}'.`,
    }),
    ...diffStringSet({
      baseline: baseline.events,
      current: current.events,
      targetKind: "command",
      targetId: baseline.id,
      fieldPath: "events",
      addedCode: "desktop-command-event-added",
      removedCode: "desktop-command-event-removed",
      addedCompatibility: "non-breaking",
      removedCompatibility: "breaking",
      addedAuthority: "escalation",
      removedAuthority: "reduction",
      addedMessage: (value) =>
        `Command '${baseline.id}' gained authority to emit event '${value}'.`,
      removedMessage: (value) =>
        `Command '${baseline.id}' lost authority to emit event '${value}'.`,
      addedValue: (value) => eventAuthorityContext(value, currentGraph),
      removedValue: (value) => eventAuthorityContext(value, baselineGraph),
      addedFingerprintAuthorityContext: (value) => ({
        command: commandAuthorityContext(current.id, currentGraph),
        event: eventAuthorityContext(value, currentGraph),
      }),
    }),
    ...diffEffects(baseline, current, baselineGraph, currentGraph),
  );
  changes.push(...diffExecutionPolicy(baseline, current));
  return changes;
}

function diffExecutionPolicy(
  baseline: DesktopContractGraphCommand,
  current: DesktopContractGraphCommand,
): DesktopContractGraphDiffChange[] {
  const fields = ["timeoutMs", "maxInputBytes", "maxOutputBytes", "maxConcurrency"] as const;
  return fields.flatMap((field) => {
    const before = baseline.executionPolicy[field];
    const after = current.executionPolicy[field];
    if (before === after) return [];
    const tightened = after !== undefined && (before === undefined || after < before);
    return [
      createChange({
        code: "desktop-command-execution-policy-changed",
        compatibility: tightened ? "breaking" : "non-breaking",
        authority: "none",
        targetKind: "command",
        targetId: baseline.id,
        fieldPath: `executionPolicy.${field}`,
        ...(before === undefined ? {} : { before }),
        ...(after === undefined ? {} : { after }),
        message: `Command '${baseline.id}' ${tightened ? "tightened" : "relaxed"} ${field}.`,
      }),
    ];
  });
}

function diffSchemaReference(
  commandId: string,
  field: "input" | "output",
  baseline: DesktopContractGraphSchema | null,
  current: DesktopContractGraphSchema | null,
): DesktopContractGraphDiffChange[] {
  if (semanticCanonicalEqual(baseline, current)) return [];
  const compatible = isSchemaCompatible(baseline, current, field);
  return [
    createChange({
      code:
        field === "input"
          ? "desktop-command-input-schema-changed"
          : "desktop-command-output-schema-changed",
      compatibility: compatible ? "non-breaking" : "breaking",
      authority: "none",
      targetKind: "command",
      targetId: commandId,
      fieldPath: field,
      before: normalizeUnorderedArrays(baseline),
      after: normalizeUnorderedArrays(current),
      message: `Command '${commandId}' ${field} schema changed ${compatible ? "compatibly" : "incompatibly"}.`,
    }),
  ];
}

function diffEffects(
  baseline: DesktopContractGraphCommand,
  current: DesktopContractGraphCommand,
  baselineGraph: DesktopContractGraphV1,
  currentGraph: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const baselineEffects = new Map(baseline.effects.map((effect) => [effect.namespace, effect]));
  const currentEffects = new Map(current.effects.map((effect) => [effect.namespace, effect]));
  for (const effect of baseline.effects) {
    const next = currentEffects.get(effect.namespace);
    const targetId = `${baseline.id}:${effect.namespace}`;
    if (!next) {
      changes.push(
        createChange({
          code: "desktop-effect-removed",
          compatibility: "non-breaking",
          authority: "reduction",
          targetKind: "effect",
          targetId,
          before: commandEffectAuthorityContext(effect, baselineGraph),
          message: `Command '${baseline.id}' removed effect '${effect.namespace}'.`,
        }),
      );
      continue;
    }
    changes.push(...diffExistingEffect(baseline.id, effect, next, baselineGraph, currentGraph));
  }
  for (const effect of current.effects) {
    if (baselineEffects.has(effect.namespace)) continue;
    changes.push(
      createChange({
        code: "desktop-effect-added",
        compatibility: "non-breaking",
        authority: "escalation",
        targetKind: "effect",
        targetId: `${current.id}:${effect.namespace}`,
        after: commandEffectAuthorityContext(effect, currentGraph),
        message: `Command '${current.id}' added effect '${effect.namespace}'.`,
      }),
    );
  }
  return changes;
}

function diffExistingEffect(
  commandId: string,
  baseline: DesktopContractGraphEffect,
  current: DesktopContractGraphEffect,
  baselineGraph: DesktopContractGraphV1,
  currentGraph: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const targetId = `${commandId}:${baseline.namespace}`;
  if (baseline.access !== current.access) {
    changes.push(
      createChange({
        code: "desktop-effect-access-changed",
        compatibility: "non-breaking",
        authority: current.access === "write" ? "escalation" : "reduction",
        targetKind: "effect",
        targetId,
        fieldPath: "access",
        before: baseline.access,
        after: current.access,
        fingerprintAuthorityContext: commandEffectAuthorityContext(current, currentGraph),
        message: `Effect '${baseline.namespace}' on command '${commandId}' changed from ${baseline.access} to ${current.access}.`,
      }),
    );
  }
  changes.push(
    ...diffStringSet({
      baseline: baseline.methods,
      current: current.methods,
      targetKind: "effect",
      targetId,
      fieldPath: "methods",
      addedCode: "desktop-effect-method-added",
      removedCode: "desktop-effect-method-removed",
      addedCompatibility: "non-breaking",
      removedCompatibility: "non-breaking",
      addedAuthority: "escalation",
      removedAuthority: "reduction",
      addedMessage: (value) => `Effect '${baseline.namespace}' gained method '${value}'.`,
      removedMessage: (value) => `Effect '${baseline.namespace}' lost method '${value}'.`,
      addedFingerprintAuthorityContext: () => commandEffectAuthorityContext(current, currentGraph),
    }),
    ...diffStringSet({
      baseline: baseline.grantIds,
      current: current.grantIds,
      targetKind: "effect",
      targetId,
      fieldPath: "grantIds",
      addedCode: "desktop-effect-grant-added",
      removedCode: "desktop-effect-grant-removed",
      addedCompatibility: "non-breaking",
      removedCompatibility: "non-breaking",
      addedAuthority: "escalation",
      removedAuthority: "reduction",
      addedMessage: (value) => `Effect '${baseline.namespace}' gained grant '${value}'.`,
      removedMessage: (value) => `Effect '${baseline.namespace}' lost grant '${value}'.`,
      addedValue: (value) => grantAuthorityContext(value, currentGraph),
      removedValue: (value) => grantAuthorityContext(value, baselineGraph),
      addedFingerprintAuthorityContext: (value) => ({
        effect: commandEffectAuthorityContext(current, currentGraph),
        grant: grantAuthorityContext(value, currentGraph),
      }),
    }),
  );
  return changes;
}

function diffEvents(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const baselineEvents = indexById(baseline.events);
  const currentEvents = indexById(current.events);
  for (const event of baseline.events) {
    const next = currentEvents.get(event.id);
    if (!next) {
      changes.push(
        createChange({
          code: "desktop-event-removed",
          compatibility: "breaking",
          authority: "none",
          targetKind: "event",
          targetId: event.id,
          before: normalizeUnorderedArrays(stripSourceLocations(event)),
          message: `Event '${event.id}' was removed.`,
        }),
      );
      continue;
    }
    if (!semanticCanonicalEqual(event.payload.descriptor, next.payload.descriptor)) {
      const compatible = isSchemaCompatible(
        event.payload.descriptor,
        next.payload.descriptor,
        "output",
      );
      changes.push(
        createChange({
          code: "desktop-event-payload-schema-changed",
          compatibility: compatible ? "non-breaking" : "breaking",
          authority: "none",
          targetKind: "event",
          targetId: event.id,
          fieldPath: "payload",
          before: normalizeUnorderedArrays(event.payload.descriptor),
          after: normalizeUnorderedArrays(next.payload.descriptor),
          message: `Event '${event.id}' payload schema changed ${compatible ? "compatibly" : "incompatibly"}.`,
        }),
      );
    }
  }
  for (const event of current.events) {
    if (baselineEvents.has(event.id)) continue;
    changes.push(
      createChange({
        code: "desktop-event-added",
        compatibility: "non-breaking",
        authority: "none",
        targetKind: "event",
        targetId: event.id,
        after: normalizeUnorderedArrays(stripSourceLocations(event)),
        message: `Event '${event.id}' was added without exposing it to a window.`,
      }),
    );
  }
  return changes;
}

function diffGrants(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const baselineGrants = indexById(baseline.grants);
  const currentGrants = indexById(current.grants);
  for (const grant of baseline.grants) {
    const next = currentGrants.get(grant.id);
    if (!next) {
      changes.push(grantPresenceChange(grant, "removed"));
      continue;
    }
    changes.push(...diffExistingGrant(grant, next));
  }
  for (const grant of current.grants) {
    if (!baselineGrants.has(grant.id)) changes.push(grantPresenceChange(grant, "added"));
  }
  return changes;
}

function grantPresenceChange(
  grant: DesktopContractGraphGrant,
  direction: "added" | "removed",
): DesktopContractGraphDiffChange {
  const added = direction === "added";
  return createChange({
    code: added ? "desktop-grant-added" : "desktop-grant-removed",
    compatibility: added ? "non-breaking" : "breaking",
    authority: added ? "escalation" : "reduction",
    targetKind: "grant",
    targetId: grant.id,
    ...(added ? { after: stripSourceLocations(grant) } : { before: stripSourceLocations(grant) }),
    message: `Grant '${grant.id}' was ${direction}.`,
  });
}

function diffExistingGrant(
  baseline: DesktopContractGraphGrant,
  current: DesktopContractGraphGrant,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const fields = [
    {
      field: "resource" as const,
      code: "desktop-grant-resource-changed" as const,
      rank: { file: 0, directory: 1 },
    },
    {
      field: "access" as const,
      code: "desktop-grant-access-changed" as const,
      rank: { read: 0, write: 1 },
    },
    {
      field: "scope" as const,
      code: "desktop-grant-scope-changed" as const,
      rank: { exact: 0, descendant: 1 },
    },
    {
      field: "lifetime" as const,
      code: "desktop-grant-lifetime-changed" as const,
      rank: { command: 0, window: 1, session: 2 },
    },
  ];
  for (const definition of fields) {
    const before = baseline[definition.field];
    const after = current[definition.field];
    if (before === after) continue;
    const beforeRank = definition.rank[before as keyof typeof definition.rank];
    const afterRank = definition.rank[after as keyof typeof definition.rank];
    changes.push(
      createChange({
        code: definition.code,
        compatibility: "breaking",
        authority: (afterRank ?? 0) > (beforeRank ?? 0) ? "escalation" : "reduction",
        targetKind: "grant",
        targetId: baseline.id,
        fieldPath: definition.field,
        before,
        after,
        fingerprintAuthorityContext: normalizeUnorderedArrays(stripSourceLocations(current)),
        message: `Grant '${baseline.id}' changed ${definition.field} from ${before} to ${after}.`,
      }),
    );
  }
  return changes;
}

function diffProblems(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const baselineProblems = new Map(baseline.problems.map((problem) => [problem.code, problem]));
  const currentProblems = new Map(current.problems.map((problem) => [problem.code, problem]));
  for (const problem of baseline.problems) {
    const next = currentProblems.get(problem.code);
    if (!next) {
      changes.push(problemPresenceChange(problem, "removed"));
      continue;
    }
    if (!semanticCanonicalEqual(problem, next)) {
      changes.push(
        createChange({
          code: "desktop-problem-definition-changed",
          compatibility: "breaking",
          authority: "none",
          targetKind: "problem",
          targetId: problem.code,
          before: normalizeUnorderedArrays(problem),
          after: normalizeUnorderedArrays(next),
          message: `Problem '${problem.code}' changed its public definition.`,
        }),
      );
    }
  }
  for (const problem of current.problems) {
    if (!baselineProblems.has(problem.code)) changes.push(problemPresenceChange(problem, "added"));
  }
  return changes;
}

function problemPresenceChange(
  problem: DesktopContractGraphProblem,
  direction: "added" | "removed",
): DesktopContractGraphDiffChange {
  const added = direction === "added";
  return createChange({
    code: added ? "desktop-problem-added" : "desktop-problem-removed",
    compatibility: "breaking",
    authority: "none",
    targetKind: "problem",
    targetId: problem.code,
    ...(added
      ? { after: normalizeUnorderedArrays(problem) }
      : { before: normalizeUnorderedArrays(problem) }),
    message: `Problem '${problem.code}' was ${direction}.`,
  });
}

function diffWindows(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const changes: DesktopContractGraphDiffChange[] = [];
  const baselineWindows = indexById(baseline.windows);
  const currentWindows = indexById(current.windows);
  for (const window of baseline.windows) {
    const next = currentWindows.get(window.id);
    if (!next) {
      changes.push(
        windowPresenceChange(window, "removed"),
        ...diffWindowAuthority(window, undefined, baseline, current),
      );
      continue;
    }
    if (window.trust !== next.trust) {
      changes.push(
        createChange({
          code: "desktop-window-trust-changed",
          compatibility: "breaking",
          authority: next.trust === "remote" ? "escalation" : "reduction",
          targetKind: "window",
          targetId: window.id,
          fieldPath: "trust",
          before: window.trust,
          after: next.trust,
          fingerprintAuthorityContext: windowAuthorityContext(next, current),
          message: `Window '${window.id}' changed trust from ${window.trust} to ${next.trust}.`,
        }),
      );
    }
    changes.push(...diffWindowAuthority(window, next, baseline, current));
  }
  for (const window of current.windows) {
    if (baselineWindows.has(window.id)) continue;
    changes.push(
      windowPresenceChange(window, "added"),
      ...diffWindowAuthority(undefined, window, baseline, current),
    );
  }
  return changes;
}

function windowPresenceChange(
  window: DesktopContractGraphWindow,
  direction: "added" | "removed",
): DesktopContractGraphDiffChange {
  const added = direction === "added";
  return createChange({
    code: added ? "desktop-window-added" : "desktop-window-removed",
    compatibility: added ? "non-breaking" : "breaking",
    authority: "none",
    targetKind: "window",
    targetId: window.id,
    ...(added
      ? { after: normalizeUnorderedArrays(stripSourceLocations(window)) }
      : { before: normalizeUnorderedArrays(stripSourceLocations(window)) }),
    message: `Window '${window.id}' was ${direction}.`,
  });
}

function diffWindowAuthority(
  baseline: DesktopContractGraphWindow | undefined,
  current: DesktopContractGraphWindow | undefined,
  baselineGraph: DesktopContractGraphV1,
  currentGraph: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const targetId = baseline?.id ?? current?.id;
  if (!targetId) return [];
  const initialUrlChange = diffInitialUrl(targetId, baseline, current);
  return [
    ...initialUrlChange,
    ...diffStringSet({
      baseline: baseline?.exposedCommands ?? [],
      current: current?.exposedCommands ?? [],
      targetKind: "window",
      targetId,
      fieldPath: "exposedCommands",
      addedCode: "desktop-window-command-exposed",
      removedCode: "desktop-window-command-hidden",
      addedCompatibility: "non-breaking",
      removedCompatibility: "breaking",
      addedAuthority: "escalation",
      removedAuthority: "reduction",
      addedMessage: (value) => `Window '${targetId}' newly exposes command '${value}'.`,
      removedMessage: (value) => `Window '${targetId}' no longer exposes command '${value}'.`,
      addedValue: (value) => commandAuthorityContext(value, currentGraph),
      removedValue: (value) => commandAuthorityContext(value, baselineGraph),
    }),
    ...diffStringSet({
      baseline: baseline?.receivedEvents ?? [],
      current: current?.receivedEvents ?? [],
      targetKind: "window",
      targetId,
      fieldPath: "receivedEvents",
      addedCode: "desktop-window-event-exposed",
      removedCode: "desktop-window-event-hidden",
      addedCompatibility: "non-breaking",
      removedCompatibility: "breaking",
      addedAuthority: "escalation",
      removedAuthority: "reduction",
      addedMessage: (value) => `Window '${targetId}' newly receives event '${value}'.`,
      removedMessage: (value) => `Window '${targetId}' no longer receives event '${value}'.`,
      addedValue: (value) => eventAuthorityContext(value, currentGraph),
      removedValue: (value) => eventAuthorityContext(value, baselineGraph),
    }),
    ...diffStringSet({
      baseline: remoteOriginEntries(baseline),
      current: remoteOriginEntries(current),
      targetKind: "window",
      targetId,
      fieldPath: "originPolicy",
      addedCode: "desktop-window-remote-origin-added",
      removedCode: "desktop-window-remote-origin-removed",
      addedCompatibility: "non-breaking",
      removedCompatibility: "breaking",
      addedAuthority: "escalation",
      removedAuthority: "reduction",
      addedMessage: (value) => `Window '${targetId}' added remote origin entry '${value}'.`,
      removedMessage: (value) => `Window '${targetId}' removed remote origin entry '${value}'.`,
    }),
  ];
}

function remoteOriginEntries(window: DesktopContractGraphWindow | undefined): string[] {
  if (!window || window.originPolicy.mode !== "remote-allowlist") return [];
  return [
    normalizeRemoteOrigin(window.originPolicy.initialUrl),
    ...window.originPolicy.allowedOrigins.map((origin) => normalizeRemoteOrigin(origin, true)),
  ];
}

function normalizeRemoteOrigin(value: string, requireOriginOnly = false): string {
  try {
    const parsed = new URL(value);
    return requireOriginOnly && parsed.origin !== value
      ? `invalid-origin:${value}`
      : `origin:${parsed.origin}`;
  } catch {
    return `invalid-origin:${value}`;
  }
}

function diffInitialUrl(
  targetId: string,
  baseline: DesktopContractGraphWindow | undefined,
  current: DesktopContractGraphWindow | undefined,
): DesktopContractGraphDiffChange[] {
  if (
    baseline?.originPolicy.mode !== "remote-allowlist" ||
    current?.originPolicy.mode !== "remote-allowlist" ||
    baseline.originPolicy.initialUrl === current.originPolicy.initialUrl
  ) {
    return [];
  }
  return [
    createChange({
      code: "desktop-window-initial-url-changed",
      compatibility: "breaking",
      authority: "none",
      targetKind: "window",
      targetId,
      fieldPath: "originPolicy.initialUrl",
      before: baseline.originPolicy.initialUrl,
      after: current.originPolicy.initialUrl,
      message: `Window '${targetId}' changed its initial URL.`,
    }),
  ];
}

function diffDiagnostics(
  baseline: DesktopContractGraphV1,
  current: DesktopContractGraphV1,
): DesktopContractGraphDiffChange[] {
  const baselineDiagnostics = new Map(
    baseline.diagnostics.map((diagnostic) => [diagnosticKey(diagnostic), diagnostic]),
  );
  const currentDiagnostics = new Map(
    current.diagnostics.map((diagnostic) => [diagnosticKey(diagnostic), diagnostic]),
  );
  const changes: DesktopContractGraphDiffChange[] = [];
  for (const [key, diagnostic] of baselineDiagnostics) {
    if (currentDiagnostics.has(key)) continue;
    changes.push(diagnosticPresenceChange(diagnostic, "removed"));
  }
  for (const [key, diagnostic] of currentDiagnostics) {
    if (baselineDiagnostics.has(key)) continue;
    changes.push(diagnosticPresenceChange(diagnostic, "added"));
  }
  return changes;
}

function diagnosticPresenceChange(
  diagnostic: DesktopContractGraphDiagnostic,
  direction: "added" | "removed",
): DesktopContractGraphDiffChange {
  const added = direction === "added";
  const identity = diagnosticIdentity(diagnostic);
  return createChange({
    code: added ? "desktop-diagnostic-added" : "desktop-diagnostic-removed",
    compatibility: added && diagnostic.severity === "error" ? "breaking" : "non-breaking",
    authority: "none",
    targetKind: "diagnostic",
    targetId: `${diagnostic.targetKind}:${diagnostic.memberId ?? "app"}`,
    fieldPath: diagnostic.schemaPath?.join("."),
    ...(added ? { after: identity } : { before: identity }),
    message: `Diagnostic '${diagnostic.code}' was ${direction}.`,
  });
}

type StringSetDiffOptions = {
  readonly baseline: readonly string[];
  readonly current: readonly string[];
  readonly targetKind: DesktopContractGraphDiffTargetKind;
  readonly targetId: string;
  readonly fieldPath: string;
  readonly addedCode: DesktopContractGraphDiffChangeCode;
  readonly removedCode: DesktopContractGraphDiffChangeCode;
  readonly addedCompatibility: DesktopContractCompatibility;
  readonly removedCompatibility: DesktopContractCompatibility;
  readonly addedAuthority: DesktopContractAuthority;
  readonly removedAuthority: DesktopContractAuthority;
  readonly addedMessage: (value: string) => string;
  readonly removedMessage: (value: string) => string;
  readonly addedValue?: (value: string) => unknown;
  readonly removedValue?: (value: string) => unknown;
  readonly addedFingerprintAuthorityContext?: (value: string) => unknown;
  readonly removedFingerprintAuthorityContext?: (value: string) => unknown;
};

function diffStringSet(options: StringSetDiffOptions): DesktopContractGraphDiffChange[] {
  const baseline = new Set(options.baseline);
  const current = new Set(options.current);
  const changes: DesktopContractGraphDiffChange[] = [];
  for (const value of [...current].sort(compareCodeUnits)) {
    if (baseline.has(value)) continue;
    changes.push(
      createChange({
        code: options.addedCode,
        compatibility: options.addedCompatibility,
        authority: options.addedAuthority,
        targetKind: options.targetKind,
        targetId: options.targetId,
        fieldPath: options.fieldPath,
        after: options.addedValue?.(value) ?? value,
        ...(options.addedFingerprintAuthorityContext
          ? { fingerprintAuthorityContext: options.addedFingerprintAuthorityContext(value) }
          : {}),
        message: options.addedMessage(value),
      }),
    );
  }
  for (const value of [...baseline].sort(compareCodeUnits)) {
    if (current.has(value)) continue;
    changes.push(
      createChange({
        code: options.removedCode,
        compatibility: options.removedCompatibility,
        authority: options.removedAuthority,
        targetKind: options.targetKind,
        targetId: options.targetId,
        fieldPath: options.fieldPath,
        before: options.removedValue?.(value) ?? value,
        ...(options.removedFingerprintAuthorityContext
          ? { fingerprintAuthorityContext: options.removedFingerprintAuthorityContext(value) }
          : {}),
        message: options.removedMessage(value),
      }),
    );
  }
  return changes;
}

function isSchemaCompatible(
  baseline: DesktopContractGraphSchema | null,
  current: DesktopContractGraphSchema | null,
  variance: "input" | "output",
): boolean {
  if (semanticCanonicalEqual(baseline, current)) return true;
  if (!baseline || !current) return false;
  if (baseline.kind === "grant-reference" || current.kind === "grant-reference") return false;
  if (baseline.kind === "object" && current.kind === "object") {
    return areObjectSchemasCompatible(baseline, current, variance);
  }
  if (baseline.kind === "array" && current.kind === "array") {
    return isSchemaCompatible(baseline.element, current.element, variance);
  }
  return variance === "input"
    ? isDescriptorSubset(baseline, current, variance)
    : isDescriptorSubset(current, baseline, variance);
}

function areObjectSchemasCompatible(
  baseline: Extract<DesktopWireSchemaDescriptor, { readonly kind: "object" }>,
  current: Extract<DesktopWireSchemaDescriptor, { readonly kind: "object" }>,
  variance: "input" | "output",
): boolean {
  const baselineFields = new Map(baseline.fields.map((field) => [field.name, field]));
  const currentFields = new Map(current.fields.map((field) => [field.name, field]));
  if (variance === "input") {
    for (const field of baseline.fields) {
      const next = currentFields.get(field.name);
      if (!next || (!field.required && next.required)) return false;
      if (!isSchemaCompatible(field.schema, next.schema, variance)) return false;
    }
    for (const field of current.fields) {
      if (field.required && !baselineFields.get(field.name)?.required) return false;
    }
    return true;
  }
  for (const field of baseline.fields) {
    const next = currentFields.get(field.name);
    if (!next) {
      if (field.required) return false;
      continue;
    }
    if (field.required && !next.required) return false;
    if (!isSchemaCompatible(field.schema, next.schema, variance)) return false;
  }
  return true;
}

function isDescriptorSubset(
  source: DesktopWireSchemaDescriptor,
  target: DesktopWireSchemaDescriptor,
  variance: "input" | "output",
): boolean {
  if (semanticCanonicalEqual(source, target)) return true;
  if (source.kind === "union") {
    return source.options.every((option) => isDescriptorSubset(option, target, variance));
  }
  if (source.kind === "literal") return descriptorAcceptsLiteral(target, source.value);
  if (source.kind === "enum") {
    return source.values.every((value) => descriptorAcceptsLiteral(target, value));
  }
  if (source.kind === "nullable") {
    return (
      descriptorAcceptsLiteral(target, null) && isDescriptorSubset(source.inner, target, variance)
    );
  }
  if (target.kind === "nullable") {
    return (
      isDescriptorSubset(source, target.inner, variance) || descriptorAcceptsLiteral(source, null)
    );
  }
  if (target.kind === "union") {
    return target.options.some((option) => isDescriptorSubset(source, option, variance));
  }
  if (source.kind === "optional") {
    return target.kind === "optional" && isDescriptorSubset(source.inner, target.inner, variance);
  }
  if (target.kind === "optional") return isDescriptorSubset(source, target.inner, variance);
  if (source.kind === "object" && target.kind === "object") {
    return variance === "input"
      ? areObjectSchemasCompatible(source, target, variance)
      : areObjectSchemasCompatible(target, source, variance);
  }
  if (source.kind === "array" && target.kind === "array") {
    return isDescriptorSubset(source.element, target.element, variance);
  }
  return false;
}

function descriptorAcceptsLiteral(
  descriptor: DesktopWireSchemaDescriptor,
  value: string | number | boolean | null,
): boolean {
  if (descriptor.kind === "literal") return descriptor.value === value;
  if (descriptor.kind === "enum") return descriptor.values.includes(value as string | number);
  if (descriptor.kind === "union") {
    return descriptor.options.some((option) => descriptorAcceptsLiteral(option, value));
  }
  if (descriptor.kind === "nullable" && value === null) return true;
  if (descriptor.kind === "nullable" || descriptor.kind === "optional") {
    return descriptorAcceptsLiteral(descriptor.inner, value);
  }
  if (value === null) return descriptor.kind === "null";
  return descriptor.kind === typeof value;
}

function createChange(input: ChangeInput): DesktopContractGraphDiffChange {
  const { fingerprintAuthorityContext, ...change } = input;
  const identity = {
    version: "croco.desktop-contract-diff-change.v1",
    code: change.code,
    compatibility: change.compatibility,
    authority: change.authority,
    targetKind: change.targetKind,
    targetId: change.targetId,
    ...(change.fieldPath ? { fieldPath: change.fieldPath } : {}),
    ...(change.before === undefined ? {} : { before: change.before }),
    ...(change.after === undefined ? {} : { after: change.after }),
    ...(change.authority === "escalation"
      ? {
          authorityContext:
            fingerprintAuthorityContext ??
            normalizeUnorderedArrays({ before: change.before, after: change.after }),
        }
      : {}),
  };
  return {
    fingerprint: `sha256:${sha256(stringifyCanonicalJson(identity))}`,
    ...change,
  };
}

function semanticCommand(command: DesktopContractGraphCommand): unknown {
  return normalizeUnorderedArrays(stripSourceLocations(command));
}

function commandAuthorityContext(commandId: string, graph: DesktopContractGraphV1): unknown {
  const command = graph.commands.find((candidate) => candidate.id === commandId);
  if (!command) return { commandId, command: null };
  return normalizeUnorderedArrays({
    commandId,
    kind: command.kind,
    effects: command.effects.map((effect) => commandEffectAuthorityContext(effect, graph)),
    events: command.events.map((eventId) => eventAuthorityContext(eventId, graph)),
  });
}

function windowAuthorityContext(
  window: DesktopContractGraphWindow,
  graph: DesktopContractGraphV1,
): unknown {
  return normalizeUnorderedArrays({
    id: window.id,
    trust: window.trust,
    originPolicy: stripSourceLocations(window.originPolicy),
    exposedCommands: window.exposedCommands.map((commandId) =>
      commandAuthorityContext(commandId, graph),
    ),
    receivedEvents: window.receivedEvents.map((eventId) => eventAuthorityContext(eventId, graph)),
  });
}

function commandEffectAuthorityContext(
  effect: DesktopContractGraphEffect,
  graph: DesktopContractGraphV1,
): unknown {
  return normalizeUnorderedArrays({
    namespace: effect.namespace,
    access: effect.access,
    methods: effect.methods,
    grants: effect.grantIds.map((grantId) => grantAuthorityContext(grantId, graph)),
  });
}

function grantAuthorityContext(grantId: string, graph: DesktopContractGraphV1): unknown {
  const grant = graph.grants.find((candidate) => candidate.id === grantId);
  return grant ? normalizeUnorderedArrays(stripSourceLocations(grant)) : { grantId, grant: null };
}

function eventAuthorityContext(eventId: string, graph: DesktopContractGraphV1): unknown {
  const event = graph.events.find((candidate) => candidate.id === eventId);
  return event ? normalizeUnorderedArrays(stripSourceLocations(event)) : { eventId, event: null };
}

function stripSourceLocations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSourceLocations);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "sourceLocation")
      .map(([key, item]) => [key, stripSourceLocations(item)]),
  );
}

function diagnosticKey(diagnostic: DesktopContractGraphDiagnostic): string {
  return stringifyCanonicalJson(diagnosticIdentity(diagnostic));
}

function diagnosticIdentity(diagnostic: DesktopContractGraphDiagnostic): unknown {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    targetKind: diagnostic.targetKind,
    ...(diagnostic.memberId ? { memberId: diagnostic.memberId } : {}),
    ...(diagnostic.schemaPath ? { schemaPath: diagnostic.schemaPath } : {}),
  };
}

function indexById<T extends { readonly id: string }>(values: readonly T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function semanticCanonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalEqual(normalizeUnorderedArrays(left), normalizeUnorderedArrays(right));
}

function normalizeUnorderedArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(normalizeUnorderedArrays)
      .sort((left, right) =>
        compareCodeUnits(stringifyCanonicalJson(left), stringifyCanonicalJson(right)),
      );
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeUnorderedArrays(item)]),
  );
}

function formatAuthority(authority: DesktopContractAuthority): string {
  return authority === "none" ? "AUTHORITY-NONE" : `AUTHORITY-${authority.toUpperCase()}`;
}

function compareChanges(
  left: DesktopContractGraphDiffChange,
  right: DesktopContractGraphDiffChange,
): number {
  return (
    compareCompatibility(left.compatibility, right.compatibility) ||
    compareAuthority(left.authority, right.authority) ||
    compareCodeUnits(left.code, right.code) ||
    compareCodeUnits(left.targetKind, right.targetKind) ||
    compareCodeUnits(left.targetId, right.targetId) ||
    compareCodeUnits(left.fieldPath ?? "", right.fieldPath ?? "") ||
    compareCodeUnits(left.fingerprint, right.fingerprint)
  );
}

function compareCompatibility(
  left: DesktopContractCompatibility,
  right: DesktopContractCompatibility,
): number {
  if (left === right) return 0;
  return left === "breaking" ? -1 : 1;
}

function compareAuthority(left: DesktopContractAuthority, right: DesktopContractAuthority): number {
  const order: Record<DesktopContractAuthority, number> = {
    escalation: 0,
    reduction: 1,
    none: 2,
  };
  return order[left] - order[right];
}
