import { ProblemCategory } from "@croco/problems-core";
import { computeDesktopContractSemanticHash } from "@croco/protocols-desktop";
import type { DesktopContractGraphProblem, DesktopContractGraphV1 } from "@croco/protocols-desktop";

type GenerationProblemFactory = (detail: string) => Error;

export function assertDesktopContractGraphGeneratable(
  graph: DesktopContractGraphV1,
  artifactDescription: "preload bridges" | "renderer clients",
  createProblem: GenerationProblemFactory,
): void {
  assertGraphContainers(graph, createProblem);
  if (graph.version !== "croco.desktop-contract-graph.v1") {
    throw createProblem(
      `Expected croco.desktop-contract-graph.v1, received ${formatDiagnosticValue(graph.version)}.`,
    );
  }
  if (graph.diagnostics.length > 0) {
    throw createProblem(
      `Cannot generate ${artifactDescription} from a graph with ${graph.diagnostics.length} diagnostic${graph.diagnostics.length === 1 ? "" : "s"}.`,
    );
  }
  assertGraphScalarFields(graph, artifactDescription, createProblem);
  assertGraphAuthorityIntegrity(graph, createProblem);
}

export function assertDesktopContractGraphSemanticHash(
  graph: DesktopContractGraphV1,
  createProblem: GenerationProblemFactory,
): void {
  const computed = computeDesktopContractSemanticHash(graph);
  if (computed !== graph.semanticHash) {
    throw createProblem(
      `Desktop contract graph semantic hash mismatch: expected ${JSON.stringify(computed)}, received ${JSON.stringify(graph.semanticHash)}. Regenerate the graph from its current definitions before generating desktop artifacts.`,
    );
  }
}

function assertGraphAuthorityIntegrity(
  graph: DesktopContractGraphV1,
  createProblem: GenerationProblemFactory,
): void {
  assertUniqueMemberIds(graph, createProblem);
  const contracts = createUniqueIndex(graph.contracts, "contract", createProblem);
  const commands = createUniqueIndex(graph.commands, "command", createProblem);
  const events = createUniqueIndex(graph.events, "event", createProblem);
  const grants = createUniqueIndex(graph.grants, "grant", createProblem);
  const problems = createUniqueIndex(graph.problems, "problem", createProblem);
  const windows = createUniqueIndex(graph.windows, "window", createProblem);

  assertInventory(graph.app.contractIds, contracts.keys(), "Desktop app contract", createProblem);
  assertInventory(graph.app.windowIds, windows.keys(), "Desktop app window", createProblem);
  assertInventory(
    graph.effects,
    new Set(graph.commands.flatMap((command) => command.effects.map((effect) => effect.namespace))),
    "Desktop effect namespace",
    createProblem,
  );

  for (const contract of graph.contracts) {
    assertInventory(
      contract.commandIds,
      graph.commands
        .filter((command) => command.contractId === contract.id)
        .map((command) => command.id),
      `Desktop contract ${JSON.stringify(contract.id)} command`,
      createProblem,
    );
    assertInventory(
      contract.eventIds,
      graph.events.filter((event) => event.contractId === contract.id).map((event) => event.id),
      `Desktop contract ${JSON.stringify(contract.id)} event`,
      createProblem,
    );
    assertInventory(
      contract.grantIds,
      graph.grants.filter((grant) => grant.contractId === contract.id).map((grant) => grant.id),
      `Desktop contract ${JSON.stringify(contract.id)} grant`,
      createProblem,
    );
  }

  for (const command of graph.commands) {
    assertMemberOwner(command, "command", contracts, createProblem);
    for (const problemCode of command.problems) {
      assertReferencedRecord(problems, problemCode, "Problem", command.id, createProblem);
    }
    for (const eventId of command.events) {
      const event = assertReferencedRecord(events, eventId, "event", command.id, createProblem);
      assertSameContract(event, command.contractId, "event", command.id, createProblem);
    }
    for (const effect of command.effects) {
      for (const grantId of effect.grantIds) {
        const grant = assertReferencedRecord(grants, grantId, "grant", command.id, createProblem);
        assertSameContract(grant, command.contractId, "grant", command.id, createProblem);
      }
    }
  }
  for (const event of graph.events) {
    assertMemberOwner(event, "event", contracts, createProblem);
  }
  for (const grant of graph.grants) {
    assertMemberOwner(grant, "grant", contracts, createProblem);
  }
  for (const window of graph.windows) {
    for (const commandId of window.exposedCommands) {
      assertReferencedRecord(commands, commandId, "command", window.id, createProblem);
    }
    for (const eventId of window.receivedEvents) {
      assertReferencedRecord(events, eventId, "event", window.id, createProblem);
    }
  }
}

