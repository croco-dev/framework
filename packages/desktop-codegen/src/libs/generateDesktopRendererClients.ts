import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  DesktopContractGraphCommand,
  DesktopContractGraphEvent,
  DesktopContractGraphGrant,
  DesktopContractGraphProblem,
  DesktopContractGraphSchema,
  DesktopContractGraphV1,
  DesktopContractGraphWindow,
  DesktopWireSchemaDescriptor,
} from "@croco/protocols-desktop";

export type DesktopRendererClientSource = {
  readonly windowId: string;
  readonly source: string;
};

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
  readonly contracts: ReadonlySet<string>;
  readonly events: ReadonlyMap<string, DesktopContractGraphEvent>;
  readonly grants: ReadonlyMap<string, DesktopContractGraphGrant>;
  readonly problems: ReadonlyMap<string, DesktopContractGraphProblem>;
};

export function generateDesktopRendererClients(
  graph: DesktopContractGraphV1,
): readonly DesktopRendererClientSource[] {
  assertGeneratableGraph(graph);
  const indexes = createGraphIndexes(graph);
  createUniqueIndex(graph.windows, "window");

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
  if (graph.version !== "croco.desktop-contract-graph.v1") {
    throw new DesktopRendererGenerationProblem(
      `Expected croco.desktop-contract-graph.v1, received ${JSON.stringify(graph.version)}.`,
    );
  }
  if (graph.diagnostics.length > 0) {
    throw new DesktopRendererGenerationProblem(
      `Cannot generate renderer clients from a graph with ${graph.diagnostics.length} diagnostic${graph.diagnostics.length === 1 ? "" : "s"}.`,
    );
  }
}

function createGraphIndexes(graph: DesktopContractGraphV1): GraphIndexes {
  const contracts = createUniqueIndex(graph.contracts, "contract");
  return {
    commands: createUniqueIndex(graph.commands, "command"),
    contracts: new Set(contracts.keys()),
    events: createUniqueIndex(graph.events, "event"),
    grants: createUniqueIndex(graph.grants, "grant"),
    problems: createUniqueIndex(graph.problems, "problem"),
  };
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
    "export type DesktopRendererCommandOptions = {",
    "  readonly signal?: AbortSignal;",
    "};",
    "",
    ...generateBridgeType(contracts, indexes),
    "",
    "const bridge = (globalThis as typeof globalThis & {",
    "  readonly crocoDesktop: DesktopRendererBridge;",
    "}).crocoDesktop;",
    "",
    "export const desktop = Object.freeze({",
    ...generateClientContracts(contracts, indexes),
    "});",
    "",
  ].join("\n");
}

function collectContracts(
  capabilities: RendererCapabilities,
  contractIds: ReadonlySet<string>,
): readonly ContractCapabilities[] {
  const contracts = new Map<
    string,
    { commands: DesktopContractGraphCommand[]; events: DesktopContractGraphEvent[] }
  >();

  for (const command of capabilities.commands) {
    assertMember(command, "command", contractIds);
    const contract = getOrCreateContract(contracts, command.contractId);
    assertUniqueMember(contract, command.key, command.contractId);
    contract.commands.push(command);
  }
  for (const event of capabilities.events) {
    assertMember(event, "event", contractIds);
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
  member: DesktopContractGraphCommand | DesktopContractGraphEvent,
  kind: "command" | "event",
  contractIds: ReadonlySet<string>,
): void {
  if (!contractIds.has(member.contractId)) {
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
        `      readonly [${JSON.stringify(command.key)}]: (input: ${renderSchemaReference(command.input.descriptor, indexes)}, options?: DesktopRendererCommandOptions) => Promise<${renderCommandResult(command, indexes)}>;`,
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
        `      bridge.commands[${JSON.stringify(contract.contractId)}][${JSON.stringify(command.key)}](input, options),`,
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
  }
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
