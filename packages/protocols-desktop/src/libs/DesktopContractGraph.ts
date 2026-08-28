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
import type {
  AnyDesktopEffect,
  AnyDesktopGrant,
  BoundDesktopContract,
  DesktopAppDefinition,
  DesktopCommandExecutionPolicy,
  DesktopContractRecord,
  DesktopWindowRecord,
} from "./types";

export type DesktopContractGraphVersion = "croco.desktop-contract-graph.v1";

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
  readonly semanticHash: `sha256:${string}`;
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
  readonly problems: readonly string[];
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
  const semanticGraph = {
    version: "croco.desktop-contract-graph.v1" as const,
    app: {
      contractIds: parts.contracts.map((contract) => contract.id),
      windowIds: windows.map((window) => window.id),
    },
    contracts: stripSourceLocations(parts.contracts),
    commands: stripSourceLocations(parts.commands),
    events: stripSourceLocations(parts.events),
    effects,
    grants: stripSourceLocations(parts.grants),
    problems: [] as readonly never[],
    windows: stripSourceLocations(windows),
    diagnostics: parts.diagnostics
      .map(({ code, severity, targetKind, memberId, schemaPath }) => ({
        code,
        severity,
        targetKind,
        memberId,
        schemaPath,
      }))
      .sort(compareDesktopContractGraphDiagnostics),
  };

  return {
    version: semanticGraph.version,
    semanticHash: `sha256:${sha256(stringifyCanonicalJson(semanticGraph))}`,
    app: {
      ...semanticGraph.app,
      ...(appSourceLocation ? { sourceLocation: appSourceLocation } : {}),
    },
    contracts: parts.contracts,
    commands: parts.commands,
    events: parts.events,
    effects,
    grants: parts.grants,
    problems: [],
    windows,
    diagnostics: parts.diagnostics,
  };
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
      problems: [],
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
    compareCodeUnits(left.methods.join("."), right.methods.join(".")) ||
    compareCodeUnits(left.grantIds.join("."), right.grantIds.join("."))
  );
}

function sha256(value: string): string {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from<number>({ length: 64 }).fill(0);
    for (let index = 0; index < 16; index++) {
      const byteOffset = offset + index * 4;
      words[index] =
        ((bytes[byteOffset] ?? 0) << 24) |
        ((bytes[byteOffset + 1] ?? 0) << 16) |
        ((bytes[byteOffset + 2] ?? 0) << 8) |
        (bytes[byteOffset + 3] ?? 0);
    }
    for (let index = 16; index < 64; index++) {
      const word15 = words[index - 15] ?? 0;
      const word2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
      const bigSigma1 = rotateRight(e ?? 0, 6) ^ rotateRight(e ?? 0, 11) ^ rotateRight(e ?? 0, 25);
      const choose = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temporary1 =
        ((h ?? 0) + bigSigma1 + choose + (constants[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const bigSigma0 = rotateRight(a ?? 0, 2) ^ rotateRight(a ?? 0, 13) ^ rotateRight(a ?? 0, 22);
      const majority = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temporary2 = (bigSigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = ((d ?? 0) + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + (a ?? 0)) >>> 0;
    hash[1] = ((hash[1] ?? 0) + (b ?? 0)) >>> 0;
    hash[2] = ((hash[2] ?? 0) + (c ?? 0)) >>> 0;
    hash[3] = ((hash[3] ?? 0) + (d ?? 0)) >>> 0;
    hash[4] = ((hash[4] ?? 0) + (e ?? 0)) >>> 0;
    hash[5] = ((hash[5] ?? 0) + (f ?? 0)) >>> 0;
    hash[6] = ((hash[6] ?? 0) + (g ?? 0)) >>> 0;
    hash[7] = ((hash[7] ?? 0) + (h ?? 0)) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    const first = value.charCodeAt(index);
    const second = value.charCodeAt(index + 1);
    const codePoint =
      first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff
        ? ((first - 0xd800) << 10) + (second - 0xdc00) + 0x10000
        : first;
    if (codePoint > 0xffff) index++;
    if (codePoint < 0x80) bytes.push(codePoint);
    else if (codePoint < 0x800) bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
