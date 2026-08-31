import { Problem, ProblemCategory, createProblemResponseExtensions } from "@croco/problems-core";
import type { ProblemRedactionPolicy } from "@croco/problems-core";
import type {
  DesktopContractGraphCommand,
  DesktopContractGraphContract,
  DesktopContractGraphEvent,
  DesktopContractGraphGrant,
  DesktopContractGraphProblem,
  DesktopContractGraphSchema,
  DesktopContractGraphV1,
  DesktopContractGraphWindow,
  DesktopWireSchemaDescriptor,
} from "@croco/protocols-desktop";
import { assertDesktopContractGraphGeneratable } from "./assertDesktopContractGraphGeneratable";

export type DesktopRendererClientSource = {
  readonly windowId: string;
  readonly source: string;
};

/** Reports a contract-graph validation failure that prevents renderer client generation. */
export class DesktopRendererGenerationProblem extends Problem {
  public constructor(detail: string) {
    super(
      "desktop-codegen/invalid-renderer-contract-graph",
      ProblemCategory.ValidationError,
      detail,
    );
  }
}

type RendererCapabilities = {
  readonly commands: readonly DesktopContractGraphCommand[];
  readonly events: readonly DesktopContractGraphEvent[];
};

type ContractCapabilities = {
  readonly contractId: string;
  readonly commands: readonly DesktopContractGraphCommand[];
  readonly events: readonly DesktopContractGraphEvent[];
};

type GraphIndexes = {
  readonly commands: ReadonlyMap<string, DesktopContractGraphCommand>;
  readonly contracts: ReadonlyMap<string, DesktopContractGraphContract>;
  readonly events: ReadonlyMap<string, DesktopContractGraphEvent>;
  readonly grants: ReadonlyMap<string, DesktopContractGraphGrant>;
  readonly problems: ReadonlyMap<string, DesktopContractGraphProblem>;
  readonly windows: ReadonlyMap<string, DesktopContractGraphWindow>;
};

export function generateDesktopRendererClients(
  graph: DesktopContractGraphV1,
): readonly DesktopRendererClientSource[] {
  assertGeneratableGraph(graph);
  const indexes = createGraphIndexes(graph);
  assertGraphIntegrity(graph, indexes);

  return [...graph.windows].sort(compareById).flatMap((window) =>
    window.trust === "remote"
      ? []
      : [
          {
            windowId: window.id,
            source: generateWindowSource(collectWindowCapabilities(window, indexes), indexes),
          },
        ],
  );
}

function assertGeneratableGraph(graph: DesktopContractGraphV1): void {
  assertDesktopContractGraphGeneratable(
    graph,
    "renderer clients",
    (detail) => new DesktopRendererGenerationProblem(detail),
  );
}

function createGraphIndexes(graph: DesktopContractGraphV1): GraphIndexes {
  assertUniqueMemberIds(graph);
  return {
    commands: createUniqueIndex(graph.commands, "command"),
    contracts: createUniqueIndex(graph.contracts, "contract"),
    events: createUniqueIndex(graph.events, "event"),
    grants: createUniqueIndex(graph.grants, "grant"),
    problems: createUniqueIndex(graph.problems, "problem"),
    windows: createUniqueIndex(graph.windows, "window"),
  };
}

function assertUniqueMemberIds(graph: DesktopContractGraphV1): void {
  const owners = new Map<string, "command" | "event" | "grant">();
  for (const [kind, members] of [
    ["command", graph.commands],
    ["event", graph.events],
    ["grant", graph.grants],
  ] as const) {
    for (const member of members) {
      const existing = owners.get(member.id);
      if (existing) {
        throw new DesktopRendererGenerationProblem(
          `Desktop member id ${JSON.stringify(member.id)} is declared as both ${existing} and ${kind}.`,
        );
      }
      owners.set(member.id, kind);
    }
  }
}

