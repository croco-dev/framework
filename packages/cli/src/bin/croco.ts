#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { codegen } from "../commands/codegen.js";
import { create } from "../commands/create.js";
import { generate } from "../commands/generate.js";
import { make } from "../commands/make.js";
import { migrate } from "../commands/migrate.js";
import { GLOBAL_OPTIONS } from "../commands/options.js";

const main = defineCommand({
  meta: {
    name: "croco",
    description: "Croco framework CLI",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    make,
    create,
    generate,
    codegen,
    migrate,
  },
});

runMain(main);
