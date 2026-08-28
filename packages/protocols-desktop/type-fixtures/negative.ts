import { desktop } from "../src/libs/desktop";
import type { InferDesktopSchema } from "../src/libs/types";

import { definition, project } from "./shared";
import type { selectedFile, writableFile } from "./shared";

definition.implement({
  contracts: {
    project: {
      // EXPECT_ERROR:missing-handler
      commands: {
        readFile: (input, context) => context.ok({ contents: input.path }),
      },
    },
  },
});

definition.implement({
  contracts: {
    project: {
      // EXPECT_ERROR:extra-handler
      commands: {
        readFile: (input, context) => context.ok({ contents: input.path }),
        saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
        deleteFile: () => ({ ok: true, value: { deleted: true } }),
      },
    },
  },
});

definition.implement({
  contracts: {
    project: {
      commands: {
        // EXPECT_ERROR:invalid-handler-output
        readFile: (input, context) => context.ok({ contents: input.path.length }),
        saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
      },
    },
  },
});

definition.implement({
  contracts: {
    project: {
      commands: {
        readFile: async (input, context) => {
          // EXPECT_ERROR:undeclared-effect
          await context.dialog.openFile();
          return context.ok({ contents: input.path });
        },
        saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
      },
    },
  },
});

definition.implement({
  contracts: {
    project: {
      commands: {
        readFile: async (input, context) => {
          // EXPECT_ERROR:undeclared-event
          await context.emit(project.events.closed, { path: input.path });
          return context.ok({ contents: input.path });
        },
        saveFile: (input, context) => context.ok({ saved: input.contents.length > 0 }),
      },
    },
  },
});

type ReadFileReference = InferDesktopSchema<typeof selectedFile>;
type WriteFileReference = InferDesktopSchema<typeof writableFile>;
const readFileReference = undefined as unknown as ReadFileReference;
const acceptWriteFile = (_reference: WriteFileReference): void => undefined;
// EXPECT_ERROR:wrong-grant-access
acceptWriteFile(readFileReference);

desktop.window.remote({
  initialUrl: "https://example.com",
  allowedOrigins: ["https://example.com"],
  // EXPECT_ERROR:remote-privileged-exposure
  expose: [project.commands.readFile],
});
