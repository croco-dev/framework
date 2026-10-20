import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { codegen } from "@graphql-codegen/core";
import * as typescript from "@graphql-codegen/typescript";
import * as operations from "@graphql-codegen/typescript-operations";
import * as documents from "@graphql-codegen/typed-document-node";
import { buildSchema, parse } from "graphql";

export async function generate(schemaSDL, source) {
  return codegen({
    filename: "graphql.ts",
    schema: buildSchema(schemaSDL),
    documents: [{ document: parse(source) }],
    plugins: [{ typescript: {} }, { operations: {} }, { documents: {} }],
    pluginMap: { typescript, operations, documents },
    config: {
      useTypeImports: true,
      strictScalars: true,
      scalars: { Money: { input: "string", output: "string" } },
    },
  });
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const filename = "src/generated/graphql.ts";
  const output = await generate(
    await readFile("src/schema.graphql", "utf8"),
    await readFile("src/operations.graphql", "utf8"),
  );
  const formatted = execFileSync("../../node_modules/.bin/oxfmt", ["--stdin-filepath", filename], {
    input: output,
    encoding: "utf8",
  });
  if (process.argv.includes("--check")) {
    if ((await readFile(filename, "utf8")) !== formatted)
      throw new Error("GraphQL document drift; run pnpm codegen");
  } else {
    await mkdir("src/generated", { recursive: true });
    await writeFile(filename, formatted);
  }
}
