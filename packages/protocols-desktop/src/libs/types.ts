export type DesktopCommandKind = "query" | "mutation";

export type DesktopQueryDefinition<TInputSchema = unknown, TOutputSchema = unknown> = {
  readonly definitionType: "command";
  readonly kind: "query";
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
};

export type DesktopMutationDefinition<TInputSchema = unknown, TOutputSchema = unknown> = {
  readonly definitionType: "command";
  readonly kind: "mutation";
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
};

export type DesktopCommandDefinition<TInputSchema = unknown, TOutputSchema = unknown> =
  | DesktopQueryDefinition<TInputSchema, TOutputSchema>
  | DesktopMutationDefinition<TInputSchema, TOutputSchema>;

export type DesktopEventDefinition<TPayloadSchema = unknown> = {
  readonly definitionType: "event";
  readonly kind: "event";
  readonly payload: TPayloadSchema;
};

export type AnyDesktopCommand = DesktopCommandDefinition<unknown, unknown>;
export type AnyDesktopEvent = DesktopEventDefinition<unknown>;
export type DesktopCommandRecord = Readonly<Record<string, AnyDesktopCommand>>;
export type DesktopEventRecord = Readonly<Record<string, AnyDesktopEvent>>;

export type DesktopContractMemberMetadata = {
  readonly key: string;
  readonly kind: DesktopCommandKind | "event";
};

export type DesktopContractMetadata = {
  readonly schema: "croco.desktop-contract-definition.v1";
  readonly members: readonly DesktopContractMemberMetadata[];
};

export type DesktopContractDefinition<
  TCommands extends DesktopCommandRecord = DesktopCommandRecord,
  TEvents extends DesktopEventRecord = DesktopEventRecord,
> = {
  readonly definitionType: "contract";
  readonly commands: KeyedDesktopCommands<TCommands>;
  readonly events: KeyedDesktopEvents<TEvents>;
  readonly metadata: DesktopContractMetadata;
};

export type AnyDesktopContract = DesktopContractDefinition<
  DesktopCommandRecord,
  DesktopEventRecord
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
    readonly kind: DesktopCommandKind | "event";
  }[];
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
};

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
  TCommand extends DesktopCommandDefinition<infer TInputSchema, unknown>
    ? InferDesktopSchema<TInputSchema>
    : never;

export type InferDesktopCommandOutput<TCommand> =
  TCommand extends DesktopCommandDefinition<unknown, infer TOutputSchema>
    ? InferDesktopSchema<TOutputSchema>
    : never;

export type InferDesktopEventPayload<TEvent> =
  TEvent extends DesktopEventDefinition<infer TPayloadSchema>
    ? InferDesktopSchema<TPayloadSchema>
    : never;

export type InferDesktopContractCommands<TContract> =
  TContract extends DesktopContractDefinition<infer TCommands, DesktopEventRecord>
    ? KeyedDesktopCommands<TCommands>
    : never;

export type InferDesktopContractEvents<TContract> =
  TContract extends DesktopContractDefinition<DesktopCommandRecord, infer TEvents>
    ? KeyedDesktopEvents<TEvents>
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

export type DesktopContractOptions<
  TCommands extends DesktopCommandRecord,
  TEvents extends DesktopEventRecord,
> = {
  readonly commands?: TCommands;
  readonly events?: TEvents;
};

export type DesktopAppOptions<
  TContracts extends DesktopContractRecord,
  TWindows extends DesktopWindowRecord,
> = {
  readonly contracts: TContracts;
  readonly windows: TWindows;
};

export type DesktopQueryOptions<TInputSchema, TOutputSchema> = {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
};

export type DesktopMutationOptions<TInputSchema, TOutputSchema> = {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
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
