import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { desktop } from "../libs/desktop";
import type {
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
}
