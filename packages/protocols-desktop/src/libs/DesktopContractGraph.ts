import {
  createProblemResponseExtensions,
  createProblemRegistrySnapshot,
  ProblemRegistryValidationProblem,
} from "@croco/problems-core";
import type {
  PackageProblemRegistry,
  PackageProblemRegistryEntry,
  ProblemCategory,
  ProblemRedactionPolicy,
  ProblemRegistryRedaction,
  ProblemRegistryVisibility,
} from "@croco/problems-core";
import { compileDesktopWireSchema, DesktopWireSchemaProblem } from "./DesktopWireSchema";
import type { DesktopWireSchemaDescriptor, DesktopWireSourceLocation } from "./DesktopWireSchema";
import {
  compareDesktopContractGraphDiagnostics,
  createDesktopContractGraphDiagnostic,
  fromDesktopWireSchemaDiagnostic,
} from "./DesktopContractGraphDiagnostic";
import type { DesktopContractGraphDiagnostic } from "./DesktopContractGraphDiagnostic";
import { compareCodeUnits, stringifyCanonicalJson } from "./canonicalJson";
import { RESERVED_DESKTOP_KEYS } from "./reservedDesktopKeys";
import { sha256 } from "./sha256";
import type {
  AnyDesktopEffect,
  AnyDesktopGrant,
  BoundDesktopContract,
  DesktopAppDefinition,
  DesktopCommandExecutionPolicy,
  DesktopContractRecord,
  DesktopProblemReference,
  DesktopWindowRecord,
} from "./types";

export type DesktopContractGraphVersion = "croco.desktop-contract-graph.v1";

export type DesktopContractSemanticHash = `sha256:${string}`;

export type DesktopContractHandshakeVersion = "croco.desktop-contract-handshake.v1";

export type DesktopContractHandshakeV1 = {
  readonly version: DesktopContractHandshakeVersion;
  readonly graphVersion: DesktopContractGraphVersion;
  readonly semanticHash: DesktopContractSemanticHash;
};

export type DesktopContractHandshakeComparison =
  | { readonly compatible: true }
  | {
      readonly compatible: false;
      readonly code:
        | "DESKTOP_HANDSHAKE_VERSION_MISMATCH"
        | "DESKTOP_GRAPH_VERSION_MISMATCH"
        | "DESKTOP_SEMANTIC_HASH_MISMATCH";
    };

export type DesktopContractGraphSourceLocations = Readonly<
  Record<string, DesktopWireSourceLocation>
>;

export type CompileDesktopContractGraphOptions = {
  /**
   * Optional source evidence keyed by graph ID. Schema locations use the
   * `<command-id>.input`, `<command-id>.output`, and `<event-id>.payload` IDs.
   */
  readonly sourceLocations?: DesktopContractGraphSourceLocations;
  /** Root removed from source evidence before platform separators are canonicalized. */
  readonly sourceRoot?: string;
  /** Package ProblemRegistry manifests that authorize renderer-visible failures. */
  readonly problemRegistries?: readonly PackageProblemRegistry[];
};

export type DesktopContractGraphSchema =
  | DesktopWireSchemaDescriptor
  | { readonly kind: "grant-reference"; readonly grantId: string };

