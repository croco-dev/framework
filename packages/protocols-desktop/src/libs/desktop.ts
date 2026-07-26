import { DesktopDefinitionProblem } from "./DesktopDefinitionProblem";
import type {
  AnyDesktopCommand,
  AnyDesktopContract,
  AnyDesktopEvent,
  AnyDesktopWindow,
  BoundDesktopContract,
  DesktopAppContractMetadata,
  DesktopAppDefinition,
  DesktopAppMetadata,
  DesktopAppOptions,
  DesktopCommandRecord,
  DesktopContractDefinition,
  DesktopContractOptions,
  DesktopEventDefinition,
  DesktopEventOptions,
  DesktopEventRecord,
  DesktopLocalWindowDefinition,
  DesktopLocalWindowMetadata,
  DesktopLocalWindowOptions,
  DesktopMemberReferenceMetadata,
  DesktopMutationDefinition,
  DesktopMutationOptions,
  DesktopQueryDefinition,
  DesktopQueryOptions,
  DesktopRemoteWindowDefinition,
  DesktopRemoteWindowMetadata,
  DesktopRemoteWindowOptions,
  DesktopWindowRecord,
  KeyedDesktopCommand,
  KeyedDesktopEvent,
  ReservedDesktopKey,
} from "./types";

type InvalidDesktopKey<TKey extends string> = TKey extends
  | ReservedDesktopKey
  | ""
  | `${string}.${string}`
  ? TKey
  : never;

type InvalidDesktopKeys<TRecord> = {
  [TKey in keyof TRecord & string]: InvalidDesktopKey<TKey>;
}[keyof TRecord & string];

type NoInvalidKeys<TRecord> =
  InvalidDesktopKeys<TRecord> extends never
    ? unknown
    : {
        readonly __invalidDesktopKeys__: InvalidDesktopKeys<TRecord>;
      };

type NoDuplicateMembers<
  TCommands extends DesktopCommandRecord,
  TEvents extends DesktopEventRecord,
> =
  Extract<keyof TCommands, keyof TEvents> extends never
    ? unknown
    : {
        readonly __duplicateDesktopMembers__: Extract<keyof TCommands, keyof TEvents>;
      };

type ValidContractOptions<
  TCommands extends DesktopCommandRecord,
  TEvents extends DesktopEventRecord,
> = NoInvalidKeys<TCommands> & NoInvalidKeys<TEvents> & NoDuplicateMembers<TCommands, TEvents>;

type ValidAppOptions<
  TContracts extends Readonly<Record<string, AnyDesktopContract>>,
  TWindows extends DesktopWindowRecord,
> = NoInvalidKeys<TContracts> & NoInvalidKeys<TWindows>;

function query<const TInputSchema, const TOutputSchema>(
  options: DesktopQueryOptions<TInputSchema, TOutputSchema>,
): DesktopQueryDefinition<TInputSchema, TOutputSchema> {
  return {
    definitionType: "command",
    kind: "query",
    input: options.input,
    output: options.output,
  };
}

function mutation<const TInputSchema, const TOutputSchema>(
  options: DesktopMutationOptions<TInputSchema, TOutputSchema>,
): DesktopMutationDefinition<TInputSchema, TOutputSchema> {
  return {
    definitionType: "command",
    kind: "mutation",
    input: options.input,
    output: options.output,
  };
}

function event<const TPayloadSchema>(
  options: DesktopEventOptions<TPayloadSchema>,
): DesktopEventDefinition<TPayloadSchema> {
  return {
    definitionType: "event",
    kind: "event",
    payload: options.payload,
  };
}

function contract<
  const TCommands extends DesktopCommandRecord = Record<never, never>,
  const TEvents extends DesktopEventRecord = Record<never, never>,
>(
  options: DesktopContractOptions<TCommands, TEvents> & ValidContractOptions<TCommands, TEvents>,
): DesktopContractDefinition<TCommands, TEvents> {
  assertValidKeys(options.commands ?? {});
  assertValidKeys(options.events ?? {});
  const commands = mapMembers(options.commands ?? {}, "command");
  const events = mapMembers(options.events ?? {}, "event");
  const members = [
    ...Object.values(commands).map((command) => ({
      key: command.memberKey,
      kind: command.kind,
    })),
    ...Object.values(events).map((definedEvent) => ({
      key: definedEvent.memberKey,
      kind: definedEvent.kind,
    })),
  ].sort(compareMemberMetadata);

  return {
    definitionType: "contract",
    commands,
    events,
    metadata: {
      schema: "croco.desktop-contract-definition.v1",
      members,
    },
  } as unknown as DesktopContractDefinition<TCommands, TEvents>;
}

