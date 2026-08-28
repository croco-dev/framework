import type { Problem } from "@croco/problems-core";

export type DesktopCommandKind = "query" | "mutation";

declare const DESKTOP_GRANT_REFERENCE: unique symbol;

export type DesktopGrantResourceKind = "file" | "directory";
export type DesktopGrantAccess = "read" | "write";
export type DesktopGrantScope = "exact" | "descendant";
export type DesktopGrantLifetime = "command" | "window" | "session";
type DesktopGrantScopeFor<TResource extends DesktopGrantResourceKind> = TResource extends "file"
  ? "exact"
  : DesktopGrantScope;

/**
 * A renderer-visible reference to a resource authorized by the desktop runtime.
 *
 * This intentionally brands a token rather than a filesystem path. Token issuance,
 * redemption, and path validation belong to the desktop runtime.
 */
export type DesktopGrantReference<
  TResource extends DesktopGrantResourceKind = DesktopGrantResourceKind,
  TAccess extends DesktopGrantAccess = DesktopGrantAccess,
  TScope extends DesktopGrantScopeFor<TResource> = DesktopGrantScopeFor<TResource>,
  TLifetime extends DesktopGrantLifetime = DesktopGrantLifetime,
> = string & {
  readonly [DESKTOP_GRANT_REFERENCE]: {
    readonly resource: TResource;
    readonly access: TAccess;
    readonly scope: TScope;
    readonly lifetime: TLifetime;
  };
};

export type DesktopGrantDefinition<
  TResource extends DesktopGrantResourceKind = DesktopGrantResourceKind,
  TAccess extends DesktopGrantAccess = DesktopGrantAccess,
  TScope extends DesktopGrantScopeFor<TResource> = DesktopGrantScopeFor<TResource>,
  TLifetime extends DesktopGrantLifetime = DesktopGrantLifetime,
> = {
  readonly definitionType: "grant";
  readonly resource: TResource;
  readonly access: TAccess;
  readonly scope: TScope;
  readonly lifetime: TLifetime;
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: "@croco/protocols-desktop";
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: DesktopGrantReference<TResource, TAccess, TScope, TLifetime> }
      | { readonly issues: readonly { readonly message: string }[] };
    readonly types?: {
      readonly input: DesktopGrantReference<TResource, TAccess, TScope, TLifetime>;
      readonly output: DesktopGrantReference<TResource, TAccess, TScope, TLifetime>;
    };
  };
};

export type DesktopFileGrantOptions<
  TAccess extends DesktopGrantAccess,
  TLifetime extends DesktopGrantLifetime,
> = {
  readonly access: TAccess;
  readonly scope: "exact";
  readonly lifetime: TLifetime;
};

export type DesktopDirectoryGrantOptions<
  TAccess extends DesktopGrantAccess,
  TScope extends DesktopGrantScope,
  TLifetime extends DesktopGrantLifetime,
> = {
  readonly access: TAccess;
  readonly scope: TScope;
  readonly lifetime: TLifetime;
};

export type DesktopEffectMethodDefinition<
  TArguments extends readonly unknown[] = readonly unknown[],
  TResult = unknown,
> = {
  readonly definitionType: "effect-method";
  readonly "~types"?: {
    readonly arguments: TArguments;
    readonly result: TResult;
  };
};

export type DesktopEffectDefinition<
  TNamespace extends string = string,
  TMethods extends Readonly<Record<string, DesktopEffectMethodDefinition>> = Readonly<
    Record<string, DesktopEffectMethodDefinition>
  >,
  TAccess extends DesktopGrantAccess = DesktopGrantAccess,
  TGrants extends readonly AnyDesktopGrant[] = readonly AnyDesktopGrant[],
> = {
  readonly definitionType: "effect";
  readonly namespace: TNamespace;
  readonly access: TAccess;
  readonly grants: TGrants;
  readonly methods: TMethods;
};

export type AnyDesktopEffect = DesktopEffectDefinition<
  string,
  Readonly<Record<string, DesktopEffectMethodDefinition>>,
  DesktopGrantAccess,
  readonly AnyDesktopGrant[]
>;

export type DesktopCommandExecutionPolicy = {
  readonly timeoutMs?: number;
  readonly maxInputBytes?: number;
  readonly maxOutputBytes?: number;
  readonly maxConcurrency?: number;
};
export type DesktopProblemReference<TProblem extends Problem = Problem> = {
  readonly prototype: TProblem;
};

