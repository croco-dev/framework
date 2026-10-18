import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { codegen } from "@graphql-codegen/core";
import * as typescript from "@graphql-codegen/typescript";
import * as operations from "@graphql-codegen/typescript-operations";
import * as sdk from "@graphql-codegen/typescript-generic-sdk";
import { parse } from "graphql";

const filename = "src/generated/graphql.ts";
const output = await codegen({
  filename,
  schema: parse(await readFile("src/schema.graphql", "utf8")),
  documents: [{ document: parse(await readFile("src/operations.graphql", "utf8")) }],
  plugins: [{ typescript: {} }, { operations: {} }, { sdk: {} }],
  pluginMap: { typescript, operations, sdk },
  config: {
    rawRequest: true,
    documentMode: "graphQLTag",
    useTypeImports: true,
    defaultScalarType: "unknown",
  },
});
const formatted = execFileSync("../../node_modules/.bin/oxfmt", ["--stdin-filepath", filename], {
  input: output,
  encoding: "utf8",
});
if (process.argv.includes("--check")) {
  if ((await readFile(filename, "utf8")) !== formatted)
    throw new Error("Generated GraphQL SDK drift; run pnpm codegen");
} else {
  await mkdir("src/generated", { recursive: true });
  await writeFile(filename, formatted);
}