function assertUniqueMemberIds(
  graph: DesktopContractGraphV1,
  createProblem: GenerationProblemFactory,
): void {
  const owners = new Map<string, "command" | "event" | "grant">();
  for (const [kind, members] of [
    ["command", graph.commands],
    ["event", graph.events],
    ["grant", graph.grants],
  ] as const) {
    for (const member of members) {
      const existing = owners.get(member.id);
      if (existing) {
        throw createProblem(
          `Desktop member id ${JSON.stringify(member.id)} is declared as both ${existing} and ${kind}.`,
        );
      }
      owners.set(member.id, kind);
    }
  }
}

function createUniqueIndex<T extends { readonly id?: string; readonly code?: string }>(
  records: readonly T[],
  kind: "command" | "contract" | "event" | "grant" | "problem" | "window",
  createProblem: GenerationProblemFactory,
): ReadonlyMap<string, T> {
  const index = new Map<string, T>();
  for (const record of records) {
    const id = record.id ?? record.code;
    if (id === undefined) {
      throw createProblem(`Desktop contract graph contains an unnamed ${kind}.`);
    }
    if (index.has(id)) {
      throw createProblem(
        `Desktop contract graph contains duplicate ${kind} ID ${JSON.stringify(id)}.`,
      );
    }
    index.set(id, record);
  }
  return index;
}

function assertInventory(
  actual: readonly string[],
  expectedValues: Iterable<string>,
  description: string,
  createProblem: GenerationProblemFactory,
): void {
  const expected = new Set(expectedValues);
  const actualSet = new Set(actual);
  const missing = [...expected].filter((id) => !actualSet.has(id));
  const unexpected = actual.filter((id) => !expected.has(id));
  if (actualSet.size !== actual.length || missing.length > 0 || unexpected.length > 0) {
    throw createProblem(`${description} inventory does not match its records.`);
  }
}

function assertMemberOwner(
  member: { readonly id: string; readonly contractId: string; readonly key: string },
  kind: "command" | "event" | "grant",
  contracts: ReadonlyMap<string, unknown>,
  createProblem: GenerationProblemFactory,
): void {
  const expectedId = `${member.contractId}.${member.key}`;
  if (!contracts.has(member.contractId)) {
    throw createProblem(
      `Desktop ${kind} ${JSON.stringify(member.id)} references missing contract ${JSON.stringify(member.contractId)}.`,
    );
  }
  if (member.id !== expectedId) {
    throw createProblem(
      `Desktop ${kind} ${JSON.stringify(member.id)} does not match contract ${JSON.stringify(member.contractId)} and member key ${JSON.stringify(member.key)}.`,
    );
  }
}

function assertReferencedRecord<T>(
  records: ReadonlyMap<string, T>,
  id: string,
  kind: "Problem" | "command" | "event" | "grant",
  ownerId: string,
  createProblem: GenerationProblemFactory,
): T {
  const record = records.get(id);
  if (!record) {
    throw createProblem(
      `Desktop member ${JSON.stringify(ownerId)} references missing ${kind} ${JSON.stringify(id)}.`,
    );
  }
  return record;
}

function assertSameContract(
  member: { readonly id: string; readonly contractId: string },
  contractId: string,
  kind: "event" | "grant",
  ownerId: string,
  createProblem: GenerationProblemFactory,
): void {
  if (member.contractId !== contractId) {
    throw createProblem(
      `Desktop member ${JSON.stringify(ownerId)} references ${kind} ${JSON.stringify(member.id)} from contract ${JSON.stringify(member.contractId)}.`,
    );
  }
}

