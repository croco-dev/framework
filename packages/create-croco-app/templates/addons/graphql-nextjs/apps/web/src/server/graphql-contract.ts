import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGraphQLContractSnapshot,
  diffGraphQLContractSnapshots,
  isGraphQLContractSnapshot,
  stringifyGraphQLContractSnapshot,
} from "@croco/protocols-graphql";
import { HealthResolver } from "./resolvers/health.resolver";
import { createSchema } from "./schema";

const SNAPSHOT_PATH = join(process.cwd(), "graphql-contract.snapshot.json");

async function main(): Promise<void> {
  const shouldWrite = process.argv.includes("--write");
  const schema = await createSchema();
  const current = createGraphQLContractSnapshot(schema, { resolvers: [HealthResolver] });

  if (shouldWrite) {
    writeFileSync(SNAPSHOT_PATH, stringifyGraphQLContractSnapshot(current));
    return;
  }

  if (!existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      "Missing graphql-contract.snapshot.json. Run pnpm contract:snapshot before contract:check.",
    );
  }

  const baseline = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as unknown;
  if (!isGraphQLContractSnapshot(baseline)) {
    throw new Error("graphql-contract.snapshot.json is not a Croco GraphQL contract snapshot.");
  }

  const diff = diffGraphQLContractSnapshots(baseline, current);

  if (diff.hasBreakingChanges) {
    console.error(
      diff.breakingChanges.map((change) => `${change.code}: ${change.message}`).join("\n"),
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