export type DesktopQueryDefinition<
  TInputSchema = unknown,
  TOutputSchema = unknown,
  TEffects extends readonly AnyDesktopEffect[] = readonly [],
  TEvents extends readonly string[] = readonly [],
  TProblems extends readonly DesktopProblemReference[] = readonly [],
> = {
  readonly definitionType: "command";
  readonly kind: "query";
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly effects: TEffects;
  readonly events: TEvents;
  readonly problems: TProblems;
  readonly executionPolicy: DesktopCommandExecutionPolicy;
};

export type DesktopMutationDefinition<
  TInputSchema = unknown,
  TOutputSchema = unknown,
  TEffects extends readonly AnyDesktopEffect[] = readonly [],
  TEvents extends readonly string[] = readonly [],
  TProblems extends readonly DesktopProblemReference[] = readonly [],
> = {
  readonly definitionType: "command";
  readonly kind: "mutation";
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly effects: TEffects;
  readonly events: TEvents;
  readonly problems: TProblems;
  readonly executionPolicy: DesktopCommandExecutionPolicy;
};

export type DesktopCommandDefinition<
  TInputSchema = unknown,
  TOutputSchema = unknown,
  TEffects extends readonly AnyDesktopEffect[] = readonly [],
  TEvents extends readonly string[] = readonly [],
  TProblems extends readonly DesktopProblemReference[] = readonly [],
> =
  | DesktopQueryDefinition<TInputSchema, TOutputSchema, TEffects, TEvents, TProblems>
  | DesktopMutationDefinition<TInputSchema, TOutputSchema, TEffects, TEvents, TProblems>;

export type DesktopEventDefinition<TPayloadSchema = unknown> = {
  readonly definitionType: "event";
  readonly kind: "event";
  readonly payload: TPayloadSchema;
};

export type AnyDesktopCommand = DesktopCommandDefinition<
  unknown,
  unknown,
  readonly AnyDesktopEffect[],
  readonly string[],
  readonly DesktopProblemReference[]
>;
export type AnyDesktopEvent = DesktopEventDefinition<unknown>;
export type AnyDesktopGrant = DesktopGrantDefinition;
export type DesktopCommandRecord = Readonly<Record<string, AnyDesktopCommand>>;
export type DesktopEventRecord = Readonly<Record<string, AnyDesktopEvent>>;
export type DesktopGrantRecord = Readonly<Record<string, AnyDesktopGrant>>;

export type DesktopContractMemberMetadata = {
  readonly key: string;
  readonly kind: DesktopCommandKind | "event" | "grant";
};

export type DesktopGrantMetadata = {
  readonly key: string;
  readonly resource: DesktopGrantResourceKind;
  readonly access: DesktopGrantAccess;
  readonly scope: DesktopGrantScope;
  readonly lifetime: DesktopGrantLifetime;
};

export type DesktopContractMetadata = {
  readonly schema: "croco.desktop-contract-definition.v1";
  readonly members: readonly DesktopContractMemberMetadata[];
  readonly grants: readonly DesktopGrantMetadata[];
};

export type DesktopContractDefinition<
  TCommands extends DesktopCommandRecord = DesktopCommandRecord,
  TEvents extends DesktopEventRecord = DesktopEventRecord,
  TGrants extends DesktopGrantRecord = DesktopGrantRecord,
> = {
  readonly definitionType: "contract";
  readonly commands: KeyedDesktopCommands<TCommands>;
  readonly events: KeyedDesktopEvents<TEvents>;
  readonly grants: KeyedDesktopGrants<TGrants>;
  readonly metadata: DesktopContractMetadata;
};

export type AnyDesktopContract = DesktopContractDefinition<
  DesktopCommandRecord,
  DesktopEventRecord,
  DesktopGrantRecord
>;
export type DesktopContractRecord = Readonly<Record<string, AnyDesktopContract>>;

export type DesktopLocalWindowDefinition<
  TExpose extends readonly KeyedDesktopCommand[] = readonly KeyedDesktopCommand[],
  TReceive extends readonly KeyedDesktopEvent[] = readonly KeyedDesktopEvent[],
> = {
  readonly definitionType: "window";
  readonly trust: "local";
  readonly expose: TExpose;
  readonly receive: TReceive;
};

export type DesktopRemoteWindowDefinition<
  TInitialUrl extends string = string,
  TAllowedOrigins extends readonly string[] = readonly string[],
