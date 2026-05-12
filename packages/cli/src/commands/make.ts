import { defineCommand } from "citty";
import { makeController } from "./makeController.js";
import { makeEntity } from "./makeEntity.js";
import { makeEvent } from "./makeEvent.js";
import { makeListener } from "./makeListener.js";
import { makeRepository } from "./makeRepository.js";
import { GLOBAL_OPTIONS } from "./options.js";

export const make = defineCommand({
  meta: {
    name: "make",
    description: "Create Croco application artifacts",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    controller: makeController,
    repository: makeRepository,
    entity: makeEntity,
    event: makeEvent,
    listener: makeListener,
  },
});
