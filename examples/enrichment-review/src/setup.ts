import { createEnrichment } from "@croco/analytics-drizzle";
import { database } from "./database";
import { createFixture, inputs, limits, scope } from "./fixture";

async function setup() {
  const { pool, db, store } = database();
  try {
    await createEnrichment(db);
    await createFixture(store).service.enqueueBatch(scope, "demo", inputs, limits, {
      rawMs: 86400000,
      resultMs: 604800000,
    });
    await createFixture(store).service.enqueueBatch(
      scope,
      "demo-large",
      Array.from({ length: 26 }, (_, index) => ({
        ...inputs[index % inputs.length],
        itemId: `sample-${String(index).padStart(2, "0")}`,
        ...(index === 23
          ? {
              context: { ...inputs[index % inputs.length].context, syntheticAcceptance: "unknown" },
            }
          : {}),
      })),
      { ...limits, maxRequests: 64, maxReservedTokens: 131072 },
      { rawMs: 86400000, resultMs: 604800000 },
    );
  } finally {
    await pool.end();
  }
}
void setup();
