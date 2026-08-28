import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { DesktopDefinitionProblem } from "../libs/DesktopDefinitionProblem";
import { desktop } from "../libs/desktop";
import type {
  AnyDesktopEffect,
  DesktopAppImplementation,
  DesktopCommandHandler,
  DesktopContractImplementation,
  DesktopEffectDefinition,
  DesktopEffectMethodDefinition,
  DesktopResult,
  DesktopHandlerContext,
  DesktopLocalWindowDefinition,
  DesktopRemoteWindowDefinition,
  InferDesktopAppContracts,
  InferDesktopAppWindows,
  InferDesktopCommandInput,
  InferDesktopCommandOutput,
  InferDesktopCommandProblem,
  InferDesktopContractCommands,
  InferDesktopContractEvents,
  InferDesktopContractGrants,
  InferDesktopEventPayload,
  InferDesktopSchema,
} from "../libs/types";

class DeclaredProblem extends Problem {
  declare public readonly code: "DECLARED_PROBLEM";
  declare public readonly category: ProblemCategory.ValidationError;

  public constructor() {
    super("DECLARED_PROBLEM", ProblemCategory.ValidationError);
  }
}

class UndeclaredProblem extends Problem {
  declare public readonly code: "UNDECLARED_PROBLEM";
  declare public readonly category: ProblemCategory.ValidationError;

  public constructor() {
    super("UNDECLARED_PROBLEM", ProblemCategory.ValidationError);
  }
}

const declaredProblem = desktop.problem(DeclaredProblem, {
  code: "DECLARED_PROBLEM",
  category: ProblemCategory.ValidationError,
});
const undeclaredProblem = desktop.problem(UndeclaredProblem, {
  code: "UNDECLARED_PROBLEM",
  category: ProblemCategory.ValidationError,
});

class BroadCodeProblem extends Problem {
  public constructor() {
    super("BROAD_CODE_PROBLEM", ProblemCategory.ValidationError);
  }
}

const fileChanged = desktop.event({
  payload: z.object({ path: z.string() }),
});
const projectClosed = desktop.event({
  payload: z.object({ path: z.string() }),
});
const filesystemRead = desktop.effect({
  namespace: "filesystem",
  access: "read",
  methods: {
    readText: desktop.effect.method<[path: string], Promise<string>>(),
  },
  problems: [declaredProblem],
});
const dialogOpen = desktop.effect({
  namespace: "dialog",
  access: "read",
  methods: {
    openFile: desktop.effect.method<[], Promise<string | undefined>>(),
  },
});
const annotatedDialog: DesktopEffectDefinition<
  "dialog",
  { readonly openFile: DesktopEffectMethodDefinition<[], Promise<string | undefined>> }
> = dialogOpen;
const annotatedDialogCommand = desktop.query({
  input: z.string(),
  output: z.string(),
  effects: [annotatedDialog],
});
const annotatedDialogProject = desktop.contract({
  commands: { annotatedDialogCommand },
});
const problemCommand = desktop.query({
  input: z.string(),
  output: z.string(),
  problems: [declaredProblem],
});
const problemProject = desktop.contract({
  commands: { problemCommand },
  events: {},
});
const alpha = desktop.event({ payload: z.object({ alpha: z.string() }) });
const beta = desktop.event({ payload: z.object({ beta: z.number() }) });
const eventProject = desktop.contract({
  commands: {
    correlate: desktop.query({
      input: z.string(),
      output: z.string(),
      events: ["alpha", "beta"],
    }),
  },
  events: { alpha, beta },
});

const project = desktop.contract({
  commands: {
    readFile: desktop.query({
      input: z.object({ path: z.string() }),
      output: z.object({ contents: z.string() }),
      effects: [filesystemRead],
      events: ["fileChanged"],
      problems: [],
    }),
    saveFile: desktop.mutation({
      input: z.object({ path: z.string(), contents: z.string() }),
      output: z.object({ saved: z.boolean() }),
    }),
  },
  events: {
    fileChanged,
    projectClosed,
  },
});

const definition = desktop.app({
  contracts: { project },
  windows: {
    main: desktop.window.local({
      expose: [project.commands.readFile, project.commands.saveFile],
      receive: [project.events.fileChanged],
    }),
    login: desktop.window.remote({
      initialUrl: "https://login.example.com",
      allowedOrigins: ["https://login.example.com"],
    }),
  },
});