> = {
  readonly definitionType: "window";
  readonly trust: "remote";
  readonly initialUrl: TInitialUrl;
  readonly allowedOrigins: TAllowedOrigins;
  readonly expose?: never;
  readonly receive?: never;
};

export type AnyDesktopWindow = DesktopLocalWindowDefinition | DesktopRemoteWindowDefinition;
export type DesktopWindowRecord = Readonly<Record<string, AnyDesktopWindow>>;

export type DesktopMemberReferenceMetadata = {
  readonly id: string;
  readonly key: string;
  readonly kind: "command" | "event";
};

export type DesktopAppContractMetadata = {
  readonly key: string;
  readonly members: readonly {
    readonly id: string;
    readonly key: string;
    readonly kind: DesktopCommandKind | "event" | "grant";
  }[];
  readonly grants: readonly (DesktopGrantMetadata & { readonly id: string })[];
};

export type DesktopLocalWindowMetadata = {
  readonly key: string;
  readonly trust: "local";
  readonly expose: readonly DesktopMemberReferenceMetadata[];
  readonly receive: readonly DesktopMemberReferenceMetadata[];
};

export type DesktopRemoteWindowMetadata = {
  readonly key: string;
  readonly trust: "remote";
  readonly initialUrl: string;
  readonly allowedOrigins: readonly string[];
};

export type DesktopAppMetadata = {
  readonly schema: "croco.desktop-app-definition.v1";
  readonly contracts: readonly DesktopAppContractMetadata[];
  readonly windows: readonly (DesktopLocalWindowMetadata | DesktopRemoteWindowMetadata)[];
};

export type DesktopAppDefinition<
  TContracts extends DesktopContractRecord = DesktopContractRecord,
  TWindows extends DesktopWindowRecord = DesktopWindowRecord,
> = {
  readonly definitionType: "app";
  readonly contracts: BoundDesktopContracts<TContracts>;
  readonly windows: BoundDesktopWindows<TWindows, TContracts>;
  readonly metadata: DesktopAppMetadata;
} & DesktopAppImplementer<TContracts>;

export type { ReservedDesktopKey } from "./reservedDesktopKeys";

export type InferDesktopSchema<TSchema> = TSchema extends {
  readonly "~standard": {
    readonly types?: {
      readonly output: infer TOutput;
    };
  };
}
  ? TOutput
  : TSchema extends { readonly _output: infer TOutput }
    ? TOutput
    : TSchema extends { readonly parse: (input: unknown) => infer TOutput }
      ? TOutput
      : TSchema;

export type InferDesktopCommandInput<TCommand> =
  TCommand extends DesktopCommandDefinition<
    infer TInputSchema,
    unknown,
    readonly AnyDesktopEffect[],
    readonly string[],
    readonly DesktopProblemReference[]
  >
    ? InferDesktopSchema<TInputSchema>
    : never;

export type InferDesktopCommandOutput<TCommand> =
  TCommand extends DesktopCommandDefinition<
    unknown,
    infer TOutputSchema,
    readonly AnyDesktopEffect[],
    readonly string[],
    readonly DesktopProblemReference[]
  >
    ? InferDesktopSchema<TOutputSchema>
    : never;

export type InferDesktopCommandProblem<TCommand> =
  TCommand extends DesktopCommandDefinition<
    unknown,
    unknown,
    readonly AnyDesktopEffect[],
    readonly string[],
    infer TProblems
  >
    ? [TProblems[number]] extends [never]
      ? never
      : TProblems[number] extends DesktopProblemReference<infer TProblem>
        ? TProblem
        : never
    : never;

export type InferDesktopEventPayload<TEvent> =
  TEvent extends DesktopEventDefinition<infer TPayloadSchema>
    ? InferDesktopSchema<TPayloadSchema>
    : never;

export type InferDesktopContractCommands<TContract> =
  TContract extends DesktopContractDefinition<
    infer TCommands,
    DesktopEventRecord,
    DesktopGrantRecord
  >
    ? KeyedDesktopCommands<TCommands>
    : never;

export type InferDesktopContractEvents<TContract> =
  TContract extends DesktopContractDefinition<
    DesktopCommandRecord,
    infer TEvents,
    DesktopGrantRecord
  >
    ? KeyedDesktopEvents<TEvents>
    : never;

export type InferDesktopContractGrants<TContract> =
  TContract extends DesktopContractDefinition<
    DesktopCommandRecord,
    DesktopEventRecord,
    infer TGrants
  >
    ? KeyedDesktopGrants<TGrants>
    : never;

