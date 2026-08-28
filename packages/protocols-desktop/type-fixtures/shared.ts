import { z } from "zod";

import { desktop } from "../src/libs/desktop";

export const filesystem = desktop.effect({
  namespace: "filesystem",
  methods: {
    readText: desktop.effect.method<[path: string], Promise<string>>(),
  },
});

export const changed = desktop.event({
  payload: z.object({ path: z.string() }),
});

export const closed = desktop.event({
  payload: z.object({ path: z.string() }),
});

export const selectedFile = desktop.grant.file({
  access: "read",
  scope: "exact",
  lifetime: "command",
});

export const writableFile = desktop.grant.file({
  access: "write",
  scope: "exact",
  lifetime: "command",
});

export const project = desktop.contract({
  grants: { selectedFile, writableFile },
  commands: {
    readFile: desktop.query({
      input: z.object({ path: z.string() }),
      output: z.object({ contents: z.string() }),
      effects: [filesystem],
      events: ["changed"],
    }),
    saveFile: desktop.mutation({
      input: z.object({ path: z.string(), contents: z.string() }),
      output: z.object({ saved: z.boolean() }),
    }),
  },
  events: { changed, closed },
});

export const definition = desktop.app({
  contracts: { project },
  windows: {
    main: desktop.window.local({
      expose: [project.commands.readFile, project.commands.saveFile],
      receive: [project.events.changed],
    }),
  },
});