function assertGraphIntegrity(graph: DesktopContractGraphV1, indexes: GraphIndexes): void {
  assertInventory(graph.app.contractIds, indexes.contracts.keys(), "Desktop app contract");
  assertInventory(graph.app.windowIds, indexes.windows.keys(), "Desktop app window");
  assertInventory(
    graph.effects,
    new Set(graph.commands.flatMap((command) => command.effects.map((effect) => effect.namespace))),
    "Desktop effect namespace",
  );

  for (const contract of graph.contracts) {
    assertInventory(
      contract.commandIds,
      graph.commands
        .filter((command) => command.contractId === contract.id)
        .map((command) => command.id),
      `Desktop contract ${JSON.stringify(contract.id)} command`,
    );
    assertInventory(
      contract.eventIds,
      graph.events.filter((event) => event.contractId === contract.id).map((event) => event.id),
      `Desktop contract ${JSON.stringify(contract.id)} event`,
    );
    assertInventory(
      contract.grantIds,
      graph.grants.filter((grant) => grant.contractId === contract.id).map((grant) => grant.id),
      `Desktop contract ${JSON.stringify(contract.id)} grant`,
    );
  }

  for (const command of graph.commands) {
    assertMember(command, "command", indexes.contracts);
    assertSchemaReferenceId(command.input.id, `${command.id}.input`);
    assertSchemaReferenceId(command.output.id, `${command.id}.output`);
    assertSchemaDescriptor(command.input.descriptor, command.id, command.contractId, indexes);
    assertSchemaDescriptor(command.output.descriptor, command.id, command.contractId, indexes);
    for (const problemCode of command.problems) {
      assertReferencedRecord(indexes.problems, problemCode, "Problem", command.id);
    }
    for (const eventId of command.events) {
      const event = assertReferencedRecord(indexes.events, eventId, "event", command.id);
      assertSameContract(event, command.contractId, "event", command.id);
    }
    for (const effect of command.effects) {
      for (const grantId of effect.grantIds) {
        const grant = assertReferencedRecord(indexes.grants, grantId, "grant", command.id);
        assertSameContract(grant, command.contractId, "grant", command.id);
      }
    }
  }
  for (const event of graph.events) {
    assertMember(event, "event", indexes.contracts);
    assertSchemaReferenceId(event.payload.id, `${event.id}.payload`);
    assertSchemaDescriptor(event.payload.descriptor, event.id, event.contractId, indexes);
  }
  for (const problem of graph.problems) {
    if (problem.extensions) {
      assertWireSchemaDescriptor(problem.extensions, `Problem ${problem.code}`);
      assertProblemExtensions(problem);
    }
  }
  for (const grant of graph.grants) {
    assertMember(grant, "grant", indexes.contracts);
    if (grant.resource === "file" && grant.scope !== "exact") {
      throw new DesktopRendererGenerationProblem(
        `Desktop file grant ${JSON.stringify(grant.id)} must use exact scope.`,
      );
    }
  }
  for (const window of graph.windows) {
    for (const commandId of window.exposedCommands) {
      assertReferencedRecord(indexes.commands, commandId, "command", window.id);
    }
    for (const eventId of window.receivedEvents) {
      assertReferencedRecord(indexes.events, eventId, "event", window.id);
    }
  }
}