function assertGraphContainers(
  graph: unknown,
  createProblem: GenerationProblemFactory,
): asserts graph is DesktopContractGraphV1 {
  assertRecordValue(graph, "contract graph", createProblem);
  assertRecordValue(graph.app, "app", createProblem);
  assertArrayValue(graph.app.contractIds, "app contract references", createProblem);
  assertArrayValue(graph.app.windowIds, "app window references", createProblem);

  const contracts = graph.contracts;
  const commands = graph.commands;
  const events = graph.events;
  const effects = graph.effects;
  const grants = graph.grants;
  const problems = graph.problems;
  const windows = graph.windows;
  const diagnostics = graph.diagnostics;
  assertArrayValue(contracts, "graph contracts", createProblem);
  assertArrayValue(commands, "graph commands", createProblem);
  assertArrayValue(events, "graph events", createProblem);
  assertArrayValue(effects, "graph effects", createProblem);
  assertArrayValue(grants, "graph grants", createProblem);
  assertArrayValue(problems, "graph problems", createProblem);
  assertArrayValue(windows, "graph windows", createProblem);
  assertArrayValue(diagnostics, "graph diagnostics", createProblem);

  for (const [index, contract] of contracts.entries()) {
    assertRecordValue(contract, `contract at index ${index}`, createProblem);
    assertArrayValue(contract.commandIds, `contract ${index} command references`, createProblem);
    assertArrayValue(contract.eventIds, `contract ${index} event references`, createProblem);
    assertArrayValue(contract.grantIds, `contract ${index} grant references`, createProblem);
  }
  for (const [index, command] of commands.entries()) {
    assertRecordValue(command, `command at index ${index}`, createProblem);
    assertRecordValue(command.input, `command ${index} input schema`, createProblem);
    assertRecordValue(command.output, `command ${index} output schema`, createProblem);
    assertArrayValue(command.effects, `command ${index} effects`, createProblem);
    assertArrayValue(command.problems, `command ${index} Problem references`, createProblem);
    assertArrayValue(command.events, `command ${index} event references`, createProblem);
    assertRecordValue(command.executionPolicy, `command ${index} execution policy`, createProblem);
    for (const [effectIndex, effect] of command.effects.entries()) {
      assertRecordValue(effect, `command ${index} effect at index ${effectIndex}`, createProblem);
      assertArrayValue(
        effect.methods,
        `command ${index} effect ${effectIndex} methods`,
        createProblem,
      );
      assertArrayValue(
        effect.grantIds,
        `command ${index} effect ${effectIndex} grant references`,
        createProblem,
      );
    }
  }
  for (const [index, event] of events.entries()) {
    assertRecordValue(event, `event at index ${index}`, createProblem);
    assertRecordValue(event.payload, `event ${index} payload schema`, createProblem);
  }
  for (const [index, grant] of grants.entries()) {
    assertRecordValue(grant, `grant at index ${index}`, createProblem);
  }
  for (const [index, problem] of problems.entries()) {
    assertRecordValue(problem, `Problem at index ${index}`, createProblem);
    assertRecordValue(problem.source, `Problem ${index} source`, createProblem);
    if (problem.extensions !== undefined) {
      assertRecordValue(problem.extensions, `Problem ${index} extensions`, createProblem);
    }
  }
  for (const [index, window] of windows.entries()) {
    assertRecordValue(window, `window at index ${index}`, createProblem);
    assertRecordValue(window.originPolicy, `window ${index} origin policy`, createProblem);
    assertArrayValue(window.exposedCommands, `window ${index} command references`, createProblem);
    assertArrayValue(window.receivedEvents, `window ${index} event references`, createProblem);
  }
}

function assertRecordValue(
  value: unknown,
  description: string,
  createProblem: GenerationProblemFactory,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw createProblem(
      `Desktop ${description} must be an object, received ${describeValueType(value)}.`,
    );
  }
}

function assertArrayValue(
  value: unknown,
  description: string,
  createProblem: GenerationProblemFactory,
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw createProblem(
      `Desktop ${description} must be an array, received ${describeValueType(value)}.`,
    );
  }
}

