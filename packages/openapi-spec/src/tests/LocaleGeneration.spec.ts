import * as fs from "node:fs";
import * as path from "node:path";
import { it } from "vitest";
import { emitOpenAPIFromContractGraph } from "../libs/emitOpenAPI";
import { createLocaleGraph, verifyLocaleArtifacts } from "./fixtures/localeGeneration";

it("generates byte-identical OpenAPI artifacts across process locales", () => {
  verifyLocaleArtifacts(import.meta.url, (directory) => {
    const document = emitOpenAPIFromContractGraph(createLocaleGraph());
    fs.writeFileSync(
      path.join(directory, "openapi.json"),
      `${JSON.stringify(document, null, 2)}\n`,
    );
  });
}, 120_000);