export type DesktopContractGraphSchemaReference = {
  readonly id: string;
  readonly descriptor: DesktopContractGraphSchema | null;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphEffect = {
  readonly namespace: string;
  readonly access: "read" | "write";
  readonly methods: readonly string[];
  readonly grantIds: readonly string[];
};

export type DesktopContractGraphCommand = {
  readonly id: string;
  readonly contractId: string;
  readonly key: string;
  readonly kind: "query" | "mutation";
  readonly input: DesktopContractGraphSchemaReference;
  readonly output: DesktopContractGraphSchemaReference;
  readonly effects: readonly DesktopContractGraphEffect[];
  readonly problems: readonly string[];
  readonly events: readonly string[];
  readonly executionPolicy: {
    readonly mode: "request-response";
    readonly timeoutMs?: number;
    readonly maxInputBytes?: number;
    readonly maxOutputBytes?: number;
    readonly maxConcurrency?: number;
  };
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphEvent = {
  readonly id: string;
  readonly contractId: string;
  readonly key: string;
  readonly payload: DesktopContractGraphSchemaReference;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphGrant = {
  readonly id: string;
  readonly contractId: string;
  readonly key: string;
  readonly resource: "file" | "directory";
  readonly access: "read" | "write";
  readonly scope: "exact" | "descendant";
  readonly lifetime: "command" | "window" | "session";
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphProblemSource = {
  readonly package: string;
  readonly retryable: boolean;
  readonly retryability: "retryable" | "not-retryable";
  readonly public: boolean;
  readonly visibility: ProblemRegistryVisibility;
  readonly redaction: ProblemRegistryRedaction;
  readonly cookbookPath: string;
};

export type DesktopContractGraphProblem = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly source: DesktopContractGraphProblemSource;
  readonly extensions?: DesktopWireSchemaDescriptor;
};

export type DesktopContractGraphContract = {
  readonly id: string;
  readonly commandIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly grantIds: readonly string[];
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphWindow = {
  readonly id: string;
  readonly trust: "local" | "remote";
  readonly originPolicy:
    | { readonly mode: "local-content" }
    | {
        readonly mode: "remote-allowlist";
        readonly initialUrl: string;
        readonly allowedOrigins: readonly string[];
      };
  readonly exposedCommands: readonly string[];
  readonly receivedEvents: readonly string[];
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphV1 = {
  readonly version: DesktopContractGraphVersion;
  readonly semanticHash: DesktopContractSemanticHash;
  readonly app: {
    readonly contractIds: readonly string[];
    readonly windowIds: readonly string[];
    readonly sourceLocation?: DesktopWireSourceLocation;
  };
  readonly contracts: readonly DesktopContractGraphContract[];
  readonly commands: readonly DesktopContractGraphCommand[];
  readonly events: readonly DesktopContractGraphEvent[];
  readonly effects: readonly string[];
  readonly grants: readonly DesktopContractGraphGrant[];
  readonly problems: readonly DesktopContractGraphProblem[];
  readonly windows: readonly DesktopContractGraphWindow[];
  readonly diagnostics: readonly DesktopContractGraphDiagnostic[];
};

type MutableGraphParts = {
  readonly contracts: DesktopContractGraphContract[];
  readonly commands: DesktopContractGraphCommand[];
  readonly events: DesktopContractGraphEvent[];
  readonly effects: Set<string>;
  readonly grants: DesktopContractGraphGrant[];
  readonly diagnostics: DesktopContractGraphDiagnostic[];
  readonly memberIds: Map<string, string>;
  readonly problemReferences: DesktopProblemUse[];
};

type DesktopProblemUse = {
  readonly commandId: string;
  readonly reference: DesktopProblemReference;
};

type ProblemRegistryIndex = {
  readonly entriesByCode: ReadonlyMap<string, PackageProblemRegistryEntry>;
  readonly diagnostics: readonly DesktopContractGraphDiagnostic[];
};

export function compileDesktopContractGraph(
  app: DesktopAppDefinition<DesktopContractRecord, DesktopWindowRecord>,
  options: CompileDesktopContractGraphOptions = {},
): DesktopContractGraphV1 {
  const sourceLocations = normalizeSourceLocations(
    options.sourceLocations ?? {},
    options.sourceRoot,
  );
  const parts: MutableGraphParts = {
    contracts: [],
    commands: [],
    events: [],
    effects: new Set(),
    grants: [],
    diagnostics: [],
    memberIds: new Map(),
    problemReferences: [],
  };

  for (const [contractId, contract] of sortedEntries(app.contracts)) {
    validateIdentifier(
      "contract",
      contractId,
      sourceLocations[`contract:${contractId}`],
      parts.diagnostics,
    );
    compileContract(contractId, contract, sourceLocations, parts);
  }
  parts.commands.sort(compareById);
  parts.events.sort(compareById);
  parts.grants.sort(compareById);
  const problemRegistryIndex = createProblemRegistryIndex(options.problemRegistries);
  parts.diagnostics.push(...problemRegistryIndex.diagnostics);
  const problems = compileProblems(
    parts.problemReferences,
    problemRegistryIndex.entriesByCode,
    parts.diagnostics,
  );
  const commandIds = new Set(parts.commands.map((command) => command.id));
  const eventIds = new Set(parts.events.map((event) => event.id));
  const windows = sortedEntries(app.windows).map(([windowId, window]) =>
    compileWindow(windowId, window, sourceLocations, commandIds, eventIds, parts.diagnostics),
  );
  validateWindowReferences(
    app,
    new Set(windows.map((window) => window.id)),
    sourceLocations,
    parts.diagnostics,
  );
  const appSourceLocation = sourceLocations.app;
  const effects = [...parts.effects].sort(compareCodeUnits);
  parts.diagnostics.sort(compareDesktopContractGraphDiagnostics);
  const graphWithoutSemanticHash = {
    version: "croco.desktop-contract-graph.v1" as const,
    app: {
      contractIds: parts.contracts.map((contract) => contract.id),
      windowIds: windows.map((window) => window.id),
      ...(appSourceLocation ? { sourceLocation: appSourceLocation } : {}),
    },
    contracts: parts.contracts,
    commands: parts.commands,
    events: parts.events,
    effects,
    grants: parts.grants,
    problems,
    windows,
    diagnostics: parts.diagnostics,
  };

  return {
    ...graphWithoutSemanticHash,
    semanticHash: computeDesktopContractSemanticHash(graphWithoutSemanticHash),
  };
}

export function computeDesktopContractSemanticHash(
  graph: Omit<DesktopContractGraphV1, "semanticHash">,
): DesktopContractSemanticHash {
  return `sha256:${sha256(stringifyCanonicalJson(createDesktopContractSemanticProjection(graph)))}`;
}

export function compareDesktopContractHandshakes(
  expected: DesktopContractHandshakeV1,
  actual: {
    readonly version: string;
    readonly graphVersion: string;
    readonly semanticHash: string;
  },
): DesktopContractHandshakeComparison {
  if (expected.version !== actual.version) {
    return {
      compatible: false,
      code: "DESKTOP_HANDSHAKE_VERSION_MISMATCH",
    };
  }
  if (expected.graphVersion !== actual.graphVersion) {
    return {
      compatible: false,
      code: "DESKTOP_GRAPH_VERSION_MISMATCH",
    };
  }
  if (expected.semanticHash !== actual.semanticHash) {
    return {
      compatible: false,
      code: "DESKTOP_SEMANTIC_HASH_MISMATCH",
    };
  }
  return { compatible: true };
}

export function stringifyDesktopContractGraph(graph: DesktopContractGraphV1): string {
  return `${stringifyCanonicalJson(graph, 2)}\n`;
}

function compileContract(
  contractId: string,
  contract: BoundDesktopContract<DesktopContractRecord[string], string>,
  sourceLocations: DesktopContractGraphSourceLocations,
  parts: MutableGraphParts,
): void {
  const commands = sortedEntries(contract.commands);
  const events = sortedEntries(contract.events);
  const grants = sortedEntries(contract.grants);
  const grantIds = new Map<object, string[]>();
  const grantsById = new Map<string, AnyDesktopGrant>();
  for (const [, grant] of grants) {
    const sourceLocation = sourceLocations[grant.id];
    registerMemberId("grant", grant.id, sourceLocation, parts);
    const ids = grantIds.get(grant["~standard"]) ?? [];
    ids.push(grant.id);
    grantIds.set(grant["~standard"], ids);
    grantsById.set(grant.id, grant);
    parts.grants.push({
      id: grant.id,
      contractId,
      key: grant.memberKey,
      resource: grant.resource,
      access: grant.access,
      scope: grant.scope,
      lifetime: grant.lifetime,
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  for (const [, command] of commands) {
    const sourceLocation = sourceLocations[command.id];
    registerMemberId("command", command.id, sourceLocation, parts);
    const commandEffects = command.effects
      .map((effect) =>
        compileEffect(
          command.id,
          command.kind,
          effect,
          grantIds,
          grantsById,
          sourceLocations,
          parts,
        ),
      )
      .sort(compareEffects);
    const problemReferences = collectCommandProblemReferences(command);
    parts.problemReferences.push(...problemReferences);
    const commandEvents = command.events
      .map((eventKey) => `${contractId}.${eventKey}`)
      .sort(compareCodeUnits);
    for (const eventId of commandEvents) {
      if (!events.some(([, event]) => event.id === eventId)) {
        parts.diagnostics.push(
          createDesktopContractGraphDiagnostic({
            code: "DESKTOP_GRAPH_MISSING_EVENT_REFERENCE",
            targetKind: "command",
            memberId: command.id,
            schemaPath: ["events", eventId],
            message: `Desktop command references missing event "${eventId}".`,
            recovery:
              "Declare the event in the owning contract or remove it from the command event tuple.",
            ...(sourceLocation ? { sourceLocation } : {}),
          }),
        );
      }
    }
    parts.commands.push({
      id: command.id,
      contractId,
      key: command.memberKey,
      kind: command.kind,
      input: compileSchemaReference(
        `${command.id}.input`,
        command.input,
        sourceLocations,
        grantIds,
        parts.diagnostics,
      ),
      output: compileSchemaReference(
        `${command.id}.output`,
        command.output,
        sourceLocations,
        grantIds,
        parts.diagnostics,
      ),
      effects: commandEffects,
      problems: [...new Set(problemReferences.map(({ reference }) => reference.code))].sort(
        compareCodeUnits,
      ),
      events: commandEvents,
      executionPolicy: compileExecutionPolicy(
        command.id,
        command.executionPolicy,
        sourceLocations,
        parts.diagnostics,
      ),
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  for (const [, event] of events) {
    const sourceLocation = sourceLocations[event.id];
    registerMemberId("event", event.id, sourceLocation, parts);
    parts.events.push({
      id: event.id,
      contractId,
      key: event.memberKey,
      payload: compileSchemaReference(
        `${event.id}.payload`,
        event.payload,
        sourceLocations,
        grantIds,
        parts.diagnostics,
      ),
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  const sourceLocation = sourceLocations[`contract:${contractId}`];
  parts.contracts.push({
    id: contractId,
    commandIds: commands.map(([, command]) => command.id),
    eventIds: events.map(([, event]) => event.id),
    grantIds: grants.map(([, grant]) => grant.id),
    ...(sourceLocation ? { sourceLocation } : {}),
  });
}

function collectCommandProblemReferences(
  command: BoundDesktopContract<DesktopContractRecord[string], string>["commands"][string],
): DesktopProblemUse[] {
  return [
    ...command.problems.map((reference) => ({
      commandId: command.id,
      reference,
    })),
    ...command.effects.flatMap((effect) =>
      effect.problems.map((reference) => ({
        commandId: command.id,
        reference,
      })),
    ),
  ];
}

function createProblemRegistryIndex(
  registries: readonly PackageProblemRegistry[] | undefined,
): ProblemRegistryIndex {
  if (!registries || registries.length === 0) {
    return { entriesByCode: new Map(), diagnostics: [] };
  }

  try {
    const snapshot = createProblemRegistrySnapshot(registries);
    return {
      entriesByCode: new Map(snapshot.problems.map((problem) => [problem.code, problem])),
      diagnostics: [],
    };
  } catch (error) {
    if (!(error instanceof ProblemRegistryValidationProblem)) throw error;
    return {
      entriesByCode: new Map(),
      diagnostics: error.errors.map((message) =>
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_PROBLEM_REGISTRY_INVALID",
          targetKind: "app",
          memberId: "app",
          message,
          recovery: "Supply valid, non-conflicting package ProblemRegistry manifests.",
        }),
      ),
    };
  }
}

function compileProblems(
  uses: readonly DesktopProblemUse[],
  entriesByCode: ReadonlyMap<string, PackageProblemRegistryEntry>,
  diagnostics: DesktopContractGraphDiagnostic[],
): DesktopContractGraphProblem[] {
  const usesByCode = new Map<string, DesktopProblemUse[]>();
  for (const use of uses) {
    const matching = usesByCode.get(use.reference.code) ?? [];
    matching.push(use);
    usesByCode.set(use.reference.code, matching);
  }

  return [...usesByCode.entries()]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .flatMap(([code, matchingUses]) => {
      const entry = entriesByCode.get(code);
      if (!entry) {
        const [firstUse] = matchingUses;
        if (firstUse) {
          diagnostics.push(
            createProblemDiagnostic(
              "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISSING",
              firstUse,
              `Desktop command declares Problem code '${code}', but no supplied ProblemRegistry manifest declares it.`,
              "Supply the package ProblemRegistry manifest that owns this Problem code.",
            ),
          );
        }
        return [];
      }

      const definitions = matchingUses.map((use) => ({
        use,
        extensions: compileProblemExtensions(use, entry, diagnostics),
      }));
      const [first] = definitions;
      if (!first) return [];

      for (const definition of definitions) {
        if (definition.use.reference.category !== entry.category) {
          diagnostics.push(
            createProblemDiagnostic(
              "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISMATCH",
              definition.use,
              `Desktop Problem code '${code}' is declared as ${definition.use.reference.category}, but the ProblemRegistry declares ${entry.category}.`,
              "Make the desktop Problem reference category match its registry entry.",
            ),
          );
        }
      }

      const categories = new Set(
        definitions.map((definition) => definition.use.reference.category),
      );
      const extensionShapes = new Set(
        definitions.map((definition) => stringifyCanonicalJson(definition.extensions)),
      );
      const hasIncompatibleDefinitions = categories.size > 1 || extensionShapes.size > 1;
      if (hasIncompatibleDefinitions) {
        diagnostics.push(
          createProblemDiagnostic(
            "DESKTOP_GRAPH_DUPLICATE_PROBLEM_CODE",
            [...matchingUses].sort(compareProblemUses)[0] ?? first.use,
            `Desktop Problem code '${code}' has incompatible category or extension definitions.`,
            "Use one category and one renderer-safe extension shape for each stable Problem code.",
          ),
        );
      }

      return [
        {
          code,
          category: entry.category,
          source: toProblemSource(entry),
          ...(!hasIncompatibleDefinitions && first.extensions
            ? { extensions: first.extensions }
            : {}),
        },
      ];
    });
}

function compileProblemExtensions(
  use: DesktopProblemUse,
  entry: PackageProblemRegistryEntry,
  diagnostics: DesktopContractGraphDiagnostic[],
): DesktopWireSchemaDescriptor | undefined {
  if (use.reference.extensions === undefined) return undefined;

  const contractMember = `${use.commandId}.problem.${use.reference.code}.extensions`;
  let descriptor: DesktopWireSchemaDescriptor;
  try {
    descriptor = compileDesktopWireSchema(use.reference.extensions, { contractMember });
  } catch (error) {
    if (!(error instanceof DesktopWireSchemaProblem)) throw error;
    diagnostics.push(...error.diagnostics.map(fromDesktopWireSchemaDiagnostic));
    return undefined;
  }

  if (descriptor.kind !== "object") {
    diagnostics.push(
      createProblemDiagnostic(
        "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION",
        use,
        `Desktop Problem code '${use.reference.code}' extensions must be a strict object schema.`,
        "Declare a strict object containing only renderer-safe extension fields.",
      ),
    );
    return undefined;
  }

  const responseRedaction = entry.redaction === "safe" ? "safe-message" : entry.redaction;
  const unsafePath = entry.public
    ? findUnsafeExtensionPath(descriptor, [], responseRedaction)
    : [descriptor.fields[0]?.name ?? "extensions"];
  if (unsafePath) {
    diagnostics.push({
      ...createProblemDiagnostic(
        "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION",
        use,
        `Desktop Problem code '${use.reference.code}' exposes extension field '${unsafePath.join(".")}' outside its ProblemRegistry response policy.`,
        "Use a public extension field permitted by the shared Problem response redaction policy.",
      ),
      schemaPath: unsafePath,
    });
    return undefined;
  }

  return descriptor;
}

function findUnsafeExtensionPath(
  descriptor: DesktopWireSchemaDescriptor,
  path: readonly string[],
  redaction: ProblemRedactionPolicy,
): readonly string[] | undefined {
  switch (descriptor.kind) {
    case "object":
      for (const field of descriptor.fields) {
        const fieldPath = [...path, field.name];
        if (
          !Object.prototype.hasOwnProperty.call(
            createProblemResponseExtensions({ [field.name]: true }, redaction),
            field.name,
          )
        ) {
          return fieldPath;
        }
        const nested = findUnsafeExtensionPath(field.schema, fieldPath, redaction);
        if (nested) return nested;
      }
      return undefined;
    case "array":
      return findUnsafeExtensionPath(descriptor.element, [...path, "[]"], redaction);
    case "optional":
    case "nullable":
      return findUnsafeExtensionPath(descriptor.inner, path, redaction);
    case "union":
      for (const [index, option] of descriptor.options.entries()) {
        const nested = findUnsafeExtensionPath(option, [...path, `option${index}`], redaction);
        if (nested) return nested;
      }
      return undefined;
    default:
      return undefined;
  }
}

function compareProblemUses(left: DesktopProblemUse, right: DesktopProblemUse): number {
  return (
    compareCodeUnits(left.commandId, right.commandId) ||
    compareCodeUnits(left.reference.category, right.reference.category) ||
    compareCodeUnits(
      stringifyCanonicalJson(left.reference.extensions),
      stringifyCanonicalJson(right.reference.extensions),
    )
  );
}

function createProblemDiagnostic(
  code: Extract<
    DesktopContractGraphDiagnostic["code"],
    | "DESKTOP_GRAPH_DUPLICATE_PROBLEM_CODE"
    | "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISMATCH"
    | "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISSING"
    | "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION"
  >,
  use: DesktopProblemUse,
  message: string,
  recovery: string,
): DesktopContractGraphDiagnostic {
  return createDesktopContractGraphDiagnostic({
    code,
    targetKind: "problem",
    memberId: use.commandId,
    message,
    recovery,
  });
}

function toProblemSource(entry: PackageProblemRegistryEntry): DesktopContractGraphProblemSource {
  return {
    package: entry.package,
    retryable: entry.retryable,
    retryability: entry.retryability,
    public: entry.public,
    visibility: entry.visibility,
    redaction: entry.redaction,
    cookbookPath: entry.cookbookPath,
  };
}

function compileSchemaReference(
  id: string,
  schema: unknown,
  sourceLocations: DesktopContractGraphSourceLocations,
  grantIds: ReadonlyMap<object, readonly string[]>,
  diagnostics: DesktopContractGraphDiagnostic[],
): DesktopContractGraphSchemaReference {
  const sourceLocation = sourceLocations[id];
  const grantSchema = isDesktopGrant(schema);
  const matchingGrantIds = grantSchema ? grantIds.get(schema["~standard"]) : undefined;
  const grantId = matchingGrantIds?.length === 1 ? matchingGrantIds[0] : undefined;
  if (grantId) {
    return {
      id,
      descriptor: { kind: "grant-reference", grantId },
      ...(sourceLocation ? { sourceLocation } : {}),
    };
  }
  if (grantSchema && !matchingGrantIds) {
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_MISSING_GRANT_REFERENCE",
        targetKind: "schema",
        memberId: id,
        message: "Desktop schema references a grant that is not mounted by the owning contract.",
        recovery: "Mount the grant in the contract grants record or use a mounted grant reference.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
    return { id, descriptor: null, ...(sourceLocation ? { sourceLocation } : {}) };
  }
  if (matchingGrantIds && matchingGrantIds.length > 1) {
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_AMBIGUOUS_GRANT_REFERENCE",
        targetKind: "schema",
        memberId: id,
        message: `Desktop grant reference matches multiple mounted grant IDs: ${matchingGrantIds.join(", ")}.`,
        recovery:
          "Declare each grant once or use distinct grant definitions for distinct authority identities.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
    return { id, descriptor: null, ...(sourceLocation ? { sourceLocation } : {}) };
  }

  try {
    return {
      id,
      descriptor: compileDesktopWireSchema(schema, {
        contractMember: id,
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
      ...(sourceLocation ? { sourceLocation } : {}),
    };
  } catch (error) {
    if (!(error instanceof DesktopWireSchemaProblem)) throw error;
    diagnostics.push(...error.diagnostics.map(fromDesktopWireSchemaDiagnostic));
    return { id, descriptor: null, ...(sourceLocation ? { sourceLocation } : {}) };
  }
}

function compileEffect(
  commandId: string,
  commandKind: "query" | "mutation",
  effect: AnyDesktopEffect,
  grantIds: ReadonlyMap<object, readonly string[]>,
  grantsById: ReadonlyMap<string, AnyDesktopGrant>,
  sourceLocations: DesktopContractGraphSourceLocations,
  parts: MutableGraphParts,
): DesktopContractGraphEffect {
  const sourceLocation =
    sourceLocations[`effect:${effect.namespace}`] ?? sourceLocations[commandId];
  validateIdentifier("effect", effect.namespace, sourceLocation, parts.diagnostics);
  parts.effects.add(effect.namespace);

  if (commandKind === "query" && effect.access === "write") {
    parts.diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_QUERY_WRITE_EFFECT",
        targetKind: "command",
        memberId: commandId,
        schemaPath: ["effects", effect.namespace],
        message: `Desktop query declares write effect "${effect.namespace}".`,
        recovery:
          "Change the command to a mutation or replace the effect with read-only authority.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
  }

  const resolvedGrantIds: string[] = [];
  for (const grant of effect.grants) {
    const matchingGrantIds = grantIds.get(grant["~standard"]);
    if (!matchingGrantIds) {
      parts.diagnostics.push(
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_MISSING_GRANT_REFERENCE",
          targetKind: "effect",
          memberId: effect.namespace,
          message: `Desktop effect references a grant that is not mounted by command "${commandId}"'s contract.`,
          recovery:
            "Mount the referenced grant in the owning contract or remove it from the effect declaration.",
          ...(sourceLocation ? { sourceLocation } : {}),
        }),
      );
      continue;
    }
    if (matchingGrantIds.length !== 1) {
      parts.diagnostics.push(
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_AMBIGUOUS_GRANT_REFERENCE",
          targetKind: "effect",
          memberId: effect.namespace,
          message: `Desktop effect grant matches multiple mounted grant IDs: ${matchingGrantIds.join(", ")}.`,
          recovery: "Declare each effect grant once under one stable contract member ID.",
          ...(sourceLocation ? { sourceLocation } : {}),
        }),
      );
      continue;
    }
    const grantId = matchingGrantIds[0];
    if (grantId) resolvedGrantIds.push(grantId);
    const mountedGrant = grantId ? grantsById.get(grantId) : undefined;
    if (mountedGrant && mountedGrant.access !== effect.access) {
      parts.diagnostics.push(
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_EFFECT_GRANT_ACCESS_MISMATCH",
          targetKind: "effect",
          memberId: effect.namespace,
          schemaPath: ["grants", grantId ?? "unknown"],
          message: `Desktop ${effect.access} effect references ${mountedGrant.access} grant "${grantId}".`,
          recovery: "Use a grant whose access matches the effect authority exactly.",
          ...(sourceLocation ? { sourceLocation } : {}),
        }),
      );
    }
  }

  return {
    namespace: effect.namespace,
    access: effect.access,
    methods: Object.keys(effect.methods).sort(compareCodeUnits),
    grantIds: resolvedGrantIds.sort(compareCodeUnits),
  };
}

function compileExecutionPolicy(
  commandId: string,
  policy: DesktopCommandExecutionPolicy | undefined,
  sourceLocations: DesktopContractGraphSourceLocations,
  diagnostics: DesktopContractGraphDiagnostic[],
): DesktopContractGraphCommand["executionPolicy"] {
  const sourceLocation =
    sourceLocations[`${commandId}.executionPolicy`] ?? sourceLocations[commandId];
  const result: {
    mode: "request-response";
    timeoutMs?: number;
    maxInputBytes?: number;
    maxOutputBytes?: number;
    maxConcurrency?: number;
  } = { mode: "request-response" };
  const numericFields = [
    ["timeoutMs", "DESKTOP_GRAPH_INVALID_TIMEOUT"],
    ["maxInputBytes", "DESKTOP_GRAPH_INVALID_BYTE_LIMIT"],
    ["maxOutputBytes", "DESKTOP_GRAPH_INVALID_BYTE_LIMIT"],
    ["maxConcurrency", "DESKTOP_GRAPH_INVALID_CONCURRENCY"],
  ] as const;

  for (const [field, code] of numericFields) {
    const value = policy?.[field];
    if (value === undefined) continue;
    if (Number.isSafeInteger(value) && value > 0) {
      result[field] = value;
      continue;
    }
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code,
        targetKind: "execution-policy",
        memberId: commandId,
        schemaPath: [field],
        message: `Desktop execution policy ${field} must be a positive safe integer.`,
        recovery: `Set ${field} to a finite positive integer before generating desktop runtime artifacts.`,
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
  }

  return result;
}

function compileWindow(
  windowId: string,
  window: DesktopWindowRecord[string],
  sourceLocations: DesktopContractGraphSourceLocations,
  commandIds: ReadonlySet<string>,
  eventIds: ReadonlySet<string>,
  diagnostics: DesktopContractGraphDiagnostic[],
): DesktopContractGraphWindow {
  const sourceLocation = sourceLocations[`window:${windowId}`];
  validateIdentifier("window", windowId, sourceLocation, diagnostics);
  if (window.trust === "remote") {
    const unsafeWindow = window as unknown as {
      readonly expose?: readonly { readonly id: string }[];
      readonly receive?: readonly { readonly id: string }[];
    };
    if ((unsafeWindow.expose?.length ?? 0) > 0 || (unsafeWindow.receive?.length ?? 0) > 0) {
      diagnostics.push(
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_REMOTE_WINDOW_EXPOSURE",
          targetKind: "window",
          memberId: windowId,
          message: "Remote desktop windows cannot expose commands or receive privileged events.",
          recovery:
            "Remove command and event exposure or move the surface to a trusted local window.",
          ...(sourceLocation ? { sourceLocation } : {}),
        }),
      );
    }
    validateRemoteUrl(
      windowId,
      "initialUrl",
      window.initialUrl,
      false,
      sourceLocation,
      diagnostics,
    );
    const allowedOrigins = [...window.allowedOrigins].sort(compareCodeUnits);
    allowedOrigins.forEach((origin, index) =>
      validateRemoteUrl(
        windowId,
        `allowedOrigins.${index}`,
        origin,
        true,
        sourceLocation,
        diagnostics,
      ),
    );
    return {
      id: windowId,
      trust: "remote",
      originPolicy: {
        mode: "remote-allowlist",
        initialUrl: window.initialUrl,
        allowedOrigins,
      },
      exposedCommands: [],
      receivedEvents: [],
      ...(sourceLocation ? { sourceLocation } : {}),
    };
  }

  const exposedCommands = (window.expose as unknown as readonly { readonly id: string }[])
    .map((command) => command.id)
    .sort(compareCodeUnits);
  const receivedEvents = (window.receive as unknown as readonly { readonly id: string }[])
    .map((event) => event.id)
    .sort(compareCodeUnits);
  for (const commandId of exposedCommands) {
    if (!commandIds.has(commandId)) {
      diagnostics.push(
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_MISSING_COMMAND_REFERENCE",
          targetKind: "window",
          memberId: windowId,
          schemaPath: ["exposedCommands", commandId],
          message: `Desktop window references missing command "${commandId}".`,
          recovery: "Expose a command mounted by the app or remove the stale command reference.",
          ...(sourceLocation ? { sourceLocation } : {}),
        }),
      );
    }
  }
  for (const eventId of receivedEvents) {
    if (!eventIds.has(eventId)) {
      diagnostics.push(
        createDesktopContractGraphDiagnostic({
          code: "DESKTOP_GRAPH_MISSING_EVENT_REFERENCE",
          targetKind: "window",
          memberId: windowId,
          schemaPath: ["receivedEvents", eventId],
          message: `Desktop window references missing event "${eventId}".`,
          recovery: "Receive an event mounted by the app or remove the stale event reference.",
          ...(sourceLocation ? { sourceLocation } : {}),
        }),
      );
    }
  }
  return {
    id: windowId,
    trust: "local",
    originPolicy: { mode: "local-content" },
    exposedCommands,
    receivedEvents,
    ...(sourceLocation ? { sourceLocation } : {}),
  };
}

function validateRemoteUrl(
  windowId: string,
  field: string,
  value: string,
  requireOrigin: boolean,
  sourceLocation: DesktopWireSourceLocation | undefined,
  diagnostics: DesktopContractGraphDiagnostic[],
): void {
  const schemaPath = field.split(".");
  if (value.includes("*")) {
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_REMOTE_ORIGIN_WILDCARD",
        targetKind: "window",
        memberId: windowId,
        schemaPath,
        message: `Remote origin field ${field} contains a wildcard.`,
        recovery: "List each trusted HTTPS origin explicitly.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_REMOTE_ORIGIN_MALFORMED",
        targetKind: "window",
        memberId: windowId,
        schemaPath,
        message: `Remote origin field ${field} is not an absolute URL.`,
        recovery: "Use an absolute HTTPS URL with a valid host.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
    return;
  }

  if (parsed.protocol !== "https:") {
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_REMOTE_ORIGIN_INSECURE",
        targetKind: "window",
        memberId: windowId,
        schemaPath,
        message: `Remote origin field ${field} uses insecure protocol "${parsed.protocol}".`,
        recovery: "Use HTTPS for every remote window URL and allowed origin.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
    return;
  }

  if (requireOrigin && parsed.origin !== value) {
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_REMOTE_ORIGIN_MALFORMED",
        targetKind: "window",
        memberId: windowId,
        schemaPath,
        message: `Remote allowed origin "${value}" must contain only scheme, host, and optional port.`,
        recovery: `Replace the value with the canonical origin "${parsed.origin}".`,
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
  }
}

function validateWindowReferences(
  app: DesktopAppDefinition<DesktopContractRecord, DesktopWindowRecord>,
  windowIds: ReadonlySet<string>,
  sourceLocations: DesktopContractGraphSourceLocations,
  diagnostics: DesktopContractGraphDiagnostic[],
): void {
  for (const window of app.metadata.windows) {
    if (windowIds.has(window.key)) continue;
    const sourceLocation = sourceLocations[`window:${window.key}`] ?? sourceLocations.app;
    diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_MISSING_WINDOW_REFERENCE",
        targetKind: "app",
        memberId: window.key,
        message: `Desktop app metadata references missing window "${window.key}".`,
        recovery:
          "Mount the window in the app windows record or remove the stale metadata reference.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
  }
}

function registerMemberId(
  targetKind: "command" | "event" | "grant",
  memberId: string,
  sourceLocation: DesktopWireSourceLocation | undefined,
  parts: MutableGraphParts,
): void {
  validateIdentifier(targetKind, memberId, sourceLocation, parts.diagnostics);
  const existing = parts.memberIds.get(memberId);
  if (existing) {
    parts.diagnostics.push(
      createDesktopContractGraphDiagnostic({
        code: "DESKTOP_GRAPH_DUPLICATE_ID",
        targetKind,
        memberId,
        message: `Desktop member ID "${memberId}" is already owned by ${existing}.`,
        recovery: "Give every command, event, and grant a distinct stable ID.",
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
    );
    return;
  }
  parts.memberIds.set(memberId, targetKind);
}

function validateIdentifier(
  targetKind: "command" | "contract" | "effect" | "event" | "grant" | "window",
  memberId: string,
  sourceLocation: DesktopWireSourceLocation | undefined,
  diagnostics: DesktopContractGraphDiagnostic[],
): void {
  const invalidSegment = memberId
    .split(".")
    .find(
      (segment) =>
        segment.length === 0 || RESERVED_DESKTOP_KEYS.some((reserved) => reserved === segment),
    );
  if (invalidSegment === undefined) return;
  diagnostics.push(
    createDesktopContractGraphDiagnostic({
      code: "DESKTOP_GRAPH_RESERVED_ID",
      targetKind,
      memberId,
      message: `Desktop ID "${memberId}" contains reserved or empty segment "${invalidSegment}".`,
      recovery: "Rename the definition with non-empty, non-reserved identifier segments.",
      ...(sourceLocation ? { sourceLocation } : {}),
    }),
  );
}

function normalizeSourceLocations(
  sourceLocations: DesktopContractGraphSourceLocations,
  sourceRoot: string | undefined,
): DesktopContractGraphSourceLocations {
  return Object.fromEntries(
    sortedEntries(sourceLocations).map(([id, sourceLocation]) => [
      id,
      normalizeSourceLocation(sourceLocation, sourceRoot),
    ]),
  );
}

function normalizeSourceLocation(
  source: DesktopWireSourceLocation,
  sourceRoot: string | undefined,
): DesktopWireSourceLocation {
  const normalizedPath = source.path.replace(/\\/g, "/");
  const normalizedRoot = sourceRoot?.replace(/\\/g, "/").replace(/\/+$/, "");
  const path =
    normalizedRoot && normalizedPath.startsWith(`${normalizedRoot}/`)
      ? normalizedPath.slice(normalizedRoot.length + 1)
      : normalizedPath;

  return {
    path,
    ...(source.line === undefined ? {} : { line: source.line }),
    ...(source.column === undefined ? {} : { column: source.column }),
  };
}

function stripSourceLocations<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSourceLocations(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceLocation")
        .map(([key, item]) => [key, stripSourceLocations(item)]),
    ) as T;
  }
  return value;
}

function createDesktopContractSemanticProjection(
  graph: Omit<DesktopContractGraphV1, "semanticHash">,
): unknown {
  return {
    version: graph.version,
    app: {
      contractIds: sortStrings(graph.app.contractIds),
      windowIds: sortStrings(graph.app.windowIds),
    },
    contracts: graph.contracts
      .map((contract) => ({
        ...stripSourceLocations(contract),
        commandIds: sortStrings(contract.commandIds),
        eventIds: sortStrings(contract.eventIds),
        grantIds: sortStrings(contract.grantIds),
      }))
      .sort(compareById),
    commands: graph.commands
      .map((command) => ({
        ...stripSourceLocations(command),
        effects: command.effects
          .map((effect) => ({
            ...effect,
            methods: sortStrings(effect.methods),
            grantIds: sortStrings(effect.grantIds),
          }))
          .sort(compareEffects),
        problems: sortStrings(command.problems),
        events: sortStrings(command.events),
      }))
      .sort(compareById),
    events: [...stripSourceLocations(graph.events)].sort(compareById),
    effects: sortStrings(graph.effects),
    grants: [...stripSourceLocations(graph.grants)].sort(compareById),
    problems: [...graph.problems].sort((left, right) => compareCodeUnits(left.code, right.code)),
    windows: graph.windows
      .map((window) => ({
        ...stripSourceLocations(window),
        originPolicy:
          window.originPolicy.mode === "remote-allowlist"
            ? {
                ...window.originPolicy,
                allowedOrigins: sortStrings(window.originPolicy.allowedOrigins),
              }
            : window.originPolicy,
        exposedCommands: sortStrings(window.exposedCommands),
        receivedEvents: sortStrings(window.receivedEvents),
      }))
      .sort(compareById),
    diagnostics: graph.diagnostics
      .map(({ code, severity, targetKind, memberId, schemaPath }) => ({
        code,
        severity,
        targetKind,
        memberId,
        schemaPath,
      }))
      .sort(compareDesktopContractGraphDiagnostics),
  };
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort(compareCodeUnits);
}

function sortedEntries<T>(record: Readonly<Record<string, T>>): readonly (readonly [string, T])[] {
  return Object.entries(record).sort(([left], [right]) => compareCodeUnits(left, right));
}

function isDesktopGrant(value: unknown): value is AnyDesktopGrant {
  return (
    typeof value === "object" &&
    value !== null &&
    "definitionType" in value &&
    value.definitionType === "grant"
  );
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareCodeUnits(left.id, right.id);
}

function compareEffects(
  left: DesktopContractGraphEffect,
  right: DesktopContractGraphEffect,
): number {
  return (
    compareCodeUnits(left.namespace, right.namespace) ||
    compareCodeUnits(left.access, right.access) ||
    compareStringArrays(left.methods, right.methods) ||
    compareStringArrays(left.grantIds, right.grantIds)
  );
}

function compareStringArrays(left: readonly string[], right: readonly string[]): number {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const result = compareCodeUnits(left[index] ?? "", right[index] ?? "");
    if (result !== 0) return result;
  }
  return left.length - right.length;
}