function local<
  const TExpose extends readonly KeyedDesktopCommand[] = readonly [],
  const TReceive extends readonly KeyedDesktopEvent[] = readonly [],
>(
  options: DesktopLocalWindowOptions<TExpose, TReceive> = {},
): DesktopLocalWindowDefinition<TExpose, TReceive> {
  return {
    definitionType: "window",
    trust: "local",
    expose: options.expose ?? ([] as unknown as TExpose),
    receive: options.receive ?? ([] as unknown as TReceive),
  };
}

function remote<const TInitialUrl extends string, const TAllowedOrigins extends readonly string[]>(
  options: DesktopRemoteWindowOptions<TInitialUrl, TAllowedOrigins>,
): DesktopRemoteWindowDefinition<TInitialUrl, TAllowedOrigins> {
  return {
    definitionType: "window",
    trust: "remote",
    initialUrl: options.initialUrl,
    allowedOrigins: options.allowedOrigins,
  };
}

function app<
  const TContracts extends Readonly<Record<string, AnyDesktopContract>>,
  const TWindows extends DesktopWindowRecord,
>(
  options: DesktopAppOptions<TContracts, TWindows> & ValidAppOptions<TContracts, TWindows>,
): DesktopAppDefinition<TContracts, TWindows> {
  assertValidKeys(options.contracts);
  assertValidKeys(options.windows);
  const commandBindings = new Map<object, (KeyedDesktopCommand & { readonly id: string }) | null>();
  const eventBindings = new Map<object, (KeyedDesktopEvent & { readonly id: string }) | null>();
  const contracts = Object.fromEntries(
    Object.entries(options.contracts).map(([contractKey, definition]) => [
      contractKey,
      bindContract(contractKey, definition, commandBindings, eventBindings),
    ]),
  );
  const windows = Object.fromEntries(
    Object.entries(options.windows).map(([windowKey, definition]) => [
      windowKey,
      bindWindow(definition, commandBindings, eventBindings),
    ]),
  );

  return {
    definitionType: "app",
    contracts,
    windows,
    metadata: createAppMetadata(contracts, windows),
  } as DesktopAppDefinition<TContracts, TWindows>;
}

function mapMembers(
  members: Readonly<Record<string, AnyDesktopCommand>>,
  _definitionType: "command",
): Record<string, KeyedDesktopCommand>;
function mapMembers(
  members: Readonly<Record<string, AnyDesktopEvent>>,
  _definitionType: "event",
): Record<string, KeyedDesktopEvent>;
function mapMembers(
  members: Readonly<Record<string, AnyDesktopCommand | AnyDesktopEvent>>,
  _definitionType: "command" | "event",
): Record<string, KeyedDesktopCommand | KeyedDesktopEvent> {
  return Object.fromEntries(
    Object.entries(members).map(([memberKey, definition]) => [
      memberKey,
      { ...definition, memberKey },
    ]),
  );
}

function assertValidKeys(record: Readonly<Record<string, unknown>>): void {
  for (const key of Object.keys(record)) {
    if (key.length === 0 || key.includes(".") || isReservedDesktopKey(key)) {
      throw new DesktopDefinitionProblem(
        "DESKTOP_INVALID_KEY",
        `Desktop definition key "${key}" must be a non-empty, non-reserved segment without dots.`,
      );
    }
  }
}

function isReservedDesktopKey(key: string): key is ReservedDesktopKey {
  return [
    "__proto__",
    "constructor",
    "prototype",
    "contracts",
    "windows",
    "commands",
    "events",
    "metadata",
    "implement",
  ].includes(key as ReservedDesktopKey);
}

function compareMemberMetadata(
  left: { readonly key: string; readonly kind: string },
  right: { readonly key: string; readonly kind: string },
): number {
  return left.key.localeCompare(right.key) || left.kind.localeCompare(right.kind);
}

function bindContract(
  contractKey: string,
  contractDefinition: AnyDesktopContract,
  commandBindings: Map<object, (KeyedDesktopCommand & { readonly id: string }) | null>,
  eventBindings: Map<object, (KeyedDesktopEvent & { readonly id: string }) | null>,
): BoundDesktopContract<AnyDesktopContract, string> {
  const commands = Object.fromEntries(
    Object.entries(contractDefinition.commands).map(([memberKey, definition]) => {
      const boundDefinition = {
        ...definition,
        contractKey,
        id: `${contractKey}.${memberKey}`,
      };
      registerBinding(commandBindings, definition, boundDefinition);
      return [memberKey, boundDefinition];
    }),
  );
  const events = Object.fromEntries(
    Object.entries(contractDefinition.events).map(([memberKey, definition]) => {
      const boundDefinition = {
        ...definition,
        contractKey,
        id: `${contractKey}.${memberKey}`,
      };
      registerBinding(eventBindings, definition, boundDefinition);
      return [memberKey, boundDefinition];
    }),
  );

  return {
    definitionType: "contract",
    contractKey,
    commands,
    events,
    metadata: contractDefinition.metadata,
  } as BoundDesktopContract<AnyDesktopContract, string>;
}