function assertProblemExtensions(problem: DesktopContractGraphProblem): void {
  const { extensions } = problem;
  if (!extensions) return;
  if (extensions.kind !== "object") {
    throw new DesktopRendererGenerationProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} extensions must be a strict object schema.`,
    );
  }

  const redaction = problem.source.redaction === "safe" ? "safe-message" : problem.source.redaction;
  const unsafePath = problem.source.public
    ? findUnsafeProblemExtensionPath(extensions, [], redaction)
    : [extensions.fields[0]?.name ?? "extensions"];
  if (unsafePath) {
    throw new DesktopRendererGenerationProblem(
      `Desktop Problem ${JSON.stringify(problem.code)} exposes extension field ${JSON.stringify(unsafePath.join("."))} outside its response policy.`,
    );
  }
}

function findUnsafeProblemExtensionPath(
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
        const nested = findUnsafeProblemExtensionPath(field.schema, fieldPath, redaction);
        if (nested) return nested;
      }
      return undefined;
    case "array":
      return findUnsafeProblemExtensionPath(descriptor.element, [...path, "[]"], redaction);
    case "optional":
    case "nullable":
      return findUnsafeProblemExtensionPath(descriptor.inner, path, redaction);
    case "union":
      for (const [index, option] of descriptor.options.entries()) {
        const nested = findUnsafeProblemExtensionPath(
          option,
          [...path, `option${index}`],
          redaction,
        );
        if (nested) return nested;
      }
      return undefined;
    default:
      return undefined;
  }
}

function assertSchemaDescriptor(
  descriptor: DesktopContractGraphSchema | null,
  ownerId: string,
  contractId: string,
  indexes: GraphIndexes,
): void {
  if (!descriptor) {
    throw new DesktopRendererGenerationProblem(
      `Desktop member ${JSON.stringify(ownerId)} has no schema descriptor.`,
    );
  }
  if (!isRecord(descriptor) || typeof descriptor.kind !== "string") {
    throwInvalidSchemaDescriptor(ownerId, "$", "expected a descriptor object with a string kind");
  }
  if (descriptor.kind !== "grant-reference") {
    assertWireSchemaDescriptor(descriptor, ownerId);
    return;
  }
  if (typeof descriptor.grantId !== "string") {
    throwInvalidSchemaDescriptor(ownerId, "$", "grant-reference requires a string grantId");
  }
  const grant = assertReferencedRecord(indexes.grants, descriptor.grantId, "grant", ownerId);
  assertSameContract(grant, contractId, "grant", ownerId);
}

function assertWireSchemaDescriptor(
  descriptor: unknown,
  ownerId: string,
  path = "$",
  ancestors: ReadonlySet<object> = new Set(),
): asserts descriptor is DesktopWireSchemaDescriptor {
  if (!isRecord(descriptor) || typeof descriptor.kind !== "string") {
    throwInvalidSchemaDescriptor(ownerId, path, "expected a descriptor object with a string kind");
  }
  if (ancestors.has(descriptor)) {
    throwInvalidSchemaDescriptor(ownerId, path, "recursive descriptors are not supported");
  }

  const nextAncestors = new Set(ancestors).add(descriptor);
  switch (descriptor.kind) {
    case "string":
    case "number":
    case "boolean":
    case "null":
      return;
    case "literal":
      if (!isWireLiteral(descriptor.value)) {
        throwInvalidSchemaDescriptor(
          ownerId,
          path,
          "literal values must be strings, finite numbers, booleans, or null",
        );
      }
      return;
    case "enum": {
      if (!Array.isArray(descriptor.values) || descriptor.values.length === 0) {
        throwInvalidSchemaDescriptor(ownerId, path, "enum values must be a non-empty array");
      }
      if (!Array.from(descriptor.values).every(isWireEnumValue)) {
        throwInvalidSchemaDescriptor(
          ownerId,
          path,
          "enum values must be strings or finite numbers",
        );
      }
      if (new Set(descriptor.values).size !== descriptor.values.length) {
        throwInvalidSchemaDescriptor(ownerId, path, "enum values must be unique");
      }
      return;
    }
    case "array":
      assertWireSchemaDescriptor(descriptor.element, ownerId, `${path}.element`, nextAncestors);
      return;
    case "optional":
    case "nullable":
      assertWireSchemaDescriptor(descriptor.inner, ownerId, `${path}.inner`, nextAncestors);
      return;
    case "union":
      if (!Array.isArray(descriptor.options) || descriptor.options.length < 2) {
        throwInvalidSchemaDescriptor(
          ownerId,
          path,
          "union options must contain at least two schemas",
        );
      }
      for (let index = 0; index < descriptor.options.length; index += 1) {
        assertWireSchemaDescriptor(
          descriptor.options[index],
          ownerId,
          `${path}.options[${index}]`,
          nextAncestors,
        );
      }
      return;
    case "object": {
      if (descriptor.unknownKeys !== "reject") {
        throwInvalidSchemaDescriptor(ownerId, path, 'object unknownKeys must be "reject"');
      }
      if (!Array.isArray(descriptor.fields)) {
        throwInvalidSchemaDescriptor(ownerId, path, "object fields must be an array");
      }
      const names = new Set<string>();
      for (let index = 0; index < descriptor.fields.length; index += 1) {
        const field = descriptor.fields[index];
        const fieldPath = `${path}.fields[${index}]`;
        if (!isRecord(field) || typeof field.name !== "string") {
          throwInvalidSchemaDescriptor(ownerId, fieldPath, "object fields require a string name");
        }
        if (names.has(field.name)) {
          throwInvalidSchemaDescriptor(
            ownerId,
            fieldPath,
            `object field name ${JSON.stringify(field.name)} is duplicated`,
          );
        }
        names.add(field.name);
        if (typeof field.required !== "boolean") {
          throwInvalidSchemaDescriptor(
            ownerId,
            fieldPath,
            "object fields require a boolean required flag",
          );
        }
        assertWireSchemaDescriptor(field.schema, ownerId, `${fieldPath}.schema`, nextAncestors);
      }
      return;
    }
    default:
      throwInvalidSchemaDescriptor(
        ownerId,
        path,
        `unsupported kind ${JSON.stringify(descriptor.kind)}`,
      );
  }
}

function throwInvalidSchemaDescriptor(ownerId: string, path: string, detail: string): never {
  throw new DesktopRendererGenerationProblem(
    `Desktop member ${JSON.stringify(ownerId)} has an invalid schema descriptor at ${path}: ${detail}.`,
  );
}

function isWireLiteral(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  );
}

function isWireEnumValue(value: unknown): value is string | number {
  return typeof value === "string" || isFiniteNumber(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertReferencedRecord<T>(
  records: ReadonlyMap<string, T>,
  id: string,
  kind: "command" | "event" | "grant" | "Problem",
  ownerId: string,
): T {
  const record = records.get(id);
  if (!record) {
    throw new DesktopRendererGenerationProblem(
      `Desktop member ${JSON.stringify(ownerId)} references missing ${kind} ${JSON.stringify(id)}.`,
    );
  }
  return record;
}

function assertSameContract(
  member: DesktopContractGraphEvent | DesktopContractGraphGrant,
  contractId: string,
  kind: "event" | "grant",
  ownerId: string,
): void {
  if (member.contractId !== contractId) {
    throw new DesktopRendererGenerationProblem(
      `Desktop member ${JSON.stringify(ownerId)} references ${kind} ${JSON.stringify(member.id)} from contract ${JSON.stringify(member.contractId)}.`,
    );
  }
}

function assertInventory(
  actual: readonly string[],
  expectedValues: Iterable<string>,
  description: string,
): void {
  const expected = new Set(expectedValues);
  const actualSet = new Set(actual);
  const missing = [...expected].filter((id) => !actualSet.has(id));
  const unexpected = actual.filter((id) => !expected.has(id));
  if (actualSet.size !== actual.length || missing.length > 0 || unexpected.length > 0) {
    throw new DesktopRendererGenerationProblem(
      `${description} inventory does not match its records.`,
    );
  }
}

function assertSchemaReferenceId(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new DesktopRendererGenerationProblem(
      `Desktop schema reference ${JSON.stringify(actual)} must use owning member ID ${JSON.stringify(expected)}.`,
    );
  }
}

function createUniqueIndex<T extends { readonly id?: string; readonly code?: string }>(
  records: readonly T[],
  kind: "command" | "contract" | "event" | "grant" | "problem" | "window",
): ReadonlyMap<string, T> {
  const index = new Map<string, T>();
  for (const record of records) {
    const id = record.id ?? record.code;
    if (id === undefined) {
      throw new DesktopRendererGenerationProblem(
        `Desktop contract graph contains an unnamed ${kind}.`,
      );
    }
    if (index.has(id)) {
      throw new DesktopRendererGenerationProblem(
        `Desktop contract graph contains duplicate ${kind} ID ${JSON.stringify(id)}.`,
      );
    }
    index.set(id, record);
  }
  return index;
}

function collectWindowCapabilities(
  window: DesktopContractGraphWindow,
  indexes: GraphIndexes,
): RendererCapabilities {
  return {
    commands: window.exposedCommands.map((commandId) =>
      requireCapability(indexes.commands, commandId, "command", window.id),
    ),
    events: window.receivedEvents.map((eventId) =>
      requireCapability(indexes.events, eventId, "event", window.id),
    ),
  };
}

function requireCapability<T>(
  records: ReadonlyMap<string, T>,
  id: string,
  kind: "command" | "event",
  windowId: string,
): T {
  const record = records.get(id);
  if (!record) {
    throw new DesktopRendererGenerationProblem(
      `Local window ${JSON.stringify(windowId)} references missing ${kind} ${JSON.stringify(id)}.`,
    );
  }
  return record;
}

function generateWindowSource(capabilities: RendererCapabilities, indexes: GraphIndexes): string {
  const contracts = collectContracts(capabilities, indexes.contracts);
  const hasCommands = capabilities.commands.length > 0;
  const hasCapabilities = hasCommands || capabilities.events.length > 0;
  const usesGrantReference = contracts.some((contract) =>
    [...contract.commands, ...contract.events].some((member) => memberUsesGrantReference(member)),
  );
  const importedTypes = [
    usesGrantReference ? "DesktopGrantReference" : undefined,
    contracts.some((contract) => contract.commands.length > 0) ? "DesktopResult" : undefined,
  ].filter((type): type is string => type !== undefined);
  const imports =
    importedTypes.length > 0
      ? [`import type { ${importedTypes.join(", ")} } from '@croco/protocols-desktop';`, ""]
      : [];

  return [
    ...imports,
    ...(hasCommands
      ? [
          "export type DesktopRendererCommandOptions = {",
          "  readonly signal?: AbortSignal;",
          "};",
          "",
          "type DesktopAbortRegistration = (abort: () => void) => () => void;",
          "",
        ]
      : []),
    ...(hasCapabilities
      ? [
          ...generateBridgeType(contracts, indexes),
          "",
          "const bridge = (globalThis as typeof globalThis & {",
          "  readonly crocoDesktop: DesktopRendererBridge;",
          "}).crocoDesktop;",
          "",
        ]
      : []),
    ...(hasCommands
      ? [
          "function invokeDesktopCommand<TInput, TOutput>(",
          "  command: (input: TInput, registerAbort?: DesktopAbortRegistration) => Promise<TOutput>,",
          "  input: TInput,",
          "  signal: AbortSignal | undefined,",
          "): Promise<TOutput> {",
          "  if (signal === undefined) {",
          "    return command(input);",
          "  }",
          "",
          "  return command(input, (abort) => {",
          "    if (signal.aborted) {",
          "      abort();",
          "      return () => {};",
          "    }",
          "",
          '    signal.addEventListener("abort", abort, { once: true });',
          '    return () => signal.removeEventListener("abort", abort);',
          "  });",
          "}",
          "",
        ]
      : []),
    "export const desktop = Object.freeze({",
    ...generateClientContracts(contracts, indexes),
    "});",
    "",
  ].join("\n");
}

function collectContracts(
  capabilities: RendererCapabilities,
  contractsById: ReadonlyMap<string, DesktopContractGraphContract>,
): readonly ContractCapabilities[] {
  const contracts = new Map<
    string,
    { commands: DesktopContractGraphCommand[]; events: DesktopContractGraphEvent[] }
  >();

  for (const command of capabilities.commands) {
    assertMember(command, "command", contractsById);
    const contract = getOrCreateContract(contracts, command.contractId);
    assertUniqueMember(contract, command.key, command.contractId);
    contract.commands.push(command);
  }
  for (const event of capabilities.events) {
    assertMember(event, "event", contractsById);
    const contract = getOrCreateContract(contracts, event.contractId);
    assertUniqueMember(contract, event.key, event.contractId);
    contract.events.push(event);
  }

  return [...contracts.entries()]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([contractId, members]) => ({
      contractId,
      commands: members.commands.sort(compareMembers),
      events: members.events.sort(compareMembers),
    }));
}

function getOrCreateContract(
  contracts: Map<
    string,
    { commands: DesktopContractGraphCommand[]; events: DesktopContractGraphEvent[] }
  >,
  contractId: string,
): { commands: DesktopContractGraphCommand[]; events: DesktopContractGraphEvent[] } {
  const existing = contracts.get(contractId);
  if (existing) {
    return existing;
  }
  const created = { commands: [], events: [] };
  contracts.set(contractId, created);
  return created;
}

function assertMember(
  member: DesktopContractGraphCommand | DesktopContractGraphEvent | DesktopContractGraphGrant,
  kind: "command" | "event" | "grant",
  contracts: ReadonlyMap<string, DesktopContractGraphContract>,
): void {
  if (!contracts.has(member.contractId)) {
    throw new DesktopRendererGenerationProblem(
      `Desktop ${kind} ${JSON.stringify(member.id)} references missing contract ${JSON.stringify(member.contractId)}.`,
    );
  }
  if (member.id !== `${member.contractId}.${member.key}`) {
    throw new DesktopRendererGenerationProblem(
      `Desktop ${kind} ${JSON.stringify(member.id)} does not match contract ${JSON.stringify(member.contractId)} and member key ${JSON.stringify(member.key)}.`,
    );
  }
}

function assertUniqueMember(
  contract: {
    readonly commands: readonly DesktopContractGraphCommand[];
    readonly events: readonly DesktopContractGraphEvent[];
  },
  key: string,
  contractId: string,
): void {
  if (
    contract.commands.some((command) => command.key === key) ||
    contract.events.some((event) => event.key === key)
  ) {
    throw new DesktopRendererGenerationProblem(
      `Desktop contract ${JSON.stringify(contractId)} exposes duplicate member key ${JSON.stringify(key)}.`,
    );
  }
}

function generateBridgeType(
  contracts: readonly ContractCapabilities[],
  indexes: GraphIndexes,
): readonly string[] {
  const lines = ["type DesktopRendererBridge = {", "  readonly commands: {"];
  for (const contract of contracts.filter((item) => item.commands.length > 0)) {
    lines.push(`    readonly [${JSON.stringify(contract.contractId)}]: {`);
    for (const command of contract.commands) {
      lines.push(
        `      readonly [${JSON.stringify(command.key)}]: (input: ${renderSchemaReference(command.input.descriptor, indexes)}, registerAbort?: DesktopAbortRegistration) => Promise<${renderCommandResult(command, indexes)}>;`,
      );
    }
    lines.push("    };");
  }
  lines.push("  };", "  readonly events: {");
  for (const contract of contracts.filter((item) => item.events.length > 0)) {
    lines.push(`    readonly [${JSON.stringify(contract.contractId)}]: {`);
    for (const event of contract.events) {
      lines.push(
        `      readonly [${JSON.stringify(event.key)}]: (callback: (payload: ${renderSchemaReference(event.payload.descriptor, indexes)}) => void) => () => void;`,
      );
    }
    lines.push("    };");
  }
  lines.push("  };", "};");
  return lines;
}

function generateClientContracts(
  contracts: readonly ContractCapabilities[],
  indexes: GraphIndexes,
): readonly string[] {
  const lines: string[] = [];
  for (const contract of contracts) {
    lines.push(`  [${JSON.stringify(contract.contractId)}]: Object.freeze({`);
    for (const command of contract.commands) {
      lines.push(
        `    [${JSON.stringify(command.key)}]: (input: ${renderSchemaReference(command.input.descriptor, indexes)}, options: DesktopRendererCommandOptions = {}): Promise<${renderCommandResult(command, indexes)}> =>`,
        `      invokeDesktopCommand(bridge.commands[${JSON.stringify(contract.contractId)}][${JSON.stringify(command.key)}], input, options.signal),`,
      );
    }
    for (const event of contract.events) {
      lines.push(
        `    [${JSON.stringify(event.key)}]: Object.freeze({`,
        `      subscribe: (callback: (payload: ${renderSchemaReference(event.payload.descriptor, indexes)}) => void): (() => void) =>`,
        `        bridge.events[${JSON.stringify(contract.contractId)}][${JSON.stringify(event.key)}]((payload) => callback(payload)),`,
        "    }),",
      );
    }
    lines.push("  }),");
  }
  return lines;
}

function renderCommandResult(command: DesktopContractGraphCommand, indexes: GraphIndexes): string {
  const output = renderSchemaReference(command.output.descriptor, indexes);
  const problems = [...command.problems].sort(compareCodeUnits).map((code) => {
    const problem = indexes.problems.get(code);
    if (!problem) {
      throw new DesktopRendererGenerationProblem(
        `Desktop command ${JSON.stringify(command.id)} references missing Problem ${JSON.stringify(code)}.`,
      );
    }
    return renderProblem(problem);
  });
  return `DesktopResult<${output}, ${problems.length === 0 ? "never" : problems.join(" | ")}>`;
}

function renderProblem(problem: DesktopContractGraphProblem): string {
  const extensions = problem.extensions
    ? `; readonly extensions?: ${renderWireSchema(problem.extensions)}`
    : "";
  return `{ readonly code: ${JSON.stringify(problem.code)}; readonly category: ${JSON.stringify(problem.category)}${extensions} }`;
}

function renderSchemaReference(
  descriptor: DesktopContractGraphSchema | null,
  indexes: GraphIndexes,
): string {
  if (!descriptor) {
    throw new DesktopRendererGenerationProblem(
      "Desktop contract graph contains a command or event with no schema descriptor.",
    );
  }
  if (descriptor.kind !== "grant-reference") {
    return renderWireSchema(descriptor);
  }
  const grant = indexes.grants.get(descriptor.grantId);
  if (!grant) {
    throw new DesktopRendererGenerationProblem(
      `Desktop contract graph references missing grant ${JSON.stringify(descriptor.grantId)}.`,
    );
  }
  if (grant.resource === "file" && grant.scope !== "exact") {
    throw new DesktopRendererGenerationProblem(
      `Desktop file grant ${JSON.stringify(grant.id)} must use exact scope.`,
    );
  }
  return `DesktopGrantReference<${JSON.stringify(grant.resource)}, ${JSON.stringify(grant.access)}, ${JSON.stringify(grant.scope)}, ${JSON.stringify(grant.lifetime)}>`;
}

function renderWireSchema(descriptor: DesktopWireSchemaDescriptor): string {
  switch (descriptor.kind) {
    case "string":
    case "number":
    case "boolean":
    case "null":
      return descriptor.kind;
    case "literal":
      return JSON.stringify(descriptor.value);
    case "enum":
      return descriptor.values.map((value) => JSON.stringify(value)).join(" | ");
    case "array":
      return `ReadonlyArray<${renderWireSchema(descriptor.element)}>`;
    case "optional":
      return `${parenthesizeUnion(renderWireSchema(descriptor.inner))} | undefined`;
    case "nullable":
      return `${parenthesizeUnion(renderWireSchema(descriptor.inner))} | null`;
    case "union":
      return descriptor.options
        .map((option) => parenthesizeUnion(renderWireSchema(option)))
        .join(" | ");
    case "object":
      return `{ ${descriptor.fields
        .map(
          (field) =>
            `readonly [${JSON.stringify(field.name)}]${field.required ? "" : "?"}: ${renderWireSchema(field.schema)};`,
        )
        .join(" ")} }`;
    default:
      return throwUnsupportedSchemaDescriptor(descriptor);
  }
}

function throwUnsupportedSchemaDescriptor(descriptor: never): never {
  const kind = (descriptor as { readonly kind?: unknown }).kind;
  throw new DesktopRendererGenerationProblem(
    `Desktop contract graph contains unsupported schema descriptor kind ${JSON.stringify(kind)}.`,
  );
}

function parenthesizeUnion(type: string): string {
  return type.includes(" | ") ? `(${type})` : type;
}

function memberUsesGrantReference(
  member: DesktopContractGraphCommand | DesktopContractGraphEvent,
): boolean {
  return "input" in member
    ? member.input.descriptor?.kind === "grant-reference" ||
        member.output.descriptor?.kind === "grant-reference"
    : member.payload.descriptor?.kind === "grant-reference";
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareCodeUnits(left.id, right.id);
}

function compareMembers(
  left: { readonly contractId: string; readonly key: string; readonly id: string },
  right: { readonly contractId: string; readonly key: string; readonly id: string },
): number {
  return (
    compareCodeUnits(left.contractId, right.contractId) ||
    compareCodeUnits(left.key, right.key) ||
    compareCodeUnits(left.id, right.id)
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
