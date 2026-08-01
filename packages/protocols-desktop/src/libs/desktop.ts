import { DesktopDefinitionProblem } from "./DesktopDefinitionProblem";
import { RESERVED_DESKTOP_KEYS } from "./reservedDesktopKeys";
import type {
  AnyDesktopCommand,
  AnyDesktopContract,
  AnyDesktopEvent,
  AnyDesktopGrant,
  AnyDesktopWindow,
  BoundDesktopContract,
  DesktopAppContractMetadata,
  DesktopAppDefinition,
  DesktopAppImplementer,
  DesktopAppMetadata,
  DesktopAppOptions,
  DesktopCommandRecord,
  DesktopContractDefinition,
  DesktopContractOptions,
  DesktopEventDefinition,
  DesktopEventOptions,
  DesktopEventRecord,
  DesktopFileGrantOptions,
  DesktopGrantAccess,
  DesktopGrantDefinition,
  DesktopGrantLifetime,
  DesktopGrantMetadata,
  DesktopGrantRecord,
  DesktopGrantScope,
  DesktopDirectoryGrantOptions,
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
  KeyedDesktopGrant,
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
  TGrants extends DesktopGrantRecord,
> =
  | Extract<keyof TCommands, keyof TEvents>
  | Extract<keyof TCommands, keyof TGrants>
  | Extract<keyof TEvents, keyof TGrants> extends never
  ? unknown
  : {
      readonly __duplicateDesktopMembers__:
        | Extract<keyof TCommands, keyof TEvents>
        | Extract<keyof TCommands, keyof TGrants>
        | Extract<keyof TEvents, keyof TGrants>;
    };

type ValidContractOptions<
  TCommands extends DesktopCommandRecord,
  TEvents extends DesktopEventRecord,
  TGrants extends DesktopGrantRecord,
> = NoInvalidKeys<TCommands> &
  NoInvalidKeys<TEvents> &
  NoInvalidKeys<TGrants> &
  NoDuplicateMembers<TCommands, TEvents, TGrants>;

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

function file<
  const TAccess extends DesktopGrantAccess,
  const TLifetime extends DesktopGrantLifetime,
>(
  options: DesktopFileGrantOptions<TAccess, TLifetime>,
): DesktopGrantDefinition<"file", TAccess, "exact", TLifetime> {
  return createGrantDefinition("file", options);
}

function directory<
  const TAccess extends DesktopGrantAccess,
  const TScope extends DesktopGrantScope,
  const TLifetime extends DesktopGrantLifetime,
>(
  options: DesktopDirectoryGrantOptions<TAccess, TScope, TLifetime>,
): DesktopGrantDefinition<"directory", TAccess, TScope, TLifetime> {
  return createGrantDefinition("directory", options);
}

function createGrantDefinition<
  const TResource extends "file" | "directory",
  const TAccess extends DesktopGrantAccess,
  const TScope extends TResource extends "file" ? "exact" : DesktopGrantScope,
  const TLifetime extends DesktopGrantLifetime,
>(
  resource: TResource,
  options: {
    readonly access: TAccess;
    readonly scope: TScope;
    readonly lifetime: TLifetime;
  },
): DesktopGrantDefinition<TResource, TAccess, TScope, TLifetime> {
  return {
    definitionType: "grant",
    resource,
    access: options.access,
    scope: options.scope,
    lifetime: options.lifetime,
    "~standard": {
      version: 1,
      vendor: "@croco/protocols-desktop",
      validate: () => ({
        issues: [
          {
            message: "Desktop resource grant references must be validated by the desktop runtime.",
          },
        ],
      }),
    },
  };
}

function contract<
  const TCommands extends DesktopCommandRecord = Record<never, never>,
  const TEvents extends DesktopEventRecord = Record<never, never>,
  const TGrants extends DesktopGrantRecord = Record<never, never>,
>(
  options: DesktopContractOptions<TCommands, TEvents, TGrants> &
    ValidContractOptions<TCommands, TEvents, TGrants>,
): DesktopContractDefinition<TCommands, TEvents, TGrants> {
  assertValidKeys(options.commands ?? {});
  assertValidKeys(options.events ?? {});
  assertValidKeys(options.grants ?? {});
  assertNoDuplicateMembers(options.commands ?? {}, options.events ?? {}, options.grants ?? {});
  const commands = mapMembers(options.commands ?? {}, "command");
  const events = mapMembers(options.events ?? {}, "event");
  const grants = mapGrants(options.grants ?? {});
  const members = [
    ...Object.values(commands).map((command) => ({
      key: command.memberKey,
      kind: command.kind,
    })),
    ...Object.values(events).map((definedEvent) => ({
      key: definedEvent.memberKey,
      kind: definedEvent.kind,
    })),
    ...Object.values(grants).map((grant) => ({ key: grant.memberKey, kind: "grant" as const })),
  ].sort(compareMemberMetadata);

  return {
    definitionType: "contract",
    commands,
    events,
    grants,
    metadata: {
      schema: "croco.desktop-contract-definition.v1",
      members,
      grants: Object.values(grants)
        .map((grant) => createGrantMetadata(grant))
        .sort((left, right) => compareCodeUnits(left.key, right.key)),
    },
  } as unknown as DesktopContractDefinition<TCommands, TEvents, TGrants>;
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
  const implement: DesktopAppImplementer<TContracts>["implement"] = (_implementation) => {};

  return {
    definitionType: "app",
    contracts,
    windows,
    metadata: createAppMetadata(contracts, windows),
    implement,
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

function mapGrants(
  grants: Readonly<Record<string, AnyDesktopGrant>>,
): Record<string, KeyedDesktopGrant> {
  return Object.fromEntries(
    Object.entries(grants).map(([memberKey, definition]) => [
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

function assertNoDuplicateMembers(
  commands: Readonly<Record<string, unknown>>,
  events: Readonly<Record<string, unknown>>,
  grants: Readonly<Record<string, unknown>>,
): void {
  const seen = new Set<string>();
  for (const members of [commands, events, grants]) {
    for (const key of Object.keys(members)) {
      if (seen.has(key)) {
        throw new DesktopDefinitionProblem(
          "DESKTOP_DUPLICATE_MEMBER_KEY",
          `Desktop member key "${key}" cannot be defined more than once.`,
        );
      }
      seen.add(key);
    }
  }
}

function isReservedDesktopKey(key: string): key is ReservedDesktopKey {
  return RESERVED_DESKTOP_KEYS.includes(key as ReservedDesktopKey);
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareMemberMetadata(
  left: { readonly key: string; readonly kind: string },
  right: { readonly key: string; readonly kind: string },
): number {
  return compareCodeUnits(left.key, right.key) || compareCodeUnits(left.kind, right.kind);
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
  const grants = Object.fromEntries(
    Object.entries(contractDefinition.grants).map(([memberKey, definition]) => [
      memberKey,
      {
        ...definition,
        contractKey,
        id: `${contractKey}.${memberKey}`,
      },
    ]),
  );

  return {
    definitionType: "contract",
    contractKey,
    commands,
    events,
    grants,
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
    definitionType: "window",
    trust: "local",
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
      .sort((left, right) => compareCodeUnits(left.key, right.key)),
    windows: Object.entries(windows)
      .map(([windowKey, definition]) => createWindowMetadata(windowKey, definition))
      .sort((left, right) => compareCodeUnits(left.key, right.key)),
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
      ...Object.values(definition.grants).map((grant) => ({
        id: grant.id,
        key: grant.memberKey,
        kind: "grant" as const,
      })),
    ].sort(compareMemberMetadata),
    grants: Object.values(definition.grants)
      .map((grant) => ({ ...createGrantMetadata(grant), id: grant.id }))
      .sort((left, right) => compareCodeUnits(left.key, right.key)),
  };
}

function createGrantMetadata(
  grant: Pick<DesktopGrantDefinition, "resource" | "access" | "scope" | "lifetime"> & {
    readonly memberKey: string;
  },
): DesktopGrantMetadata {
  return {
    key: grant.memberKey,
    resource: grant.resource,
    access: grant.access,
    scope: grant.scope,
    lifetime: grant.lifetime,
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
  if (!("id" in definition) || typeof definition.id !== "string") {
    throw new DesktopDefinitionProblem(
      "DESKTOP_UNMOUNTED_MEMBER_REFERENCE",
      `Desktop member "${definition.memberKey}" is not bound to an app contract.`,
    );
  }
  return {
    id: definition.id,
    key: definition.memberKey,
    kind,
  };
}

export const desktop = {
  app,
  contract,
  event,
  grant: {
    directory,
    file,
  },
  mutation,
  query,
  window: {
    local,
    remote,
  },
} as const;
