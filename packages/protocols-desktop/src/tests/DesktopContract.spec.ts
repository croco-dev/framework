import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DesktopDefinitionProblem } from "../libs/DesktopDefinitionProblem";
import { desktop } from "../libs/desktop";
import type { DesktopRemoteWindowDefinition } from "../libs/types";

describe("desktop contract DSL", () => {
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
        },
        {
          key: "system",
          members: [
            { id: "system.ready", key: "ready", kind: "event" },
            { id: "system.status", key: "status", kind: "query" },
          ],
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
  });

  it("rejects dotted keys before they can collide in the derived ID namespace", () => {
    expect(() =>
      desktop.contract({
        commands: {
          "read.file": desktop.query({ input: z.string(), output: z.string() }),
        },
      } as never),
    ).toThrowError(DesktopDefinitionProblem);
  });
});
