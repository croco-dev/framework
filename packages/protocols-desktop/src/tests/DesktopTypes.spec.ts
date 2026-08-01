import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { desktop } from "../libs/desktop";
import type {
  DesktopAppImplementation,
  DesktopCommandHandler,
  DesktopContractImplementation,
  DesktopLocalWindowDefinition,
  DesktopRemoteWindowDefinition,
  InferDesktopAppContracts,
  InferDesktopAppWindows,
  InferDesktopCommandInput,
  InferDesktopCommandOutput,
  InferDesktopContractCommands,
  InferDesktopContractEvents,
  InferDesktopEventPayload,
} from "../libs/types";

const project = desktop.contract({
  commands: {
    readFile: desktop.query({
      input: z.object({ path: z.string() }),
      output: z.object({ contents: z.string() }),
    }),
    saveFile: desktop.mutation({
      input: z.object({ path: z.string(), contents: z.string() }),
      output: z.object({ saved: z.boolean() }),
    }),
  },
  events: {
    fileChanged: desktop.event({
      payload: z.object({ path: z.string() }),
    }),
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
            readFile: async (input) => ({ contents: input.path }),
            saveFile: (input) => ({ saved: input.contents.length > 0 }),
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
      DesktopCommandHandler<typeof definition.contracts.project.commands.readFile>
    >();
  });

  it("compiles the negative type fixtures", () => {
    expectTypeOf(negativeTypeFixtures).toBeFunction();
  });
});

function negativeTypeFixtures(): void {
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
          readFile: (input) => ({ contents: input.path }),
        },
      },
    },
  });

  definition.implement({
    contracts: {
      project: {
        // @ts-expect-error command keys must be declared by the mounted contract
        commands: {
          readFile: (input) => ({ contents: input.path }),
          saveFile: (input) => ({ saved: input.contents.length > 0 }),
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
          readFile: (input) => ({ contents: input.path.length }),
          saveFile: (input) => ({ saved: input.contents.length > 0 }),
        },
      },
    },
  });

  definition.implement({
    contracts: {
      // @ts-expect-error contract implementations contain commands only
      project: {
        commands: {
          readFile: (input) => ({ contents: input.path }),
          saveFile: (input) => ({ saved: input.contents.length > 0 }),
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
          readFile: (input: { path: string }) => ({ contents: input.path }),
          saveFile: (input: { path: string; contents: string }) => ({
            saved: input.contents.length > 0,
          }),
          deleteFile: () => ({ deleted: true }),
        },
      },
    },
  };
  // @ts-expect-error non-literal implementations cannot hide unknown command handlers
  definition.implement(implementationWithUnknownCommand);
}