function bindWindow(
  windowDefinition: AnyDesktopWindow,
  commandBindings: ReadonlyMap<object, (KeyedDesktopCommand & { readonly id: string }) | null>,
  eventBindings: ReadonlyMap<object, (KeyedDesktopEvent & { readonly id: string }) | null>,
): AnyDesktopWindow {
  if (windowDefinition.trust === "remote") {
    return {
      definitionType: "window",
      trust: "remote",
      initialUrl: windowDefinition.initialUrl,
      allowedOrigins: windowDefinition.allowedOrigins,
    };
  }

  return {
    ...windowDefinition,
    expose: windowDefinition.expose.map((definition) =>
      resolveBinding(commandBindings, definition),
    ),
    receive: windowDefinition.receive.map((definition) =>
      resolveBinding(eventBindings, definition),
    ),
  };
}

function resolveBinding<TDefinition extends { readonly memberKey: string }, TBoundDefinition>(
  bindings: ReadonlyMap<object, TBoundDefinition | null>,
  definition: TDefinition,
): TBoundDefinition {
  const boundDefinition = bindings.get(definition);
  if (boundDefinition === null) {
    throw new DesktopDefinitionProblem(
      "DESKTOP_AMBIGUOUS_MEMBER_REFERENCE",
      `Desktop member "${definition.memberKey}" belongs to a contract mounted under multiple keys.`,
    );
  }
  if (boundDefinition === undefined) {
    throw new DesktopDefinitionProblem(
      "DESKTOP_UNMOUNTED_MEMBER_REFERENCE",
      `Desktop member "${definition.memberKey}" belongs to a contract that is not mounted by the app.`,
    );
  }
  return boundDefinition;
}

function registerBinding<TDefinition extends object, TBoundDefinition>(
  bindings: Map<object, TBoundDefinition | null>,
  definition: TDefinition,
  boundDefinition: TBoundDefinition,
): void {
  bindings.set(definition, bindings.has(definition) ? null : boundDefinition);
}

function createAppMetadata(
  contracts: Readonly<Record<string, BoundDesktopContract<AnyDesktopContract, string>>>,
  windows: DesktopWindowRecord,
): DesktopAppMetadata {
  return {
    schema: "croco.desktop-app-definition.v1",
    contracts: Object.entries(contracts)
      .map(([contractKey, definition]) => createContractMetadata(contractKey, definition))
      .sort((left, right) => left.key.localeCompare(right.key)),
    windows: Object.entries(windows)
      .map(([windowKey, definition]) => createWindowMetadata(windowKey, definition))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function createContractMetadata(
  contractKey: string,
  definition: BoundDesktopContract<AnyDesktopContract, string>,
): DesktopAppContractMetadata {
  return {
    key: contractKey,
    members: [
      ...Object.values(definition.commands).map((command) => ({
        id: command.id,
        key: command.memberKey,
        kind: command.kind,
      })),
      ...Object.values(definition.events).map((definedEvent) => ({
        id: definedEvent.id,
        key: definedEvent.memberKey,
        kind: definedEvent.kind,
      })),
    ].sort(compareMemberMetadata),
  };
}

function createWindowMetadata(
  windowKey: string,
  definition: AnyDesktopWindow,
): DesktopLocalWindowMetadata | DesktopRemoteWindowMetadata {
  if (definition.trust === "remote") {
    return {
      key: windowKey,
      trust: "remote",
      initialUrl: definition.initialUrl,
      allowedOrigins: definition.allowedOrigins,
    };
  }

  return {
    key: windowKey,
    trust: "local",
    expose: definition.expose.map((command) => createMemberReference(command, "command")),
    receive: definition.receive.map((definedEvent) => createMemberReference(definedEvent, "event")),
  };
}

function createMemberReference(
  definition: KeyedDesktopCommand | KeyedDesktopEvent,
  kind: "command" | "event",
): DesktopMemberReferenceMetadata {
  return {
    id: "id" in definition && typeof definition.id === "string" ? definition.id : null,
    key: definition.memberKey,
    kind,
  };
}

export const desktop = {
  app,
  contract,
  event,
  mutation,
  query,
  window: {
    local,
    remote,
  },
} as const;
