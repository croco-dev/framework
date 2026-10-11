import { it } from "vitest";
import { generateClientFilesFromContractGraph } from "../libs/generate";
import {
  createLocaleGraph,
  verifyLocaleArtifacts,
} from "../../../openapi-spec/src/tests/fixtures/localeGeneration";

it("generates byte-identical RPC artifacts across process locales", () => {
  verifyLocaleArtifacts(import.meta.url, (directory) => {
    generateClientFilesFromContractGraph(createLocaleGraph(), directory);
  });
}, 120_000);