function assertGraphScalarFields(
  graph: DesktopContractGraphV1,
  artifactDescription: "preload bridges" | "renderer clients",
  createProblem: GenerationProblemFactory,
): void {
  assertStringIdentifier(graph.semanticHash, "contract graph semantic hash", createProblem);
  if (!/^sha256:[0-9a-f]{64}$/.test(graph.semanticHash)) {
    throw createProblem(
      `Desktop contract graph semantic hash must use canonical lowercase SHA-256 format, received ${JSON.stringify(graph.semanticHash)}.`,
    );
  }
  assertStringIdentifiers(graph.app.contractIds, "app contract reference", createProblem);
  assertStringIdentifiers(graph.app.windowIds, "app window reference", createProblem);
  assertStringIdentifiers(graph.effects, "effect namespace", createProblem);
  for (const contract of graph.contracts) {
    assertStringIdentifier(contract.id, "contract id", createProblem);
    assertStringIdentifiers(contract.commandIds, "contract command reference", createProblem);
    assertStringIdentifiers(contract.eventIds, "contract event reference", createProblem);
    assertStringIdentifiers(contract.grantIds, "contract grant reference", createProblem);
  }
  for (const command of graph.commands) {
    assertStringIdentifier(command.id, "command id", createProblem);
    assertStringIdentifier(command.contractId, "command contractId", createProblem);
    assertStringIdentifier(command.key, "command key", createProblem);
    assertStringIdentifier(command.input.id, "command input schema id", createProblem);
    assertStringIdentifier(command.output.id, "command output schema id", createProblem);
    assertStringIdentifiers(command.problems, "command Problem reference", createProblem);
    assertStringIdentifiers(command.events, "command event reference", createProblem);
    if (command.kind !== "query" && command.kind !== "mutation") {
      throw createProblem(`Desktop command ${JSON.stringify(command.id)} has an unsupported kind.`);
    }
    if (command.executionPolicy.mode !== "request-response") {
      throw createProblem(
        `Desktop command ${JSON.stringify(command.id)} has an unsupported execution mode.`,
      );
    }
    for (const field of [
      "timeoutMs",
      "maxInputBytes",
      "maxOutputBytes",
      "maxConcurrency",
    ] as const) {
      const value = command.executionPolicy[field];
      if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
        throw createProblem(
          `Desktop command ${JSON.stringify(command.id)} execution policy ${field} must be a positive safe integer.`,
        );
      }
    }
    for (const effect of command.effects) {
      assertStringIdentifier(effect.namespace, "command effect namespace", createProblem);
      assertStringIdentifiers(effect.methods, "command effect method", createProblem);
      assertStringIdentifiers(effect.grantIds, "command grant reference", createProblem);
      if (effect.access !== "read" && effect.access !== "write") {
        throw createProblem(
          `Desktop command ${JSON.stringify(command.id)} effect ${JSON.stringify(effect.namespace)} has an unsupported access mode.`,
        );
      }
    }
  }
  for (const event of graph.events) {
    assertStringIdentifier(event.id, "event id", createProblem);
    assertStringIdentifier(event.contractId, "event contractId", createProblem);
    assertStringIdentifier(event.key, "event key", createProblem);
    assertStringIdentifier(event.payload.id, "event payload schema id", createProblem);
  }
  for (const grant of graph.grants) {
    assertStringIdentifier(grant.id, "grant id", createProblem);
    assertStringIdentifier(grant.contractId, "grant contractId", createProblem);
    assertStringIdentifier(grant.key, "grant key", createProblem);
    if (grant.resource !== "file" && grant.resource !== "directory") {
      throw createProblem(`Desktop grant ${JSON.stringify(grant.id)} has an unsupported resource.`);
    }
    if (grant.access !== "read" && grant.access !== "write") {
      throw createProblem(
        `Desktop grant ${JSON.stringify(grant.id)} has an unsupported access mode.`,
      );
    }
    if (grant.scope !== "exact" && grant.scope !== "descendant") {
      throw createProblem(`Desktop grant ${JSON.stringify(grant.id)} has an unsupported scope.`);
    }
    if (
      grant.lifetime !== "command" &&
      grant.lifetime !== "window" &&
      grant.lifetime !== "session"
    ) {
      throw createProblem(`Desktop grant ${JSON.stringify(grant.id)} has an unsupported lifetime.`);
    }
  }
  for (const problem of graph.problems) {
    assertStringIdentifier(problem.code, "Problem code", createProblem);
    if (!Object.values(ProblemCategory).includes(problem.category)) {
      throw createProblem(
        `Desktop Problem ${JSON.stringify(problem.code)} has an unsupported category.`,
      );
    }
    assertProblemSource(problem, createProblem);
  }
  for (const window of graph.windows) {
    assertStringIdentifier(window.id, "window id", createProblem);
    assertStringIdentifiers(window.exposedCommands, "window command reference", createProblem);
    assertStringIdentifiers(window.receivedEvents, "window event reference", createProblem);
    if (window.trust !== "local" && window.trust !== "remote") {
      throw createProblem(
        artifactDescription === "preload bridges"
          ? `Desktop window ${formatDiagnosticValue(window.id)} has unsupported trust ${formatDiagnosticValue(window.trust)}.`
          : `Desktop window ${JSON.stringify(window.id)} has an unsupported trust mode.`,
      );
    }
    const originPolicyMode: unknown = window.originPolicy.mode;
    if (originPolicyMode !== "local-content" && originPolicyMode !== "remote-allowlist") {
      throw createProblem(
        artifactDescription === "preload bridges"
          ? `Desktop window ${formatDiagnosticValue(window.id)} has unsupported origin policy ${formatDiagnosticValue(originPolicyMode)}.`
          : `Desktop window ${JSON.stringify(window.id)} has an unsupported origin policy.`,
      );
    }
    const expectedOriginPolicy = window.trust === "local" ? "local-content" : "remote-allowlist";
    if (originPolicyMode !== expectedOriginPolicy) {
      throw createProblem(
        `Desktop window ${JSON.stringify(window.id)} trust ${JSON.stringify(window.trust)} requires origin policy ${JSON.stringify(expectedOriginPolicy)}, received ${JSON.stringify(originPolicyMode)}.`,
      );
    }
    if (window.originPolicy.mode === "remote-allowlist") {
      assertStringIdentifier(window.originPolicy.initialUrl, "window initial URL", createProblem);
      assertStringIdentifiers(
        window.originPolicy.allowedOrigins,
        "window allowed origin",
        createProblem,
      );
    }
  }
}