export type InferDesktopAppContracts<TApp> = TApp extends {
  readonly contracts: infer TContracts;
}
  ? TContracts
  : never;

export type InferDesktopAppWindows<TApp> = TApp extends {
  readonly windows: infer TWindows;
}
  ? TWindows
  : never;

export type DesktopSuccess<TResult> = {
  readonly ok: true;
  readonly value: TResult;
};

export type DesktopFailure<TProblem extends Problem> = {
  readonly ok: false;
  readonly problem: TProblem;
};

export type DesktopResult<TResult, TProblem extends Problem = never> =
  | DesktopSuccess<TResult>
  | DesktopFailure<TProblem>;

export type DesktopHandlerContext<
  TCommand extends AnyDesktopCommand,
  TContract extends AnyDesktopContract,
> = DesktopHandlerHelpers<TCommand, TContract> & DesktopHandlerEffects<TCommand>;

export type DesktopCommandHandler<
  TCommand extends AnyDesktopCommand,
  TContract extends AnyDesktopContract,
> = (
  input: InferDesktopCommandInput<TCommand>,
  context: DesktopHandlerContext<TCommand, TContract>,
) =>
  | DesktopResult<InferDesktopCommandOutput<TCommand>, InferDesktopCommandProblem<TCommand>>
  | Promise<
      DesktopResult<InferDesktopCommandOutput<TCommand>, InferDesktopCommandProblem<TCommand>>
    >;

type DesktopHandlerHelpers<
  TCommand extends AnyDesktopCommand,
  TContract extends AnyDesktopContract,
> = {
  readonly ok: (
    value: InferDesktopCommandOutput<TCommand>,
  ) => DesktopSuccess<InferDesktopCommandOutput<TCommand>>;
  readonly fail: (
    problem: InferDesktopCommandProblem<TCommand>,
  ) => DesktopFailure<InferDesktopCommandProblem<TCommand>>;
  readonly emit: DesktopEventEmitter<DesktopCommandEvents<TCommand, TContract>>;
  readonly signal: AbortSignal;
};

type DesktopCommandEvents<
  TCommand extends AnyDesktopCommand,
  TContract extends AnyDesktopContract,
> = TCommand extends {
  readonly events: infer TEventKeys extends readonly string[];
}
  ? {
      [TEventKey in TEventKeys[number] & keyof TContract["events"]]: TContract["events"][TEventKey];
    }[TEventKeys[number] & keyof TContract["events"]]
  : never;

type DesktopEventEmitter<TEvents extends AnyDesktopEvent> = (
  ...arguments_: TEvents extends AnyDesktopEvent
    ? [event: TEvents, payload: InferDesktopEventPayload<TEvents>]
    : never
) => Promise<void>;

type DesktopHandlerEffects<TCommand extends AnyDesktopCommand> = TCommand extends {
  readonly effects: infer TEffects extends readonly AnyDesktopEffect[];
}
  ? UnionToIntersection<DesktopEffectContext<TEffects[number]>>
  : Record<never, never>;

type DesktopEffectContext<TEffect extends AnyDesktopEffect> =
  TEffect extends DesktopEffectDefinition<infer TNamespace, infer TMethods>
    ? {
        readonly [TKey in TNamespace]: {
          readonly [TMethod in keyof TMethods]: TMethods[TMethod] extends DesktopEffectMethodDefinition<
            infer TArguments,
            infer TResult
          >
            ? (...arguments_: TArguments) => TResult
            : never;
        };
      }
    : never;

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

export type DesktopContractImplementation<TContract extends AnyDesktopContract> = {
  readonly commands: {
    readonly [TCommandKey in keyof TContract["commands"] & string]: DesktopCommandHandler<
      TContract["commands"][TCommandKey],
      TContract
    >;
  };
};

export type DesktopAppImplementation<TContracts extends DesktopContractRecord> = {
  readonly contracts: {
    readonly [TContractKey in keyof TContracts & string]: DesktopContractImplementation<
      TContracts[TContractKey]
    >;
  };
};

export type DesktopAppImplementer<TContracts extends DesktopContractRecord> = {
  readonly implement: <const TImplementation extends DesktopAppImplementation<TContracts>>(
    implementation: TImplementation & ExactDesktopAppImplementation<TImplementation, TContracts>,
  ) => void;
};

type ExactDesktopAppImplementation<
  TImplementation,
  TContracts extends DesktopContractRecord,