const selectedFile = desktop.grant.file({
  access: "read",
  scope: "exact",
  lifetime: "command",
});
const workspace = desktop.grant.directory({
  access: "write",
  scope: "descendant",
  lifetime: "session",
});
const grantProject = desktop.contract({
  grants: { selectedFile, workspace },
  commands: {
    read: desktop.query({ input: selectedFile, output: z.string() }),
    save: desktop.mutation({ input: workspace, output: z.boolean() }),
  },
});
const grantDefinition = desktop.app({
  contracts: { project: grantProject },
  windows: {},
});

describe("desktop public types", () => {
  it("infers schemas, contracts, members, windows, and stable IDs", () => {
    expectTypeOf<InferDesktopCommandInput<typeof project.commands.readFile>>().toEqualTypeOf<{
      path: string;
    }>();
    expectTypeOf<InferDesktopCommandOutput<typeof project.commands.readFile>>().toEqualTypeOf<{
      contents: string;
    }>();
    expectTypeOf<InferDesktopEventPayload<typeof project.events.fileChanged>>().toEqualTypeOf<{
      path: string;
    }>();
    expectTypeOf<InferDesktopContractCommands<typeof project>>().toEqualTypeOf<
      typeof project.commands
    >();
    expectTypeOf<InferDesktopContractEvents<typeof project>>().toEqualTypeOf<
      typeof project.events
    >();
    expectTypeOf<InferDesktopAppContracts<typeof definition>>().toEqualTypeOf<
      typeof definition.contracts
    >();
    expectTypeOf<InferDesktopAppWindows<typeof definition>>().toEqualTypeOf<
      typeof definition.windows
    >();
    expectTypeOf(
      definition.contracts.project.commands.readFile.id,
    ).toEqualTypeOf<"project.readFile">();
    expectTypeOf(
      definition.contracts.project.events.fileChanged.id,
    ).toEqualTypeOf<"project.fileChanged">();
    expectTypeOf(definition.windows.main).toExtend<DesktopLocalWindowDefinition>();
    expectTypeOf(definition.windows.login).toExtend<DesktopRemoteWindowDefinition>();
  });

  it("keeps privileged local-window fields absent from remote-window types", () => {
    expectTypeOf(definition.windows.login.expose).toEqualTypeOf<undefined>();
    expectTypeOf(definition.windows.login.receive).toEqualTypeOf<undefined>();
  });

  it("infers exact command handler inputs and outputs from mounted contracts", () => {
    const implementation: DesktopAppImplementation<typeof definition.contracts> = {
      contracts: {
        project: {
          commands: {
            readFile: async (input, context) => context.ok({ contents: input.path }),
            saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
          },
        },
      },
    };

    definition.implement(implementation);
    expectTypeOf<typeof implementation>().toMatchTypeOf<
      DesktopAppImplementation<typeof definition.contracts>
    >();
    expectTypeOf<typeof implementation.contracts.project>().toMatchTypeOf<
      DesktopContractImplementation<typeof definition.contracts.project>
    >();
    expectTypeOf<typeof implementation.contracts.project.commands.readFile>().toMatchTypeOf<
      DesktopCommandHandler<
        typeof definition.contracts.project.commands.readFile,
        typeof definition.contracts.project
      >
    >();
  });

  it("derives handler authority, events, results, and Problems from each command", () => {
    type ReadContext = DesktopHandlerContext<typeof project.commands.readFile, typeof project>;
    type SaveContext = DesktopHandlerContext<typeof project.commands.saveFile, typeof project>;

    expectTypeOf<ReadContext["filesystem"]["readText"]>().toEqualTypeOf<
      (path: string) => Promise<string>
    >();
    expectTypeOf<keyof SaveContext>().toEqualTypeOf<"ok" | "fail" | "emit" | "signal">();
    expectTypeOf<
      InferDesktopCommandProblem<typeof project.commands.readFile>
    >().toMatchTypeOf<DeclaredProblem>();
    expectTypeOf<
      InferDesktopCommandProblem<typeof annotatedDialogProject.commands.annotatedDialogCommand>
    >().toEqualTypeOf<never>();

    type RendererProblem = {
      readonly code: "DECLARED_PROBLEM";
      readonly category: ProblemCategory.ValidationError;
      readonly extensions: { readonly reason: string };
    };
    expectTypeOf<DesktopResult<string, RendererProblem>>().toEqualTypeOf<
      | { readonly ok: true; readonly value: string }
      | { readonly ok: false; readonly problem: RendererProblem }
    >();

    const handler: DesktopCommandHandler<typeof project.commands.readFile, typeof project> = async (
      input,
      context,
    ) => {
      const contents = await context.filesystem.readText(input.path);
      await context.emit(project.events.fileChanged, { path: input.path });
      return context.ok({ contents });
    };
    expectTypeOf(handler).toMatchTypeOf<
      DesktopCommandHandler<typeof project.commands.readFile, typeof project>
    >();
  });

  it("infers opaque, capability-specific resource references", () => {
    expectTypeOf<InferDesktopContractGrants<typeof grantProject>>().toEqualTypeOf<
      typeof grantProject.grants
    >();
    expectTypeOf<InferDesktopCommandInput<typeof grantProject.commands.read>>().toEqualTypeOf<
      InferDesktopSchema<typeof selectedFile>
    >();
    expectTypeOf<InferDesktopCommandInput<typeof grantProject.commands.save>>().toEqualTypeOf<
      InferDesktopSchema<typeof workspace>
    >();
    expectTypeOf(
      grantDefinition.contracts.project.grants.selectedFile.id,
    ).toEqualTypeOf<"project.selectedFile">();
  });

  it("compiles the negative type fixtures", () => {
    expectTypeOf(negativeTypeFixtures).toBeFunction();
  });
});

