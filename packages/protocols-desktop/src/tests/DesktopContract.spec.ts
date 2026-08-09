import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DesktopDefinitionProblem } from "../libs/DesktopDefinitionProblem";
import { desktop } from "../libs/desktop";
import type { DesktopLocalWindowDefinition, DesktopRemoteWindowDefinition } from "../libs/types";

describe("desktop contract DSL", () => {
  it("preserves declarative command authority without installing effect implementations", () => {
    const changed = desktop.event({ payload: z.object({ path: z.string() }) });
    const filesystem = desktop.effect({
      namespace: "filesystem",
      methods: {
        readText: desktop.effect.method<[path: string], Promise<string>>(),
      },
    });
    const command = desktop.query({
      input: z.object({ path: z.string() }),
      output: z.object({ contents: z.string() }),
      effects: [filesystem],
      events: ["changed"],
      problems: [DesktopDefinitionProblem],
    });

    expect(command.effects).toEqual([
      {
        definitionType: "effect",
        namespace: "filesystem",
        methods: { readText: { definitionType: "effect-method" } },
      },
    ]);
    expect(command.events).toEqual(["changed"]);
    expect(command.problems).toEqual([DesktopDefinitionProblem]);
    expect(command.effects[0]?.methods.readText).not.toHaveProperty("implementation");
  });

  it.each(["signal", "metadata", "filesystem.read", ""])(
    "rejects invalid effect namespace %j at runtime",
    (namespace) => {
      expect(() =>
        desktop.effect({
          namespace,
          methods: { readText: desktop.effect.method<[string], Promise<string>>() },
        } as never),
      ).toThrowError(DesktopDefinitionProblem);
    },
  );

  it.each(["constructor", "metadata", "read.text", ""])(
    "rejects invalid effect method %j at runtime",
    (method) => {
      expect(() =>
        desktop.effect({
          namespace: "filesystem",
          methods: { [method]: desktop.effect.method<[string], Promise<string>>() },
        } as never),
      ).toThrowError(DesktopDefinitionProblem);
    },
  );

  it("derives stable command and event IDs from app object keys", () => {
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

    expect(definition.contracts.project.commands.readFile.id).toBe("project.readFile");
    expect(definition.contracts.project.commands.saveFile.id).toBe("project.saveFile");
    expect(definition.contracts.project.events.fileChanged.id).toBe("project.fileChanged");
    expect(definition.windows.main.expose.map((command) => command.id)).toEqual([
      "project.readFile",
      "project.saveFile",
    ]);
    expect(definition.windows.main.receive[0]?.id).toBe("project.fileChanged");
    expect(definition.windows.login).toEqual({
      definitionType: "window",
      trust: "remote",
      initialUrl: "https://login.example.com",
      allowedOrigins: ["https://login.example.com"],
    });
  });

  it("emits deterministic compiler-compatible metadata", () => {
    const system = desktop.contract({
      events: {
        ready: desktop.event({ payload: z.object({ at: z.number() }) }),
      },
      commands: {
        status: desktop.query({
          input: z.object({}),
          output: z.object({ ready: z.boolean() }),
        }),
      },
    });
    const project = desktop.contract({
      commands: {
        open: desktop.mutation({
          input: z.object({ id: z.string() }),
          output: z.object({ opened: z.boolean() }),
        }),
      },
    });

    const definition = desktop.app({
      contracts: { system, project },
      windows: {
        remote: desktop.window.remote({
          initialUrl: "https://example.com",
          allowedOrigins: ["https://example.com"],
        }),
        main: desktop.window.local({
          expose: [project.commands.open, system.commands.status],
          receive: [system.events.ready],
        }),
      },
    });

    expect(definition.metadata).toEqual({
      schema: "croco.desktop-app-definition.v1",
      contracts: [
        {
          key: "project",
          members: [{ id: "project.open", key: "open", kind: "mutation" }],
          grants: [],
        },
        {
          key: "system",
          members: [
            { id: "system.ready", key: "ready", kind: "event" },
            { id: "system.status", key: "status", kind: "query" },
          ],
          grants: [],
        },
      ],
      windows: [
        {
          key: "main",
          trust: "local",
          expose: [
            { id: "project.open", key: "open", kind: "command" },
            { id: "system.status", key: "status", kind: "command" },
          ],
          receive: [{ id: "system.ready", key: "ready", kind: "event" }],
        },
        {
          key: "remote",
          trust: "remote",
          initialUrl: "https://example.com",
          allowedOrigins: ["https://example.com"],
        },
      ],
    });
  });

  it("orders metadata by code units across mixed-case and non-ASCII keys", () => {
    const definition = desktop.contract({
      commands: {
        한글: desktop.query({ input: z.string(), output: z.string() }),
        open: desktop.query({ input: z.string(), output: z.string() }),
        Open: desktop.query({ input: z.string(), output: z.string() }),
      },
    });

    const app = desktop.app({
      contracts: {
        프로젝트: definition,
        project: definition,
        Project: definition,
      },
      windows: {},
    });

    expect(app.metadata.contracts.map((contract) => contract.key)).toEqual([
      "Project",
      "project",
      "프로젝트",
    ]);
    expect(app.metadata.contracts[0]?.members.map((member) => member.key)).toEqual([
      "Open",
      "open",
      "한글",
    ]);
  });

  it("does not mutate reusable contract or window definitions", () => {
    const project = desktop.contract({
      commands: {
        read: desktop.query({
          input: z.object({ id: z.string() }),
          output: z.object({ value: z.string() }),
        }),
      },
    });
    const main = desktop.window.local({ expose: [project.commands.read] });

    const first = desktop.app({ contracts: { project }, windows: { main } });
    const second = desktop.app({
      contracts: { workspace: project },
      windows: { main },
    });

    expect("id" in project.commands.read).toBe(false);
    expect("id" in main.expose[0]).toBe(false);
    expect(first.contracts.project.commands.read.id).toBe("project.read");
    expect(second.contracts.workspace.commands.read.id).toBe("workspace.read");
  });

  it("binds opaque resource grants with deterministic metadata", () => {
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
    const project = desktop.contract({
      grants: { workspace, selectedFile },
      commands: {
        read: desktop.query({ input: selectedFile, output: z.object({ contents: z.string() }) }),
        save: desktop.mutation({ input: workspace, output: z.object({ saved: z.boolean() }) }),
      },
    });

    const definition = desktop.app({
      contracts: { project },
      windows: {},
    });

    expect(definition.contracts.project.grants.selectedFile.id).toBe("project.selectedFile");
    expect(definition.contracts.project.grants.workspace.id).toBe("project.workspace");
    expect(definition.metadata.contracts).toEqual([
      {
        key: "project",
        members: [
          { id: "project.read", key: "read", kind: "query" },
          { id: "project.save", key: "save", kind: "mutation" },
          { id: "project.selectedFile", key: "selectedFile", kind: "grant" },
          { id: "project.workspace", key: "workspace", kind: "grant" },
        ],
        grants: [
          {
            id: "project.selectedFile",
            key: "selectedFile",
            resource: "file",
            access: "read",
            scope: "exact",
            lifetime: "command",
          },
          {
            id: "project.workspace",
            key: "workspace",
            resource: "directory",
            access: "write",
            scope: "descendant",
            lifetime: "session",
          },
        ],
      },
    ]);
    expect(project.metadata.grants).toEqual([
      {
        key: "selectedFile",
        resource: "file",
        access: "read",
        scope: "exact",
        lifetime: "command",
      },
      {
        key: "workspace",
        resource: "directory",
        access: "write",
        scope: "descendant",
        lifetime: "session",
      },
    ]);
  });

  it("rejects ambiguous references when one contract is mounted under multiple keys", () => {
    const project = desktop.contract({
      commands: {
        read: desktop.query({
          input: z.object({ id: z.string() }),
          output: z.object({ value: z.string() }),
        }),
      },
    });

    expect(() =>
      desktop.app({
        contracts: { project, workspace: project },
        windows: {
          main: desktop.window.local({ expose: [project.commands.read] }),
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "DESKTOP_AMBIGUOUS_MEMBER_REFERENCE",
      }),
    );
  });

  it("rejects local-window references to contracts that are not mounted by the app", () => {
    const project = desktop.contract({
      commands: {
        read: desktop.query({ input: z.string(), output: z.string() }),
      },
    });

    expect(() =>
      desktop.app({
        contracts: {},
        windows: {
          main: desktop.window.local({ expose: [project.commands.read] }),
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "DESKTOP_UNMOUNTED_MEMBER_REFERENCE",
      }),
    );
  });

  it("strips privileged fields from structurally forged remote windows", () => {
    const project = desktop.contract({
      commands: {
        read: desktop.query({ input: z.string(), output: z.string() }),
      },
    });
    const forgedRemote = {
      definitionType: "window",
      trust: "remote",
      initialUrl: "https://example.com",
      allowedOrigins: ["https://example.com"],
      expose: [project.commands.read],
    } as unknown as DesktopRemoteWindowDefinition;

    const definition = desktop.app({
      contracts: { project },
      windows: { forgedRemote },
    });

    expect(definition.windows.forgedRemote).toEqual({
      definitionType: "window",
      trust: "remote",
      initialUrl: "https://example.com",
      allowedOrigins: ["https://example.com"],
    });
    expect(definition.metadata.windows).toEqual([
      {
        key: "forgedRemote",
        trust: "remote",
        initialUrl: "https://example.com",
        allowedOrigins: ["https://example.com"],
      },
    ]);
  });

  it("strips remote-only fields from structurally forged local windows", () => {
    const project = desktop.contract({
      commands: {
        read: desktop.query({ input: z.string(), output: z.string() }),
      },
    });
    const forgedLocal = {
      definitionType: "window",
      trust: "local",
      expose: [project.commands.read],
      receive: [],
      initialUrl: "https://example.com",
      allowedOrigins: ["https://example.com"],
    } as unknown as DesktopLocalWindowDefinition<
      readonly [typeof project.commands.read],
      readonly []
    >;

    const definition = desktop.app({
      contracts: { project },
      windows: { forgedLocal },
    });

    expect(definition.windows.forgedLocal).toEqual({
      definitionType: "window",
      trust: "local",
      expose: [expect.objectContaining({ id: "project.read" })],
      receive: [],
    });
  });

  it.each(["read.file", "metadata", ""])("rejects invalid key %j at runtime", (key) => {
    expect(() =>
      desktop.contract({
        commands: {
          [key]: desktop.query({ input: z.string(), output: z.string() }),
        },
      } as never),
    ).toThrowError(DesktopDefinitionProblem);
  });

  it("rejects duplicate command and event keys at runtime", () => {
    expect(() =>
      desktop.contract({
        commands: {
          duplicate: desktop.query({ input: z.string(), output: z.string() }),
        },
        events: {
          duplicate: desktop.event({ payload: z.string() }),
        },
      } as never),
    ).toThrowError(
      expect.objectContaining({
        code: "DESKTOP_DUPLICATE_MEMBER_KEY",
      }),
    );
  });

  it("rejects duplicate grant keys across the contract member namespace", () => {
    expect(() =>
      desktop.contract({
        commands: {
          selectedFile: desktop.query({ input: z.string(), output: z.string() }),
        },
        grants: {
          selectedFile: desktop.grant.file({
            access: "read",
            scope: "exact",
            lifetime: "command",
          }),
        },
      } as never),
    ).toThrowError(
      expect.objectContaining({
        code: "DESKTOP_DUPLICATE_MEMBER_KEY",
      }),
    );
  });
});