> = ExactDesktopShape<TImplementation, DesktopAppImplementation<TContracts>>;

type ExactDesktopShape<TActual, TExpected> = TExpected extends (...args: never[]) => unknown
  ? TActual extends TExpected
    ? TActual
    : never
  : TActual extends TExpected
    ? Exclude<keyof TActual, keyof TExpected> extends never
      ? {
          readonly [TKey in keyof TActual]: TKey extends keyof TExpected
            ? ExactDesktopShape<TActual[TKey], TExpected[TKey]>
            : never;
        }
      : never
    : never;

export type KeyedDesktopCommand<
  TCommand extends AnyDesktopCommand = AnyDesktopCommand,
  TKey extends string = string,
> = TCommand & {
  readonly memberKey: TKey;
};

export type KeyedDesktopEvent<
  TEvent extends AnyDesktopEvent = AnyDesktopEvent,
  TKey extends string = string,
> = TEvent & {
  readonly memberKey: TKey;
};

export type KeyedDesktopGrant<
  TGrant extends AnyDesktopGrant = AnyDesktopGrant,
  TKey extends string = string,
> = TGrant & {
  readonly memberKey: TKey;
};

export type BoundDesktopCommand<
  TCommand extends KeyedDesktopCommand = KeyedDesktopCommand,
  TContractKey extends string = string,
  TMemberKey extends string = TCommand["memberKey"],
> = TCommand & {
  readonly contractKey: TContractKey;
  readonly id: `${TContractKey}.${TMemberKey}`;
};

export type BoundDesktopEvent<
  TEvent extends KeyedDesktopEvent = KeyedDesktopEvent,
  TContractKey extends string = string,
  TMemberKey extends string = TEvent["memberKey"],
> = TEvent & {
  readonly contractKey: TContractKey;
  readonly id: `${TContractKey}.${TMemberKey}`;
};

export type BoundDesktopGrant<
  TGrant extends KeyedDesktopGrant = KeyedDesktopGrant,
  TContractKey extends string = string,
  TMemberKey extends string = TGrant["memberKey"],
> = TGrant & {
  readonly contractKey: TContractKey;
  readonly id: `${TContractKey}.${TMemberKey}`;
};

export type BoundDesktopContract<
  TContract extends AnyDesktopContract,
  TContractKey extends string,
> = {
  readonly definitionType: "contract";
  readonly contractKey: TContractKey;
  readonly commands: {
    readonly [TMemberKey in keyof TContract["commands"] & string]: BoundDesktopCommand<
      TContract["commands"][TMemberKey],
      TContractKey,
      TMemberKey
    >;
  };
  readonly events: {
    readonly [TMemberKey in keyof TContract["events"] & string]: BoundDesktopEvent<
      TContract["events"][TMemberKey],
      TContractKey,
      TMemberKey
    >;
  };
  readonly grants: {
    readonly [TMemberKey in keyof TContract["grants"] & string]: BoundDesktopGrant<
      TContract["grants"][TMemberKey],
      TContractKey,
      TMemberKey
    >;
  };
  readonly metadata: DesktopContractMetadata;
};

export type BoundDesktopContracts<TContracts extends DesktopContractRecord> = {
  readonly [TContractKey in keyof TContracts & string]: BoundDesktopContract<
    TContracts[TContractKey],
    TContractKey
  >;
};

export type BoundDesktopWindows<
  TWindows extends DesktopWindowRecord,
  TContracts extends DesktopContractRecord,
> = {
  readonly [TWindowKey in keyof TWindows & string]: BoundDesktopWindow<
    TWindows[TWindowKey],
    TContracts
  >;
};

type BoundDesktopWindow<
  TWindow extends AnyDesktopWindow,
  TContracts extends DesktopContractRecord,
> =
  TWindow extends DesktopLocalWindowDefinition<infer TExpose, infer TReceive>
    ? {
        readonly definitionType: "window";
        readonly trust: "local";
        readonly expose: BoundCommandReferences<TExpose, TContracts>;
        readonly receive: BoundEventReferences<TReceive, TContracts>;
      }
    : TWindow;

type BoundCommandReferences<
  TCommands extends readonly KeyedDesktopCommand[],
  TContracts extends DesktopContractRecord,
> = {
  readonly [TIndex in keyof TCommands]: BoundCommandReference<TCommands[TIndex], TContracts>;
};

type BoundEventReferences<
  TEvents extends readonly KeyedDesktopEvent[],
  TContracts extends DesktopContractRecord,