function negativeTypeFixtures(): void {
  type ReadContext = DesktopHandlerContext<typeof project.commands.readFile, typeof project>;
  type SaveContext = DesktopHandlerContext<typeof project.commands.saveFile, typeof project>;
  const readContext = undefined as unknown as ReadContext;
  const saveContext = undefined as unknown as SaveContext;
  const problemContext = undefined as unknown as DesktopHandlerContext<
    typeof problemProject.commands.problemCommand,
    typeof problemProject
  >;
  const eventContext = undefined as unknown as DesktopHandlerContext<
    typeof eventProject.commands.correlate,
    typeof eventProject
  >;
  const annotatedDialogContext = undefined as unknown as DesktopHandlerContext<
    typeof annotatedDialogProject.commands.annotatedDialogCommand,
    typeof annotatedDialogProject
  >;

  // @ts-expect-error undeclared effect namespaces are absent from the handler context
  readContext.dialog.openFile();
  // @ts-expect-error declared effect namespaces expose only supported methods
  readContext.filesystem.writeText("file.txt", "contents");
  // @ts-expect-error commands without effects receive no privileged namespaces
  saveContext.filesystem.readText("file.txt");
  // @ts-expect-error handlers can emit only events declared by their command
  readContext.emit(project.events.projectClosed, { path: "file.txt" });
  // @ts-expect-error event payloads preserve their exact declared schema
  readContext.emit(project.events.fileChanged, { projectId: "project-1" });
  // @ts-expect-error handler contexts require their owning contract to prove event authority
  type UnboundContext = DesktopHandlerContext<typeof project.commands.readFile>;

  // @ts-expect-error command event declarations must name events in the same contract
  desktop.contract({
    commands: {
      invalidEvent: desktop.query({
        input: z.string(),
        output: z.string(),
        events: ["missingEvent"],
      }),
    },
    events: { fileChanged },
  });
  // @ts-expect-error success helpers preserve the exact command output
  readContext.ok({ contents: 1 });
  // @ts-expect-error failure helpers accept only the command Problem union
  readContext.fail(new Error("not a declared Problem"));
  // @ts-expect-error commands without declared Problems cannot fail through the typed helper
  saveContext.fail(new DesktopDefinitionProblem("DESKTOP_INVALID_KEY", "invalid"));
  // @ts-expect-error explicitly annotated effects default to no declared Problems
  annotatedDialogContext.fail(new UndeclaredProblem());
  // @ts-expect-error failure helpers preserve the declared code-discriminated Problem union
  problemContext.fail(new UndeclaredProblem());
  const conditionalEvent = chooseBoolean() ? eventProject.events.alpha : eventProject.events.beta;
  // @ts-expect-error union-valued events cannot be paired with one branch's payload
  eventContext.emit(conditionalEvent, { alpha: "alpha" });

  const broadNamespace: string = "filesystem";
  const broadNamespaceEffect = desktop.effect({
    namespace: broadNamespace,
    access: "read",
    methods: { readText: desktop.effect.method<[string], Promise<string>>() },
  });
  // @ts-expect-error effect namespaces must remain literal
  desktop.query({
    input: z.string(),
    output: z.string(),
    effects: [broadNamespaceEffect],
  });

  // @ts-expect-error effect namespaces cannot collide with handler helpers
  desktop.effect({
    namespace: "signal",
    access: "read",
    methods: { aborted: desktop.effect.method<[], Promise<void>>() },
  });

  // @ts-expect-error effect authority must declare read or write access explicitly
  desktop.effect({
    namespace: "filesystem",
    methods: { readText: desktop.effect.method<[], Promise<string>>() },
  });

  // @ts-expect-error effect methods cannot use prototype-sensitive keys
  desktop.effect({
    namespace: "filesystem",
    access: "read",
    methods: { constructor: desktop.effect.method<[], Promise<void>>() },
  });

  const broadMethods: Record<string, DesktopEffectMethodDefinition> = {
    readText: desktop.effect.method<[string], Promise<string>>(),
  };
  const broadMethodEffect = desktop.effect({
    namespace: "filesystem",
    access: "read",
    methods: broadMethods,
  });
  // @ts-expect-error effect method records must preserve exact keys
  desktop.query({
    input: z.string(),
    output: z.string(),
    effects: [broadMethodEffect],
  });

  const broadEffects: AnyDesktopEffect[] = [filesystemRead];
  // @ts-expect-error command effects must remain a literal tuple
  desktop.query({
    input: z.string(),
    output: z.string(),
    effects: broadEffects,
  });

  const chooseEffect = undefined as unknown as boolean;
  const conditionalEffect = chooseEffect ? filesystemRead : dialogOpen;
  // @ts-expect-error each tuple position must contain one concrete effect
  desktop.query({
    input: z.string(),
    output: z.string(),
    effects: [conditionalEffect],
  });

  const conditionalEffects = chooseEffect ? [filesystemRead] : [dialogOpen];
  // @ts-expect-error conditional arrays cannot widen command authority
  desktop.query({
    input: z.string(),
    output: z.string(),
    effects: conditionalEffects,
  });

  const conditionalProblem = chooseEffect ? declaredProblem : undeclaredProblem;
  // @ts-expect-error each Problem tuple position must contain one concrete constructor
  desktop.query({
    input: z.string(),
    output: z.string(),
    problems: [conditionalProblem],
  });

  const broadEvents: string[] = ["fileChanged"];
  // @ts-expect-error command events must remain a literal tuple
  desktop.query({
    input: z.string(),
    output: z.string(),
    events: broadEvents,
  });

  const broadProblemCommand = desktop.query({
    input: z.string(),
    output: z.string(),
    problems: [
      desktop.problem(BroadCodeProblem, {
        code: "BROAD_CODE_PROBLEM",
        category: ProblemCategory.ValidationError,
      }),
    ],
  });
  const broadProblemContext = undefined as unknown as DesktopHandlerContext<
    typeof broadProblemCommand,
    typeof problemProject
  >;
  // @ts-expect-error failure values must match the declared code discriminant
  broadProblemContext.fail(new BroadCodeProblem());

  type ReadFileReference = InferDesktopSchema<typeof selectedFile>;
  const writableFile = desktop.grant.file({ access: "write", scope: "exact", lifetime: "command" });
  type WriteFileReference = InferDesktopSchema<typeof writableFile>;

  const acceptWriteFile = (_reference: WriteFileReference): void => undefined;
  const readFileReference = undefined as unknown as ReadFileReference;
  // @ts-expect-error read-only file grants cannot satisfy write grant inputs
  acceptWriteFile(readFileReference);

  desktop.grant.file({
    access: "read",
    // @ts-expect-error file grants only authorize an exact resource, never descendants
    scope: "descendant",
    lifetime: "command",
  });

  // @ts-expect-error command and event keys share the same stable ID namespace
  desktop.contract({
    commands: {
      duplicate: desktop.query({ input: z.string(), output: z.string() }),
    },
    events: {
      duplicate: desktop.event({ payload: z.string() }),
    },
  });

  // @ts-expect-error reserved member keys are rejected
  desktop.contract({
    commands: {
      metadata: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error __proto__ is a reserved member key
  desktop.contract({
    commands: {
      __proto__: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error constructor is a reserved member key
  desktop.contract({
    commands: {
      constructor: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error prototype is a reserved member key
  desktop.contract({
    commands: {
      prototype: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error contracts is a reserved member key
  desktop.contract({
    commands: {
      contracts: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error windows is a reserved member key
  desktop.contract({
    commands: {
      windows: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error commands is a reserved member key
  desktop.contract({
    commands: {
      commands: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error events is a reserved member key
  desktop.contract({
    commands: {
      events: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error implement is a reserved member key
  desktop.contract({
    commands: {
      implement: desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error empty member keys are rejected
  desktop.contract({
    commands: {
      "": desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error reserved contract keys are rejected
  desktop.app({
    contracts: {
      windows: project,
    },
    windows: {},
  });

  // @ts-expect-error reserved window keys are rejected
  desktop.app({
    contracts: { project },
    windows: {
      metadata: desktop.window.local(),
    },
  });

  desktop.window.remote({
    initialUrl: "https://example.com",
    allowedOrigins: ["https://example.com"],
    // @ts-expect-error remote windows cannot expose privileged commands
    expose: [project.commands.readFile],
  });

  const forgedRemote = {
    definitionType: "window",
    trust: "remote",
    initialUrl: "https://example.com",
    allowedOrigins: ["https://example.com"],
    expose: [project.commands.readFile],
  } as const;
  desktop.app({
    contracts: { project },
    windows: {
      // @ts-expect-error app boundary rejects privileged fields on remote windows
      forgedRemote,
    },
  });

  // @ts-expect-error dotted member keys would make derived IDs ambiguous
  desktop.contract({
    commands: {
      "read.file": desktop.query({ input: z.string(), output: z.string() }),
    },
  });

  // @ts-expect-error dotted contract keys would make derived IDs ambiguous
  desktop.app({
    contracts: {
      "project.files": project,
    },
    windows: {},
  });

  desktop.window.remote({
    initialUrl: "https://example.com",
    allowedOrigins: ["https://example.com"],
    // @ts-expect-error remote windows cannot receive privileged events
    receive: [project.events.fileChanged],
  });

  desktop.window.local({
    // @ts-expect-error events cannot be exposed as commands
    expose: [project.events.fileChanged],
  });

  desktop.window.local({
    // @ts-expect-error commands cannot be received as events
    receive: [project.commands.readFile],
  });

  definition.implement({
    contracts: {
      project: {
        // @ts-expect-error every declared command requires a handler
        commands: {
          readFile: (input, context) => context.ok({ contents: input.path }),
        },
      },
    },
  });

  definition.implement({
    contracts: {
      project: {
        // @ts-expect-error command keys must be declared by the mounted contract
        commands: {
          readFile: (input, context) => context.ok({ contents: input.path }),
          saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
          deleteFile: () => ({ deleted: true }),
        },
      },
    },
  });

  definition.implement({
    contracts: {
      project: {
        commands: {
          // @ts-expect-error handler results must match the declared output schema
          readFile: (input, context) => context.ok({ contents: input.path.length }),
          saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
        },
      },
    },
  });

  definition.implement({
    contracts: {
      // @ts-expect-error contract implementations contain commands only
      project: {
        commands: {
          readFile: (input, context) => context.ok({ contents: input.path }),
          saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
        },
        events: {},
      },
    },
  });

  definition.implement({
    contracts: {
      // @ts-expect-error implementation contracts must be mounted by the app
      workspace: {
        commands: {},
      },
    },
  });

  const implementationWithUnknownCommand = {
    contracts: {
      project: {
        commands: {
          readFile: (input: { path: string }) =>
            ({ ok: true, value: { contents: input.path } }) as const,
          saveFile: (input: { path: string; contents: string }) =>
            ({
              ok: true,
              value: { saved: input.contents.length > 0 },
            }) as const,
          deleteFile: () => ({ ok: true, value: { deleted: true } }) as const,
        },
      },
    },
  };
  // @ts-expect-error non-literal implementations cannot hide unknown command handlers
  definition.implement(implementationWithUnknownCommand);
}

function chooseBoolean(): boolean {
  return true;
}
