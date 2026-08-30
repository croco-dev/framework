import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  DesktopContractGraphCommand,
  DesktopContractGraphEvent,
  DesktopContractGraphV1,
  DesktopContractGraphWindow,
} from "@croco/protocols-desktop";

export type DesktopPreloadBridgeSource = {
  readonly windowId: string;
  readonly source: string;
};

export type DesktopPreloadContextBridge = {
  exposeInMainWorld(name: "crocoDesktop", api: Readonly<Record<string, unknown>>): void;
};

export type DesktopPreloadCommandOptions = {
  readonly signal?: AbortSignal;
};

export type DesktopPreloadTransport = {
  invoke(
    commandId: string,
    input: unknown,
    options: DesktopPreloadCommandOptions,
  ): Promise<unknown>;
  subscribe(eventId: string, callback: (payload: unknown) => void): () => void;
};

export class DesktopPreloadGenerationProblem extends Problem {
  public constructor(detail: string) {
    super("desktop-codegen/invalid-contract-graph", ProblemCategory.ValidationError, detail);
  }
}

type WindowCapabilities = {
  readonly commands: readonly DesktopContractGraphCommand[];
  readonly events: readonly DesktopContractGraphEvent[];
};

type ContractCapabilities = {
  readonly contractId: string;
  readonly commands: readonly DesktopContractGraphCommand[];
  readonly events: readonly DesktopContractGraphEvent[];
};

export function generateDesktopPreloadBridges(
  graph: DesktopContractGraphV1,
): readonly DesktopPreloadBridgeSource[] {
  assertGeneratableGraph(graph);

  createUniqueIndex(graph.windows, "window");
  const commandsById = createUniqueIndex(graph.commands, "command");
  const eventsById = createUniqueIndex(graph.events, "event");

  return [...graph.windows].sort(compareById).flatMap((window) =>
    window.trust === "remote"
      ? []
      : [
          {
            windowId: window.id,
            source: generateWindowSource(
              collectWindowCapabilities(window, commandsById, eventsById),
            ),
          },
        ],
  );
}

function assertGeneratableGraph(graph: DesktopContractGraphV1): void {
  if (graph.version !== "croco.desktop-contract-graph.v1") {
    throw new DesktopPreloadGenerationProblem(
      `Expected croco.desktop-contract-graph.v1, received ${formatDiagnosticValue(graph.version)}.`,
    );
  }

  if (graph.diagnostics.length > 0) {
    throw new DesktopPreloadGenerationProblem(
      `Cannot generate preload bridges from a graph with ${graph.diagnostics.length} diagnostic${graph.diagnostics.length === 1 ? "" : "s"}.`,
    );
  }

  for (const window of graph.windows) {
    if (window.trust !== "local" && window.trust !== "remote") {
      throw new DesktopPreloadGenerationProblem(
        `Desktop window ${formatDiagnosticValue(window.id)} has unsupported trust ${formatDiagnosticValue(window.trust)}.`,
      );
    }
  }
}

function createUniqueIndex<T extends { readonly id: string }>(
  records: readonly T[],
  kind: "command" | "event" | "window",
): ReadonlyMap<string, T> {
  const index = new Map<string, T>();

  for (const record of records) {
    if (index.has(record.id)) {
      throw new DesktopPreloadGenerationProblem(
        `Desktop contract graph contains duplicate ${kind} ID ${JSON.stringify(record.id)}.`,
      );
    }
    index.set(record.id, record);
  }

  return index;
}