> = {
  readonly [TIndex in keyof TEvents]: BoundEventReference<TEvents[TIndex], TContracts>;
};

type BoundCommandReference<
  TCommand extends KeyedDesktopCommand,
  TContracts extends DesktopContractRecord,
> = {
  [TContractKey in keyof TContracts & string]: {
    [TMemberKey in keyof TContracts[TContractKey]["commands"] &
      string]: TCommand extends TContracts[TContractKey]["commands"][TMemberKey]
      ? BoundDesktopCommand<
          TContracts[TContractKey]["commands"][TMemberKey],
          TContractKey,
          TMemberKey
        >
      : never;
  }[keyof TContracts[TContractKey]["commands"] & string];
}[keyof TContracts & string];

type BoundEventReference<
  TEvent extends KeyedDesktopEvent,
  TContracts extends DesktopContractRecord,
> = {
  [TContractKey in keyof TContracts & string]: {
    [TMemberKey in keyof TContracts[TContractKey]["events"] &
      string]: TEvent extends TContracts[TContractKey]["events"][TMemberKey]
      ? BoundDesktopEvent<TContracts[TContractKey]["events"][TMemberKey], TContractKey, TMemberKey>
      : never;
  }[keyof TContracts[TContractKey]["events"] & string];
}[keyof TContracts & string];

type KeyedDesktopCommands<TCommands extends DesktopCommandRecord> = {
  readonly [TKey in keyof TCommands & string]: KeyedDesktopCommand<TCommands[TKey], TKey>;
};

type KeyedDesktopEvents<TEvents extends DesktopEventRecord> = {
  readonly [TKey in keyof TEvents & string]: KeyedDesktopEvent<TEvents[TKey], TKey>;
};

type KeyedDesktopGrants<TGrants extends DesktopGrantRecord> = {
  readonly [TKey in keyof TGrants & string]: KeyedDesktopGrant<TGrants[TKey], TKey>;
};

export type DesktopContractOptions<
  TCommands extends DesktopCommandRecord,
  TEvents extends DesktopEventRecord,
  TGrants extends DesktopGrantRecord,
> = {
  readonly commands?: TCommands;
  readonly events?: TEvents;
  readonly grants?: TGrants;
};

export type DesktopAppOptions<
  TContracts extends DesktopContractRecord,
  TWindows extends DesktopWindowRecord,
> = {
  readonly contracts: TContracts;
  readonly windows: TWindows;
};

export type DesktopQueryOptions<
  TInputSchema,
  TOutputSchema,
  TEffects extends readonly AnyDesktopEffect[] | undefined = undefined,
  TEvents extends readonly string[] | undefined = undefined,
  TProblems extends readonly DesktopProblemReference[] | undefined = undefined,
> = {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly effects?: TEffects;
  readonly events?: TEvents;
  readonly problems?: TProblems;
  readonly executionPolicy?: DesktopCommandExecutionPolicy;
};

export type DesktopMutationOptions<
  TInputSchema,
  TOutputSchema,
  TEffects extends readonly AnyDesktopEffect[] | undefined = undefined,
  TEvents extends readonly string[] | undefined = undefined,
  TProblems extends readonly DesktopProblemReference[] | undefined = undefined,
> = {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly effects?: TEffects;
  readonly events?: TEvents;
  readonly problems?: TProblems;
  readonly executionPolicy?: DesktopCommandExecutionPolicy;
};

export type DesktopEffectOptions<
  TNamespace extends string,
  TMethods extends Readonly<Record<string, DesktopEffectMethodDefinition>>,
  TAccess extends DesktopGrantAccess,
  TGrants extends readonly AnyDesktopGrant[],
> = {
  readonly namespace: TNamespace;
  readonly access: TAccess;
  readonly grants?: TGrants;
  readonly methods: TMethods;
};

export type DesktopEventOptions<TPayloadSchema> = {
  readonly payload: TPayloadSchema;
};

export type DesktopLocalWindowOptions<
  TExpose extends readonly KeyedDesktopCommand[],
  TReceive extends readonly KeyedDesktopEvent[],
> = {
  readonly expose?: TExpose;
  readonly receive?: TReceive;
};

export type DesktopRemoteWindowOptions<
  TInitialUrl extends string,
  TAllowedOrigins extends readonly string[],
> = {
  readonly initialUrl: TInitialUrl;
  readonly allowedOrigins: TAllowedOrigins;
  readonly expose?: never;
  readonly receive?: never;
};