function assertProblemSource(
  problem: DesktopContractGraphProblem,
  createProblem: GenerationProblemFactory,
): void {
  const { source } = problem;
  assertStringIdentifier(source.package, "Problem source package", createProblem);
  if (typeof source.retryable !== "boolean") {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source retryable must be a boolean.`,
    );
  }
  if (source.retryability !== "retryable" && source.retryability !== "not-retryable") {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source has unsupported retryability.`,
    );
  }
  if (source.retryability !== (source.retryable ? "retryable" : "not-retryable")) {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source has inconsistent retryability metadata.`,
    );
  }
  if (typeof source.public !== "boolean") {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source public must be a boolean.`,
    );
  }
  if (source.visibility !== "public" && source.visibility !== "private") {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source has unsupported visibility.`,
    );
  }
  if (source.visibility !== (source.public ? "public" : "private")) {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source has inconsistent visibility metadata.`,
    );
  }
  if (
    source.redaction !== "public" &&
    source.redaction !== "safe" &&
    source.redaction !== "operator-only"
  ) {
    throw createProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} source has unsupported redaction.`,
    );
  }
  assertStringIdentifier(source.cookbookPath, "Problem source cookbook path", createProblem);
}

function assertStringIdentifiers(
  values: unknown,
  description: string,
  createProblem: GenerationProblemFactory,
): void {
  assertArrayValue(values, `${description} inventory`, createProblem);
  for (const value of values) {
    assertStringIdentifier(value, description, createProblem);
  }
}

function assertStringIdentifier(
  value: unknown,
  description: string,
  createProblem: GenerationProblemFactory,
): asserts value is string {
  if (typeof value !== "string") {
    throw createProblem(
      `Desktop ${description} must be a string, received ${describeValueType(value)}.`,
    );
  }
}

function describeValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "array" : typeof value;
}

function formatDiagnosticValue(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  return describeValueType(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