function collectWindowCapabilities(
  window: DesktopContractGraphWindow,
  commandsById: ReadonlyMap<string, DesktopContractGraphCommand>,
  eventsById: ReadonlyMap<string, DesktopContractGraphEvent>,
): WindowCapabilities {
  return {
    commands: window.exposedCommands.map((commandId) =>
      requireCapability(commandsById, commandId, "command", window.id),
    ),
    events: window.receivedEvents.map((eventId) =>
      requireCapability(eventsById, eventId, "event", window.id),
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
    throw new DesktopPreloadGenerationProblem(
      `Local window ${JSON.stringify(windowId)} references missing ${kind} ${JSON.stringify(id)}.`,
    );
  }
  return record;
}

function generateWindowSource(capabilities: WindowCapabilities): string {
  const contracts = collectContracts(capabilities);
  const commandContracts = contracts.filter((contract) => contract.commands.length > 0);
  const eventContracts = contracts.filter((contract) => contract.events.length > 0);

  return [
    'import type { DesktopPreloadContextBridge, DesktopPreloadTransport } from "@croco/desktop-codegen";',
    "",
    "type DesktopAbortRegistration = (abort: () => void) => () => void;",
    "",
    "function invokeDesktopCommand(",
    "  transport: DesktopPreloadTransport,",
    "  commandId: string,",
    "  input: unknown,",
    "  registerAbort: DesktopAbortRegistration | undefined,",
    "): Promise<unknown> {",
    "  if (registerAbort === undefined) {",
    "    return transport.invoke(commandId, input, {});",
    "  }",
    "",
    "  const controller = new AbortController();",
    "  const unregister = registerAbort(() => controller.abort());",
    "  try {",
    "    return transport.invoke(commandId, input, { signal: controller.signal }).finally(unregister);",
    "  } catch (error) {",
    "    unregister();",
    "    throw error;",
    "  }",
    "}",
    "",
    "export function installDesktopPreloadBridge(",
    "  contextBridge: DesktopPreloadContextBridge,",
    "  transport: DesktopPreloadTransport,",
    "): void {",
    "  const bridge = Object.freeze({",
    ...generateCommandNamespace(commandContracts),
    ...generateEventNamespace(eventContracts),
    "  });",
    "",
    '  contextBridge.exposeInMainWorld("crocoDesktop", bridge);',
    "}",
    "",
  ].join("\n");
}

function collectContracts(capabilities: WindowCapabilities): readonly ContractCapabilities[] {
  const contracts = new Map<
    string,
    { commands: DesktopContractGraphCommand[]; events: DesktopContractGraphEvent[] }
  >();

  for (const command of capabilities.commands) {
    const contract = getOrCreateContract(contracts, command.contractId);
    assertMemberId(command.contractId, command.key, command.id, "command");
    assertUniqueMember(contract, command.key, command.contractId);
    contract.commands.push(command);
  }

  for (const event of capabilities.events) {
    const contract = getOrCreateContract(contracts, event.contractId);
    assertMemberId(event.contractId, event.key, event.id, "event");
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

function assertMemberId(
  contractId: string,
  key: string,
  id: string,
  kind: "command" | "event",
): void {
  if (id !== `${contractId}.${key}`) {
    throw new DesktopPreloadGenerationProblem(
      `Desktop ${kind} ${JSON.stringify(id)} does not match contract ${JSON.stringify(contractId)} and member key ${JSON.stringify(key)}.`,
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
    throw new DesktopPreloadGenerationProblem(
      `Desktop contract ${JSON.stringify(contractId)} exposes duplicate member key ${JSON.stringify(key)}.`,
    );
  }
}

function generateCommandNamespace(contracts: readonly ContractCapabilities[]): readonly string[] {
  return generateNamespace(
    "commands",
    contracts.map((contract) => ({
      contractId: contract.contractId,
      members: contract.commands,
    })),
    generateCommand,
  );
}

function generateEventNamespace(contracts: readonly ContractCapabilities[]): readonly string[] {
  return generateNamespace(
    "events",
    contracts.map((contract) => ({
      contractId: contract.contractId,
      members: contract.events,
    })),
    generateEvent,
  );
}

function generateNamespace<TMember>(
  name: "commands" | "events",
  contracts: readonly { readonly contractId: string; readonly members: readonly TMember[] }[],
  generateMember: (member: TMember) => readonly string[],
): readonly string[] {
  const lines = [`    ${name}: Object.freeze({`];

  for (const contract of contracts) {
    lines.push(`      [${JSON.stringify(contract.contractId)}]: Object.freeze({`);
    for (const member of contract.members) {
      lines.push(...generateMember(member));
    }
    lines.push("      }),");
  }

  lines.push("    }),");
  return lines;
}

function generateCommand(command: DesktopContractGraphCommand): readonly string[] {
  return [
    `        [${JSON.stringify(command.key)}]: (input: unknown, registerAbort?: DesktopAbortRegistration): Promise<unknown> =>`,
    `          invokeDesktopCommand(transport, ${JSON.stringify(command.id)}, input, registerAbort),`,
  ];
}

function generateEvent(event: DesktopContractGraphEvent): readonly string[] {
  return [
    `        [${JSON.stringify(event.key)}]: (callback: (payload: unknown) => void): (() => void) =>`,
    `          transport.subscribe(${JSON.stringify(event.id)}, (payload) => callback(payload)),`,
  ];
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

function formatDiagnosticValue(value: unknown): string {
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? String(value) : serialized;
}
